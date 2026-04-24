import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useNav } from './navContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const isMobile = SCREEN_WIDTH < 768;

// ─── COLORS ───────────────────────────────────────────────────────────────────
const COLORS = {
  maroon:    '#8B0000',
  navy:      '#133E75',
  gold:      '#E8C547',
  white:     '#FFFFFF',
  offWhite:  '#F7F5F2',
  lightGray: '#ECECEC',
  midGray:   '#B0B0B0',
  darkText:  '#1A1A1A',
  subText:   '#666666',
  cardBg:    '#FFFFFF',
};

const NAV_TABS     = ['Home', 'Documents', 'Monitor'];
const MONITOR_TABS = ['Consultation', 'Budget', 'Report', 'Submitted'];

// ─── TABLE DATA ───────────────────────────────────────────────────────────────
// approvedDate: null  → row only appears in "Term for revisions papers" view
// approvedDate: set   → row appears in both views
const TABLE_DATA = {
  Consultation: [
    { id: '1', barangay: 'Barangay San Jose',     document: 'Comprehensive Barangay Youth Development Program', time: '3:00 PM', feedbackDate: '1/02/2026', approvedDate: null },
    { id: '2', barangay: 'Barangay San Roque',    document: 'Comprehensive Barangay Youth Development Program', time: '3:00 PM', feedbackDate: '1/02/2026', approvedDate: '1/05/2026' },
    { id: '3', barangay: 'Barangay Santo Cristo', document: 'Comprehensive Barangay Youth Development Program', time: '3:00 PM', feedbackDate: '1/02/2026', approvedDate: null },
  ],
  Budget: [
    { id: '1', barangay: 'Barangay Antipolo',    document: 'Annual Budget Proposal 2026',       time: '9:00 AM',  feedbackDate: '1/05/2026', approvedDate: '1/08/2026' },
    { id: '2', barangay: 'Barangay San Isidro',  document: 'Supplemental Budget Request Q1',    time: '10:30 AM', feedbackDate: '1/06/2026', approvedDate: null },
    { id: '3', barangay: 'Barangay Banot',       document: 'SK Fund Utilization Report',         time: '2:00 PM',  feedbackDate: '1/07/2026', approvedDate: null },
    { id: '4', barangay: 'Barangay Mamala',      document: 'Capital Outlay Budget 2026',         time: '4:00 PM',  feedbackDate: '1/08/2026', approvedDate: '1/10/2026' },
  ],
  Report: [
    { id: '1', barangay: 'Barangay Taquico',   document: 'Q4 2025 Accomplishment Report',                   time: '8:00 AM',  feedbackDate: '1/10/2026', approvedDate: null },
    { id: '2', barangay: 'Barangay Bayongon',  document: 'Activity Documentation — Linggo ng Kabataan',     time: '11:00 AM', feedbackDate: '1/11/2026', approvedDate: '1/14/2026' },
    { id: '3', barangay: 'Barangay Apasan',    document: 'Minutes of the Meeting — January Session',        time: '1:00 PM',  feedbackDate: '1/12/2026', approvedDate: null },
  ],
  Submitted: [
    { id: '1', barangay: 'Barangay San Jose',    document: 'Comprehensive Barangay Youth Development Program', time: '3:00 PM',  feedbackDate: '12/15/2025', approvedDate: '12/20/2025' },
    { id: '2', barangay: 'Barangay San Bueno',   document: 'Financial Report Summary 2025',                    time: '2:30 PM',  feedbackDate: '12/18/2025', approvedDate: null },
    { id: '3', barangay: 'Barangay San Isidro',  document: 'Resolutions & Ordinances Compilation',             time: '9:00 AM',  feedbackDate: '12/20/2025', approvedDate: '12/24/2025' },
    { id: '4', barangay: 'Barangay Antipolo',    document: 'Work Plan 2026',                                   time: '10:00 AM', feedbackDate: '12/22/2025', approvedDate: null },
    { id: '5', barangay: 'Barangay Mamala',      document: 'Event Reports — Year-End Activities',              time: '3:00 PM',  feedbackDate: '12/28/2025', approvedDate: '12/30/2025' },
  ],
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
    {[0,1,2].map(i => <View key={i} style={styles.menuLine} />)}
  </View>
);

