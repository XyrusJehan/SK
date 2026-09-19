/**
 * ScanModal.tsx
 * Full-screen scan session modal — professional pop-in design.
 * Features: image preview on tap, reorder pages via ◀ ▶ buttons.
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Image,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import type { FilterMode, ScannedPage, UseDocumentScannerReturn } from './useDocumentScanner';

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('window');

const C = {
  navy:      '#133E75',
  navyDark:  '#0D2B54',
  navyLight: '#1A4E8A',
  gold:      '#E8C547',
  goldLight: 'rgba(232,197,71,0.15)',
  white:     '#FFFFFF',
  offWhite:  '#F7F5F2',
  lightGray: '#ECECEC',
  midGray:   '#B0B0B0',
  darkText:  '#1A1A1A',
  subText:   '#666666',
  overlay:   'rgba(8,18,40,0.72)',
  overlayDeep: 'rgba(4,10,24,0.92)',
};

interface ScanModalProps {
  scanner: UseDocumentScannerReturn;
  onPdfReady: (file: { uri: string; name: string; type: string; size: number | null }) => void;
}

// ─── Page Preview Modal ────────────────────────────────────────────────────────

interface PagePreviewProps {
  page: ScannedPage | null;
  pageIndex: number;
  totalPages: number;
  visible: boolean;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
  onRemove: () => void;
}

function PagePreviewModal({ page, pageIndex, totalPages, visible, onClose, onPrev, onNext, onRemove }: PagePreviewProps) {
  const scaleAnim = useRef(new Animated.Value(0.9)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      scaleAnim.setValue(0.9);
      opacityAnim.setValue(0);
      Animated.parallel([
        Animated.spring(scaleAnim, { toValue: 1, tension: 250, friction: 22, useNativeDriver: true }),
        Animated.timing(opacityAnim, { toValue: 1, duration: 160, useNativeDriver: true }),
      ]).start();
    }
  }, [visible, page]);

  if (!page) return null;

  const filterLabel: Record<string, string> = { none: 'Color', grayscale: 'Grayscale', bw: 'B&W', document: 'Document' };

  return (
    <Modal visible={visible} animationType="none" transparent onRequestClose={onClose}>
      <View style={ps.overlay}>
        <Animated.View style={[ps.sheet, { transform: [{ scale: scaleAnim }], opacity: opacityAnim }]}>

          {/* Header */}
          <View style={ps.header}>
            <View style={ps.headerLeft}>
              <Text style={ps.headerTitle}>Page {pageIndex + 1}</Text>
              <View style={ps.filterBadge}>
                <Text style={ps.filterBadgeText}>{filterLabel[page.filter] || page.filter}</Text>
              </View>
            </View>
            <View style={ps.headerRight}>
              <Text style={ps.headerCount}>{pageIndex + 1} / {totalPages}</Text>
              <TouchableOpacity style={ps.closeBtn} onPress={onClose} activeOpacity={0.7}>
                <Text style={ps.closeBtnText}>✕</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Image */}
          <View style={ps.imageWrap}>
            <Image source={{ uri: page.dataUrl }} style={ps.image} resizeMode="contain" />
          </View>

          {/* Nav + actions */}
          <View style={ps.footer}>
            <TouchableOpacity
              style={[ps.navBtn, pageIndex === 0 && ps.navBtnDisabled]}
              onPress={onPrev}
              disabled={pageIndex === 0}
              activeOpacity={0.8}
            >
              <Text style={ps.navBtnText}>◀</Text>
            </TouchableOpacity>

            <TouchableOpacity style={ps.removeBtn} onPress={onRemove} activeOpacity={0.8}>
              <Text style={ps.removeBtnText}>🗑  Remove Page</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[ps.navBtn, pageIndex === totalPages - 1 && ps.navBtnDisabled]}
              onPress={onNext}
              disabled={pageIndex === totalPages - 1}
              activeOpacity={0.8}
            >
              <Text style={ps.navBtnText}>▶</Text>
            </TouchableOpacity>
          </View>

        </Animated.View>
      </View>
    </Modal>
  );
}

