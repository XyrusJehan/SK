/**
 * CropEditor.tsx
 * Interactive document crop editor for Expo Web / React Native Web.
 * Supports both rectangular cropping and perspective quadrilateral cropping.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Image, LayoutChangeEvent, PanResponder, Platform, StyleSheet, View } from 'react-native';
import type { CropRegion, QuadCorners } from './useDocumentScanner';

// NOTE: Skia is no longer imported here — this component only draws the
// lightweight handle/overlay UI (plain RN Views), which doesn't need it.
// The actual pixel-level Skia work (perspective warp + edge-detection
// auto-crop) lives in useDocumentScanner.native.ts, where the real crop
// happens once the user confirms. Importing the Skia bindings in a file
// that never calls them just pulls in the native module for nothing.

interface CropEditorProps {
  imageUri: string;
  region: CropRegion;
  corners?: QuadCorners;
  onChange?: (r: CropRegion) => void;
  onCornersChange?: (c: QuadCorners) => void;
}

// ─── Web implementation ───────────────────────────────────────────────────────

function CropEditorWeb({ imageUri, region, corners, onChange, onCornersChange }: CropEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const regionRef = useRef(region);
  const cornersRef = useRef(corners || {
    tl: { x: region.x, y: region.y },
    tr: { x: region.x + region.w, y: region.y },
    br: { x: region.x + region.w, y: region.y + region.h },
    bl: { x: region.x, y: region.y + region.h },
  });
  const onChangeRef = useRef(onChange);
  const onCornersChangeRef = useRef(onCornersChange);
  const dragState = useRef<{
    handle: string;
    startX: number;
    startY: number;
    startRegion: CropRegion;
    startCorners: QuadCorners;
  } | null>(null);
  const [mode, setMode] = useState<'region' | 'corners'>('corners');

  useEffect(() => {
    regionRef.current = region;
  }, [region]);
  useEffect(() => {
    if (corners) cornersRef.current = corners;
  }, [corners]);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);
  useEffect(() => {
    onCornersChangeRef.current = onCornersChange;
  }, [onCornersChange]);

  const clamp = (v: number, min: number, max: number) =>
    Math.min(max, Math.max(min, v));

  const startDrag = (
    e: React.MouseEvent | React.TouchEvent,
    handle: string,
  ) => {
    // Note: preventDefault doesn't work in passive touch events, but that's okay
    // The touchmove/touchend listeners handle the drag behavior
    if (!regionRef.current || !cornersRef.current) return;

    let clientX: number, clientY: number;
    if ('touches' in e && e.touches && e.touches.length > 0) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else if ('clientX' in e) {
      clientX = (e as React.MouseEvent).clientX;
      clientY = (e as React.MouseEvent).clientY;
    } else {
      return;
    }

    dragState.current = {
      handle,
      startX: clientX,
      startY: clientY,
      startRegion: { ...regionRef.current },
      startCorners: { ...cornersRef.current },
    };
  };

  useEffect(() => {
    const onMove = (e: MouseEvent | TouchEvent) => {
      if (!dragState.current || !containerRef.current) return;
      const { handle, startRegion: r, startCorners: sc } = dragState.current;
      if (!r || !sc) return;

      let clientX: number, clientY: number;
      if ('touches' in e && e.touches && e.touches.length > 0) {
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
      } else if ('clientX' in e) {
        clientX = (e as MouseEvent).clientX;
        clientY = (e as MouseEvent).clientY;
      } else {
        return;
      }

      const rect = containerRef.current.getBoundingClientRect();
      const dx = ((clientX - dragState.current.startX) / rect.width) * 100;
      const dy = ((clientY - dragState.current.startY) / rect.height) * 100;
      let { x, y, w, h } = r;

      const isCorner = ['tl', 'tr', 'br', 'bl'].includes(handle);

      if (isCorner && onCornersChangeRef.current) {
        // Corner drag mode - update individual corner
        const newCorners = { ...sc };
        const corner = handle as keyof QuadCorners;
        newCorners[corner] = {
          x: clamp(sc[corner].x + dx, 0, 100),
          y: clamp(sc[corner].y + dy, 0, 100),
        };
        onCornersChangeRef.current(newCorners);
        setMode('corners');
      } else if (handle === 'move') {
        // Move entire region
        x = clamp(r.x + dx, 0, 100 - r.w);
        y = clamp(r.y + dy, 0, 100 - r.h);
        onChangeRef.current?.({ x, y, w, h });
        // Also move corners in sync
        if (onCornersChangeRef.current) {
          onCornersChangeRef.current({
            tl: { x: x, y: y },
            tr: { x: x + w, y: y },
            br: { x: x + w, y: y + h },
            bl: { x: x, y: y + h },
          });
        }
        setMode('region');
      } else {
        // Resize handles (e, w, n, s, ne, nw, se, sw)
        if (handle.includes('e')) w = clamp(r.w + dx, 10, 100 - r.x);
        if (handle.includes('s')) h = clamp(r.h + dy, 10, 100 - r.y);
        if (handle.includes('w')) {
          const nx = clamp(r.x + dx, 0, r.x + r.w - 10);
          w = r.w - (nx - r.x);
          x = nx;
        }
        if (handle.includes('n')) {
          const ny = clamp(r.y + dy, 0, r.y + r.h - 10);
          h = r.h - (ny - r.y);
          y = ny;
        }
        onChangeRef.current?.({ x, y, w, h });
        // Update corners to match new region
        if (onCornersChangeRef.current) {
          onCornersChangeRef.current({
            tl: { x, y },
            tr: { x: x + w, y },
            br: { x: x + w, y: y + h },
            bl: { x, y: y + h },
          });
        }
        setMode('region');
      }
    };

    const onEnd = () => {
      dragState.current = null;
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onEnd);
    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('touchend', onEnd);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onEnd);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onEnd);
    };
  }, []);

  const activeCorners = corners || {
    tl: { x: region.x, y: region.y },
    tr: { x: region.x + region.w, y: region.y },
    br: { x: region.x + region.w, y: region.y + region.h },
    bl: { x: region.x, y: region.y + region.h },
  };

  const cornerHandles = [
    { id: 'tl', x: activeCorners.tl.x, y: activeCorners.tl.y, cursor: 'nw-resize' },
    { id: 'tr', x: activeCorners.tr.x, y: activeCorners.tr.y, cursor: 'ne-resize' },
    { id: 'br', x: activeCorners.br.x, y: activeCorners.br.y, cursor: 'se-resize' },
    { id: 'bl', x: activeCorners.bl.x, y: activeCorners.bl.y, cursor: 'sw-resize' },
  ] as const;

  // Build SVG polygon points
  const polygonPoints = `${activeCorners.tl.x},${activeCorners.tl.y} ${activeCorners.tr.x},${activeCorners.tr.y} ${activeCorners.br.x},${activeCorners.br.y} ${activeCorners.bl.x},${activeCorners.bl.y}`;

  // Compute bounding box from corners for fallback rectangle
  const cornerXs = [activeCorners.tl.x, activeCorners.tr.x, activeCorners.br.x, activeCorners.bl.x];
  const cornerYs = [activeCorners.tl.y, activeCorners.tr.y, activeCorners.br.y, activeCorners.bl.y];
  const derivedRegion = {
    x: Math.min(...cornerXs),
    y: Math.min(...cornerYs),
    w: Math.max(...cornerXs) - Math.min(...cornerXs),
    h: Math.max(...cornerYs) - Math.min(...cornerYs),
  };

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        width: '100%',
        userSelect: 'none',
        touchAction: 'none',
        borderRadius: 8,
        overflow: 'hidden',
        backgroundColor: '#000',
      }}
    >
      <img
        src={imageUri}
        alt="scan"
        style={{ display: 'block', width: '100%', height: 'auto', opacity: 0.45 }}
        draggable={false}
      />
      <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.4)', pointerEvents: 'none' }} />

      {/* Use SVG for proper perspective quad rendering */}
      <svg
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
        }}
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
      >
        {/* Semi-transparent fill inside the quad */}
        <polygon
          points={polygonPoints}
          fill="rgba(232, 197, 71, 0.15)"
          stroke="none"
        />
        {/* Quadrilateral border lines */}
        <polygon
          points={polygonPoints}
          fill="none"
          stroke="#E8C547"
          strokeWidth="0.5"
          strokeLinejoin="round"
        />
        {/* Diagonal lines for perspective visualization (optional) */}
        <line
          x1={activeCorners.tl.x}
          y1={activeCorners.tl.y}
          x2={activeCorners.br.x}
          y2={activeCorners.br.y}
          stroke="rgba(232, 197, 71, 0.2)"
          strokeWidth="0.2"
          strokeDasharray="2,2"
        />
        <line
          x1={activeCorners.tr.x}
          y1={activeCorners.tr.y}
          x2={activeCorners.bl.x}
          y2={activeCorners.bl.y}
          stroke="rgba(232, 197, 71, 0.2)"
          strokeWidth="0.2"
          strokeDasharray="2,2"
        />
      </svg>

      {/* Fallback rectangle overlay (shown behind SVG) */}
      <div
        style={{
          position: 'absolute',
          top: `${derivedRegion.y}%`,
          left: `${derivedRegion.x}%`,
          width: `${derivedRegion.w}%`,
          height: `${derivedRegion.h}%`,
          border: '2px solid rgba(232, 197, 71, 0.3)',
          cursor: 'move',
          pointerEvents: 'none',
        }}
      />

      {/* Center move handle */}
      <div
        style={{
          top: `${derivedRegion.y + derivedRegion.h / 2}%`,
          left: `${derivedRegion.x + derivedRegion.w / 2}%`,
          width: 20,
          height: 20,
          marginTop: -10,
          marginLeft: -10,
          background: 'rgba(19, 62, 117, 0.8)',
          borderRadius: '50%',
          cursor: 'move',
          zIndex: 5,
          touchAction: 'none',
        }}
        onMouseDown={(e) => { e.stopPropagation(); startDrag(e, 'move'); }}
        onTouchStart={(e) => { e.stopPropagation(); startDrag(e, 'move'); }}
      />

      {cornerHandles.map((h) => (
        <div
          key={h.id}
          style={{
            position: 'absolute',
            top: `${h.y}%`,
            left: `${h.x}%`,
            width: 22,
            height: 22,
            marginTop: -11,
            marginLeft: -11,
            background: '#E8C547',
            border: '3px solid #133E75',
            borderRadius: 4,
            cursor: h.cursor,
            zIndex: 10,
            touchAction: 'none',
          }}
          onMouseDown={(e) => { e.stopPropagation(); startDrag(e, h.id); }}
          onTouchStart={(e) => { e.stopPropagation(); startDrag(e, h.id); }}
        />
      ))}
    </div>
  );
}

