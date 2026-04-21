import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  FlatList,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useNav } from './navContext';

// ─── COLORS ───────────────────────────────────────────────────────────────────
const COLORS = {
  maroon: '#8B0000',
  maroonDark: '#6B0000',
  gold: '#E8C547',
  accent: '#D4A017',
  white: '#FFFFFF',
  offWhite: '#F7F5F2',
  lightGray: '#ECECEC',
  midGray: '#B0B0B0',
  darkText: '#1A1A1A',
  subText: '#666666',
  cardBg: '#FFFFFF',
  shadow: 'rgba(0,0,0,0.08)',
  teal: '#2A7B7B',

  // Category colors
  planning: {
    header: '#5B8DD9',
    headerDark: '#3A6BBB',
    bg: '#EAF0FB',
    btn: '#5B8DD9',
    text: '#FFFFFF',
    subText: '#2A4E8A',
  },
  financial: {
    header: '#3AAA5C',
    headerDark: '#228844',
    bg: '#E8F7EE',
    btn: '#3AAA5C',
    text: '#FFFFFF',
    subText: '#1A6B38',
  },
  governance: {
    header: '#8B5BD9',
    headerDark: '#6A3BB5',
    bg: '#F0EAFB',
    btn: '#8B5BD9',
    text: '#FFFFFF',
    subText: '#5A2EA0',
  },
  performance: {
    header: '#E87A30',
    headerDark: '#C05A10',
    bg: '#FDF0E6',
    btn: '#E87A30',
    text: '#FFFFFF',
    subText: '#A04010',
  },
};

const CATEGORY_META = {
  All: { color: COLORS.maroon, label: 'All Documents' },
  Financial: { color: COLORS.financial.header, label: 'Financial Documents' },
  Planning: { color: COLORS.planning.header, label: 'Planning Documents' },
  Governance: { color: COLORS.governance.header, label: 'Governance Documents' },
  Activities: { color: COLORS.performance.header, label: 'Performance Documents' },
};

// ─── MOCK DOCUMENTS ───────────────────────────────────────────────────────────
const ALL_DOCUMENTS = [
  // Planning
  { id: '1', name: 'Comprehensive Barangay Youth Development Plan 2026', category: 'Planning', date: '1/07/2026', status: 'Authorized', hasFile: false },
  { id: '2', name: 'Comprehensive Barangay Youth Development Plan 2026', category: 'Planning', date: '1/05/2026', status: null, hasFile: true },
  { id: '3', name: 'Annual Budget Investment Plan 2026', category: 'Planning', date: '12/10/2025', status: 'Authorized', hasFile: true },
  { id: '4', name: 'SK Work Plan Q1 2026', category: 'Planning', date: '1/02/2026', status: null, hasFile: true },
  // Financial
  { id: '5', name: 'Monthly Itemized List — January 2026', category: 'Financial', date: '1/31/2026', status: 'Authorized', hasFile: true },
  { id: '6', name: 'Quarterly Register of Bank Q4 2025', category: 'Financial', date: '1/10/2026', status: null, hasFile: true },
  { id: '7', name: 'Annual Budget FY 2026', category: 'Financial', date: '12/28/2025', status: 'Authorized', hasFile: false },
  { id: '8', name: 'Disbursement Voucher #047', category: 'Financial', date: '1/15/2026', status: null, hasFile: true },
  { id: '9', name: 'Liquidation Report Jan 2026', category: 'Financial', date: '1/28/2026', status: null, hasFile: true },
  // Governance
  { id: '10', name: 'Resolution No. 2026-01', category: 'Governance', date: '1/03/2026', status: 'Authorized', hasFile: true },
  { id: '11', name: 'Ordinance No. 2025-12', category: 'Governance', date: '12/15/2025', status: 'Authorized', hasFile: true },
  { id: '12', name: 'Resolution No. 2025-10', category: 'Governance', date: '10/20/2025', status: null, hasFile: true },
  // Activities
  { id: '13', name: 'Q4 2025 Accomplishment Report', category: 'Activities', date: '1/08/2026', status: 'Authorized', hasFile: true },
  { id: '14', name: 'Youth Leadership Summit Documentation', category: 'Activities', date: '12/22/2025', status: null, hasFile: true },
  { id: '15', name: 'Barangay Clean-Up Event Report', category: 'Activities', date: '12/05/2025', status: null, hasFile: false },
  { id: '16', name: 'Minutes — General Assembly Dec 2025', category: 'Activities', date: '12/18/2025', status: 'Authorized', hasFile: true },
];

