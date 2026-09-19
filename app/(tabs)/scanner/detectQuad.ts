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

/** 0 (fully neutral: black/white/gray) .. 255 (fully saturated colour). */
const getSaturation = (r: number, g: number, b: number): number =>
  Math.max(r, g, b) - Math.min(r, g, b);

// A busy/patterned background (branded packaging, printed fabric, a kid's
// backpack, etc.) produces just as much raw Sobel edge magnitude as the real
// page border, so a hard edge threshold can't tell them apart on its own.
// Colour usually can: a printed page is close to neutral (white/gray paper,
// black text), a busy background is usually saturated. But the single
// strongest edge pixel at any transition — including the true page border —
// is exactly where the two colours BLEND, so it's often not very neutral
// itself; requiring each edge pixel to individually pass a strict neutrality
// test (an earlier version of this file did that) ends up discarding the
// real border along with the noise. Using saturation as a soft WEIGHT on the
// edge-energy sums below, instead of a hard per-pixel pass/fail, avoids that:
// a busy background's edges get scaled down (spread across many pixels, so
// the effect compounds), while the true border keeps most of its strength
// even where individual pixels are only moderately neutral.
const SAT_FLOOR = 30;  // at/below this saturation, edge keeps full weight
const SAT_CEIL = 140;  // at/above this saturation, edge is fully discounted
const neutralWeight = (sat: number): number => {
  if (sat <= SAT_FLOOR) return 1;
  if (sat >= SAT_CEIL) return 0;
  return 1 - (sat - SAT_FLOOR) / (SAT_CEIL - SAT_FLOOR);
};

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

  // Weight each pixel's edge magnitude by how neutral its colour is (see
  // neutralWeight above), and fold in the brightness/content test too — as a
  // soft multiplier rather than a hard AND, so a transition pixel that's only
  // partly consistent still contributes instead of being zeroed outright.
  const weightedEdge = new Float32Array(cw * ch);
  for (let i = 0; i < cw * ch; i++) {
    const px = i * 4;
    const r = data[px], g = data[px + 1], b = data[px + 2];
    const lum = getLuminance(r, g, b);
    const isContent = isBrightBg ? lum < bgThreshold : lum > 200;
    const sat = getSaturation(r, g, b);
    weightedEdge[i] = edges[i] * neutralWeight(sat) * (isContent ? 1 : 0.35);
  }

  // Collapse into row/column energy profiles. A busy background smears its
  // (down-weighted) edge noise fairly evenly across every row and column; the
  // real page border concentrates energy at ONE row/column, so it still wins
  // the argmax even though no single pixel on it may stand out on its own.
  const rowEnergy = new Float32Array(ch);
  const colEnergy = new Float32Array(cw);
  for (let y = 0; y < ch; y++) {
    let sum = 0;
    for (let x = 0; x < cw; x++) sum += weightedEdge[y * cw + x];
    rowEnergy[y] = sum;
  }
  for (let x = 0; x < cw; x++) {
    let sum = 0;
    for (let y = 0; y < ch; y++) sum += weightedEdge[y * cw + x];
    colEnergy[x] = sum;
  }

  const argmaxIn = (arr: Float32Array, from: number, to: number): number => {
    let best = from, bestVal = -Infinity;
    for (let i = from; i < to; i++) {
      if (arr[i] > bestVal) { bestVal = arr[i]; best = i; }
    }
    return best;
  };

  // The page is assumed to leave some margin on every side — true of a
  // normal scan photo — so each border is the strongest energy peak within
  // the outer third of its dimension (same assumption the native build's
  // axis-aligned fallback already makes).
  let top = argmaxIn(rowEnergy, 0, Math.floor(ch / 3));
  let bottom = argmaxIn(rowEnergy, Math.floor((2 * ch) / 3), ch);
  let left = argmaxIn(colEnergy, 0, Math.floor(cw / 3));
  let right = argmaxIn(colEnergy, Math.floor((2 * cw) / 3), cw);

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
          const edgeVal = weightedEdge[ty * cw + tx];
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