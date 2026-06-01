import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, ScrollView, TouchableOpacity,
  StyleSheet, SafeAreaView, StatusBar, Dimensions,
  Image,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useNav } from './navContext';
import { useAuth } from './authContext';
import { supabase } from '../../utils/supabase';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const isMobile = SCREEN_WIDTH < 768;

// ─── COLORS ───────────────────────────────────────────────────────────────────
const COLORS = {
  navy:      '#133E75',
  gold:      '#E8C547',
  white:     '#FFFFFF',
  offWhite:  '#F7F5F2',
  lightGray: '#ECECEC',
  midGray:   '#B0B0B0',
  darkText:  '#1A1A1A',
  subText:   '#666666',
  cardBg:    '#FFFFFF',

  planning: {
    header:  '#7B9FD4',
    bg:      '#C8D9F0',
    text:    '#FFFFFF',
    subText: '#2A4E8A',
  },
  financial: {
    header:  '#4CAF50',
    bg:      '#C8EDCA',
    text:    '#FFFFFF',
    subText: '#1A6B38',
  },
  governance: {
    header:  '#7C5CBF',
    bg:      '#D8CAEF',
    text:    '#FFFFFF',
    subText: '#5A2EA0',
  },
  performance: {
    header:  '#E87A30',
    bg:      '#F5D5B8',
    text:    '#FFFFFF',
    subText: '#A04010',
  },
};

// ─── TABS ─────────────────────────────────────────────────────────────────────
const NAV_TABS      = ['Dashboard', 'Documents', 'Planning', 'Portal', 'Logs', 'Account'];
const DOCUMENT_TABS = ['Folder', 'Document Management'];

// ─── DOCUMENT CATEGORIES ─────────────────────────────────────────────────────
const DOC_CATEGORIES = [
  {
    id: 'planning',
    title: 'PLANNING DOCUMENTS',
    category: 'Planning',
    icon: '📅',
    colors: COLORS.planning,
    tab: 'Planning',
    items: ['ABYIP', 'CBYDP', 'Work Plans', 'Project Proposals'],
  },
  {
    id: 'financial',
    title: 'FINANCIAL DOCUMENTS',
    category: 'Financial',
    icon: '💲',
    colors: COLORS.financial,
    tab: 'Financial',
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
    tab: 'Governance',
    items: ['Resolutions', 'Ordinances'],
  },
  {
    id: 'performance',
    title: 'PERFORMANCE DOCUMENTS',
    category: 'Activities',
    icon: '👥',
    colors: COLORS.performance,
    tab: 'Activities',
    items: [
      'Accomplishment Reports',
      'Activity Documentation',
      'Event Reports',
      'Minutes of the meetings',
    ],
  },
];

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

// Dashboard: 2×2 grid of rounded squares
const DashboardIcon = ({ color = '#fff', size = 16 }) => {
  const s = size * 0.38;
  const gap = size * 0.12;
  const r = size * 0.12;
  const box = { width: s, height: s, borderRadius: r, backgroundColor: color };
  return (
    <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
      <View style={{ flexDirection: 'row', gap }}>
        <View style={box} />
        <View style={box} />
      </View>
      <View style={{ height: gap }} />
      <View style={{ flexDirection: 'row', gap }}>
        <View style={box} />
        <View style={box} />
      </View>
    </View>
  );
};

// Documents: file shape with fold + two lines
const DocumentsIcon = ({ color = '#fff', size = 16 }) => {
  const w = size * 0.6, h = size * 0.78;
  const fold = size * 0.22;
  return (
    <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
      <View style={{ width: w, height: h, justifyContent: 'flex-end', paddingBottom: size * 0.08, paddingHorizontal: size * 0.1 }}>
        <View style={{ position: 'absolute', left: 0, right: 0, top: fold, bottom: 0, borderWidth: 1.5, borderColor: color, borderRadius: size * 0.08 }} />
        <View style={{ position: 'absolute', top: 0, right: 0, width: fold, height: fold, backgroundColor: color, borderBottomLeftRadius: size * 0.06 }} />
        <View style={{ position: 'absolute', top: 0, left: 0, width: w - fold, height: fold, borderTopWidth: 1.5, borderLeftWidth: 1.5, borderColor: color, borderTopLeftRadius: size * 0.08 }} />
        <View style={{ height: 1.5, backgroundColor: color, borderRadius: 1, marginBottom: size * 0.1, width: '80%' }} />
        <View style={{ height: 1.5, backgroundColor: color, borderRadius: 1, width: '55%' }} />
      </View>
    </View>
  );
};

