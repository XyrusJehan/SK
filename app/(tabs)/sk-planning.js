import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, ScrollView, TouchableOpacity,
  StyleSheet, SafeAreaView, StatusBar, Dimensions,
  Modal, Alert, Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useNav } from './navContext';
import { useAuth } from './authContext';
import { supabase } from '../../utils/supabase';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const isMobile = SCREEN_WIDTH < 768;

// ─── COLORS (same as lydo-monitor) ───────────────────────────────────────────
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

// ─── NAV & PLANNING TABS ─────────────────────────────────────────────────────
const NAV_TABS      = ['Dashboard', 'Documents', 'Planning', 'Portal'];
const PLANNING_TABS = ['Templates', 'Budget'];

// ─── TEMPLATE CATEGORIES (from screenshot) ───────────────────────────────────
const TEMPLATE_SECTIONS = [
  {
    id: 'planning',
    title: 'Planning Templates',
    color: '#EAF0FB',
    borderColor: '#B8CAE8',
    items: [
      { id: 'p1', name: 'Comprehensive Barangay Youth Development Plan' },
      { id: 'p2', name: 'SK PPA Template' },
      { id: 'p3', name: 'Annual Barangay Youth Investment Program' },
      { id: 'p4', name: 'Program of Work' },
    ],
  },
  {
    id: 'budgeting',
    title: 'Budgeting Templates',
    color: '#EAFBEA',
    borderColor: '#B8E4B8',
    items: [
      { id: 'b1', name: 'Approved Annual Budget' },
      { id: 'b2', name: 'SK Supplemental Budget' },
    ],
  },
  {
    id: 'financial',
    title: 'Financial Records and Evaluation Templates',
    color: '#FDF5E6',
    borderColor: '#E8D5A8',
    items: [
      { id: 'f1', name: 'Registry of Cash Receipts and Deposits' },
      { id: 'f2', name: 'Registry of Cash Disbursements' },
      { id: 'f3', name: 'Monthly Itemized List' },
      { id: 'f4', name: 'Quarterly Financial Reports' },
    ],
  },
  {
    id: 'monitoring',
    title: 'Monitoring and Evaluation',
    color: '#F3EAFB',
    borderColor: '#C8B0E4',
    items: [
      { id: 'm1', name: 'Barangay Youth Investment Monitoring Form' },
      { id: 'm2', name: 'Monthly/Quarterly Accomplishment Report' },
    ],
  },
];

// ─── ALL TEMPLATES — (now fetched from Supabase based on barangay_id) ─────
// (Data fetched via useEffect)

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

// Edit icon (pencil box) — matches screenshot
const EditIcon = () => (
  <View style={styles.editIconBox}>
    <Text style={styles.editIconText}>✎</Text>
  </View>
);

// ─── TEMPLATE ITEM ────────────────────────────────────────────────────────────
const TemplateItem = ({ item, onEdit }) => (
  <TouchableOpacity style={styles.templateItem} onPress={() => onEdit(item)} activeOpacity={0.75}>
    <Text style={styles.templateItemName} numberOfLines={2}>{item.name}</Text>
    <EditIcon />
  </TouchableOpacity>
);

// ─── TEMPLATE SECTION ─────────────────────────────────────────────────────────
const TemplateSection = ({ section, onEdit }) => {
  // Pair items into rows of 2
  const pairs = [];
  for (let i = 0; i < section.items.length; i += 2) {
    pairs.push(section.items.slice(i, i + 2));
  }

  return (
    <View style={styles.section}>
      {/* Section Header */}
      <View style={[styles.sectionHeader, { backgroundColor: section.color, borderLeftColor: section.borderColor }]}>
        <Text style={styles.sectionHeaderText}>{section.title}</Text>
      </View>

      {/* Items grid — 2 per row */}
      <View style={styles.sectionBody}>
        {pairs.map((pair, pIdx) => (
          <View key={pIdx} style={styles.itemRow}>
            {pair.map(item => (
              <View key={item.id} style={styles.itemCol}>
                <TemplateItem item={item} onEdit={onEdit} />
              </View>
            ))}
            {/* If odd item in last row, fill empty col */}
            {pair.length === 1 && <View style={styles.itemCol} />}
          </View>
        ))}
      </View>
    </View>
  );
};



