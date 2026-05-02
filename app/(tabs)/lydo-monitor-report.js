import React, { useState } from 'react';
import {
  View, Text, TextInput, ScrollView, TouchableOpacity,
  StyleSheet, SafeAreaView, StatusBar, Dimensions,
  Modal, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useNav } from './navContext';
import { useAuth } from './authContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const isMobile = SCREEN_WIDTH < 768;

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

const NAV_TABS     = ['Home', 'Documents', 'Monitor'];
const MONITOR_TABS = ['Consultation', 'Budget', 'Report', 'Submitted'];

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
const DOC_FULL_NAMES = {
  CBYDP:          'CBYDP',
  ABYIP:          'Annual Budget Youth Investment Program',
  'SK Budget':    'Annual Budget 2026',
  Accomplishment: 'Monthly Itemized List',
};

// ─── CONSOLIDATED DATA (for "All" view) ───────────────────────────────────────
// Each barangay has rows per document type
const CONSOLIDATED_DATA = [
  {
    barangay: 'Barangay San Jose',
    docs: [
      { docType: 'CBYDP',       document: 'CBYDP',                                    deadline: 'January 6, 2026', time: '3:00 PM', date: '1/02/2026', status: 'on_time' },
      { docType: 'SK Budget',   document: 'Annual Budget 2026',                        deadline: 'January 6, 2026', time: '3:00 PM', date: '1/02/2026', status: 'late'    },
      { docType: 'ABYIP',       document: 'Annual Budget Youth Investment Program',    deadline: 'January 6, 2026', time: null,      date: null,         status: 'no_pub'  },
      { docType: 'Cash',        document: 'Register of Cash in Bank',                 deadline: 'January 6, 2026', time: '3:00 PM', date: '1/02/2026', status: 'on_time' },
      { docType: 'Accomp',      document: 'Monthly Itemized List',                    deadline: 'January 6, 2026', time: '3:00 PM', date: '1/02/2026', status: 'on_time' },
    ],
  },
  {
    barangay: 'Barangay San Roque',
    docs: [
      { docType: 'CBYDP',       document: 'CBYDP',                                    deadline: 'January 6, 2026', time: '3:00 PM', date: '1/02/2026', status: 'on_time' },
      { docType: 'SK Budget',   document: 'Annual Budget 2026',                        deadline: 'January 6, 2026', time: '3:00 PM', date: '1/02/2026', status: 'late'    },
      { docType: 'ABYIP',       document: 'Annual Budget Youth Investment Program',    deadline: 'January 6, 2026', time: null,      date: null,         status: 'no_pub'  },
      { docType: 'Cash',        document: 'Register of Cash in Bank',                 deadline: 'January 6, 2026', time: '3:00 PM', date: '1/02/2026', status: 'on_time' },
      { docType: 'Accomp',      document: 'Monthly Itemized List',                    deadline: 'January 6, 2026', time: '3:00 PM', date: '1/02/2026', status: 'on_time' },
    ],
  },
  {
    barangay: 'Barangay Santo Cristo',
    docs: [
      { docType: 'CBYDP',       document: 'CBYDP',                                    deadline: 'January 6, 2026', time: '3:00 PM', date: '1/02/2026', status: 'on_time' },
      { docType: 'SK Budget',   document: 'Annual Budget 2026',                        deadline: 'January 6, 2026', time: '3:00 PM', date: '1/02/2026', status: 'late'    },
      { docType: 'ABYIP',       document: 'Annual Budget Youth Investment Program',    deadline: 'January 6, 2026', time: null,      date: null,         status: 'no_pub'  },
      { docType: 'Cash',        document: 'Register of Cash in Bank',                 deadline: 'January 6, 2026', time: '3:00 PM', date: '1/02/2026', status: 'on_time' },
      { docType: 'Accomp',      document: 'Monthly Itemized List',                    deadline: 'January 6, 2026', time: '3:00 PM', date: '1/02/2026', status: 'on_time' },
    ],
  },
  {
    barangay: 'Barangay Antipolo',
    docs: [
      { docType: 'CBYDP',       document: 'CBYDP',                                    deadline: 'January 6, 2026', time: '9:00 AM', date: '1/05/2026', status: 'on_time' },
      { docType: 'SK Budget',   document: 'Annual Budget 2026',                        deadline: 'January 6, 2026', time: '9:00 AM', date: '1/05/2026', status: 'on_time' },
      { docType: 'ABYIP',       document: 'Annual Budget Youth Investment Program',    deadline: 'January 6, 2026', time: null,      date: null,         status: 'no_pub'  },
      { docType: 'Cash',        document: 'Register of Cash in Bank',                 deadline: 'January 6, 2026', time: '9:00 AM', date: '1/05/2026', status: 'on_time' },
      { docType: 'Accomp',      document: 'Monthly Itemized List',                    deadline: 'January 6, 2026', time: '9:00 AM', date: '1/05/2026', status: 'late'    },
    ],
  },
];

