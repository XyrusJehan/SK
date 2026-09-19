/**
 * useDocumentScanner.native.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * NATIVE (iOS/Android) implementation of the document scanner hook. Metro
 * resolves this file for `import { useDocumentScanner } from './useDocumentScanner'`
 * on native builds; useDocumentScanner.web.ts is used on web. Same public
 * shape (UseDocumentScannerReturn), so ScanModal.tsx / CropModal.tsx /
 * CropEditor.tsx don't need to change.
 *
 * v2 scope — now backed by react-native-skia:
 *   • Capture:   expo-image-picker (camera + gallery, incl. multi-select)
 *   • Crop:      expo-image-manipulator for upright rectangular crops; a
 *                true homography (same solver as web) evaluated on a fine
 *                Skia mesh for perspective (skewed-quad) crops — see
 *                cropToPerspectiveSkia. Everything is derived from the four
 *                corners, exactly like the web build.
 *   • Auto-crop: the web build's corner detector (detectQuad.ts) fed with
 *                pixels read back via Skia — see autoDetectQuadNative.
 *   • Filters:   still NOT implemented — grayscale/B&W/document enhancement
 *                would be a per-pixel color-matrix pass, which is a
 *                reasonable next Skia addition but out of scope here; v1
 *                always saves pages as originally captured.
 *   • PDF:       expo-print, images embedded as base64 data URIs.
 *
 * Install: expo-image-picker expo-image-manipulator expo-print expo-file-system @shopify/react-native-skia
 */

import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import * as Print from 'expo-print';
import { useCallback, useState } from 'react';
import { Alert, Image, Platform } from 'react-native';
// NOTE: as of Expo SDK 54, the default `expo-file-system` entrypoint points to
// the new object-oriented File/Directory API, which dropped `EncodingType` and
// `readAsStringAsync`. Import from `/legacy` to keep using the callback-style
// API this file relies on (fixes "Cannot read property 'Base64' of undefined").
import {
  BlendMode,
  ImageFormat,
  MipmapMode,
  FilterMode as SkFilterMode,
  Skia,
  TileMode,
  VertexMode,
} from '@shopify/react-native-skia';
import * as FileSystem from 'expo-file-system/legacy';
import { DEFAULT_QUAD, detectQuadFromRGBA } from './detectQuad';
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

/** Load a local file URI into a decoded Skia image. */
const loadSkiaImage = async (uri: string) => {
  const base64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  const data = Skia.Data.fromBase64(base64);
  const image = Skia.Image.MakeImageFromEncoded(data);
  if (!image) throw new Error('Skia could not decode this image');
  return image;
};

/**
 * Real auto-crop via edge detection (previously: a fixed 5% margin, since
 * there was no pixel access on-device without Skia).
 *
 * Downscales the photo, reads raw RGBA pixels back with Skia, runs a Sobel
 * pass to get an edge-strength map, then collapses that into row/column
 * "edge energy" profiles. A document against a background/table produces a
 * strong sustained line where its edge falls, so the four boundaries are
 * found as the strongest line within the outer third of each side. This is
 * the on-device (no OpenCV) counterpart to the Sobel + adaptive-threshold
 * pass the web build already runs over canvas ImageData — same idea, Skia
 * pixels instead of canvas pixels.
 *
 * It detects a straight-edged rectangle, not four independent corners, so a
 * genuinely skewed photo still needs the user to drag the corner handles
 * afterwards — that's what CropEditor's perspective mode is for.
 */
