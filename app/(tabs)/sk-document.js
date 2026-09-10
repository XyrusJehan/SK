import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, ScrollView, TouchableOpacity,
  StyleSheet, StatusBar, Dimensions,
  Alert,
} from 'react-native';
// SafeAreaView from core 'react-native' is a no-op on Android. Use the
// context-aware version so insets work on both platforms.
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import Head from 'expo-router/head';
import { useNav } from './navContext';
import { useAuth } from './authContext';
import { supabase } from '../../utils/supabase';
import { NotificationModal, useNotificationCenter, BellIcon } from './notificationCenter';
import Sidebar from './../components/Sidebar';
import MobileHeader, { MobileHeaderSpacer } from './mobileHeader';

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
    header:  '#2A4E8A',
    bg:      '#FFFFFF',
    text:    '#FFFFFF',
    subText: '#2A4E8A',
    border:  '#D3DCEB',
  },
  financial: {
    header:  '#1F7A3E',
    bg:      '#FFFFFF',
    text:    '#FFFFFF',
    subText: '#1A6B38',
    border:  '#D2E5D6',
  },
  governance: {
    header:  '#5A3E96',
    bg:      '#FFFFFF',
    text:    '#FFFFFF',
    subText: '#5A2EA0',
    border:  '#DCD4EC',
  },
  performance: {
    header:  '#B85A18',
    bg:      '#FFFFFF',
    text:    '#FFFFFF',
    subText: '#A04010',
    border:  '#EAD9C8',
  },
};

// ─── TABS ─────────────────────────────────────────────────────────────────────
const NAV_TABS      = ['Dashboard', 'Documents', 'Planning', 'Portal', 'Logs', 'Account'];
const DOCUMENT_TABS = ['Folder', 'Document Management'];

// ─── DOCUMENT CATEGORIES (built from database) ────────────────────────────────
// Map category names to color palette + icon for the folder cards
const CATEGORY_META = {
  Planning: {
    id: 'planning',
    title: 'PLANNING DOCUMENTS',
    icon: '📅',
    colors: COLORS.planning,
    tab: 'Planning',
  },
  Financial: {
    id: 'financial',
    title: 'FINANCIAL DOCUMENTS',
    icon: '💲',
    colors: COLORS.financial,
    tab: 'Financial',
  },
  Governance: {
    id: 'governance',
    title: 'GOVERNANCE DOCUMENTS',
    icon: '⚖️',
    colors: COLORS.governance,
    tab: 'Governance',
  },
  Performance: {
    id: 'performance',
    title: 'PERFORMANCE DOCUMENTS',
    icon: '👥',
    colors: COLORS.performance,
    tab: 'Activities',
  },
};

const getCategoryMeta = (name) => {
  if (CATEGORY_META[name]) return CATEGORY_META[name];
  // Fallback for any category not in the predefined map
  return {
    id: name.toLowerCase(),
    title: `${name.toUpperCase()} DOCUMENTS`,
    icon: '📁',
    colors: COLORS.planning,
    tab: name,
  };
};

// ─── ICONS ────────────────────────────────────────────────────────────────────
// BellIcon now lives in notificationCenter.js and is imported above — shared
// across every screen (SK + LYDO, desktop + mobile) instead of being redrawn here.
// MenuIcon now lives in the shared mobileHeader module (see import above) so the
// sticky mobile bar is identical on every SK + LYDO screen.

// Nav icons + NAV_ITEMS now live in the shared Sidebar module (see import above).

