import React, { useState } from 'react';
import {
  View, Text, TextInput, ScrollView, TouchableOpacity,
  StyleSheet, SafeAreaView, StatusBar, Dimensions,
  Modal, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useNav } from './navContext';
import { useAuth } from './authContext';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const isMobile = SCREEN_WIDTH < 768;

// ─── COLORS (identical to lydo-monitor) ──────────────────────────────────────
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
  highlight: 'rgba(255, 214, 0, 0.45)',
  highlightBorder: '#E8C547',
  commentDot: '#E87A30',
};

const NAV_TABS     = ['Home', 'Documents', 'Monitor'];
const MONITOR_TABS = ['Consultation', 'Budget', 'Report', 'Submitted'];

// ─── BUDGET FILTER BUTTONS (Submitted / Set Budget) ──────────────────────────
// budgetFilter: 'submitted' | 'set'
// submitted → shows rows where submittedDate is set
// set       → shows rows where budgetSet === true

// ─── BUDGET TABLE DATA ────────────────────────────────────────────────────────
const BUDGET_ROWS = [
  {
    id: '1', barangay: 'Barangay San Jose',
    document: 'SK Annual Budget',
    time: '3:00 PM', date: '1/02/2026',
    submittedDate: '1/02/2026', budgetSet: false,
    amount: '₱ 120,000.00',
  },
  {
    id: '2', barangay: 'Barangay San Roque',
    document: 'SK Annual Budget',
    time: '3:00 PM', date: '1/02/2026',
    submittedDate: '1/02/2026', budgetSet: true,
    amount: '₱ 95,000.00',
  },
  {
    id: '3', barangay: 'Barangay Santo Cristo',
    document: 'SK Annual Budget',
    time: '3:00 PM', date: '1/02/2026',
    submittedDate: '1/02/2026', budgetSet: false,
    amount: '₱ 110,000.00',
  },
  {
    id: '4', barangay: 'Barangay Antipolo',
    document: 'SK Annual Budget',
    time: '9:00 AM', date: '1/05/2026',
    submittedDate: null, budgetSet: true,
    amount: '₱ 150,000.00',
  },
  {
    id: '5', barangay: 'Barangay San Isidro',
    document: 'SK Annual Budget',
    time: '10:30 AM', date: '1/06/2026',
    submittedDate: null, budgetSet: false,
    amount: '₱ 88,000.00',
  },
  {
    id: '6', barangay: 'Barangay Mamala',
    document: 'SK Annual Budget',
    time: '4:00 PM', date: '1/08/2026',
    submittedDate: '1/08/2026', budgetSet: true,
    amount: '₱ 102,000.00',
  },
];

// ─── BUDGET DOCUMENT SECTIONS (for View/Comment modal) ───────────────────────
const BUDGET_SECTIONS = [
  { id: 'b1',  text: 'Barangay ___________________' },
  { id: 'b2',  text: 'Sangguniang Kabataan' },
  { id: 'b3',  text: 'SK ANNUAL BUDGET' },
  { id: 'b4',  text: 'Fiscal Year: ___________' },
  { id: 'b5',  text: 'Total Appropriations: ___________' },
  { id: 'b6',  text: 'Personal Services: ___________' },
  { id: 'b7',  text: 'Maintenance and Other Operating Expenses: ___________' },
  { id: 'b8',  text: 'Capital Outlay: ___________' },
  { id: 'b9',  text: 'Special Purpose Appropriations: ___________' },
  { id: 'b10', text: 'Prepared by:' },
  { id: 'b11', text: '____________         ____________' },
  { id: 'b12', text: 'SK Treasurer         SK Chairperson' },
];

// ─── ICONS ────────────────────────────────────────────────────────────────────
const BellIcon = ({ hasNotif }) => (
  <View style={S.bellWrapper}>
    <View style={S.bellBody} />
    <View style={S.bellBottom} />
    {hasNotif && <View style={S.bellDot} />}
  </View>
);
const MenuIcon = () => (
  <View style={S.menuIconContainer}>
    {[0, 1, 2].map(i => <View key={i} style={S.menuLine} />)}
  </View>
);