const ps = StyleSheet.create({
  overlay: {
    flex: 1, backgroundColor: C.overlayDeep,
    justifyContent: 'center', alignItems: 'center',
  },
  sheet: {
    width: '92%', maxWidth: 440,
    backgroundColor: C.navyDark,
    borderRadius: 20, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.6, shadowRadius: 40, elevation: 40,
    borderWidth: 1, borderColor: 'rgba(232,197,71,0.3)',
  },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 18, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerTitle: { fontSize: 16, fontWeight: '800', color: C.white },
  filterBadge: {
    backgroundColor: 'rgba(232,197,71,0.18)', borderRadius: 6,
    paddingHorizontal: 8, paddingVertical: 3,
    borderWidth: 1, borderColor: 'rgba(232,197,71,0.4)',
  },
  filterBadgeText: { fontSize: 10, fontWeight: '700', color: C.gold },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerCount: { fontSize: 12, color: 'rgba(255,255,255,0.45)', fontWeight: '600' },
  closeBtn: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center', justifyContent: 'center',
  },
  closeBtnText: { fontSize: 12, color: C.white, fontWeight: '700' },
  imageWrap: {
    backgroundColor: '#000',
    minHeight: 320,
    maxHeight: SCREEN_HEIGHT * 0.55,
    alignItems: 'center', justifyContent: 'center',
  },
  image: { width: '100%', height: SCREEN_HEIGHT * 0.52 },
  footer: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    padding: 14, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)',
  },
  navBtn: {
    width: 44, height: 44, borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
  },
  navBtnDisabled: { opacity: 0.3 },
  navBtnText: { fontSize: 16, color: C.white, fontWeight: '700' },
  removeBtn: {
    flex: 1, paddingVertical: 12, borderRadius: 10,
    backgroundColor: 'rgba(220,50,50,0.2)',
    borderWidth: 1, borderColor: 'rgba(220,50,50,0.4)',
    alignItems: 'center',
  },
  removeBtnText: { fontSize: 13, fontWeight: '700', color: '#FF6B6B' },
});

// ─── Main ScanModal ────────────────────────────────────────────────────────────