const autoDetectCropNative = async (uri: string): Promise<CropRegion> => {
  const marginFallback = (): CropRegion => ({ x: 5, y: 5, w: 90, h: 90 });

  const image = await loadSkiaImage(uri);
  const iw = image.width();
  const ih = image.height();
  if (!iw || !ih) return marginFallback();

  // Downscale to a fixed longest side — plenty for finding boundary lines,
  // and keeps the Sobel pass (O(pixels)) fast on-device.
  const DS = 400;
  const scale = Math.min(1, DS / Math.max(iw, ih));
  const dw = Math.max(2, Math.round(iw * scale));
  const dh = Math.max(2, Math.round(ih * scale));

  const surface = Skia.Surface.MakeOffscreen(dw, dh);
  if (!surface) return marginFallback();
  const canvas = surface.getCanvas();
  canvas.drawImageRect(
    image,
    Skia.XYWHRect(0, 0, iw, ih),
    Skia.XYWHRect(0, 0, dw, dh),
    Skia.Paint(),
  );
  surface.flush();
  const pixels = surface.makeImageSnapshot().readPixels(0, 0, {
    width: dw,
    height: dh,
    colorType: 4 /* RGBA_8888 — avoids importing the ColorType enum just for this */,
    alphaType: 1 /* Opaque */,
  }) as Uint8Array | Float32Array | null;
  if (!pixels) return marginFallback();

  // Grayscale
  const gray = new Float32Array(dw * dh);
  for (let i = 0, p = 0; i < gray.length; i++, p += 4) {
    gray[i] = 0.299 * pixels[p] + 0.587 * pixels[p + 1] + 0.114 * pixels[p + 2];
  }

  // Sobel edge magnitude
  const mag = new Float32Array(dw * dh);
  for (let y = 1; y < dh - 1; y++) {
    for (let x = 1; x < dw - 1; x++) {
      const i = y * dw + x;
      const gx =
        -gray[i - dw - 1] - 2 * gray[i - 1] - gray[i + dw - 1] +
        gray[i - dw + 1] + 2 * gray[i + 1] + gray[i + dw + 1];
      const gy =
        -gray[i - dw - 1] - 2 * gray[i - dw] - gray[i - dw + 1] +
        gray[i + dw - 1] + 2 * gray[i + dw] + gray[i + dw + 1];
      mag[i] = Math.sqrt(gx * gx + gy * gy);
    }
  }

  // Row/column edge-energy profiles
  const rowEnergy = new Float32Array(dh);
  const colEnergy = new Float32Array(dw);
  for (let y = 0; y < dh; y++) {
    let sum = 0;
    for (let x = 0; x < dw; x++) sum += mag[y * dw + x];
    rowEnergy[y] = sum;
  }
  for (let x = 0; x < dw; x++) {
    let sum = 0;
    for (let y = 0; y < dh; y++) sum += mag[y * dw + x];
    colEnergy[x] = sum;
  }

  const argmaxIn = (arr: Float32Array, from: number, to: number) => {
    let best = from;
    let bestVal = -Infinity;
    for (let i = from; i < to; i++) {
      if (arr[i] > bestVal) { bestVal = arr[i]; best = i; }
    }
    return best;
  };

  const top = argmaxIn(rowEnergy, 0, Math.floor(dh / 3));
  const bottom = argmaxIn(rowEnergy, Math.floor((2 * dh) / 3), dh);
  const left = argmaxIn(colEnergy, 0, Math.floor(dw / 3));
  const right = argmaxIn(colEnergy, Math.floor((2 * dw) / 3), dw);

  // Sanity-check the box — if detection collapsed to something implausibly
  // small, the margin fallback is safer than a bad crop.
  if (right - left < dw * 0.3 || bottom - top < dh * 0.3) return marginFallback();

  return {
    x: (left / dw) * 100,
    y: (top / dh) * 100,
    w: ((right - left) / dw) * 100,
    h: ((bottom - top) / dh) * 100,
  };
};

// ─── Homography ───────────────────────────────────────────────────────────────

/**
 * Solve the projective transform (h0..h7, with h8 = 1) that maps every point
 * dp[i] → sp[i], via 8×8 Gaussian elimination. Identical math to the web
 * build's applyPerspectiveCrop, so both platforms straighten a page the same
 * way:  xs = (h0*xd + h1*yd + h2) / (h6*xd + h7*yd + 1)
 *       ys = (h3*xd + h4*yd + h5) / (h6*xd + h7*yd + 1)
 * Returns null when the four points are degenerate (e.g. collinear).
 */
