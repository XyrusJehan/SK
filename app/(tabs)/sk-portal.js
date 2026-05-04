import React, { useState } from 'react';
import {
  View, Text, TextInput, ScrollView, TouchableOpacity,
  StyleSheet, SafeAreaView, StatusBar, Dimensions,
  Modal, Alert, Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useNav } from './navContext';
import { useAuth } from './authContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const isMobile = SCREEN_WIDTH < 768;

// ─── COLORS (identical to sk-planning) ───────────────────────────────────────
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
};

// ─── NAV & PORTAL TABS ───────────────────────────────────────────────────────
const NAV_TABS    = ['Dashboard', 'Documents', 'Planning', 'Portal'];
const PORTAL_TABS = ['Published', 'Feedback'];

// ─── FILTER OPTIONS ──────────────────────────────────────────────────────────
const DOCUMENT_FILTERS = [
  'All Documents',
  'Comprehensive Barangay Youth Development Plan',
  'Annual Barangay Youth Investment Program',
  'Approved Annual Budget',
  'Quarterly Register of Cash in Bank',
];

const YEAR_FILTERS = ['All Years', '2026', '2025', '2024'];

// ─── PUBLISHED DOCUMENTS ─────────────────────────────────────────────────────
const PUBLISHED_DOCS = [
  { id: 'p1', title: 'Comprehensive Barangay Youth Development Plan (CBYDP) 2026', category: 'Planning', year: '2026', uploadedAt: 'April 21, 2026' },
  { id: 'p2', title: 'Annual Barangay Youth Investment Program (ABYIP) 2026',      category: 'Planning', year: '2026', uploadedAt: 'April 21, 2026' },
  { id: 'p3', title: 'Approved Annual Budget 2026',                                category: 'Budget',   year: '2026', uploadedAt: 'April 15, 2026' },
  { id: 'p4', title: 'Comprehensive Barangay Youth Development Plan (CBYDP) 2026', category: 'Planning', year: '2026', uploadedAt: 'April 10, 2026' },
  { id: 'p5', title: 'Quarterly Register of Cash in Bank (RCB)',                   category: 'Financial',year: '2026', uploadedAt: 'April 5, 2026'  },
];

