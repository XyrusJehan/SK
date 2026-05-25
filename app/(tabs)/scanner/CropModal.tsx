/**
 * CropModal.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Full-screen crop modal shown after each page capture.
 *
 * Features:
 *  • Interactive drag-to-resize crop box (via CropEditor)
 *  • Preset aspect ratios (Full, A4, Letter, Square, ID)
 *  • "Auto Detect" — runs the brightness-scan edge detector
 *  • Custom numeric X / Y / W / H inputs
 *  • Region info display (pixel estimate)
 *  • Confirm / Skip / Re-capture actions
 */

import React, { useState, useCallback } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { CropEditor } from './CropEditor';
import type { UseDocumentScannerReturn, CropRegion } from './useDocumentScanner';

// ─── Colours ──────────────────────────────────────────────────────────────────
const C = {
  navy:      '#133E75',
  gold:      '#E8C547',
  white:     '#FFFFFF',
  offWhite:  '#F7F5F2',
  lightGray: '#ECECEC',
  midGray:   '#B0B0B0',
  darkText:  '#1A1A1A',
  subText:   '#666666',
};

// ─── Presets (aspect ratios expressed as { w, h } fractions) ─────────────────
interface Preset {
  label: string;
  icon: string;
  region: CropRegion;
}
const PRESETS: Preset[] = [
  { label: 'Full',   icon: '⬜', region: { x: 1,  y: 1,  w: 98, h: 98 } },
  { label: 'A4',     icon: '📄', region: { x: 5,  y: 1,  w: 90, h: 98 } },
  { label: 'Letter', icon: '📃', region: { x: 5,  y: 2,  w: 90, h: 96 } },
  { label: 'Square', icon: '◻️', region: { x: 10, y: 10, w: 80, h: 80 } },
  { label: 'ID',     icon: '🪪', region: { x: 15, y: 20, w: 70, h: 60 } },
];

// ─── Props ────────────────────────────────────────────────────────────────────

