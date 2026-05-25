/**
 * DocumentScannerButton.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Drop-in scan trigger that wires together:
 *   useDocumentScanner → ScanModal → CropModal
 *
 * Usage (inside sk-document-list.tsx, replace the existing Scan button):
 *
 *   import { DocumentScannerButton } from './scanner/DocumentScannerButton';
 *
 *   <DocumentScannerButton
 *     onPdfReady={(file) => {
 *       setSelectedFile(file);
 *       setUploadModalVisible(true);
 *     }}
 *   />
 *
 * The button is styled to match the existing SK app scan button.
 */

import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { useDocumentScanner } from './useDocumentScanner';
import { ScanModal } from './ScanModal';
import { CropModal } from './CropModal';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ScannedFile {
  uri: string;
  name: string;
  type: string;
  size: number | null;
}

interface DocumentScannerButtonProps {
  /** Called with the generated PDF blob/file when scan session completes */
  onPdfReady: (file: ScannedFile) => void;
  /** Optional label override */
  label?: string;
  /** Optional additional TouchableOpacity styles */
  style?: object;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function DocumentScannerButton({
  onPdfReady,
  label = 'Scan',
  style,
}: DocumentScannerButtonProps) {
  const scanner = useDocumentScanner();

  return (
    <>
      {/* ── Trigger button ── */}
      <TouchableOpacity
        style={[s.scanBtn, style]}
        onPress={scanner.openScanModal}
        activeOpacity={0.8}
      >
        <Text style={s.scanIcon}>⊟</Text>
        <Text style={s.scanText}>{label}</Text>
      </TouchableOpacity>

      {/* ── Scan session modal ── */}
      <ScanModal scanner={scanner} onPdfReady={onPdfReady} />

      {/* ── Per-page crop modal ── */}
      <CropModal scanner={scanner} />
    </>
  );
}

// ─── Styles (matches existing sk-document-list scan button) ──────────────────

const s = StyleSheet.create({
  scanBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#133E75',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  scanIcon: { fontSize: 16, color: '#FFFFFF' },
  scanText: { fontSize: 13, fontWeight: '700', color: '#FFFFFF' },
});

export default DocumentScannerButton;