// ─── SINGLE-DOC REPORT DATA (for specific document type views) ────────────────
const REPORT_ROWS = [
  { id: '1', barangay: 'Barangay San Jose',    document: 'Annual Budget Youth Investment Program 2026', time: '3:00 PM',  date: '1/02/2026', status: 'on_time', docType: 'ABYIP' },
  { id: '2', barangay: 'Barangay San Roque',   document: 'Annual Budget Youth Investment Program 2026', time: '3:00 PM',  date: '1/02/2026', status: 'late',    docType: 'ABYIP' },
  { id: '3', barangay: 'Barangay Santo Cristo', document: 'Annual Budget Youth Investment Program 2026', time: '3:00 PM', date: '1/02/2026', status: 'no_pub',  docType: 'ABYIP' },
  { id: '4', barangay: 'Barangay Antipolo',    document: 'Annual Budget Youth Investment Program 2026', time: '9:00 AM',  date: '1/05/2026', status: 'on_time', docType: 'ABYIP' },
  { id: '5', barangay: 'Barangay Banot',       document: 'Annual Budget Youth Investment Program 2026', time: '10:00 AM', date: '1/06/2026', status: 'late',    docType: 'ABYIP' },
  { id: '6', barangay: 'Barangay Mamala',      document: 'Annual Budget Youth Investment Program 2026', time: '2:00 PM',  date: '1/08/2026', status: 'no_pub',  docType: 'ABYIP' },

  { id: '7',  barangay: 'Barangay San Jose',    document: 'CBYDP 2026',          time: '3:00 PM',  date: '1/02/2026', status: 'on_time', docType: 'CBYDP' },
  { id: '8',  barangay: 'Barangay San Roque',   document: 'CBYDP 2026',          time: '3:00 PM',  date: '1/02/2026', status: 'on_time', docType: 'CBYDP' },
  { id: '9',  barangay: 'Barangay Santo Cristo', document: 'CBYDP 2026',         time: '3:00 PM',  date: '1/02/2026', status: 'late',    docType: 'CBYDP' },
  { id: '10', barangay: 'Barangay Antipolo',    document: 'CBYDP 2026',          time: '9:00 AM',  date: '1/05/2026', status: 'on_time', docType: 'CBYDP' },

  { id: '11', barangay: 'Barangay San Jose',    document: 'SK Annual Budget 2026', time: '3:00 PM',  date: '1/02/2026', status: 'late',    docType: 'SK Budget' },
  { id: '12', barangay: 'Barangay San Roque',   document: 'SK Annual Budget 2026', time: '3:00 PM',  date: '1/02/2026', status: 'on_time', docType: 'SK Budget' },
  { id: '13', barangay: 'Barangay Santo Cristo', document: 'SK Annual Budget 2026', time: null,      date: null,         status: 'no_pub',  docType: 'SK Budget' },

  { id: '14', barangay: 'Barangay San Jose',    document: 'Accomplishment Report 2026', time: '3:00 PM', date: '1/02/2026', status: 'on_time', docType: 'Accomplishment' },
  { id: '15', barangay: 'Barangay San Roque',   document: 'Accomplishment Report 2026', time: null,      date: null,        status: 'no_pub',  docType: 'Accomplishment' },
  { id: '16', barangay: 'Barangay Antipolo',    document: 'Accomplishment Report 2026', time: '9:00 AM', date: '1/05/2026', status: 'late',    docType: 'Accomplishment' },
];

