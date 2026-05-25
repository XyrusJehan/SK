/**
 * CropEditor.tsx
 * Interactive document crop editor for Expo Web / React Native Web.
 * Supports both rectangular cropping and perspective quadrilateral cropping.
 */

import React, { useRef, useEffect, useState } from 'react';
import { Platform, View, Image, StyleSheet } from 'react-native';
import type { CropRegion, QuadCorners } from './useDocumentScanner';

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

  // Determine if corners form a non-rectangular quad
  const isPerspective = corners ? (
    Math.abs(corners.tl.x - region.x) > 1 ||
    Math.abs(corners.tl.y - region.y) > 1 ||
    Math.abs(corners.tr.x - (region.x + region.w)) > 1 ||
    Math.abs(corners.tr.y - region.y) > 1 ||
    Math.abs(corners.br.x - (region.x + region.w)) > 1 ||
    Math.abs(corners.br.y - (region.y + region.h)) > 1 ||
    Math.abs(corners.bl.x - region.x) > 1 ||
    Math.abs(corners.bl.y - (region.y + region.h)) > 1
  ) : false;

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

  // Determine if we're in perspective mode (asymmetric quad)
  const perspectiveMode = isPerspective || mode === 'corners';

  const cornerHandles = [
    { id: 'tl', x: activeCorners.tl.x, y: activeCorners.tl.y, cursor: 'nw-resize' },
    { id: 'tr', x: activeCorners.tr.x, y: activeCorners.tr.y, cursor: 'ne-resize' },
    { id: 'br', x: activeCorners.br.x, y: activeCorners.br.y, cursor: 'se-resize' },
    { id: 'bl', x: activeCorners.bl.x, y: activeCorners.bl.y, cursor: 'sw-resize' },
  ] as const;

  // Build SVG polygon points
  const polygonPoints = `${activeCorners.tl.x},${activeCorners.tl.y} ${activeCorners.tr.x},${activeCorners.tr.y} ${activeCorners.br.x},${activeCorners.br.y} ${activeCorners.bl.x},${activeCorners.bl.y}`;

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
          top: `${region.y}%`,
          left: `${region.x}%`,
          width: `${region.w}%`,
          height: `${region.h}%`,
          border: '2px solid rgba(232, 197, 71, 0.3)',
          cursor: 'move',
          pointerEvents: 'none',
        }}
      />

      {/* Center move handle */}
      <div
        style={{
          position: 'absolute',
          top: `${region.y + region.h / 2}%`,
          left: `${region.x + region.w / 2}%`,
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

// ─── Native fallback ──────────────────────────────────────────────────────────

function CropEditorNative({ imageUri }: CropEditorProps) {
  return (
    <View style={nativeStyles.container}>
      <Image source={{ uri: imageUri }} style={nativeStyles.image} resizeMode="contain" />
    </View>
  );
}

const nativeStyles = StyleSheet.create({
  container: { width: '100%', minHeight: 260, backgroundColor: '#000', borderRadius: 8, overflow: 'hidden' },
  image: { width: '100%', height: 300 },
});

export const CropEditor = Platform.OS === 'web' ? CropEditorWeb : CropEditorNative;
export default CropEditor;