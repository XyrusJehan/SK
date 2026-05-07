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

// ─── COLORS ───────────────────────────────────────────────────────────────────
const COLORS = {
  navy:       '#133E75',
  navyLight:  '#1E4D8C',
  gold:       '#E8C547',
  white:      '#FFFFFF',
  offWhite:   '#F7F5F2',
  lightGray:  '#ECECEC',
  midGray:    '#B0B0B0',
  darkText:   '#1A1A1A',
  subText:    '#666666',
  cardBg:     '#FFFFFF',
  approve:    '#2E7D32',
  approveBg:  '#43A047',
  reject:     '#7B0000',
  rejectBg:   '#C62828',
  pending:    '#B8860B',
  pendingBg:  '#FFF3CD',
  pendingBdr: '#E8C547',
  checkBlue:  '#1565C0',
};

const NAV_TABS     = ['Home', 'Documents', 'Monitor'];
const MONITOR_TABS = ['Consultation', 'Budget', 'Report', 'Account'];
// Tabs that show a red notification badge
const NOTIF_TABS   = new Set(['Consultation', 'Budget']);

// ─── DROPDOWN OPTIONS ─────────────────────────────────────────────────────────
const BARANGAY_OPTIONS = [
  'Barangay', 'SK Barangay', 'Barangay San Jose', 'Barangay San Roque',
  'Barangay Santo Cristo', 'Barangay Antipolo', 'Barangay Banot', 'Barangay Mamala',
];
const ROLE_OPTIONS = [
  'SK Chairperson', 'SK Councilor', 'SK Secretary', 'SK Treasurer',
  'SK Auditor', 'SK Business Manager',
];
const FILTER_BARANGAY_OPTIONS = ['All Barangays', ...BARANGAY_OPTIONS.slice(1)];

