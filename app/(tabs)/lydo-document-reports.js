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
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useNav } from './navContext';
import { useAuth } from './authContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const isMobile = SCREEN_WIDTH < 768;

// ─── COLORS (identical to lydo-document-templates) ────────────────────────────
const COLORS = {
  maroon:    '#8B0000',
  navy:      '#133E75',
  navyDark:  '#0D2E5A',
  gold:      '#E8C547',
  white:     '#FFFFFF',
  offWhite:  '#F7F5F2',
  lightGray: '#ECECEC',
  midGray:   '#B0B0B0',
  darkText:  '#1A1A1A',
  subText:   '#666666',
  cardBg:    '#FFFFFF',
  shadow:    'rgba(0,0,0,0.08)',
};

// ─── NAV / TAB CONSTANTS ──────────────────────────────────────────────────────
const NAV_TABS       = ['Dashboard', 'Documents', 'Monitor'];
const DOCUMENT_TABS  = ['Barangay Folders', 'Reports', 'Templates'];

// ─── SAMPLE REPORT DATA ───────────────────────────────────────────────────────
const REPORTS = [
  { id: '1', name: 'SK_Rizal_ABYIP_Report_2026.pdf',   time: '3:00 PM', date: '1/02/2026' },
  { id: '2', name: 'Annual Budget Allocation 2026',     time: '3:00 PM', date: '1/02/2026' },
  { id: '3', name: 'Consolidated Compliance Report',    time: '3:00 PM', date: '1/02/2026' },
];

// ─── QUICK STATS (top-right info block) ───────────────────────────────────────
const QUICK_STATS = [
  { label: 'Reports',    value: '3' },
  { label: 'Downloads',  value: '12' },
  { label: 'Saved Annual Budget for barangays', value: null },
];

// ─── ICON COMPONENTS ──────────────────────────────────────────────────────────
const BellIcon = ({ hasNotif }) => (
  <View style={styles.bellWrapper}>
    <View style={styles.bellBody} />
    <View style={styles.bellBottom} />
    {hasNotif && <View style={styles.bellDot} />}
  </View>
);

const MenuIcon = () => (
  <View style={styles.menuIconContainer}>
    <View style={styles.menuLine} />
    <View style={styles.menuLine} />
    <View style={styles.menuLine} />
  </View>
);

// ─── REPORT ROW ───────────────────────────────────────────────────────────────
const ReportRow = ({ item, onPress }) => (
  <TouchableOpacity
    style={styles.reportRow}
    onPress={() => onPress && onPress(item)}
    activeOpacity={0.7}
  >
    <Text style={styles.reportName} numberOfLines={1}>{item.name}</Text>
    <View style={styles.reportDateCell}>
      <Text style={styles.reportTime}>{item.time}</Text>
      <Text style={styles.reportDate}>  {item.date}</Text>
    </View>
  </TouchableOpacity>
);

