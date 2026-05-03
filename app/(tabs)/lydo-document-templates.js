import React, { useState, useEffect, useRef } from 'react';
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
  Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useNav } from './navContext';
import { useAuth } from './authContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const isMobile = SCREEN_WIDTH < 768;

// ─── COLORS (identical to lydo-document) ──────────────────────────────────────
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

// ─── NAV TABS ─────────────────────────────────────────────────────────────────
const NAV_TABS = ['Home', 'Documents', 'Monitor'];
const DOCUMENT_TABS = ['Barangay Folders', 'Reports', 'Templates'];

// ─── TEMPLATE STATUS ──────────────────────────────────────────────────────────
const STATUS_COLORS = {
  Active:      { text: '#2E7D32', bg: '#E8F5E9' },
  Draft:       { text: '#1565C0', bg: '#E3F2FD' },
  'Old Version': { text: '#B71C1C', bg: '#FFEBEE' },
  Archived:    { text: '#6D4C41', bg: '#EFEBE9' },
};

// ─── TEMPLATE DATA ────────────────────────────────────────────────────────────
const TEMPLATES = [
  { id: '1', name: 'Comprehensive Barangay Youth Development Plan', status: 'Active', category: 'Planning' },
  { id: '2', name: 'Annual Barangay Youth Investment Program (ABYIP) 2026', status: 'Draft', category: 'Planning' },
  { id: '3', name: 'Annual Budget 2026', status: 'Old Version', category: 'Financial' },
  { id: '4', name: 'Quarterly Register of Cash in Bank', status: 'Active', category: 'Financial' },
  { id: '5', name: 'Monthly Itemized List', status: 'Active', category: 'Financial' },
  { id: '6', name: 'Accomplishment Report', status: 'Active', category: 'Performance' },
];

const FILTER_OPTIONS = ['All', 'Currently in use',];
const CATEGORY_FILTERS = ['All Categories', 'Planning', 'Financial', 'Performance'];

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

const DocumentIcon = ({ color = '#133E75' }) => (
  <View style={{ width: 16, height: 20, position: 'relative' }}>
    <View style={{
      width: 16, height: 20,
      backgroundColor: color,
      borderRadius: 2,
      opacity: 0.15,
      position: 'absolute',
    }} />
    <View style={{
      position: 'absolute', top: 3, left: 2,
      width: 12, height: 2, backgroundColor: color, borderRadius: 1, opacity: 0.7,
    }} />
    <View style={{
      position: 'absolute', top: 7, left: 2,
      width: 9, height: 2, backgroundColor: color, borderRadius: 1, opacity: 0.7,
    }} />
    <View style={{
      position: 'absolute', top: 11, left: 2,
      width: 10, height: 2, backgroundColor: color, borderRadius: 1, opacity: 0.7,
    }} />
    <View style={{
      position: 'absolute', top: 15, left: 2,
      width: 7, height: 2, backgroundColor: color, borderRadius: 1, opacity: 0.7,
    }} />
  </View>
);

// ─── STATUS BADGE ─────────────────────────────────────────────────────────────
const StatusBadge = ({ status }) => {
  const colors = STATUS_COLORS[status] || { text: COLORS.subText, bg: COLORS.lightGray };
  return (
    <View style={[styles.statusBadge, { backgroundColor: colors.bg }]}>
      <Text style={[styles.statusText, { color: colors.text }]}>{status}</Text>
    </View>
  );
};

// ─── TEMPLATE ROW ─────────────────────────────────────────────────────────────
const TemplateRow = ({ item, onPress }) => (
  <TouchableOpacity
    style={styles.templateRow}
    onPress={() => onPress && onPress(item)}
    activeOpacity={0.7}
  >
    <View style={styles.templateRowLeft}>
      <DocumentIcon color={COLORS.navy} />
      <Text style={styles.templateName} numberOfLines={2}>{item.name}</Text>
    </View>
    <StatusBadge status={item.status} />
  </TouchableOpacity>
);