const solveHomography = (sp: number[], dp: number[]): number[] | null => {
  const n = 8;
  const M: number[][] = [];
  for (let i = 0; i < 4; i++) {
    const xs = sp[i * 2], ys = sp[i * 2 + 1];
    const xd = dp[i * 2], yd = dp[i * 2 + 1];
    M.push([xd, yd, 1, 0, 0, 0, -xs * xd, -xs * yd, xs]);
    M.push([0, 0, 0, xd, yd, 1, -ys * xd, -ys * yd, ys]);
  }
  for (let col = 0; col < n; col++) {
    let maxRow = col;
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(M[row][col]) > Math.abs(M[maxRow][col])) maxRow = row;
    }
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

// Mesh density for the warp. The mapping is evaluated with the EXACT
// homography at every mesh vertex; each small cell is then drawn affinely, so
// the error shrinks with the grid. 32 is visually indistinguishable from a
// per-pixel warp on a phone-sized page and still a single GPU draw call.
const WARP_GRID = 32;

/**
 * Perspective-correct ("unwarp") the skewed quad `corners` (in % of image
 * size) out of `uri`, producing a flat rectangular image.
 *
 * 1. Solve the homography H that maps the flat output rectangle → the quad in
 *    source pixels (same solver as web).
 * 2. Lay a WARP_GRID × WARP_GRID triangle mesh over the OUTPUT rectangle and,
 *    for each vertex, use H to find the matching source pixel — that becomes
 *    the vertex's texture coordinate.
 * 3. Skia texture-maps the photo through that mesh in one drawVertices call.
 *
 * (The previous version interpolated the quad bilinearly, which is NOT a
 * projective map — it visibly distorts under strong perspective.)
 *
 * Throws on failure; cropToPerspective() below catches and falls back to a
 * bounding-box crop.
 */
const cropToPerspectiveSkia = async (uri: string, corners: QuadCorners): Promise<string> => {
  const image = await loadSkiaImage(uri);
  const iw = image.width();
  const ih = image.height();

  const toPx = (p: { x: number; y: number }) => ({ x: (p.x / 100) * iw, y: (p.y / 100) * ih });
  const tl = toPx(corners.tl), tr = toPx(corners.tr), br = toPx(corners.br), bl = toPx(corners.bl);

  const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);
  // Output size follows the quad's own (longest) edge lengths — same as web.
  const outW = Math.max(1, Math.round(Math.max(dist(tl, tr), dist(bl, br))));
  const outH = Math.max(1, Math.round(Math.max(dist(tl, bl), dist(tr, br))));

  const H = solveHomography(
    [tl.x, tl.y, tr.x, tr.y, br.x, br.y, bl.x, bl.y],
    [0, 0, outW, 0, outW, outH, 0, outH],
  );
  if (!H) throw new Error('The four corners are degenerate — cannot compute the perspective transform');

  const cols = WARP_GRID + 1;
  // NOTE: Skia.MakeVertices takes arrays of {x, y} POINTS — not flat number
  // arrays. Passing numbers throws "Value is a number, expected an Object".
  const positions: { x: number; y: number }[] = [];
  const textures: { x: number; y: number }[] = [];
  for (let row = 0; row < cols; row++) {
    const yd = (outH * row) / WARP_GRID;
    for (let col = 0; col < cols; col++) {
      const xd = (outW * col) / WARP_GRID;
      const w = H[6] * xd + H[7] * yd + 1;
      positions.push({ x: xd, y: yd });
      textures.push({ x: (H[0] * xd + H[1] * yd + H[2]) / w, y: (H[3] * xd + H[4] * yd + H[5]) / w });
    }
  }

  const indices: number[] = [];
  for (let row = 0; row < WARP_GRID; row++) {
    for (let col = 0; col < WARP_GRID; col++) {
      const i0 = row * cols + col;
      const i1 = i0 + 1;
      const i2 = i0 + cols;
      const i3 = i2 + 1;
      indices.push(i0, i2, i1, i1, i2, i3);
    }
  }

  const vertices = Skia.MakeVertices(VertexMode.Triangles, positions, textures, undefined, indices);

  const surface = Skia.Surface.MakeOffscreen(outW, outH);
  if (!surface) throw new Error('Skia could not allocate an offscreen surface for the warp');
  const canvas = surface.getCanvas();
  canvas.clear(Skia.Color('#FFFFFF'));

  const paint = Skia.Paint();
  const shader = image.makeShaderOptions(TileMode.Clamp, TileMode.Clamp, SkFilterMode.Linear, MipmapMode.None);
  paint.setShader(shader);
  canvas.drawVertices(vertices, BlendMode.Src, paint);
  surface.flush();

  const base64 = surface.makeImageSnapshot().encodeToBase64(ImageFormat.JPEG, 92);
  const path = `${FileSystem.cacheDirectory}scan_warp_${Date.now()}.jpg`;
  await FileSystem.writeAsStringAsync(path, base64, { encoding: FileSystem.EncodingType.Base64 });
  return path;
};

