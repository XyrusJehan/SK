/**
 * useDocumentScanner.web.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * WEB implementation of the document scanner hook. Metro resolves this file
 * for `import { useDocumentScanner } from './useDocumentScanner'` when
 * Platform.OS === 'web'. The native build resolves useDocumentScanner.native.ts
 * instead — see that file for the iOS/Android implementation.
 *
 * Everything here is intentionally DOM-dependent (HTML5 Canvas, <input type="file">,
 * window.Image, jsPDF via CDN script tag) — none of it runs on native, which is
 * exactly why it now lives in a .web.ts file instead of a Platform.OS branch.
 *
 * Features:
 *   • Auto edge-detection via pixel-brightness scan
 *   • Interactive crop (percentage-based region)
 *   • Perspective-correct flat-document extraction
 *   • Optional grayscale / B&W enhancement
 *   • jsPDF-based multi-page PDF generation
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { Platform, Alert } from 'react-native';
import type {
  CropRegion,
  QuadCorners,
  FilterMode,
  ScannedPage,
  ScannedFile,
  UseDocumentScannerReturn,
} from './scannerTypes';

// Re-export so existing `import type { CropRegion } from './useDocumentScanner'`
// style imports in CropEditor.tsx / CropModal.tsx / ScanModal.tsx keep working
// unchanged — Metro resolves those to this file on web, useDocumentScanner.native.ts
// on native, and both re-export the same names from scannerTypes.ts.
export type { CropRegion, QuadCorners, FilterMode, ScannedPage, ScannedFile, UseDocumentScannerReturn };

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
 * Apply grayscale, B&W, or document-optimised enhancement to a canvas context.
 * - 'grayscale': standard luma conversion
 * - 'bw': adaptive Otsu threshold for clean black/white scans
 * - 'document': grayscale + contrast stretch + mild unsharp mask
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
  const n = d.length;

  if (filter === 'grayscale') {
    for (let i = 0; i < n; i += 4) {
      const luma = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
      d[i] = d[i + 1] = d[i + 2] = luma;
    }
    ctx.putImageData(imgData, 0, 0);
    return;
  }

  if (filter === 'bw') {
    // First pass: convert to luma
    const lumas = new Float32Array(w * h);
    for (let i = 0; i < n; i += 4) {
      lumas[i >> 2] = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    }
    // Compute Otsu threshold from luma histogram
    const hist = new Uint32Array(256);
    for (let i = 0; i < lumas.length; i++) hist[Math.round(lumas[i])]++;
    const total = w * h;
    let sum = 0;
    for (let i = 0; i < 256; i++) sum += i * hist[i];
    let sumB = 0, wB = 0, maxVar = 0, threshold = 128;
    for (let t = 0; t < 256; t++) {
      wB += hist[t];
      if (!wB) continue;
      const wF = total - wB;
      if (!wF) break;
      sumB += t * hist[t];
      const mB = sumB / wB, mF = (sum - sumB) / wF;
      const v = wB * wF * (mB - mF) * (mB - mF);
      if (v > maxVar) { maxVar = v; threshold = t; }
    }
    // Second pass: threshold
    for (let i = 0; i < n; i += 4) {
      const v = lumas[i >> 2] > threshold ? 255 : 0;
      d[i] = d[i + 1] = d[i + 2] = v;
    }
    ctx.putImageData(imgData, 0, 0);
    return;
  }

  if (filter === 'document') {
    // Grayscale + conservative shadow-lift (only darkens midtones, never clips highlights)
    // Uses a mild gamma < 1 to lift shadows without touching near-white paper.
    // Auto-levels is intentionally avoided: it blows out light documents.
    const GAMMA = 0.82; // < 1 lifts shadows; adjust higher (0.9) for darker originals
    const lut = new Uint8ClampedArray(256);
    for (let i = 0; i < 256; i++) {
      lut[i] = Math.round(Math.pow(i / 255, GAMMA) * 255);
    }
    for (let i = 0; i < n; i += 4) {
      const luma = Math.round(0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]);
      // Apply LUT — highlights (near 255) barely change; shadows are gently lifted
      const v = lut[luma];
      d[i] = d[i + 1] = d[i + 2] = v;
    }
    ctx.putImageData(imgData, 0, 0);
    applySharpen(ctx, w, h);
  }
};

/**
 * Lightweight unsharp mask using a 3×3 Laplacian blend.
 * Sharpens text edges without introducing colour fringing.
 * Amount 0.45 is conservative — good for document text, safe on photos.
 */
