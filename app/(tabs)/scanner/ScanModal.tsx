/**
 * ScanModal.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Full-screen scan session modal.
 *
 * Shows:
 *  • Step progress indicator (Capture → Crop → PDF)
 *  • Thumbnail strip of all collected pages
 *  • Camera capture button  (triggers <input capture="environment">)
 *  • Gallery / file picker button
 *  • Filter mode selector (None / Grayscale / B&W)
 *  • "Create PDF & Upload" CTA
 *
 * Works on Expo Web. The hidden <input> elements are rendered inside this
 * component; refs are wired from useDocumentScanner.
 */

import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Image,
  ActivityIndicator,
  StyleSheet,
  Platform,
} from 'react-native';
import type { UseDocumentScannerReturn, FilterMode } from './useDocumentScanner';

// ─── Colours (matches the existing SK app palette) ────────────────────────────
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

// ─── Props ────────────────────────────────────────────────────────────────────

interface ScanModalProps {
  scanner: UseDocumentScannerReturn;
  onPdfReady: (file: { uri: string; name: string; type: string; size: number | null }) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ScanModal({ scanner, onPdfReady }: ScanModalProps) {
  const {
    pages,
    scanning,
    convertingToPdf,
    scanModalVisible,
    filterMode,
    webCameraInputRef,
    webGalleryInputRef,
    closeScanModal,
    removePage,
    addCameraCapture,
    addFromGallery,
    compileToPdf,
    setFilterMode,
    handleWebFileInput,
  } = scanner;

  const handleCreatePdf = async () => {
    const file = await compileToPdf();
    if (file) {
      closeScanModal();
      onPdfReady(file);
    }
  };

  const filterOptions: { label: string; value: FilterMode; icon: string }[] = [
    { label: 'Color',  value: 'none',      icon: '🎨' },
    { label: 'Gray',   value: 'grayscale', icon: '⬛' },
    { label: 'B&W',    value: 'bw',        icon: '◼️' },
  ];

  return (
    <Modal
      visible={scanModalVisible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={closeScanModal}
    >
      <View style={s.root}>
        {/* ── Header ── */}
        <View style={s.header}>
          <Text style={s.headerTitle}>📄 Document Scanner</Text>
          <TouchableOpacity style={s.closeBtn} onPress={closeScanModal}>
            <Text style={s.closeBtnText}>✕</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={s.body} showsVerticalScrollIndicator={false}>

          {/* ── Step progress ── */}
          <View style={s.stepsRow}>
            {[
              { icon: '📷', label: 'Capture' },
              { icon: '✂️',  label: 'Crop'    },
              { icon: '📑', label: 'PDF'     },
            ].map((step, i) => (
              <React.Fragment key={step.label}>
                <View style={s.stepItem}>
                  <Text style={s.stepIcon}>{step.icon}</Text>
                  <Text style={s.stepLabel}>{step.label}</Text>
                </View>
                {i < 2 && <Text style={s.stepArrow}>›</Text>}
              </React.Fragment>
            ))}
          </View>

          {/* ── Instruction ── */}
          <View style={s.instructionBox}>
            <Text style={s.instructionText}>
              Tap <Text style={{ fontWeight: '800' }}>Camera</Text> to capture a new page, or{' '}
              <Text style={{ fontWeight: '800' }}>Gallery</Text> to import from your device.
              {'\n'}After capture, adjust the crop region and confirm. Repeat for multi-page
              documents, then tap <Text style={{ fontWeight: '800' }}>Create PDF</Text>.
            </Text>
          </View>

          {/* ── Filter selector ── */}
          <View style={s.filterRow}>
            <Text style={s.filterLabel}>Filter:</Text>
            {filterOptions.map((opt) => (
              <TouchableOpacity
                key={opt.value}
                style={[s.filterBtn, filterMode === opt.value && s.filterBtnActive]}
                onPress={() => setFilterMode(opt.value)}
                activeOpacity={0.8}
              >
                <Text style={s.filterBtnIcon}>{opt.icon}</Text>
                <Text style={[s.filterBtnText, filterMode === opt.value && s.filterBtnTextActive]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* ── Page thumbnails ── */}
          {pages.length > 0 && (
            <View style={s.pagesSection}>
              <Text style={s.pagesTitle}>
                Pages collected: <Text style={{ color: C.navy }}>{pages.length}</Text>
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={s.pagesRow}
              >
                {pages.map((page, idx) => (
                  <View key={page.id} style={s.pageThumb}>
                    <Image source={{ uri: page.dataUrl }} style={s.pageThumbImg} resizeMode="cover" />
                    <View style={s.pageLabel}>
                      <Text style={s.pageLabelText}>Page {idx + 1}</Text>
                    </View>
                    <TouchableOpacity
                      style={s.pageRemoveBtn}
                      onPress={() => removePage(page.id)}
                      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                    >
                      <Text style={s.pageRemoveText}>✕</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
            </View>
          )}

          {/* ── Action buttons ── */}
          <View style={s.actionRow}>
            {/* Camera */}
            <TouchableOpacity
              style={[s.actionBtn, s.cameraBtn]}
              onPress={addCameraCapture}
              activeOpacity={0.8}
              disabled={scanning}
            >
              {scanning ? (
                <ActivityIndicator color={C.white} />
              ) : (
                <>
                  <Text style={s.actionBtnIcon}>📷</Text>
                  <Text style={s.actionBtnText}>Camera</Text>
                  <Text style={s.actionBtnSub}>Take a photo</Text>
                </>
              )}
            </TouchableOpacity>

            {/* Gallery */}
            <TouchableOpacity
              style={[s.actionBtn, s.galleryBtn]}
              onPress={addFromGallery}
              activeOpacity={0.8}
              disabled={scanning}
            >
              <>
                <Text style={s.actionBtnIcon}>🖼️</Text>
                <Text style={[s.actionBtnText, { color: C.navy }]}>Gallery</Text>
                <Text style={[s.actionBtnSub, { color: C.subText }]}>Import image</Text>
              </>
            </TouchableOpacity>
          </View>

          {/* ── Empty hint ── */}
          {pages.length === 0 && !scanning && (
            <View style={s.emptyHint}>
              <Text style={s.emptyHintText}>
                No pages yet. Capture or import your first page above.
              </Text>
            </View>
          )}

          {/* ── Create PDF button ── */}
          {pages.length > 0 && (
            <TouchableOpacity
              style={[s.pdfBtn, convertingToPdf && s.pdfBtnDisabled]}
              onPress={handleCreatePdf}
              activeOpacity={0.8}
              disabled={convertingToPdf}
            >
              {convertingToPdf ? (
                <ActivityIndicator color={C.white} />
              ) : (
                <>
                  <Text style={s.pdfBtnIcon}>📑</Text>
                  <Text style={s.pdfBtnText}>
                    Create PDF & Upload ({pages.length} page{pages.length > 1 ? 's' : ''})
                  </Text>
                </>
              )}
            </TouchableOpacity>
          )}

        </ScrollView>

        {/* ── Hidden web file inputs ── */}
        {Platform.OS === 'web' && (
          <>
            {/* Camera (mobile browser shows viewfinder) */}
            <input
              ref={webCameraInputRef as React.RefObject<HTMLInputElement>}
              type="file"
              accept="image/*"
              capture="environment"
              style={{ display: 'none' }}
              onChange={handleWebFileInput as any}
            />
            {/* Gallery / file picker */}
            <input
              ref={webGalleryInputRef as React.RefObject<HTMLInputElement>}
              type="file"
              accept="image/*"
              multiple
              style={{ display: 'none' }}
              onChange={handleWebFileInput as any}
            />
          </>
        )}
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
    paddingTop: 50, // safe area approximation
  },
  headerTitle: { fontSize: 18, fontWeight: '800', color: C.white },
  closeBtn:    { padding: 6 },
  closeBtnText: { fontSize: 18, color: C.white },

  body: { padding: 16, paddingBottom: 40 },

  stepsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EEF3FB',
    borderRadius: 10,
    paddingVertical: 12,
    marginBottom: 14,
    gap: 4,
  },
  stepItem:  { alignItems: 'center', paddingHorizontal: 10 },
  stepIcon:  { fontSize: 22 },
  stepLabel: { fontSize: 10, fontWeight: '700', color: C.navy, marginTop: 2 },
  stepArrow: { fontSize: 20, color: C.midGray },

  instructionBox: {
    backgroundColor: C.white,
    borderRadius: 10,
    padding: 14,
    marginBottom: 14,
    borderLeftWidth: 3,
    borderLeftColor: C.navy,
  },
  instructionText: { fontSize: 12, color: C.subText, lineHeight: 18 },

  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },
  filterLabel: { fontSize: 12, fontWeight: '700', color: C.darkText },
  filterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: C.lightGray,
    backgroundColor: C.white,
  },
  filterBtnActive:    { backgroundColor: C.navy, borderColor: C.navy },
  filterBtnIcon:      { fontSize: 14 },
  filterBtnText:      { fontSize: 11, fontWeight: '600', color: C.subText },
  filterBtnTextActive: { color: C.white, fontWeight: '800' },

  pagesSection: { marginBottom: 14 },
  pagesTitle:   { fontSize: 13, fontWeight: '700', color: C.darkText, marginBottom: 10 },
  pagesRow:     { flexDirection: 'row', gap: 10, paddingBottom: 4 },
  pageThumb: {
    width: 80,
    height: 106,
    borderRadius: 6,
    overflow: 'hidden',
    backgroundColor: C.lightGray,
    borderWidth: 1.5,
    borderColor: C.navy + '55',
    position: 'relative',
  },
  pageThumbImg: { width: '100%', height: '100%' },
  pageLabel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(19,62,117,0.75)',
    paddingVertical: 3,
    alignItems: 'center',
  },
  pageLabelText:  { fontSize: 9,  color: C.white, fontWeight: '700' },
  pageRemoveBtn: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pageRemoveText: { fontSize: 9, color: C.white, fontWeight: '900' },

  actionRow: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  actionBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 22,
    borderRadius: 12,
    gap: 4,
    minHeight: 100,
  },
  cameraBtn:      { backgroundColor: C.navy },
  galleryBtn:     { backgroundColor: C.offWhite, borderWidth: 1.5, borderColor: C.navy },
  actionBtnIcon:  { fontSize: 26 },
  actionBtnText:  { fontSize: 13, fontWeight: '800', color: C.white },
  actionBtnSub:   { fontSize: 10, color: 'rgba(255,255,255,0.7)' },

  emptyHint:     { alignItems: 'center', paddingVertical: 8 },
  emptyHintText: { fontSize: 11, color: C.midGray, textAlign: 'center', lineHeight: 16 },

  pdfBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: C.gold,
    borderRadius: 12,
    paddingVertical: 16,
    marginTop: 4,
  },
  pdfBtnDisabled: { backgroundColor: C.midGray },
  pdfBtnIcon:     { fontSize: 20 },
  pdfBtnText:     { fontSize: 14, fontWeight: '800', color: C.navy },
});

export default ScanModal;
