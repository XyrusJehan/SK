import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, ScrollView, TouchableOpacity,
  StyleSheet, SafeAreaView, StatusBar, Dimensions,
  Modal, Alert, Image, Platform, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useNav } from './navContext';
import Sidebar, { LYDO_NAV_ITEMS } from './../components/Sidebar';
import { useAuth } from './authContext';
import { useLydoNotificationCenter, LydoNotificationModal, LydoBellIcon } from './notificationCenter';
import {
  fetchTransparencyReport,
  fetchSubmissionReport,
  saveComplianceDocument,
  DOC_FULL_NAMES as API_DOC_FULL_NAMES,
} from './reportsApi';
import {
  buildTransparencyReportHtml,
  buildSubmissionReportHtml,
  uploadReportPdf,
  renderReportToBase64,
} from './reportPdf';
// Renders the generated report HTML inside the preview modal below, on
// native platforms (iOS/Android). react-native-webview does NOT support
// web, so the PreviewFrame component further down uses a plain <iframe>
// on web instead — see PreviewFrame.
// Requires: npx expo install react-native-webview
import { WebView } from 'react-native-webview';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const isMobile = SCREEN_WIDTH < 768;

// react-native-web's Alert.alert does NOT show any UI — it only logs a
// console warning ("Alert.alert not supported on web") and returns. That
// meant failures (e.g. the PDF export throwing) looked like "nothing
// happens" in the browser even though an error had actually occurred and
// was logged. This falls back to window.alert/confirm on web so the
// person actually sees the message, and keeps native Alert.alert
// everywhere else.
function notify(title, message, { confirmButtons } = {}) {
  if (Platform.OS === 'web') {
    const text = message ? `${title}\n\n${message}` : title;
    if (confirmButtons) {
      const ok = window.confirm(text);
      const btn = confirmButtons[ok ? 1 : 0];
      btn?.onPress?.();
    } else {
      window.alert(text);
    }
    return;
  }
  if (confirmButtons) {
    Alert.alert(title, message, confirmButtons);
  } else {
    Alert.alert(title, message);
  }
}

// ─── COLORS ───────────────────────────────────────────────────────────────────
const COLORS = {
  navy:      '#133E75',
  navyLight: '#1E4D8C',
  gold:      '#E8C547',
  white:     '#FFFFFF',
  offWhite:  '#F7F5F2',
  lightGray: '#ECECEC',
  midGray:   '#B0B0B0',
  darkText:  '#1A1A1A',
  subText:   '#666666',
  cardBg:    '#FFFFFF',
  onTime:    '#2E7D32',
  onTimeBg:  '#E8F5E9',
  late:      '#E65100',
  lateBg:    '#FFF3E0',
  noPub:     '#8B0000',
  noPubBg:   '#FFEBEE',
};

const MONITOR_TABS = ['Consultation', 'Budget', 'Report','Deadlines'];

// ─── DROPDOWN OPTIONS ─────────────────────────────────────────────────────────
const DOCUMENT_OPTIONS = ['ABYIP', 'CBYDP', 'SK Budget', 'Accomplishment'];
const YEAR_OPTIONS     = ['2026', '2025', '2024'];

// ─── STATUS META ──────────────────────────────────────────────────────────────
const STATUS_META = {
  on_time: { label: 'On Time',        color: COLORS.onTime, bg: COLORS.onTimeBg },
  late:    { label: 'Late',           color: COLORS.late,   bg: COLORS.lateBg   },
  no_pub:  { label: 'No Publication', color: COLORS.noPub,  bg: COLORS.noPubBg  },
};

// ─── DOCUMENT TYPE MAP ────────────────────────────────────────────────────────
// (Sourced from reportsApi.js so the label mapping stays in one place.)
const DOC_FULL_NAMES = API_DOC_FULL_NAMES;

// NOTE: CONSOLIDATED_DATA / REPORT_ROWS / DOC_DEADLINES used to be hardcoded
// mock arrays. They are now fetched live from Supabase (see reportsApi.js)
// and built into the same shapes inside the component below:
//   - `consolidatedGroups` mirrors the old CONSOLIDATED_DATA (barangay -> docs[])
//   - `singleDocRows`     mirrors the old REPORT_ROWS (flat, filtered by docType)
// Both are derived from whichever sub-tab is active:
//   Transparency -> fetchTransparencyReport()  (documents.status = 'published')
//   Submission   -> fetchSubmissionReport()    (submission_deadlines.is_met)

// ─── ICONS ────────────────────────────────────────────────────────────────────
const MenuIcon = () => (
  <View style={styles.menuIconContainer}>
    {[0, 1, 2].map(i => <View key={i} style={styles.menuLine} />)}
  </View>
);