// ─── TABLE ROW ────────────────────────────────────────────────────────────────
const TableRow = ({ item, isEven, viewFilter }) => {
  const dateVal = viewFilter === 'approved' ? item.approvedDate : item.feedbackDate;
  return (
    <View style={[styles.tableRow, isEven && styles.tableRowEven]}>
      <View style={styles.colBarangay}>
        <Text style={styles.cellBarangay}>{item.barangay}</Text>
      </View>
      <View style={styles.colDocument}>
        <Text style={styles.cellDocument} numberOfLines={isMobile ? 2 : 1}>{item.document}</Text>
      </View>
      <View style={styles.colDateTime}>
        <Text style={styles.cellTime}>{item.time}</Text>
        <Text style={styles.cellDate}>{dateVal ?? '—'}</Text>
      </View>
      <View style={styles.colAction}>
        <TouchableOpacity style={styles.viewBtn} activeOpacity={0.75}>
          <Text style={styles.viewBtnText}>View</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

// ─── MAIN SCREEN ──────────────────────────────────────────────────────────────
export default function LYDOMonitorScreen() {
  const router = useRouter();
  const { activeTab, setActiveTab } = useNav();

  const [activeMonitorTab, setActiveMonitorTab] = useState('Consultation');
  // 'revision' = "Term for revisions papers" | 'approved' = "Approved"
  const [viewFilter, setViewFilter]         = useState('revision');
  const [searchText, setSearchText]         = useState('');
  const [notifCount]                        = useState(2);
  const [sidebarVisible, setSidebarVisible] = useState(false);

  useEffect(() => { setActiveTab('Monitor'); }, []);

  const handleNavPress = (tab) => {
    setActiveTab(tab);
    setSidebarVisible(false);
    if (tab === 'Home')      router.push('/(tabs)/lydo-home');
    if (tab === 'Documents') router.push('/(tabs)/lydo-document');
  };

  // Filter rows: 'approved' view only shows rows that have an approvedDate
  const rows = (TABLE_DATA[activeMonitorTab] || [])
    .filter(r => viewFilter === 'approved' ? r.approvedDate !== null : true)
    .filter(r =>
      r.barangay.toLowerCase().includes(searchText.toLowerCase()) ||
      r.document.toLowerCase().includes(searchText.toLowerCase())
    );

  // Date column header changes based on active filter
  const dateColLabel = viewFilter === 'approved' ? 'Approved Date' : 'Date of Feedback';

  // ── Sidebar ──────────────────────────────────────────────────────────────────
  const renderSidebar = () => (
    <View style={styles.sidebar}>
      <View style={styles.logoPill}>
        <View style={styles.logoCircle}>
          <Text style={styles.logoText}>SK</Text>
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
    </View>
  );

  // ── Main content ─────────────────────────────────────────────────────────────
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
          <Text style={styles.mobileTitle}>Monitor</Text>
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
              onPress={() => { setActiveMonitorTab(tab); setSearchText(''); setViewFilter('revision'); }}
              activeOpacity={0.75}
            >
              <Text style={[styles.monitorTabText, active && styles.monitorTabTextActive]}>{tab}</Text>
            </TouchableOpacity>
          );
        })}
        <View style={styles.monitorTabFiller} />
      </View>

      {/* ── Filter Row ── */}
      <View style={styles.filterRow}>

        {/* Search */}
        <View style={styles.searchBox}>
          <Text style={{ fontSize: 12, marginRight: 5 }}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Search"
            placeholderTextColor={COLORS.midGray}
            value={searchText}
            onChangeText={setSearchText}
          />
          {searchText.length > 0 && (
            <TouchableOpacity onPress={() => setSearchText('')}>
              <Text style={{ color: COLORS.midGray, fontSize: 12 }}>✕</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* ── "Term for revisions papers" toggle ── */}
        <TouchableOpacity
          style={[
            styles.filterToggleBtn,
            viewFilter === 'revision'
              ? styles.filterToggleRevisionOn    // gold — active
              : styles.filterToggleOff,          // gray — inactive
          ]}
          onPress={() => setViewFilter('revision')}
          activeOpacity={0.8}
        >
          <Text
            style={[
              styles.filterToggleText,
              viewFilter === 'revision' ? { color: COLORS.darkText } : { color: COLORS.subText },
            ]}
            numberOfLines={1}
          >
            Term for revisions papers
          </Text>
        </TouchableOpacity>

        {/* ── "Approved" toggle ── */}
        <TouchableOpacity
          style={[
            styles.filterToggleBtn,
            viewFilter === 'approved'
              ? styles.filterToggleApprovedOn    // navy blue — active
              : styles.filterToggleOff,          // gray — inactive
          ]}
          onPress={() => setViewFilter('approved')}
          activeOpacity={0.8}
        >
          <Text
            style={[
              styles.filterToggleText,
              { color: viewFilter === 'approved' ? COLORS.white : COLORS.subText },
            ]}
          >
            Approved
          </Text>
        </TouchableOpacity>

      </View>

      {/* ── Table ── */}
      <View style={styles.tableContainer}>
        {/* Header row */}
        <View style={styles.tableHeader}>
          <View style={styles.colBarangay}>
            <Text style={styles.tableHeaderText}>Barangay</Text>
          </View>
          <View style={styles.colDocument}>
            <Text style={styles.tableHeaderText}>Document</Text>
          </View>
          <View style={styles.colDateTime}>
            {/* Dynamically changes label */}
            <Text style={[styles.tableHeaderText, { textAlign: 'right' }]}>{dateColLabel}</Text>
          </View>
          <View style={styles.colAction} />
        </View>

        {/* Data rows */}
        {rows.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No records found.</Text>
          </View>
        ) : (
          rows.map((item, idx) => (
            <TableRow key={item.id} item={item} isEven={idx % 2 === 1} viewFilter={viewFilter} />
          ))
        )}
      </View>
    </ScrollView>
  );

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.navy} />
      <View style={styles.layout}>
        {!isMobile && renderSidebar()}

        {isMobile && sidebarVisible && (
          <View style={StyleSheet.absoluteFill}>
            <TouchableOpacity
              style={styles.sidebarOverlay}
              activeOpacity={1}
              onPress={() => setSidebarVisible(false)}
            />
            <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0 }}>
              {renderSidebar()}
            </View>
          </View>
        )}

        {renderContent()}
      </View>
    </SafeAreaView>
  );
}