const applySharpen = (
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  amount = 0.45,
): void => {
  const src = ctx.getImageData(0, 0, w, h);
  const dst = ctx.createImageData(w, h);
  const s = src.data, o = dst.data;
  // Kernel: centre +1, 4-connected neighbours −amount/4 each, normalised
  const k = amount;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = (y * w + x) * 4;
      for (let c = 0; c < 3; c++) {
        const lap =
          5 * s[i + c] -
          s[((y - 1) * w + x) * 4 + c] -
          s[((y + 1) * w + x) * 4 + c] -
          s[(y * w + x - 1) * 4 + c] -
          s[(y * w + x + 1) * 4 + c];
        o[i + c] = Math.max(0, Math.min(255, Math.round(s[i + c] + k * lap)));
      }
      o[i + 3] = 255;
    }
  }
  // Copy border rows/cols unchanged
  for (let x = 0; x < w; x++) {
    const t = x * 4, b = ((h - 1) * w + x) * 4;
    o[t] = s[t]; o[t+1] = s[t+1]; o[t+2] = s[t+2]; o[t+3] = 255;
    o[b] = s[b]; o[b+1] = s[b+1]; o[b+2] = s[b+2]; o[b+3] = 255;
  }
  for (let y = 0; y < h; y++) {
    const l = (y * w) * 4, r = (y * w + w - 1) * 4;
    o[l] = s[l]; o[l+1] = s[l+1]; o[l+2] = s[l+2]; o[l+3] = 255;
    o[r] = s[r]; o[r+1] = s[r+1]; o[r+2] = s[r+2]; o[r+3] = 255;
  }
  ctx.putImageData(dst, 0, 0);
};


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
        // Sharpening is applied only for non-none filters (perspective path handles its own)
        resolve(canvas.toDataURL('image/jpeg', 0.95));
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
    if (!src || !src.startsWith('data:')) { reject(new Error('Invalid image source')); return; }
    if (!corners?.tl || !corners?.tr || !corners?.br || !corners?.bl) { reject(new Error('Invalid corners')); return; }

    const img = new window.Image();
    img.onload = () => {
      try {
        const { naturalWidth: nw, naturalHeight: nh } = img;
        if (!nw || !nh) { reject(new Error('Invalid image dimensions')); return; }

        // Scale down source if too large — keeps pixel loop fast on phone photos
        const MAX_SRC = 2400;
        const scale = Math.min(1, MAX_SRC / Math.max(nw, nh));
        const snw = Math.round(nw * scale), snh = Math.round(nh * scale);

        const scaledCanvas = document.createElement('canvas');
        scaledCanvas.width = snw; scaledCanvas.height = snh;
        scaledCanvas.getContext('2d')!.drawImage(img, 0, 0, snw, snh);

        // Source quad corners in scaled pixels
        const src_pts = [
          (corners.tl.x/100)*snw, (corners.tl.y/100)*snh,
          (corners.tr.x/100)*snw, (corners.tr.y/100)*snh,
          (corners.br.x/100)*snw, (corners.br.y/100)*snh,
          (corners.bl.x/100)*snw, (corners.bl.y/100)*snh,
        ];

        // Output size based on actual edge lengths
        const topW  = Math.hypot(src_pts[2]-src_pts[0], src_pts[3]-src_pts[1]);
        const botW  = Math.hypot(src_pts[4]-src_pts[6], src_pts[5]-src_pts[7]);
        const leftH = Math.hypot(src_pts[6]-src_pts[0], src_pts[7]-src_pts[1]);
        const rightH= Math.hypot(src_pts[4]-src_pts[2], src_pts[5]-src_pts[3]);
        const outW  = Math.max(1, Math.round(Math.max(topW, botW)));
        const outH  = Math.max(1, Math.round(Math.max(leftH, rightH)));

        // Destination quad = perfect rectangle [0,0,outW,outH]
        const dst_pts = [0, 0, outW, 0, outW, outH, 0, outH];

        // ── Compute inverse homography H: dst_pixel → src_pixel ──────────────
        // H maps (xd,yd) → (xs,ys) via: xs = (h0*xd+h1*yd+h2)/(h6*xd+h7*yd+1)
        //                                ys = (h3*xd+h4*yd+h5)/(h6*xd+h7*yd+1)
        // We solve the 8×8 linear system using Gaussian elimination.
        const buildSystem = (sp: number[], dp: number[]) => {
          const A: number[][] = [];
          const b: number[] = [];
          for (let i = 0; i < 4; i++) {
            const xs = sp[i*2], ys = sp[i*2+1];
            const xd = dp[i*2], yd = dp[i*2+1];
            A.push([xd, yd, 1, 0,  0,  0, -xs*xd, -xs*yd]);  b.push(xs);
            A.push([0,  0,  0, xd, yd, 1, -ys*xd, -ys*yd]);  b.push(ys);
          }
          return { A, b };
        };

        const gaussSolve = (A: number[][], b: number[]): number[] | null => {
          const n = A.length;
          const M = A.map((row, i) => [...row, b[i]]);
          for (let col = 0; col < n; col++) {
            let maxRow = col;
            for (let row = col+1; row < n; row++)
              if (Math.abs(M[row][col]) > Math.abs(M[maxRow][col])) maxRow = row;
            [M[col], M[maxRow]] = [M[maxRow], M[col]];
            if (Math.abs(M[col][col]) < 1e-10) return null;
            for (let row = 0; row < n; row++) {
              if (row === col) continue;
              const f = M[row][col] / M[col][col];
              for (let k = col; k <= n; k++) M[row][k] -= f * M[col][k];
            }
          }
          return M.map((row, i) => row[n] / row[i]);
        };

        const { A, b: rhs } = buildSystem(src_pts, dst_pts);
        const h = gaussSolve(A, rhs);
        if (!h) { reject(new Error('Homography solve failed')); return; }
        // h = [h0..h7], h8=1

        // ── Read source pixels ────────────────────────────────────────────────
        const srcCtx = scaledCanvas.getContext('2d')!;
        const srcPx = srcCtx.getImageData(0, 0, snw, snh).data;

        // ── Write destination pixels ──────────────────────────────────────────
        const outCanvas = document.createElement('canvas');
        outCanvas.width = outW; outCanvas.height = outH;
        const outCtx = outCanvas.getContext('2d')!;
        const outImg = outCtx.createImageData(outW, outH);
        const dst = outImg.data;

        // Fill white
        for (let i = 0; i < dst.length; i += 4) { dst[i]=255; dst[i+1]=255; dst[i+2]=255; dst[i+3]=255; }

        for (let yd = 0; yd < outH; yd++) {
          for (let xd = 0; xd < outW; xd++) {
            const w  = h[6]*xd + h[7]*yd + 1;
            const xs = (h[0]*xd + h[1]*yd + h[2]) / w;
            const ys = (h[3]*xd + h[4]*yd + h[5]) / w;

            if (xs < 0 || xs >= snw-1 || ys < 0 || ys >= snh-1) continue;

            // Bilinear sample
            const x0 = xs|0, y0 = ys|0;
            const x1 = x0+1, y1 = y0+1;
            const fx = xs-x0, fy = ys-y0;
            const w00=(1-fx)*(1-fy), w10=fx*(1-fy), w01=(1-fx)*fy, w11=fx*fy;

            const i00=(y0*snw+x0)*4, i10=(y0*snw+x1)*4;
            const i01=(y1*snw+x0)*4, i11=(y1*snw+x1)*4;
            const di=(yd*outW+xd)*4;

            dst[di  ] = w00*srcPx[i00  ]+w10*srcPx[i10  ]+w01*srcPx[i01  ]+w11*srcPx[i11  ];
            dst[di+1] = w00*srcPx[i00+1]+w10*srcPx[i10+1]+w01*srcPx[i01+1]+w11*srcPx[i11+1];
            dst[di+2] = w00*srcPx[i00+2]+w10*srcPx[i10+2]+w01*srcPx[i01+2]+w11*srcPx[i11+2];
            dst[di+3] = 255;
          }
        }

        outCtx.putImageData(outImg, 0, 0);
        // Apply filter first; sharpen only when a filter is active (filter=none = preserve original colors exactly)
        applyFilter(outCtx, outW, outH, filter);
        if (filter !== 'none') applySharpen(outCtx, outW, outH);
        resolve(outCanvas.toDataURL('image/jpeg', 0.95));
      } catch (err) {
        reject(new Error(`Perspective transform failed: ${err}`));
      }
    };
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = src;
  });

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
 * Each image fills the page edge-to-edge (portrait or landscape as needed).
 * Returns a blob: URL.
 */