// ─── 3-DOT MENU ───────────────────────────────────────────────────────────────
const ThreeDotMenu = ({ onSave, onEdit, onReturn }) => {
  const [open, setOpen] = useState(false);
  return (
    <View style={TD.wrap}>
      <TouchableOpacity style={TD.btn} onPress={() => setOpen(!open)} activeOpacity={0.7}>
        <Text style={TD.dots}>•••</Text>
      </TouchableOpacity>
      {open && (
        <View style={TD.menu}>
          {[
            { label: '💾  Save',   action: onSave },
            { label: '✏️  Edit',   action: onEdit },
            { label: '↩  Return', action: onReturn },
          ].map((item, i) => (
            <TouchableOpacity
              key={i}
              style={[TD.item, i < 2 && TD.itemBorder]}
              onPress={() => { setOpen(false); item.action?.(); }}
              activeOpacity={0.75}
            >
              <Text style={TD.itemText}>{item.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
};
const TD = StyleSheet.create({
  wrap: { position: 'relative', zIndex: 99 },
  btn:  { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.lightGray, alignItems: 'center', justifyContent: 'center' },
  dots: { fontSize: 14, fontWeight: '900', color: COLORS.darkText, letterSpacing: 2 },
  menu: {
    position: 'absolute', top: 42, right: 0,
    backgroundColor: COLORS.white, borderRadius: 10, width: 140, elevation: 8,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 8,
    borderWidth: 1, borderColor: COLORS.lightGray,
  },
  item:       { paddingHorizontal: 16, paddingVertical: 13 },
  itemBorder: { borderBottomWidth: 1, borderBottomColor: COLORS.lightGray },
  itemText:   { fontSize: 13, fontWeight: '600', color: COLORS.darkText },
});

// ─── SET BUDGET MODAL ─────────────────────────────────────────────────────────
const SetBudgetModal = ({ visible, item, onClose, onSave }) => {
  const [amount, setAmount] = useState(item?.amount ?? '');
  const [notes, setNotes]   = useState('');

  if (!visible || !item) return null;
  return (
    <Modal visible={visible} transparent animationType="fade">
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={SB.overlay}>
          <View style={SB.sheet}>
            <View style={SB.header}>
              <Text style={SB.title}>Set Budget</Text>
              <TouchableOpacity onPress={onClose} style={SB.closeBtn}>
                <Text style={SB.closeX}>✕</Text>
              </TouchableOpacity>
            </View>

            <View style={SB.divider} />

            <Text style={SB.label}>Barangay</Text>
            <View style={SB.readOnly}>
              <Text style={SB.readOnlyText}>{item.barangay}</Text>
            </View>

            <Text style={SB.label}>Document</Text>
            <View style={SB.readOnly}>
              <Text style={SB.readOnlyText}>{item.document}</Text>
            </View>

            <Text style={SB.label}>Allocated Budget Amount</Text>
            <View style={SB.inputWrap}>
              <Text style={SB.pesoSign}>₱</Text>
              <TextInput
                style={SB.input}
                value={amount}
                onChangeText={setAmount}
                keyboardType="numeric"
                placeholder="0.00"
                placeholderTextColor={COLORS.midGray}
              />
            </View>

            <Text style={SB.label}>Notes (optional)</Text>
            <TextInput
              style={SB.notesInput}
              value={notes}
              onChangeText={setNotes}
              placeholder="Add budget notes..."
              placeholderTextColor={COLORS.midGray}
              multiline
              numberOfLines={3}
            />

            <View style={SB.btnRow}>
              <TouchableOpacity style={SB.cancelBtn} onPress={onClose} activeOpacity={0.8}>
                <Text style={SB.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={SB.saveBtn}
                onPress={() => { onSave?.({ ...item, amount, notes }); onClose(); }}
                activeOpacity={0.8}
              >
                <Text style={SB.saveText}>Set Budget</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};
const SB = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  sheet:   { backgroundColor: COLORS.white, borderRadius: 18, width: '100%', maxWidth: 420, padding: 24, elevation: 12 },
  header:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  title:   { fontSize: 17, fontWeight: '800', color: COLORS.darkText },
  closeBtn:{ width: 28, height: 28, borderRadius: 14, backgroundColor: COLORS.lightGray, alignItems: 'center', justifyContent: 'center' },
  closeX:  { fontSize: 12, color: COLORS.subText },
  divider: { height: 1, backgroundColor: COLORS.lightGray, marginBottom: 16 },
  label:   { fontSize: 11, fontWeight: '700', color: COLORS.subText, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6, marginTop: 12 },
  readOnly:{ backgroundColor: COLORS.offWhite, borderRadius: 8, padding: 10, borderWidth: 1, borderColor: COLORS.lightGray },
  readOnlyText: { fontSize: 13, color: COLORS.darkText },
  inputWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.white, borderRadius: 8, borderWidth: 1.5, borderColor: COLORS.navy, paddingHorizontal: 12, paddingVertical: 2 },
  pesoSign: { fontSize: 15, fontWeight: '700', color: COLORS.navy, marginRight: 4 },
  input: { flex: 1, fontSize: 15, color: COLORS.darkText, paddingVertical: 8 },
  notesInput: {
    backgroundColor: COLORS.offWhite, borderRadius: 8, borderWidth: 1, borderColor: COLORS.lightGray,
    padding: 10, fontSize: 13, color: COLORS.darkText, textAlignVertical: 'top', minHeight: 70,
  },
  btnRow:    { flexDirection: 'row', gap: 10, marginTop: 20 },
  cancelBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, borderWidth: 1.5, borderColor: COLORS.midGray, alignItems: 'center' },
  cancelText:{ fontSize: 13, fontWeight: '700', color: COLORS.subText },
  saveBtn:   { flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: COLORS.navy, alignItems: 'center' },
  saveText:  { fontSize: 13, fontWeight: '700', color: COLORS.white },
});

// ─── DOCUMENT VIEWER MODAL ────────────────────────────────────────────────────
const BudgetDocumentViewer = ({ item, onClose }) => {
  if (!item) return null;
  return (
    <Modal visible animationType="slide" transparent>
      <View style={DV.overlay}>
        <View style={DV.sheet}>
          {/* Top bar */}
          <View style={DV.topBar}>
            <TouchableOpacity onPress={onClose} style={DV.backBtn}>
              <Text style={DV.backText}>← Back</Text>
            </TouchableOpacity>
            <Text style={DV.sheetTitle} numberOfLines={1}>{item.document}</Text>
            <ThreeDotMenu
              onSave={() => Alert.alert('Saved', 'Document saved.')}
              onEdit={() => Alert.alert('Edit', 'Edit mode not available in view.')}
              onReturn={onClose}
            />
          </View>

          <ScrollView contentContainerStyle={DV.docPage} showsVerticalScrollIndicator={false}>
            {/* Document paper */}
            <View style={DV.paper}>
              <Text style={DV.paperCenter}>Barangay ___________________</Text>
              <Text style={DV.paperCenter}>Sangguniang Kabataan</Text>
              <Text style={[DV.paperCenter, DV.bold, { marginTop: 10 }]}>SK ANNUAL BUDGET</Text>
              <Text style={[DV.paperCenter, { marginBottom: 14 }]}>Fiscal Year: ___________</Text>

              {/* Budget table */}
              <View style={DV.table}>
                {/* Header */}
                <View style={[DV.tRow, { backgroundColor: '#f0f0f0' }]}>
                  <Text style={[DV.tCell, DV.tHead, { flex: 2 }]}>Budget Item</Text>
                  <Text style={[DV.tCell, DV.tHead]}>Amount (₱)</Text>
                  <Text style={[DV.tCell, DV.tHead]}>Remarks</Text>
                </View>
                {[
                  'Personal Services',
                  'MOOE',
                  'Capital Outlay',
                  'Special Purpose Appropriations',
                  'Total Appropriations',
                ].map((label, i) => (
                  <View key={i} style={[DV.tRow, i % 2 === 1 && { backgroundColor: '#fafafa' }]}>
                    <Text style={[DV.tCell, { flex: 2, fontWeight: i === 4 ? '700' : '400' }]}>{label}</Text>
                    <Text style={DV.tCell}>___________</Text>
                    <Text style={DV.tCell}>___________</Text>
                  </View>
                ))}
              </View>

              <Text style={[DV.paperCenter, { marginTop: 20 }]}>Prepared by:</Text>
              <View style={DV.sigRow}>
                <View style={DV.sigBlock}>
                  <View style={DV.sigLine} />
                  <Text style={DV.sigLabel}>SK Treasurer</Text>
                </View>
                <View style={DV.sigBlock}>
                  <View style={DV.sigLine} />
                  <Text style={DV.sigLabel}>SK Chairperson</Text>
                </View>
              </View>
            </View>
          </ScrollView>

          {/* Approve button */}
          <View style={DV.bottomBar}>
            <TouchableOpacity
              style={DV.approveBtn}
              onPress={() => { Alert.alert('Approved', `${item.barangay} budget approved.`); onClose(); }}
              activeOpacity={0.85}
            >
              <Text style={DV.approveBtnText}>Approve</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};
const DV = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' },
  sheet:   { backgroundColor: COLORS.offWhite, borderTopLeftRadius: 20, borderTopRightRadius: 20, height: SCREEN_HEIGHT * 0.92, overflow: 'hidden' },
  topBar:  { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.white, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.lightGray, gap: 10 },
  backBtn: { paddingHorizontal: 4 },
  backText:{ fontSize: 13, color: COLORS.navy, fontWeight: '700' },
  sheetTitle: { flex: 1, fontSize: 13, fontWeight: '700', color: COLORS.darkText },
  docPage: { padding: 20, paddingBottom: 100 },
  paper:   {
    backgroundColor: COLORS.white, borderRadius: 8,
    padding: 20, elevation: 2,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6,
  },
  paperCenter: { textAlign: 'center', fontSize: 11, color: COLORS.darkText, marginBottom: 4 },
  bold:        { fontWeight: '800', letterSpacing: 0.5 },

  // Budget table inside paper
  table: { borderWidth: 1, borderColor: '#ccc', marginTop: 14, borderRadius: 4, overflow: 'hidden' },
  tRow:  { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#e0e0e0' },
  tCell: { flex: 1, paddingVertical: 7, paddingHorizontal: 8, fontSize: 10, color: COLORS.darkText, borderRightWidth: 1, borderRightColor: '#e0e0e0' },
  tHead: { fontWeight: '700', fontSize: 10, color: '#333', backgroundColor: '#f0f0f0' },

  sigRow:   { flexDirection: 'row', justifyContent: 'space-around', marginTop: 24, marginBottom: 8 },
  sigBlock: { alignItems: 'center', gap: 4 },
  sigLine:  { width: 100, height: 1, backgroundColor: COLORS.darkText },
  sigLabel: { fontSize: 9, color: COLORS.subText },

  bottomBar:  { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: COLORS.white, borderTopWidth: 1, borderTopColor: COLORS.lightGray, paddingHorizontal: 20, paddingVertical: 12, flexDirection: 'row', justifyContent: 'center', gap: 12 },
  approveBtn: { flex: 1, maxWidth: 200, backgroundColor: COLORS.navy, borderRadius: 10, paddingVertical: 13, alignItems: 'center' },
  approveBtnText: { color: COLORS.white, fontWeight: '800', fontSize: 14 },
});

// ─── TABLE ROW ────────────────────────────────────────────────────────────────
const TableRow = ({ item, isEven, budgetFilter, onView, onSetBudget }) => (
  <View style={[S.tableRow, isEven && S.tableRowEven]}>
    <View style={S.colBarangay}>
      <Text style={S.cellBarangay}>{item.barangay}</Text>
    </View>
    <View style={S.colDocument}>
      <Text style={S.cellDocument} numberOfLines={1}>{item.document}</Text>
    </View>
    <View style={S.colDateTime}>
      <Text style={S.cellTime}>{item.time}</Text>
      <Text style={S.cellDate}>{item.date}</Text>
    </View>
    <View style={S.colAction}>
      <TouchableOpacity style={S.viewBtn} onPress={() => onView(item)} activeOpacity={0.75}>
        <Text style={S.viewBtnText}>View</Text>
      </TouchableOpacity>
    </View>
  </View>
);

// ─── MAIN SCREEN ──────────────────────────────────────────────────────────────
export default function LYDOMonitorBudgetScreen() {
  const router = useRouter();
  const { activeTab, setActiveTab } = useNav();
  const { logout } = useAuth();

  const [activeMonitorTab, setActiveMonitorTab] = useState('Budget');
  // 'submitted' | 'set'
  const [budgetFilter, setBudgetFilter]         = useState('submitted');
  const [searchText, setSearchText]             = useState('');
  const [notifCount]                            = useState(2);
  const [sidebarVisible, setSidebarVisible]     = useState(false);
  const [viewingItem, setViewingItem]           = useState(null);
  const [setBudgetItem, setSetBudgetItem]       = useState(null);

  const handleNavPress = (tab) => {
    setActiveTab(tab);
    setSidebarVisible(false);
    if (tab === 'Home')      router.push('/(tabs)/lydo-home');
    if (tab === 'Documents') router.push('/(tabs)/lydo-document');
    if (tab === 'Monitor')   router.push('/(tabs)/lydo-monitor');
  };

  const handleLogout = () => {
    logout();
    router.replace('/');
  };

  const handleMonitorTabPress = (tab) => {
    if (tab !== 'Budget') {
      handleNavPress('Monitor');
      return;
    }
    setActiveMonitorTab(tab);
    setSearchText('');
    setBudgetFilter('submitted');
  };

  // Filter rows
  const rows = BUDGET_ROWS
    .filter(r => {
      if (budgetFilter === 'submitted') return r.submittedDate !== null;
      if (budgetFilter === 'set')       return r.budgetSet === true;
      return true;
    })
    .filter(r =>
      r.barangay.toLowerCase().includes(searchText.toLowerCase()) ||
      r.document.toLowerCase().includes(searchText.toLowerCase())
    );

  // ── Sidebar ──────────────────────────────────────────────────────────────────
  const renderSidebar = () => (
    <View style={S.sidebar}>
      <View style={S.logoPill}>
        <View style={S.logoCircle}>
          <Text style={S.logoText}>LYDO</Text>
        </View>
      </View>
      <View style={{ height: 28 }} />
      {NAV_TABS.map(tab => {
        const active = activeTab === tab;
        return (
          <TouchableOpacity
            key={tab}
            style={[S.navItem, active && S.navItemActive]}
            onPress={() => handleNavPress(tab)}
            activeOpacity={0.8}
          >
            <Text style={[S.navLabel, active && S.navLabelActive]}>{tab}</Text>
          </TouchableOpacity>
        );
      })}
      <View style={{ height: 28 }} />
      <TouchableOpacity
        style={S.logoutBtn}
        onPress={handleLogout}
        activeOpacity={0.8}
      >
        <Text style={S.logoutText}>Logout</Text>
      </TouchableOpacity>
    </View>
  );

  // ── Main content ─────────────────────────────────────────────────────────────
  const renderContent = () => (
    <ScrollView
      style={[S.main, isMobile && S.mainMobile]}
      contentContainerStyle={S.mainContent}
      showsVerticalScrollIndicator={false}
    >
      {/* Mobile Header */}
      {isMobile && (
        <View style={S.mobileHeader}>
          <TouchableOpacity style={S.menuBtn} onPress={() => setSidebarVisible(true)}>
            <MenuIcon />
          </TouchableOpacity>
          <Text style={S.mobileTitle}>Budget Monitor</Text>
          <TouchableOpacity style={S.bellBtn}>
            <BellIcon hasNotif={notifCount > 0} />
          </TouchableOpacity>
        </View>
      )}

      {/* Desktop Header */}
      {!isMobile && (
        <View style={S.header}>
          <View>
            <Text style={S.headerSub}>SANGGUNIANG KABATAAN FEDERATION</Text>
            <Text style={S.headerTitle}>RIZAL, LAGUNA</Text>
          </View>
          <TouchableOpacity style={S.bellBtn} activeOpacity={0.7}>
            <BellIcon hasNotif={notifCount > 0} />
            {notifCount > 0 && (
              <View style={S.notifBadge}>
                <Text style={S.notifBadgeText}>{notifCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* ── Monitor Tabs ── */}
      <View style={S.monitorTabBar}>
        {MONITOR_TABS.map(tab => {
          const active = activeMonitorTab === tab;
          return (
            <TouchableOpacity
              key={tab}
              style={[S.monitorTab, active && S.monitorTabActive]}
              onPress={() => handleMonitorTabPress(tab)}
              activeOpacity={0.75}
            >
              <Text style={[S.monitorTabText, active && S.monitorTabTextActive]}>{tab}</Text>
            </TouchableOpacity>
          );
        })}
        <View style={S.monitorTabFiller} />
      </View>

      {/* ── Filter Row: Search + Submitted + Set Budget ── */}
      <View style={S.filterRow}>
        {/* Search */}
        <View style={S.searchBox}>
          <Text style={{ fontSize: 12, marginRight: 5 }}></Text>
          <TextInput
            style={S.searchInput}
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

        {/* Filler / indicator strip — matches screenshot's blue bar left of Submitted */}
        <View style={S.indicatorStrip} />

        {/* "Submitted" toggle — gold when active */}
        <TouchableOpacity
          style={[
            S.filterToggleBtn,
            budgetFilter === 'submitted' ? S.filterSubmittedOn : S.filterToggleOff,
          ]}
          onPress={() => setBudgetFilter('submitted')}
          activeOpacity={0.8}
        >
          <Text style={[S.filterToggleText, { color: budgetFilter === 'submitted' ? COLORS.darkText : COLORS.subText }]}>
            Submitted
          </Text>
        </TouchableOpacity>

        {/* "Set Budget" toggle — navy when active */}
        <TouchableOpacity
          style={[
            S.filterToggleBtn,
            budgetFilter === 'set' ? S.filterSetBudgetOn : S.filterToggleOff,
          ]}
          onPress={() => setBudgetFilter('set')}
          activeOpacity={0.8}
        >
          <Text style={[S.filterToggleText, { color: budgetFilter === 'set' ? COLORS.white : COLORS.subText }]}>
            Set Budget
          </Text>
        </TouchableOpacity>
      </View>

      {/* ── Table ── */}
      <View style={S.tableContainer}>
        {/* Header */}
        <View style={S.tableHeader}>
          <View style={S.colBarangay}>
            <Text style={S.tableHeaderText}>Barangay</Text>
          </View>
          <View style={S.colDocument}>
            <Text style={S.tableHeaderText}>Document</Text>
          </View>
          <View style={S.colDateTime} />
          <View style={S.colAction} />
        </View>

        {/* Rows */}
        {rows.length === 0 ? (
          <View style={S.emptyState}>
            <Text style={S.emptyText}>No records found.</Text>
          </View>
        ) : (
          rows.map((item, idx) => (
            <TableRow
              key={item.id}
              item={item}
              isEven={idx % 2 !== 0}
              budgetFilter={budgetFilter}
              onView={setViewingItem}
              onSetBudget={setSetBudgetItem}
            />
          ))
        )}
      </View>
    </ScrollView>
  );

  return (
    <SafeAreaView style={S.safe}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.navy} />

      <View style={S.layout}>
        {isMobile && sidebarVisible && (
          <TouchableOpacity
            style={S.sidebarOverlay}
            onPress={() => setSidebarVisible(false)}
            activeOpacity={1}
          />
        )}
        {(!isMobile || sidebarVisible) && renderSidebar()}
        {renderContent()}
      </View>

      {/* Document Viewer Modal */}
      {viewingItem && (
        <BudgetDocumentViewer
          item={viewingItem}
          onClose={() => setViewingItem(null)}
        />
      )}

      {/* Set Budget Modal */}
      {setBudgetItem && (
        <SetBudgetModal
          visible={!!setBudgetItem}
          item={setBudgetItem}
          onClose={() => setSetBudgetItem(null)}
          onSave={(updated) => {
            Alert.alert('Budget Set', `Budget for ${updated.barangay} set to ${updated.amount}`);
            setSetBudgetItem(null);
          }}
        />
      )}
    </SafeAreaView>
  );
}

// ─── STYLES ───────────────────────────────────────────────────────────────────
const S = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: COLORS.navy },
  layout: { flex: 1, flexDirection: 'row' },
  sidebar: {
    width: 250, backgroundColor: COLORS.navy,
    alignItems: 'center', paddingTop: 20, paddingBottom: 24, paddingHorizontal: 10, zIndex: 10,
  },
  sidebarOverlay: { position: 'absolute', left: 0, top: 0, bottom: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 5 },
  logoPill: { width: 70, height: 70, borderRadius: 35, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center', marginBottom: 8, borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)' },
  logoCircle: { width: 52, height: 52, borderRadius: 26, backgroundColor: COLORS.gold, alignItems: 'center', justifyContent: 'center' },
  logoText: { fontSize: 14, fontWeight: '900', color: COLORS.navy, letterSpacing: 0.5 },
  navItem: { width: '100%', paddingVertical: 12, paddingHorizontal: 12, borderRadius: 24, marginBottom: 8, alignItems: 'center', borderWidth: 1.5, borderColor: COLORS.white, backgroundColor: COLORS.navy },
  navItemActive: { backgroundColor: COLORS.white, borderColor: COLORS.white },
  navLabel: { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.8)', letterSpacing: 0.3 },
  navLabelActive: { color: '#000', fontWeight: '800' },
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
  // Main
  main: { flex: 1, backgroundColor: COLORS.offWhite, borderTopLeftRadius: 20 },
  mainMobile: { borderTopLeftRadius: 0 },
  mainContent: { padding: 20, paddingBottom: 40 },

  // Mobile Header
  mobileHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: COLORS.lightGray },
  menuBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.cardBg, alignItems: 'center', justifyContent: 'center' },
  menuIconContainer: { width: 20, height: 16, justifyContent: 'space-between' },
  menuLine: { width: 20, height: 2, backgroundColor: COLORS.navy, borderRadius: 1 },
  mobileTitle: { fontSize: 18, fontWeight: '800', color: COLORS.darkText },

  // Desktop Header
  header: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 },
  headerSub: { fontSize: 10, fontWeight: '600', color: COLORS.subText, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 2 },
  headerTitle: { fontSize: 20, fontWeight: '900', color: COLORS.darkText, letterSpacing: 0.5 },

  // Bell
  bellBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.cardBg, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 6, elevation: 3 },
  bellWrapper: { width: 20, height: 22, alignItems: 'center' },
  bellBody: { width: 14, height: 12, borderRadius: 7, borderWidth: 2, borderColor: '#8B0000', marginTop: 4 },
  bellBottom: { width: 8, height: 4, borderBottomLeftRadius: 4, borderBottomRightRadius: 4, backgroundColor: '#8B0000', marginTop: -1 },
  bellDot: { position: 'absolute', top: 0, right: 1, width: 7, height: 7, borderRadius: 4, backgroundColor: COLORS.gold, borderWidth: 1.5, borderColor: COLORS.cardBg },
  notifBadge: { position: 'absolute', top: -2, right: -2, width: 16, height: 16, borderRadius: 8, backgroundColor: COLORS.gold, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: COLORS.white },
  notifBadgeText: { fontSize: 8, fontWeight: '900', color: COLORS.navy },

  // Monitor Tab Bar
  monitorTabBar: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: COLORS.lightGray, marginBottom: 14 },
  monitorTab: { paddingHorizontal: isMobile ? 8 : 18, paddingVertical: 10, borderBottomWidth: 2, borderBottomColor: 'transparent', marginBottom: -1 },
  monitorTabActive: { backgroundColor: COLORS.gold, borderRadius: 4, borderBottomColor: COLORS.gold },
  monitorTabText: { fontSize: isMobile ? 10 : 13, fontWeight: '600', color: COLORS.subText },
  monitorTabTextActive: { color: COLORS.darkText, fontWeight: '800' },
  monitorTabFiller: { flex: 1 },

  // Filter Row
  filterRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14, flexWrap: 'wrap' },
  searchBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.white, borderRadius: 20, borderWidth: 1, borderColor: COLORS.lightGray, paddingHorizontal: 12, paddingVertical: 7, minWidth: 120, maxWidth: 190 },
  searchInput: { flex: 1, fontSize: 12, color: COLORS.darkText },

  // Blue indicator strip (between search and Submitted — matches screenshot)
  indicatorStrip: { width: 36, height: 32, borderRadius: 6, backgroundColor: COLORS.navy },

  // Filter toggle buttons
  filterToggleBtn: { borderRadius: 20, paddingHorizontal: isMobile ? 10 : 16, paddingVertical: 8 },
  filterSubmittedOn: { backgroundColor: COLORS.gold },     // gold — active Submitted
  filterSetBudgetOn: { backgroundColor: COLORS.navy },     // navy — active Set Budget
  filterToggleOff:   { backgroundColor: COLORS.lightGray, borderWidth: 1, borderColor: '#D0D0D0' },
  filterToggleText: { fontSize: isMobile ? 10 : 12, fontWeight: '700' },

  // Table
  tableContainer: { backgroundColor: COLORS.white, borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: COLORS.lightGray, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6 },
  tableHeader: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.white, paddingVertical: 11, paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: COLORS.lightGray },
  tableHeaderText: { fontSize: isMobile ? 10 : 12, fontWeight: '700', color: COLORS.darkText },
  tableRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: COLORS.lightGray, backgroundColor: COLORS.white },
  tableRowEven: { backgroundColor: '#FAFAFA' },
  colBarangay: { width: isMobile ? 90 : 160, paddingRight: 8 },
  colDocument: { flex: 1, paddingRight: 8 },
  colDateTime: { width: isMobile ? 65 : 110, alignItems: 'flex-end', paddingRight: 8 },
  colAction:   { width: 50, alignItems: 'center' },
  cellBarangay: { fontSize: isMobile ? 10 : 12, fontWeight: '600', color: COLORS.darkText },
  cellDocument: { fontSize: isMobile ? 10 : 11, color: COLORS.subText, lineHeight: 16 },
  cellTime:     { fontSize: 9, color: COLORS.subText, textAlign: 'right' },
  cellDate:     { fontSize: 9, color: COLORS.subText, textAlign: 'right' },
  viewBtn: { backgroundColor: COLORS.navy, borderRadius: 6, paddingHorizontal: isMobile ? 6 : 10, paddingVertical: 5 },
  viewBtnText: { fontSize: 9, fontWeight: '700', color: COLORS.white },
  emptyState: { alignItems: 'center', paddingVertical: 40 },
  emptyText:  { fontSize: 14, color: COLORS.midGray },
});