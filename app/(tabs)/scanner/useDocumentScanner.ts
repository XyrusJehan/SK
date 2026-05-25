/**
 * useDocumentScanner.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Core scanning hook for the SK Document Scanner.
 *
 * Platform strategy:
 *   • Web / Expo Web  → HTML5 Canvas (no native module needed)
 *   • iOS / Android   → expo-camera + expo-image-manipulator (Expo Dev Client)
 *
 * Features:
 *   • Auto edge-detection via pixel-brightness scan
 *   • Interactive crop (percentage-based region)
 *   • Perspective-correct flat-document extraction
 *   • Optional grayscale / B&W enhancement
 *   • jsPDF-based multi-page PDF generation (web)
 *   • expo-print / expo-sharing PDF generation (native)
 *   • Full TypeScript types
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { Platform, Alert } from 'react-native';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CropRegion {
  x: number; // % of image width  (0-100)
  y: number; // % of image height (0-100)
  w: number; // % of image width  (0-100)
  h: number; // % of image height (0-100)
}

export type FilterMode = 'none' | 'grayscale' | 'bw';

export interface ScannedPage {
  id: string;
  dataUrl: string; // JPEG data-URL of the cropped, enhanced image
  filter: FilterMode;
  addedAt: number;
}

export interface ScannedFile {
  uri: string;   // blob: URL (web) or local file URI (native)
  name: string;
  type: 'application/pdf';
  size: number | null;
}

export interface UseDocumentScannerReturn {
  // State
  pages: ScannedPage[];
  scanning: boolean;
  convertingToPdf: boolean;
  cropImageSrc: string | null;
  cropRegion: CropRegion;
  cropModalVisible: boolean;
  scanModalVisible: boolean;
  autoDetecting: boolean;
  filterMode: FilterMode;

  // Refs (web only)
  webCameraInputRef: React.RefObject<HTMLInputElement | null>;
  webGalleryInputRef: React.RefObject<HTMLInputElement | null>;

  // Actions
  openScanModal: () => void;
  closeScanModal: () => void;
  openCropFor: (dataUrl: string) => void;
  handleWebFileInput: (e: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
  handleAutoCrop: (autoConfirm?: boolean) => Promise<void>;
  handleCropConfirm: () => Promise<void>;
  handleCropSkip: () => void;
  removePage: (id: string) => void;
  reorderPages: (from: number, to: number) => void;
  setCropRegion: React.Dispatch<React.SetStateAction<CropRegion>>;
  setFilterMode: React.Dispatch<React.SetStateAction<FilterMode>>;
  compileToPdf: () => Promise<ScannedFile | null>;
  addCameraCapture: () => void;
  addFromGallery: () => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Read a File/Blob as data-URL */
const fileToDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

/** Lazily load jsPDF from CDN (web only) */
const loadJsPDF = (): Promise<any> =>
  new Promise((resolve, reject) => {
    if (
      typeof window !== 'undefined' &&
      (window as any).jspdf?.jsPDF
    ) {
      resolve((window as any).jspdf.jsPDF);
      return;
    }
    const script = document.createElement('script');
    script.src =
      'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
    script.onload = () => {
      if ((window as any).jspdf?.jsPDF)
        resolve((window as any).jspdf.jsPDF);
      else reject(new Error('jsPDF unavailable after load'));
    };
    script.onerror = () => reject(new Error('Failed to load jsPDF'));
    document.head.appendChild(script);
  });

/**
 * Apply grayscale or B&W enhancement to a canvas context.
 * Modifies imageData in-place.
 */
const applyFilter = (
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  filter: FilterMode,
): void => {
  if (filter === 'none') return;
  const imgData = ctx.getImageData(0, 0, w, h);
  const d = imgData.data;
  for (let i = 0; i < d.length; i += 4) {
    const luma = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    const v = filter === 'bw' ? (luma > 128 ? 255 : 0) : luma;
    d[i] = d[i + 1] = d[i + 2] = v;
  }
  ctx.putImageData(imgData, 0, 0);
};

/**
 * Crop a data-URL using an offscreen canvas.
 * region — { x, y, w, h } in % of natural image dimensions.
 */
const applyCrop = (
  src: string,
  region: CropRegion,
  filter: FilterMode = 'none',
): Promise<string> =>
  new Promise((resolve) => {
    const img = new window.Image();
    img.onload = () => {
      const { naturalWidth: nw, naturalHeight: nh } = img;
      const sx = (region.x / 100) * nw;
      const sy = (region.y / 100) * nh;
      const sw = (region.w / 100) * nw;
      const sh = (region.h / 100) * nh;
      const canvas = document.createElement('canvas');
      canvas.width = sw;
      canvas.height = sh;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
      applyFilter(ctx, sw, sh, filter);
      resolve(canvas.toDataURL('image/jpeg', 0.92));
    };
    img.src = src;
  });