const CATEGORIES = ['All', 'Financial', 'Planning', 'Governance', 'Activities'];

// ─── ICON COMPONENTS ─────────────────────────────────────────────────────────
const BellIcon = ({ hasNotif }) => (
  <View style={styles.bellWrapper}>
    <View style={styles.bellBody} />
    <View style={styles.bellBottom} />
    {hasNotif && <View style={styles.bellDot} />}
  </View>
);

const SearchIcon = () => (
  <View style={styles.searchIconWrap}>
    <View style={styles.searchCircle} />
    <View style={styles.searchHandle} />
  </View>
);

// ─── DOCUMENT ROW ─────────────────────────────────────────────────────────────
const DocumentRow = ({ doc, accentColor, onMenu }) => (
  <View style={styles.docRow}>
    <View style={styles.docNameCell}>
      <Text style={styles.docName} numberOfLines={2}>{doc.name}</Text>
      {doc.status === 'Authorized' && (
        <View style={[styles.statusBadge, { backgroundColor: accentColor + '20', borderColor: accentColor + '50' }]}>
          <Text style={[styles.statusText, { color: accentColor }]}>Authorized</Text>
        </View>
      )}
      {doc.hasFile && !doc.status && (
        <View style={styles.fileIcon}>
          <Text style={{ fontSize: 13, color: COLORS.midGray }}>⬇</Text>
        </View>
      )}
    </View>
    <Text style={styles.docDate}>{doc.date}</Text>
    <TouchableOpacity onPress={() => onMenu(doc)} style={styles.menuBtn}>
      <Text style={styles.menuDots}>⋮</Text>
    </TouchableOpacity>
  </View>
);

