/**
 * useDocumentScanner.native.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * NATIVE (iOS/Android) implementation of the document scanner hook. Metro
 * resolves this file for `import { useDocumentScanner } from './useDocumentScanner'`
 * on native builds; useDocumentScanner.web.ts is used on web. Same public
 * shape (UseDocumentScannerReturn), so ScanModal.tsx / CropModal.tsx /
 * CropEditor.tsx don't need to change.
 *
 * v1 scope — deliberately smaller than the web version:
 *   • Capture:   expo-image-picker (camera + gallery, incl. multi-select)
 *   • Crop:      expo-image-manipulator, RECTANGLE ONLY (no perspective warp —
 *                that needs a pixel-level homography pass; web's canvas-based
 *                version can't run on-device, this would need react-native-skia)
 *   • Auto-crop: NOT implemented — no edge-detection library wired up yet.
 *                Falls back to a safe default margin so the button still works.
 *   • Filters:   NOT implemented — grayscale/B&W/document enhancement needs
 *                per-pixel access (Skia or a native module); v1 always saves
 *                pages as originally captured, filter selection is a no-op.
 *   • PDF:       expo-print, images embedded as base64 data URIs.
 *
 * Install: expo-image-picker expo-image-manipulator expo-print expo-file-system
 */

import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import * as Print from 'expo-print';
import { useCallback, useState } from 'react';
import { Alert, Image } from 'react-native';
// NOTE: as of Expo SDK 54, the default `expo-file-system` entrypoint points to
// the new object-oriented File/Directory API, which dropped `EncodingType` and
// `readAsStringAsync`. Import from `/legacy` to keep using the callback-style
// API this file relies on (fixes "Cannot read property 'Base64' of undefined").
import * as FileSystem from 'expo-file-system/legacy';
import type {
  CropRegion,
  FilterMode,
  QuadCorners,
  ScannedFile,
  ScannedPage,
  UseDocumentScannerReturn,
} from './scannerTypes';

export type { CropRegion, FilterMode, QuadCorners, ScannedFile, ScannedPage, UseDocumentScannerReturn };

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Promise wrapper around RN's callback-based Image.getSize */
const getImageSize = (uri: string): Promise<{ width: number; height: number }> =>
  new Promise((resolve, reject) => {
    Image.getSize(
      uri,
      (width, height) => resolve({ width, height }),
      (err) => reject(err),
    );
  });

/** Crop a local image URI to a percentage-based region, returns new local URI */
const cropToRegion = async (uri: string, region: CropRegion): Promise<string> => {
  const { width, height } = await getImageSize(uri);
  const originX = Math.round((region.x / 100) * width);
  const originY = Math.round((region.y / 100) * height);
  const cropW = Math.max(1, Math.round((region.w / 100) * width));
  const cropH = Math.max(1, Math.round((region.h / 100) * height));

  const result = await ImageManipulator.manipulateAsync(
    uri,
    [{ crop: { originX, originY, width: cropW, height: cropH } }],
    { compress: 0.9, format: ImageManipulator.SaveFormat.JPEG },
  );
  return result.uri;
};

/** Read a local file URI as a base64 data: URI, for embedding in the print HTML */
const uriToBase64DataUrl = async (uri: string): Promise<string> => {
  const base64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  return `data:image/jpeg;base64,${base64}`;
};