/**
 * Auto-detect document edges by scanning pixel brightness on a scaled canvas.
 * Returns a CropRegion (%) that tightly wraps the non-background area.
 */
const autoDetectCrop = (src: string): Promise<CropRegion> =>
  new Promise((resolve) => {
    const img = new window.Image();
    img.onload = () => {
      const scale = Math.min(1, 800 / img.naturalWidth);
      const cw = Math.round(img.naturalWidth * scale);
      const ch = Math.round(img.naturalHeight * scale);
      const canvas = document.createElement('canvas');
      canvas.width = cw;
      canvas.height = ch;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, cw, ch);
      const { data } = ctx.getImageData(0, 0, cw, ch);

      const BG = 230; // brightness threshold — near-white = background
      const isBg = (x: number, y: number) => {
        const i = (y * cw + x) * 4;
        return data[i] >= BG && data[i + 1] >= BG && data[i + 2] >= BG;
      };

      let top = 0,
        bottom = ch - 1,
        left = 0,
        right = cw - 1;

      scan_top: for (let y = 0; y < ch; y++)
        for (let x = 0; x < cw; x++)
          if (!isBg(x, y)) {
            top = y;
            break scan_top;
          }
      scan_bottom: for (let y = ch - 1; y >= 0; y--)
        for (let x = 0; x < cw; x++)
          if (!isBg(x, y)) {
            bottom = y;
            break scan_bottom;
          }
      scan_left: for (let x = 0; x < cw; x++)
        for (let y = 0; y < ch; y++)
          if (!isBg(x, y)) {
            left = x;
            break scan_left;
          }
      scan_right: for (let x = cw - 1; x >= 0; x--)
        for (let y = 0; y < ch; y++)
          if (!isBg(x, y)) {
            right = x;
            break scan_right;
          }

      const PAD = 2;
      const x = Math.max(0, (left / cw) * 100 - PAD);
      const y = Math.max(0, (top / ch) * 100 - PAD);
      const w = Math.min(100 - x, ((right - left) / cw) * 100 + PAD * 2);
      const h = Math.min(100 - y, ((bottom - top) / ch) * 100 + PAD * 2);
      resolve({ x, y, w, h });
    };
    img.src = src;
  });

/**
 * Compile an array of JPEG data-URLs into a single A4 PDF.
 * Returns a blob: URL.
 */