/**
 * Crop using perspective corners. Tries the real Skia warp first; if that
 * throws for any reason (unsupported Skia build, decode failure, etc.) falls
 * back to the old behavior of cropping the corners' bounding rectangle, so
 * the user still gets *a* crop rather than an error.
 */
const cropToPerspective = async (uri: string, corners: QuadCorners): Promise<string> => {
  try {
    return await cropToPerspectiveSkia(uri, corners);
  } catch (err) {
    console.error('Skia perspective warp failed, falling back to bounding-box crop:', err);
    const xs = [corners.tl.x, corners.tr.x, corners.br.x, corners.bl.x];
    const ys = [corners.tl.y, corners.tr.y, corners.br.y, corners.bl.y];
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    return cropToRegion(uri, { x: minX, y: minY, w: maxX - minX, h: maxY - minY });
  }
};

// ─── Corner helpers (mirror the web build's confirm logic) ───────────────────

const cornersBBox = (c: QuadCorners): CropRegion => {
  const xs = [c.tl.x, c.tr.x, c.br.x, c.bl.x];
  const ys = [c.tl.y, c.tr.y, c.br.y, c.bl.y];
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
};

/** True when the quad is (within `tol` %) an upright rectangle → plain crop is enough. */
const isAxisAligned = (c: QuadCorners, tol = 1): boolean =>
  Math.abs(c.tl.x - c.bl.x) <= tol &&
  Math.abs(c.tr.x - c.br.x) <= tol &&
  Math.abs(c.tl.y - c.tr.y) <= tol &&
  Math.abs(c.bl.y - c.br.y) <= tol;

/** False for crossed / bow-tie quads (user dragged a corner past its neighbour). */
const isConvexQuad = (c: QuadCorners): boolean => {
  const pts = [c.tl, c.tr, c.br, c.bl];
  let sign = 0;
  for (let i = 0; i < 4; i++) {
    const a = pts[i], b = pts[(i + 1) % 4], d = pts[(i + 2) % 4];
    const cross = (b.x - a.x) * (d.y - b.y) - (b.y - a.y) * (d.x - b.x);
    if (Math.abs(cross) < 1e-6) return false;
    const sgn = cross > 0 ? 1 : -1;
    if (sign === 0) sign = sgn;
    else if (sgn !== sign) return false;
  }
  return true;
};

/** One entry point for "crop this photo to these four corners". */
const cropByCorners = async (uri: string, corners: QuadCorners): Promise<string> => {
  if (isAxisAligned(corners)) return cropToRegion(uri, cornersBBox(corners));
  return cropToPerspective(uri, corners);
};

// ─── Capture normalisation ────────────────────────────────────────────────────

const MAX_SCAN_SIDE = 2400; // same cap the web build uses

type Rotation = 0 | 90 | 180 | 270;

/** Clockwise rotation that turns RAW pixels upright, from the EXIF Orientation tag (mirroring ignored). */
const rotationFromExif = (exif: Record<string, any> | null | undefined): Rotation | null => {
  const raw = exif?.Orientation ?? exif?.orientation;
  const o = typeof raw === 'string' ? parseInt(raw, 10) : raw;
  switch (o) {
    case 1: case 2: return 0;
    case 3: case 4: return 180;
    case 5: case 6: return 90;
    case 7: case 8: return 270;
    default: return null;
  }
};