/** Build a print-ready HTML doc: one full-bleed page per image */
const buildPrintHtml = (dataUrls: string[]): string => `
  <html>
    <head>
      <meta charset="utf-8" />
      <style>
        @page { margin: 0; }
        html, body { margin: 0; padding: 0; }
        .page {
          width: 100vw;
          height: 100vh;
          page-break-after: always;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
        }
        .page:last-child { page-break-after: auto; }
        .page img { width: 100%; height: 100%; object-fit: cover; }
      </style>
    </head>
    <body>
      ${dataUrls.map((src) => `<div class="page"><img src="${src}" /></div>`).join('')}
    </body>
  </html>
`;

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useDocumentScanner(): UseDocumentScannerReturn {
  const [pages, setPages] = useState<ScannedPage[]>([]);
  const [scanning, setScanning] = useState(false);
  const [convertingToPdf, setConvertingToPdf] = useState(false);
  const [cropImageSrc, setCropImageSrc] = useState<string | null>(null);
  const [cropRegion, setCropRegion] = useState<CropRegion>({ x: 5, y: 5, w: 90, h: 90 });
  const [cropCorners, setCropCorners] = useState<QuadCorners>({
    tl: { x: 5, y: 5 },
    tr: { x: 95, y: 5 },
    br: { x: 95, y: 95 },
    bl: { x: 5, y: 95 },
  });
  const [cropModalVisible, setCropModalVisible] = useState(false);
  const [scanModalVisible, setScanModalVisible] = useState(false);
  const [autoDetecting, setAutoDetecting] = useState(false);
  const [filterMode, setFilterMode] = useState<FilterMode>('none');

  // ── Scan modal ────────────────────────────────────────────────────────────

  const openScanModal = useCallback(() => {
    setPages([]);
    setScanModalVisible(true);
  }, []);

  const closeScanModal = useCallback(() => {
    setScanModalVisible(false);
  }, []);

  // ── Crop helpers ──────────────────────────────────────────────────────────

  const openCropFor = useCallback((uri: string) => {
    setCropImageSrc(uri);
    setCropRegion({ x: 5, y: 5, w: 90, h: 90 });
    setCropCorners({
      tl: { x: 5, y: 5 },
      tr: { x: 95, y: 5 },
      br: { x: 95, y: 95 },
      bl: { x: 5, y: 95 },
    });
    setCropModalVisible(true);
  }, []);

  // v1: no on-device edge detection yet. Sets a safe default margin so the
  // "Auto" / "Auto-crop & Add" buttons stay functional instead of doing
  // nothing — swap this out once a real detector (Skia or native module) is wired up.
  const handleAutoCrop = useCallback(
    async (autoConfirm = false) => {
      if (!cropImageSrc) return;
      setAutoDetecting(true);
      try {
        const fallbackRegion: CropRegion = { x: 2, y: 2, w: 96, h: 96 };
        setCropRegion(fallbackRegion);
        setCropCorners({
          tl: { x: fallbackRegion.x, y: fallbackRegion.y },
          tr: { x: fallbackRegion.x + fallbackRegion.w, y: fallbackRegion.y },
          br: { x: fallbackRegion.x + fallbackRegion.w, y: fallbackRegion.y + fallbackRegion.h },
          bl: { x: fallbackRegion.x, y: fallbackRegion.y + fallbackRegion.h },
        });

        if (autoConfirm) {
          setCropModalVisible(false);
          setScanning(true);
          const cropped = await cropToRegion(cropImageSrc, fallbackRegion);
          setPages((prev) => [
            ...prev,
            { id: Date.now().toString(), dataUrl: cropped, filter: filterMode, addedAt: Date.now() },
          ]);
          setCropImageSrc(null);
          setScanModalVisible(true);
        }
      } catch (err) {
        console.error('Auto-crop error:', err);
        Alert.alert('Auto-crop failed', 'Please crop manually.');
      } finally {
        setAutoDetecting(false);
        setScanning(false);
      }
    },
    [cropImageSrc, filterMode],
  );

  const handleCropConfirm = useCallback(async () => {
    const imageSrc = cropImageSrc;
    const region = cropRegion;
    if (!imageSrc) {
      Alert.alert('Error', 'No image selected');
      return;
    }
    if (!region || region.w <= 0 || region.h <= 0) {
      Alert.alert('Error', `Invalid crop region: ${JSON.stringify(region)}`);
      return;
    }

    setCropModalVisible(false);
    setScanning(true);
    try {
      // Perspective correction (cropCorners) is intentionally ignored on native
      // in v1 — only the bounding rectangle is applied.
      if (filterMode !== 'none') {
        console.warn(`Filter "${filterMode}" is not yet supported on native — saving unfiltered.`);
      }
      const cropped = await cropToRegion(imageSrc, region);
      setPages((prev) => [
        ...prev,
        { id: Date.now().toString(), dataUrl: cropped, filter: filterMode, addedAt: Date.now() },
      ]);
      setCropImageSrc(null);
      setScanModalVisible(true);
    } catch (err) {
      console.error('Crop error:', err);
      const message = err instanceof Error ? err.message : String(err);
      Alert.alert('Error', `Failed to crop image: ${message}`);
    } finally {
      setScanning(false);
    }
  }, [cropImageSrc, cropRegion, filterMode]);

  const handleCropSkip = useCallback(() => {
    if (!cropImageSrc) return;
    const uri = cropImageSrc;
    setCropModalVisible(false);
    setCropImageSrc(null);
    setPages((prev) => [
      ...prev,
      { id: Date.now().toString(), dataUrl: uri, filter: 'none', addedAt: Date.now() },
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

  // ── Capture (camera / gallery) ────────────────────────────────────────────

  const addCameraCapture = useCallback(async () => {
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Camera permission needed', 'Enable camera access in Settings to scan documents.');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        quality: 1,
        allowsEditing: false,
        exif: false,
      });
      if (result.canceled || !result.assets?.length) return;
      openCropFor(result.assets[0].uri);
    } catch (err) {
      console.error('Camera capture error:', err);
      Alert.alert('Error', 'Could not open the camera. Please try again.');
    }
  }, [openCropFor]);

  const addFromGallery = useCallback(async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Photo library permission needed', 'Enable photo access in Settings to import scans.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 1,
        allowsMultipleSelection: true,
        exif: false,
      });
      if (result.canceled || !result.assets?.length) return;

      const assets = result.assets;
      // Bulk-select: pre-add pages 2+ uncropped (mirrors the web flow), first goes to crop
      if (assets.length > 1) {
        const extras: ScannedPage[] = assets.slice(1).map((a, i) => ({
          id: `${Date.now()}_${i}`,
          dataUrl: a.uri,
          filter: filterMode,
          addedAt: Date.now(),
        }));
        setPages((prev) => [...prev, ...extras]);
      }
      openCropFor(assets[0].uri);
    } catch (err) {
      console.error('Gallery import error:', err);
      Alert.alert('Error', 'Could not read the selected image(s). Please try again.');
    }
  }, [filterMode, openCropFor]);

  // ── PDF compilation ───────────────────────────────────────────────────────

  const compileToPdf = useCallback(async (): Promise<ScannedFile | null> => {
    if (!pages.length) return null;
    setConvertingToPdf(true);
    try {
      const dataUrls = await Promise.all(pages.map((p) => uriToBase64DataUrl(p.dataUrl)));
      const html = buildPrintHtml(dataUrls);
      const { uri } = await Print.printToFileAsync({ html, base64: false });

      const now = new Date();
      const stamp = now.toISOString().slice(0, 10);
      return {
        uri,
        name: `scanned_document_${stamp}_${now.getTime()}.pdf`,
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
    cropCorners,
    cropModalVisible,
    scanModalVisible,
    autoDetecting,
    filterMode,
    openScanModal,
    closeScanModal,
    openCropFor,
    handleAutoCrop,
    handleCropConfirm,
    handleCropSkip,
    removePage,
    reorderPages,
    setCropRegion,
    setCropCorners,
    setFilterMode,
    compileToPdf,
    addCameraCapture,
    addFromGallery,
  };
}

export default useDocumentScanner;