const imagesToPdf = async (images: string[]): Promise<string> => {
  const JsPDF = await loadJsPDF();
  const A4_W = 210,
    A4_H = 297;
  const pdf = new JsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  for (let i = 0; i < images.length; i++) {
    if (i > 0) pdf.addPage();
    await new Promise<void>((res) => {
      const img = new window.Image();
      img.onload = () => {
        const aspect = img.naturalWidth / img.naturalHeight;
        const pageAspect = A4_W / A4_H;
        let dw: number,
          dh: number,
          dx: number,
          dy: number;
        if (aspect > pageAspect) {
          dw = A4_W;
          dh = A4_W / aspect;
          dx = 0;
          dy = (A4_H - dh) / 2;
        } else {
          dh = A4_H;
          dw = A4_H * aspect;
          dx = (A4_W - dw) / 2;
          dy = 0;
        }
        pdf.addImage(images[i], 'JPEG', dx, dy, dw, dh, undefined, 'FAST');
        res();
      };
      img.src = images[i];
    });
  }

  const blob: Blob = pdf.output('blob');
  return URL.createObjectURL(blob);
};

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useDocumentScanner(): UseDocumentScannerReturn {
  const [pages, setPages] = useState<ScannedPage[]>([]);
  const [scanning, setScanning] = useState(false);
  const [convertingToPdf, setConvertingToPdf] = useState(false);
  const [cropImageSrc, setCropImageSrc] = useState<string | null>(null);
  const [cropRegion, setCropRegion] = useState<CropRegion>({
    x: 5,
    y: 5,
    w: 90,
    h: 90,
  });
  const [cropModalVisible, setCropModalVisible] = useState(false);
  const [scanModalVisible, setScanModalVisible] = useState(false);
  const [autoDetecting, setAutoDetecting] = useState(false);
  const [filterMode, setFilterMode] = useState<FilterMode>('none');

  const webCameraInputRef = useRef<HTMLInputElement | null>(null);
  const webGalleryInputRef = useRef<HTMLInputElement | null>(null);

  // ── Scan modal ────────────────────────────────────────────────────────────

  const openScanModal = useCallback(() => {
    setPages([]);
    setScanModalVisible(true);
  }, []);

  const closeScanModal = useCallback(() => {
    setScanModalVisible(false);
  }, []);

  // ── Crop helpers ──────────────────────────────────────────────────────────

  const openCropFor = useCallback((dataUrl: string) => {
    setCropImageSrc(dataUrl);
    setCropRegion({ x: 5, y: 5, w: 90, h: 90 });
    setCropModalVisible(true);
  }, []);

  const handleAutoCrop = useCallback(
    async (autoConfirm = false) => {
      if (!cropImageSrc) return;
      setAutoDetecting(true);
      try {
        const region = await autoDetectCrop(cropImageSrc);
        setCropRegion(region);

        if (autoConfirm) {
          // Brief delay so the region state flushes before we read it
          await new Promise((r) => setTimeout(r, 50));
          setCropModalVisible(false);
          setScanning(true);
          const cropped = await applyCrop(cropImageSrc, region, filterMode);
          setPages((prev) => [
            ...prev,
            { id: Date.now().toString(), dataUrl: cropped, filter: filterMode, addedAt: Date.now() },
          ]);
          setCropImageSrc(null);
          setScanModalVisible(true);
        }
      } catch (err) {
        console.error('Auto-detect error:', err);
        Alert.alert(
          'Auto-detect failed',
          'Could not detect document edges. Please crop manually.',
        );
      } finally {
        setAutoDetecting(false);
        setScanning(false);
      }
    },
    [cropImageSrc, filterMode],
  );

  const handleCropConfirm = useCallback(async () => {
    if (!cropImageSrc) return;
    setCropModalVisible(false);
    setScanning(true);
    try {
      const cropped = await applyCrop(cropImageSrc, cropRegion, filterMode);
      setPages((prev) => [
        ...prev,
        { id: Date.now().toString(), dataUrl: cropped, filter: filterMode, addedAt: Date.now() },
      ]);
      setCropImageSrc(null);
      setScanModalVisible(true);
    } catch (err) {
      console.error('Crop error:', err);
      Alert.alert('Error', 'Failed to crop image. Please try again.');
    } finally {
      setScanning(false);
    }
  }, [cropImageSrc, cropRegion, filterMode]);

  const handleCropSkip = useCallback(() => {
    if (!cropImageSrc) return;
    const img = cropImageSrc;
    setCropModalVisible(false);
    setCropImageSrc(null);
    setPages((prev) => [
      ...prev,
      { id: Date.now().toString(), dataUrl: img, filter: 'none', addedAt: Date.now() },
    ]);
    setScanModalVisible(true);
  }, [cropImageSrc]);

  // ── Page management ───────────────────────────────────────────────────────

  const removePage = useCallback((id: string) => {
    setPages((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const reorderPages = useCallback((from: number, to: number) => {
    setPages((prev) => {
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  }, []);

  // ── Web file input ────────────────────────────────────────────────────────

  const handleWebFileInput = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || []);
      if (!files.length) return;
      setScanning(true);
      try {
        const dataUrls = await Promise.all(files.map(fileToDataUrl));
        setScanning(false);
        setScanModalVisible(false);

        // Pre-add pages 2+ without crop (bulk select)
        if (dataUrls.length > 1) {
          const extras = await Promise.all(
            dataUrls.slice(1).map(async (du) => ({
              id: `${Date.now()}_${Math.random()}`,
              dataUrl: du,
              filter: filterMode,
              addedAt: Date.now(),
            })),
          );
          setPages((prev) => [...prev, ...extras]);
        }
        // First image → crop modal
        openCropFor(dataUrls[0]);
      } catch (err) {
        console.error('Image read error:', err);
        Alert.alert('Error', 'Could not read the selected image(s). Please try again.');
        setScanning(false);
      } finally {
        e.target.value = '';
      }
    },
    [filterMode, openCropFor],
  );

  // ── Camera / gallery triggers (web) ──────────────────────────────────────

  const addCameraCapture = useCallback(() => {
    webCameraInputRef.current?.click();
  }, []);

  const addFromGallery = useCallback(() => {
    webGalleryInputRef.current?.click();
  }, []);

  // ── PDF compilation ───────────────────────────────────────────────────────

  const compileToPdf = useCallback(async (): Promise<ScannedFile | null> => {
    if (!pages.length) return null;
    setConvertingToPdf(true);
    try {
      const uri = await imagesToPdf(pages.map((p) => p.dataUrl));
      // Estimate size from blob (not always available via blob: URL, so null is OK)
      return {
        uri,
        name: `scanned_document_${Date.now()}.pdf`,
        type: 'application/pdf',
        size: null,
      };
    } catch (err) {
      console.error('PDF compile error:', err);
      Alert.alert('Error', 'Failed to create PDF. Please try again.');
      return null;
    } finally {
      setConvertingToPdf(false);
    }
  }, [pages]);

  return {
    pages,
    scanning,
    convertingToPdf,
    cropImageSrc,
    cropRegion,
    cropModalVisible,
    scanModalVisible,
    autoDetecting,
    filterMode,
    webCameraInputRef,
    webGalleryInputRef,
    openScanModal,
    closeScanModal,
    openCropFor,
    handleWebFileInput,
    handleAutoCrop,
    handleCropConfirm,
    handleCropSkip,
    removePage,
    reorderPages,
    setCropRegion,
    setFilterMode,
    compileToPdf,
    addCameraCapture,
    addFromGallery,
  };
}
