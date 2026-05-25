/**
 * CropEditor.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Interactive document crop editor for Expo Web / React Native Web.
 *
 * Renders the raw captured image with:
 *   • A draggable, resizable crop rectangle
 *   • 8 resize handles (corners + edge midpoints)
 *   • Dark overlay outside the crop area
 *   • Rule-of-thirds grid lines inside
 *   • Full-brightness preview inside the crop box vs dimmed outside
 *
 * Works entirely with DOM APIs (available in Expo Web).
 * Falls back to a plain <Image> on native (crop is handled natively there).
 *
 * Props:
 *   imageUri  — data-URL of the image to crop
 *   region    — { x, y, w, h } all in % of image container
 *   onChange  — called with new region on every drag move
 */

import React, { useRef, useEffect } from 'react';
import { Platform, View, Image, StyleSheet } from 'react-native';
import type { CropRegion } from './useDocumentScanner';

interface CropEditorProps {
  imageUri: string;
  region: CropRegion;
  onChange: (r: CropRegion) => void;
}

// ─── Web implementation ───────────────────────────────────────────────────────

function CropEditorWeb({ imageUri, region, onChange }: CropEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const dragState = useRef<{
    handle: string;
    startX: number;
    startY: number;
    startRegion: CropRegion;
  } | null>(null);

  const clamp = (v: number, min: number, max: number) =>
    Math.min(max, Math.max(min, v));

  const startDrag = (
    e: React.MouseEvent | React.TouchEvent,
    handle: string,
  ) => {
    e.preventDefault();
    const clientX =
      'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY =
      'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
    dragState.current = {
      handle,
      startX: clientX,
      startY: clientY,
      startRegion: { ...region },
    };
  };

  useEffect(() => {
    const onMove = (e: MouseEvent | TouchEvent) => {
      if (!dragState.current || !containerRef.current) return;
      const clientX =
        'touches' in e
          ? (e as TouchEvent).touches[0].clientX
          : (e as MouseEvent).clientX;
      const clientY =
        'touches' in e
          ? (e as TouchEvent).touches[0].clientY
          : (e as MouseEvent).clientY;
      const rect = containerRef.current.getBoundingClientRect();
      const dx = ((clientX - dragState.current.startX) / rect.width) * 100;
      const dy = ((clientY - dragState.current.startY) / rect.height) * 100;
      const { handle, startRegion: r } = dragState.current;
      let { x, y, w, h } = r;

      if (handle === 'move') {
        x = clamp(r.x + dx, 0, 100 - r.w);
        y = clamp(r.y + dy, 0, 100 - r.h);
      } else {
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
      }
      onChange({ x, y, w, h });
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
  }, [region, onChange]);

  const handles: { id: string; top: string; left: string; cursor: string }[] = [
    { id: 'nw', top: `${region.y}%`,            left: `${region.x}%`,              cursor: 'nw-resize' },
    { id: 'n',  top: `${region.y}%`,            left: `${region.x + region.w / 2}%`, cursor: 'n-resize'  },
    { id: 'ne', top: `${region.y}%`,            left: `${region.x + region.w}%`,   cursor: 'ne-resize' },
    { id: 'e',  top: `${region.y + region.h / 2}%`, left: `${region.x + region.w}%`, cursor: 'e-resize' },
    { id: 'se', top: `${region.y + region.h}%`, left: `${region.x + region.w}%`,   cursor: 'se-resize' },
    { id: 's',  top: `${region.y + region.h}%`, left: `${region.x + region.w / 2}%`, cursor: 's-resize' },
    { id: 'sw', top: `${region.y + region.h}%`, left: `${region.x}%`,              cursor: 'sw-resize' },
    { id: 'w',  top: `${region.y + region.h / 2}%`, left: `${region.x}%`,          cursor: 'w-resize'  },
  ];

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
      {/* Dimmed base image */}
      <img
        src={imageUri}
        alt="scan"
        style={{ display: 'block', width: '100%', height: 'auto', opacity: 0.45 }}
        draggable={false}
      />

      {/* Dark overlay — four rectangles surrounding the crop box */}
      {/* Left  */}
      <div style={{ position: 'absolute', top: 0, left: 0, width: `${region.x}%`, height: '100%', background: 'rgba(0,0,0,0.55)' }} />
      {/* Right */}
      <div style={{ position: 'absolute', top: 0, left: `${region.x + region.w}%`, right: 0, height: '100%', background: 'rgba(0,0,0,0.55)' }} />
      {/* Top   */}
      <div style={{ position: 'absolute', top: 0, left: `${region.x}%`, width: `${region.w}%`, height: `${region.y}%`, background: 'rgba(0,0,0,0.55)' }} />
      {/* Bottom*/}
      <div style={{ position: 'absolute', top: `${region.y + region.h}%`, left: `${region.x}%`, width: `${region.w}%`, bottom: 0, background: 'rgba(0,0,0,0.55)' }} />

      {/* Full-brightness crop window */}
      <div
        style={{
          position: 'absolute',
          top: `${region.y}%`,
          left: `${region.x}%`,
          width: `${region.w}%`,
          height: `${region.h}%`,
          overflow: 'hidden',
          boxShadow: '0 0 0 2px #E8C547, 0 0 0 4px rgba(19,62,117,0.7)',
          cursor: 'move',
        }}
        onMouseDown={(e) => startDrag(e, 'move')}
        onTouchStart={(e) => startDrag(e, 'move')}
      >
        <img
          src={imageUri}
          alt=""
          draggable={false}
          style={{
            position: 'absolute',
            top: `-${region.y}%`,
            left: `-${region.x}%`,
            width: `${(10000 / region.w)}%`,
            display: 'block',
          }}
        />
        {/* Rule-of-thirds grid */}
        {[33.33, 66.66].map((p) => (
          <React.Fragment key={p}>
            <div style={{ position: 'absolute', top: `${p}%`, left: 0, right: 0, height: 1, background: 'rgba(255,255,255,0.25)' }} />
            <div style={{ position: 'absolute', left: `${p}%`, top: 0, bottom: 0, width: 1, background: 'rgba(255,255,255,0.25)' }} />
          </React.Fragment>
        ))}
      </div>

      {/* Resize handles */}
      {handles.map((h) => (
        <div
          key={h.id}
          style={{
            position: 'absolute',
            top: h.top,
            left: h.left,
            width: 18,
            height: 18,
            marginTop: -9,
            marginLeft: -9,
            background: '#E8C547',
            border: '2.5px solid #133E75',
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
  // On native, use a simple image preview — full crop UX handled by
  // expo-image-manipulator + @baronha/react-native-multiple-image-picker
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

// ─── Export ───────────────────────────────────────────────────────────────────

export const CropEditor = Platform.OS === 'web' ? CropEditorWeb : CropEditorNative;
export default CropEditor;