// ─── MAIN SCREEN ─────────────────────────────────────────────────────────────
export default function DocumentListScreen({ route, navigation }) {
  const router = useRouter();
  const { activeTab, setActiveTab } = useNav();

  const initialCategory = route?.params?.category ?? 'All';
  const [searchText, setSearchText] = useState('');
  const [activeCategory, setActiveCategory] = useState(initialCategory);
  const [sortBy, setSortBy] = useState('Newest');
  const [notifCount] = useState(2);

  const meta = CATEGORY_META[activeCategory] ?? CATEGORY_META['All'];
  const accentColor = meta.color;

  const handleNavPress = (tab) => {
    if (tab === 'Home') {
      router.push('/(tabs)');
    } else if (tab === 'Documents') {
      router.push('/(tabs)/documents');
    }
    setActiveTab(tab);
  };

  const filtered = ALL_DOCUMENTS.filter((d) => {
    const matchCat = activeCategory === 'All' || d.category === activeCategory;
    const matchSearch =
      searchText === '' ||
      d.name.toLowerCase().includes(searchText.toLowerCase());
    return matchCat && matchSearch;
  }).sort((a, b) => {
    if (sortBy === 'Name') return a.name.localeCompare(b.name);
    const toDate = (s) => new Date(s.replace(/(\d+)\/(\d+)\/(\d+)/, '$3-$1-$2'));
    return toDate(b.date) - toDate(a.date);
  });

  const handleMenu = (doc) => {
    Alert.alert(doc.name, 'Choose an action', [
      { text: 'View', onPress: () => console.log('View', doc.id) },
      { text: 'Download', onPress: () => console.log('Download', doc.id) },
      { text: 'Delete', style: 'destructive', onPress: () => console.log('Delete', doc.id) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.maroon} />
      <View style={styles.layout}>

        {/* ── SIDEBAR ── */}
        <View style={styles.sidebar}>
          <View style={styles.logoPill}>
            <View style={styles.logoCircle}>
              <Text style={styles.logoText}>SK</Text>
            </View>
          </View>

          <View style={styles.sidebarSpacer} />

          {['Home', 'Documents'].map((tab) => {
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

        {/* ── MAIN ── */}
        <ScrollView
          style={styles.main}
          contentContainerStyle={styles.mainContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.headerSub}>SANGGUNIANG KABATAAN</Text>
              <Text style={styles.headerTitle}>BARANGAY SAN JOSE</Text>
            </View>
            <View style={styles.headerRight}>
              <TouchableOpacity style={styles.bellBtn} activeOpacity={0.7}>
                <BellIcon hasNotif={notifCount > 0} />
                {notifCount > 0 && (
                  <View style={styles.notifBadge}>
                    <Text style={styles.notifBadgeText}>{notifCount}</Text>
                  </View>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.uploadBtn, { backgroundColor: COLORS.maroon }]}
                activeOpacity={0.8}
              >
                <Text style={styles.uploadBtnText}>Upload  ⬆</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Search */}
          <View style={styles.searchBar}>
            <SearchIcon />
            <TextInput
              style={styles.searchInput}
              placeholder="Search documents…"
              placeholderTextColor={COLORS.midGray}
              value={searchText}
              onChangeText={setSearchText}
            />
            {searchText !== '' && (
              <TouchableOpacity onPress={() => setSearchText('')}>
                <Text style={{ color: COLORS.midGray, fontSize: 15 }}>✕</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Category + Create New Row */}
          <View style={styles.categoryRow}>
            <Text style={styles.categoryLabel}>Category:</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.categoryScroll}
              contentContainerStyle={{ gap: 6, paddingRight: 8 }}
            >
              {CATEGORIES.map((cat) => {
                const active = activeCategory === cat;
                const color = CATEGORY_META[cat]?.color ?? COLORS.maroon;
                return (
                  <TouchableOpacity
                    key={cat}
                    style={[
                      styles.catBtn,
                      active ? styles.catBtnActive : styles.catBtnInactive,
                      active ? { backgroundColor: color, borderColor: color } : { borderColor: color + '40' },
                    ]}
                    onPress={() => setActiveCategory(cat)}
                    activeOpacity={0.8}
                  >
                    <Text
                      style={[
                        styles.catBtnText,
                        active ? styles.catBtnTextActive : styles.catBtnTextInactive,
                        { color: active ? COLORS.white : color },
                      ]}
                    >
                      {cat}
                    </Text>
                  </TouchableOpacity>
                );
              })}
              <TouchableOpacity style={styles.catBtnGold} activeOpacity={0.8}>
                <Text style={styles.catBtnGoldText}>Create New +</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>

          {/* Table Card */}
          <View style={[styles.tableCard, { borderTopColor: accentColor }]}>
            {/* Sort Row */}
            <View style={styles.sortRow}>
              <Text style={styles.sortLabel}>Sort by:</Text>
              {['Newest', 'Name'].map((s) => (
                <TouchableOpacity key={s} onPress={() => setSortBy(s)}>
                  <Text style={[
                    styles.sortBtn,
                    sortBy === s && styles.sortBtnActive,
                    sortBy === s && { color: accentColor },
                  ]}>
                    {s}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Table Head */}
            <View style={[styles.tableHead, { borderBottomColor: accentColor + '40' }]}>
              <Text style={[styles.tableHeadDoc, { color: accentColor }]}>Document Name</Text>
              <Text style={[styles.tableHeadDate, { color: accentColor }]}>Date</Text>
              <View style={{ width: 24 }} />
            </View>

            {/* Rows */}
            <FlatList
              data={filtered}
              keyExtractor={(item) => item.id}
              renderItem={({ item, index }) => (
                <View style={index % 2 !== 0 ? styles.rowAlt : null}>
                  <DocumentRow doc={item} accentColor={accentColor} onMenu={handleMenu} />
                </View>
              )}
              ListEmptyComponent={
                <View style={styles.emptyState}>
                  <Text style={styles.emptyText}>No documents found.</Text>
                </View>
              }
              showsVerticalScrollIndicator={false}
            />
          </View>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

// ─── STYLES ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.maroon },
  layout: { flex: 1, flexDirection: 'row' },

  // Sidebar
  sidebar: {
    width: 250,
    backgroundColor: '#750d18',
    alignItems: 'center',
    paddingTop: 20,
    paddingBottom: 24,
    paddingHorizontal: 10,
  },
  logoPill: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  logoCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: COLORS.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: { fontSize: 18, fontWeight: '900', color: COLORS.maroon, letterSpacing: 1 },
  sidebarSpacer: { height: 28 },
  navItem: {
    width: '100%',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 24,
    marginBottom: 8,
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  navItemActive: {    backgroundColor: '#133E75',
    borderWidth: 1.5,
    borderColor: COLORS.black, },
  navLabel: { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.7)', letterSpacing: 0.3 },
  navLabelActive: { color: COLORS.white, fontWeight: '800' },

  // Main
  main: {
    flex: 1,
    backgroundColor: COLORS.offWhite,
    borderTopLeftRadius: 20,
    borderBottomLeftRadius: 0,
  },
  mainContent: { padding: 20 },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  headerSub: {
    fontSize: 10,
    fontWeight: '600',
    color: COLORS.subText,
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  headerTitle: { fontSize: 20, fontWeight: '900', color: COLORS.darkText, letterSpacing: 0.5 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },

  // Bell
  bellBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.cardBg,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 6,
    elevation: 3,
  },
  bellWrapper: { width: 20, height: 22, alignItems: 'center' },
  bellBody: {
    width: 14,
    height: 12,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: COLORS.maroon,
    marginTop: 4,
  },
  bellBottom: {
    width: 8,
    height: 4,
    borderBottomLeftRadius: 4,
    borderBottomRightRadius: 4,
    backgroundColor: COLORS.maroon,
    marginTop: -1,
  },
  bellDot: {
    position: 'absolute',
    top: 0,
    right: 1,
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: COLORS.gold,
    borderWidth: 1.5,
    borderColor: COLORS.cardBg,
  },
  notifBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: COLORS.gold,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: COLORS.white,
  },
  notifBadgeText: { fontSize: 8, fontWeight: '900', color: COLORS.maroon },

  // Upload
  uploadBtn: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 20,
  },
  uploadBtnText: { fontSize: 12, fontWeight: '700', color: COLORS.white },

  // Search
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 20,
    borderWidth: 1.5,
    borderColor: COLORS.maroon + '33',
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 6,
    elevation: 2,
  },
  searchIconWrap: { width: 18, height: 18, marginRight: 10 },
  searchCircle: {
    width: 11,
    height: 11,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: COLORS.midGray,
    position: 'absolute',
    top: 0,
    left: 0,
  },
  searchHandle: {
    width: 2,
    height: 6,
    backgroundColor: COLORS.midGray,
    borderRadius: 1,
    position: 'absolute',
    bottom: 0,
    right: 1,
    transform: [{ rotate: '-45deg' }],
  },
  searchInput: { flex: 1, fontSize: 14, color: COLORS.darkText, padding: 0 },

  // Category Row
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  categoryLabel: { fontSize: 12, fontWeight: '700', color: COLORS.subText, marginRight: 8 },
  categoryScroll: { flexGrow: 0 },
  catBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1.5,
    backgroundColor: COLORS.white,
  },
  catBtnActive: {},
  catBtnInactive: {},
  catBtnText: { fontSize: 12, fontWeight: '700' },
  catBtnTextActive: { color: COLORS.white },
  catBtnTextInactive: {},
  catBtnGold: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: COLORS.gold,
  },
  catBtnGoldText: { fontSize: 12, fontWeight: '800', color: COLORS.maroon },

  // Table Card
  tableCard: {
    flex: 1,
    backgroundColor: COLORS.white,
    borderRadius: 18,
    marginBottom: 18,
    overflow: 'hidden',
    borderTopWidth: 3,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
  },
  sortRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 6,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightGray,
  },
  sortLabel: { fontSize: 11, color: COLORS.subText, marginRight: 2 },
  sortBtn: { fontSize: 12, fontWeight: '600', color: COLORS.midGray, paddingHorizontal: 4 },
  sortBtnActive: { fontWeight: '800' },
  sortSep: { flex: 1, height: 1 },

  tableHead: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderBottomWidth: 1.5,
  },
  tableHeadDoc: { flex: 1, fontSize: 12, fontWeight: '800', letterSpacing: 0.3 },
  tableHeadDate: { width: 68, fontSize: 12, fontWeight: '800', textAlign: 'right', letterSpacing: 0.3 },

  // Doc Row
  docRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightGray,
  },
  rowAlt: { backgroundColor: '#FAFAF8' },
  docNameCell: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingRight: 6,
    flexWrap: 'wrap',
  },
  docName: { fontSize: 12, color: COLORS.darkText, lineHeight: 17, flex: 1 },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    borderWidth: 1,
  },
  statusText: { fontSize: 10, fontWeight: '700' },
  fileIcon: { paddingHorizontal: 4 },
  docDate: {
    width: 68,
    fontSize: 11,
    color: COLORS.subText,
    textAlign: 'right',
    fontWeight: '600',
  },
  menuBtn: { width: 24, alignItems: 'center', paddingLeft: 4 },
  menuDots: { fontSize: 18, color: COLORS.midGray, fontWeight: '700' },

  // Empty
  emptyState: { alignItems: 'center', paddingVertical: 40 },
  emptyText: { fontSize: 13, color: COLORS.midGray },
});