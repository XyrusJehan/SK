import React, { useState, useMemo, useEffect } from 'react';
import {
  View, Text, TextInput, ScrollView, TouchableOpacity,
  StyleSheet, SafeAreaView, StatusBar, Dimensions, Image, Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
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
  red:       '#D32F2F',
  blue:      '#1565C0',
  teal:      '#00796B',
};

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const NAV_TABS       = ['Dashboard', 'Documents', 'Planning', 'Portal'];
const DOCUMENT_TABS  = ['Folder', 'Document Management'];
const STATUS_TABS    = ['Drafts', 'Saved', 'Submitted', 'Approved'];
const DRAFT_TYPES    = ['All Types', 'Planning', 'Financial', 'Governance', 'Performance'];
const SORT_OPTIONS   = ['Newest', 'Oldest', 'Title A-Z', 'Title Z-A'];

// ─── MOCK DATA ────────────────────────────────────────────────────────────────
// (Data now fetched from Supabase based on barangay_id)
const MOCK_DOCUMENTS = {
};

// ─── ICON COMPONENTS ──────────────────────────────────────────────────────────
const MenuIcon = () => (
  <View style={styles.menuIconContainer}>
    {[0, 1, 2].map(i => <View key={i} style={styles.menuLine} />)}
  </View>
);

const BellIcon = ({ hasNotif }) => (
  <View style={styles.bellWrapper}>
    <View style={styles.bellBody} />
    <View style={styles.bellBottom} />
    {hasNotif && <View style={styles.bellDot} />}
  </View>
);

// Edit icon (pencil)
const EditIcon = () => (
  <View style={styles.actionIconWrap}>
    <Text style={[styles.actionIconText, { color: COLORS.navy }]}>✏️</Text>
  </View>
);

// Delete icon (trash)
const DeleteIcon = () => (
  <View style={styles.actionIconWrap}>
    <Text style={[styles.actionIconText, { color: COLORS.red }]}>🗑️</Text>
  </View>
);

// View icon (eye)
const ViewIcon = () => (
  <View style={styles.actionIconWrap}>
    <Text style={[styles.actionIconText, { color: COLORS.teal }]}>👁️</Text>
  </View>
);

// ─── TYPE BADGE ───────────────────────────────────────────────────────────────
const TypeBadge = ({ type }) => {
  const colorMap = {
    Financial:   { bg: '#E8F5E9', text: '#1A6B38' },
    Planning:    { bg: '#E3EDF9', text: '#2A4E8A' },
    Governance:  { bg: '#F2EEF9', text: '#5A2EA0' },
    Performance: { bg: '#FDF2EA', text: '#A04010' },
  };
  const c = colorMap[type] || { bg: COLORS.lightGray, text: COLORS.subText };
  return (
    <View style={[styles.typeBadge, { backgroundColor: c.bg }]}>
      <Text style={[styles.typeBadgeText, { color: c.text }]}>{type}</Text>
    </View>
  );
};

