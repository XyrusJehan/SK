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
import { useAuth } from './authContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const isMobile = SCREEN_WIDTH < 768;

// ─── COLORS ───────────────────────────────────────────────────────────────────
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

  planning: {
    header:  '#5B8DD9',
    bg:      '#EAF0FB',
    btn:     '#5B8DD9',
    text:    '#FFFFFF',
    subText: '#2A4E8A',
  },
  financial: {
    header:  '#3AAA5C',
    bg:      '#E8F7EE',
    btn:     '#3AAA5C',
    text:    '#FFFFFF',
    subText: '#1A6B38',
  },
  governance: {
    header:  '#8B5BD9',
    bg:      '#F0EAFB',
    btn:     '#8B5BD9',
    text:    '#FFFFFF',
    subText: '#5A2EA0',
  },
  performance: {
    header:  '#E87A30',
    bg:      '#FDF0E6',
    btn:     '#E87A30',
    text:    '#FFFFFF',
    subText: '#A04010',
  },
};

// ─── BARANGAY DATA ─────────────────────────────────────────────────────────────
const BARANGAYS = [
  { id: '1', name: 'San Roque'  },
  { id: '2', name: 'San Isidro' },
  { id: '3', name: 'San Bueno'  },
  { id: '4', name: 'Banot'      },
  { id: '5', name: 'Mamala'     },
  { id: '6', name: 'Taquico'    },
  { id: '7', name: 'Bayongon'   },
  { id: '8', name: 'Apasan'     },
];

// ─── YEAR FOLDERS per barangay ────────────────────────────────────────────────
const YEAR_FOLDERS = ['2022 Documents', '2023 Documents', '2024 Documents'];

// ─── DOCUMENT GROUPS (shown after selecting a year) ───────────────────────────
const DOCUMENT_GROUPS = [
  {
    id: 'planning',
    title: 'PLANNING DOCUMENTS',
    category: 'Planning',
    icon: '📋',
    colors: COLORS.planning,
    items: ['LYDP', 'Work Plans', 'Project Proposals'],
  },
  {
    id: 'financial',
    title: 'FINANCIAL DOCUMENTS',
    category: 'Financial',
    icon: '💰',
    colors: COLORS.financial,
    items: [
      'Financial Report Summary',
      'Register of Cash Receipts',
      'Disbursement Vouchers',
      'Disbursement Vouchers',
      'Liquidation Reports',
    ],
  },
  {
    id: 'governance',
    title: 'GOVERNANCE DOCUMENTS',
    category: 'Governance',
    icon: '⚖️',
    colors: COLORS.governance,
    items: ['Resolutions', 'Ordinances'],
  },
  {
    id: 'performance',
    title: 'PERFORMANCE DOCUMENTS',
    category: 'Activities',
    icon: '📊',
    colors: COLORS.performance,
    items: [
      'Accomplishment Reports',
      'Activity Documentation',
      'Event Reports',
      'Minutes of the meetings',
    ],
  },
];

// ─── NAV TABS ─────────────────────────────────────────────────────────────────
const NAV_TABS = ['Home', 'Documents', 'Monitor'];

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

// ─── macOS-STYLE FOLDER ICON ──────────────────────────────────────────────────
const FolderIcon = ({ size = 68 }) => {
  const w = size;
  const h = size * 0.82;
  const tabH = h * 0.11;
  const bodyTop = tabH * 0.7;
  const bodyH = h - bodyTop;

  return (
    <View style={{ width: w, height: h }}>
      {/* Tab */}
      <View style={{
        position: 'absolute', top: 0, left: 0,
        width: w * 0.36, height: tabH + 4,
        backgroundColor: '#0F68D0',
        borderTopLeftRadius: 4, borderTopRightRadius: 8,
      }} />
      {/* Body */}
      <View style={{
        position: 'absolute', top: bodyTop, left: 0,
        width: w, height: bodyH,
        backgroundColor: '#1A8CFF',
        borderRadius: 6, borderTopRightRadius: 6, borderTopLeftRadius: 2,
      }}>
        {/* Highlight */}
        <View style={{
          position: 'absolute', top: 5, left: 8, right: 8, height: bodyH * 0.28,
          backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 4,
        }} />
      </View>
    </View>
  );
};

