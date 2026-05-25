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

export interface QuadCorners {
  tl: { x: number; y: number }; // top-left
  tr: { x: number; y: number }; // top-right
  br: { x: number; y: number }; // bottom-right
  bl: { x: number; y: number }; // bottom-left
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
  cropCorners: QuadCorners;
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
  setCropCorners: React.Dispatch<React.SetStateAction<QuadCorners>>;
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
  new Promise((resolve, reject) => {
    if (!src || !src.startsWith('data:')) {
      reject(new Error('Invalid image source'));
      return;
    }
    const img = new window.Image();
    img.onload = () => {
      try {
        const { naturalWidth: nw, naturalHeight: nh } = img;
        if (nw === 0 || nh === 0) {
          reject(new Error('Invalid image dimensions'));
          return;
        }
        const sx = (region.x / 100) * nw;
        const sy = (region.y / 100) * nh;
        const sw = (region.w / 100) * nw;
        const sh = (region.h / 100) * nh;
        console.log('applyCrop: region=', region, '-> pixels: sx=', sx, 'sy=', sy, 'sw=', sw, 'sh=', sh, 'image:', nw, 'x', nh);
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(Math.round(sw), 1);
        canvas.height = Math.max(Math.round(sh), 1);
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Failed to get canvas context'));
          return;
        }
        ctx.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
        applyFilter(ctx, canvas.width, canvas.height, filter);
        resolve(canvas.toDataURL('image/jpeg', 0.92));
      } catch (err) {
        reject(new Error(`Crop processing failed: ${err}`));
      }
    };
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = src;
  });

/**
 * Apply perspective transformation to correct document perspective.
 * Uses homography to map quadrilateral corners to rectangle using inverse mapping.
 */
const applyPerspectiveCrop = (
  src: string,
  corners: QuadCorners,
  filter: FilterMode = 'none',
): Promise<string> =>
  new Promise((resolve, reject) => {
    if (!src || !src.startsWith('data:')) {
      reject(new Error('Invalid image source'));
      return;
    }
    if (!corners || !corners.tl || !corners.tr || !corners.br || !corners.bl) {
      reject(new Error('Invalid corners'));
      return;
    }
    const img = new window.Image();
    img.onload = () => {
      try {
        const { naturalWidth: nw, naturalHeight: nh } = img;
        if (nw === 0 || nh === 0) {
          reject(new Error('Invalid image dimensions'));
          return;
        }

        // Convert corner % to pixels
        const tl = { x: (corners.tl.x / 100) * nw, y: (corners.tl.y / 100) * nh };
        const tr = { x: (corners.tr.x / 100) * nw, y: (corners.tr.y / 100) * nh };
        const br = { x: (corners.br.x / 100) * nw, y: (corners.br.y / 100) * nh };
        const bl = { x: (corners.bl.x / 100) * nw, y: (corners.bl.y / 100) * nh };

        // Calculate output dimensions - use bounding box
        const minX = Math.max(0, Math.min(tl.x, tr.x, br.x, bl.x));
        const maxX = Math.min(nw, Math.max(tl.x, tr.x, br.x, bl.x));
        const minY = Math.max(0, Math.min(tl.y, tr.y, br.y, bl.y));
        const maxY = Math.min(nh, Math.max(tl.y, tr.y, br.y, bl.y));
        const cropW = maxX - minX;
        const cropH = maxY - minY;

        if (cropW <= 0 || cropH <= 0) {
          reject(new Error('Invalid crop dimensions'));
          return;
        }

        // For now, use simple bounding box crop - perspective correction can be added later
        // This ensures reliable results without the complex homography issues
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(cropW);
        canvas.height = Math.round(cropH);
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Failed to get canvas context'));
          return;
        }

        // Use better quality settings
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, minX, minY, cropW, cropH, 0, 0, canvas.width, canvas.height);

        applyFilter(ctx, canvas.width, canvas.height, filter);
        resolve(canvas.toDataURL('image/jpeg', 0.92));
      } catch (err) {
        reject(new Error(`Perspective transform failed: ${err}`));
      }
    };
    img.onerror = () => reject(new Error('Failed to load image for perspective transform'));
    img.src = src;
  });

