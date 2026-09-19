/**
 * CropModal.tsx
 * Full-screen crop modal — professional pop-in design.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated, Dimensions,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { CropEditor } from './CropEditor';
import type { CropRegion, UseDocumentScannerReturn } from './useDocumentScanner';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

const C = {
  navy:      '#133E75',
  gold:      '#E8C547',
  goldLight: 'rgba(232,197,71,0.15)',
  white:     '#FFFFFF',
  offWhite:  '#F7F5F2',
  lightGray: '#ECECEC',
  midGray:   '#B0B0B0',
  darkText:  '#1A1A1A',
  subText:   '#666666',
  overlay:   'rgba(8,18,40,0.72)',
};

interface Preset { label: string; icon: string; region: CropRegion; }
const PRESETS: Preset[] = [
  { label: 'Full',   icon: '⬜', region: { x: 1,  y: 1,  w: 98, h: 98 } },
  { label: 'A4',     icon: '📄', region: { x: 5,  y: 1,  w: 90, h: 98 } },
  { label: 'Letter', icon: '📃', region: { x: 5,  y: 2,  w: 90, h: 96 } },
  { label: 'Square', icon: '◻️', region: { x: 10, y: 10, w: 80, h: 80 } },
  { label: 'ID',     icon: '🪪', region: { x: 15, y: 20, w: 70, h: 60 } },
];

interface CropModalProps { scanner: UseDocumentScannerReturn; }

export function CropModal({ scanner }: CropModalProps) {
  const {
    cropModalVisible, cropImageSrc, cropRegion, cropCorners, autoDetecting,
    setCropRegion, setCropCorners, handleAutoCrop, handleCropConfirm, handleCropSkip,
  } = scanner;

  const [showCustomInputs, setShowCustomInputs] = useState(false);
  const [inputX, setInputX] = useState('');
  const [inputY, setInputY] = useState('');
  const [inputW, setInputW] = useState('');
  const [inputH, setInputH] = useState('');

  // ── Pop-in animation ──────────────────────────────────────────────────────
  const scale   = useRef(new Animated.Value(0.88)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (cropModalVisible) {
      scale.setValue(0.88);
      opacity.setValue(0);
      Animated.parallel([
        Animated.spring(scale, {
          toValue: 1, tension: 220, friction: 20, useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1, duration: 200, useNativeDriver: true,
        }),
      ]).start();
    }
  }, [cropModalVisible]);

  const applyCustomInputs = useCallback(() => {
    const x = parseFloat(inputX), y = parseFloat(inputY);
    const w = parseFloat(inputW), h = parseFloat(inputH);
    if ([x, y, w, h].every((v) => !isNaN(v) && v >= 0 && v <= 100) && x + w <= 100 && y + h <= 100) {
      setCropRegion({ x, y, w, h });
    }
  }, [inputX, inputY, inputW, inputH, setCropRegion]);

  const syncInputsFromRegion = useCallback((r: CropRegion) => {
    setInputX(r.x.toFixed(1)); setInputY(r.y.toFixed(1));
    setInputW(r.w.toFixed(1)); setInputH(r.h.toFixed(1));
  }, []);

  if (!cropImageSrc) return null;

  return (
    <Modal
      visible={cropModalVisible}
      animationType="none"
      transparent
      onRequestClose={handleCropSkip}
    >
      <View style={s.overlay}>
        <Animated.View style={[s.sheet, { transform: [{ scale }], opacity }]}>

          {/* ── Gold accent bar ── */}
          <View style={s.accentBar} />

          {/* ── Header ── */}
          <View style={s.header}>
            <View style={s.headerLeft}>
              <View style={s.headerIconWrap}>
                <Text style={s.headerIconText}>✂️</Text>
              </View>
              <View>
                <Text style={s.headerTitle}>Crop Document</Text>
                <Text style={s.headerSub}>Drag handles to adjust the crop area</Text>
              </View>
            </View>
            <TouchableOpacity style={s.skipBtn} onPress={handleCropSkip} activeOpacity={0.7}>
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
                imageUri={cropImageSrc || ''}
                region={cropRegion}
                corners={cropCorners}
                onChange={setCropRegion}
                onCornersChange={setCropCorners}
              />
            </View>

            {/* ── Region info pill ── */}
            <View style={s.regionInfo}>
              <Text style={s.regionInfoLabel}>REGION</Text>
              <Text style={s.regionInfoText}>
                X {cropRegion.x.toFixed(1)}%  ·  Y {cropRegion.y.toFixed(1)}%  ·  {cropRegion.w.toFixed(1)} × {cropRegion.h.toFixed(1)}%
              </Text>
            </View>

            {/* ── Preset row ── */}
            <View style={s.sectionCard}>
              <Text style={s.sectionTitle}>PRESETS</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.presetRow}>
                {/* Auto detect */}
                <TouchableOpacity
                  style={[s.presetBtn, s.autoDetectBtn]}
                  onPress={() => handleAutoCrop(false)}
                  disabled={autoDetecting}
                  activeOpacity={0.8}
                >
                  {autoDetecting
                    ? <ActivityIndicator size="small" color={C.white} />
                    : <Text style={s.autoDetectBtnText}>🔍 Auto</Text>
                  }
                </TouchableOpacity>

                {PRESETS.map((p) => (
                  <TouchableOpacity
                    key={p.label}
                    style={s.presetBtn}
                    onPress={() => {
                      setCropRegion(p.region);
                      // Also reset corners to match the rectangular preset
                      setCropCorners({
                        tl: { x: p.region.x, y: p.region.y },
                        tr: { x: p.region.x + p.region.w, y: p.region.y },
                        br: { x: p.region.x + p.region.w, y: p.region.y + p.region.h },
                        bl: { x: p.region.x, y: p.region.y + p.region.h },
                      });
                    }}
                    activeOpacity={0.8}
                  >
                    <Text style={s.presetBtnText}>{p.icon}  {p.label}</Text>
                  </TouchableOpacity>
                ))}

                {/* Custom toggle */}
                <TouchableOpacity
                  style={[s.presetBtn, showCustomInputs && s.presetBtnActive]}
                  onPress={() => {
                    setShowCustomInputs((v) => { if (!v) syncInputsFromRegion(cropRegion); return !v; });
                  }}
                  activeOpacity={0.8}
                >
                  <Text style={[s.presetBtnText, showCustomInputs && s.presetBtnTextActive]}>
                    🔢 Custom
                  </Text>
                </TouchableOpacity>
              </ScrollView>
            </View>

            {/* ── Custom inputs ── */}
            {showCustomInputs && (
              <View style={s.customBox}>
                <Text style={s.customBoxTitle}>MANUAL CROP VALUES  (0–100%)</Text>
                <View style={s.customRow}>
                  {([['X', inputX, setInputX], ['Y', inputY, setInputY],
                     ['W', inputW, setInputW], ['H', inputH, setInputH]] as const).map(([label, val, setter]) => (
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
                  ))}
                </View>
                <TouchableOpacity style={s.applyBtn} onPress={applyCustomInputs} activeOpacity={0.8}>
                  <Text style={s.applyBtnText}>Apply Values</Text>
                </TouchableOpacity>
              </View>
            )}

            <View style={{ height: 20 }} />
          </ScrollView>

          {/* ── Action bar ── */}
          <View style={s.actionBar}>
            <TouchableOpacity
              style={s.autoConfirmBtn}
              onPress={() => handleAutoCrop(true)}
              disabled={autoDetecting}
              activeOpacity={0.85}
            >
              {autoDetecting
                ? <ActivityIndicator color={C.white} />
                : <Text style={s.autoConfirmBtnText}>🔍  Auto-crop & Add</Text>
              }
            </TouchableOpacity>
            <TouchableOpacity style={s.confirmBtn} onPress={handleCropConfirm} activeOpacity={0.85}>
              <Text style={s.confirmBtnText}>✓  Confirm Crop</Text>
            </TouchableOpacity>
          </View>

        </Animated.View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: C.overlay,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sheet: {
    // See ScanModal.tsx: `height` (not just maxHeight) is required so the
    // flex:1 ScrollView below has a definite parent height to expand into
    // on native — otherwise Yoga resolves it to 0 and the body vanishes.
    width: '94%',
    maxWidth: 520,
    height: SCREEN_HEIGHT * 0.9,
    backgroundColor: C.offWhite,
    borderRadius: 22,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 24 },
    shadowOpacity: 0.4,
    shadowRadius: 40,
    elevation: 30,
  },

  accentBar: { height: 4, backgroundColor: C.gold },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: C.navy, paddingHorizontal: 20, paddingVertical: 16,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerIconWrap: {
    width: 38, height: 38, borderRadius: 10,
    backgroundColor: C.goldLight,
    borderWidth: 1.5, borderColor: C.gold,
    alignItems: 'center', justifyContent: 'center',
  },
  headerIconText: { fontSize: 18 },
  headerTitle: { fontSize: 16, fontWeight: '800', color: C.white },
  headerSub:   { fontSize: 10, color: 'rgba(255,255,255,0.5)', marginTop: 1 },
  skipBtn: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)',
  },
  skipBtnText: { fontSize: 12, color: C.white, fontWeight: '700' },

  body: { padding: 16, paddingBottom: 12 },

  editorWrap: {
    borderRadius: 12, overflow: 'hidden', marginBottom: 10,
    backgroundColor: '#000', minHeight: 240,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2, shadowRadius: 8, elevation: 5,
  },

  regionInfo: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: C.white, borderRadius: 10, padding: 10,
    marginBottom: 12,
    borderWidth: 1, borderColor: C.lightGray,
  },
  regionInfoLabel: {
    fontSize: 9, fontWeight: '900', color: C.navy,
    letterSpacing: 0.8, backgroundColor: C.goldLight,
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4,
  },
  regionInfoText: { fontSize: 11, color: C.subText, fontWeight: '600' },

  sectionCard: {
    backgroundColor: C.white, borderRadius: 14,
    padding: 14, marginBottom: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  sectionTitle: {
    fontSize: 10, fontWeight: '900', color: C.navy,
    letterSpacing: 0.8, marginBottom: 10,
  },

  presetRow: { flexDirection: 'row', gap: 8, paddingBottom: 2 },
  presetBtn: {
    paddingVertical: 7, paddingHorizontal: 13, borderRadius: 20,
    borderWidth: 1.5, borderColor: C.lightGray, backgroundColor: C.offWhite,
  },
  presetBtnActive:     { backgroundColor: C.navy, borderColor: C.navy },
  presetBtnText:       { fontSize: 11, fontWeight: '600', color: C.subText },
  presetBtnTextActive: { color: C.white, fontWeight: '800' },
  autoDetectBtn:       { backgroundColor: C.navy, borderColor: C.navy, minWidth: 80, alignItems: 'center' },
  autoDetectBtnText:   { fontSize: 11, fontWeight: '700', color: C.white },

  customBox: {
    backgroundColor: '#EEF3FB', borderRadius: 12, padding: 14,
    marginBottom: 10, borderWidth: 1, borderColor: C.navy + '28',
  },
  customBoxTitle: { fontSize: 10, fontWeight: '900', color: C.navy, letterSpacing: 0.6, marginBottom: 12 },
  customRow:      { flexDirection: 'row', gap: 8, marginBottom: 12 },
  customItem:     { flex: 1, alignItems: 'center' },
  customLabel:    { fontSize: 10, fontWeight: '700', color: C.subText, marginBottom: 4 },
  customInput: {
    width: '100%', backgroundColor: C.white, borderRadius: 8,
    borderWidth: 1.5, borderColor: C.navy + '44',
    paddingVertical: 8, paddingHorizontal: 6,
    fontSize: 14, fontWeight: '700', color: C.navy, textAlign: 'center',
  },
  applyBtn: {
    backgroundColor: C.navy, borderRadius: 8,
    paddingVertical: 10, alignItems: 'center',
  },
  applyBtnText: { fontSize: 13, fontWeight: '800', color: C.white },

  actionBar: {
    flexDirection: 'row', gap: 10, padding: 16,
    backgroundColor: C.white,
    borderTopWidth: 1.5, borderTopColor: C.lightGray,
  },
  autoConfirmBtn: {
    flex: 1, paddingVertical: 14, borderRadius: 10,
    alignItems: 'center', backgroundColor: '#3A6098',
    shadowColor: '#3A6098', shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25, shadowRadius: 6, elevation: 3,
  },
  autoConfirmBtnText: { fontSize: 13, fontWeight: '700', color: C.white },
  confirmBtn: {
    flex: 1, paddingVertical: 14, borderRadius: 10,
    alignItems: 'center', backgroundColor: C.gold,
    shadowColor: C.gold, shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3, shadowRadius: 6, elevation: 3,
  },
  confirmBtnText: { fontSize: 13, fontWeight: '800', color: C.navy },
});

export default CropModal;