// ─── MAIN SCREEN ──────────────────────────────────────────────────────────────
export default function SKPlanningScreen() {
  const router = useRouter();
  const { activeTab, setActiveTab } = useNav();
  const { logout, user } = useAuth();

  // Get user's barangay from auth context
  const barangayName = user?.barangay?.barangay_name || 'Unknown Barangay';
  const barangayId = user?.barangayId;

  const [activePlanningTab, setActivePlanningTab] = useState('Templates');
  const [searchText, setSearchText]               = useState('');
  const [showAll, setShowAll]                     = useState(true); // false = Active Templates filter
  const [notifCount]                              = useState(2);
  const [sidebarVisible, setSidebarVisible]       = useState(false);
  const [selectedItem, setSelectedItem]           = useState(null);
  const [showEditModal, setShowEditModal]         = useState(false);
  const [templates, setTemplates]                = useState([]);
  const [budgetData, setBudgetData]               = useState(null);

  // Fetch templates distributed to this barangay
  useEffect(() => {
    const fetchTemplates = async () => {
      if (!barangayId) return;

      try {
        // Get templates distributed to this barangay
        const { data: distributions, error } = await supabase
          .from('template_distributions')
          .select(`
            distributed_at,
            is_acknowledged,
            template_id,
            templates (
              template_id,
              title,
              description,
              template_category,
              document_type,
              status,
              created_at
            )
          `)
          .eq('barangay_id', barangayId);

        if (error) {
          console.error('Error fetching templates:', error);
          return;
        }

        const formattedTemplates = distributions?.map(d => ({
          id: d.templates?.template_id,
          name: d.templates?.title || 'Untitled Template',
          type: d.templates?.template_category || 'Unknown',
          source: 'LYDO',
          dateReceived: new Date(d.templates?.created_at || d.distributed_at).toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' }),
        })) || [];

        setTemplates(formattedTemplates);
      } catch (error) {
        console.error('Error:', error);
      }
    };

    fetchTemplates();
  }, [barangayId]);

  // Fetch budget allocation for this barangay
  useEffect(() => {
    const fetchBudget = async () => {
      if (!barangayId) return;

      try {
        const { data: budget, error } = await supabase
          .from('budget_allocations')
          .select('*')
          .eq('barangay_id', barangayId)
          .order('fiscal_year', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (error) {
          console.error('Error fetching budget:', error);
          return;
        }

        setBudgetData(budget);
      } catch (error) {
        console.error('Error:', error);
      }
    };

    fetchBudget();
  }, [barangayId]);

  const handleNavPress = (tab) => {
    setActiveTab(tab);
    setSidebarVisible(false);
    if (tab === 'Dashboard') router.push('/(tabs)/sk-dashboard');
    if (tab === 'Documents') router.push('/(tabs)/sk-document');
    if (tab === 'Portal')    router.push('/(tabs)/sk-portal');
  };

  const handleLogout = () => { logout(); router.replace('/'); };

  
  const handleMoTabPress = (tab) => {
    if (tab === 'Templates') { router.push('/(tabs)/sk-planning'); return; }
    if (tab === 'Budget')       { router.push('/(tabs)/sk-planning-budget'); return; }
    setActiveMonitorTab(tab);
  };

  const handleEdit = (item) => { setSelectedItem(item); setShowEditModal(true); };

  // Filter sections/items by search
  const filteredSections = TEMPLATE_SECTIONS.map(sec => ({
    ...sec,
    items: sec.items.filter(it =>
      it.name.toLowerCase().includes(searchText.toLowerCase())
    ),
  })).filter(sec => sec.items.length > 0);

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
        const active = activeTab === tab;
        return (
          <TouchableOpacity
            key={tab}
            style={[styles.navItem, active && styles.navItemActive]}
            onPress={() => handleNavPress(tab)}
            activeOpacity={0.8}
          >
            <Text style={[styles.navLabel, active && styles.navLabelActive]}>{tab}</Text>
            {/* Notification badge for Planning */}
            {tab === 'Planning' && notifCount > 0 && (
              <View>
                
              </View>
            )}
          </TouchableOpacity>
        );
      })}
      <View style={{ flex: 1 }} />
      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.8}>
        <Text style={styles.logoutText}>Logout</Text>
      </TouchableOpacity>
    </View>
  );

  // ── Edit Modal ──
  const renderEditModal = () => (
    <Modal
      visible={showEditModal}
      transparent
      animationType="fade"
      onRequestClose={() => setShowEditModal(false)}
    >
      <TouchableOpacity
        style={styles.modalOverlay}
        activeOpacity={1}
        onPress={() => setShowEditModal(false)}
      >
        <View style={styles.modalCard} onStartShouldSetResponder={() => true}>
          <Text style={styles.modalTitle}>Edit Template</Text>
          <Text style={styles.modalSubtitle}>{selectedItem?.name}</Text>
          <View style={styles.modalDivider} />
          <View style={styles.modalActions}>
            <TouchableOpacity
              style={[styles.modalActionBtn, { backgroundColor: '#EAF0FB' }]}
              onPress={() => { Alert.alert('View', 'Opening template…'); setShowEditModal(false); }}
            >
              <Text style={[styles.modalActionText, { color: COLORS.navy }]}>👁  View</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalActionBtn, { backgroundColor: '#EAFBEA' }]}
              onPress={() => { Alert.alert('Download', 'Downloading…'); setShowEditModal(false); }}
            >
              <Text style={[styles.modalActionText, { color: '#2E7D32' }]}>⬇  Download</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalActionBtn, { backgroundColor: '#FDF5E6' }]}
              onPress={() => { Alert.alert('Replace', 'Replace coming soon.'); setShowEditModal(false); }}
            >
              <Text style={[styles.modalActionText, { color: '#B45309' }]}>↔  Create</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            style={styles.modalCloseBtn}
            onPress={() => setShowEditModal(false)}
          >
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
    >
      {/* Mobile Header */}
      {isMobile && (
        <View style={styles.mobileHeader}>
          <TouchableOpacity style={styles.menuBtn} onPress={() => setSidebarVisible(true)}>
            <MenuIcon />
          </TouchableOpacity>
          <Text style={styles.mobileTitle}>Planning</Text>
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
            <Text style={styles.headerDocLabel}>Template and Budget Reference Documents</Text>
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

      {/* ── PLANNING TAB BAR (styled exactly like MONITOR_TABS) ── */}
      <View style={styles.planningTabBar}>
        {PLANNING_TABS.map(tab => {
          const active = activePlanningTab === tab;
          return (
            <TouchableOpacity
              key={tab}
              style={[styles.planningTab, active && styles.planningTabActive]}
              onPress={() => tab === 'Templates' ? router.push('/(tabs)/sk-planning') : tab === 'Budget' ? router.push('/(tabs)/sk-planning-budget') : setActivePlanningTab(tab)} activeOpacity={0.8}>
             
            
              <Text style={[styles.planningTabText, active && styles.planningTabTextActive]}>
                {tab}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* ── TEMPLATES TAB ── */}
      {activePlanningTab === 'Templates' && (
        <>
          {/* Search row */}
          <View style={styles.searchRow}>
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
            {/* Archive icon — top right */}
            <View style={{ flex: 1 }} />

          </View>

          {/* All / Active Templates filter pills */}
          <View style={styles.filterRow}>
            <TouchableOpacity
              style={showAll ? styles.filterLinkActive : styles.filterLink}
              onPress={() => setShowAll(true)}
              activeOpacity={0.8}
            >
              <Text style={[styles.filterLinkText, showAll && styles.filterLinkTextActive]}>All</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={!showAll ? styles.filterLinkActive : styles.filterLink}
              onPress={() => setShowAll(false)}
              activeOpacity={0.8}
            >
              <Text style={[styles.filterLinkText, !showAll && styles.filterLinkTextActive]}>
                Active Templates
              </Text>
            </TouchableOpacity>
          </View>

          {/* ── ALL view: flat table ── */}
          {showAll && (
            <View style={styles.tableContainer}>
              {/* Table Header */}
              <View style={styles.tableHeader}>
                <Text style={[styles.thText, styles.colName]}>Template Name</Text>
                <Text style={[styles.thText, styles.colType]}>Type</Text>
                <Text style={[styles.thText, styles.colSource]}>Source</Text>
                <Text style={[styles.thText, styles.colDate]}>Date Received</Text>
              </View>
              {/* Table Rows */}
              {templates
                .filter(t => t.name.toLowerCase().includes(searchText.toLowerCase()))
                .map((t, idx) => (
                  <TouchableOpacity
                    key={t.id}
                    style={[styles.tableRow, idx % 2 !== 0 && styles.tableRowEven]}
                    onPress={() => handleEdit(t)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.tdName, styles.colName]} numberOfLines={2}>{t.name}</Text>
                    <Text style={[styles.tdType, styles.colType]}>{t.type}</Text>
                    <Text style={[styles.tdCell, styles.colSource]}>{t.source}</Text>
                    <Text style={[styles.tdCell, styles.colDate]}>{t.dateReceived}</Text>
                  </TouchableOpacity>
                ))}
              {/* Empty filler rows */}
              {Array(Math.max(0, 4 - templates.filter(t =>
                t.name.toLowerCase().includes(searchText.toLowerCase())).length
              )).fill(null).map((_, i) => (
                <View key={`empty-${i}`} style={[styles.tableRow, styles.tableRowEmpty]} />
              ))}
            </View>
          )}

          {/* ── ACTIVE TEMPLATES view: category grid ── */}
          {!showAll && (
            filteredSections.length > 0 ? (
              filteredSections.map(sec => (
                <TemplateSection key={sec.id} section={sec} onEdit={handleEdit} />
              ))
            ) : (
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>No templates found.</Text>
              </View>
            )
          )}
        </>
      )}

      {/* ── BUDGET TAB ── */}
      {activePlanningTab === 'Budget' && (
        <View style={styles.budgetPlaceholder}>
          <Text style={styles.budgetPlaceholderText}>Budget content coming soon.</Text>
        </View>
      )}
    </ScrollView>
  );

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.navy} />

      {renderEditModal()}

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
  logoImage: { width: 100, height: 100 },
  navItem: {
    width: '100%', paddingVertical: 12, paddingHorizontal: 12,
    borderRadius: 24, marginBottom: 8, alignItems: 'center',
    borderWidth: 1.5, borderColor: COLORS.white,
    backgroundColor: COLORS.navy,
    flexDirection: 'row', justifyContent: 'center', gap: 6,
  },
  navItemActive: { backgroundColor: COLORS.white, borderColor: COLORS.white },
  navLabel: { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.85)', letterSpacing: 0.3 },
  navLabelActive: { color: '#000', fontWeight: '800' },
  navBadge: {
    width: 18, height: 18, borderRadius: 9,
    backgroundColor: COLORS.gold, alignItems: 'center', justifyContent: 'center',
  },
  navBadgeText: { fontSize: 9, fontWeight: '900', color: COLORS.navy },
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
  headerTitle: {
    fontSize: 22, fontWeight: '900', color: COLORS.darkText, letterSpacing: 0.3,
    borderBottomWidth: 2, borderBottomColor: COLORS.lightGray, paddingBottom: 4, marginBottom: 6,
  },
  headerDocLabel: { fontSize: 14, fontWeight: '700', color: COLORS.darkText, marginTop: 4 },
  headerRight: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },


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

  // ── Planning Tab Bar — same style as MONITOR_TABS ──
  planningTabBar: {
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
  planningTab: {
    flex: 1,
    paddingHorizontal: isMobile ? 8 : 40,
    paddingVertical: 10,
    backgroundColor: COLORS.navy,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
  },
  planningTabActive: {
    backgroundColor: COLORS.gold,
    borderRadius: 4,
    borderColor: COLORS.gold,
    shadowColor: COLORS.gold,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
    elevation: 3,
  },
  planningTabText: {
    fontSize: isMobile ? 10 : 13,
    fontWeight: '600',
    color: COLORS.white,
  },
  planningTabTextActive: {
    color: COLORS.darkText,
    fontWeight: '800',
  },

  // Search row (with archive icon)
  searchRow: {
    flexDirection: 'row', alignItems: 'center',
    gap: 8, marginBottom: 8,
  },
  archiveIconBtn: {
    width: 34, height: 34, borderRadius: 8,
    backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.lightGray,
    alignItems: 'center', justifyContent: 'center',
  },
  archiveIconText: { fontSize: 16 },

  // Filter links (All / Active Templates) — plain text style like screenshot
  filterRow: {
    flexDirection: 'row', alignItems: 'center',
    gap: 16, marginBottom: 14,
  },
  filterLink: { paddingVertical: 2 },
  filterLinkActive: { paddingVertical: 2, borderBottomWidth: 2, borderBottomColor: COLORS.navy },
  filterLinkText: { fontSize: 13, fontWeight: '500', color: COLORS.subText },
  filterLinkTextActive: { color: COLORS.navy, fontWeight: '800' },

  // ── All-view flat table ──
  tableContainer: {
    backgroundColor: COLORS.white,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.lightGray,
    overflow: 'hidden',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    marginBottom: 14,
  },
  tableHeader: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.offWhite,
    paddingVertical: 10, paddingHorizontal: 14,
    borderBottomWidth: 1, borderBottomColor: COLORS.lightGray,
  },
  thText: { fontSize: 12, fontWeight: '800', color: COLORS.darkText },
  tableRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 12, paddingHorizontal: 14,
    borderBottomWidth: 1, borderBottomColor: COLORS.lightGray,
    backgroundColor: COLORS.white, minHeight: 46,
  },
  tableRowEven: { backgroundColor: '#FAFAFA' },
  tableRowEmpty: { minHeight: 46 },

  // Column widths
  colName:   { flex: 2.4, paddingRight: 8 },
  colType:   { flex: 1,   paddingRight: 8 },
  colSource: { flex: 0.7, paddingRight: 8 },
  colDate:   { flex: 1.2 },

  tdName: { fontSize: isMobile ? 10 : 12, color: COLORS.darkText, lineHeight: 17 },
  tdType: { fontSize: isMobile ? 10 : 12, color: COLORS.subText, fontStyle: 'italic' },
  tdCell: { fontSize: isMobile ? 10 : 12, color: COLORS.darkText },

  // Search box
  searchBox: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.white, borderRadius: 20,
    borderWidth: 1, borderColor: COLORS.lightGray,
    paddingHorizontal: 12, paddingVertical: 7,
    minWidth: 120, maxWidth: isMobile ? 160 : 220,
  },
  searchInput: { flex: 1, fontSize: 12, color: COLORS.darkText },

  // ── Template Sections ──
  section: {
    backgroundColor: COLORS.white,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.lightGray,
    marginBottom: 14,
    overflow: 'hidden',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  sectionHeader: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderLeftWidth: 4,
  },
  sectionHeaderText: {
    fontSize: 13, fontWeight: '800', color: COLORS.darkText,
  },
  sectionBody: {
    paddingHorizontal: 12, paddingVertical: 8,
  },
  itemRow: {
    flexDirection: 'row', gap: 10, marginBottom: 4,
  },
  itemCol: { flex: 1 },

  // Template item row (name + edit icon)
  templateItem: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 10, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: COLORS.lightGray,
    gap: 8,
  },
  templateItemName: {
    flex: 1, fontSize: isMobile ? 11 : 12,
    color: COLORS.darkText, lineHeight: 17,
  },

  // Edit icon
  editIconBox: {
    width: 28, height: 28, borderRadius: 6,
    borderWidth: 1, borderColor: COLORS.lightGray,
    backgroundColor: COLORS.offWhite,
    alignItems: 'center', justifyContent: 'center',
  },
  editIconText: { fontSize: 14, color: COLORS.navy },

  // Empty / Budget placeholder
  emptyState: { alignItems: 'center', paddingVertical: 40 },
  emptyText: { fontSize: 14, color: COLORS.midGray },
  budgetPlaceholder: {
    flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 60,
  },
  budgetPlaceholderText: { fontSize: 14, color: COLORS.midGray },

  // ── Edit Modal ──
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
  modalDivider:  { height: 1, backgroundColor: COLORS.lightGray, marginBottom: 14 },
  modalActions:  { flexDirection: 'row', gap: 8, marginBottom: 16 },
  modalActionBtn: {
    flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center',
  },
  modalActionText: { fontSize: 12, fontWeight: '700' },
  modalCloseBtn: {
    paddingVertical: 10, borderRadius: 10,
    backgroundColor: COLORS.lightGray, alignItems: 'center',
  },
  modalCloseBtnText: { fontSize: 13, fontWeight: '600', color: COLORS.darkText },
});