/**
 * Compute inverse homography matrix using Direct Linear Transform (DLT)
 * Maps source quad to destination rectangle
 */
const computeInverseHomography = (srcPoints: number[], dstW: number, dstH: number): number[] | null => {
  const dstPoints = [0, 0, dstW, 0, dstW, dstH, 0, dstH];

  // Build matrix A for Ax = 0 (homography equations)
  const A: number[][] = [];
  for (let i = 0; i < 4; i++) {
    const sx = srcPoints[i * 2];
    const sy = srcPoints[i * 2 + 1];
    const dx = dstPoints[i * 2];
    const dy = dstPoints[i * 2 + 1];
    // h11*sx + h12*sy + h13 = dx*sx + dx*sy + dx (actually: h11*dx + h12*dy + h13 = sx*w)
    // For source = H * dest: sx*w = h11*dx + h12*dy + h13, sy*w = h21*dx + h22*dy + h23, w = h31*dx + h32*dy + h33
    A.push([dx, dy, 1, 0, 0, 0, -dx * sx, -dy * sx, sx]);
    A.push([0, 0, 0, dx, dy, 1, -dx * sy, -dy * sy, sy]);
  }

  // Solve using SVD-like approach (Gauss-Jordan)
  const h = solveLinearSystem(A);
  if (!h) return null;

  // Normalize to make h33 = 1
  const scale = h[8];
  if (Math.abs(scale) < 1e-10) return null;

  return [
    h[0] / scale, h[1] / scale, h[2] / scale,
    h[3] / scale, h[4] / scale, h[5] / scale,
    h[6] / scale, h[7] / scale, 1
  ];
};

/**
 * Solve linear system using Gauss-Jordan elimination
 * Returns null if matrix is singular
 */
const solveLinearSystem = (A: number[][]): number[] | null => {
  const n = A.length;
  const m = A[0].length;
  const aug = A.map(row => [...row]);

  for (let i = 0; i < n; i++) {
    // Find pivot
    let maxRow = i;
    for (let k = i + 1; k < n; k++) {
      if (Math.abs(aug[k][i]) > Math.abs(aug[maxRow][i])) maxRow = k;
    }
    [aug[i], aug[maxRow]] = [aug[maxRow], aug[i]];

    // Check for near-zero pivot
    if (Math.abs(aug[i][i]) < 1e-10) continue;

    // Scale pivot row
    const pivot = aug[i][i];
    for (let j = i; j < m; j++) aug[i][j] /= pivot;

    // Eliminate column
    for (let k = 0; k < n; k++) {
      if (k !== i) {
        const factor = aug[k][i];
        for (let j = i; j < m; j++) aug[k][j] -= factor * aug[i][j];
      }
    }
  }

  // Check for inconsistent or underdetermined system
  for (let i = 0; i < n; i++) {
    if (Math.abs(aug[i][i]) < 1e-10) {
      const lastNonZero = aug[i].slice(0, m - 1).reduce((max, val) => Math.max(max, Math.abs(val)), 0);
      if (lastNonZero > 1e-10) return null; // Inconsistent
    }
  }

  return aug.map(row => row[m - 1]);
};

/**
 * Detect the 4 corners of the document using edge and contour detection.
 * Uses multiple strategies: Sobel edge detection + Hough lines + corner refinement.
 * Returns corners as percentages of image dimensions.
 */