// Deadline per doc type
const DOC_DEADLINES = {
  ABYIP:          'January 14, 2026',
  CBYDP:          'January 10, 2026',
  'SK Budget':    'January 12, 2026',
  Accomplishment: 'January 20, 2026',
};

// ─── ICONS ────────────────────────────────────────────────────────────────────
const BellIcon = ({ hasNotif }) => (
  <View style={styles.bellWrapper}>
    <View style={styles.bellBody} />
    <View style={styles.bellBottom} />
    {hasNotif && <View style={styles.bellDot} />}
  </View>
);

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

// ─── PDF DOWNLOAD MODAL ───────────────────────────────────────────────────────
const PdfDownloadModal = ({ visible, onClose, onDownload, docLabel, year }) => {
  if (!visible) return null;
  const isAll = docLabel === 'All';
  const filename = isAll
    ? `SK_Rizal_Full_Compliance_Report_${year}.pdf`
    : `SK_Rizal_${docLabel}_Report_${year}.pdf`;
  const docName = isAll
    ? 'Full Compliance Report'
    : `${docLabel} Report`;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={PDF.overlay}>
        <View style={PDF.sheet}>
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
            <Text style={PDF.title}>PDF Download Ready</Text>
            <TouchableOpacity style={PDF.closeBtn} onPress={onClose} activeOpacity={0.8}>
              <Text style={PDF.closeX}>✕</Text>
            </TouchableOpacity>
          </View>

          <View style={PDF.divider} />

          {/* ── Body ── */}
          <View style={PDF.body}>
            <Text style={PDF.bodyText}>
              Your summary Report for{' '}
              <Text style={PDF.bold}>Rizal, Laguna</Text>
            </Text>
            <Text style={[PDF.bodyText, { marginTop: 6 }]}>
              <Text style={PDF.bold}>{docName} {year}</Text>{' '}
              is now ready to download
            </Text>
            <Text style={PDF.filename}>{filename}</Text>
          </View>

          {/* ── Actions ── */}
          <View style={PDF.btnRow}>
            <TouchableOpacity
              style={PDF.downloadBtn}
              onPress={() => { onDownload(); onClose(); }}
              activeOpacity={0.85}
            >
              <View style={PDF.dlIconWrap}>
                <View style={PDF.dlIconArrow} />
                <View style={PDF.dlIconLine} />
              </View>
              <Text style={PDF.downloadText}>Download PDF [892 KB]</Text>
            </TouchableOpacity>
            <TouchableOpacity style={PDF.cancelBtn} onPress={onClose} activeOpacity={0.8}>
              <Text style={PDF.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const PDF = StyleSheet.create({
  overlay:         { flex: 1, backgroundColor: 'rgba(0,0,0,0.50)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  sheet:           { backgroundColor: COLORS.white, borderRadius: 14, width: '100%', maxWidth: 380, overflow: 'hidden', elevation: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.25, shadowRadius: 20 },
  header:          { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12 },
  pdfIconWrap:     { width: 36, height: 36, borderRadius: 6, backgroundColor: '#F5F5F5', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  pdfIconPage:     { width: 28, height: 32, backgroundColor: COLORS.white, borderRadius: 3, borderWidth: 1, borderColor: '#E0E0E0', overflow: 'hidden' },
  pdfIconRedBar:   { backgroundColor: '#CC0000', paddingVertical: 2, alignItems: 'center' },
  pdfIconRedText:  { fontSize: 6, fontWeight: '900', color: COLORS.white, letterSpacing: 0.5 },
  pdfIconLines:    { paddingHorizontal: 3, paddingTop: 3, gap: 2 },
  pdfIconLine:     { height: 2, backgroundColor: '#D0D0D0', borderRadius: 1 },
  title:           { flex: 1, fontSize: 15, fontWeight: '800', color: COLORS.darkText },
  closeBtn:        { width: 28, height: 28, borderRadius: 14, backgroundColor: COLORS.lightGray, alignItems: 'center', justifyContent: 'center' },
  closeX:          { fontSize: 11, color: COLORS.subText, fontWeight: '700' },
  divider:         { height: 1, backgroundColor: COLORS.lightGray },
  body:            { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 10 },
  bodyText:        { fontSize: 13, color: COLORS.darkText, lineHeight: 20 },
  bold:            { fontWeight: '700' },
  filename:        { marginTop: 10, fontSize: 11, color: COLORS.subText },
  btnRow:          { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingBottom: 16, paddingTop: 12 },
  downloadBtn:     { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: COLORS.navy, borderRadius: 8, paddingVertical: 11 },
  cancelBtn:       { paddingHorizontal: 16, paddingVertical: 11, borderRadius: 8, borderWidth: 1.5, borderColor: COLORS.midGray, alignItems: 'center', justifyContent: 'center' },
  downloadText:    { fontSize: 12, fontWeight: '700', color: COLORS.white },
  cancelText:      { fontSize: 12, fontWeight: '600', color: COLORS.subText },
  dlIconWrap:      { alignItems: 'center', justifyContent: 'center', width: 16, height: 16 },
  dlIconArrow:     { width: 0, height: 0, borderLeftWidth: 5, borderRightWidth: 5, borderTopWidth: 7, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderTopColor: COLORS.white },
  dlIconLine:      { width: 8, height: 2, backgroundColor: COLORS.white, marginTop: 1 },
});

// ─── MAIN SCREEN ──────────────────────────────────────────────────────────────
export default function LYDOMonitorReportScreen() {
  const router = useRouter();
  const { activeTab, setActiveTab } = useNav();
  const { logout } = useAuth();

  const [activeMonitorTab, setActiveMonitorTab] = useState('Report');
  // 'All' means show consolidated view; specific doc shows single-doc view
  const [selectedDoc,  setSelectedDoc]  = useState('All');
  const [selectedYear, setSelectedYear] = useState('2026');
  const [searchText,   setSearchText]   = useState('');
  const [notifCount]                    = useState(2);
  const [sidebarVisible, setSidebarVisible] = useState(false);
  const [pdfModalVisible, setPdfModalVisible] = useState(false);

  const isAllView = selectedDoc === 'All';

  // ── Navigation ──────────────────────────────────────────────────────────────
  const handleNavPress = (tab) => {
    setActiveTab(tab);
    setSidebarVisible(false);
    if (tab === 'Home')      router.push('/(tabs)/lydo-home');
    if (tab === 'Documents') router.push('/(tabs)/lydo-document');
    if (tab === 'Monitor')   router.push('/(tabs)/lydo-monitor');
  };

  const handleLogout = () => {
    logout();
    router.replace('/');
  };

  const handleMonitorTabPress = (tab) => {
    if (tab === 'Consultation') { router.push('/(tabs)/lydo-monitor'); return; }
    if (tab === 'Budget')       { router.push('/(tabs)/lydo-monitor-budget'); return; }
    if (tab === 'Submitted')    { router.push('/(tabs)/lydo-monitor-submitted'); return; }
    setActiveMonitorTab(tab);
  };

  // ── Filtered data ────────────────────────────────────────────────────────────
  // Single-doc view rows
  const singleDocRows = REPORT_ROWS.filter(r =>
    r.docType === selectedDoc &&
    (r.barangay.toLowerCase().includes(searchText.toLowerCase()) ||
     r.document.toLowerCase().includes(searchText.toLowerCase()))
  );

  // Consolidated view groups (filter barangays by search)
  const consolidatedGroups = CONSOLIDATED_DATA.filter(g =>
    g.barangay.toLowerCase().includes(searchText.toLowerCase()) ||
    g.docs.some(d => d.document.toLowerCase().includes(searchText.toLowerCase()))
  );

  // ── Sidebar ─────────────────────────────────────────────────────────────────
  const renderSidebar = () => (
    <View style={styles.sidebar}>
      <View style={styles.logoPill}>
        <View style={styles.logoCircle}>
          <Text style={styles.logoText}>LYDO</Text>
        </View>
      </View>
      <View style={{ height: 28 }} />
      {NAV_TABS.map(tab => {
        const active = activeTab === tab;
        return (
          <TouchableOpacity
            key={tab}
            style={[styles.navItem, active && styles.navItemActive]}
            onPress={() => handleNavPress(tab)}
            activeOpacity={0.8}
          >
            <Text style={[styles.navLabel, active && styles.navLabelActive]}>{tab}</Text>
          </TouchableOpacity>
        );
      })}
      <View style={{ flex: 1 }} />
      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.8}>
        <Text style={styles.logoutText}>Logout</Text>
      </TouchableOpacity>
    </View>
  );

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
          <TouchableOpacity style={styles.bellBtn}>
            <BellIcon hasNotif={notifCount > 0} />
          </TouchableOpacity>
        </View>
      )}

      {/* Desktop Header */}
      {!isMobile && (
        <View style={styles.header}>
          <View>
            <Text style={styles.headerSub}>SANGGUNIANG KABATAAN FEDERATION</Text>
            <Text style={styles.headerTitle}>RIZAL, LAGUNA</Text>
          </View>
          <TouchableOpacity style={styles.bellBtn} activeOpacity={0.7}>
            <BellIcon hasNotif={notifCount > 0} />
            {notifCount > 0 && (
              <View style={styles.notifBadge}>
                <Text style={styles.notifBadgeText}>{notifCount}</Text>
              </View>
            )}
          </TouchableOpacity>
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
        <View style={styles.monitorTabFiller} />
      </View>

      {/* ── Filter Row: All button + Document Dropdown + Year + Search ── */}
      <View style={styles.filterRow}>
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
      </View>

      {/* ── Report Title + Deadline ── */}
      <View style={styles.reportTitleRow}>
        <Text style={styles.reportTitle}>
          {isAllView
            ? 'Consolidated Compliance Report'
            : 'Report on the Monitoring of Full Disclosure Policy (FDP) Board Publications'
          }
        </Text>
        {!isAllView && (
          <Text style={styles.deadline}>
            Deadline : {DOC_DEADLINES[selectedDoc] ?? 'January 14, 2026'}
          </Text>
        )}
      </View>

      {/* ── Table ── */}
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
                <Text style={[styles.tableHeaderText, { textAlign: 'right' }]}>Date Published</Text>
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
                <Text style={[styles.tableHeaderText, { textAlign: 'right' }]}>Date Published</Text>
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

      {/* ── Full Compliance Report PDF Button (bottom-right) ── */}
      <View style={styles.bottomActions}>
        <TouchableOpacity
          style={styles.pdfBtn}
          onPress={() => setPdfModalVisible(true)}
          activeOpacity={0.85}
        >
          <Text style={styles.pdfBtnText}>Full Compliance Report [PDF]</Text>
          <View style={styles.pdfBtnIconWrap}>
            <View style={styles.pdfBtnArrow} />
            <View style={styles.pdfBtnArrowBase} />
          </View>
        </TouchableOpacity>
      </View>

    </ScrollView>
  );

  // ── Root ────────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.navy} />

      <View style={styles.layout}>
        {/* Mobile: Sidebar as overlay */}
        {isMobile && sidebarVisible && (
          <TouchableOpacity
            style={styles.sidebarOverlay}
            activeOpacity={1}
            onPress={() => setSidebarVisible(false)}
          />
        )}

        {isMobile ? (
          sidebarVisible && renderSidebar()
        ) : (
          renderSidebar()
        )}

        {renderContent()}
      </View>

      {/* PDF Download Modal */}
      <PdfDownloadModal
        visible={pdfModalVisible}
        onClose={() => setPdfModalVisible(false)}
        onDownload={() =>
          Alert.alert('Download Started', `Report for ${selectedDoc} ${selectedYear} is downloading.`)
        }
        docLabel={selectedDoc}
        year={selectedYear}
      />
    </SafeAreaView>
  );
}

// ─── STYLES ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: COLORS.navy },
  layout: { flex: 1, flexDirection: 'row' },

  // ── Sidebar ──────────────────────────────────────────────────────────────────
  sidebar:                { width: 250, backgroundColor: COLORS.navy, alignItems: 'center', paddingTop: 20, paddingBottom: 24, paddingHorizontal: 10, zIndex: 10 },
  sidebarOverlay:         { position: 'absolute', left: 0, top: 0, bottom: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 5 },

  logoPill:   { width: 70, height: 70, borderRadius: 35, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center', marginBottom: 8, borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)' },
  logoCircle: { width: 52, height: 52, borderRadius: 26, backgroundColor: COLORS.gold, alignItems: 'center', justifyContent: 'center' },
  logoText:   { fontSize: 14, fontWeight: '900', color: COLORS.navy, letterSpacing: 0.5 },

  navItem:        { width: '100%', paddingVertical: 12, paddingHorizontal: 12, borderRadius: 24, marginBottom: 8, alignItems: 'center', borderWidth: 1.5, borderColor: COLORS.white, backgroundColor: COLORS.navy },
  navItemActive:  { backgroundColor: COLORS.white, borderColor: COLORS.white },
  navLabel:       { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.8)', letterSpacing: 0.3 },
  navLabelActive: { color: '#000', fontWeight: '800' },

  logoutBtn:  { width: '100%', paddingVertical: 12, paddingHorizontal: 12, borderRadius: 24, marginTop: 8, alignItems: 'center', borderWidth: 1.5, borderColor: COLORS.white, backgroundColor: 'rgba(255,255,255,0.1)' },
  logoutText: { fontSize: 13, fontWeight: '600', color: '#ffffff', letterSpacing: 0.3 },

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
  monitorTab: { flex: 'auto', paddingHorizontal: isMobile ? 8 : 175, backgroundColor: COLORS.navy, paddingVertical: 10, borderBottomWidth: 0, borderBottomColor: 'transparent', marginBottom: -1, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', alignItems: 'center' },
  monitorTabActive: { backgroundColor: COLORS.gold, borderRadius: 4, borderBottomColor: COLORS.gold, borderColor: COLORS.gold, shadowColor: COLORS.gold, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.4, shadowRadius: 4, elevation: 3 },
  monitorTabText: { fontSize: isMobile ? 10 : 13, fontWeight: '600', color: COLORS.white },
  monitorTabTextActive: { color: COLORS.darkText, fontWeight: '800' },
  monitorTabFiller: { flex: 1 },

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
  reportTitleRow: { flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', alignItems: isMobile ? 'flex-start' : 'flex-end', marginBottom: 12, gap: 4 },
  reportTitle:    { fontSize: isMobile ? 11 : 13, fontWeight: '700', color: COLORS.darkText, flex: 1, lineHeight: 18 },
  deadline:       { fontSize: isMobile ? 10 : 12, fontWeight: '700', color: COLORS.navy },

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