export function ScanModal({ scanner, onPdfReady }: ScanModalProps) {
  const {
    pages, scanning, convertingToPdf, scanModalVisible, filterMode,
    webCameraInputRef, webGalleryInputRef,
    closeScanModal, removePage, reorderPages, addCameraCapture, addFromGallery,
    compileToPdf, setFilterMode, handleWebFileInput,
  } = scanner;

  // ── Pop-in animation ──────────────────────────────────────────────────────
  const scale   = useRef(new Animated.Value(0.88)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (scanModalVisible) {
      scale.setValue(0.88);
      opacity.setValue(0);
      Animated.parallel([
        Animated.spring(scale, { toValue: 1, tension: 220, friction: 20, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    }
  }, [scanModalVisible]);

  // ── Preview state ─────────────────────────────────────────────────────────
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const previewPage = previewIndex !== null ? pages[previewIndex] ?? null : null;

  const openPreview = (idx: number) => setPreviewIndex(idx);
  const closePreview = () => setPreviewIndex(null);
  const prevPage = () => setPreviewIndex((i) => (i !== null && i > 0 ? i - 1 : i));
  const nextPage = () => setPreviewIndex((i) => (i !== null && i < pages.length - 1 ? i + 1 : i));
  const removePreviewPage = () => {
    if (previewIndex === null) return;
    const id = pages[previewIndex].id;
    removePage(id);
    if (previewIndex >= pages.length - 1) {
      setPreviewIndex(pages.length > 1 ? pages.length - 2 : null);
    }
    if (pages.length <= 1) closePreview();
  };

  // ── Reorder helpers ───────────────────────────────────────────────────────
  const moveLeft  = (idx: number) => { if (idx > 0) reorderPages(idx, idx - 1); };
  const moveRight = (idx: number) => { if (idx < pages.length - 1) reorderPages(idx, idx + 1); };

  const handleCreatePdf = async () => {
    const file = await compileToPdf();
    if (file) { closeScanModal(); onPdfReady(file); }
  };

  const filterOptions: { label: string; value: FilterMode; icon: string }[] = [
    { label: 'Color',  value: 'none',      icon: '🎨' },
    { label: 'Gray',   value: 'grayscale', icon: '◑'  },
    { label: 'B&W',    value: 'bw',        icon: '◼'  },
  ];

  const STEPS = [
    { icon: '📷', label: 'Capture', num: '1' },
    { icon: '✂️',  label: 'Crop',    num: '2' },
    { icon: '📑', label: 'PDF',     num: '3' },
  ];

  return (
    <>
      <Modal
        visible={scanModalVisible}
        animationType="none"
        transparent
        onRequestClose={closeScanModal}
      >
        <View style={s.overlay}>
          <Animated.View style={[s.sheet, { transform: [{ scale }], opacity }]}>

            {/* ── Gold accent bar ── */}
            <View style={s.accentBar} />

            {/* ── Header ── */}
            <View style={s.header}>
              <View style={s.headerLeft}>
                <View style={s.headerIconWrap}>
                  <Text style={s.headerIconText}>📄</Text>
                </View>
                <View>
                  <Text style={s.headerTitle}>Document Scanner</Text>
                  <Text style={s.headerSub}>Capture · Crop · Export PDF</Text>
                </View>
              </View>
              <TouchableOpacity style={s.closeBtn} onPress={closeScanModal} activeOpacity={0.7}>
                <Text style={s.closeBtnText}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={s.body}
              showsVerticalScrollIndicator={false}
            >
              {/* ── Step progress ── */}
              <View style={s.stepsRow}>
                {STEPS.map((step, i) => (
                  <React.Fragment key={step.label}>
                    <View style={s.stepItem}>
                      <View style={s.stepBubble}>
                        <Text style={s.stepNum}>{step.num}</Text>
                      </View>
                      <Text style={s.stepIcon}>{step.icon}</Text>
                      <Text style={s.stepLabel}>{step.label}</Text>
                    </View>
                    {i < 2 && (
                      <View style={s.stepConnector}>
                        <View style={s.stepConnectorLine} />
                      </View>
                    )}
                  </React.Fragment>
                ))}
              </View>

              {/* ── Filter selector ── */}
              <View style={s.sectionCard}>
                <Text style={s.sectionTitle}>IMAGE FILTER</Text>
                <View style={s.filterRow}>
                  {filterOptions.map((opt) => {
                    const active = filterMode === opt.value;
                    return (
                      <TouchableOpacity
                        key={opt.value}
                        style={[s.filterBtn, active && s.filterBtnActive]}
                        onPress={() => setFilterMode(opt.value)}
                        activeOpacity={0.8}
                      >
                        <Text style={s.filterBtnIcon}>{opt.icon}</Text>
                        <Text style={[s.filterBtnText, active && s.filterBtnTextActive]}>
                          {opt.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* ── Page thumbnails ── */}
              {pages.length > 0 && (
                <View style={s.sectionCard}>
                  <View style={s.sectionTitleRow}>
                    <Text style={s.sectionTitle}>CAPTURED PAGES</Text>
                    <View style={s.pageBadge}>
                      <Text style={s.pageBadgeText}>{pages.length}</Text>
                    </View>
                    <Text style={s.pageHint}>Tap to preview  ·  Use ◀ ▶ to reorder</Text>
                  </View>

                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={s.pagesRow}
                  >
                    {pages.map((page, idx) => (
                      <View key={page.id} style={s.pageCard}>
                        {/* Thumbnail — tap to preview */}
                        <TouchableOpacity
                          style={s.pageThumb}
                          onPress={() => openPreview(idx)}
                          activeOpacity={0.85}
                        >
                          <Image source={{ uri: page.dataUrl }} style={s.pageThumbImg} resizeMode="cover" />

                          {/* Hover/tap overlay hint */}
                          <View style={s.pagePreviewHint}>
                            <Text style={s.pagePreviewHintIcon}>🔍</Text>
                          </View>

                          {/* Page number label */}
                          <View style={s.pageLabel}>
                            <Text style={s.pageLabelText}>p.{idx + 1}</Text>
                          </View>

                          {/* Remove button */}
                          <TouchableOpacity
                            style={s.pageRemoveBtn}
                            onPress={() => removePage(page.id)}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          >
                            <Text style={s.pageRemoveText}>✕</Text>
                          </TouchableOpacity>
                        </TouchableOpacity>

                        {/* Reorder controls */}
                        <View style={s.reorderRow}>
                          <TouchableOpacity
                            style={[s.reorderBtn, idx === 0 && s.reorderBtnDisabled]}
                            onPress={() => moveLeft(idx)}
                            disabled={idx === 0}
                            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                          >
                            <Text style={[s.reorderBtnText, idx === 0 && s.reorderBtnTextDisabled]}>◀</Text>
                          </TouchableOpacity>

                          <View style={s.reorderDots}>
                            <Text style={s.reorderDotsText}>⠿</Text>
                          </View>

                          <TouchableOpacity
                            style={[s.reorderBtn, idx === pages.length - 1 && s.reorderBtnDisabled]}
                            onPress={() => moveRight(idx)}
                            disabled={idx === pages.length - 1}
                            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                          >
                            <Text style={[s.reorderBtnText, idx === pages.length - 1 && s.reorderBtnTextDisabled]}>▶</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    ))}
                  </ScrollView>
                </View>
              )}

              {/* ── Capture buttons ── */}
              <View style={s.actionRow}>
                <TouchableOpacity
                  style={[s.actionBtn, s.cameraBtn]}
                  onPress={addCameraCapture}
                  activeOpacity={0.85}
                  disabled={scanning}
                >
                  {scanning ? (
                    <ActivityIndicator color={C.white} size="small" />
                  ) : (
                    <>
                      <Text style={s.actionBtnIcon}>📷</Text>
                      <Text style={s.actionBtnText}>Camera</Text>
                      <Text style={s.actionBtnSub}>Take a photo</Text>
                    </>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={[s.actionBtn, s.galleryBtn]}
                  onPress={addFromGallery}
                  activeOpacity={0.85}
                  disabled={scanning}
                >
                  <Text style={s.actionBtnIcon}>🖼️</Text>
                  <Text style={[s.actionBtnText, { color: C.navy }]}>Gallery</Text>
                  <Text style={[s.actionBtnSub, { color: C.subText }]}>Import image</Text>
                </TouchableOpacity>
              </View>

              {/* ── Empty hint ── */}
              {pages.length === 0 && !scanning && (
                <View style={s.emptyHint}>
                  <Text style={s.emptyHintIcon}>📭</Text>
                  <Text style={s.emptyHintText}>No pages yet</Text>
                  <Text style={s.emptyHintSub}>Use Camera or Gallery above to add your first page.</Text>
                </View>
              )}

              {/* ── Instruction ── */}
              <View style={s.instructionBox}>
                <View style={s.instructionDot} />
                <Text style={s.instructionText}>
                  After each capture, adjust the crop handles to frame your document, then confirm.
                  Tap any thumbnail to preview it full-size, or use ◀ ▶ to reorder pages.
                </Text>
              </View>

            </ScrollView>

            {/* ── Create PDF footer ── */}
            {pages.length > 0 && (
              <View style={s.footer}>
                <TouchableOpacity
                  style={[s.pdfBtn, convertingToPdf && s.pdfBtnDisabled]}
                  onPress={handleCreatePdf}
                  activeOpacity={0.85}
                  disabled={convertingToPdf}
                >
                  {convertingToPdf ? (
                    <ActivityIndicator color={C.navy} />
                  ) : (
                    <>
                      <Text style={s.pdfBtnIcon}>📑</Text>
                      <Text style={s.pdfBtnText}>
                        Create PDF & Upload  ·  {pages.length} page{pages.length > 1 ? 's' : ''}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            )}

          </Animated.View>

          {/* ── Hidden web inputs ── */}
          {Platform.OS === 'web' && (
            <>
              <input
                ref={webCameraInputRef as React.RefObject<HTMLInputElement>}
                type="file" accept="image/*" capture="environment"
                style={{ display: 'none' }}
                onChange={handleWebFileInput as any}
              />
              <input
                ref={webGalleryInputRef as React.RefObject<HTMLInputElement>}
                type="file" accept="image/*" multiple
                style={{ display: 'none' }}
                onChange={handleWebFileInput as any}
              />
            </>
          )}
        </View>
      </Modal>

      {/* ── Page Preview Modal (rendered outside main modal to avoid z-index issues) ── */}
      <PagePreviewModal
        page={previewPage}
        pageIndex={previewIndex ?? 0}
        totalPages={pages.length}
        visible={previewIndex !== null}
        onClose={closePreview}
        onPrev={prevPage}
        onNext={nextPage}
        onRemove={removePreviewPage}
      />
    </>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  overlay: {
    flex: 1, backgroundColor: C.overlay,
    justifyContent: 'center', alignItems: 'center',
  },
  sheet: {
    // `height` (not just maxHeight) is required: the ScrollView below uses
    // flex:1, and on native a flex child inside a parent with no definite
    // height resolves to 0 — the body silently disappears, leaving only the
    // header visible. Web doesn't hit this because browser flexbox sizes
    // flex children by content when the parent has no set height.
    width: '94%', maxWidth: 520, height: SCREEN_HEIGHT * 0.88,
    backgroundColor: C.offWhite, borderRadius: 22, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 24 },
    shadowOpacity: 0.4, shadowRadius: 40, elevation: 30,
  },
  accentBar: { height: 4, backgroundColor: C.gold },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: C.navy, paddingHorizontal: 20, paddingVertical: 16,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerIconWrap: {
    width: 38, height: 38, borderRadius: 10,
    backgroundColor: C.goldLight, borderWidth: 1.5, borderColor: C.gold,
    alignItems: 'center', justifyContent: 'center',
  },
  headerIconText: { fontSize: 18 },
  headerTitle: { fontSize: 16, fontWeight: '800', color: C.white },
  headerSub:   { fontSize: 10, color: 'rgba(255,255,255,0.5)', marginTop: 1 },
  closeBtn: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
  closeBtnText: { fontSize: 13, color: C.white, fontWeight: '700' },

  body: { padding: 16, paddingBottom: 24 },

  // Steps
  stepsRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: C.white, borderRadius: 14,
    paddingVertical: 14, paddingHorizontal: 10, marginBottom: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  stepItem:  { alignItems: 'center', width: 72 },
  stepBubble: {
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: C.navy, alignItems: 'center', justifyContent: 'center', marginBottom: 4,
  },
  stepNum:   { fontSize: 11, fontWeight: '900', color: C.white },
  stepIcon:  { fontSize: 18, marginBottom: 2 },
  stepLabel: { fontSize: 10, fontWeight: '700', color: C.navy },
  stepConnector: { flex: 1, alignItems: 'center', marginBottom: 20, marginHorizontal: 2 },
  stepConnectorLine: { height: 2, width: '100%', backgroundColor: C.lightGray, borderRadius: 1 },

  // Section cards
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
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap' },
  pageBadge: {
    backgroundColor: C.navy, borderRadius: 10,
    paddingHorizontal: 8, paddingVertical: 2,
  },
  pageBadgeText: { fontSize: 10, fontWeight: '800', color: C.white },
  pageHint: { fontSize: 9, color: C.midGray, fontStyle: 'italic', flex: 1 },

  // Filter
  filterRow: { flexDirection: 'row', gap: 8 },
  filterBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 5, paddingVertical: 9, borderRadius: 10,
    borderWidth: 1.5, borderColor: C.lightGray, backgroundColor: C.offWhite,
  },
  filterBtnActive:     { backgroundColor: C.navy, borderColor: C.navy },
  filterBtnIcon:       { fontSize: 14 },
  filterBtnText:       { fontSize: 12, fontWeight: '600', color: C.subText },
  filterBtnTextActive: { color: C.white, fontWeight: '800' },

  // Pages strip
  pagesRow: { flexDirection: 'row', gap: 10, paddingVertical: 4 },

  pageCard: { alignItems: 'center', gap: 6 },

  pageThumb: {
    width: 76, height: 100, borderRadius: 8, overflow: 'hidden',
    backgroundColor: C.lightGray, borderWidth: 1.5, borderColor: C.navy + '44',
  },
  pageThumbImg: { width: '100%', height: '100%' },

  pagePreviewHint: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 18,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0)',
  },
  pagePreviewHintIcon: { fontSize: 18, opacity: 0.0 }, // invisible until pressed — RN handles activeOpacity

  pageLabel: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: 'rgba(19,62,117,0.85)',
    paddingVertical: 3, alignItems: 'center',
  },
  pageLabelText:  { fontSize: 9, color: C.white, fontWeight: '700' },
  pageRemoveBtn: {
    position: 'absolute', top: 4, right: 4,
    width: 18, height: 18, borderRadius: 9,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center', justifyContent: 'center',
  },
  pageRemoveText: { fontSize: 9, color: C.white, fontWeight: '900' },

  // Reorder controls below each thumb
  reorderRow: { flexDirection: 'row', alignItems: 'center', gap: 4, width: 76 },
  reorderBtn: {
    width: 22, height: 22, borderRadius: 5,
    backgroundColor: C.navy + '18',
    borderWidth: 1, borderColor: C.navy + '33',
    alignItems: 'center', justifyContent: 'center',
  },
  reorderBtnDisabled: { backgroundColor: 'transparent', borderColor: C.lightGray },
  reorderBtnText:     { fontSize: 9, color: C.navy, fontWeight: '800' },
  reorderBtnTextDisabled: { color: C.lightGray },
  reorderDots: { flex: 1, alignItems: 'center' },
  reorderDotsText: { fontSize: 12, color: C.midGray },

  // Capture buttons
  actionRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  actionBtn: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingVertical: 22, borderRadius: 14, gap: 4, minHeight: 100,
  },
  cameraBtn:  { backgroundColor: C.navy },
  galleryBtn: { backgroundColor: C.white, borderWidth: 1.5, borderColor: C.navy },
  actionBtnIcon: { fontSize: 26 },
  actionBtnText: { fontSize: 13, fontWeight: '800', color: C.white },
  actionBtnSub:  { fontSize: 10, color: 'rgba(255,255,255,0.65)' },

  // Empty hint
  emptyHint: { alignItems: 'center', paddingVertical: 20, marginBottom: 12 },
  emptyHintIcon: { fontSize: 32, marginBottom: 6 },
  emptyHintText: { fontSize: 14, fontWeight: '700', color: C.darkText, marginBottom: 2 },
  emptyHintSub:  { fontSize: 11, color: C.midGray, textAlign: 'center' },

  // Instruction
  instructionBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    backgroundColor: C.white, borderRadius: 12, padding: 14,
    borderLeftWidth: 3, borderLeftColor: C.gold, marginBottom: 4,
  },
  instructionDot: {
    width: 7, height: 7, borderRadius: 4,
    backgroundColor: C.gold, marginTop: 4, flexShrink: 0,
  },
  instructionText: { flex: 1, fontSize: 12, color: C.subText, lineHeight: 18 },

  // Footer
  footer: {
    padding: 16, paddingTop: 12,
    backgroundColor: C.white, borderTopWidth: 1.5, borderTopColor: C.lightGray,
  },
  pdfBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, backgroundColor: C.gold, borderRadius: 12, paddingVertical: 15,
    shadowColor: C.gold, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35, shadowRadius: 8, elevation: 4,
  },
  pdfBtnDisabled: { backgroundColor: C.midGray, shadowOpacity: 0 },
  pdfBtnIcon:     { fontSize: 18 },
  pdfBtnText:     { fontSize: 14, fontWeight: '800', color: C.navy },
});

export default ScanModal;