// ─── FEEDBACK DATA ────────────────────────────────────────────────────────────
const FEEDBACK_ITEMS = [
  { id: 'f1', name: 'Juan Dela Cruz',    comment: 'The CBYDP looks comprehensive. Great work!',    date: 'April 22, 2026', status: 'New' },
  { id: 'f2', name: 'Maria Santos',      comment: 'Can we get an updated version of the Annual Budget?', date: 'April 20, 2026', status: 'Read' },
  { id: 'f3', name: 'Pedro Reyes',       comment: 'Budget allocation for sports programs is noted.', date: 'April 18, 2026', status: 'Read' },
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

const UploadIcon = () => (
  <Text style={{ fontSize: 14, color: COLORS.navy }}>⬆</Text>
);

// ─── DOCUMENT CARD ────────────────────────────────────────────────────────────
const DocumentCard = ({ item, onPress }) => (
  <TouchableOpacity
    style={styles.docCard}
    onPress={() => onPress && onPress(item)}
    activeOpacity={0.75}
  >
    <Text style={styles.docCardTitle} numberOfLines={2}>{item.title}</Text>
  </TouchableOpacity>
);

// ─── FEEDBACK ROW ─────────────────────────────────────────────────────────────
const FeedbackRow = ({ item, idx }) => (
  <View style={[styles.feedbackRow, idx % 2 !== 0 && { backgroundColor: '#FAFAFA' }]}>
    <View style={styles.feedbackLeft}>
      <View style={styles.feedbackAvatar}>
        <Text style={styles.feedbackAvatarText}>{item.name.charAt(0)}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <View style={styles.feedbackNameRow}>
          <Text style={styles.feedbackName}>{item.name}</Text>
          {item.status === 'New' && (
            <View style={styles.feedbackNewBadge}>
              <Text style={styles.feedbackNewBadgeText}>New</Text>
            </View>
          )}
        </View>
        <Text style={styles.feedbackComment} numberOfLines={2}>{item.comment}</Text>
        <Text style={styles.feedbackDate}>{item.date}</Text>
      </View>
    </View>
  </View>
);

// ─── MAIN SCREEN ──────────────────────────────────────────────────────────────
export default function SKPortalScreen() {
  const router = useRouter();
  const { activeTab, setActiveTab } = useNav();
  const { logout } = useAuth();

  const [activePortalTab, setActivePortalTab] = useState('Published');
  const [docFilter, setDocFilter]             = useState('All Documents');
  const [yearFilter, setYearFilter]           = useState('All Years');
  const [searchText, setSearchText]           = useState('');
  const [notifCount]                          = useState(2);
  const [sidebarVisible, setSidebarVisible]   = useState(false);
  const [selectedDoc, setSelectedDoc]         = useState(null);
  const [showDocModal, setShowDocModal]       = useState(false);
  const [showDocDropdown, setShowDocDropdown] = useState(false);
  const [showYearDropdown, setShowYearDropdown] = useState(false);

  const handleNavPress = (tab) => {
    setActiveTab(tab);
    setSidebarVisible(false);
    if (tab === 'Dashboard') router.push('/(tabs)/sk-dashboard');
    if (tab === 'Documents') router.push('/(tabs)/sk-document');
    if (tab === 'Planning')  router.push('/(tabs)/sk-planning');
  };

  const handleLogout = () => { logout(); router.replace('/'); };

  const handleDocPress = (doc) => { setSelectedDoc(doc); setShowDocModal(true); };

  // Filter published docs
  const filteredDocs = PUBLISHED_DOCS.filter(d => {
    const matchesDoc  = docFilter === 'All Documents' || d.title.includes(docFilter.replace(' 2026','').trim());
    const matchesYear = yearFilter === 'All Years' || d.year === yearFilter;
    const matchesSearch = d.title.toLowerCase().includes(searchText.toLowerCase());
    return matchesDoc && matchesYear && matchesSearch;
  });

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
        const active = activeTab === tab || (tab === 'Portal' && activeTab === 'Portal');
        return (
          <TouchableOpacity
            key={tab}
            style={[styles.navItem, active && styles.navItemActive]}
            onPress={() => tab === 'Portal' ? setActiveTab('Portal') : handleNavPress(tab)}
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

  // ── Doc Detail Modal ──
  const renderDocModal = () => (
    <Modal
      visible={showDocModal}
      transparent
      animationType="fade"
      onRequestClose={() => setShowDocModal(false)}
    >
      <TouchableOpacity
        style={styles.modalOverlay}
        activeOpacity={1}
        onPress={() => setShowDocModal(false)}
      >
        <View style={styles.modalCard} onStartShouldSetResponder={() => true}>
          <Text style={styles.modalTitle}>Document</Text>
          <Text style={styles.modalSubtitle} numberOfLines={3}>{selectedDoc?.title}</Text>
          <View style={styles.modalDivider} />
          <View style={styles.modalMeta}>
            <Text style={styles.modalMetaLabel}>Category</Text>
            <Text style={styles.modalMetaValue}>{selectedDoc?.category}</Text>
          </View>
          <View style={styles.modalMeta}>
            <Text style={styles.modalMetaLabel}>Uploaded</Text>
            <Text style={styles.modalMetaValue}>{selectedDoc?.uploadedAt}</Text>
          </View>
          <View style={styles.modalDivider} />
          <View style={styles.modalActions}>
            <TouchableOpacity
              style={[styles.modalActionBtn, { backgroundColor: '#EAF0FB' }]}
              onPress={() => { Alert.alert('View', 'Opening document…'); setShowDocModal(false); }}
            >
              <Text style={[styles.modalActionText, { color: COLORS.navy }]}>👁  View</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalActionBtn, { backgroundColor: '#EAFBEA' }]}
              onPress={() => { Alert.alert('Download', 'Downloading…'); setShowDocModal(false); }}
            >
              <Text style={[styles.modalActionText, { color: '#2E7D32' }]}>⬇  Download</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalActionBtn, { backgroundColor: '#FFEBEE' }]}
              onPress={() => { Alert.alert('Unpublish', 'Remove from portal?'); setShowDocModal(false); }}
            >
              <Text style={[styles.modalActionText, { color: '#B71C1C' }]}>✕  Unpublish</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setShowDocModal(false)}>
            <Text style={styles.modalCloseBtnText}>Close</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
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
          <Text style={styles.mobileTitle}>Portal</Text>
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
            <Text style={styles.headerTitle}>BARANGAY SAN JOSE</Text>
            <Text style={styles.headerDocLabel}>Portal and Post Managemnet</Text>
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
          </View>
        </View>
      )}

      {/* ── PORTAL TAB BAR — same style as PLANNING_TABS ── */}
      <View style={styles.portalTabBar}>
        {PORTAL_TABS.map(tab => {
          const active = activePortalTab === tab;
          return (
            <TouchableOpacity
              key={tab}
              style={[styles.portalTab, active && styles.portalTabActive]}
              onPress={() => tab === 'Published' ? router.push('/(tabs)/sk-portal') : tab === 'Feedback' ? router.push('/(tabs)/sk-portal-feedback') : setActivePlanningTab(tab)} activeOpacity={0.8}>
            
              <Text style={[styles.portalTabText, active && styles.portalTabTextActive]}>
                {tab}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* ── PUBLISHED TAB ── */}
      {activePortalTab === 'Published' && (
        <>
          {/* Filter row: Document | Year | Search | Upload */}
          <View style={styles.filterBarRow}>
            {/* Document filter dropdown */}
            <View style={{ position: 'relative' }}>
              <TouchableOpacity
                style={styles.filterDropdownBtn}
                onPress={() => { setShowDocDropdown(v => !v); setShowYearDropdown(false); }}
                activeOpacity={0.8}
              >
                <Text style={styles.filterDropdownText} numberOfLines={1}>
                  {docFilter === 'All Documents' ? 'Document' : docFilter.length > 20 ? docFilter.slice(0, 20) + '…' : docFilter}
                </Text>
                <Text style={styles.filterDropdownCaret}>▾</Text>
              </TouchableOpacity>
              {showDocDropdown && (
                <View style={styles.filterDropdownPanel}>
                  {DOCUMENT_FILTERS.map(opt => (
                    <TouchableOpacity
                      key={opt}
                      style={[styles.filterDropdownItem, docFilter === opt && styles.filterDropdownItemActive]}
                      onPress={() => { setDocFilter(opt); setShowDocDropdown(false); }}
                    >
                      <Text style={[styles.filterDropdownItemText, docFilter === opt && { color: COLORS.navy, fontWeight: '700' }]}>
                        {opt}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>

            {/* Year filter dropdown */}
            <View style={{ position: 'relative' }}>
              <TouchableOpacity
                style={styles.filterDropdownBtn}
                onPress={() => { setShowYearDropdown(v => !v); setShowDocDropdown(false); }}
                activeOpacity={0.8}
              >
                <Text style={styles.filterDropdownText}>
                  {yearFilter === 'All Years' ? 'Year' : yearFilter}
                </Text>
                <Text style={styles.filterDropdownCaret}>▾</Text>
              </TouchableOpacity>
              {showYearDropdown && (
                <View style={styles.filterDropdownPanel}>
                  {YEAR_FILTERS.map(opt => (
                    <TouchableOpacity
                      key={opt}
                      style={[styles.filterDropdownItem, yearFilter === opt && styles.filterDropdownItemActive]}
                      onPress={() => { setYearFilter(opt); setShowYearDropdown(false); }}
                    >
                      <Text style={[styles.filterDropdownItemText, yearFilter === opt && { color: COLORS.navy, fontWeight: '700' }]}>
                        {opt}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>

            {/* Search */}
            <View style={styles.searchBox}>
              <Text style={{ fontSize: 12, color: COLORS.midGray, marginRight: 4 }}>🔍</Text>
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

            <View style={{ flex: 1 }} />

            {/* Upload button */}
            <TouchableOpacity
              style={styles.uploadBtn}
              onPress={() => Alert.alert('Upload', 'Upload document to portal')}
              activeOpacity={0.8}
            >
              <UploadIcon />
              <Text style={styles.uploadBtnText}>Upload</Text>
            </TouchableOpacity>
          </View>

          {/* Posted in Public Portal label */}
          <Text style={styles.postedLabel}>Posted in Public Portal</Text>

          {/* Full Disclosure Policy Board section */}
          <View style={styles.disclosureCard}>
            <View style={styles.disclosureHeader}>
              <Text style={styles.disclosureHeaderText}>Full Disclosure Policy Board</Text>
            </View>

            {filteredDocs.length > 0 ? (
              filteredDocs.map((doc, idx) => (
                <React.Fragment key={doc.id}>
                  <DocumentCard item={doc} onPress={handleDocPress} />
                  {idx < filteredDocs.length - 1 && <View style={styles.cardDivider} />}
                </React.Fragment>
              ))
            ) : (
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>No documents found</Text>
              </View>
            )}
          </View>
        </>
      )}

      {/* ── FEEDBACK TAB ── */}
      {activePortalTab === 'Feedback' && (
        <>
          {/* Header row */}
          <View style={styles.feedbackHeaderRow}>
            <Text style={styles.feedbackCount}>{FEEDBACK_ITEMS.length} feedback received</Text>
            <View style={styles.searchBox}>
              <Text style={{ fontSize: 12, color: COLORS.midGray, marginRight: 4 }}>🔍</Text>
              <TextInput
                style={styles.searchInput}
                placeholder="Search feedback"
                placeholderTextColor={COLORS.midGray}
              />
            </View>
          </View>

          {/* Feedback list */}
          <View style={styles.feedbackCard}>
            {FEEDBACK_ITEMS.map((item, idx) => (
              <React.Fragment key={item.id}>
                <FeedbackRow item={item} idx={idx} />
                {idx < FEEDBACK_ITEMS.length - 1 && <View style={styles.cardDivider} />}
              </React.Fragment>
            ))}
          </View>

          {/* Empty filler box matches screenshot height */}
          <View style={{ height: 24 }} />
        </>
      )}
    </ScrollView>
  );

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.navy} />

      {renderDocModal()}

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

  // ── Sidebar (identical to sk-planning) ──
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
  logoImage: { width: 100, height: 100 },
  navItem: {
    width: '100%', paddingVertical: 12, paddingHorizontal: 12,
    borderRadius: 24, marginBottom: 8, alignItems: 'center',
    borderWidth: 1.5, borderColor: COLORS.white,
    backgroundColor: COLORS.navy,
    flexDirection: 'row', justifyContent: 'center', gap: 6,
  },
  navItemActive: { backgroundColor: COLORS.white, borderColor: COLORS.white },
  navLabel:      { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.85)', letterSpacing: 0.3 },
  navLabelActive:{ color: '#000', fontWeight: '800' },
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
  menuLine:    { width: 20, height: 2, backgroundColor: COLORS.navy, borderRadius: 1 },
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
  headerDocLabel: { fontSize: 14, fontWeight: '700', color: COLORS.darkText, marginTop: 4 },
  headerRight:    { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },

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

  // ── Portal Tab Bar — identical structure to PLANNING_TABS ──
  portalTabBar: {
    flexDirection: 'row',
    marginBottom: 14,
    borderRadius: 4,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.30,
    shadowRadius: 3,
    elevation: 6,
  },
  portalTab: {
    flex: 1,
    paddingHorizontal: isMobile ? 8 : 40,
    paddingVertical: 10,
    backgroundColor: COLORS.navy,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
  },
  portalTabActive: {
    backgroundColor: COLORS.gold,
    borderRadius: 4,
    borderColor: COLORS.gold,
    shadowColor: COLORS.gold,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
    elevation: 3,
  },
  portalTabText: {
    fontSize: isMobile ? 10 : 13,
    fontWeight: '600',
    color: COLORS.white,
  },
  portalTabTextActive: {
    color: COLORS.darkText,
    fontWeight: '800',
  },

  // ── Filter bar row ──
  filterBarRow: {
    flexDirection: 'row', alignItems: 'center',
    gap: 8, marginBottom: 12, flexWrap: isMobile ? 'wrap' : 'nowrap',
    zIndex: 100,
  },
  filterDropdownBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: COLORS.white,
    borderWidth: 1, borderColor: COLORS.lightGray,
    borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8,
    minWidth: 90,
  },
  filterDropdownText: { fontSize: 13, color: COLORS.darkText, flex: 1 },
  filterDropdownCaret:{ fontSize: 10, color: COLORS.subText },
  filterDropdownPanel: {
    position: 'absolute', top: 40, left: 0, zIndex: 999,
    backgroundColor: COLORS.white,
    borderRadius: 10, borderWidth: 1, borderColor: COLORS.lightGray,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12, shadowRadius: 8, elevation: 20,
    minWidth: 200,
  },
  filterDropdownItem: { paddingHorizontal: 14, paddingVertical: 10 },
  filterDropdownItemActive: { backgroundColor: COLORS.offWhite },
  filterDropdownItemText: { fontSize: 13, color: COLORS.darkText },

  searchBox: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.white, borderRadius: 20,
    borderWidth: 1, borderColor: COLORS.lightGray,
    paddingHorizontal: 12, paddingVertical: 7,
    minWidth: 120, maxWidth: isMobile ? 160 : 200,
  },
  searchInput: { flex: 1, fontSize: 12, color: COLORS.darkText },

  uploadBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 8,
    backgroundColor: COLORS.white,
    borderWidth: 1, borderColor: COLORS.lightGray,
    borderRadius: 8,
  },
  uploadBtnText: { fontSize: 13, fontWeight: '600', color: COLORS.navy },

  // Posted label
  postedLabel: {
    fontSize: 13, fontWeight: '700', color: COLORS.navy,
    marginBottom: 10,
  },

  // Full Disclosure Card
  disclosureCard: {
    backgroundColor: COLORS.white,
    borderRadius: 10,
    borderWidth: 1, borderColor: COLORS.lightGray,
    overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 4, elevation: 1,
    marginBottom: 16,
  },
  disclosureHeader: {
    paddingHorizontal: 18, paddingVertical: 13,
    alignItems: 'center',
    borderBottomWidth: 1, borderBottomColor: COLORS.lightGray,
    backgroundColor: COLORS.white,
  },
  disclosureHeaderText: {
    fontSize: 14, fontWeight: '800', color: COLORS.navy, textAlign: 'center',
  },
  docCard: {
    paddingHorizontal: 18, paddingVertical: 16,
  },
  docCardTitle: {
    fontSize: 13, color: COLORS.darkText, fontWeight: '400', lineHeight: 19,
  },
  cardDivider: {
    height: 1, backgroundColor: COLORS.lightGray, marginHorizontal: 18,
  },

  // Empty state
  emptyState: { alignItems: 'center', paddingVertical: 40 },
  emptyText:  { fontSize: 14, color: COLORS.midGray },

  // ── Feedback Tab ──
  feedbackHeaderRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: 12,
  },
  feedbackCount: { fontSize: 13, fontWeight: '700', color: COLORS.darkText },
  feedbackCard: {
    backgroundColor: COLORS.white,
    borderRadius: 10,
    borderWidth: 1, borderColor: COLORS.lightGray,
    overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 4, elevation: 1,
  },
  feedbackRow: {
    paddingHorizontal: 16, paddingVertical: 14,
    backgroundColor: COLORS.white,
  },
  feedbackLeft: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
  },
  feedbackAvatar: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: COLORS.navy, alignItems: 'center', justifyContent: 'center',
  },
  feedbackAvatarText: { fontSize: 14, fontWeight: '800', color: COLORS.white },
  feedbackNameRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 3,
  },
  feedbackName: { fontSize: 13, fontWeight: '700', color: COLORS.darkText },
  feedbackNewBadge: {
    backgroundColor: COLORS.gold, borderRadius: 6,
    paddingHorizontal: 7, paddingVertical: 2,
  },
  feedbackNewBadgeText: { fontSize: 10, fontWeight: '800', color: COLORS.navy },
  feedbackComment: { fontSize: 12, color: COLORS.subText, lineHeight: 17, marginBottom: 4 },
  feedbackDate:    { fontSize: 11, color: COLORS.midGray },

  // ── Doc Detail Modal ──
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center', alignItems: 'center', padding: 24,
  },
  modalCard: {
    backgroundColor: COLORS.white, borderRadius: 16,
    padding: 24, width: '100%', maxWidth: 380,
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18, shadowRadius: 20, elevation: 12,
  },
  modalTitle:    { fontSize: 16, fontWeight: '800', color: COLORS.darkText, marginBottom: 6 },
  modalSubtitle: { fontSize: 13, color: COLORS.subText, lineHeight: 18, marginBottom: 14 },
  modalDivider:  { height: 1, backgroundColor: COLORS.lightGray, marginBottom: 12 },
  modalMeta: {
    flexDirection: 'row', justifyContent: 'space-between',
    marginBottom: 8,
  },
  modalMetaLabel: { fontSize: 12, color: COLORS.subText, fontWeight: '600' },
  modalMetaValue: { fontSize: 12, color: COLORS.darkText, fontWeight: '700' },
  modalActions:  { flexDirection: 'row', gap: 8, marginBottom: 16 },
  modalActionBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
  modalActionText:{ fontSize: 12, fontWeight: '700' },
  modalCloseBtn: {
    paddingVertical: 10, borderRadius: 10,
    backgroundColor: COLORS.lightGray, alignItems: 'center',
  },
  modalCloseBtnText: { fontSize: 13, fontWeight: '600', color: COLORS.darkText },
});