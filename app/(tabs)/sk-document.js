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
  Dimensions,
  FlatList,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useNav } from './navContext';
import { useAuth } from './authContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const isMobile = SCREEN_WIDTH < 768;

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

// ─── DATA ─────────────────────────────────────────────────────────────────────
const CATEGORIES = ['All', 'Financial', 'Planning', 'Governance', 'Activities'];

const DOCUMENT_GROUPS = [
  {
    id: 'planning',
    title: 'PLANNING DOCUMENTS',
    category: 'Planning',
    icon: '📋',
    colors: COLORS.planning,
    items: ['ABYIP', 'CBYDP', 'Work Plans', 'Project Proposals'],
  },
  {
    id: 'financial',
    title: 'FINANCIAL DOCUMENTS',
    category: 'Financial',
    icon: '💰',
    colors: COLORS.financial,
    items: [
      'Monthly Itemized List',
      'Quarterly Register of Bank',
      'Annual Budget',
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
      'Minutes of the Meetings',
    ],
  },
];

// ─── ICON COMPONENTS ─────────────────────────────────────────────────────────
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

// ─── DROPDOWN MENU ────────────────────────────────────────────────────────────
const DropdownMenu = ({ visible, options, onSelect, onClose, buttonColor }) => {
  if (!visible) return null;
  return (
    <View style={styles.dropdownOverlay}>
      <TouchableOpacity style={styles.dropdownBackdrop} onPress={onClose} />
      <View style={[styles.dropdownMenu, { borderTopColor: buttonColor }]}>
        {options.map((opt, idx) => (
          <TouchableOpacity
            key={idx}
            style={styles.dropdownItem}
            onPress={() => {
              onSelect(opt);
              onClose();
            }}
          >
            <Text style={styles.dropdownItemText}>{opt}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
};

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

// ─── MAIN SCREEN ─────────────────────────────────────────────────────────────
export default function DocumentsScreen({ navigation }) {
  const router = useRouter();
  const { activeTab, setActiveTab } = useNav();
  const { logout } = useAuth();
  const [searchText, setSearchText] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [notifCount] = useState(2);
  const [sidebarVisible, setSidebarVisible] = useState(false);

  const [dropdownVisible, setDropdownVisible] = useState(false);
  const [dropdownOptions, setDropdownOptions] = useState([]);
  const [dropdownButtonColor, setDropdownButtonColor] = useState(COLORS.maroon);

  const createNewOptions = [
    'ABYIP', 'CBYDP', 'Monthly Itemized List', 'Quarterly Register of Bank',
    'Annual Budget', 'Disbursement Vouchers', 'Resolutions', 'Ordinances',
    'Accomplishment Reports', 'Activity Documentation', 'Event Reports', 'Minutes of Meetings',
  ];

  const handleCreateNewPress = () => {
    setDropdownOptions(createNewOptions);
    setDropdownButtonColor(COLORS.gold);
    setDropdownVisible(true);
  };

  const handleItemPress = (item, group) => {
    router.push({ pathname: '/(tabs)/sk-document-list', params: { category: group.category } });
  };

  const handleDropdownSelect = (item) => {
    router.push({ pathname: '/(tabs)/sk-document-list', params: { category: 'All' } });
  };

  const handleNavPress = (tab) => {
    if (tab === 'Dashboard') {
      router.push('/(tabs)/sk-dashboard');
    } else if (tab === 'Documents') {
      router.push('/(tabs)/sk-document');
        } else if (tab === 'Planning') {
      router.push('/(tabs)/sk-planning');
    } else if (tab === 'Portal') {
      router.push('/(tabs)/sk-portal');
    }
    setActiveTab(tab);
    setSidebarVisible(false);
  };

  const handleLogout = () => {
    logout();
    router.replace('/');
  };

  const filteredGroups = DOCUMENT_GROUPS.filter((g) => {
    const matchCategory = activeCategory === 'All' || g.category === activeCategory;
    const matchSearch =
      searchText === '' ||
      g.title.toLowerCase().includes(searchText.toLowerCase()) ||
      g.items.some((i) => i.toLowerCase().includes(searchText.toLowerCase()));
    return matchCategory && matchSearch;
  });

  const renderSidebar = () => (
    <View style={styles.sidebar}>
      <View style={styles.logoPill}>
        <Image
          source={require('./../../assets/images/sk-logo.png')}
          style={styles.logoImage}
          resizeMode="contain"
        />
      </View>
      <View style={styles.sidebarSpacer} />
      {['Dashboard', 'Documents', 'Planning', 'Portal'].map((tab) => {
        const active = activeTab === tab;
        return (
          <TouchableOpacity
            key={tab}
            style={[styles.navItem, active && styles.navItemActive]}
            onPress={() => handleNavPress(tab)}
            activeOpacity={0.8}
          >
            <Text style={[styles.navLabel, active && styles.navLabelActive]}>
              {tab}
            </Text>
          </TouchableOpacity>
        );
      })}
      <View style={{ flex: 1 }} />
      <TouchableOpacity
        style={styles.logoutBtn}
        onPress={handleLogout}
        activeOpacity={0.8}
      >
        <Text style={styles.logoutText}>Logout</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.maroon} />
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

        <ScrollView
          style={[styles.main, isMobile && styles.mainMobile]}
          contentContainerStyle={styles.mainContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Mobile Header */}
          {isMobile && (
            <View style={styles.mobileHeader}>
              <TouchableOpacity
                style={styles.menuBtn}
                onPress={() => setSidebarVisible(!sidebarVisible)}
              >
                <MenuIcon />
              </TouchableOpacity>
              <Text style={styles.mobileTitle}>Documents</Text>
              <View style={{ width: 40 }} />
            </View>
          )}

          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.headerSub}>SANGGUNIANG KABATAAN</Text>
              <Text style={styles.headerTitle}>BARANGAY SAN JOSE</Text>
            </View>
            {!isMobile && (
              <TouchableOpacity style={styles.bellBtn} activeOpacity={0.7}>
                <BellIcon hasNotif={notifCount > 0} />
                {notifCount > 0 && (
                  <View style={styles.notifBadge}>
                    <Text style={styles.notifBadgeText}>{notifCount}</Text>
                  </View>
                )}
              </TouchableOpacity>
            )}
          </View>

          {/* Search */}
          <View style={styles.searchBar}>
            <View style={styles.searchIconWrap}>
              <View style={styles.searchCircle} />
              <View style={styles.searchHandle} />
            </View>
            <TextInput
              style={styles.searchInput}
              placeholder="Search documents…"
              placeholderTextColor={COLORS.midGray}
              value={searchText}
              onChangeText={setSearchText}
            />
            {searchText !== '' && (
              <TouchableOpacity onPress={() => setSearchText('')}>
                <Text style={{ color: COLORS.midGray, fontSize: 16, paddingLeft: 8 }}>✕</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Category Filter */}
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
                return (
                  <TouchableOpacity
                    key={cat}
                    style={[
                      styles.catBtn,
                      active ? styles.catBtnActive : styles.catBtnInactive,
                    ]}
                    onPress={() => {
                      if (cat === 'All') {
                        setActiveCategory(cat);
                      } else {
                        router.push({ pathname: '/(tabs)/sk-document-list', params: { category: cat } });
                      }
                    }}
                    activeOpacity={0.8}
                  >
                    <Text
                      style={[
                        styles.catBtnText,
                        active ? styles.catBtnTextActive : styles.catBtnTextInactive,
                      ]}
                    >
                      {cat}
                    </Text>
                  </TouchableOpacity>
                );
              })}

              <TouchableOpacity
                style={styles.catBtnGold}
                onPress={handleCreateNewPress}
                activeOpacity={0.8}
              >
                <Text style={styles.catBtnGoldText}>Create New +</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>

          {/* Document Cards Grid */}
          <View style={isMobile ? styles.gridMobile : styles.gridInner}>
            {filteredGroups.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>No documents found.</Text>
              </View>
            ) : (
              filteredGroups.map((group) => (
                <View
                  key={group.id}
                  style={isMobile ? styles.cardWrapperMobile : styles.cardWrapper}
                >
                  <DocumentCard
                    group={group}
                    onItemPress={handleItemPress}
                  />
                </View>
              ))
            )}
          </View>
        </ScrollView>

        <DropdownMenu
          visible={dropdownVisible}
          options={dropdownOptions}
          buttonColor={dropdownButtonColor}
          onSelect={handleDropdownSelect}
          onClose={() => setDropdownVisible(false)}
        />
      </View>
    </SafeAreaView>
  );
}