// ─── Native implementation (free 4-corner perspective editor) ────────────────
//
// Mirrors the web editor: four INDEPENDENT corner handles, always visible,
// with the real quadrilateral drawn between them.
// - Drag a corner handle to move just that corner
// - Drag inside the quad to move the whole thing
// - Double-tap a corner to snap it back to the bounding-box corner
//
// Coordinates: every % here is relative to the IMAGE itself. The "stage" View
// below is sized to the photo's exact aspect ratio (no letterboxing), so
// 50% / 50% is the true centre of the picture — which is what the Skia warp in
// useDocumentScanner.native.ts assumes when it converts % → source pixels.
// (Before, the photo used resizeMode="contain" inside a fixed-height box, so
// any non-matching aspect ratio shifted the handles off the pixels they
// appeared to sit on.)
//
// The quad is drawn with plain rotated Views on purpose: importing Skia or
// react-native-svg here would drag a native module into the web bundle.

type CornerKey = 'tl' | 'tr' | 'br' | 'bl';
type HandleId = 'move' | CornerKey;

const CORNER_IDS: CornerKey[] = ['tl', 'tr', 'br', 'bl'];
const MAX_STAGE_HEIGHT = 420;
const STAGE_PAD = 18;        // room around the stage so edge handles aren't clipped
const HANDLE_SIZE = 30;
const EDGE_THICKNESS = 2.5;
const GOLD = '#E8C547';
const NAVY = '#133E75';