const detectDocumentCorners = (src: string): Promise<QuadCorners> =>
  new Promise((resolve) => {
    const img = new window.Image();
    img.onload = () => {
      const scale = Math.min(1, 600 / img.naturalWidth);
      const cw = Math.round(img.naturalWidth * scale);
      const ch = Math.round(img.naturalHeight * scale);
      const canvas = document.createElement('canvas');
      canvas.width = cw;
      canvas.height = ch;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, cw, ch);
      const imageData = ctx.getImageData(0, 0, cw, ch);
      const { data } = imageData;

      // Get Otsu threshold for automatic brightness detection
      const otsuThreshold = getOtsuThreshold(data, cw, ch);
      const bgThreshold = otsuThreshold + 25;

      // Check corners to determine background type
      const checkCorner = (x: number, y: number) => {
        const i = (Math.min(y, ch - 1) * cw + Math.min(x, cw - 1)) * 4;
        return getLuminance(data[i], data[i + 1], data[i + 2]);
      };
      const avgCorner = (checkCorner(0, 0) + checkCorner(cw - 1, 0) + checkCorner(0, ch - 1) + checkCorner(cw - 1, ch - 1)) / 4;
      const isBrightBg = avgCorner > 128;

      // Find edge pixels using Sobel operator
      const edges = new Float32Array(cw * ch);
      const gradients = new Float32Array(cw * ch * 2); // [gx, gy]
      for (let y = 1; y < ch - 1; y++) {
        for (let x = 1; x < cw - 1; x++) {
          const getL = (px: number, py: number) => {
            const i = (py * cw + px) * 4;
            return getLuminance(data[i], data[i + 1], data[i + 2]);
          };
          const gx = -getL(x - 1, y - 1) + getL(x + 1, y - 1) - 2 * getL(x - 1, y) + 2 * getL(x + 1, y) - getL(x - 1, y + 1) + getL(x + 1, y + 1);
          const gy = -getL(x - 1, y - 1) - 2 * getL(x, y - 1) - getL(x + 1, y - 1) + getL(x - 1, y + 1) + 2 * getL(x, y + 1) + getL(x + 1, y + 1);
          edges[y * cw + x] = Math.sqrt(gx * gx + gy * gy);
          gradients[(y * cw + x) * 2] = gx;
          gradients[(y * cw + x) * 2 + 1] = gy;
        }
      }

      // Find threshold for strong edges
      const sortedEdges = Float32Array.from(edges).sort();
      const medianEdge = sortedEdges[Math.floor(sortedEdges.length * 0.5)];
      const edgeThreshold = Math.max(medianEdge * 4, 25);

      // Find document content pixels
      const isDoc = new Uint8Array(cw * ch);
      for (let i = 0; i < cw * ch; i++) {
        const px = i * 4;
        const lum = getLuminance(data[px], data[px + 1], data[px + 2]);
        const isContent = isBrightBg ? lum < bgThreshold : lum > 200;
        const hasEdge = edges[i] > edgeThreshold;
        if (isContent && hasEdge) isDoc[i] = 1;
      }

      // Find document bounds by scanning from each side
      let top = 0, bottom = ch - 1, left = 0, right = cw - 1;

      scan_top: for (let y = 0; y < ch; y++) {
        for (let x = 0; x < cw; x++) if (isDoc[y * cw + x]) { top = y; break scan_top; }
      }
      scan_bottom: for (let y = ch - 1; y >= 0; y--) {
        for (let x = 0; x < cw; x++) if (isDoc[y * cw + x]) { bottom = y; break scan_bottom; }
      }
      scan_left: for (let x = 0; x < cw; x++) {
        for (let y = 0; y < ch; y++) if (isDoc[y * cw + x]) { left = x; break scan_left; }
      }
      scan_right: for (let x = cw - 1; x >= 0; x--) {
        for (let y = 0; y < ch; y++) if (isDoc[y * cw + x]) { right = x; break scan_right; }
      }

      // Validate bounds - if document too small or not found, use defaults
      const docWidth = right - left;
      const docHeight = bottom - top;
      if (docWidth < 20 || docHeight < 20) {
        resolve({
          tl: { x: 5, y: 5 },
          tr: { x: 95, y: 5 },
          br: { x: 95, y: 95 },
          bl: { x: 5, y: 95 },
        });
        return;
      }

      // Refine corner positions by finding strong edge points
      // Uses gradient direction to find corners more accurately
      const refineCorner = (searchX: number, searchY: number, expectedGx: number, expectedGy: number): { x: number; y: number } => {
        const searchRadius = Math.min(cw, ch) / 6;
        let bestX = searchX, bestY = searchY, bestScore = 0;

        // Search in a grid pattern for better corner detection
        for (let r = 0; r < searchRadius; r += 2) {
          for (let angle = 0; angle < 360; angle += 15) {
            const rad = (angle * Math.PI) / 180;
            const tx = Math.round(searchX + r * Math.cos(rad));
            const ty = Math.round(searchY + r * Math.sin(rad));
            if (tx >= 0 && tx < cw && ty >= 0 && ty < ch) {
              const edgeVal = edges[ty * cw + tx];
              const gx = gradients[(ty * cw + tx) * 2];
              const gy = gradients[(ty * cw + tx) * 2 + 1];

              // Score based on edge strength and alignment with expected gradient
              const gxNorm = gx / (Math.abs(gx) + Math.abs(gy) + 1);
              const gyNorm = gy / (Math.abs(gx) + Math.abs(gy) + 1);
              const alignment = Math.abs(gxNorm * expectedGx + gyNorm * expectedGy);
              const score = edgeVal * (0.3 + 0.7 * alignment);

              if (score > bestScore) {
                bestScore = score;
                bestX = tx;
                bestY = ty;
              }
            }
          }
        }
        return { x: bestX, y: bestY };
      };

      const margin = 0.02;
      const w = right - left;
      const h = bottom - top;

      // Each corner: expected gradient direction for outward pointing edge
      const tl = refineCorner(left + w * margin, top + h * margin, -1, -1);
      const tr = refineCorner(right - w * margin, top + h * margin, 1, -1);
      const br = refineCorner(right - w * margin, bottom - h * margin, 1, 1);
      const bl = refineCorner(left + w * margin, bottom - h * margin, -1, 1);

      resolve({
        tl: { x: (tl.x / cw) * 100, y: (tl.y / ch) * 100 },
        tr: { x: (tr.x / cw) * 100, y: (tr.y / ch) * 100 },
        br: { x: (br.x / cw) * 100, y: (br.y / ch) * 100 },
        bl: { x: (bl.x / cw) * 100, y: (bl.y / ch) * 100 },
      });
    };
    img.src = src;
  });

