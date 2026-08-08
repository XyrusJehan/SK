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
import { NotificationModal, useNotificationCenter } from './notificationCenter';

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
const NAV_TABS      = ['Dashboard', 'Documents', 'Planning', 'Portal', 'Logs', 'Account'];
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
  const [sidebarVisible, setSidebarVisible] = useState(false);
  const [budgetData, setBudgetData]        = useState([]);

  // ── Shared notification bell (returned/approved docs, templates, deadlines) ──
  const notif = useNotificationCenter(barangayId);
  const notifCount = notif.count;

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
    if (tab === 'Logs')      router.push('/(tabs)/sk-logs');
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
  const NAV_ITEMS = [
    { tab: 'Dashboard', IconComponent: DashboardIcon },
    { tab: 'Documents', IconComponent: DocumentsIcon },
    { tab: 'Planning',  IconComponent: PlanningIcon  },
    { tab: 'Portal',    IconComponent: PortalIcon    },
    { tab: 'Logs',      IconComponent: LogsIcon      },
    { tab: 'Account',   IconComponent: AccountIcon   },
  ];

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
          <Text style={styles.mobileTitle}>Planning – Budget</Text>
          <TouchableOpacity style={styles.bellBtn} onPress={notif.open} activeOpacity={0.7}>
            <BellIcon hasNotif={notif.hasUnviewed} />
            {notifCount > 0 && (
              <View style={styles.notifBadge}>
                <Text style={styles.notifBadgeText}>{notifCount > 99 ? '99+' : notifCount}</Text>
              </View>
            )}
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
            <TouchableOpacity style={styles.bellBtn} onPress={notif.open} activeOpacity={0.7}>
              <BellIcon hasNotif={notif.hasUnviewed} />
              {notifCount > 0 && (
                <View style={styles.notifBadge}>
                  <Text style={styles.notifBadgeText}>{notifCount > 99 ? '99+' : notifCount}</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
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
    borderWidth: 1.5, borderColor: COLORS.white,
    backgroundColor: COLORS.navy,
  },
  navItemInner: { flexDirection: 'row', alignItems: 'center', gap: 8 },
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