const clampNum = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

const cornersToBox = (c: QuadCorners) => {
  const xs = [c.tl.x, c.tr.x, c.br.x, c.bl.x];
  const ys = [c.tl.y, c.tr.y, c.br.y, c.bl.y];
  return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
};

/** One straight edge of the quad, drawn as a rotated bar with a dark under-stroke for contrast. */
function QuadEdge({ a, b }: { a: { x: number; y: number }; b: { x: number; y: number } }) {
  const len = Math.hypot(b.x - a.x, b.y - a.y);
  const angle = Math.atan2(b.y - a.y, b.x - a.x);
  const cx = (a.x + b.x) / 2;
  const cy = (a.y + b.y) / 2;
  const rotate = [{ rotate: `${angle}rad` }];
  return (
    <>
      <View
        pointerEvents="none"
        style={{
          position: 'absolute', left: cx - len / 2, top: cy - (EDGE_THICKNESS + 3) / 2,
          width: len, height: EDGE_THICKNESS + 3, backgroundColor: 'rgba(0,0,0,0.45)', transform: rotate,
        }}
      />
      <View
        pointerEvents="none"
        style={{
          position: 'absolute', left: cx - len / 2, top: cy - EDGE_THICKNESS / 2,
          width: len, height: EDGE_THICKNESS, backgroundColor: GOLD, transform: rotate,
        }}
      />
    </>
  );
}