interface CropModalProps {
  scanner: UseDocumentScannerReturn;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function CropModal({ scanner }: CropModalProps) {
  const {
    cropModalVisible,
    cropImageSrc,
    cropRegion,
    autoDetecting,
    setCropRegion,
    handleAutoCrop,
    handleCropConfirm,
    handleCropSkip,
  } = scanner;

  const [showCustomInputs, setShowCustomInputs] = useState(false);

  // Local string states for the numeric inputs
  const [inputX, setInputX] = useState('');
  const [inputY, setInputY] = useState('');
  const [inputW, setInputW] = useState('');
  const [inputH, setInputH] = useState('');

  const applyCustomInputs = useCallback(() => {
    const x = parseFloat(inputX);
    const y = parseFloat(inputY);
    const w = parseFloat(inputW);
    const h = parseFloat(inputH);
    if (
      [x, y, w, h].every((v) => !isNaN(v) && v >= 0 && v <= 100) &&
      x + w <= 100 &&
      y + h <= 100
    ) {
      setCropRegion({ x, y, w, h });
    }
  }, [inputX, inputY, inputW, inputH, setCropRegion]);

  const syncInputsFromRegion = useCallback((r: CropRegion) => {
    setInputX(r.x.toFixed(1));
    setInputY(r.y.toFixed(1));
    setInputW(r.w.toFixed(1));
    setInputH(r.h.toFixed(1));
  }, []);

  if (!cropImageSrc) return null;

  return (
    <Modal
      visible={cropModalVisible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleCropSkip}
    >
      <View style={s.root}>
        {/* ── Header ── */}
        <View style={s.header}>
          <Text style={s.headerTitle}>✂️ Crop Document</Text>
          <TouchableOpacity style={s.skipBtn} onPress={handleCropSkip}>
            <Text style={s.skipBtnText}>Skip</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={s.body}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* ── Crop editor ── */}
          <View style={s.editorWrap}>
            <CropEditor
              imageUri={cropImageSrc}
              region={cropRegion}
              onChange={setCropRegion}
            />
          </View>

          {/* ── Region info ── */}
          <View style={s.regionInfo}>
            <Text style={s.regionInfoText}>
              X: {cropRegion.x.toFixed(1)}%  Y: {cropRegion.y.toFixed(1)}%  ·  
              W: {cropRegion.w.toFixed(1)}%  H: {cropRegion.h.toFixed(1)}%
            </Text>
          </View>

          {/* ── Preset buttons row ── */}
          <View style={s.presetRow}>
            <Text style={s.presetLabel}>Preset:</Text>

            {/* Auto detect */}
            <TouchableOpacity
              style={[s.presetBtn, s.autoDetectBtn]}
              onPress={() => handleAutoCrop(false)}
              disabled={autoDetecting}
              activeOpacity={0.8}
            >
              {autoDetecting ? (
                <ActivityIndicator size="small" color={C.white} />
              ) : (
                <Text style={[s.presetBtnText, s.autoDetectBtnText]}>🔍 Auto</Text>
              )}
            </TouchableOpacity>

            {/* Fixed presets */}
            {PRESETS.map((p) => (
              <TouchableOpacity
                key={p.label}
                style={s.presetBtn}
                onPress={() => setCropRegion(p.region)}
                activeOpacity={0.8}
              >
                <Text style={s.presetBtnText}>{p.icon} {p.label}</Text>
              </TouchableOpacity>
            ))}

            {/* Toggle custom inputs */}
            <TouchableOpacity
              style={[s.presetBtn, showCustomInputs && s.presetBtnActive]}
              onPress={() => {
                setShowCustomInputs((v) => {
                  if (!v) syncInputsFromRegion(cropRegion);
                  return !v;
                });
              }}
              activeOpacity={0.8}
            >
              <Text style={[s.presetBtnText, showCustomInputs && s.presetBtnTextActive]}>
                🔢 Custom
              </Text>
            </TouchableOpacity>
          </View>

          {/* ── Custom numeric inputs ── */}
          {showCustomInputs && (
            <View style={s.customBox}>
              <Text style={s.customBoxTitle}>Manual crop region (% values, 0–100)</Text>
              <View style={s.customRow}>
                {([['X', inputX, setInputX], ['Y', inputY, setInputY],
                   ['W', inputW, setInputW], ['H', inputH, setInputH]] as const).map(
                  ([label, val, setter]) => (
                    <View key={label} style={s.customItem}>
                      <Text style={s.customLabel}>{label}</Text>
                      <TextInput
                        style={s.customInput}
                        value={val}
                        onChangeText={setter as (v: string) => void}
                        keyboardType="decimal-pad"
                        placeholder="0"
                        placeholderTextColor={C.midGray}
                        onBlur={applyCustomInputs}
                        returnKeyType="done"
                        onSubmitEditing={applyCustomInputs}
                      />
                    </View>
                  ),
                )}
              </View>
              <Text style={s.customHint}>
                Drag the handles above or type values here, then tap Apply.
              </Text>
              <TouchableOpacity style={s.applyBtn} onPress={applyCustomInputs} activeOpacity={0.8}>
                <Text style={s.applyBtnText}>Apply</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* ── Bottom spacer ── */}
          <View style={{ height: 120 }} />
        </ScrollView>

        {/* ── Fixed action bar ── */}
        <View style={s.actionBar}>
          <TouchableOpacity style={s.autoConfirmBtn} onPress={() => handleAutoCrop(true)} disabled={autoDetecting} activeOpacity={0.8}>
            {autoDetecting ? (
              <ActivityIndicator color={C.white} />
            ) : (
              <Text style={s.autoConfirmBtnText}>🔍 Auto-crop & Add</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity style={s.confirmBtn} onPress={handleCropConfirm} activeOpacity={0.8}>
            <Text style={s.confirmBtnText}>✓ Confirm Crop</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.offWhite },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: C.navy,
    paddingHorizontal: 20,
    paddingVertical: 16,
    paddingTop: 50,
  },
  headerTitle: { fontSize: 18, fontWeight: '800', color: C.white },
  skipBtn:     { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.2)' },
  skipBtnText: { fontSize: 13, color: C.white, fontWeight: '700' },

  body: { padding: 16, paddingBottom: 20 },

  editorWrap: {
    width: '100%',
    borderRadius: 10,
    overflow: 'hidden',
    marginBottom: 10,
    backgroundColor: '#000',
    minHeight: 260,
  },

  regionInfo: {
    backgroundColor: C.offWhite,
    borderRadius: 8,
    padding: 8,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: C.lightGray,
  },
  regionInfoText: { fontSize: 11, color: C.subText, textAlign: 'center' },

  presetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
  },
  presetLabel:       { fontSize: 12, fontWeight: '700', color: C.darkText },
  presetBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: C.lightGray,
    backgroundColor: C.white,
  },
  presetBtnActive:     { backgroundColor: C.navy, borderColor: C.navy },
  presetBtnText:       { fontSize: 11, fontWeight: '600', color: C.subText },
  presetBtnTextActive: { color: C.white, fontWeight: '800' },
  autoDetectBtn:     { backgroundColor: C.navy, borderColor: C.navy, paddingHorizontal: 10 },
  autoDetectBtnText: { fontSize: 11, fontWeight: '700', color: C.white },

  customBox: {
    backgroundColor: '#EEF3FB',
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: C.navy + '33',
  },
  customBoxTitle: { fontSize: 12, fontWeight: '700', color: C.navy, marginBottom: 10 },
  customRow:      { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginBottom: 8 },
  customItem:     { flex: 1, minWidth: 60, alignItems: 'center' },
  customLabel:    { fontSize: 10, fontWeight: '600', color: C.subText, marginBottom: 4 },
  customInput: {
    width: '100%',
    backgroundColor: C.white,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: C.navy + '55',
    paddingVertical: 6,
    paddingHorizontal: 8,
    fontSize: 14,
    fontWeight: '700',
    color: C.navy,
    textAlign: 'center',
  },
  customHint: { fontSize: 10, color: C.midGray, textAlign: 'center', marginBottom: 8 },
  applyBtn: {
    backgroundColor: C.navy,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  applyBtnText: { fontSize: 13, fontWeight: '800', color: C.white },

  actionBar: {
    flexDirection: 'row',
    gap: 10,
    padding: 16,
    backgroundColor: C.white,
    borderTopWidth: 1,
    borderTopColor: C.lightGray,
  },
  autoConfirmBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    backgroundColor: '#4A70A8',
  },
  autoConfirmBtnText: { fontSize: 13, fontWeight: '700', color: C.white },
  confirmBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    backgroundColor: C.gold,
  },
  confirmBtnText: { fontSize: 13, fontWeight: '800', color: C.navy },
});

export default CropModal;