// ─── DROPDOWN ─────────────────────────────────────────────────────────────────
const Dropdown = ({ label, value, options, onSelect }) => {
  const [open, setOpen] = useState(false);
  return (
    <View style={DD.wrap}>
      <TouchableOpacity
        style={DD.btn}
        onPress={() => setOpen(o => !o)}
        activeOpacity={0.8}
      >
        <Text style={DD.label}>{label}</Text>
        <Text style={DD.value}>{value}</Text>
        <Text style={DD.arrow}>▾</Text>
      </TouchableOpacity>
      {open && (
        <View style={DD.menu}>
          {options.map(opt => (
            <TouchableOpacity
              key={opt}
              style={[DD.item, opt === value && DD.itemActive]}
              onPress={() => { onSelect(opt); setOpen(false); }}
              activeOpacity={0.75}
            >
              <Text style={[DD.itemText, opt === value && DD.itemTextActive]}>{opt}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
};

const DD = StyleSheet.create({
  wrap:           { position: 'relative', zIndex: 100 },
  btn:            { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: COLORS.white, borderRadius: 8, borderWidth: 1, borderColor: COLORS.lightGray, paddingHorizontal: 10, paddingVertical: 7 },
  label:          { fontSize: 10, color: COLORS.subText, fontWeight: '600' },
  value:          { fontSize: 11, fontWeight: '700', color: COLORS.darkText },
  arrow:          { fontSize: 9, color: COLORS.subText, marginLeft: 2 },
  menu:           { position: 'absolute', top: 36, left: 0, backgroundColor: COLORS.white, borderRadius: 8, borderWidth: 1, borderColor: COLORS.lightGray, minWidth: 110, elevation: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 8, zIndex: 200 },
  item:           { paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.lightGray },
  itemActive:     { backgroundColor: COLORS.offWhite },
  itemText:       { fontSize: 12, color: COLORS.darkText },
  itemTextActive: { fontWeight: '700', color: COLORS.navy },
});

// ─── STATUS PILL ──────────────────────────────────────────────────────────────
const StatusPill = ({ status }) => {
  const meta = STATUS_META[status];
  if (!meta) return null;
  return (
    <View style={[SP.pill, { backgroundColor: meta.bg }]}>
      <Text style={[SP.text, { color: meta.color }]}>{meta.label}</Text>
    </View>
  );
};

const SP = StyleSheet.create({
  pill: { borderRadius: 20, paddingHorizontal: isMobile ? 6 : 10, paddingVertical: 4, alignSelf: 'flex-start' },
  text: { fontSize: isMobile ? 8 : 10, fontWeight: '700' },
});

// ─── SINGLE-DOC TABLE ROW ─────────────────────────────────────────────────────
const ReportRow = ({ item, isEven }) => (
  <View style={[styles.tableRow, isEven && styles.tableRowEven]}>
    <View style={styles.colBarangay}>
      <Text style={styles.cellBarangay} numberOfLines={isMobile ? 2 : 1}>{item.barangay}</Text>
    </View>
    <View style={styles.colDocument}>
      <Text style={styles.cellDocument} numberOfLines={isMobile ? 2 : 1}>{item.document}</Text>
    </View>
    <View style={styles.colDateTime}>
      {item.time ? (
        <>
          <Text style={styles.cellTime}>{item.time}</Text>
          <Text style={styles.cellDate}>{item.date}</Text>
        </>
      ) : (
        <Text style={styles.cellDate}>N/A</Text>
      )}
    </View>
    <View style={styles.colStatus}>
      <StatusPill status={item.status} />
    </View>
  </View>
);

// ─── CONSOLIDATED BARANGAY GROUP ──────────────────────────────────────────────
const BarangayGroup = ({ group, index }) => {
  const [expanded, setExpanded] = useState(true);
  const isEvenGroup = index % 2 === 0;

  return (
    <View>
      {/* Barangay Header Row */}
      <TouchableOpacity
        style={[styles.barangayHeaderRow, isEvenGroup && styles.barangayHeaderRowAlt]}
        onPress={() => setExpanded(e => !e)}
        activeOpacity={0.75}
      >
        <View style={styles.colBarangay}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={styles.barangayHeaderText}>{group.barangay}</Text>
            <Text style={styles.chevron}>∨</Text>
          </View>
          <Text style={styles.expandedLabel}>{expanded ? '(Expanded)' : '(Collapsed)'}</Text>
        </View>
        <View style={styles.colDocument} />
        <View style={styles.colDeadline} />
        <View style={styles.colDateTime} />
        <View style={styles.colStatus} />
      </TouchableOpacity>

      {/* Expanded doc rows */}
      {expanded && group.docs.map((doc, idx) => (
        <View key={idx} style={[styles.tableRow, idx % 2 !== 0 && styles.tableRowEven, styles.indentedRow]}>
          <View style={styles.colBarangay} />
          <View style={styles.colDocument}>
            <Text style={styles.cellDocument} numberOfLines={isMobile ? 2 : 1}>{doc.document}</Text>
          </View>
          <View style={styles.colDeadline}>
            <Text style={styles.cellDeadline}>{doc.deadline}</Text>
          </View>
          <View style={styles.colDateTime}>
            {doc.time ? (
              <>
                <Text style={styles.cellTime}>{doc.time}</Text>
                <Text style={styles.cellDate}>{doc.date}</Text>
              </>
            ) : (
              <Text style={styles.cellDate}>N/A</Text>
            )}
          </View>
          <View style={styles.colStatus}>
            <StatusPill status={doc.status} />
          </View>
        </View>
      ))}
    </View>
  );
};

// ─── PDF FILENAME HELPER ────────────────────────────────────────────────────
// Two reports, two files — kept separate (rather than one combined report)
// so each can be routed, filed, or shared independently. `kind` controls
// which report the filename describes; `docLabel` is the selected document
// type filter ('All' -> "AllDocuments" for a clean, professional filename).
function buildReportFilename(kind, docLabel, year) {
  const docPart = docLabel === 'All' ? 'AllDocuments' : docLabel.replace(/\s+/g, '');
  const kindPart = kind === 'transparency' ? 'FDP_Transparency_Report' : 'Submission_Compliance_Report';
  return `SK_Rizal_${kindPart}_${docPart}_${year}.pdf`;
}

// Renders the report HTML for preview. react-native-webview only supports
// native platforms (iOS/Android/macOS/Windows) — rendering its <WebView> on
// web throws "does not support this platform" — so on web we fall back to
// a plain <iframe srcDoc="..."> instead, which every browser supports natively.
// Renders the report HTML for preview. react-native-webview only supports
// native platforms (iOS/Android/macOS/Windows) — rendering its <WebView> on
// web throws "does not support this platform" — so on web we fall back to
// a plain <iframe srcDoc="..."> instead, which every browser supports
// natively. We don't rely on Platform.OS alone (some web bundler/runtime
// combinations still report something other than 'web'); checking for the
// DOM directly is the reliable signal that we're actually in a browser.
const isWebRuntime = typeof document !== 'undefined' && typeof window !== 'undefined';

// Safety net: if the platform check above is ever wrong in some runtime and
// react-native-webview's <WebView> still gets mounted somewhere it isn't
// supported, this catches that render error instead of surfacing the raw
// "does not support this platform" string in the UI.
class WebViewErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { failed: false }; }
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(err) { console.warn('WebView failed to render preview:', err); }
  render() {
    if (this.state.failed) {
      return (
        <View style={PDF.previewLoadingWrap}>
          <Text style={PDF.previewLoadingText}>Preview isn't available on this device — you can still download the PDF below.</Text>
        </View>
      );
    }
    return this.props.children;
  }
}

const PreviewFrame = ({ html }) => {
  if (Platform.OS === 'web' || isWebRuntime) {
    return (
      <iframe
        title="report-preview"
        srcDoc={html}
        style={{ flex: 1, width: '100%', height: '100%', border: 'none', backgroundColor: '#FFFFFF' }}
      />
    );
  }
  return (
    <WebViewErrorBoundary>
      <WebView
        originWhitelist={['*']}
        source={{ html }}
        style={PDF.webview}
      />
    </WebViewErrorBoundary>
  );
};

// ─── REPORT PREVIEW MODAL ──────────────────────────────────────────────────
// Shows the actual generated report (same HTML that becomes the PDF) inside
// a WebView (native) or iframe (web) so the user can review it before
// committing to save it.
// `reportKind` ties this modal to whichever sub-tab is active —
// 'transparency' or 'submission' — so it only ever previews/saves ONE report,
// matching the Save Report button that opened it.
//
// Primary action is "Save" (not "Download"): the rendered PDF is uploaded to
// the 'documents' bucket and a row is written to `compliance_documents`.
// The user re-opens it later from Documents > Reports.
const ReportPreviewModal = ({
  visible, onClose, onSave,
  docLabel, year, reportKind,
  loading, html, saving,
}) => {
  if (!visible) return null;
  const isAll = docLabel === 'All';
  const filename = buildReportFilename(reportKind, docLabel, year);
  const reportLabel = reportKind === 'transparency' ? 'FDP Transparency Report' : 'Submission Compliance Report';
  const docName = isAll ? reportLabel : `${docLabel} ${reportLabel}`;
  const busy = loading || saving;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={busy ? undefined : onClose}>
      <View style={PDF.overlay}>
        <View style={PDF.previewSheet}>
          {/* ── Header ── */}
          <View style={PDF.header}>
            <View style={PDF.pdfIconWrap}>
              <View style={PDF.pdfIconPage}>
                <View style={PDF.pdfIconRedBar}>
                  <Text style={PDF.pdfIconRedText}>PDF</Text>
                </View>
                <View style={PDF.pdfIconLines}>
                  {[0, 1, 2].map(i => <View key={i} style={PDF.pdfIconLine} />)}
                </View>
              </View>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={PDF.title}>
                {loading ? 'Loading Preview…' : saving ? 'Saving Report…' : 'Preview Report'}
              </Text>
              <Text style={PDF.previewSubtitle} numberOfLines={1}>{docName} {year}</Text>
            </View>
            {!busy && (
              <TouchableOpacity style={PDF.closeBtn} onPress={onClose} activeOpacity={0.8}>
                <Text style={PDF.closeX}>✕</Text>
              </TouchableOpacity>
            )}
          </View>

          <View style={PDF.divider} />

          {/* ── Preview ── */}
          <View style={PDF.previewBody}>
            {loading || !html ? (
              <View style={PDF.previewLoadingWrap}>
                <ActivityIndicator size="large" color={COLORS.navy} />
                <Text style={PDF.previewLoadingText}>Building your report preview…</Text>
              </View>
            ) : (
              <PreviewFrame html={html} />
            )}
          </View>

          <Text style={PDF.filename}>{filename}</Text>

          {/* ── Actions ── */}
          <View style={PDF.btnRow}>
            <TouchableOpacity
              style={[PDF.saveBtn, (busy || !html) && { opacity: 0.6 }]}
              onPress={() => { if (!busy && html) onSave(); }}
              activeOpacity={0.85}
              disabled={busy || !html}
            >
              {saving ? (
                <ActivityIndicator size="small" color={COLORS.white} />
              ) : (
                <View style={PDF.saveIconWrap}>
                  <View style={PDF.saveIconFloppy} />
                  <View style={PDF.saveIconSlit} />
                </View>
              )}
              <Text style={PDF.saveText}>
                {saving ? 'Saving…' : 'Save Report'}
              </Text>
            </TouchableOpacity>
            {!busy && (
              <TouchableOpacity style={PDF.cancelBtn} onPress={onClose} activeOpacity={0.8}>
                <Text style={PDF.cancelText}>Cancel</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
};

const PDF = StyleSheet.create({
  overlay:         { flex: 1, backgroundColor: 'rgba(0,0,0,0.50)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  sheet:           { backgroundColor: COLORS.white, borderRadius: 14, width: '100%', maxWidth: 380, overflow: 'hidden', elevation: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.25, shadowRadius: 20 },
  previewSheet:    { backgroundColor: COLORS.white, borderRadius: 14, width: '100%', maxWidth: 640, height: '85%', maxHeight: 780, overflow: 'hidden', elevation: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.25, shadowRadius: 20 },
  header:          { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12 },
  pdfIconWrap:     { width: 36, height: 36, borderRadius: 6, backgroundColor: '#F5F5F5', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  pdfIconPage:     { width: 28, height: 32, backgroundColor: COLORS.white, borderRadius: 3, borderWidth: 1, borderColor: '#E0E0E0', overflow: 'hidden' },
  pdfIconRedBar:   { backgroundColor: '#CC0000', paddingVertical: 2, alignItems: 'center' },
  pdfIconRedText:  { fontSize: 6, fontWeight: '900', color: COLORS.white, letterSpacing: 0.5 },
  pdfIconLines:    { paddingHorizontal: 3, paddingTop: 3, gap: 2 },
  pdfIconLine:     { height: 2, backgroundColor: '#D0D0D0', borderRadius: 1 },
  title:           { fontSize: 15, fontWeight: '800', color: COLORS.darkText },
  previewSubtitle: { fontSize: 11, color: COLORS.subText, marginTop: 1 },
  closeBtn:        { width: 28, height: 28, borderRadius: 14, backgroundColor: COLORS.lightGray, alignItems: 'center', justifyContent: 'center' },
  closeX:          { fontSize: 11, color: COLORS.subText, fontWeight: '700' },
  divider:         { height: 1, backgroundColor: COLORS.lightGray },
  body:            { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 10 },
  previewBody:     { flex: 1, backgroundColor: '#F2F2F2' },
  webview:         { flex: 1, backgroundColor: '#FFFFFF' },
  previewLoadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  previewLoadingText: { fontSize: 12, color: COLORS.subText },
  bodyText:        { fontSize: 13, color: COLORS.darkText, lineHeight: 20 },
  bold:            { fontWeight: '700' },
  filename:        { marginTop: 10, marginHorizontal: 16, fontSize: 11, color: COLORS.subText },
  btnRow:          { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingBottom: 16, paddingTop: 12 },
  saveBtn:         { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: COLORS.navy, borderRadius: 8, paddingVertical: 11 },
  cancelBtn:       { paddingHorizontal: 16, paddingVertical: 11, borderRadius: 8, borderWidth: 1.5, borderColor: COLORS.midGray, alignItems: 'center', justifyContent: 'center' },
  saveText:        { fontSize: 12, fontWeight: '700', color: COLORS.white },
  cancelText:      { fontSize: 12, fontWeight: '600', color: COLORS.subText },
  saveIconWrap:    { alignItems: 'center', justifyContent: 'center', width: 14, height: 14 },
  saveIconFloppy:  { width: 11, height: 12, backgroundColor: COLORS.white, borderRadius: 1 },
  saveIconSlit:    { position: 'absolute', top: 1, width: 5, height: 4, backgroundColor: COLORS.navy },
});

// ─── SAVE-SUCCESS MODAL ───────────────────────────────────────────────────────
// Shown after a report finishes saving to compliance_documents + the documents
// bucket. Primary CTA navigates the user to Documents > Reports so they can
// view/download the file they just generated. The secondary CTA dismisses the
// modal so the user can stay on the Monitor screen and keep working.

const SUCC = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(19, 62, 117, 0.55)', // matches COLORS.navy @ 55%
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: COLORS.white,
    borderRadius: 16,
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 18,
    elevation: 10,
  },
  // Checkmark drawn from two rotated bars inside a green circle. No SVG dep.
  checkCircle: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: '#1B5E20', // success green, matches the FDP submission tag color
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 18,
  },
  checkStem: {
    position: 'absolute',
    width: 12, height: 4, borderRadius: 2,
    backgroundColor: COLORS.white,
    transform: [{ rotate: '45deg' }, { translateX: -2 }, { translateY: 6 }],
  },
  checkKick: {
    position: 'absolute',
    width: 24, height: 4, borderRadius: 2,
    backgroundColor: COLORS.white,
    transform: [{ rotate: '-45deg' }, { translateX: -4 }, { translateY: -2 }],
  },
  title: {
    fontSize: 20, fontWeight: '900', color: COLORS.navy,
    marginBottom: 8, letterSpacing: 0.3,
  },
  subtitle: {
    fontSize: 13, color: COLORS.subText, textAlign: 'center',
    lineHeight: 18, marginBottom: 18, paddingHorizontal: 4,
  },
  fileChip: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#F4F6FA', borderWidth: 1, borderColor: '#DDE3EE',
    borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8,
    marginBottom: 22, maxWidth: '100%', alignSelf: 'stretch',
  },
  fileChipDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.navy },
  fileChipText: {
    fontSize: 12, fontWeight: '600', color: COLORS.darkText, flex: 1,
  },
  btnRow: { flexDirection: 'row', gap: 10, alignSelf: 'stretch' },
  secondaryBtn: {
    flex: 1, paddingVertical: 12, borderRadius: 8, alignItems: 'center',
    borderWidth: 1.5, borderColor: COLORS.midGray, backgroundColor: COLORS.white,
  },
  secondaryText: { fontSize: 13, fontWeight: '700', color: COLORS.subText },
  primaryBtn: {
    flex: 1.4, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 12, borderRadius: 8, backgroundColor: COLORS.navy,
    shadowColor: COLORS.navy, shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25, shadowRadius: 6, elevation: 4,
  },
  primaryText: { fontSize: 13, fontWeight: '800', color: COLORS.white },
  arrowWrap: { width: 14, height: 12, alignItems: 'center', justifyContent: 'center' },
  arrowLine: { width: 12, height: 2, backgroundColor: COLORS.white, borderRadius: 1 },
  arrowHead: {
    position: 'absolute', right: 0, width: 6, height: 6,
    borderRightWidth: 2, borderTopWidth: 2,
    borderColor: COLORS.white, transform: [{ rotate: '45deg' }],
  },
});

const SuccessModal = ({ visible, filename, onGoToReports, onClose }) => {
  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={SUCC.backdrop}>
        <View style={SUCC.card}>
          {/* Green check circle */}
          <View style={SUCC.checkCircle}>
            <View style={SUCC.checkStem} />
            <View style={SUCC.checkKick} />
          </View>

          <Text style={SUCC.title}>Report Saved!</Text>
          <Text style={SUCC.subtitle}>
            Your report has been saved successfully and is now available in the
            Reports section.
          </Text>

          {/* Filename chip — gives the user a quick confirmation of what was
              actually written, so they can sanity-check it before navigating. */}
          <View style={SUCC.fileChip}>
            <View style={SUCC.fileChipDot} />
            <Text style={SUCC.fileChipText} numberOfLines={1}>{filename}</Text>
          </View>

          <View style={SUCC.btnRow}>
            <TouchableOpacity
              style={SUCC.secondaryBtn}
              onPress={onClose}
              activeOpacity={0.85}
            >
              <Text style={SUCC.secondaryText}>Stay Here</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={SUCC.primaryBtn}
              onPress={onGoToReports}
              activeOpacity={0.85}
            >
              <Text style={SUCC.primaryText}>Go to Reports</Text>
              <View style={SUCC.arrowWrap}>
                <View style={SUCC.arrowLine} />
                <View style={SUCC.arrowHead} />
              </View>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

// ─── MAIN SCREEN ──────────────────────────────────────────────────────────────
export default function LYDOMonitorReportScreen() {
  const [successModal, setSuccessModal] = useState({ visible: false, filename: '' });
  const router = useRouter();
  const { activeTab, setActiveTab } = useNav();
  const { user, logout } = useAuth();

  const [activeMonitorTab, setActiveMonitorTab] = useState('Report');
  // Sub-tabs under Report: 'Transparency' | 'Submission'
  const [reportSubTab, setReportSubTab] = useState('Transparency');
  // 'All' means show consolidated view; specific doc shows single-doc view
  const [selectedDoc,  setSelectedDoc]  = useState('All');
  const [selectedYear, setSelectedYear] = useState('2026');
  const [searchText,   setSearchText]   = useState('');
  const notif = useLydoNotificationCenter();
  const [sidebarVisible, setSidebarVisible] = useState(false);
  const [currentTime, setCurrentTime]   = useState('');

  // ── Live report rows (from documents / submission_deadlines via Supabase) ──
  const [reportRows, setReportRows]     = useState([]); // flat rows, all doc types
  const [loading, setLoading]           = useState(false);
  const [loadError, setLoadError]       = useState(null);
  const [savingReport, setSavingReport] = useState(false);

  // Re-fetch whenever the sub-tab (Transparency/Submission) or the year
  // changes. We always fetch documentType='All' so the consolidated ("All")
  // view has every doc type to group by barangay, and filter client-side
  // for the single-doc view — avoids a round trip every time someone
  // toggles the document dropdown.
  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setLoadError(null);
      try {
        const fetcher = reportSubTab === 'Transparency'
          ? fetchTransparencyReport
          : fetchSubmissionReport;
        const rows = await fetcher({ year: selectedYear, documentType: 'All' });
        if (!cancelled) setReportRows(rows);
      } catch (err) {
        if (!cancelled) {
          console.error('Failed to load report data:', err);
          setLoadError(err.message || 'Failed to load report data.');
          setReportRows([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [reportSubTab, selectedYear]);

  const today = new Date().toLocaleDateString('en-PH', {
    timeZone: 'Asia/Manila', month: 'long', day: 'numeric', year: 'numeric',
  });

  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString('en-PH', {
          timeZone: 'Asia/Manila',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        })
      );
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, []);
  const [pdfModalVisible, setPdfModalVisible] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewHtml, setPreviewHtml] = useState(null);

  const isAllView = selectedDoc === 'All';

  // ── Open the preview modal and build the report HTML for whichever
  // sub-tab is active. Transparency's Save Report never touches Submission
  // data, and vice versa — each button previews/downloads exactly one report.
  const openReportPreview = async () => {
    setPreviewHtml(null);
    setPreviewLoading(true);
    setPdfModalVisible(true);
    try {
      const isTransparency = reportSubTab === 'Transparency';
      if (isTransparency) {
        const rows = await fetchTransparencyReport({ year: selectedYear, documentType: selectedDoc });
        setPreviewHtml(buildTransparencyReportHtml({
          selectedDoc, selectedYear, rows, generatedBy: user?.name,
        }));
      } else {
        const rows = await fetchSubmissionReport({ year: selectedYear, documentType: selectedDoc });
        setPreviewHtml(buildSubmissionReportHtml({
          selectedDoc, selectedYear, rows, generatedBy: user?.name,
        }));
      }
    } catch (err) {
      console.error('Failed to build report preview:', err);
      notify('Preview Failed', err.message || 'Could not load the report preview.');
      setPdfModalVisible(false);
    } finally {
      setPreviewLoading(false);
    }
  };

  // ── Navigation ──────────────────────────────────────────────────────────────
  const handleNav = (tab) => {
    setActiveTab(tab);
    setSidebarVisible(false);
    if (tab === 'Dashboard') router.push('/(tabs)/lydo-dashboard');
    else if (tab === 'Documents') router.push('/(tabs)/lydo-document');
    else if (tab === 'Monitor') router.push('/(tabs)/lydo-monitor');
    else if (tab === 'Logs') router.push('/(tabs)/lydo-logs');
    else if (tab === 'Barangay') router.push('/(tabs)/lydo-accounts');
  };

  const handleLogout = () => {
    logout();
    router.replace('/');
  };

  const handleMonitorTabPress = (tab) => {
    if (tab === 'Consultation') { router.push('/(tabs)/lydo-monitor'); return; }
    if (tab === 'Budget')       { router.push('/(tabs)/lydo-monitor-budget'); return; }
    if (tab === 'Report')       { router.push('/(tabs)/lydo-monitor-report'); return; }
    if (tab === 'Deadlines')    { router.push('/(tabs)/lydo-monitor-deadlines'); return; }
    setActiveMonitorTab(tab);
  };

  // ── Filtered / derived data ──────────────────────────────────────────────────
  // Single-doc view rows: flat list for the currently selected document type.
  const singleDocRows = reportRows
    .filter(r => r.docType === selectedDoc)
    .filter(r =>
      r.barangayName.toLowerCase().includes(searchText.toLowerCase()) ||
      r.document.toLowerCase().includes(searchText.toLowerCase())
    )
    .map(r => ({ ...r, id: `${r.barangayId}-${r.docType}`, barangay: r.barangayName }));

  // Consolidated view groups: group the flat rows by barangay, mirroring the
  // old CONSOLIDATED_DATA shape ({ barangay, docs: [...] }).
  const consolidatedGroups = Object.values(
    reportRows.reduce((acc, r) => {
      if (!acc[r.barangayName]) acc[r.barangayName] = { barangay: r.barangayName, docs: [] };
      acc[r.barangayName].docs.push({
        docType: r.docType,
        document: r.document,
        deadline: r.deadline,
        time: r.time,
        date: r.date,
        status: r.status,
      });
      return acc;
    }, {})
  ).filter(g =>
    g.barangay.toLowerCase().includes(searchText.toLowerCase()) ||
    g.docs.some(d => d.document.toLowerCase().includes(searchText.toLowerCase()))
  );

  // Deadline shown in the title row for the currently selected document type
  // (falls back to the first matching row's deadline since deadlines are
  // per-barangay in submission_deadlines but usually shared across a batch).
  const selectedDocDeadline = selectedDoc === 'All'
    ? (reportRows[0]?.deadline ?? '—')
    : (reportRows.find(r => r.docType === selectedDoc)?.deadline ?? '—');

  // ── Main Content ─────────────────────────────────────────────────────────────
  const renderContent = () => (
    <ScrollView
      style={[styles.main, isMobile && styles.mainMobile]}
      contentContainerStyle={styles.mainContent}
      showsVerticalScrollIndicator={false}
    >
      {/* Mobile Header */}
      {isMobile && (
        <View style={styles.mobileHeader}>
          <TouchableOpacity style={styles.menuBtn} onPress={() => setSidebarVisible(true)}>
            <MenuIcon />
          </TouchableOpacity>
          <Text style={styles.mobileTitle}>Report Monitor</Text>
              <TouchableOpacity style={styles.bellBtn} activeOpacity={0.7} onPress={notif.open}>
                <LydoBellIcon count={notif.count} />
              </TouchableOpacity>
        </View>
      )}

      {/* Desktop Header */}
      {!isMobile && (
        <View style={styles.header}>
          <View>
            <Text style={styles.headerSub}>SANGGUNIANG KABATAAN FEDERATION</Text>
            <Text style={styles.headerTitle}>RIZAL, LAGUNA</Text>
            <Text style={styles.headerDesc}>
              SK Full Disclosure Policy Compliance Portal for the Submission and Validation{'\n'}of Statutory Financial Reports and Developmental Plans
            </Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={styles.datetimeCard}>
              <View style={styles.datetimeRow}>
                <View style={styles.datetimeDivider} />
                <View style={styles.datetimeBlock}>
                  <Text style={styles.datetimeLabel}>DATE</Text>
                  <Text style={styles.datetimeValue}>{today}</Text>
                </View>
                <View style={styles.datetimeSeparator} />
                <View style={[styles.datetimeDivider, { backgroundColor: '#22C55E' }]} />
                <View style={styles.datetimeBlock}>
                  <Text style={styles.datetimeLabel}>TIME (PHT)</Text>
                  <Text style={[styles.datetimeValue, styles.datetimeTime]}>{currentTime}</Text>
                </View>
              </View>
            </View>
              <TouchableOpacity style={styles.bellBtn} activeOpacity={0.7} onPress={notif.open}>
                <LydoBellIcon count={notif.count} />
              </TouchableOpacity>
          </View>
        </View>
      )}

      {/* ── Monitor Tabs ── */}
      <View style={styles.monitorTabBar}>
        {MONITOR_TABS.map(tab => {
          const active = activeMonitorTab === tab;
          return (
            <TouchableOpacity
              key={tab}
              style={[styles.monitorTab, active && styles.monitorTabActive]}
              onPress={() => handleMonitorTabPress(tab)}
              activeOpacity={0.75}
            >
              <Text style={[styles.monitorTabText, active && styles.monitorTabTextActive]}>
                {tab}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* ── Report Sub-Tabs: Transparency / Submission ── */}
      <View style={styles.subTabBar}>
        {['Transparency', 'Submission'].map(sub => {
          const active = reportSubTab === sub;
          return (
            <TouchableOpacity
              key={sub}
              style={[styles.subTab, active && styles.subTabActive]}
              onPress={() => setReportSubTab(sub)}
              activeOpacity={0.8}
            >
              <Text style={[styles.subTabText, active && styles.subTabTextActive]}>{sub}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* ── Report Sub-title ── */}
      <Text style={styles.reportSubTitle}>
        {reportSubTab === 'Transparency'
          ? 'Full Disclosure Policy (FDP)  Monitoring Report'
          : 'Submission Compliance Report'}
      </Text>

      {/* ── Filter Row: All + Document + Year + Search + Save Report ── */}
      <View style={styles.filterRow}>
        {/* "All" toggle button */}
        <TouchableOpacity
          style={[styles.allBtn, isAllView && styles.allBtnActive]}
          onPress={() => setSelectedDoc('All')}
          activeOpacity={0.8}
        >
          <Text style={[styles.allBtnText, isAllView && styles.allBtnTextActive]}>All</Text>
        </TouchableOpacity>

        {/* Document type dropdown */}
        <Dropdown
          label="Document"
          value={isAllView ? 'Select...' : selectedDoc}
          options={DOCUMENT_OPTIONS}
          onSelect={(opt) => setSelectedDoc(opt)}
        />

        {/* Year dropdown */}
        <Dropdown
          label="Year"
          value={selectedYear}
          options={YEAR_OPTIONS}
          onSelect={setSelectedYear}
        />

        {/* Search box */}
        <View style={styles.searchBox}>
          <Text style={{ fontSize: 11, marginRight: 4, color: COLORS.midGray }}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Search"
            placeholderTextColor={COLORS.midGray}
            value={searchText}
            onChangeText={setSearchText}
          />
          {searchText.length > 0 && (
            <TouchableOpacity onPress={() => setSearchText('')}>
              <Text style={{ color: COLORS.midGray, fontSize: 11 }}>✕</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Spacer */}
        <View style={{ flex: 1 }} />

        {/* Save Report button */}
        <TouchableOpacity
          style={styles.saveReportBtn}
          onPress={openReportPreview}
          activeOpacity={0.85}
        >
          <View style={styles.saveReportIconWrap}>
            <View style={styles.saveReportArrow} />
            <View style={styles.saveReportArrowBase} />
          </View>
          <Text style={styles.saveReportText}>Save Report</Text>
        </TouchableOpacity>
      </View>

      {/* ── Report Title + Deadline ── */}
      <View style={styles.reportTitleRow}>
        <Text style={styles.reportTitle}>
          {isAllView
            ? 'Consolidated Compliance Report'
            : 'Report on the Monitoring of Full Disclosure Policy (FDP) Board Publications'
          }
        </Text>
        <Text style={styles.deadline}>
          Deadline : {selectedDocDeadline}
        </Text>
      </View>

      {/* ── Loading / error states ── */}
      {loading && (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>Loading report data…</Text>
        </View>
      )}

      {!loading && loadError && (
        <View style={styles.emptyState}>
          <Text style={[styles.emptyText, { color: COLORS.noPub }]}>
            Couldn't load the report: {loadError}
          </Text>
        </View>
      )}

      {/* ── Table ── */}
      {!loading && !loadError && (
      <View style={styles.tableContainer}>

        {/* ── ALL VIEW: Consolidated table with barangay groups ── */}
        {isAllView && (
          <>
            <View style={styles.tableHeader}>
              <View style={styles.colBarangay}>
                <Text style={styles.tableHeaderText}>Barangay</Text>
              </View>
              <View style={styles.colDocument}>
                <Text style={styles.tableHeaderText}>Document</Text>
              </View>
              <View style={styles.colDeadline}>
                <Text style={styles.tableHeaderText}>Submission Deadline</Text>
              </View>
              <View style={styles.colDateTime}>
                <Text style={[styles.tableHeaderText, { textAlign: 'right' }]}>
                  {reportSubTab === 'Transparency' ? 'Date Published' : 'Date Submitted'}
                </Text>
              </View>
              <View style={styles.colStatus}>
                <Text style={[styles.tableHeaderText, { textAlign: 'center' }]}>Status</Text>
              </View>
            </View>

            {consolidatedGroups.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>No records found.</Text>
              </View>
            ) : (
              consolidatedGroups.map((group, idx) => (
                <BarangayGroup key={group.barangay} group={group} index={idx} />
              ))
            )}
          </>
        )}

        {/* ── SPECIFIC DOC VIEW: Flat table ── */}
        {!isAllView && (
          <>
            <View style={styles.tableHeader}>
              <View style={styles.colBarangay}>
                <Text style={styles.tableHeaderText}>Barangay</Text>
              </View>
              <View style={styles.colDocument}>
                <Text style={styles.tableHeaderText}>Document</Text>
              </View>
              <View style={styles.colDateTime}>
                <Text style={[styles.tableHeaderText, { textAlign: 'right' }]}>
                  {reportSubTab === 'Transparency' ? 'Date Published' : 'Date Submitted'}
                </Text>
              </View>
              <View style={styles.colStatus}>
                <Text style={[styles.tableHeaderText, { textAlign: 'center' }]}>Status</Text>
              </View>
            </View>

            {singleDocRows.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>No records found.</Text>
              </View>
            ) : (
              singleDocRows.map((item, idx) => (
                <ReportRow key={item.id} item={item} isEven={idx % 2 !== 0} />
              ))
            )}
          </>
        )}

      </View>
      )}

    </ScrollView>
  );

  // ── Root ────────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.navy} />

      {/* Notification Modal — lists documents sent by SK officials */}
      <LydoNotificationModal
        {...notif.modalProps}
        onReview={() => { notif.close(); }}
      />

      <View style={styles.layout}>
        {/* Mobile: Sidebar as overlay */}
        {isMobile && sidebarVisible && (
          <TouchableOpacity
            style={styles.sidebarOverlay}
            activeOpacity={1}
            onPress={() => setSidebarVisible(false)}
          />
        )}

        <Sidebar
          activeTab={activeTab}
          onNavPress={handleNav}
          onLogout={handleLogout}
          isMobile={isMobile}
          sidebarVisible={sidebarVisible}
          navItems={LYDO_NAV_ITEMS}
          logoSource={require('./../../assets/images/lydo-logo.png')}
        />

        {renderContent()}
      </View>

      {/* Report Preview Modal */}
      <ReportPreviewModal
        visible={pdfModalVisible}
        onClose={() => { setPdfModalVisible(false); setPreviewHtml(null); }}
        loading={previewLoading}
        html={previewHtml}
        saving={savingReport}
        onSave={async () => {
          setSavingReport(true);
          try {
            const isTransparency = reportSubTab === 'Transparency';
            const reportType = isTransparency ? 'transparency' : 'submission';
            const filename = buildReportFilename(
              reportType,
              selectedDoc,
              selectedYear
            );

            // The preview HTML was already built by openReportPreview() when
            // the modal opened — reuse it rather than refetching, so what
            // the user reviewed is exactly what gets turned into the PDF.

            // Render the report HTML to a base64 PDF (no share sheet / no
            // browser print dialog) so we can hand it straight to Storage.
            const { base64 } = await renderReportToBase64({ html: previewHtml, filename });

            // Upload to the 'documents' bucket. compliance_documents.scanned_file_url
            // will point at this URL.
            const publicUrl = await uploadReportPdf({ base64, filename });

            // Persist the row so the report shows up in Documents > Reports.
            // barangayId comes from the logged-in LYDO user (the report
            // represents the LYDO office's own compliance snapshot, not
            // a specific barangay's submission — but the schema requires
            // barangay_id, so we pin it to the user's own barangay).
            await saveComplianceDocument({
              reportType,
              year: selectedYear,
              documentType: selectedDoc,
              barangayId: user?.barangayId,
              userId: user?.userId,
              fileUrl: publicUrl,
              remarks: `Generated on ${new Date().toLocaleString('en-PH', { timeZone: 'Asia/Manila' })}`,
            });

            setPdfModalVisible(false);
            setPreviewHtml(null);
            setSuccessModal({ visible: true, filename });
          } catch (err) {
            console.error('Failed to save report:', err);
            notify('Save Failed', err.message || 'Could not save the report. Please try again.');
          } finally {
            setSavingReport(false);
          }
        }}
        docLabel={selectedDoc}
        year={selectedYear}
        reportKind={reportSubTab === 'Transparency' ? 'transparency' : 'submission'}
      />

      {/* Save-success modal — pops up after the PDF finishes uploading and
          the compliance_documents row is written. "Go to Reports" routes to
          the Documents > Reports tab; "Stay Here" just dismisses. */}
      <SuccessModal
        visible={successModal.visible}
        filename={successModal.filename}
        onClose={() => setSuccessModal({ visible: false, filename: '' })}
        onGoToReports={() => {
          setSuccessModal({ visible: false, filename: '' });
          router.push('/(tabs)/lydo-document-reports');
        }}
      />
    </SafeAreaView>
  );
}


// ─── STYLES ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: COLORS.navy },
  layout: { flex: 1, flexDirection: 'row' },

  sidebarOverlay:         { position: 'absolute', left: 0, top: 0, bottom: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 5 },


  // ── Main ─────────────────────────────────────────────────────────────────────
  main:        { flex: 1, backgroundColor: COLORS.offWhite, borderTopLeftRadius: 20 },
  mainMobile:  { borderTopLeftRadius: 0 },
  mainContent: { padding: 20, paddingBottom: 40 },

  // ── Mobile header ────────────────────────────────────────────────────────────
  mobileHeader:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: COLORS.lightGray },
  menuBtn:            { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.cardBg, alignItems: 'center', justifyContent: 'center' },
  menuIconContainer:  { width: 20, height: 16, justifyContent: 'space-between' },
  menuLine:           { width: 20, height: 2, backgroundColor: COLORS.navy, borderRadius: 1 },
  mobileTitle:        { fontSize: 18, fontWeight: '800', color: COLORS.darkText },

  // ── Desktop header ───────────────────────────────────────────────────────────
  header:      { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 },
  headerSub:   { fontSize: 10, fontWeight: '600', color: COLORS.subText, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 2 },
  headerTitle: { fontSize: 20, fontWeight: '900', color: COLORS.darkText, letterSpacing: 0.5 },
  headerDesc: { fontSize: 15, fontWeight: '700', color: COLORS.darkText, marginTop: 6, lineHeight: 17 },

  // Datetime card
  datetimeCard: { backgroundColor: '#F7F5F2', borderRadius: 12, paddingVertical: 10, paddingHorizontal: 16, borderWidth: 1, borderColor: '#E0DDD9', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  datetimeRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  datetimeSeparator: { width: 1, height: 36, backgroundColor: '#D0CCC8', marginHorizontal: 4 },
  datetimeDivider: { width: 3, height: 28, borderRadius: 2, backgroundColor: '#133E75' },
  datetimeBlock: { flexDirection: 'column' },
  datetimeLabel: { fontSize: 9, fontWeight: '700', color: '#666666', letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 1 },
  datetimeValue: { fontSize: 13, fontWeight: '700', color: '#1A1A1A', letterSpacing: 0.2 },
  datetimeTime: { fontVariant: ['tabular-nums'], color: '#133E75', fontSize: 14, fontWeight: '800' },

  // Bell
  bellBtn:        { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.cardBg, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 6, elevation: 3 },
  bellWrapper:    { width: 20, height: 22, alignItems: 'center' },
  bellBody:       { width: 14, height: 12, borderRadius: 7, borderWidth: 2, borderColor: '#8B0000', marginTop: 4 },
  bellBottom:     { width: 8, height: 4, borderBottomLeftRadius: 4, borderBottomRightRadius: 4, backgroundColor: '#8B0000', marginTop: -1 },
  bellDot:        { position: 'absolute', top: 0, right: 1, width: 7, height: 7, borderRadius: 4, backgroundColor: COLORS.gold, borderWidth: 1.5, borderColor: COLORS.cardBg },
  notifBadge:     { position: 'absolute', top: -2, right: -2, width: 16, height: 16, borderRadius: 8, backgroundColor: COLORS.gold, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: COLORS.white },
  notifBadgeText: { fontSize: 8, fontWeight: '900', color: COLORS.navy },

  // ── Monitor tabs ─────────────────────────────────────────────────────────────
  monitorTabBar: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: COLORS.lightGray, marginBottom: 14, overflowX: 'hidden', overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.30, shadowRadius: 3, elevation: 6,},
  monitorTab: { flex: 1, paddingHorizontal: isMobile ? 8 : 40, backgroundColor: COLORS.navy, paddingVertical: 10, borderBottomWidth: 0, borderBottomColor: 'transparent', marginBottom: -1, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', alignItems: 'center' },
  monitorTabActive: { backgroundColor: COLORS.gold, borderRadius: 4, borderBottomColor: COLORS.gold, borderColor: COLORS.gold, shadowColor: COLORS.gold, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.4, shadowRadius: 4, elevation: 3 },
  monitorTabText: { fontSize: isMobile ? 10 : 13, fontWeight: '600', color: COLORS.white },
  monitorTabTextActive: { color: COLORS.darkText, fontWeight: '800' },

  // ── Filter row ───────────────────────────────────────────────────────────────
  filterRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14, flexWrap: 'wrap', zIndex: 100 },
  searchBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.white, borderRadius: 20, borderWidth: 1, borderColor: COLORS.lightGray, paddingHorizontal: 12, paddingVertical: 7, minWidth: 110, maxWidth: isMobile ? 140 : 190 },
  searchInput: { flex: 1, fontSize: 12, color: COLORS.darkText },

  // "All" button
  allBtn:         { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 8, borderWidth: 1, borderColor: COLORS.lightGray, backgroundColor: COLORS.white },
  allBtnActive:   { backgroundColor: COLORS.navy, borderColor: COLORS.navy },
  allBtnText:     { fontSize: 11, fontWeight: '700', color: COLORS.darkText },
  allBtnTextActive: { color: COLORS.white },

  // ── Report title + deadline ───────────────────────────────────────────────────
  reportTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 12, gap: 4 },
  reportTitle:    { fontSize: isMobile ? 11 : 13, fontWeight: '700', color: COLORS.darkText, flex: 1, lineHeight: 18 },
  deadline:       { fontSize: isMobile ? 10 : 12, fontWeight: '700', color: '#CC0000' },

  // ── Table ────────────────────────────────────────────────────────────────────
  tableContainer:  { backgroundColor: COLORS.white, borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: COLORS.lightGray, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6 },
  tableHeader:     { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.white, paddingVertical: 11, paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: COLORS.lightGray },
  tableHeaderText: { fontSize: isMobile ? 10 : 12, fontWeight: '700', color: COLORS.darkText, letterSpacing: 0.2 },
  tableRow:        { flexDirection: 'row', alignItems: 'center', paddingVertical: 11, paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: COLORS.lightGray, backgroundColor: COLORS.white },
  tableRowEven:    { backgroundColor: '#FAFAFA' },
  indentedRow:     { paddingLeft: 14 },

  // Barangay group header row (consolidated view)
  barangayHeaderRow:    { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 10, paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: COLORS.lightGray, backgroundColor: COLORS.white },
  barangayHeaderRowAlt: { backgroundColor: '#FAFAFA' },
  barangayHeaderText:   { fontSize: isMobile ? 11 : 13, fontWeight: '800', color: COLORS.darkText },
  expandedLabel:        { fontSize: 9, color: COLORS.subText, fontStyle: 'italic', marginTop: 2 },
  chevron:              { fontSize: isMobile ? 11 : 13, color: COLORS.darkText, fontWeight: '700', marginLeft: 6 },

  colBarangay: { width: isMobile ? 80 : 150, paddingRight: 8 },
  colDocument: { flex: 1, paddingRight: 8 },
  colDeadline: { width: isMobile ? 70 : 120, paddingRight: 8 },
  colDateTime: { width: isMobile ? 65 : 100, alignItems: 'flex-end', paddingRight: 8 },
  colStatus:   { width: isMobile ? 90 : 130, alignItems: 'flex-start' },

  cellBarangay: { fontSize: isMobile ? 10 : 12, fontWeight: '600', color: COLORS.darkText },
  cellDocument: { fontSize: isMobile ? 9 : 11, color: COLORS.subText, lineHeight: 16 },
  cellDeadline: { fontSize: isMobile ? 8 : 10, color: COLORS.subText, lineHeight: 14 },
  cellTime:     { fontSize: 9, color: COLORS.subText, textAlign: 'right' },
  cellDate:     { fontSize: 9, color: COLORS.subText, textAlign: 'right' },

  emptyState: { alignItems: 'center', paddingVertical: 40 },
  emptyText:  { fontSize: 14, color: COLORS.midGray },

  // ── Report Sub-Tabs ───────────────────────────────────────────────────────────
  subTabBar:         { flexDirection: 'row', gap: 8, marginBottom: 10, marginTop: 4 },
  subTab:            { paddingHorizontal: 16, paddingVertical: 7, borderRadius: 20, backgroundColor: COLORS.navy },
  subTabActive:      { backgroundColor: COLORS.gold },
  subTabText:        { fontSize: 12, fontWeight: '700', color: COLORS.white },
  subTabTextActive:  { color: COLORS.darkText },

  // ── Report sub-title ─────────────────────────────────────────────────────────
  reportSubTitle:    { fontSize: isMobile ? 12 : 14, fontWeight: '700', color: COLORS.navy, marginBottom: 12 },

  // ── Save Report button ───────────────────────────────────────────────────────
  saveReportBtn:     { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: COLORS.white, borderRadius: 8, borderWidth: 1.5, borderColor: COLORS.lightGray, paddingHorizontal: 12, paddingVertical: 8, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4 },
  saveReportText:    { fontSize: 12, fontWeight: '700', color: COLORS.darkText },
  saveReportIconWrap:{ alignItems: 'center', justifyContent: 'center', width: 14, height: 14 },
  saveReportArrow:   { width: 0, height: 0, borderLeftWidth: 4, borderRightWidth: 4, borderTopWidth: 6, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderTopColor: COLORS.navy },
  saveReportArrowBase: { width: 7, height: 2, backgroundColor: COLORS.navy, marginTop: 1 },

  // ── Bottom PDF button ─────────────────────────────────────────────────────────
  bottomActions: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 16 },
  pdfBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: COLORS.white,
    borderRadius: 8, borderWidth: 1.5, borderColor: COLORS.lightGray,
    paddingHorizontal: 14, paddingVertical: 9,
    elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4,
  },
  pdfBtnText:      { fontSize: 12, fontWeight: '700', color: COLORS.darkText },
  pdfBtnIconWrap:  { alignItems: 'center', justifyContent: 'center', width: 14, height: 14 },
  pdfBtnArrow:     { width: 0, height: 0, borderLeftWidth: 4, borderRightWidth: 4, borderTopWidth: 6, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderTopColor: COLORS.navy },
  pdfBtnArrowBase: { width: 7, height: 2, backgroundColor: COLORS.navy, marginTop: 1 },
});