/**
 * Turn a freshly captured/picked photo into a canonical file: pixels UPRIGHT,
 * no EXIF tag, longest side ≤ MAX_SCAN_SIDE.
 *
 * Why this matters: the crop editor draws the photo with <Image> (which
 * honours the EXIF rotation tag), but Skia and the crop tools work on the raw
 * pixel grid (which does not). If those two disagree, the handles you place
 * on screen land on different pixels than the ones that get cropped — the
 * "crop came out as the wrong part of the photo" symptom. Baking the rotation
 * into the pixels ourselves, in Skia (whose behaviour is known: raw decode),
 * removes the disagreement for everything downstream.
 *
 * Falls back to the original URI if anything fails.
 */
const normalizeImage = async (asset: { uri: string; exif?: Record<string, any> | null }): Promise<string> => {
  try {
    const image = await loadSkiaImage(asset.uri);
    const rw = image.width();
    const rh = image.height();

    // 1) Which way is "up"?  EXIF first; if the picker gave us none, compare the
    //    dimensions RN would display with the raw ones (swapped ⇒ 90° tag).
    //    iOS pickers already hand back upright pixels, so never rotate there.
    let rot: Rotation = 0;
    if (Platform.OS !== 'ios') {
      const fromExif = rotationFromExif(asset.exif);
      if (fromExif !== null) {
        rot = fromExif;
      } else {
        const disp = await getImageSize(asset.uri).catch(() => null);
        if (disp && disp.width !== disp.height && (disp.width > disp.height) !== (rw > rh)) rot = 90;
      }
    }
    if (__DEV__) console.log('[scan] normalise', { raw: [rw, rh], exif: asset.exif?.Orientation ?? null, rot });

    // 2) Draw upright + downscaled into an offscreen surface.
    const swap = rot === 90 || rot === 270;
    const uw = swap ? rh : rw; // upright size (before downscale)
    const uh = swap ? rw : rh;
    const scale = Math.min(1, MAX_SCAN_SIDE / Math.max(uw, uh));
    const ow = Math.max(1, Math.round(uw * scale));
    const oh = Math.max(1, Math.round(uh * scale));

    const surface = Skia.Surface.MakeOffscreen(ow, oh);
    if (!surface) throw new Error('no offscreen surface');
    const canvas = surface.getCanvas();
    canvas.scale(scale, scale);
    if (rot === 90) { canvas.translate(uw, 0); canvas.rotate(90, 0, 0); }
    else if (rot === 180) { canvas.translate(uw, uh); canvas.rotate(180, 0, 0); }
    else if (rot === 270) { canvas.translate(0, uh); canvas.rotate(270, 0, 0); }
    canvas.drawImageOptions(image, 0, 0, SkFilterMode.Linear, MipmapMode.Linear, Skia.Paint());
    surface.flush();

    const base64 = surface.makeImageSnapshot().encodeToBase64(ImageFormat.JPEG, 95);
    const path = `${FileSystem.cacheDirectory}scan_src_${Date.now()}_${Math.random().toString(36).slice(2, 7)}.jpg`;
    await FileSystem.writeAsStringAsync(path, base64, { encoding: FileSystem.EncodingType.Base64 });
    return path;
  } catch (err) {
    console.warn('normalizeImage failed, using original:', err);
    return asset.uri;
  }
};

/**
 * Perspective-aware auto-detect: same algorithm as the web build
 * (see detectQuad.ts), fed with pixels read back from Skia. Returns the four
 * document corners. Falls back to the old axis-aligned Sobel box if the
 * quad detector throws.
 */