// ─── YEAR FOLDER ICON (smaller, slightly different shade) ────────────────────
const YearFolderIcon = ({ size = 56 }) => {
  const w = size;
  const h = size * 0.82;
  const tabH = h * 0.11;
  const bodyTop = tabH * 0.7;
  const bodyH = h - bodyTop;

  return (
    <View style={{ width: w, height: h }}>
      <View style={{
        position: 'absolute', top: 0, left: 0,
        width: w * 0.36, height: tabH + 4,
        backgroundColor: '#2878D8',
        borderTopLeftRadius: 4, borderTopRightRadius: 7,
      }} />
      <View style={{
        position: 'absolute', top: bodyTop, left: 0,
        width: w, height: bodyH,
        backgroundColor: '#3A9EFF',
        borderRadius: 5, borderTopRightRadius: 5, borderTopLeftRadius: 2,
      }}>
        <View style={{
          position: 'absolute', top: 4, left: 6, right: 6, height: bodyH * 0.25,
          backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 3,
        }} />
      </View>
    </View>
  );
};

// ─── BREADCRUMB ───────────────────────────────────────────────────────────────
const Breadcrumb = ({ barangay, year, onPressDocuments, onPressBarangay }) => (
  <View style={styles.breadcrumb}>
    <TouchableOpacity onPress={onPressDocuments}>
      <Text style={styles.breadcrumbLink}>Documents</Text>
    </TouchableOpacity>
    {barangay && (
      <>
        <Text style={styles.breadcrumbSep}> › </Text>
        <TouchableOpacity onPress={onPressBarangay}>
          <Text style={[styles.breadcrumbLink, !year && styles.breadcrumbCurrent]}>
            {barangay.name}
          </Text>
        </TouchableOpacity>
      </>
    )}
    {year && (
      <>
        <Text style={styles.breadcrumbSep}> › </Text>
        <Text style={styles.breadcrumbCurrent}>{year}</Text>
      </>
    )}
  </View>
);