// ─── MAIN SCREEN ──────────────────────────────────────────────────────────────
export default function SKDocumentManagementScreen() {
  const router = useRouter();
  const { setActiveTab } = useNav();
  const { logout, user } = useAuth();

  // Get user's barangay from auth context
  const barangayName = user?.barangay?.barangay_name || 'Unknown Barangay';
  const barangayId = user?.barangayId;

  const [activeDocTab, setActiveDocTab] = useState('Document Management');
  const [activeStatusTab, setActiveStatusTab] = useState('Drafts');
  const [searchText, setSearchText]           = useState('');
  const [draftType, setDraftType]             = useState('All Types');
  const [sortBy, setSortBy]                   = useState('Newest');
  const [sidebarVisible, setSidebarVisible]   = useState(false);
  const [typeDropdownOpen, setTypeDropdownOpen] = useState(false);
  const [sortDropdownOpen, setSortDropdownOpen] = useState(false);
  const [notifCount]                          = useState(2);
  const [documents, setDocuments]             = useState([]);

  // Fetch documents for this barangay
  useEffect(() => {
    const fetchDocuments = async () => {
      if (!barangayId) return;

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

        const formattedDocs = docs?.map(doc => ({
          id: doc.document_id,
          title: doc.title || 'Untitled',
          type: doc.document_type || 'Unknown',
          status: doc.status || 'draft',
          createdBy: 'Unknown',
          lastModified: doc.created_at || new Date().toISOString(),
        })) || [];

        setDocuments(formattedDocs);
      } catch (error) {
        console.error('Error:', error);
      }
    };

    fetchDocuments();
  }, [barangayId]);

  const handleNavPress = (tab) => {
    setActiveTab(tab);
    setSidebarVisible(false);
    if (tab === 'Dashboard') router.push('/(tabs)/sk-dashboard');
    if (tab === 'Documents') router.push('/(tabs)/sk-document');
    if (tab === 'Planning')  router.push('/(tabs)/sk-planning');
    if (tab === 'Portal')    router.push('/(tabs)/sk-portal');
  };

  const formatDate = (dateStr) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  // Filtered + sorted documents
  const visibleDocs = useMemo(() => {
    // Filter by status tab (draft, saved, submitted, approved)
    const statusMap = { 'Drafts': 'draft', 'Saved': 'saved', 'Submitted': 'submitted', 'Approved': 'approved' };
    const statusFilter = statusMap[activeStatusTab];
    let docs = statusFilter ? documents.filter(d => d.status === statusFilter) : documents;

    // Filter by type
    if (draftType !== 'All Types') {
      docs = docs.filter(d => d.type === draftType);
    }

    // Filter by search
    if (searchText) {
      const q = searchText.toLowerCase();
      docs = docs.filter(d =>
        d.title.toLowerCase().includes(q) ||
        d.type?.toLowerCase().includes(q) ||
        d.createdBy?.toLowerCase().includes(q)
      );
    }

    // Sort
    switch (sortBy) {
      case 'Newest':    return [...docs].sort((a, b) => new Date(b.lastModified) - new Date(a.lastModified));
      case 'Oldest':    return [...docs].sort((a, b) => new Date(a.lastModified) - new Date(b.lastModified));
      case 'Title A-Z': return [...docs].sort((a, b) => a.title.localeCompare(b.title));
      case 'Title Z-A': return [...docs].sort((a, b) => b.title.localeCompare(a.title));
      default:          return docs;
    }
  }, [activeStatusTab, draftType, searchText, sortBy]);

  // ── Sidebar ──
  const renderSidebar = () => (
    <View style={styles.sidebar}>
      <View style={styles.logoPill}>
        <Image
          source={require('./../../assets/images/sk-logo.png')}
          style={styles.logoImage}
          resizeMode="contain"
        />
      </View>
      <View style={{ height: 28 }} />
      {NAV_TABS.map(tab => {
        const active = tab === 'Documents';
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
      <TouchableOpacity
        style={styles.logoutBtn}
        onPress={() => { logout(); router.replace('/'); }}
        activeOpacity={0.8}
      >
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
      keyboardShouldPersistTaps="handled"
    >
      {/* Mobile Header */}
      {isMobile && (
        <View style={styles.mobileHeader}>
          <TouchableOpacity style={styles.menuBtn} onPress={() => setSidebarVisible(true)}>
            <MenuIcon />
          </TouchableOpacity>
          <Text style={styles.mobileTitle}>Document Management</Text>
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

      {/* Search Bar */}
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

      {/* Category label */}
      <View style={styles.categoryRow}>
        <Text style={styles.categoryLabel}>Category:</Text>
      </View>

      {/* Folder / Document Management Tab Bar */}
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
                  if (tab === 'Folder') {
                    router.push({ pathname: '/(tabs)/sk-document' });
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

      {/* Draft Type + Sorted By Row */}
      <View style={styles.controlsRow}>
        {/* Draft Type Dropdown */}
        <View style={styles.dropdownWrap}>
          <TouchableOpacity
            style={styles.dropdownBtn}
            onPress={() => { setTypeDropdownOpen(v => !v); setSortDropdownOpen(false); }}
            activeOpacity={0.8}
          >
            <Text style={styles.dropdownBtnText}>{draftType}</Text>
            <Text style={styles.dropdownArrow}>{typeDropdownOpen ? '▲' : '▼'}</Text>
          </TouchableOpacity>
          {typeDropdownOpen && (
            <View style={styles.dropdownMenu}>
              {DRAFT_TYPES.map(opt => (
                <TouchableOpacity
                  key={opt}
                  style={[styles.dropdownItem, draftType === opt && styles.dropdownItemActive]}
                  onPress={() => { setDraftType(opt); setTypeDropdownOpen(false); }}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.dropdownItemText, draftType === opt && styles.dropdownItemTextActive]}>
                    {opt}
                  </Text>
                  {draftType === opt && <Text style={styles.dropdownCheck}>✓</Text>}
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* Sorted By Dropdown */}
        <View style={styles.dropdownWrap}>
          <TouchableOpacity
            style={styles.dropdownBtn}
            onPress={() => { setSortDropdownOpen(v => !v); setTypeDropdownOpen(false); }}
            activeOpacity={0.8}
          >
            <Text style={styles.dropdownBtnLabel}>Sorted By  </Text>
            <Text style={styles.dropdownBtnText}>{sortBy}</Text>
            <Text style={styles.dropdownArrow}>{sortDropdownOpen ? '▲' : '▼'}</Text>
          </TouchableOpacity>
          {sortDropdownOpen && (
            <View style={[styles.dropdownMenu, { right: 0, left: 'auto' }]}>
              {SORT_OPTIONS.map(opt => (
                <TouchableOpacity
                  key={opt}
                  style={[styles.dropdownItem, sortBy === opt && styles.dropdownItemActive]}
                  onPress={() => { setSortBy(opt); setSortDropdownOpen(false); }}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.dropdownItemText, sortBy === opt && styles.dropdownItemTextActive]}>
                    {opt}
                  </Text>
                  {sortBy === opt && <Text style={styles.dropdownCheck}>✓</Text>}
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      </View>

      {/* Status Sub-Tabs (Drafts / Saved / Submitted / Approved) */}
      <View style={styles.statusTabsRow}>
        {STATUS_TABS.map(tab => {
          const active = activeStatusTab === tab;
          const statusMap = { 'Drafts': 'draft', 'Saved': 'saved', 'Submitted': 'submitted', 'Approved': 'approved' };
          const statusFilter = statusMap[tab];
          const count = statusFilter ? documents.filter(d => d.status === statusFilter).length : 0;
          return (
            <TouchableOpacity
              key={tab}
              style={[styles.statusTab, active && styles.statusTabActive]}
              onPress={() => setActiveStatusTab(tab)}
              activeOpacity={0.8}
            >
              <Text style={[styles.statusTabText, active && styles.statusTabTextActive]}>
                {tab}
              </Text>
              {active && (
                <View style={styles.statusTabBadge}>
                  <Text style={styles.statusTabBadgeText}>{count}</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Document Table */}
      <View style={styles.tableContainer}>
        {/* Table Header */}
        <View style={styles.tableHeader}>
          <Text style={[styles.tableHeaderText, { flex: isMobile ? 2 : 3 }]}>Document Title</Text>
          {!isMobile && <Text style={[styles.tableHeaderText, { flex: 1.2, textAlign: 'center' }]}>Type</Text>}
          {!isMobile && <Text style={[styles.tableHeaderText, { flex: 1.5, textAlign: 'center' }]}>Created By</Text>}
          <Text style={[styles.tableHeaderText, { flex: isMobile ? 1 : 1.5, textAlign: 'center' }]}>Last Modified</Text>
          <Text style={[styles.tableHeaderText, { flex: 1, textAlign: 'center' }]}>Action</Text>
        </View>

        {/* Table Rows */}
        {visibleDocs.length > 0 ? (
          visibleDocs.map((doc, idx) => (
            <View
              key={doc.id}
              style={[styles.tableRow, idx % 2 === 1 && styles.tableRowAlt]}
            >
              {/* Title */}
              <Text
                style={[styles.docTitle, { flex: isMobile ? 2 : 3 }]}
                numberOfLines={isMobile ? 2 : 1}
              >
                {doc.title}
              </Text>

              {/* Type badge (desktop only) */}
              {!isMobile && (
                <View style={{ flex: 1.2, alignItems: 'center' }}>
                  <TypeBadge type={doc.type} />
                </View>
              )}

              {/* Created By (desktop only) */}
              {!isMobile && (
                <Text style={[styles.docMeta, { flex: 1.5, textAlign: 'center' }]}>
                  {doc.createdBy}
                </Text>
              )}

              {/* Last Modified */}
              <Text style={[styles.docMeta, { flex: isMobile ? 1 : 1.5, textAlign: 'center' }]}>
                {formatDate(doc.lastModified)}
              </Text>

              {/* Actions */}
              <View style={[styles.actionRow, { flex: 1 }]}>
                <TouchableOpacity activeOpacity={0.7} onPress={() => {}}>
                  <EditIcon />
                </TouchableOpacity>
                <TouchableOpacity activeOpacity={0.7} onPress={() => {}}>
                  <DeleteIcon />
                </TouchableOpacity>
                <TouchableOpacity activeOpacity={0.7} onPress={() => {}}>
                  <ViewIcon />
                </TouchableOpacity>
              </View>
            </View>
          ))
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>📄</Text>
            <Text style={styles.emptyText}>No documents found.</Text>
            <Text style={styles.emptySubText}>Try adjusting your filters or search term.</Text>
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
        {isMobile ? sidebarVisible && renderSidebar() : renderSidebar()}
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
    paddingHorizontal: 10, zIndex: 10,
  },
  sidebarOverlay: {
    position: 'absolute', left: 0, top: 0, bottom: 0, right: 0,
    backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 5,
  },
  logoPill: {
    marginTop: 20, width: 70, height: 70, borderRadius: 35,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 8, borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)',
  },
  logoImage:     { width: 100, height: 100 },
  navItem: {
    width: '100%', paddingVertical: 12, paddingHorizontal: 12,
    borderRadius: 24, marginBottom: 8, alignItems: 'center',
    borderWidth: 1.5, borderColor: COLORS.white, backgroundColor: COLORS.navy,
    flexDirection: 'row', justifyContent: 'center',
  },
  navItemActive:  { backgroundColor: COLORS.white, borderColor: COLORS.white },
  navLabel:       { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.85)', letterSpacing: 0.3 },
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
  menuBtn:           { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.cardBg, alignItems: 'center', justifyContent: 'center' },
  menuIconContainer: { width: 20, height: 16, justifyContent: 'space-between' },
  menuLine:          { width: 20, height: 2, backgroundColor: COLORS.navy, borderRadius: 1 },
  mobileTitle:       { fontSize: 18, fontWeight: '800', color: COLORS.darkText },

  // Desktop header
  header: {
    flexDirection: 'row', alignItems: 'flex-start',
    justifyContent: 'space-between', marginBottom: 16,
  },
  headerSub:   { fontSize: 10, fontWeight: '600', color: COLORS.subText, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 2 },
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

  // Search
  searchRow: { marginBottom: 10 },

  // Category label
  categoryRow:   { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  categoryLabel: { fontSize: 12, fontWeight: '700', color: COLORS.darkText },

  // Filter Row
  filterRow: {
    flexDirection: 'row', alignItems: 'flex-start', marginBottom: 16, gap: 6,
    zIndex: 10,
  },
  searchBox: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.white, borderRadius: 20,
    borderWidth: 1, borderColor: COLORS.lightGray,
    paddingHorizontal: 12, paddingVertical: 7,
    maxWidth: isMobile ? '100%' : 320,
  },
  searchIcon:  { fontSize: 12, color: COLORS.midGray, marginRight: 4 },
  searchInput: { flex: 1, fontSize: 12, color: COLORS.darkText },

  // ── Controls Row (Draft Type + Sorted By) ──
  controlsRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    marginBottom: 14, zIndex: 20,
  },
  dropdownWrap: { position: 'relative' },
  dropdownBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: COLORS.white, borderRadius: 6,
    borderWidth: 1, borderColor: COLORS.lightGray,
    paddingHorizontal: 12, paddingVertical: 8,
    minWidth: isMobile ? 120 : 150,
  },
  dropdownBtnLabel: { fontSize: 11, color: COLORS.subText },
  dropdownBtnText:  { flex: 1, fontSize: 12, fontWeight: '600', color: COLORS.darkText },
  dropdownArrow:    { fontSize: 8, color: COLORS.subText },
  dropdownMenu: {
    position: 'absolute', top: 42, left: 0, zIndex: 99,
    backgroundColor: COLORS.white, borderRadius: 8, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15, shadowRadius: 8, elevation: 10,
    minWidth: 160, borderWidth: 1, borderColor: COLORS.lightGray,
  },
  dropdownItem: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 10, paddingHorizontal: 14,
    borderBottomWidth: 1, borderBottomColor: COLORS.lightGray,
  },
  dropdownItemActive:     { backgroundColor: '#EEF3FB' },
  dropdownItemText:       { fontSize: 12, fontWeight: '600', color: COLORS.darkText },
  dropdownItemTextActive: { color: COLORS.navy, fontWeight: '800' },
  dropdownCheck:          { fontSize: 12, color: COLORS.navy, fontWeight: '800' },

  // ── Status Sub-Tabs ──
  statusTabsRow: {
    flexDirection: 'row', marginBottom: 12,
    borderBottomWidth: 1.5, borderBottomColor: COLORS.lightGray,
  },
  statusTab: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingVertical: 10, paddingHorizontal: isMobile ? 10 : 16,
    marginBottom: -1.5,
  },
  statusTabActive: {
    borderBottomWidth: 2.5, borderBottomColor: COLORS.navy,
  },
  statusTabText:       { fontSize: isMobile ? 11 : 13, fontWeight: '600', color: COLORS.midGray },
  statusTabTextActive: { color: COLORS.navy, fontWeight: '800' },
  statusTabBadge: {
    backgroundColor: COLORS.navy, borderRadius: 10,
    paddingHorizontal: 6, paddingVertical: 1,
    minWidth: 18, alignItems: 'center',
  },
  statusTabBadgeText: { fontSize: 9, fontWeight: '900', color: COLORS.white },

  // ── Table ──
  tableContainer: {
    backgroundColor: COLORS.white, borderRadius: 12,
    borderWidth: 1.5, borderColor: COLORS.navy + '33',
    overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07, shadowRadius: 8, elevation: 3,
  },
  tableHeader: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 12, paddingHorizontal: 14,
    backgroundColor: COLORS.offWhite,
    borderBottomWidth: 1.5, borderBottomColor: COLORS.lightGray,
  },
  tableHeaderText: { fontSize: isMobile ? 10 : 12, fontWeight: '800', color: COLORS.darkText },
  tableRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 11, paddingHorizontal: 14,
    borderBottomWidth: 1, borderBottomColor: COLORS.lightGray,
  },
  tableRowAlt: { backgroundColor: '#F5F8FC' },

  docTitle: {
    fontSize: isMobile ? 11 : 12, fontWeight: '600', color: COLORS.darkText,
    paddingRight: 6,
  },
  docMeta: { fontSize: isMobile ? 10 : 11, color: COLORS.subText },

  // Type badge
  typeBadge: {
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12,
  },
  typeBadgeText: { fontSize: 10, fontWeight: '700' },

  // Actions
  actionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: isMobile ? 2 : 4 },
  actionIconWrap: { padding: 4 },
  actionIconText: { fontSize: isMobile ? 14 : 16 },

  // Empty state
  emptyState:   { alignItems: 'center', paddingVertical: 60 },
  emptyIcon:    { fontSize: 36, marginBottom: 10 },
  emptyText:    { fontSize: 14, fontWeight: '700', color: COLORS.darkText, marginBottom: 4 },
  emptySubText: { fontSize: 12, color: COLORS.midGray },
});