// ─── STYLES ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#133E75' },
  layout: { flex: 1, flexDirection: 'row' },

  sidebar: {
    width: 250,
    backgroundColor: '#133E75',
    alignItems: 'center',
    paddingTop: 20,
    paddingBottom: 24,
    paddingHorizontal: 10,
    zIndex: 10,
  },
  sidebarOverlay: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    right: 0,
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
    width: 100,
    height: 100,
  },
  sidebarSpacer: { height: 28 },
  navItem: {
    width: '100%',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 24,
    marginBottom: 8,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: COLORS.white,
    backgroundColor: '#133E75',
  },
  navItemActive: { backgroundColor: '#ffffff', borderWidth: 1.5, borderColor: '#000000' },
  navLabel: { fontSize: 13, fontWeight: '600', color: 'rgba(255, 255, 255, 0.8)', letterSpacing: 0.3 },
  navLabelActive: { color: '#000000', fontWeight: '800' },
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

  main: {
    flex: 1,
    backgroundColor: COLORS.offWhite,
    borderTopLeftRadius: 20,
  },
  mainMobile: {
    borderTopLeftRadius: 0,
  },
  mainContent: { padding: 20 },

  // Mobile Header
  mobileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightGray,
  },
  menuBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.cardBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuIconContainer: { width: 20, height: 16, justifyContent: 'space-between' },
  menuLine: { width: 20, height: 2, backgroundColor: COLORS.maroon, borderRadius: 1 },
  mobileTitle: { fontSize: 18, fontWeight: '800', color: COLORS.darkText },

  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  headerSub: { fontSize: 10, fontWeight: '600', color: COLORS.subText, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 2 },
  headerTitle: { fontSize: 20, fontWeight: '900', color: COLORS.darkText, letterSpacing: 0.5 },

  bellBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: COLORS.cardBg, alignItems: 'center', justifyContent: 'center',
    shadowColor: COLORS.shadow, shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1, shadowRadius: 6, elevation: 3,
  },
  bellWrapper: { width: 20, height: 22, alignItems: 'center' },
  bellBody: { width: 14, height: 12, borderRadius: 7, borderWidth: 2, borderColor: COLORS.maroon, marginTop: 4 },
  bellBottom: { width: 8, height: 4, borderBottomLeftRadius: 4, borderBottomRightRadius: 4, backgroundColor: COLORS.maroon, marginTop: -1 },
  bellDot: { position: 'absolute', top: 0, right: 1, width: 7, height: 7, borderRadius: 4, backgroundColor: COLORS.gold, borderWidth: 1.5, borderColor: COLORS.cardBg },
  notifBadge: { position: 'absolute', top: -2, right: -2, width: 16, height: 16, borderRadius: 8, backgroundColor: COLORS.gold, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: COLORS.white },
  notifBadgeText: { fontSize: 8, fontWeight: '900', color: COLORS.maroon },

  searchBar: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.white, borderRadius: 14,
    paddingHorizontal: 14, paddingVertical: 10,
    marginBottom: 20, borderWidth: 1.5, borderColor: COLORS.maroon + '33',
    shadowColor: COLORS.shadow, shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1, shadowRadius: 6, elevation: 2,
  },
  searchIconWrap: { width: 18, height: 18, marginRight: 10 },
  searchCircle: { width: 11, height: 11, borderRadius: 6, borderWidth: 2, borderColor: COLORS.midGray, position: 'absolute', top: 0, left: 0 },
  searchHandle: { width: 2, height: 6, backgroundColor: COLORS.midGray, borderRadius: 1, position: 'absolute', bottom: 0, right: 1, transform: [{ rotate: '-45deg' }] },
  searchInput: { flex: 1, fontSize: 14, color: COLORS.darkText, padding: 0 },

  categoryRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap' },
  categoryLabel: { fontSize: 12, fontWeight: '700', color: COLORS.subText, marginRight: 8 },
  categoryScroll: { flexGrow: 0 },
  catBtn: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1.5 },
  catBtnActive: { backgroundColor: COLORS.maroon, borderColor: COLORS.maroon },
  catBtnInactive: { backgroundColor: COLORS.white, borderColor: COLORS.maroon + '40' },
  catBtnText: { fontSize: 12, fontWeight: '700' },
  catBtnTextActive: { color: COLORS.white },
  catBtnTextInactive: { color: COLORS.maroon },
  catBtnGold: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: COLORS.gold },
  catBtnGoldText: { fontSize: 12, fontWeight: '800', color: COLORS.maroon },

  gridInner: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, paddingBottom: 24 },
  gridMobile: { flexDirection: 'column', gap: 12, paddingBottom: 24 },
  cardWrapper: { width: '47%', minWidth: 150 },
  cardWrapperMobile: { width: '100%' },

  card: { borderRadius: 16, overflow: 'hidden', elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.1, shadowRadius: 8 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 12, gap: 8 },
  cardHeaderIcon: { fontSize: 18 },
  cardHeaderTitle: { fontSize: 10, fontWeight: '900', color: COLORS.white, letterSpacing: 0.8, flex: 1, flexWrap: 'wrap' },
  cardBody: { padding: 14 },
  docItem: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 7 },
  docBullet: { width: 5, height: 5, borderRadius: 3, marginTop: 5, flexShrink: 0 },
  docItemText: { fontSize: 12, lineHeight: 18, flex: 1 },

  emptyState: { flex: 1, alignItems: 'center', marginTop: 60 },
  emptyText: { fontSize: 14, color: COLORS.midGray },

  dropdownOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 100 },
  dropdownBackdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  dropdownMenu: { position: 'absolute', left: 20, top: 100, right: 20, backgroundColor: COLORS.white, borderRadius: 12, borderTopWidth: 4, elevation: 5, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 8 },
  dropdownItem: { paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.lightGray },
  dropdownItemText: { fontSize: 13, color: COLORS.darkText, fontWeight: '500' },
});