// ─── MAIN SCREEN ──────────────────────────────────────────────────────────────
export default function LYDODocumentTemplatesScreen() {
  const router = useRouter();
  const { activeTab, setActiveTab } = useNav();
  const { logout } = useAuth();

  const [searchText, setSearchText]             = useState('');
  const [activeFilter, setActiveFilter]         = useState('All');
  const [categoryFilter, setCategoryFilter]     = useState('All Categories');
  const [notifCount]                            = useState(2);
  const [sidebarVisible, setSidebarVisible]     = useState(false);
  const [activeDocumentTab, setActiveDocumentTab] = useState('Templates');
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [dropdownPos, setDropdownPos]                   = useState({ top: 0, left: 0 });
  const dropdownBtnRef                                  = useRef(null);
  const [showAddModal, setShowAddModal]         = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState(null);

  useEffect(() => { setActiveTab('Documents'); }, []);

  // ── Filtered templates ──
  const filteredTemplates = TEMPLATES.filter(t => {
    const matchesSearch = t.name.toLowerCase().includes(searchText.toLowerCase());
    const matchesFilter =
      activeFilter === 'All' ||
      (activeFilter === 'Currently in use' && t.status === 'Active') ||
      (activeFilter === 'Template' && t.status !== 'Old Version');
    const matchesCategory =
      categoryFilter === 'All Categories' || t.category === categoryFilter;
    return matchesSearch && matchesFilter && matchesCategory;
  });

  // ── Navigation helpers ──
  const handleNavPress = (tab) => {
    setActiveTab(tab);
    setSidebarVisible(false);
    if (tab === 'Home') router.push('/(tabs)/lydo-home');
    else if (tab === 'Documents') router.push('/(tabs)/lydo-document');
    else if (tab === 'Monitor') router.push('/(tabs)/lydo-monitor');
  };

  const handleLogout = () => {
    logout();
    router.replace('/');
  };

  const handleDocumentTabPress = (tab) => {
    if (tab === 'Barangay Folders') { router.push('/(tabs)/lydo-document'); return; }
    if (tab === 'Reports') { router.push('/(tabs)/lydo-document-reports'); return; }
    if (tab === 'Templates') { setActiveDocumentTab('Templates'); return; }
  };

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
      <View style={{ flex: 1 }} />
      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.8}>
        <Text style={styles.logoutText}>Logout</Text>
      </TouchableOpacity>
    </View>
  );

  // ── Category Dropdown Modal ──
  const renderCategoryDropdown = () => (
    <Modal
      visible={showCategoryDropdown}
      transparent
      animationType="none"
      onRequestClose={() => setShowCategoryDropdown(false)}
    >
      <TouchableOpacity
        style={StyleSheet.absoluteFillObject}
        activeOpacity={1}
        onPress={() => setShowCategoryDropdown(false)}
      />
      <View style={[styles.dropdown, { top: dropdownPos.top, left: dropdownPos.left }]}>
        {CATEGORY_FILTERS.map(cat => (
          <TouchableOpacity
            key={cat}
            style={[styles.dropdownItem, categoryFilter === cat && styles.dropdownItemActive]}
            onPress={() => { setCategoryFilter(cat); setShowCategoryDropdown(false); }}
          >
            <Text style={[styles.dropdownItemText, categoryFilter === cat && styles.dropdownItemTextActive]}>
              {cat}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </Modal>
  );

  // ── Add Template Modal ──
  const renderAddModal = () => (
    <Modal
      visible={showAddModal}
      transparent
      animationType="fade"
      onRequestClose={() => setShowAddModal(false)}
    >
      <TouchableOpacity
        style={styles.modalOverlay}
        activeOpacity={1}
        onPress={() => setShowAddModal(false)}
      >
        <View style={styles.modalCard} onStartShouldSetResponder={() => true}>
          <Text style={styles.modalTitle}>Add New Template</Text>
          <TextInput
            style={styles.modalInput}
            placeholder="Template name…"
            placeholderTextColor={COLORS.midGray}
          />
          <View style={styles.modalRow}>
            <TouchableOpacity
              style={[styles.modalBtn, { backgroundColor: COLORS.lightGray }]}
              onPress={() => setShowAddModal(false)}
            >
              <Text style={{ color: COLORS.darkText, fontWeight: '600' }}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalBtn, { backgroundColor: COLORS.navy }]}
              onPress={() => setShowAddModal(false)}
            >
              <Text style={{ color: COLORS.white, fontWeight: '700' }}>Add</Text>
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    </Modal>
  );

  // ── Detail Modal ──
  const renderDetailModal = () => (
    <Modal
      visible={!!selectedTemplate}
      transparent
      animationType="fade"
      onRequestClose={() => setSelectedTemplate(null)}
    >
      <TouchableOpacity
        style={styles.modalOverlay}
        activeOpacity={1}
        onPress={() => setSelectedTemplate(null)}
      >
        <View style={styles.modalCard} onStartShouldSetResponder={() => true}>
          <Text style={styles.modalTitle}>{selectedTemplate?.name}</Text>
          <View style={{ marginBottom: 12 }}>
            <StatusBadge status={selectedTemplate?.status} />
          </View>
          <Text style={styles.modalLabel}>Category: <Text style={styles.modalValue}>{selectedTemplate?.category}</Text></Text>

          <View style={styles.actionRow}>
            <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#EAF0FB' }]}>
              <Text style={[styles.actionBtnText, { color: '#5B8DD9' }]}>↔ Replace</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#E8F7EE' }]}>
              <Text style={[styles.actionBtnText, { color: '#3AAA5C' }]}>→ Forward</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#FDF0E6' }]}>
              <Text style={[styles.actionBtnText, { color: '#E87A30' }]}>⬇ Download</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[styles.modalBtn, { backgroundColor: COLORS.lightGray, alignSelf: 'flex-end', marginTop: 8 }]}
            onPress={() => setSelectedTemplate(null)}
          >
            <Text style={{ color: COLORS.darkText, fontWeight: '600' }}>Close</Text>
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
    >
      {/* Mobile Header */}
      {isMobile && (
        <View style={styles.mobileHeader}>
          <TouchableOpacity style={styles.menuBtn} onPress={() => setSidebarVisible(true)}>
            <MenuIcon />
          </TouchableOpacity>
          <Text style={styles.mobileTitle}>Templates</Text>
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
              <Text style={[styles.documentTabText, active && styles.documentTabTextActive]}>{tab}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* ── TEMPLATE CONTENT ── */}
      {/* Search + Filter Row + Action Buttons */}
      <View style={styles.searchFilterRow}>
        <View style={styles.searchBox}>
          <Text style={{ fontSize: 13, marginRight: 6 }}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Search templates…"
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

        {/* Status filter pills */}
        <View style={styles.filterPills}>
          {FILTER_OPTIONS.map(f => (
            <TouchableOpacity
              key={f}
              style={[styles.filterPill, activeFilter === f && styles.filterPillActive]}
              onPress={() => setActiveFilter(f)}
              activeOpacity={0.75}
            >
              <Text style={[styles.filterPillText, activeFilter === f && styles.filterPillTextActive]}>
                {f}
              </Text>
            </TouchableOpacity>
          ))}


          {/* Category Dropdown — uses Modal so it always renders above table */}
          <View style={{ position: 'relative', zIndex: 1000 }}>
            <TouchableOpacity
              ref={dropdownBtnRef}
              style={[styles.filterPill, styles.dropdownPill]}
              onPress={() => {
                dropdownBtnRef.current?.measure((fx, fy, w, h, px, py) => {
                  setDropdownPos({ top: py + h + 4, left: px });
                });
                setShowCategoryDropdown(v => !v);
              }}
              activeOpacity={0.75}
            >
              <Text style={styles.filterPillText}>
                {categoryFilter === 'All Categories' ? 'Template ▾' : `${categoryFilter} ▾`}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionButtonsContainer}>
          <TouchableOpacity style={styles.addBtn} onPress={() => setShowAddModal(true)} activeOpacity={0.8}>
            <Text style={styles.addBtnText}>+ Add</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.replaceBtn} activeOpacity={0.8}>
            <Text style={styles.replaceBtnText}>↔ Replace</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.forwardBtn} activeOpacity={0.8}>
            <Text style={styles.forwardBtnText}>→ Forward</Text>
          </TouchableOpacity>
          {!isMobile && (
            <TouchableOpacity style={styles.archiveBtn} activeOpacity={0.8}>
              <Text style={styles.archiveBtnText}>🗂 View Archive</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Template List */}
      <View style={styles.tableContainer}>
        {/* Table Header */}
        <View style={styles.tableHeader}>
          <Text style={[styles.tableHeaderText, { flex: 1 }]}>List of Templates</Text>
          <Text style={[styles.tableHeaderText, { width: 100, textAlign: 'right' }]}>Status</Text>
        </View>

        {/* Rows */}
        {filteredTemplates.length > 0 ? (
          filteredTemplates.map((item, idx) => (
            <React.Fragment key={item.id}>
              <TemplateRow item={item} onPress={setSelectedTemplate} />
              {idx < filteredTemplates.length - 1 && <View style={styles.divider} />}
            </React.Fragment>
          ))
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No templates found</Text>
          </View>
        )}
      </View>

      {/* Mobile Archive Link */}
      {isMobile && (
        <TouchableOpacity style={styles.mobileArchiveBtn} activeOpacity={0.75}>
          <Text style={styles.mobileArchiveBtnText}>🗂 View Archive</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.navy} />

      {renderCategoryDropdown()}
      {renderAddModal()}
      {renderDetailModal()}

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
    position: 'absolute',
    left: 0, top: 0, bottom: 0, right: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    zIndex: 5,
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
  navItemActive: { backgroundColor: '#ffffff', borderColor: '#000000' },
  navLabel: { fontSize: 13, fontWeight: '600', color: '#ffffff', letterSpacing: 0.3 },
  navLabelActive: { color: '#000000', fontWeight: '800' },
  logoutBtn: {
    width: '100%', paddingVertical: 12, paddingHorizontal: 12,
    borderRadius: 24, marginTop: 8, alignItems: 'center',
    borderWidth: 1.5, borderColor: COLORS.white,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  logoutText: { fontSize: 13, fontWeight: '600', color: '#ffffff', letterSpacing: 0.3 },

  // ── Main ──
  main: { flex: 1, backgroundColor: COLORS.offWhite, borderTopLeftRadius: 20 },
  mainMobile: { borderTopLeftRadius: 0 },
  mainContent: { padding: 20, paddingBottom: 40, overflow: 'visible' },

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

  // Document Tab Bar
  documentTabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightGray,
    marginBottom: 14,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.30,
    shadowRadius: 3,
    elevation: 6,
  },
  documentTab: {
    flex: 1,
    paddingHorizontal: isMobile ? 8 : 40,
    backgroundColor: COLORS.navy,
    paddingVertical: 10,
    borderBottomWidth: 0,
    borderBottomColor: 'transparent',
    marginBottom: -1,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
  },
  documentTabActive: {
    backgroundColor: COLORS.gold,
    borderRadius: 4,
    borderBottomColor: COLORS.gold,
    borderColor: COLORS.gold,
    shadowColor: COLORS.gold,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
    elevation: 3,
  },
  documentTabText: {
    fontSize: isMobile ? 10 : 13,
    fontWeight: '600',
    color: COLORS.white,
  },
  documentTabTextActive: {
    color: COLORS.darkText,
    fontWeight: '800',
  },

  // Search + Filter + Action Buttons
  searchFilterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 12,
    zIndex: 1000,
  },
  actionButtonsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginLeft: 'auto',
  },
  searchBox: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.white, borderRadius: 20,
    borderWidth: 1, borderColor: COLORS.lightGray,
    paddingHorizontal: 12, paddingVertical: 8,
    width: isMobile ? '100%' : 240,
  },
  searchInput: { flex: 1, fontSize: 13, color: COLORS.darkText },
  filterPills: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 6,
    alignItems: 'center', overflow: 'visible', zIndex: 1000,
  },
  filterPill: {
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 16, borderWidth: 1,
    borderColor: COLORS.lightGray, backgroundColor: COLORS.white,
  },
  filterPillActive: {
    backgroundColor: COLORS.navy, borderColor: COLORS.navy,
  },
  filterPillText: { fontSize: 12, fontWeight: '500', color: COLORS.darkText },
  filterPillTextActive: { color: COLORS.white, fontWeight: '700' },
  dropdownPill: { borderColor: COLORS.midGray },

  // Dropdown
  dropdown: {
    position: 'absolute',
    backgroundColor: COLORS.white, borderRadius: 10,
    borderWidth: 1, borderColor: COLORS.lightGray,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15, shadowRadius: 8, elevation: 20,
    zIndex: 9999, minWidth: 160,
  },
  dropdownItem: { paddingHorizontal: 14, paddingVertical: 10 },
  dropdownItemActive: { backgroundColor: COLORS.offWhite },
  dropdownItemText: { fontSize: 13, color: COLORS.darkText },
  dropdownItemTextActive: { fontWeight: '700', color: COLORS.navy },

  // Action Buttons
  addBtn: {
    paddingHorizontal: 14, paddingVertical: 7,
    backgroundColor: COLORS.navy, borderRadius: 8,
  },
  addBtnText: { color: COLORS.white, fontSize: 13, fontWeight: '700' },
  replaceBtn: {
    paddingHorizontal: 14, paddingVertical: 7,
    backgroundColor: COLORS.white, borderRadius: 8,
    borderWidth: 1, borderColor: COLORS.lightGray,
  },
  replaceBtnText: { color: COLORS.navy, fontSize: 13, fontWeight: '600' },
  forwardBtn: {
    paddingHorizontal: 14, paddingVertical: 7,
    backgroundColor: COLORS.white, borderRadius: 8,
    borderWidth: 1, borderColor: COLORS.lightGray,
  },
  forwardBtnText: { color: COLORS.navy, fontSize: 13, fontWeight: '600' },
  archiveBtn: {
    marginLeft: 'auto',
    paddingHorizontal: 14, paddingVertical: 7,
    backgroundColor: COLORS.white, borderRadius: 8,
    borderWidth: 1, borderColor: COLORS.lightGray,
  },
  archiveBtnText: { color: COLORS.subText, fontSize: 13, fontWeight: '600' },

  // Table
  tableContainer: {
    backgroundColor: COLORS.white,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.lightGray,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 1,
    zIndex: 1,
  },
  tableHeader: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 18, paddingVertical: 13,
    backgroundColor: COLORS.offWhite,
    borderBottomWidth: 1, borderBottomColor: COLORS.lightGray,
  },
  tableHeaderText: {
    fontSize: 13, fontWeight: '800', color: COLORS.darkText,
    letterSpacing: 0.2,
  },
  templateRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 18, paddingVertical: 16,
    gap: 12,
  },
  templateRowLeft: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12,
  },
  templateName: {
    flex: 1, fontSize: 13, color: COLORS.darkText,
    fontWeight: '500', lineHeight: 18,
  },
  divider: { height: 1, backgroundColor: COLORS.lightGray, marginHorizontal: 18 },

  // Status Badge
  statusBadge: {
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 12, width: 100, alignItems: 'center',
  },
  statusText: { fontSize: 12, fontWeight: '700' },

  // Empty state
  emptyState: { padding: 40, alignItems: 'center' },
  emptyText: { fontSize: 14, color: COLORS.midGray },

  // Mobile Archive button
  mobileArchiveBtn: {
    marginTop: 16, alignSelf: 'center',
    paddingHorizontal: 18, paddingVertical: 9,
    backgroundColor: COLORS.white, borderRadius: 10,
    borderWidth: 1, borderColor: COLORS.lightGray,
  },
  mobileArchiveBtnText: { color: COLORS.subText, fontSize: 13, fontWeight: '600' },

  // Modal
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center', alignItems: 'center', padding: 24,
  },
  modalCard: {
    backgroundColor: COLORS.white, borderRadius: 18,
    padding: 24, width: '100%', maxWidth: 420,
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18, shadowRadius: 20, elevation: 10,
  },
  modalTitle: {
    fontSize: 16, fontWeight: '800', color: COLORS.darkText,
    marginBottom: 16, lineHeight: 22,
  },
  modalInput: {
    borderWidth: 1, borderColor: COLORS.lightGray, borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 10,
    fontSize: 14, color: COLORS.darkText, marginBottom: 16,
    backgroundColor: COLORS.offWhite,
  },
  modalRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10 },
  modalBtn: {
    paddingHorizontal: 20, paddingVertical: 10,
    borderRadius: 10, alignItems: 'center',
  },
  modalLabel: { fontSize: 13, color: COLORS.subText, marginBottom: 16 },
  modalValue: { fontWeight: '700', color: COLORS.darkText },
  actionRow: { flexDirection: 'row', gap: 8, marginBottom: 8, flexWrap: 'wrap' },
  actionBtn: {
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 10, flex: 1, alignItems: 'center',
  },
  actionBtnText: { fontSize: 13, fontWeight: '700' },
});