// ─── DOCUMENT CARD (lydo-style) ───────────────────────────────────────────────
const DocumentCard = ({ group, onItemPress, submittedSet }) => {
  const { colors, title, icon, items } = group;
  return (
    <View
      style={[
        styles.card,
        !isMobile && styles.cardFillHeight,
        { backgroundColor: colors.bg, borderColor: colors.border || '#E5E5E5' },
      ]}
    >
      <View style={[styles.cardHeader, { backgroundColor: colors.header }]}>
        <Text style={styles.cardHeaderIcon}>{icon}</Text>
        <Text style={styles.cardHeaderTitle}>{title}</Text>
      </View>
      <View style={styles.cardBody}>
        {items.map((item, idx) => {
          const hasSubmission = submittedSet && submittedSet.has(Number(item.id));
          return (
            <TouchableOpacity
              key={item.id || idx}
              style={styles.docItem}
              onPress={() => onItemPress && onItemPress(item, group)}
              activeOpacity={0.7}
            >
              <View style={[styles.docBullet, { backgroundColor: colors.header }]} />
              <Text style={[styles.docItemText, { color: hasSubmission ? colors.subText : '#E53935' }]}>{item.name}</Text>
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
  const [sidebarVisible, setSidebarVisible] = useState(false);
  const [documents, setDocuments]           = useState([]);

  // This screen is always the "Folder" view. Tapping "Document Management" sets
  // activeDocTab locally before navigating away so the tab highlights briefly,
  // but since this screen stays mounted in the background, that stale value
  // would otherwise still be active when the user comes back. Reset it on focus.
  useFocusEffect(
    useCallback(() => {
      setActiveDocTab('Folder');
    }, [])
  );

  // ── Shared notification bell (returned/approved docs, templates, deadlines) ──
  const notif = useNotificationCenter(barangayId);
  const notifCount = notif.count;

  // Reference tables - fetched from database
  const [documentCategories, setDocumentCategories] = useState([]);
  const [documentTypes, setDocumentTypes] = useState([]);
  const [folderYears, setFolderYears] = useState([]);

  // Fetch reference tables on mount
  useEffect(() => {
    const fetchReferenceData = async () => {
      try {
        // Fetch document categories
        const { data: categories, error: catError } = await supabase
          .from('document_category')
          .select('id, document_category, year')
          .order('document_category');

        if (!catError && categories) {
          setDocumentCategories(categories);
        }

        // Fetch document types
        const { data: types, error: typeError } = await supabase
          .from('document_types')
          .select('id, document_type, category, year')
          .order('document_type');

        if (!typeError && types) {
          setDocumentTypes(types);
        }

        // Fetch folder years
        const { data: years, error: yearError } = await supabase
          .from('folder_year')
          .select('id, fiscal_year')
          .order('fiscal_year', { ascending: false });

        if (!yearError && years) {
          setFolderYears(years);
        }
      } catch (error) {
        console.error('Error fetching reference data:', error);
      }
    };

    fetchReferenceData();
  }, []);

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

          // Transform the data to include readable category and document type names
          const formattedDocs = (docs || []).map(doc => ({
            ...doc,
            category_name: documentCategories.find(c => c.id === Number(doc.folder_category))?.document_category || doc.folder_category || '',
            doc_type_name: documentTypes.find(t => t.id === Number(doc.document_type))?.document_type || doc.document_type || '',
            year_value: folderYears.find(y => y.id === Number(doc.year))?.fiscal_year || doc.year
          }));

          setDocuments(formattedDocs);
        } catch (error) {
          console.error('Error:', error);
        }
      };

      fetchDocuments();
    }, [barangayId, documentCategories, documentTypes, folderYears])
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

  // Tap a bullet item → navigate to list screen filtered to just the category (shows All)
  const handleItemPress = (item, group) => {
    router.push({
      pathname: '/(tabs)/sk-document-list',
      params: { category: group.category },
    });
  };

  // Build categories dynamically from fetched document_types grouped by document_category
  const fetchedCategories = documentCategories.map(cat => {
    const meta = getCategoryMeta(cat.document_category);
    const items = documentTypes
      .filter(t => t.category === cat.id)
      .map(t => ({ id: t.id, name: t.document_type }));
    return {
      ...meta,
      categoryId: cat.id,
      category: cat.document_category,
      items,
    };
  });

  // Build a set of document_type IDs that have been submitted/approved/returned
  const submittedSet = new Set(
    documents
      .filter(d => ['submitted', 'approved', 'returned'].includes(d.status))
      .map(d => Number(d.document_type))
      .filter(Boolean)
  );

  // Filter by search only (Folder tab shows all categories)
  const visibleCategories = fetchedCategories.filter(cat => {
    const matchesSearch = searchText === '' ||
      cat.title.toLowerCase().includes(searchText.toLowerCase()) ||
      cat.items.some(i => i.name.toLowerCase().includes(searchText.toLowerCase()));
    return matchesSearch;
  });

  // ── Sidebar (rendered by the shared Sidebar module) ──
  const renderSidebar = () => (
    <Sidebar
      activeTab={activeTab}
      onNavPress={handleNavPress}
      onLogout={handleLogout}
      isMobile={isMobile}
      sidebarVisible={sidebarVisible}
    />
  );


  // ── Main Content ──
  const renderContent = () => (
    <View style={[styles.main, isMobile && styles.mainMobile]}>
      <MobileHeader
        title="Documents"
        onMenuPress={() => setSidebarVisible(true)}
        onBellPress={notif.open}
        bellCount={notifCount}
        BellIcon={BellIcon}
        colors={COLORS}
        hidden={isMobile && sidebarVisible}
      />
      <ScrollView
        style={styles.mainScroll}
        contentContainerStyle={styles.mainContent}
        showsVerticalScrollIndicator={false}
      >
        <MobileHeaderSpacer />

      {/* Desktop Header */}
      {!isMobile && (
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerSub}>SANGGUNIANG KABATAAN</Text>
            <Text style={styles.headerTitle}>{barangayName.toUpperCase()}</Text>
          </View>
          <TouchableOpacity
            style={styles.bellBtn}
            onPress={notif.open}
            activeOpacity={0.7}
          >
            <BellIcon count={notifCount} />
          </TouchableOpacity>
        </View>
      )}



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
              <DocumentCard group={cat} onItemPress={handleItemPress} submittedSet={submittedSet} />
            </View>
          ))
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No documents found.</Text>
          </View>
        )}
      </View>
      </ScrollView>
    </View>
  );

  return (
    <>
      <Head>
        <title>Document · SK Monitoring</title>
      </Head>
      <SafeAreaView style={styles.safe} edges={isMobile ? ['left', 'right', 'bottom'] : ['top', 'left', 'right', 'bottom']}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.navy} />

      <NotificationModal
        {...notif.modalProps}
        onOpenRoute={(route) => {
          notif.close();
          setTimeout(() => router.push(route), 120);
        }}
      />

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
    </>
  );
}

