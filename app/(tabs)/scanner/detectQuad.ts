/**
 * detectQuad.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Pure, platform-independent document-corner detection. This is the SAME
 * algorithm the web build runs (Otsu threshold + Sobel edges + gradient-aware
 * corner refinement), lifted out of useDocumentScanner.web.ts so the native
 * build can feed it pixels read back from Skia instead of a <canvas>.
 *
 * Input : an RGBA byte buffer (w * h * 4) of a DOWNSCALED photo (~600px wide).
 * Output: the four document corners as % of the image (0-100), same contract
 *         as QuadCorners everywhere else.
 */

import type { QuadCorners } from './scannerTypes';

export const DEFAULT_QUAD: QuadCorners = {
  tl: { x: 5, y: 5 },
  tr: { x: 95, y: 5 },
  br: { x: 95, y: 95 },
  bl: { x: 5, y: 95 },
};

const getLuminance = (r: number, g: number, b: number): number =>
  0.299 * r + 0.587 * g + 0.114 * b;

const getOtsuThreshold = (data: ArrayLike<number>, w: number, h: number): number => {
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

export const detectQuadFromRGBA = (data: ArrayLike<number>, cw: number, ch: number): QuadCorners => {
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
    return DEFAULT_QUAD;
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

  return {
    tl: { x: (tl.x / cw) * 100, y: (tl.y / ch) * 100 },
    tr: { x: (tr.x / cw) * 100, y: (tr.y / ch) * 100 },
    br: { x: (br.x / cw) * 100, y: (br.y / ch) * 100 },
    bl: { x: (bl.x / cw) * 100, y: (bl.y / ch) * 100 },
  };
};