const AUTO_DETECT_WIDTH = 600;
const autoDetectQuadNative = async (uri: string): Promise<QuadCorners> => {
  try {
    const image = await loadSkiaImage(uri);
    const iw = image.width();
    const ih = image.height();
    if (!iw || !ih) return DEFAULT_QUAD;

    const scale = Math.min(1, AUTO_DETECT_WIDTH / iw);
    const dw = Math.max(2, Math.round(iw * scale));
    const dh = Math.max(2, Math.round(ih * scale));

    const surface = Skia.Surface.MakeOffscreen(dw, dh);
    if (!surface) throw new Error('no offscreen surface');
    surface.getCanvas().drawImageRect(
      image,
      Skia.XYWHRect(0, 0, iw, ih),
      Skia.XYWHRect(0, 0, dw, dh),
      Skia.Paint(),
    );
    surface.flush();
    const pixels = surface.makeImageSnapshot().readPixels(0, 0, {
      width: dw,
      height: dh,
      colorType: 4 /* RGBA_8888 */,
      alphaType: 1 /* Opaque */,
    }) as Uint8Array | Float32Array | null;
    if (!pixels) throw new Error('readPixels returned null');

    return detectQuadFromRGBA(pixels, dw, dh);
  } catch (err) {
    console.warn('Quad detection failed, falling back to rectangular auto-crop:', err);
    const r = await autoDetectCropNative(uri);
    return {
      tl: { x: r.x, y: r.y },
      tr: { x: r.x + r.w, y: r.y },
      br: { x: r.x + r.w, y: r.y + r.h },
      bl: { x: r.x, y: r.y + r.h },
    };
  }
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

  // Auto-crop: detects the four document corners (same algorithm as web),
  // shows them in the editor, and — for "Auto-crop & Add" — warps straight away.
  const handleAutoCrop = useCallback(
    async (autoConfirm = false) => {
      if (!cropImageSrc) return;
      setAutoDetecting(true);
      try {
        const corners = await autoDetectQuadNative(cropImageSrc);
        setCropCorners(corners);
        setCropRegion(cornersBBox(corners));

        if (autoConfirm) {
          setCropModalVisible(false);
          setScanning(true);
          let cropped: string;
          try {
            cropped = await cropByCorners(cropImageSrc, corners);
          } catch (e) {
            console.error('Auto perspective failed, falling back to bounding box:', e);
            cropped = await cropToRegion(cropImageSrc, cornersBBox(corners));
          }
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
    const corners = cropCorners;
    if (!imageSrc) {
      Alert.alert('Error', 'No image selected');
      return;
    }
    if (!corners || !corners.tl || !corners.tr || !corners.br || !corners.bl) {
      Alert.alert('Error', 'Invalid corner points');
      return;
    }
    const box = cornersBBox(corners);
    if (box.w < 2 || box.h < 2) {
      Alert.alert('Crop too small', 'Drag the corners further apart.');
      return;
    }
    if (!isConvexQuad(corners)) {
      Alert.alert('Corners are crossed', 'Drag the corner handles so they outline the page in order (no twisting).');
      return;
    }

    setCropModalVisible(false);
    setScanning(true);
    try {
      if (filterMode !== 'none') {
        console.warn(`Filter "${filterMode}" is not yet supported on native — saving unfiltered.`);
      }

      // Upright rectangle → plain crop; anything skewed → homography warp.
      const cropped = await cropByCorners(imageSrc, corners);

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
  }, [cropImageSrc, cropCorners, filterMode]);

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
        exif: true,
      });
      if (result.canceled || !result.assets?.length) return;
      setScanning(true);
      const uri = await normalizeImage(result.assets[0]);
      setScanning(false);
      openCropFor(uri);
    } catch (err) {
      setScanning(false);
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
        exif: true,
      });
      if (result.canceled || !result.assets?.length) return;

      const assets = result.assets;
      setScanning(true);
      // Bulk-select: pre-add pages 2+ uncropped (mirrors the web flow), first goes to crop
      if (assets.length > 1) {
        const extraUris = await Promise.all(assets.slice(1).map((a) => normalizeImage(a)));
        const extras: ScannedPage[] = extraUris.map((uri, i) => ({
          id: `${Date.now()}_${i}`,
          dataUrl: uri,
          filter: filterMode,
          addedAt: Date.now(),
        }));
        setPages((prev) => [...prev, ...extras]);
      }
      const firstUri = await normalizeImage(assets[0]);
      setScanning(false);
      openCropFor(firstUri);
    } catch (err) {
      setScanning(false);
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