// ─── INITIAL ACCOUNT DATA ────────────────────────────────────────────────────
const INITIAL_ACCOUNTS = [
  { id: '1', name: '',                 barangay: 'Barangay',    role: 'SK Chairperson', signUpDate: '06 May 2026', status: 'pending' },
  { id: '2', name: 'Patrick Dela Rosa', barangay: 'Barangay',   role: 'SK Chairperson', signUpDate: '06 May 2026', status: 'pending' },
  { id: '3', name: '',                 barangay: 'Barangay',    role: 'SK Chairperson', signUpDate: '06 May 2026', status: 'pending' },
  { id: '4', name: '',                 barangay: 'SK Barangay', role: 'SK Chairperson', signUpDate: '06 May 2026', status: 'pending' },
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

// ─── CHECKBOX ─────────────────────────────────────────────────────────────────
const Checkbox = ({ checked, onToggle }) => (
  <TouchableOpacity
    style={[CB.box, checked && CB.boxChecked]}
    onPress={onToggle}
    activeOpacity={0.75}
  >
    {checked && <Text style={CB.check}>✓</Text>}
  </TouchableOpacity>
);

const CB = StyleSheet.create({
  box:        { width: 18, height: 18, borderRadius: 3, borderWidth: 1.5, borderColor: COLORS.midGray, backgroundColor: COLORS.white, alignItems: 'center', justifyContent: 'center' },
  boxChecked: { backgroundColor: COLORS.checkBlue, borderColor: COLORS.checkBlue },
  check:      { fontSize: 11, color: COLORS.white, fontWeight: '900', lineHeight: 14 },
});

// ─── INLINE DROPDOWN ──────────────────────────────────────────────────────────
const InlineDropdown = ({ value, options, onSelect, width = 120 }) => {
  const [open, setOpen] = useState(false);
  return (
    <View style={[IDD.wrap, { width }]}>
      <TouchableOpacity
        style={IDD.btn}
        onPress={() => setOpen(o => !o)}
        activeOpacity={0.8}
      >
        <Text style={IDD.value} numberOfLines={1}>{value}</Text>
        <Text style={IDD.arrow}>▾</Text>
      </TouchableOpacity>
      {open && (
        <View style={[IDD.menu, { width: Math.max(width, 140) }]}>
          {options.map(opt => (
            <TouchableOpacity
              key={opt}
              style={[IDD.item, opt === value && IDD.itemActive]}
              onPress={() => { onSelect(opt); setOpen(false); }}
              activeOpacity={0.75}
            >
              <Text style={[IDD.itemText, opt === value && IDD.itemTextActive]} numberOfLines={1}>
                {opt}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
};

const IDD = StyleSheet.create({
  wrap:          { position: 'relative', zIndex: 200 },
  btn:           { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: COLORS.white, borderRadius: 6, borderWidth: 1, borderColor: '#C8C8C8', paddingHorizontal: 8, paddingVertical: 5 },
  value:         { fontSize: 11, color: COLORS.darkText, flex: 1 },
  arrow:         { fontSize: 9, color: COLORS.subText, marginLeft: 4 },
  menu:          { position: 'absolute', top: 30, left: 0, backgroundColor: COLORS.white, borderRadius: 8, borderWidth: 1, borderColor: COLORS.lightGray, elevation: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.14, shadowRadius: 8, zIndex: 999 },
  item:          { paddingHorizontal: 12, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: COLORS.lightGray },
  itemActive:    { backgroundColor: '#EEF3FB' },
  itemText:      { fontSize: 11, color: COLORS.darkText },
  itemTextActive:{ fontWeight: '700', color: COLORS.navy },
});

// ─── FILTER DROPDOWN ──────────────────────────────────────────────────────────
const FilterDropdown = ({ value, options, onSelect }) => {
  const [open, setOpen] = useState(false);
  return (
    <View style={FD.wrap}>
      <TouchableOpacity style={FD.btn} onPress={() => setOpen(o => !o)} activeOpacity={0.8}>
        <Text style={FD.label}>Filter by Barangay</Text>
        <Text style={FD.arrow}>▾</Text>
      </TouchableOpacity>
      {open && (
        <View style={FD.menu}>
          {options.map(opt => (
            <TouchableOpacity
              key={opt}
              style={[FD.item, opt === value && FD.itemActive]}
              onPress={() => { onSelect(opt); setOpen(false); }}
              activeOpacity={0.75}
            >
              <Text style={[FD.itemText, opt === value && FD.itemTextActive]} numberOfLines={1}>{opt}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
};

const FD = StyleSheet.create({
  wrap:          { position: 'relative', zIndex: 300 },
  btn:           { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: COLORS.white, borderRadius: 6, borderWidth: 1, borderColor: '#C8C8C8', paddingHorizontal: 12, paddingVertical: 7 },
  label:         { fontSize: 12, color: COLORS.darkText, fontWeight: '500' },
  arrow:         { fontSize: 9, color: COLORS.subText },
  menu:          { position: 'absolute', top: 36, right: 0, minWidth: 200, backgroundColor: COLORS.white, borderRadius: 8, borderWidth: 1, borderColor: COLORS.lightGray, elevation: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.14, shadowRadius: 8, zIndex: 999 },
  item:          { paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.lightGray },
  itemActive:    { backgroundColor: '#EEF3FB' },
  itemText:      { fontSize: 12, color: COLORS.darkText },
  itemTextActive:{ fontWeight: '700', color: COLORS.navy },
});

// ─── STATUS PILL ──────────────────────────────────────────────────────────────
const StatusPill = ({ status }) => {
  if (status === 'pending') {
    return (
      <View style={STP.pill}>
        <Text style={STP.text}>Pending Verification</Text>
      </View>
    );
  }
  if (status === 'approved') {
    return (
      <View style={[STP.pill, { backgroundColor: '#E8F5E9', borderColor: '#81C784' }]}>
        <Text style={[STP.text, { color: COLORS.approve }]}>Approved</Text>
      </View>
    );
  }
  if (status === 'rejected') {
    return (
      <View style={[STP.pill, { backgroundColor: '#FFEBEE', borderColor: '#EF9A9A' }]}>
        <Text style={[STP.text, { color: '#C62828' }]}>Rejected</Text>
      </View>
    );
  }
  return null;
};

const STP = StyleSheet.create({
  pill: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5, backgroundColor: COLORS.pendingBg, borderWidth: 1, borderColor: COLORS.pendingBdr, alignSelf: 'flex-start' },
  text: { fontSize: isMobile ? 8 : 10, fontWeight: '700', color: COLORS.pending },
});

// ─── ACCOUNT ROW ─────────────────────────────────────────────────────────────
const AccountRow = ({
  account, checked, onToggle,
  onBrgyChange, onRoleChange,
  onApprove, onReject,
  isEven,
}) => (
  <View style={[styles.tableRow, isEven && styles.tableRowEven, checked && styles.tableRowSelected]}>

    {/* Select */}
    <View style={styles.colSelect}>
      <Checkbox checked={checked} onToggle={onToggle} />
    </View>

    {/* User Name */}
    <View style={styles.colName}>
      <Text style={styles.cellName}>{account.name}</Text>
    </View>

    {/* Barangay Dropdown */}
    <View style={styles.colBarangay}>
      <InlineDropdown
        value={account.barangay}
        options={BARANGAY_OPTIONS}
        onSelect={onBrgyChange}
        width={isMobile ? 90 : 125}
      />
    </View>

    {/* Role/Position Dropdown */}
    <View style={styles.colRole}>
      <InlineDropdown
        value={account.role}
        options={ROLE_OPTIONS}
        onSelect={onRoleChange}
        width={isMobile ? 90 : 130}
      />
    </View>

    {/* Sign-up Date */}
    <View style={styles.colDate}>
      <Text style={styles.cellDate}>{account.signUpDate}</Text>
    </View>

    {/* Status */}
    <View style={styles.colStatus}>
      <StatusPill status={account.status} />
    </View>

    {/* Action — Approve / Reject stacked */}
    <View style={styles.colAction}>
      <TouchableOpacity
        style={styles.approveBtn}
        onPress={onApprove}
        activeOpacity={0.85}
      >
        <Text style={styles.actionBtnText}>Approve</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.rejectBtn}
        onPress={onReject}
        activeOpacity={0.85}
      >
        <Text style={styles.actionBtnText}>Reject</Text>
      </TouchableOpacity>
    </View>

  </View>
);

// ─── MAIN SCREEN ──────────────────────────────────────────────────────────────
export default function LYDOMonitorAccountScreen() {
  const router = useRouter();
  const { activeTab, setActiveTab } = useNav();
  const { logout } = useAuth();

  const [activeMonitorTab, setActiveMonitorTab] = useState('Account');
  const [accounts, setAccounts]         = useState(INITIAL_ACCOUNTS);
  const [selectedIds, setSelectedIds]   = useState(new Set(['2'])); // Patrick pre-checked
  const [filterBrgy, setFilterBrgy]     = useState('All Barangays');
  const [notifCount]                    = useState(2);
  const [sidebarVisible, setSidebarVisible] = useState(false);

  // ── Navigation ──────────────────────────────────────────────────────────────
  const handleNavPress = (tab) => {
    setActiveTab(tab);
    setSidebarVisible(false);
    if (tab === 'Home')      router.push('/(tabs)/lydo-home');
    if (tab === 'Documents') router.push('/(tabs)/lydo-document');
    if (tab === 'Monitor')   router.push('/(tabs)/lydo-monitor');
  };

  const handleLogout = () => { logout(); router.replace('/'); };

  const handleMonitorTabPress = (tab) => {
    if (tab === 'Consultation') { router.push('/(tabs)/lydo-monitor');        return; }
    if (tab === 'Budget')       { router.push('/(tabs)/lydo-monitor-budget'); return; }
    if (tab === 'Report')       { router.push('/(tabs)/lydo-monitor-report'); return; }
    setActiveMonitorTab(tab);
  };

  // ── Row helpers ──────────────────────────────────────────────────────────────
  const toggleSelect = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const updateAccount = (id, patch) => {
    setAccounts(prev => prev.map(a => a.id === id ? { ...a, ...patch } : a));
  };

  const handleApprove = (id) => {
    Alert.alert('Approve Account', 'Are you sure you want to approve this applicant?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Approve', style: 'default', onPress: () => updateAccount(id, { status: 'approved' }) },
    ]);
  };

  const handleReject = (id) => {
    Alert.alert('Reject Account', 'Are you sure you want to reject this applicant?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Reject', style: 'destructive', onPress: () => updateAccount(id, { status: 'rejected' }) },
    ]);
  };

  // ── Filtered accounts ────────────────────────────────────────────────────────
  const filtered = filterBrgy === 'All Barangays'
    ? accounts
    : accounts.filter(a => a.barangay === filterBrgy);

  // ── Sidebar ─────────────────────────────────────────────────────────────────
  const renderSidebar = () => (
    <View style={styles.sidebar}>
      <View style={styles.logoPill}>
        <Image
          source={require('./../../assets/images/lydo-logo.png')}
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
          </TouchableOpacity>
        );
      })}
      <View style={{ flex: 1 }} />
      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.8}>
        <Text style={styles.logoutText}>Logout</Text>
      </TouchableOpacity>
    </View>
  );

  // ── Main Content ─────────────────────────────────────────────────────────────
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
          <Text style={styles.mobileTitle}>Account Management</Text>
          <TouchableOpacity style={styles.bellBtn}>
            <BellIcon hasNotif={notifCount > 0} />
          </TouchableOpacity>
        </View>
      )}

      {/* Desktop Header */}
      {!isMobile && (
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerSub}>SANGGUNIANG KABATAAN FEDERATION</Text>
            <Text style={styles.headerTitle}>RIZAL, LAGUNA</Text>
            <Text style={styles.headerDesc}>
              SK Full Disclosure Policy Compliance Portal for the Submission and Validation{'\n'}of Statutory Financial Reports and Developmental Plans
            </Text>
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

      {/* ── Monitor Tabs ── */}
      <View style={styles.monitorTabBar}>
        {MONITOR_TABS.map(tab => {
          const active = activeMonitorTab === tab;
          return (
            <TouchableOpacity
              key={tab}
              style={[styles.monitorTab, active && styles.monitorTabActive]}
              onPress={() => handleMonitorTabPress(tab)}
              activeOpacity={0.8}
            >
              <Text style={[styles.monitorTabText, active && styles.monitorTabTextActive]}>
                {tab}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* ── Page Title Row ── */}
      <View style={styles.pageTitleRow}>
        <View>
          <Text style={styles.pageTitle}>Account Management</Text>
          <Text style={styles.pageSubTitle}>Review of pending applicants</Text>
        </View>
        {/* Filter by Barangay (top-right) */}
        <FilterDropdown
          value={filterBrgy}
          options={FILTER_BARANGAY_OPTIONS}
          onSelect={setFilterBrgy}
        />
      </View>

      {/* ── Table ── */}
      <View style={styles.tableContainer}>

          {/* Table Header */}
          <View style={styles.tableHeader}>
            <View style={styles.colSelect}>
              <Text style={styles.tableHeaderText}>Select</Text>
            </View>
            <View style={styles.colName}>
              <Text style={styles.tableHeaderText}>User Name</Text>
            </View>
            <View style={styles.colBarangay}>
              <Text style={styles.tableHeaderText}>Barangay</Text>
            </View>
            <View style={styles.colRole}>
              <Text style={styles.tableHeaderText}>Role/Position</Text>
            </View>
            <View style={styles.colDate}>
              <Text style={styles.tableHeaderText}>Sign-up Date</Text>
            </View>
            <View style={styles.colStatus}>
              <Text style={styles.tableHeaderText}>Status</Text>
            </View>
            <View style={styles.colAction}>
              <Text style={styles.tableHeaderText}>Action</Text>
            </View>
          </View>

          {/* Rows */}
          {filtered.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No pending applicants.</Text>
            </View>
          ) : (
            filtered.map((acc, idx) => (
              <AccountRow
                key={acc.id}
                account={acc}
                checked={selectedIds.has(acc.id)}
                isEven={idx % 2 !== 0}
                onToggle={() => toggleSelect(acc.id)}
                onBrgyChange={val => updateAccount(acc.id, { barangay: val })}
                onRoleChange={val => updateAccount(acc.id, { role: val })}
                onApprove={() => handleApprove(acc.id)}
                onReject={() => handleReject(acc.id)}
              />
            ))
          )}

          {/* Extra empty rows to match screenshot appearance */}
          {[...Array(Math.max(0, 6 - filtered.length))].map((_, i) => (
            <View key={`empty-${i}`} style={[styles.tableRow, (filtered.length + i) % 2 !== 0 && styles.tableRowEven, styles.emptyRow]} />
          ))}

       
      </View>

    </ScrollView>
  );

  // ── Root ─────────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.navy} />

      {/* Mobile Sidebar Modal */}
      <Modal
        visible={isMobile && sidebarVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setSidebarVisible(false)}
      >
        <View style={styles.mobileSidebarContainer}>
          <TouchableOpacity
            style={styles.sidebarOverlay}
            activeOpacity={1}
            onPress={() => setSidebarVisible(false)}
          />
          <View style={styles.mobileSidebar}>
            {renderSidebar()}
          </View>
        </View>
      </Modal>

      {/* Layout */}
      <View style={styles.layout}>
        {!isMobile && renderSidebar()}
        {renderContent()}
      </View>
    </SafeAreaView>
  );
}

// ─── STYLES ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: COLORS.navy },
  layout: { flex: 1, flexDirection: 'row' },

  // ── Sidebar ──────────────────────────────────────────────────────────────────
  sidebar: {
    width: 250, backgroundColor: COLORS.navy,
    alignItems: 'center', paddingTop: 20, paddingBottom: 24,
    paddingHorizontal: 10, zIndex: 10,
  },
  sidebarOverlay:        { position: 'absolute', left: 0, top: 0, bottom: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 5 },
  mobileSidebarContainer:{ flex: 1 },
  mobileSidebar:         { position: 'absolute', left: 0, top: 0, bottom: 0, width: '75%', maxWidth: 280, zIndex: 10 },

  logoPill:      { marginTop: 20, width: 70, height: 70, borderRadius: 35, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center', marginBottom: 8, borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)' },
  logoImage:     { width: 110, height: 110 },
  navItem:       { width: '100%', paddingVertical: 12, paddingHorizontal: 12, borderRadius: 24, marginBottom: 8, alignItems: 'center', borderWidth: 1.5, borderColor: COLORS.white, backgroundColor: COLORS.navy },
  navItemActive: { backgroundColor: COLORS.white, borderColor: COLORS.white },
  navLabel:      { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.8)', letterSpacing: 0.3 },
  navLabelActive:{ color: '#000', fontWeight: '800' },
  logoutBtn:     { width: '100%', paddingVertical: 12, paddingHorizontal: 12, borderRadius: 24, marginTop: 8, alignItems: 'center', borderWidth: 1.5, borderColor: COLORS.white, backgroundColor: 'rgba(255,255,255,0.1)' },
  logoutText:    { fontSize: 13, fontWeight: '600', color: COLORS.white, letterSpacing: 0.3 },

  // ── Main ─────────────────────────────────────────────────────────────────────
  main:        { flex: 1, backgroundColor: COLORS.offWhite, borderTopLeftRadius: 20 },
  mainMobile:  { borderTopLeftRadius: 0 },
  mainContent: { padding: 20, paddingBottom: 40 },

  // ── Mobile header ────────────────────────────────────────────────────────────
  mobileHeader:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: COLORS.lightGray },
  menuBtn:           { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.cardBg, alignItems: 'center', justifyContent: 'center' },
  menuIconContainer: { width: 20, height: 16, justifyContent: 'space-between' },
  menuLine:          { width: 20, height: 2, backgroundColor: COLORS.navy, borderRadius: 1 },
  mobileTitle:       { fontSize: 16, fontWeight: '800', color: COLORS.darkText },

  // ── Desktop header ───────────────────────────────────────────────────────────
  header:      { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 18 },
  headerSub:   { fontSize: 10, fontWeight: '600', color: COLORS.subText, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 2 },
  headerTitle: { fontSize: 20, fontWeight: '900', color: COLORS.darkText, letterSpacing: 0.5, borderBottomWidth: 2, borderBottomColor: COLORS.lightGray },
  headerDesc:  { fontSize: 15, fontWeight: '700', color: COLORS.darkText, marginTop: 6, lineHeight: 17 },

  // Bell
  bellBtn:        { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.cardBg, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 6, elevation: 3 },
  bellWrapper:    { width: 20, height: 22, alignItems: 'center' },
  bellBody:       { width: 14, height: 12, borderRadius: 7, borderWidth: 2, borderColor: '#8B0000', marginTop: 4 },
  bellBottom:     { width: 8, height: 4, borderBottomLeftRadius: 4, borderBottomRightRadius: 4, backgroundColor: '#8B0000', marginTop: -1 },
  bellDot:        { position: 'absolute', top: 0, right: 1, width: 7, height: 7, borderRadius: 4, backgroundColor: COLORS.gold, borderWidth: 1.5, borderColor: COLORS.cardBg },
  notifBadge:     { position: 'absolute', top: -2, right: -2, width: 16, height: 16, borderRadius: 8, backgroundColor: COLORS.gold, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: COLORS.white },
  notifBadgeText: { fontSize: 8, fontWeight: '900', color: COLORS.navy },

  // ── Monitor tabs ─────────────────────────────────────────────────────────────
  monitorTabBar:        { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: COLORS.lightGray, marginBottom: 14, overflowX: 'hidden', overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.30, shadowRadius: 3, elevation: 6 },
  monitorTab:           { flex: 1, paddingHorizontal: isMobile ? 8 : 40, backgroundColor: COLORS.navy, paddingVertical: 10, borderBottomWidth: 0, borderBottomColor: 'transparent', marginBottom: -1, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', alignItems: 'center' },
  monitorTabActive:     { backgroundColor: COLORS.gold, borderRadius: 4, borderBottomColor: COLORS.gold, borderColor: COLORS.gold, shadowColor: COLORS.gold, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.4, shadowRadius: 4, elevation: 3 },
  monitorTabText:       { fontSize: isMobile ? 10 : 13, fontWeight: '600', color: COLORS.white },
  monitorTabTextActive: { color: COLORS.darkText, fontWeight: '800' },

  // ── Page title row ────────────────────────────────────────────────────────────
  pageTitleRow:  { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16, zIndex: 300 },
  pageTitle:     { fontSize: isMobile ? 16 : 22, fontWeight: '800', color: COLORS.darkText, letterSpacing: 0.2 },
  pageSubTitle:  { fontSize: isMobile ? 10 : 12, color: COLORS.subText, marginTop: 2 },

  // ── Table ─────────────────────────────────────────────────────────────────────
  tableContainer: { backgroundColor: COLORS.white, borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: COLORS.lightGray, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6 },
  tableHeader:   { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.white, paddingVertical: 11, paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: COLORS.lightGray },
  tableHeaderText:{ fontSize: isMobile ? 10 : 12, fontWeight: '700', color: COLORS.darkText, letterSpacing: 0.2 },
  tableRow:      { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: COLORS.lightGray, backgroundColor: COLORS.white, minHeight: 56 },
  tableRowEven:  { backgroundColor: '#FAFAFA' },
  tableRowSelected: { backgroundColor: '#EEF3FB' },
  emptyRow:      { minHeight: 52 },

  // Columns — all flex: 1 to match lydo-monitor tab behaviour
  colSelect:   { width: 44, alignItems: 'center' },
  colName:     { flex: 1, paddingRight: 8 },
  colBarangay: { flex: 1, paddingRight: 8, zIndex: 200 },
  colRole:     { flex: 1, paddingRight: 8, zIndex: 200 },
  colDate:     { flex: 1, paddingRight: 8 },
  colStatus:   { flex: 1, paddingRight: 8 },
  colAction:   { width: isMobile ? 80 : 100, gap: 4 },

  // Cells
  cellName:    { fontSize: isMobile ? 10 : 12, color: COLORS.darkText, fontWeight: '500' },
  cellDate:    { fontSize: isMobile ? 10 : 12, color: COLORS.darkText },

  // Action buttons
  approveBtn:     { backgroundColor: '#43A047', borderRadius: 4, paddingHorizontal: 8, paddingVertical: 4, alignItems: 'center' },
  rejectBtn:      { backgroundColor: '#C62828', borderRadius: 4, paddingHorizontal: 8, paddingVertical: 4, alignItems: 'center' },
  actionBtnText:  { fontSize: 10, fontWeight: '700', color: COLORS.white },

  emptyState: { alignItems: 'center', paddingVertical: 40 },
  emptyText:  { fontSize: 14, color: COLORS.midGray },
});