// ─── DOCUMENT CARD ────────────────────────────────────────────────────────────
const DocumentCard = ({ group, onItemPress }) => {
  const { colors, title, icon, items } = group;
  return (
    <View style={[styles.card, { backgroundColor: colors.bg }]}>
      <View style={[styles.cardHeader, { backgroundColor: colors.header }]}>
        <Text style={styles.cardHeaderIcon}>{icon}</Text>
        <Text style={styles.cardHeaderTitle}>{title}</Text>
      </View>
      <View style={styles.cardBody}>
        {items.map((item, idx) => (
          <TouchableOpacity
            key={idx}
            style={styles.docItem}
            onPress={() => onItemPress && onItemPress(item, group)}
            activeOpacity={0.7}
          >
            <View style={[styles.docBullet, { backgroundColor: colors.header }]} />
            <Text style={[styles.docItemText, { color: colors.subText }]}>{item}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
};

// ─── VIEW STATES ──────────────────────────────────────────────────────────────
// 'folders'  → barangay folder grid (root)
// 'years'    → year folders inside a barangay
// 'docs'     → document category cards for a year

// ─── MAIN SCREEN ──────────────────────────────────────────────────────────────
export default function LYDODocumentsScreen({ navigation }) {
  const router = useRouter();
  const { activeTab, setActiveTab } = useNav();
  const { logout } = useAuth();

  const [view, setView]                         = useState('folders'); // 'folders' | 'years' | 'docs'
  const [selectedBarangay, setSelectedBarangay] = useState(null);
  const [selectedYear, setSelectedYear]         = useState(null);
  const [searchText, setSearchText]             = useState('');
  const [notifCount]                            = useState(2);
  const [sidebarVisible, setSidebarVisible]     = useState(false);

  useEffect(() => { setActiveTab('Documents'); }, []);

  // ── Navigation helpers ──
  const goToFolders = () => {
    setView('folders');
    setSelectedBarangay(null);
    setSelectedYear(null);
    setSearchText('');
  };

  const goToYears = (barangay) => {
    setSelectedBarangay(barangay);
    setSelectedYear(null);
    setView('years');
    setSearchText('');
  };

  const goToDocs = (year) => {
    setSelectedYear(year);
    setView('docs');
    setSearchText('');
  };

  const handleNavPress = (tab) => {
    setActiveTab(tab);
    setSidebarVisible(false);
    if (tab === 'Home') router.push('/(tabs)/lydo-home')
    else if (tab === 'Documents') router.push('/(tabs)/lydo-document');
    else if (tab === 'Monitor') router.push('/(tabs)/lydo-monitor');
  };

  const handleLogout = () => {
    logout();
    router.replace('/');
  };

  // ── Filtered data ──
  const filteredBarangays = BARANGAYS.filter(b =>
    b.name.toLowerCase().includes(searchText.toLowerCase())
  );

  const filteredYears = YEAR_FOLDERS.filter(y =>
    y.toLowerCase().includes(searchText.toLowerCase())
  );

  const filteredGroups = DOCUMENT_GROUPS.filter(g =>
    searchText === '' ||
    g.title.toLowerCase().includes(searchText.toLowerCase()) ||
    g.items.some(i => i.toLowerCase().includes(searchText.toLowerCase()))
  );

  // ── Sidebar ──
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
      <View style={{ height: 28 }} />
      <TouchableOpacity
        style={styles.logoutBtn}
        onPress={handleLogout}
        activeOpacity={0.8}
      >
        <Text style={styles.logoutText}>Logout</Text>
      </TouchableOpacity>
    </View>
  );

  // ── Content body (shared between mobile/desktop) ──
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
          <Text style={styles.mobileTitle}>Documents</Text>
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

      {/* Page title */}
      <Text style={styles.sectionTitle}>Document Management</Text>

      {/* ── VIEW: ROOT FOLDERS (barangays) ── */}
      {view === 'folders' && (
        <>
          {/* Search */}
          <View style={styles.searchRow}>
            <View style={styles.searchBox}>
              <Text style={{ fontSize: 13, marginRight: 6 }}>🔍</Text>
              <TextInput
                style={styles.searchInput}
                placeholder="Search barangay…"
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
          </View>

          <Text style={styles.allDocsLabel}>All Documents</Text>

          <View style={isMobile ? styles.folderGridMobile : styles.folderGrid}>
            {filteredBarangays.map(item => (
              <TouchableOpacity
                key={item.id}
                style={styles.folderCard}
                onPress={() => goToYears(item)}
                activeOpacity={0.75}
              >
                <FolderIcon size={isMobile ? 60 : 68} />
                <Text style={styles.folderName} numberOfLines={2}>{item.name}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </>
      )}

      {/* ── VIEW: YEAR FOLDERS inside a barangay ── */}
      {view === 'years' && (
        <>
          {/* Subtitle */}
          <Text style={styles.barangaySubtitle}>
            Barangay {selectedBarangay?.name} Documents
          </Text>

          {/* Breadcrumb */}
          <Breadcrumb
            barangay={selectedBarangay}
            year={null}
            onPressDocuments={goToFolders}
            onPressBarangay={() => {}}
          />

          {/* Year folder grid */}
          <View style={[isMobile ? styles.folderGridMobile : styles.folderGrid, { marginTop: 24 }]}>
            {filteredYears.map((year, idx) => (
              <TouchableOpacity
                key={idx}
                style={styles.folderCard}
                onPress={() => goToDocs(year)}
                activeOpacity={0.75}
              >
                <YearFolderIcon size={isMobile ? 54 : 62} />
                <Text style={styles.folderName}>{year}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </>
      )}

      {/* ── VIEW: DOCUMENT CATEGORY CARDS ── */}
      {view === 'docs' && (
        <>
          {/* Subtitle */}
          <Text style={styles.barangaySubtitle}>
            Barangay {selectedBarangay?.name} Documents
          </Text>

          {/* Breadcrumb */}
          <Breadcrumb
            barangay={selectedBarangay}
            year={selectedYear}
            onPressDocuments={goToFolders}
            onPressBarangay={() => goToYears(selectedBarangay)}
          />

          {/* 4 category cards grid */}
          <View style={[isMobile ? styles.gridMobile : styles.gridInner, { marginTop: 20 }]}>
            {filteredGroups.map(group => (
              <View
                key={group.id}
                style={isMobile ? styles.cardWrapperMobile : styles.cardWrapper}
              >
                <DocumentCard
                  group={group}
                  onItemPress={(item, g) => {
                    if (navigation) navigation.navigate('DocumentList', { category: g.category });
                  }}
                />
              </View>
            ))}
          </View>
        </>
      )}
    </ScrollView>
  );

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.navy} />

      <View style={styles.layout}>
        {/* Sidebar — always visible on desktop */}
        {!isMobile && renderSidebar()}

        {/* Mobile sidebar overlay */}
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
  logoText: { fontSize: 15, fontWeight: '900', color: '#133E75', letterSpacing: 0.5 },
  navItem: {
    width: '100%', paddingVertical: 12, paddingHorizontal: 12,
    borderRadius: 24, marginBottom: 8, alignItems: 'center',
    borderWidth: 1.5, borderColor: COLORS.white, backgroundColor: '#133E75',
  },
  navItemActive: { backgroundColor: COLORS.white, borderColor: COLORS.white },
  navLabel: { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.8)', letterSpacing: 0.3 },
  navLabelActive: { color: '#000', fontWeight: '800' },
  logoutBtn: {
    width: '100%',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 24,
    marginTop: 8,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: COLORS.white,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  logoutText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#ffffff',
    letterSpacing: 0.3,
  },

  // ── Main ──
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
  menuLine: { width: 20, height: 2, backgroundColor: '#133E75', borderRadius: 1 },
  mobileTitle: { fontSize: 18, fontWeight: '800', color: COLORS.darkText },

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

  // Section Title
  sectionTitle: {
    fontSize: 22, fontWeight: '800', color: COLORS.darkText,
    marginBottom: 6, letterSpacing: 0.3,
  },
  barangaySubtitle: {
    fontSize: 14, fontWeight: '700', color: COLORS.darkText, marginBottom: 8,
  },

  // Search
  searchRow: { marginBottom: 14 },
  searchBox: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.white, borderRadius: 20,
    borderWidth: 1, borderColor: COLORS.lightGray,
    paddingHorizontal: 12, paddingVertical: 8,
    width: isMobile ? '100%' : 240,
  },
  searchInput: { flex: 1, fontSize: 13, color: COLORS.darkText },

  allDocsLabel: {
    fontSize: 13, fontWeight: '700', color: COLORS.darkText, marginBottom: 16,
  },

  // Breadcrumb
  breadcrumb: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: 20, borderWidth: 1, borderColor: COLORS.lightGray,
    paddingHorizontal: 14, paddingVertical: 7,
    alignSelf: 'flex-start',
  },
  breadcrumbLink: { fontSize: 12, color: '#133E75', fontWeight: '600' },
  breadcrumbSep:  { fontSize: 12, color: COLORS.midGray, marginHorizontal: 2 },
  breadcrumbCurrent: { fontSize: 12, color: COLORS.darkText, fontWeight: '700' },

  // ── Folder grids ──
  folderGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 4,
  },
  folderGridMobile: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 12,
  },
  folderCard: {
    width: isMobile ? '28%' : 110,
    alignItems: 'center', paddingVertical: 10, paddingHorizontal: 6,
    borderRadius: 10, marginBottom: 4,
  },
  folderName: {
    marginTop: 6, fontSize: 11, fontWeight: '500',
    color: COLORS.darkText, textAlign: 'center', lineHeight: 14,
  },

  // ── Document category card grid ──
  gridInner: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, paddingBottom: 24 },
  gridMobile: { flexDirection: 'column', gap: 12, paddingBottom: 24 },
  cardWrapper: { width: '47%', minWidth: 150 },
  cardWrapperMobile: { width: '100%' },

  // Card
  card: {
    borderRadius: 16, overflow: 'hidden', elevation: 3,
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1, shadowRadius: 8,
  },
  cardHeader: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 12, gap: 8,
  },
  cardHeaderIcon: { fontSize: isMobile ? 16 : 18 },
  cardHeaderTitle: {
    fontSize: isMobile ? 8 : 10, fontWeight: '900', color: COLORS.white,
    letterSpacing: 0.8, flex: 1, flexWrap: 'wrap',
  },
  cardBody: { padding: isMobile ? 10 : 14 },
  docItem: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 6 },
  docBullet: { width: 5, height: 5, borderRadius: 3, marginTop: 5, flexShrink: 0 },
  docItemText: { fontSize: isMobile ? 11 : 12, lineHeight: 18, flex: 1 },

  emptyState: { flex: 1, alignItems: 'center', marginTop: 60 },
  emptyText: { fontSize: 14, color: COLORS.midGray },
});