// Planning: calendar grid
const PlanningIcon = ({ color = '#fff', size = 16 }) => {
  const bw = 1.5;
  return (
    <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
      <View style={{ width: size * 0.82, height: size * 0.75, borderWidth: bw, borderColor: color, borderRadius: size * 0.1, overflow: 'hidden' }}>
        <View style={{ height: size * 0.22, backgroundColor: color, width: '100%' }} />
        <View style={{ flex: 1, flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', paddingHorizontal: size * 0.05 }}>
          {[0,1,2].map(i => <View key={i} style={{ width: size * 0.1, height: size * 0.1, borderRadius: size * 0.05, backgroundColor: color }} />)}
        </View>
      </View>
      <View style={{ position: 'absolute', top: 0, flexDirection: 'row', gap: size * 0.32 }}>
        {[0,1].map(i => <View key={i} style={{ width: size * 0.1, height: size * 0.2, backgroundColor: color, borderRadius: size * 0.05 }} />)}
      </View>
    </View>
  );
};

// Portal: simple globe
const PortalIcon = ({ color = '#fff', size = 16 }) => (
  <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
    <View style={{ width: size * 0.82, height: size * 0.82, borderRadius: size * 0.41, borderWidth: 1.5, borderColor: color, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' }}>
      <View style={{ position: 'absolute', height: 1.5, width: '100%', backgroundColor: color }} />
      <View style={{ width: size * 0.38, height: size * 0.78, borderRadius: size * 0.19, borderWidth: 1.5, borderColor: color, backgroundColor: 'transparent' }} />
    </View>
  </View>
);

// Logs: clipboard with checkmark lines
const LogsIcon = ({ color = '#fff', size = 16 }) => (
  <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
    <View style={{ width: size * 0.75, height: size * 0.85, borderWidth: 1.5, borderColor: color, borderRadius: size * 0.1, paddingHorizontal: size * 0.1, paddingVertical: size * 0.1, justifyContent: 'space-around' }}>
      <View style={{ position: 'absolute', top: -size * 0.08, alignSelf: 'center', width: size * 0.3, height: size * 0.14, backgroundColor: color, borderRadius: size * 0.04 }} />
      {[0,1,2].map(i => (
        <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: size * 0.08, marginTop: i === 0 ? size * 0.1 : 0 }}>
          <View style={{ width: size * 0.1, height: size * 0.1, borderRadius: size * 0.05, backgroundColor: color }} />
          <View style={{ flex: 1, height: 1.5, backgroundColor: color, borderRadius: 1 }} />
        </View>
      ))}
    </View>
  </View>
);

// Account: head + shoulders silhouette
const AccountIcon = ({ color = '#fff', size = 16 }) => (
  <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
    <View style={{ width: size * 0.38, height: size * 0.38, borderRadius: size * 0.19, borderWidth: 1.5, borderColor: color, marginBottom: size * 0.04 }} />
    <View style={{ width: size * 0.72, height: size * 0.36, borderBottomLeftRadius: size * 0.36, borderBottomRightRadius: size * 0.36, borderWidth: 1.5, borderColor: color, borderTopWidth: 0, overflow: 'hidden' }} />
  </View>
);

// Logout: door with arrow
const LogoutNavIcon = ({ color = '#fff', size = 16 }) => (
  <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
    <View style={{ position: 'absolute', left: 0, top: 0, width: size * 0.55, height: size, borderWidth: 1.5, borderColor: color, borderRadius: size * 0.08 }} />
    <View style={{ position: 'absolute', right: size * 0.02, width: size * 0.52, height: 1.8, backgroundColor: color, borderRadius: 1 }} />
    <View style={{ position: 'absolute', right: size * 0.02, width: size * 0.2, height: size * 0.2, borderTopWidth: 1.8, borderRightWidth: 1.8, borderColor: color, transform: [{ rotate: '45deg' }], marginTop: -size * 0.01 }} />
  </View>
);

// ─── DOCUMENT CARD (lydo-style) ───────────────────────────────────────────────
const DocumentCard = ({ group, onItemPress, submittedSet, labelToDocType }) => {
  const { colors, title, icon, items } = group;
  return (
    <View style={[styles.card, { backgroundColor: colors.bg }]}>
      <View style={[styles.cardHeader, { backgroundColor: colors.header }]}>
        <Text style={styles.cardHeaderIcon}>{icon}</Text>
        <Text style={styles.cardHeaderTitle}>{title}</Text>
      </View>
      <View style={styles.cardBody}>
        {items.map((item, idx) => {
          const docType = (labelToDocType && labelToDocType[item]) || item;
          const hasSubmission = submittedSet && submittedSet.has(docType);
          return (
            <TouchableOpacity
              key={idx}
              style={styles.docItem}
              onPress={() => onItemPress && onItemPress(item, group)}
              activeOpacity={0.7}
            >
              <View style={[styles.docBullet, { backgroundColor: colors.header }]} />
              <Text style={[styles.docItemText, { color: hasSubmission ? colors.subText : '#E53935' }]}>{item}</Text>
              {!hasSubmission && <View style={styles.redDot} />}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

// ─── MAIN SCREEN ──────────────────────────────────────────────────────────────
export default function SKDocumentScreen() {
  const router = useRouter();
  const { activeTab, setActiveTab } = useNav();
  const { logout, user } = useAuth();

  // Get user's barangay from auth context
  const barangayName = user?.barangay?.barangay_name || 'Unknown Barangay';
  const barangayId = user?.barangayId;

  const [activeDocTab, setActiveDocTab]     = useState('Folder');
  const [searchText, setSearchText]         = useState('');
  const [notifCount]                        = useState(2);
  const [sidebarVisible, setSidebarVisible] = useState(false);
  const [documents, setDocuments]           = useState([]);

  // Fetch documents for this barangay - refresh every time the screen is focused
  useFocusEffect(
    useCallback(() => {
      if (!barangayId) return;

      const fetchDocuments = async () => {
        try {
          const { data: docs, error } = await supabase
            .from('documents')
            .select('document_id, title, folder_category, document_type, status, year, created_at')
            .eq('barangay_id', barangayId)
            .order('created_at', { ascending: false });

          if (error) {
            console.error('Error fetching documents:', error);
            return;
          }

          setDocuments(docs || []);
        } catch (error) {
          console.error('Error:', error);
        }
      };

      fetchDocuments();
    }, [barangayId])
  );

  const handleNavPress = (tab) => {
    setActiveTab(tab);
    setSidebarVisible(false);
    if (tab === 'Dashboard') router.push('/(tabs)/sk-dashboard');
    if (tab === 'Documents') router.push('/(tabs)/sk-document');
    if (tab === 'Planning')  router.push('/(tabs)/sk-planning');
    if (tab === 'Portal')    router.push('/(tabs)/sk-portal');
      if (tab === 'Logs')      router.push('/(tabs)/sk-logs');
    if (tab === 'Account')   router.push('/(tabs)/sk-account');
  };

  const handleLogout = () => { logout(); router.replace('/'); };

  // Tap a bullet item → navigate to list screen with category + subType params
  const handleItemPress = (itemName, group) => {
    router.push({
      pathname: '/(tabs)/sk-document-list',
      params: { category: group.category, subType: itemName },
    });
  };

  // Map short card labels → full document_type values stored in the DB
  const LABEL_TO_DOC_TYPE = {
    'ABYIP':                    'Annual Barangay Youth Investment Program (ABYIP)',
    'CBYDP':                    'Comprehensive Barangay Youth Development Plan (CBYDP)',
    'Work Plans':               'Work Plans',
    'Project Proposals':        'Project Proposals',
    'Monthly Itemized List':    'Monthly Itemized List',
    'Quarterly Register of Bank': 'Quarterly Financial Reports',
    'Annual Budget':            'Approved Annual Budget',
    'Disbursement Vouchers':    'Disbursement Vouchers',
    'Liquidation Reports':      'Liquidation Reports',
    'Resolutions':              'Resolutions',
    'Ordinances':               'Ordinances',
    'Accomplishment Reports':   'Accomplishment Reports',
    'Activity Documentation':   'Documentation',
    'Event Reports':            'Event Reports',
    'Minutes of the meetings':  'Minutes of Meetings',
  };

  // Build a set of document_type values that have been submitted/approved/returned
  const submittedSet = new Set(
    documents
      .filter(d => ['submitted', 'approved', 'returned'].includes(d.status))
      .map(d => d.document_type)
      .filter(Boolean)
  );

  // Filter by search only (Folder tab shows all categories)
  const visibleCategories = DOC_CATEGORIES.filter(cat => {
    const matchesSearch = searchText === '' ||
      cat.title.toLowerCase().includes(searchText.toLowerCase()) ||
      cat.items.some(i => i.toLowerCase().includes(searchText.toLowerCase()));
    return matchesSearch;
  });

  // ── Sidebar ──
  const NAV_ITEMS = [
    { tab: 'Dashboard', IconComponent: DashboardIcon },
    { tab: 'Documents', IconComponent: DocumentsIcon },
    { tab: 'Planning',  IconComponent: PlanningIcon  },
    { tab: 'Portal',    IconComponent: PortalIcon    },
    { tab: 'Logs',      IconComponent: LogsIcon      },
    { tab: 'Account',   IconComponent: AccountIcon   },
  ];

  const renderSidebar = () => (
    <View style={[styles.sidebar, isMobile && !sidebarVisible && styles.sidebarHidden]}>
      <View style={styles.logoPill}>
        <Image
          source={require('./../../assets/images/sk-logo.png')}
          style={styles.logoImage}
          resizeMode="contain"
        />
      </View>
      <View style={{ height: 28 }} />
      {NAV_ITEMS.map(({ tab, IconComponent }) => {
        const active = activeTab === tab;
        const iconColor = active ? '#133E75' : 'rgba(255,255,255,0.85)';
        return (
          <TouchableOpacity
            key={tab}
            style={[styles.navItem, active && styles.navItemActive]}
            onPress={() => handleNavPress(tab)}
            activeOpacity={0.8}
          >
            <View style={styles.navItemInner}>
              <IconComponent color={iconColor} size={16} />
              <Text style={[styles.navLabel, active && styles.navLabelActive]}>{tab}</Text>
            </View>
          </TouchableOpacity>
        );
      })}
      <View style={{ flex: 1 }} />
      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.8}>
        <View style={styles.navItemInner}>
          <LogoutNavIcon color="rgba(255,255,255,0.85)" size={16} />
          <Text style={styles.logoutText}>Logout</Text>
        </View>
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
          <Text style={styles.mobileTitle}>Documents</Text>
          <TouchableOpacity style={styles.bellBtn}>
            <BellIcon hasNotif={notifCount > 0} />
          </TouchableOpacity>
        </View>
      )}

      {/* Desktop Header */}
      {!isMobile && (
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerSub}>SANGGUNIANG KABATAAN</Text>
            <Text style={styles.headerTitle}>{barangayName.toUpperCase()}</Text>
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

      {/* Category label + Tab bar */}
      <View style={styles.categoryRow}>
        <Text style={styles.categoryLabel}>Category:</Text>
      </View>

      <View style={styles.filterRow}>
        {/* Folder / Document Management tab bar */}
        <View style={styles.docTabBar}>
          {DOCUMENT_TABS.map(tab => {
            const active = activeDocTab === tab;
            return (
              <TouchableOpacity
                key={tab}
                style={[styles.docTab, active && styles.docTabActive]}
                onPress={() => {
                  setActiveDocTab(tab);
                  if (tab === 'Document Management') {
                    router.push({ pathname: '/(tabs)/sk-document-management' });
                  }
                }}
                activeOpacity={0.8}
              >
                <Text style={[styles.docTabText, active && styles.docTabTextActive]}>
                  {tab}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Search Bar + Scan Button */}
      <View style={styles.searchRow}>
        <View style={styles.searchBox}>
          <Text style={styles.searchIcon}>🔍</Text>
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

      </View>

      {/* Document Cards Grid */}
      <View style={isMobile ? styles.gridMobile : styles.gridInner}>
        {visibleCategories.length > 0 ? (
          visibleCategories.map(cat => (
            <View key={cat.id} style={isMobile ? styles.cardWrapperMobile : styles.cardWrapper}>
              <DocumentCard group={cat} onItemPress={handleItemPress} submittedSet={submittedSet} labelToDocType={LABEL_TO_DOC_TYPE} />
            </View>
          ))
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No documents found.</Text>
          </View>
        )}
      </View>
    </ScrollView>
  );

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.navy} />

      <View style={styles.layout}>
        {isMobile && sidebarVisible && (
          <TouchableOpacity
            style={styles.sidebarOverlay}
            activeOpacity={1}
            onPress={() => setSidebarVisible(false)}
          />
        )}
        {renderSidebar()}
        {renderContent()}
      </View>
    </SafeAreaView>
  );
}

// ─── STYLES ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: COLORS.navy },
  layout: { flex: 1, flexDirection: 'row' },

  // ── Sidebar ──
  sidebar: {
    width: 250, backgroundColor: COLORS.navy,
    alignItems: 'center', paddingTop: 20, paddingBottom: 24,
    paddingHorizontal: 10, zIndex: 20,
    ...(isMobile ? {
      position: 'absolute', top: 0, left: 0, bottom: 0, zIndex: 20,
    } : {}),
  },
  sidebarHidden: {
    display: 'none',
  },
  sidebarOverlay: {
    position: 'absolute', left: 0, top: 0, bottom: 0, right: 0,
    backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 15,
  },
  logoPill: {
    marginTop: 20, width: 70, height: 70, borderRadius: 35,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 8, borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)',
  },
  logoImage: { width: 100, height: 100 },
  navItem: {
    width: '100%', paddingVertical: 12, paddingHorizontal: 12,
    borderRadius: 24, marginBottom: 8, alignItems: 'center',
    borderWidth: 1.5, borderColor: COLORS.white, backgroundColor: COLORS.navy,
  },
  navItemInner: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  navItemActive: { backgroundColor: COLORS.white, borderColor: COLORS.white },
  navLabel: { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.85)', letterSpacing: 0.3 },
  navLabelActive: { color: '#000', fontWeight: '800' },
  logoutBtn: {
    width: '100%', paddingVertical: 12, paddingHorizontal: 12, borderRadius: 24,
    marginTop: 8, alignItems: 'center', borderWidth: 1.5, borderColor: COLORS.white,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  logoutText: { fontSize: 13, fontWeight: '600', color: '#fff', letterSpacing: 0.3 },

  // ── Main ──
  main:        { flex: 1, backgroundColor: COLORS.offWhite, borderTopLeftRadius: 20 },
  mainMobile:  { borderTopLeftRadius: 0 },
  mainContent: { padding: 20, paddingBottom: 40 },

  // Mobile header
  mobileHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 16, paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: COLORS.lightGray,
  },
  menuBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: COLORS.cardBg, alignItems: 'center', justifyContent: 'center',
  },
  menuIconContainer: { width: 20, height: 16, justifyContent: 'space-between' },
  menuLine: { width: 20, height: 2, backgroundColor: COLORS.navy, borderRadius: 1 },
  mobileTitle: { fontSize: 18, fontWeight: '800', color: COLORS.darkText },

  // Desktop header
  header: {
    flexDirection: 'row', alignItems: 'flex-start',
    justifyContent: 'space-between', marginBottom: 12,
  },
  headerSub: {
    fontSize: 10, fontWeight: '600', color: COLORS.subText,
    letterSpacing: 2, textTransform: 'uppercase', marginBottom: 2,
  },
  headerTitle: { fontSize: 22, fontWeight: '900', color: COLORS.darkText },

  // Bell
  bellBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: COLORS.cardBg, alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08, shadowRadius: 6, elevation: 3,
  },
  bellWrapper: { width: 20, height: 22, alignItems: 'center' },
  bellBody:    { width: 14, height: 12, borderRadius: 7, borderWidth: 2, borderColor: '#8B0000', marginTop: 4 },
  bellBottom:  { width: 8, height: 4, borderBottomLeftRadius: 4, borderBottomRightRadius: 4, backgroundColor: '#8B0000', marginTop: -1 },
  bellDot:     { position: 'absolute', top: 0, right: 1, width: 7, height: 7, borderRadius: 4, backgroundColor: COLORS.gold, borderWidth: 1.5, borderColor: COLORS.cardBg },
  notifBadge:  { position: 'absolute', top: -2, right: -2, width: 16, height: 16, borderRadius: 8, backgroundColor: COLORS.gold, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: COLORS.white },
  notifBadgeText: { fontSize: 8, fontWeight: '900', color: COLORS.navy },

  // Search + Scan
  searchRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: 16,
  },
  searchBox: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.white, borderRadius: 20,
    borderWidth: 1, borderColor: COLORS.lightGray,
    paddingHorizontal: 12, paddingVertical: 7,
    width: isMobile ? '60%' : 280,
  },
  searchIcon:  { fontSize: 12, color: COLORS.midGray, marginRight: 4 },
  searchInput: { flex: 1, fontSize: 12, color: COLORS.darkText },
  scanBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 20, borderWidth: 1.5, borderColor: COLORS.navy,
    backgroundColor: COLORS.white,
  },
  scanIcon: { fontSize: 13, color: COLORS.navy },
  scanText: { fontSize: 13, fontWeight: '700', color: COLORS.navy },

  // Category label
  categoryRow:   { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  categoryLabel: { fontSize: 12, fontWeight: '700', color: COLORS.darkText },

  // ── FILTER ROW ──
  filterRow: {
    flexDirection: 'row', alignItems: 'flex-start', marginBottom: 16, gap: 6,
    zIndex: 10,
  },

  // ── DOCUMENT TAB BAR (4 tabs only) ──
  docTabBar: {
    flex: 1, flexDirection: 'row', borderRadius: 4, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.28, shadowRadius: 3, elevation: 6,
    height: 38,
  },
  docTab: {
    flex: 1, paddingHorizontal: isMobile ? 4 : 10,
    backgroundColor: COLORS.navy, borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center',
  },
  docTabActive: {
    backgroundColor: COLORS.gold, borderRadius: 4, borderColor: COLORS.gold,
    shadowColor: COLORS.gold, shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4, shadowRadius: 4, elevation: 3,
  },
  docTabText: {
    fontSize: isMobile ? 9 : 12, fontWeight: '600',
    color: COLORS.white, textAlign: 'center',
  },
  docTabTextActive: { color: COLORS.darkText, fontWeight: '800' },

  // ── Cards grid ──
  gridInner:         { flexDirection: 'row', flexWrap: 'wrap', gap: 12, paddingBottom: 24 },
  gridMobile:        { flexDirection: 'column', gap: 12, paddingBottom: 24 },
  cardWrapper:       { width: '47%', minWidth: 150 },
  cardWrapperMobile: { width: '100%' },

  // ── Individual doc card (lydo-style) ──
  card: {
    borderRadius: 16, overflow: 'hidden', elevation: 3,
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1, shadowRadius: 8,
  },
  cardHeader: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 12, gap: 8,
  },
  cardHeaderIcon:  { fontSize: isMobile ? 16 : 18 },
  cardHeaderTitle: {
    fontSize: isMobile ? 8 : 10, fontWeight: '900', color: COLORS.white,
    letterSpacing: 0.8, flex: 1, flexWrap: 'wrap',
  },
  cardBody:    { padding: isMobile ? 10 : 14 },
  docItem:     { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 6 },
  docBullet:   { width: 5, height: 5, borderRadius: 3, marginTop: 5, flexShrink: 0 },
  docItemText: { fontSize: isMobile ? 11 : 12, lineHeight: 18, flex: 1 },
  redDot: {
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: '#E53935', flexShrink: 0, alignSelf: 'center',
  },

  // Empty state
  emptyState: { flex: 1, alignItems: 'center', marginTop: 60 },
  emptyText:  { fontSize: 14, color: COLORS.midGray },
});