const imagesToPdf = async (images: string[], title = 'Scanned Document'): Promise<string> => {
  const JsPDF = await loadJsPDF();
  const A4_W = 210, A4_H = 297; // mm

  // Resolve image dimensions before creating PDF so we can set correct page orientation
  const dims = await Promise.all(
    images.map(
      (src) =>
        new Promise<{ w: number; h: number }>((res) => {
          const img = new window.Image();
          img.onload = () => res({ w: img.naturalWidth, h: img.naturalHeight });
          img.onerror = () => res({ w: 1, h: 1 });
          img.src = src;
        }),
    ),
  );

  const firstLandscape = dims[0] ? dims[0].w > dims[0].h : false;
  const pdf = new JsPDF({
    orientation: firstLandscape ? 'landscape' : 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  // Embed metadata
  pdf.setProperties({
    title,
    creator: 'SK Document Scanner',
    creationDate: new Date(),
  });

  for (let i = 0; i < images.length; i++) {
    const { w, h } = dims[i];
    const landscape = w > h;
    const pageW = landscape ? A4_H : A4_W;
    const pageH = landscape ? A4_W : A4_H;

    if (i > 0) pdf.addPage('a4', landscape ? 'landscape' : 'portrait');

    // Fill the page completely — scale to cover, no borders
    const imgAspect = w / h;
    const pageAspect = pageW / pageH;
    let dw: number, dh: number, dx: number, dy: number;
    if (imgAspect > pageAspect) {
      // Image wider than page → fit to height, clip sides
      dh = pageH;
      dw = pageH * imgAspect;
      dx = (pageW - dw) / 2;
      dy = 0;
    } else {
      // Image taller than page → fit to width, clip top/bottom
      dw = pageW;
      dh = pageW / imgAspect;
      dx = 0;
      dy = (pageH - dh) / 2;
    }

    pdf.addImage(images[i], 'JPEG', dx, dy, dw, dh, undefined, 'NONE');
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
            // Fallback if result is suspiciously tiny
            const MIN_BYTES = 5000;
            if (!cropped || cropped.length < MIN_BYTES) {
              console.warn('Auto perspective result suspiciously small, falling back');
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
      // Check if the quad is non-rectangular by testing if corners form a parallelogram
      // Compare opposite side slopes — a rectangle has equal slopes; a trapezoid does not
      const isNonRectangular = () => {
        const { tl, tr, br, bl } = corners;
        // Top edge slope vs bottom edge slope
        const topSlope = (tr.y - tl.y) / (tr.x - tl.x + 0.001);
        const botSlope = (br.y - bl.y) / (br.x - bl.x + 0.001);
        // Left edge slope vs right edge slope
        const leftSlope  = (bl.y - tl.y) / (bl.x - tl.x + 0.001);
        const rightSlope = (br.y - tr.y) / (br.x - tr.x + 0.001);
        return Math.abs(topSlope - botSlope) > 0.03 || Math.abs(leftSlope - rightSlope) > 0.03;
      };
      const usePerspective = isNonRectangular();

      console.log('Applying crop:', {
        usePerspective,
        filter,
        actualRegion,
        corners,
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
          // Fallback: if the result is suspiciously tiny (corrupt warp), use simple crop
          const MIN_BYTES = 5000;
          if (!cropped || cropped.length < MIN_BYTES) {
            console.warn('Perspective result suspiciously small, falling back to simple crop');
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
      const now = new Date();
      const stamp = now.toISOString().slice(0, 10); // YYYY-MM-DD
      const title = `Scanned Document ${stamp}`;
      const uri = await imagesToPdf(pages.map((p) => p.dataUrl), title);
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