// ─── STYLES ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: COLORS.navy },
  layout: { flex: 1, flexDirection: 'row' },

  // Sidebar
  sidebar: {
    width: 250, backgroundColor: COLORS.navy,
    alignItems: 'center', paddingTop: 20, paddingBottom: 24, paddingHorizontal: 10, zIndex: 10,
  },
  sidebarOverlay: {
    position: 'absolute', left: 0, top: 0, bottom: 0, right: 0,
    backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 5,
  },
  logoPill: {
    width: 70, height: 70, borderRadius: 35,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 8, borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)',
  },
  logoCircle: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: COLORS.gold, alignItems: 'center', justifyContent: 'center',
  },
  logoText: { fontSize: 15, fontWeight: '900', color: COLORS.navy, letterSpacing: 0.5 },
  navItem: {
    width: '100%', paddingVertical: 12, paddingHorizontal: 12,
    borderRadius: 24, marginBottom: 8, alignItems: 'center',
    borderWidth: 1.5, borderColor: COLORS.white, backgroundColor: COLORS.navy,
  },
  navItemActive: { backgroundColor: COLORS.white, borderColor: COLORS.white },
  navLabel: { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.8)', letterSpacing: 0.3 },
  navLabelActive: { color: '#000', fontWeight: '800' },

  // Main
  main: { flex: 1, backgroundColor: COLORS.offWhite, borderTopLeftRadius: 20 },
  mainMobile: { borderTopLeftRadius: 0 },
  mainContent: { padding: 20, paddingBottom: 40 },

  // Mobile Header
  mobileHeader: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: 16,
    paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: COLORS.lightGray,
  },
  menuBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: COLORS.cardBg, alignItems: 'center', justifyContent: 'center',
  },
  menuIconContainer: { width: 20, height: 16, justifyContent: 'space-between' },
  menuLine: { width: 20, height: 2, backgroundColor: COLORS.navy, borderRadius: 1 },
  mobileTitle: { fontSize: 18, fontWeight: '800', color: COLORS.darkText },

  // Desktop Header
  header: {
    flexDirection: 'row', alignItems: 'flex-start',
    justifyContent: 'space-between', marginBottom: 20,
  },
  headerSub: {
    fontSize: 10, fontWeight: '600', color: COLORS.subText,
    letterSpacing: 2, textTransform: 'uppercase', marginBottom: 2,
  },
  headerTitle: { fontSize: 20, fontWeight: '900', color: COLORS.darkText, letterSpacing: 0.5 },

  // Bell
  bellBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: COLORS.cardBg, alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 6, elevation: 3,
  },
  bellWrapper: { width: 20, height: 22, alignItems: 'center' },
  bellBody: { width: 14, height: 12, borderRadius: 7, borderWidth: 2, borderColor: COLORS.maroon, marginTop: 4 },
  bellBottom: { width: 8, height: 4, borderBottomLeftRadius: 4, borderBottomRightRadius: 4, backgroundColor: '#8B0000', marginTop: -1 },
  bellDot: { position: 'absolute', top: 0, right: 1, width: 7, height: 7, borderRadius: 4, backgroundColor: COLORS.gold, borderWidth: 1.5, borderColor: COLORS.cardBg },
  notifBadge: {
    position: 'absolute', top: -2, right: -2, width: 16, height: 16, borderRadius: 8,
    backgroundColor: COLORS.gold, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: COLORS.white,
  },
  notifBadgeText: { fontSize: 8, fontWeight: '900', color: COLORS.navy },

  // Monitor Tab Bar
  monitorTabBar: {
    flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: COLORS.lightGray, marginBottom: 14,
  },
  monitorTab: {
    paddingHorizontal: isMobile ? 10 : 18, paddingVertical: 10,
    borderBottomWidth: 2, borderBottomColor: 'transparent', marginBottom: -1,
  },
  monitorTabActive: { backgroundColor: COLORS.gold, borderRadius: 4, borderBottomColor: COLORS.gold },
  monitorTabText: { fontSize: isMobile ? 11 : 13, fontWeight: '600', color: COLORS.subText },
  monitorTabTextActive: { color: COLORS.darkText, fontWeight: '800' },
  monitorTabFiller: { flex: 1 },

  // ── Filter Row ──────────────────────────────────────────────────────────────
  filterRow: {
    flexDirection: 'row', alignItems: 'center',
    gap: 8, marginBottom: 14, flexWrap: isMobile ? 'wrap' : 'nowrap',
  },
  searchBox: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.white, borderRadius: 20,
    borderWidth: 1, borderColor: COLORS.lightGray,
    paddingHorizontal: 12, paddingVertical: 7,
    minWidth: 120, maxWidth: 190,
  },
  searchInput: { flex: 1, fontSize: 12, color: COLORS.darkText },

  // Filter toggle buttons — pill shape
  filterToggleBtn: {
    borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 8,
  },
  // Active: gold (matches screenshot "Term for revisions papers" highlighted state)
  filterToggleRevisionOn: {
    backgroundColor: COLORS.gold,
  },
  // Active: navy blue (matches screenshot "Approved" highlighted state)
  filterToggleApprovedOn: {
    backgroundColor: COLORS.navy,
  },
  // Inactive: light gray outline pill
  filterToggleOff: {
    backgroundColor: COLORS.lightGray,
    borderWidth: 1, borderColor: '#D0D0D0',
  },
  filterToggleText: {
    fontSize: 11, fontWeight: '700',
  },

  // ── Table ───────────────────────────────────────────────────────────────────
  tableContainer: {
    backgroundColor: COLORS.white, borderRadius: 12, overflow: 'hidden',
    borderWidth: 1, borderColor: COLORS.lightGray,
    elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6,
  },
  tableHeader: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.white,
    paddingVertical: 11, paddingHorizontal: 14,
    borderBottomWidth: 1, borderBottomColor: COLORS.lightGray,
  },
  tableHeaderText: { fontSize: 12, fontWeight: '700', color: COLORS.darkText, letterSpacing: 0.2 },
  tableRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 10, paddingHorizontal: 14,
    borderBottomWidth: 1, borderBottomColor: COLORS.lightGray,
    backgroundColor: COLORS.white,
  },
  tableRowEven: { backgroundColor: '#FAFAFA' },

  colBarangay: { width: isMobile ? 100 : 160, paddingRight: 8 },
  colDocument: { flex: 1, paddingRight: 8 },
  colDateTime: { width: isMobile ? 80 : 110, alignItems: 'flex-end', paddingRight: 8 },
  colAction:   { width: 50, alignItems: 'center' },

  cellBarangay: { fontSize: 12, fontWeight: '600', color: COLORS.darkText },
  cellDocument: { fontSize: 11, color: COLORS.subText, lineHeight: 16 },
  cellTime:     { fontSize: 10, color: COLORS.subText, textAlign: 'right' },
  cellDate:     { fontSize: 10, color: COLORS.subText, textAlign: 'right' },

  viewBtn: {
    backgroundColor: COLORS.navy, borderRadius: 6,
    paddingHorizontal: 10, paddingVertical: 5,
  },
  viewBtnText: { fontSize: 10, fontWeight: '700', color: COLORS.white },

  emptyState: { alignItems: 'center', paddingVertical: 40 },
  emptyText:  { fontSize: 14, color: COLORS.midGray },
});