// ─── STYLES ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: COLORS.navy },
  layout: { flex: 1, flexDirection: 'row' },

  // Sidebar styles now live in the shared Sidebar module.
  sidebarOverlay: {
    position: 'absolute', left: 0, top: 0, bottom: 0, right: 0,
    backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 15,
  },

  // ── Main ──
  main:        { flex: 1, backgroundColor: COLORS.offWhite, borderTopLeftRadius: 20 },
  mainMobile:  { borderTopLeftRadius: 0 },
  mainScroll:  { flex: 1 },
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
  headerTitle: {
    fontSize: 22, fontWeight: '900', color: COLORS.darkText, letterSpacing: 0.3,
    borderBottomWidth: 2, borderBottomColor: COLORS.lightGray, paddingBottom: 4, marginBottom: 6,
  },

  // Bell
  bellBtn: {
    position: 'relative',
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: COLORS.cardBg, alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08, shadowRadius: 6, elevation: 3,
  },
  bellBtnMobile: {
    position: 'relative',
  },
  // Unread-count badge now lives in BellIcon (notificationCenter.js) — it
  // used to be redefined here in gold/navy, out of sync with SK dashboard's
  // red/white design. Removed in favor of the shared component.

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
    backgroundColor: COLORS.gold, borderColor: COLORS.gold,
    shadowColor: COLORS.gold, shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4, shadowRadius: 4, elevation: 3,
  },
  docTabText: {
    fontSize: isMobile ? 9 : 12, fontWeight: '600',
    color: COLORS.white, textAlign: 'center',
  },
  docTabTextActive: { color: COLORS.darkText, fontWeight: '800' },

  // ── Cards grid ──
  gridInner:         { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingBottom: 24 },
  gridMobile:        { flexDirection: 'column', gap: 14, paddingBottom: 24 },
  cardWrapper:       { flexBasis: '23%', flexGrow: 1, minWidth: 220 },
  cardWrapperMobile: { width: '100%' },

  // ── Individual doc card (lydo-style) ──
  card: {
    borderRadius: 10, overflow: 'hidden', elevation: 2,
    borderWidth: 1,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 6,
  },
  // Only used on the desktop row-wrap grid, to make cards in the same row
  // match height. On mobile (column stack) each card wrapper has no fixed
  // height, and a bare `height: '100%'` there resolves against the nearest
  // ancestor with a defined height on Android — stretching the first card
  // to fill the whole scroll view and pushing every other card off-screen.
  cardFillHeight: {
    height: '100%',
  },
  cardHeader: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 13, gap: 8,
  },
  cardHeaderIcon:  { fontSize: isMobile ? 17 : 19 },
  cardHeaderTitle: {
    fontSize: isMobile ? 13 : 15, fontWeight: '700', color: COLORS.white,
    letterSpacing: 1, flex: 1, flexWrap: 'wrap',
  },
  cardBody:    { padding: isMobile ? 12 : 16 },
  docItem:     { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 10 },
  docBullet:   { width: 5, height: 5, borderRadius: 2.5, marginTop: 9, flexShrink: 0 },
  docItemText: { fontSize: isMobile ? 15 : 17, lineHeight: 24, flexShrink: 1, fontWeight: '500' },
  redDot: {
    width: 7, height: 7, borderRadius: 3.5,
    backgroundColor: '#C0392B', flexShrink: 0, alignSelf: 'center', marginTop: 2,
  },

  // Empty state
  emptyState: { flex: 1, alignItems: 'center', marginTop: 60 },
  emptyText:  { fontSize: 14, color: COLORS.midGray },
});