function CropEditorNative({ imageUri, region, corners, onChange, onCornersChange }: CropEditorProps) {
  const [containerW, setContainerW] = useState(0);
  const [aspect, setAspect] = useState(3 / 4); // width / height — replaced once Image.getSize resolves

  useEffect(() => {
    let cancelled = false;
    Image.getSize(
      imageUri,
      (w, h) => { if (!cancelled && w > 0 && h > 0) setAspect(w / h); },
      () => { /* keep the default aspect; handles still work, just less exact */ },
    );
    return () => { cancelled = true; };
  }, [imageUri]);

  // Fit the photo inside (container width × MAX_STAGE_HEIGHT), preserving aspect.
  const availW = Math.max(0, containerW - STAGE_PAD * 2);
  let stageW = availW;
  let stageH = availW / aspect;
  if (stageH > MAX_STAGE_HEIGHT) {
    stageH = MAX_STAGE_HEIGHT;
    stageW = stageH * aspect;
  }

  const activeCorners: QuadCorners = corners || {
    tl: { x: region.x, y: region.y },
    tr: { x: region.x + region.w, y: region.y },
    br: { x: region.x + region.w, y: region.y + region.h },
    bl: { x: region.x, y: region.y + region.h },
  };

  // The PanResponders below are created ONCE (see `responders`), so their
  // callbacks only ever see what they read through refs. Refs are refreshed on
  // every render, so `.current` is always the latest value.
  const stageRef = useRef({ width: 0, height: 0 });
  const cornersRef = useRef(activeCorners);
  const onChangeRef = useRef(onChange);
  const onCornersChangeRef = useRef(onCornersChange);
  stageRef.current = { width: stageW, height: stageH };
  cornersRef.current = activeCorners;
  onChangeRef.current = onChange;
  onCornersChangeRef.current = onCornersChange;

  const dragStart = useRef<{ handle: HandleId; corners: QuadCorners } | null>(null);
  const lastTap = useRef(0);

  /** Push new corners up, and keep `region` equal to their bounding box. */
  const emit = (c: QuadCorners) => {
    onCornersChangeRef.current?.(c);
    const { minX, maxX, minY, maxY } = cornersToBox(c);
    onChangeRef.current?.({ x: minX, y: minY, w: maxX - minX, h: maxY - minY });
  };

  const makeResponder = (handle: HandleId) =>
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponderCapture: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        const now = Date.now();
        if (handle !== 'move' && now - lastTap.current < 300) {
          // Double-tap → snap this corner to the matching corner of the bounding box.
          const c = cornersRef.current;
          const { minX, maxX, minY, maxY } = cornersToBox(c);
          const snapped: QuadCorners = { ...c };
          if (handle === 'tl') snapped.tl = { x: minX, y: minY };
          if (handle === 'tr') snapped.tr = { x: maxX, y: minY };
          if (handle === 'br') snapped.br = { x: maxX, y: maxY };
          if (handle === 'bl') snapped.bl = { x: minX, y: maxY };
          emit(snapped);
          lastTap.current = 0;
          dragStart.current = null;
          return;
        }
        lastTap.current = now;
        dragStart.current = { handle, corners: { ...cornersRef.current } };
      },
      onPanResponderMove: (_e, g) => {
        const start = dragStart.current;
        const { width, height } = stageRef.current;
        if (!start || !width || !height) return;
        const dx = (g.dx / width) * 100;
        const dy = (g.dy / height) * 100;
        const sc = start.corners;

        if (start.handle === 'move') {
          // Translate the whole quad, stopping when any corner reaches the image edge.
          const { minX, maxX, minY, maxY } = cornersToBox(sc);
          const mx = clampNum(dx, -minX, 100 - maxX);
          const my = clampNum(dy, -minY, 100 - maxY);
          emit({
            tl: { x: sc.tl.x + mx, y: sc.tl.y + my },
            tr: { x: sc.tr.x + mx, y: sc.tr.y + my },
            br: { x: sc.br.x + mx, y: sc.br.y + my },
            bl: { x: sc.bl.x + mx, y: sc.bl.y + my },
          });
        } else {
          const k = start.handle;
          emit({
            ...sc,
            [k]: { x: clampNum(sc[k].x + dx, 0, 100), y: clampNum(sc[k].y + dy, 0, 100) },
          });
        }
      },
      onPanResponderRelease: () => { dragStart.current = null; },
      onPanResponderTerminate: () => { dragStart.current = null; },
    });

  // `useRef({...}).current` would still re-run makeResponder every render;
  // useMemo with [] genuinely builds each responder exactly once.
  const responders = useMemo<Record<HandleId, ReturnType<typeof PanResponder.create>>>(
    () => ({
      move: makeResponder('move'),
      tl: makeResponder('tl'),
      tr: makeResponder('tr'),
      br: makeResponder('br'),
      bl: makeResponder('bl'),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  // % → stage pixels
  const P = (pt: { x: number; y: number }) => ({ x: (pt.x / 100) * stageW, y: (pt.y / 100) * stageH });
  const px = { tl: P(activeCorners.tl), tr: P(activeCorners.tr), br: P(activeCorners.br), bl: P(activeCorners.bl) };
  const box = cornersToBox(activeCorners);

  return (
    <View
      style={nativeStyles.container}
      onLayout={(e: LayoutChangeEvent) => setContainerW(e.nativeEvent.layout.width)}
    >
      {stageW > 0 && stageH > 0 && (
        <View style={{ width: stageW, height: stageH }}>
          {/* stretch is exact here: the stage already has the photo's aspect ratio */}
          <Image source={{ uri: imageUri }} style={nativeStyles.image} resizeMode="stretch" />

          {/* Drag surface for moving the whole quad (its bounding box) */}
          <View
            style={{
              position: 'absolute',
              left: (box.minX / 100) * stageW, top: (box.minY / 100) * stageH,
              width: ((box.maxX - box.minX) / 100) * stageW,
              height: ((box.maxY - box.minY) / 100) * stageH,
            }}
            {...responders.move.panHandlers}
          />

          {/* The actual quadrilateral */}
          <QuadEdge a={px.tl} b={px.tr} />
          <QuadEdge a={px.tr} b={px.br} />
          <QuadEdge a={px.br} b={px.bl} />
          <QuadEdge a={px.bl} b={px.tl} />

          {/* Four independent corner handles */}
          {CORNER_IDS.map((id) => (
            <View
              key={id}
              hitSlop={{ top: 14, bottom: 14, left: 14, right: 14 }}
              style={[
                nativeStyles.handle,
                { left: px[id].x - HANDLE_SIZE / 2, top: px[id].y - HANDLE_SIZE / 2 },
              ]}
              {...responders[id].panHandlers}
            />
          ))}
        </View>
      )}
    </View>
  );
}

const nativeStyles = StyleSheet.create({
  container: {
    width: '100%', minHeight: 200, backgroundColor: '#000',
    borderRadius: 8, overflow: 'hidden',
    alignItems: 'center', justifyContent: 'center',
    paddingVertical: STAGE_PAD, paddingHorizontal: STAGE_PAD,
  },
  image: { ...StyleSheet.absoluteFillObject },
  handle: {
    position: 'absolute', width: HANDLE_SIZE, height: HANDLE_SIZE, borderRadius: HANDLE_SIZE / 2,
    backgroundColor: GOLD, borderWidth: 3, borderColor: NAVY, zIndex: 10,
  },
});

export const CropEditor = Platform.OS === 'web' ? CropEditorWeb : CropEditorNative;
export default CropEditor;