// ─── MAIN SCREEN ──────────────────────────────────────────────────────────────
export default function LYDODocumentReportsScreen() {
  const router = useRouter();
  const { activeTab, setActiveTab } = useNav();
  const { logout } = useAuth();

  const [searchText, setSearchText]         = useState('');
  const [notifCount]                        = useState(2);
  const [sidebarVisible, setSidebarVisible] = useState(false);
  const [activeDocumentTab]                 = useState('Reports');

  useEffect(() => { setActiveTab('Documents'); }, []);

  // ── Filtered reports ──
  const filteredReports = REPORTS.filter(r =>
    r.name.toLowerCase().includes(searchText.toLowerCase())
  );

  // ── Navigation ──
  const handleNavPress = (tab) => {
    setActiveTab(tab);
    setSidebarVisible(false);
    if (tab === 'Dashboard')      router.push('/(tabs)/lydo-dashboard');
    else if (tab === 'Documents') router.push('/(tabs)/lydo-document');
    else if (tab === 'Monitor')   router.push('/(tabs)/lydo-monitor');
  };

  const handleLogout = () => {
    logout();
    router.replace('/');
  };

  const handleDocumentTabPress = (tab) => {
    if (tab === 'Barangay Folders') { router.push('/(tabs)/lydo-document'); return; }
    if (tab === 'Reports')           { return; /* already here */ }
    if (tab === 'Templates')         { router.push('/(tabs)/lydo-document-templates'); return; }
  };

  // ── Sidebar ──
  const renderSidebar = () => (
    <View style={styles.sidebar}>
      <View style={styles.logoPill}>
        <Image
          source={require('./../../assets/images/lydo-logo.png')}
          style={styles.logoImage}
          resizeMode="contain"
        />
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

  // ── Main Content ──
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
          <Text style={styles.mobileTitle}>Reports</Text>
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

      {/* Document Tab Bar */}
      <View style={styles.documentTabBar}>
        {DOCUMENT_TABS.map(tab => {
          const active = activeDocumentTab === tab;
          return (
            <TouchableOpacity
              key={tab}
              style={[styles.documentTab, active && styles.documentTabActive]}
              onPress={() => handleDocumentTabPress(tab)}
              activeOpacity={0.8}
            >
              <Text style={[styles.documentTabText, active && styles.documentTabTextActive]}>
                {tab}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Search + Quick Stats Row */}
      <View style={styles.searchStatsRow}>
        {/* Search box */}
        <View style={styles.searchBox}>
          <Text style={{ fontSize: 13, marginRight: 6 }}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Search"
            placeholderTextColor={COLORS.midGray}
            value={searchText}
            onChangeText={setSearchText}
          />
          {searchText.length > 0 && (
            <TouchableOpacity onPress={() => setSearchText('')}>
              <Text style={{ color: COLORS.midGray, fontSize: 13 }}>✕</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Quick stats — top right */}
        {!isMobile && (
          <View style={styles.quickStatsBlock}>
            <View style={styles.quickStatRow}>
              <Text style={styles.quickStatLabel}>Reports :</Text>
              <Text style={styles.quickStatValue}>{REPORTS.length}</Text>
            </View>
            <View style={styles.quickStatRow}>
              <Text style={styles.quickStatLabel}>Downloads</Text>
            </View>
            <View style={styles.quickStatRow}>
              <Text style={styles.quickStatLabel}>Saved Annual Budget for barangays</Text>
            </View>
          </View>
        )}
      </View>

      {/* Section label */}
      <Text style={styles.sectionLabel}>All Documents</Text>

      {/* Report Table */}
      <View style={styles.tableContainer}>
        {/* Table Header */}
        <View style={styles.tableHeader}>
          <Text style={[styles.tableHeaderText, { flex: 1 }]}>Report</Text>
          <Text style={[styles.tableHeaderText, { width: 160, textAlign: 'right' }]}>Created Date</Text>
        </View>

        {/* Rows */}
        {filteredReports.length > 0 ? (
          filteredReports.map((item, idx) => (
            <React.Fragment key={item.id}>
              <ReportRow item={item} />
              {idx < filteredReports.length - 1 && <View style={styles.divider} />}
            </React.Fragment>
          ))
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No reports found</Text>
          </View>
        )}

        {/* Empty rows to fill table height — visual only */}
        {filteredReports.length < 8 &&
          Array.from({ length: Math.max(0, 5 - filteredReports.length) }).map((_, i) => (
            <View key={`empty-${i}`}>
              <View style={styles.reportRowEmpty} />
              {i < 4 - filteredReports.length && <View style={styles.divider} />}
            </View>
          ))
        }
      </View>

    </ScrollView>
  );

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.navy} />

      <View style={styles.layout}>
        {/* Mobile Sidebar Overlay */}
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
    </SafeAreaView>
  );
}

// ─── STYLES ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: '#133E75' },
  layout: { flex: 1, flexDirection: 'row' },

  // ── Sidebar ──
  sidebar: {
    width: 250,
    backgroundColor: '#133E75',
    alignItems: 'center',
    paddingTop: 20, paddingBottom: 24, paddingHorizontal: 10,
    zIndex: 10,
  },
  sidebarOverlay: {
    position: 'absolute',
    left: 0, top: 0, bottom: 0, right: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    zIndex: 5,
  },
  logoPill: {
    marginTop: 20,
    width: 70, height: 70, borderRadius: 35,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 8, borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)',
  },
    logoImage: {
    width: 110,
    height: 110,
  },
  navItem: {
    alignItems: 'center', justifyContent: 'center',
  },
  logoText: { fontSize: 15, fontWeight: '900', color: '#133E75', letterSpacing: 0.5 },
  navItem: {
    width: '100%', paddingVertical: 12, paddingHorizontal: 12,
    borderRadius: 24, marginBottom: 8, alignItems: 'center',
    borderWidth: 1.5, borderColor: COLORS.white, backgroundColor: '#133E75',
  },
  navItemActive: { backgroundColor: '#ffffff', borderColor: '#000000' },
  navLabel:      { fontSize: 13, fontWeight: '600', color: '#ffffff', letterSpacing: 0.3 },
  navLabelActive:{ color: '#000000', fontWeight: '800' },
  logoutBtn: {
    width: '100%', paddingVertical: 12, paddingHorizontal: 12,
    borderRadius: 24, marginTop: 8, alignItems: 'center',
    borderWidth: 1.5, borderColor: COLORS.white,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  logoutText: { fontSize: 13, fontWeight: '600', color: '#ffffff', letterSpacing: 0.3 },

  // ── Main ──
  main:        { flex: 1, backgroundColor: COLORS.offWhite, borderTopLeftRadius: 20 },
  mainMobile:  { borderTopLeftRadius: 0 },
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
  menuLine:          { width: 20, height: 2, backgroundColor: '#133E75', borderRadius: 1 },
  mobileTitle:       { fontSize: 18, fontWeight: '800', color: COLORS.darkText },

  // Desktop Header
  header: {
    flexDirection: 'row', alignItems: 'flex-start',
    justifyContent: 'space-between', marginBottom: 16,
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
    shadowColor: COLORS.shadow, shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1, shadowRadius: 6, elevation: 3,
  },
  bellWrapper: { width: 20, height: 22, alignItems: 'center' },
  bellBody: {
    width: 14, height: 12, borderRadius: 7,
    borderWidth: 2, borderColor: COLORS.maroon, marginTop: 4,
  },
  bellBottom: {
    width: 8, height: 4,
    borderBottomLeftRadius: 4, borderBottomRightRadius: 4,
    backgroundColor: '#8B0000', marginTop: -1,
  },
  bellDot: {
    position: 'absolute', top: 0, right: 1,
    width: 7, height: 7, borderRadius: 4,
    backgroundColor: COLORS.gold, borderWidth: 1.5, borderColor: COLORS.cardBg,
  },
  notifBadge: {
    position: 'absolute', top: -2, right: -2,
    width: 16, height: 16, borderRadius: 8,
    backgroundColor: COLORS.gold, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: COLORS.white,
  },
  notifBadgeText: { fontSize: 8, fontWeight: '900', color: '#133E75' },

  // Document Tab Bar
  documentTabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1, borderBottomColor: COLORS.lightGray,
    marginBottom: 16, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.30, shadowRadius: 3, elevation: 6,
  },
  documentTab: {
    flex: 1,
    paddingHorizontal: isMobile ? 8 : 40,
    backgroundColor: COLORS.navy,
    paddingVertical: 10,
    borderBottomWidth: 0, borderBottomColor: 'transparent',
    marginBottom: -1,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
  },
  documentTabActive: {
    backgroundColor: COLORS.gold,
    borderRadius: 4,
    borderBottomColor: COLORS.gold, borderColor: COLORS.gold,
    shadowColor: COLORS.gold, shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4, shadowRadius: 4, elevation: 3,
  },
  documentTabText: {
    fontSize: isMobile ? 10 : 13, fontWeight: '600', color: COLORS.white,
  },
  documentTabTextActive: { color: COLORS.darkText, fontWeight: '800' },

  // Search + Stats Row
  searchStatsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 14,
    gap: 16,
  },
  searchBox: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.white, borderRadius: 20,
    borderWidth: 1, borderColor: COLORS.lightGray,
    paddingHorizontal: 12, paddingVertical: 8,
    width: isMobile ? '100%' : 220,
  },
  searchInput: { flex: 1, fontSize: 13, color: COLORS.darkText },

  // Quick Stats
  quickStatsBlock: {
    flex: 1, alignItems: 'flex-end', paddingTop: 2,
  },
  quickStatRow: {
    flexDirection: 'row', alignItems: 'center',
    marginBottom: 2,
  },
  quickStatLabel: {
    fontSize: 13, color: COLORS.darkText, fontWeight: '400',
  },
  quickStatValue: {
    fontSize: 13, color: COLORS.darkText, fontWeight: '700', marginLeft: 4,
  },

  // Section label
  sectionLabel: {
    fontSize: 13, fontWeight: '700', color: COLORS.darkText,
    marginBottom: 10,
  },

  // Table
  tableContainer: {
    backgroundColor: COLORS.white,
    borderRadius: 10,
    borderWidth: 1, borderColor: COLORS.lightGray,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07, shadowRadius: 8, elevation: 1,
    overflow: 'hidden',
  },
  tableHeader: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 18, paddingVertical: 12,
    backgroundColor: COLORS.offWhite,
    borderBottomWidth: 1, borderBottomColor: COLORS.lightGray,
  },
  tableHeaderText: {
    fontSize: 13, fontWeight: '800', color: COLORS.darkText, letterSpacing: 0.2,
  },
  reportRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 18, paddingVertical: 15,
  },
  reportRowEmpty: {
    height: 48,
  },
  reportName: {
    flex: 1, fontSize: 13, color: COLORS.darkText,
    fontWeight: '400', lineHeight: 18,
  },
  reportDateCell: {
    width: 160, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'flex-end',
  },
  reportTime: {
    fontSize: 13, color: '#133E75', fontWeight: '500',
  },
  reportDate: {
    fontSize: 13, color: COLORS.darkText, fontWeight: '400',
  },
  divider: { height: 1, backgroundColor: COLORS.lightGray, marginHorizontal: 18 },

  // Empty state
  emptyState: { padding: 40, alignItems: 'center' },
  emptyText:  { fontSize: 14, color: COLORS.midGray },
});