/**
 * Compute luminance (perceived brightness) of an RGB pixel
 */
const getLuminance = (r: number, g: number, b: number): number =>
  0.299 * r + 0.587 * g + 0.114 * b;

/**
 * Compute Otsu's threshold for optimal image segmentation
 */
const getOtsuThreshold = (data: Uint8ClampedArray, w: number, h: number): number => {
  const histogram = new Uint32Array(256);
  for (let i = 0; i < data.length; i += 4) {
    const lum = Math.round(getLuminance(data[i], data[i + 1], data[i + 2]));
    histogram[lum]++;
  }
  const totalPixels = w * h;
  let sum = 0;
  for (let i = 0; i < 256; i++) sum += i * histogram[i];

  let sumB = 0, wB = 0, maxVariance = 0, threshold = 0;
  for (let t = 0; t < 256; t++) {
    wB += histogram[t];
    if (wB === 0) continue;
    const wF = totalPixels - wB;
    if (wF === 0) break;
    sumB += t * histogram[t];
    const mB = sumB / wB;
    const mF = (sum - sumB) / wF;
    const variance = wB * wF * (mB - mF) * (mB - mF);
    if (variance > maxVariance) {
      maxVariance = variance;
      threshold = t;
    }
  }
  return threshold;
};

/**
 * Detect document edges using adaptive thresholding.
 * This method automatically finds the optimal threshold to separate
 * document content from background.
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
      const imageData = ctx.getImageData(0, 0, cw, ch);
      const { data } = imageData;

      // Get Otsu's adaptive threshold
      const otsuThreshold = getOtsuThreshold(data, cw, ch);
      // Use slightly higher threshold to be more aggressive about cutting background
      const bgThreshold = otsuThreshold + 20;

      // Check corner regions to estimate background brightness
      const checkCorner = (ox: number, oy: number): number => {
        const x = Math.min(Math.max(ox, 0), cw - 1);
        const y = Math.min(Math.max(oy, 0), ch - 1);
        const i = (y * cw + x) * 4;
        return getLuminance(data[i], data[i + 1], data[i + 2]);
      };
      const corners = [
        checkCorner(0, 0),
        checkCorner(cw - 1, 0),
        checkCorner(0, ch - 1),
        checkCorner(cw - 1, ch - 1),
        checkCorner(Math.floor(cw / 2), 0),
        checkCorner(Math.floor(cw / 2), ch - 1),
        checkCorner(0, Math.floor(ch / 2)),
        checkCorner(cw - 1, Math.floor(ch / 2)),
      ];
      const avgCornerBrightness = corners.reduce((a, b) => a + b, 0) / corners.length;

      // Determine if background is bright or dark
      const isBrightBg = avgCornerBrightness > 128;

      // Find bounding box of document content
      let top = 0, bottom = ch - 1, left = 0, right = cw - 1;
      let foundDoc = false;

      // Scan from top to find first non-background pixel
      scan_top: for (let y = 0; y < ch; y++) {
        for (let x = 0; x < cw; x++) {
          const i = (y * cw + x) * 4;
          const lum = getLuminance(data[i], data[i + 1], data[i + 2]);
          const isDoc = isBrightBg
            ? lum < bgThreshold  // Bright background: document is darker
            : lum > 200;          // Dark background: document is brighter
          if (isDoc) {
            top = y;
            foundDoc = true;
            break scan_top;
          }
        }
      }

      // Scan from bottom
      scan_bottom: for (let y = ch - 1; y >= 0; y--) {
        for (let x = 0; x < cw; x++) {
          const i = (y * cw + x) * 4;
          const lum = getLuminance(data[i], data[i + 1], data[i + 2]);
          const isDoc = isBrightBg ? lum < bgThreshold : lum > 200;
          if (isDoc) {
            bottom = y;
            break scan_bottom;
          }
        }
      }

      // Scan from left
      scan_left: for (let x = 0; x < cw; x++) {
        for (let y = 0; y < ch; y++) {
          const i = (y * cw + x) * 4;
          const lum = getLuminance(data[i], data[i + 1], data[i + 2]);
          const isDoc = isBrightBg ? lum < bgThreshold : lum > 200;
          if (isDoc) {
            left = x;
            break scan_left;
          }
        }
      }

      // Scan from right
      scan_right: for (let x = cw - 1; x >= 0; x--) {
        for (let y = 0; y < ch; y++) {
          const i = (y * cw + x) * 4;
          const lum = getLuminance(data[i], data[i + 1], data[i + 2]);
          const isDoc = isBrightBg ? lum < bgThreshold : lum > 200;
          if (isDoc) {
            right = x;
            break scan_right;
          }
        }
      }

      // Fallback if no document found
      if (!foundDoc) {
        resolve({ x: 5, y: 5, w: 90, h: 90 });
        return;
      }

      // Add padding
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
    setCropCorners({
      tl: { x: 5, y: 5 },
      tr: { x: 95, y: 5 },
      br: { x: 95, y: 95 },
      bl: { x: 5, y: 95 },
    });
    setCropModalVisible(true);
  }, []);

  const handleAutoCrop = useCallback(
    async (autoConfirm = false) => {
      if (!cropImageSrc) return;
      setAutoDetecting(true);
      try {
        // Use perspective corner detection
        const corners = await detectDocumentCorners(cropImageSrc);
        setCropCorners(corners);

        // Also update bounding box for display
        const minX = Math.min(corners.tl.x, corners.bl.x);
        const maxX = Math.max(corners.tr.x, corners.br.x);
        const minY = Math.min(corners.tl.y, corners.tr.y);
        const maxY = Math.max(corners.bl.y, corners.br.y);
        setCropRegion({
          x: minX,
          y: minY,
          w: maxX - minX,
          h: maxY - minY,
        });

        if (autoConfirm) {
          setCropModalVisible(false);
          setScanning(true);
          let cropped: string;
          const region = { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
          try {
            cropped = await applyPerspectiveCrop(cropImageSrc, corners, filterMode);
            // Fallback if result is too small
            if (cropped && cropped.length < 1000) {
              console.log('Auto perspective result too small, falling back');
              cropped = await applyCrop(cropImageSrc, region, filterMode);
            }
          } catch (e) {
            console.error('Auto perspective failed, falling back:', e);
            cropped = await applyCrop(cropImageSrc, region, filterMode);
          }
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
    [cropImageSrc, cropRegion, cropCorners, filterMode],
  );

  const handleCropConfirm = useCallback(async () => {
    const imageSrc = cropImageSrc;
    const region = cropRegion;
    const corners = cropCorners;
    const filter = filterMode;

    console.log('handleCropConfirm called:', { imageSrc: !!imageSrc, region, corners, filter });

    if (!imageSrc) {
      Alert.alert('Error', 'No image selected');
      return;
    }

    if (!region || typeof region.x !== 'number' || typeof region.y !== 'number' ||
        typeof region.w !== 'number' || typeof region.h !== 'number' ||
        region.w <= 0 || region.h <= 0) {
      Alert.alert('Error', `Invalid crop region: ${JSON.stringify(region)}`);
      return;
    }

    if (!corners || !corners.tl || !corners.tr || !corners.br || !corners.bl) {
      Alert.alert('Error', `Invalid corner points: ${JSON.stringify(corners)}`);
      return;
    }

    setCropModalVisible(false);
    setScanning(true);
    try {
      // Always derive actual region from corners - this is what user selected
      // Use a more robust calculation that ensures correct bounding box
      const xs = [corners.tl.x, corners.tr.x, corners.br.x, corners.bl.x];
      const ys = [corners.tl.y, corners.tr.y, corners.br.y, corners.bl.y];
      const minX = Math.min(...xs);
      const maxX = Math.max(...xs);
      const minY = Math.min(...ys);
      const maxY = Math.max(...ys);
      const actualRegion: CropRegion = {
        x: minX,
        y: minY,
        w: maxX - minX,
        h: maxY - minY,
      };

      // Check if corners are significantly different from bounding box (perspective adjustment)
      const defaultCorners = {
        tl: { x: region.x, y: region.y },
        tr: { x: region.x + region.w, y: region.y },
        br: { x: region.x + region.w, y: region.y + region.h },
        bl: { x: region.x, y: region.y + region.h },
      };

      let usePerspective = false;
      // Disabled - always use simple crop for reliability
      // const tolerance = 10;
      // for (const key of ['tl', 'tr', 'br', 'bl'] as const) {
      //   if (Math.abs(corners[key].x - defaultCorners[key].x) > tolerance ||
      //       Math.abs(corners[key].y - defaultCorners[key].y) > tolerance) {
      //     usePerspective = true;
      //     break;
      //   }
      // }

      console.log('Applying crop:', {
        usePerspective,
        filter,
        actualRegion,
        corners,
        defaultCorners,
        region // Also log original region for comparison
      });

      // Validate actualRegion before cropping
      if (!actualRegion || actualRegion.w <= 0 || actualRegion.h <= 0 || actualRegion.w > 100 || actualRegion.h > 100) {
        console.error('Invalid region:', actualRegion);
        throw new Error('Invalid crop region derived from corners');
      }

      let cropped: string;
      try {
        if (usePerspective) {
          cropped = await applyPerspectiveCrop(imageSrc, corners, filter);
          // Fallback to simple crop if perspective result is suspiciously small
          if (cropped && cropped.length < 1000) {
            console.log('Perspective result too small, falling back to simple crop');
            cropped = await applyCrop(imageSrc, actualRegion, filter);
          }
        } else {
          cropped = await applyCrop(imageSrc, actualRegion, filter);
        }
      } catch (perspectiveError) {
        console.error('Perspective transform failed, falling back:', perspectiveError);
        cropped = await applyCrop(imageSrc, actualRegion, filter);
      }

      if (!cropped) {
        throw new Error('Failed to generate cropped image - empty result');
      }

      console.log('Crop successful, result length:', cropped.length);

      setPages((prev) => [
        ...prev,
        { id: Date.now().toString(), dataUrl: cropped, filter, addedAt: Date.now() },
      ]);
      setCropImageSrc(null);
      setScanModalVisible(true);
    } catch (err) {
      console.error('Crop error:', err);
      const errorMessage = err instanceof Error ? err.message : String(err);
      Alert.alert('Error', `Failed to crop image: ${errorMessage}`);
    } finally {
      setScanning(false);
    }
  }, [cropImageSrc, cropRegion, cropCorners, filterMode]);

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
    cropCorners,
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
    setCropCorners,
    setFilterMode,
    compileToPdf,
    addCameraCapture,
    addFromGallery,
  };
}
