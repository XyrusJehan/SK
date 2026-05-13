import React, { useState, useEffect } from 'react';
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

// ─── COLORS ───────────────────────────────────────────────────────────────────
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

// ─── TABS ─────────────────────────────────────────────────────────────────────
const NAV_TABS      = ['Dashboard', 'Documents', 'Planning', 'Portal', 'Account'];
const PLANNING_TABS = ['Templates', 'Budget'];

// ─── BUDGET DATA ──────────────────────────────────────────────────────────────
// (Data now fetched from Supabase based on barangay_id)
const BUDGET_DATA = [];

const EMPTY_ROWS = 4; // filler rows at bottom

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

// External link icon box — matches the screenshot action icon
const ExternalLinkIcon = () => (
  <View style={styles.extLinkBox}>
    <Text style={styles.extLinkText}>↗</Text>
  </View>
);

// ─── MAIN SCREEN ──────────────────────────────────────────────────────────────
export default function SKPlanningBudgetScreen() {
  const router = useRouter();
  const { activeTab, setActiveTab } = useNav();
  const { logout, user } = useAuth();

  // Get user's barangay from auth context
  const barangayName = user?.barangay?.barangay_name || 'Unknown Barangay';
  const barangayId = user?.barangayId;

  const [searchText, setSearchText]         = useState('');
  const [notifCount]                        = useState(2);
  const [sidebarVisible, setSidebarVisible] = useState(false);
  const [budgetData, setBudgetData]        = useState([]);

  // Fetch budget allocations for this barangay
  useEffect(() => {
    const fetchBudget = async () => {
      if (!barangayId) return;

      try {
        const { data: budget, error } = await supabase
          .from('budget_allocations')
          .select('*')
          .eq('barangay_id', barangayId)
          .order('fiscal_year', { ascending: false });

        if (error) {
          console.error('Error fetching budget:', error);
          return;
        }

        const formattedBudget = budget?.map(b => ({
          id: b.allocation_id?.toString() || '1',
          barangay: barangayName,
          budget: b.allocated_amount || 0,
          action: 'readonly',
        })) || [];

        setBudgetData(formattedBudget);
      } catch (error) {
        console.error('Error:', error);
      }
    };

    fetchBudget();
  }, [barangayId, barangayName]);

  const handleNavPress = (tab) => {
    setActiveTab(tab);
    setSidebarVisible(false);
    if (tab === 'Dashboard') router.push('/(tabs)/sk-dashboard');
    if (tab === 'Documents') router.push('/(tabs)/sk-document');
    if (tab === 'Planning')  router.push('/(tabs)/sk-planning');
    if (tab === 'Portal')    router.push('/(tabs)/sk-portal');
    if (tab === 'Account')   router.push('/(tabs)/sk-account');
  };

  const handleLogout = () => { logout(); router.replace('/'); };

  const handleFormulate = (item) => {
    Alert.alert('Formulate Plan', `Opening plan form for ${item.barangay}…`);
  };

  const filteredRows = BUDGET_DATA.filter(r =>
    r.barangay.toLowerCase().includes(searchText.toLowerCase())
  );

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
        const active = activeTab === tab || (tab === 'Planning');
        return (
          <TouchableOpacity
            key={tab}
            style={[styles.navItem, active && tab === 'Planning' && styles.navItemActive]}
            onPress={() => handleNavPress(tab)}
            activeOpacity={0.8}
          >
            <Text style={[
              styles.navLabel,
              active && tab === 'Planning' && styles.navLabelActive,
            ]}>
              {tab}
            </Text>
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
          <Text style={styles.mobileTitle}>Planning – Budget</Text>
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

      {/* ── PLANNING TAB BAR (same style as MONITOR_TABS) ── */}
      <View style={styles.planningTabBar}>
        <TouchableOpacity
          style={styles.planningTab}
          onPress={() => router.push('/(tabs)/sk-planning')}
          activeOpacity={0.8}
        >
          <Text style={styles.planningTabText}>Templates</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.planningTab, styles.planningTabActive]}
          activeOpacity={0.8}
        >
          <Text style={[styles.planningTabText, styles.planningTabTextActive]}>Budget</Text>
        </TouchableOpacity>
      </View>

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
      </View>

      {/* Section title + date received */}
      <View style={styles.sectionTitleRow}>
        <Text style={styles.sectionTitle}>Allocated Annual Budget</Text>
        <Text style={styles.dateReceived}>Date Received: January, 2026</Text>
      </View>

      {/* Budget Table */}
      <View style={styles.tableContainer}>
        {/* Header */}
        <View style={styles.tableHeader}>
          <Text style={[styles.thText, styles.colBarangay]}>Barangay</Text>
          <Text style={[styles.thText, styles.colBudget]}>Annual Budget</Text>
          <Text style={[styles.thText, styles.colAction]}>Action</Text>
        </View>

        {/* Data rows */}
        {filteredRows.map((item, idx) => (
          <View
            key={item.id}
            style={[styles.tableRow, idx % 2 !== 0 && styles.tableRowEven]}
          >
            <Text style={[styles.tdBarangay, styles.colBarangay]}>{item.barangay}</Text>

            <Text style={[styles.tdBudget, styles.colBudget]}>
              ₱ {item.budget.toLocaleString()}
            </Text>

            <View style={[styles.colAction, { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 6 }]}>
              {item.action === 'formulate' ? (
                <TouchableOpacity
                  style={styles.formulateRow}
                  onPress={() => handleFormulate(item)}
                  activeOpacity={0.75}
                >
                  <Text style={styles.formulateText}>Formulate Plan</Text>
                  <ExternalLinkIcon />
                </TouchableOpacity>
              ) : (
                <Text style={styles.readOnlyText}>Read-Only</Text>
              )}
            </View>
          </View>
        ))}

        {/* Filler empty rows */}
        {Array(Math.max(0, EMPTY_ROWS - Math.max(0, EMPTY_ROWS - filteredRows.length))).fill(null).map((_, i) => (
          <View key={`empty-${i}`} style={[styles.tableRow, styles.tableRowEmpty]} />
        ))}
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
  bellBody:   { width: 14, height: 12, borderRadius: 7, borderWidth: 2, borderColor: '#8B0000', marginTop: 4 },
  bellBottom: { width: 8, height: 4, borderBottomLeftRadius: 4, borderBottomRightRadius: 4, backgroundColor: '#8B0000', marginTop: -1 },
  bellDot:    { position: 'absolute', top: 0, right: 1, width: 7, height: 7, borderRadius: 4, backgroundColor: COLORS.gold, borderWidth: 1.5, borderColor: COLORS.cardBg },
  notifBadge: { position: 'absolute', top: -2, right: -2, width: 16, height: 16, borderRadius: 8, backgroundColor: COLORS.gold, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: COLORS.white },
  notifBadgeText: { fontSize: 8, fontWeight: '900', color: COLORS.navy },

  // ── Planning Tab Bar — identical to MONITOR_TABS ──
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
  planningTabText: { fontSize: isMobile ? 10 : 13, fontWeight: '600', color: COLORS.white },
  planningTabTextActive: { color: COLORS.darkText, fontWeight: '800' },

  // Search row
  searchRow: {
    flexDirection: 'row', alignItems: 'center',
    marginBottom: 12,
  },
  searchBox: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.white, borderRadius: 20,
    borderWidth: 1, borderColor: COLORS.lightGray,
    paddingHorizontal: 12, paddingVertical: 7,
    minWidth: 120, maxWidth: isMobile ? 160 : 220,
  },
  searchInput: { flex: 1, fontSize: 12, color: COLORS.darkText },

  // Section title row
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    flexWrap: 'wrap',
    gap: 4,
  },
  sectionTitle: {
    fontSize: isMobile ? 12 : 14, fontWeight: '800', color: COLORS.navy,
  },
  dateReceived: {
    fontSize: isMobile ? 10 : 12, fontWeight: '600', color: COLORS.subText,
  },

  // ── Budget Table ──
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
  },

  // Table header
  tableHeader: {

    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.navy,
    paddingVertical: 11, paddingHorizontal: isMobile ? 10 : 16,
  },
  thText: {
    fontSize: isMobile ? 9 : 12, fontWeight: '800', color: COLORS.white,
  },

  // Table rows
  tableRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: isMobile ? 8 : 13, paddingHorizontal: isMobile ? 10 : 16,
    borderBottomWidth: 1, borderBottomColor: COLORS.lightGray,
    backgroundColor: COLORS.white, minHeight: isMobile ? 42 : 50,
  },
  tableRowEven:  { backgroundColor: '#F5F7FA' },
  tableRowEmpty: { minHeight: isMobile ? 42 : 50 },

  // Columns
  colBarangay: { flex: 2, paddingRight: 4 },
  colBudget:   { flex: 1.2, paddingRight: 4 },
  colAction:   { width: isMobile ? 70 : 120, alignItems: 'flex-end'},

  tdBarangay: { fontSize: isMobile ? 10 : 13, color: COLORS.darkText, fontWeight: '500' },
  tdBudget:   { fontSize: isMobile ? 10 : 13, color: COLORS.darkText, fontWeight: '600' },

  // Formulate Plan action
  formulateRow: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
  },
  formulateText: {
    fontSize: isMobile ? 9 : 12, alignItems: 'center',
    color: COLORS.navy, fontWeight: '600',
  },
  extLinkBox: {
    width: 20, height: 20, borderRadius: 5,
    borderWidth: 1, borderColor: COLORS.lightGray,
    backgroundColor: COLORS.offWhite,
    alignItems: 'center', justifyContent: 'center',
  },
  extLinkText: { fontSize: 10, color: COLORS.navy, fontWeight: '700' },

  // Read-Only
  readOnlyText: {
    fontSize: isMobile ? 9 : 12,
    color: COLORS.subText, fontWeight: '500',
    textAlign: 'center', flex: 1,
  },
});