import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, ScrollView, TouchableOpacity,
  StyleSheet, SafeAreaView, StatusBar, Dimensions,
  Modal, Alert, KeyboardAvoidingView, Platform, Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import Head from 'expo-router/head';
import { useNav } from './navContext';
import Sidebar, { LYDO_NAV_ITEMS } from './../components/Sidebar';
import { useAuth } from './authContext';
import { useLydoNotificationCenter, LydoNotificationModal, LydoBellIcon } from './notificationCenter';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
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
  maroon:    '#8B0000',
};

const MONITOR_TABS = ['Consultation', 'Budget', 'Report', 'Deadlines'];

// ─── FLOW STEPS ───────────────────────────────────────────────────────────────
// step 1 → Submitted Budget  (Barangay | Document | time/date | View)
// step 2 → Review Summary    (Barangay | Annual Budget)
// step 3 → Send to SK        (same as step 2 + Save / Forward buttons)
const STEPS = [
  { id: 1, label: 'Submitted Budget' },
  { id: 2, label: 'Review Summary'   },
  { id: 3, label: 'Send to SK'       },
];

// ─── DATA ─────────────────────────────────────────────────────────────────────
const BUDGET_ROWS = [
  {
    id: '1', barangay: 'Barangay San Jose',
    document: 'SK Annual Budget',
    time: '3:00 PM', date: '1/02/2026',
    annualBudget: '258,000 pesos',
  },
  {
    id: '2', barangay: 'Barangay San Roque',
    document: 'SK Annual Budget',
    time: '3:00 PM', date: '1/02/2026',
    annualBudget: '380,000 pesos',
  },
  {
    id: '3', barangay: 'Barangay Santo Cristo',
    document: 'SK Annual Budget',
    time: '3:00 PM', date: '1/02/2026',
    annualBudget: '253,000 pesos',
  },
];

// ─── ICONS ────────────────────────────────────────────────────────────────────
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
            { label: '💾  Save',   action: onSave   },
            { label: '✏️  Edit',   action: onEdit   },
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
  wrap: { position: 'relative', zIndex: 9999, elevation: 9999 },
  btn:  { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.lightGray, alignItems: 'center', justifyContent: 'center' },
  dots: { fontSize: 14, fontWeight: '900', color: COLORS.darkText, letterSpacing: 2 },
  menu: {
    position: 'absolute', top: 42, right: 0,
    backgroundColor: COLORS.white, borderRadius: 10, width: 140, elevation: 9999,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 8,
    borderWidth: 1, borderColor: COLORS.lightGray, zIndex: 9999,
  },
  item:       { paddingHorizontal: 16, paddingVertical: 13 },
  itemBorder: { borderBottomWidth: 1, borderBottomColor: COLORS.lightGray },
  itemText:   { fontSize: 13, fontWeight: '600', color: COLORS.darkText },
});

// ─── STEP INDICATOR ───────────────────────────────────────────────────────────
const StepIndicator = ({ currentStep, onStepPress }) => (
  <View style={S.stepRow}>
    {STEPS.map((step, idx) => {
      const isActive   = currentStep === step.id;
      const isComplete = currentStep > step.id;
      const isLast     = idx === STEPS.length - 1;

      return (
        <View key={step.id} style={S.stepItem}>
          <TouchableOpacity
            style={S.stepLabelRow}
            onPress={() => currentStep >= step.id && onStepPress(step.id)}
            activeOpacity={0.7}
          >
            <View style={[
              S.stepCircle,
              isActive   && S.stepCircleActive,
              isComplete && S.stepCircleComplete,
            ]}>
              {isComplete
                ? <Text style={S.stepCheckmark}>✓</Text>
                : <Text style={[S.stepNum, isActive && S.stepNumActive]}>{step.id}</Text>
              }
            </View>
            <Text style={[
              S.stepLabel,
              isActive   && S.stepLabelActive,
              isComplete && S.stepLabelComplete,
            ]}>
              {step.label}
            </Text>
          </TouchableOpacity>

          {/* Connector line (not after last) */}
          {!isLast && (
            <View style={S.stepLineWrap}>
              <View style={[S.stepLine, isComplete && S.stepLineFilled]} />
            </View>
          )}
        </View>
      );
    })}
  </View>
);

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
            <Text style={DV.sheetTitle} numberOfLines={1}>
              {item.document} — {item.barangay}
            </Text>
            <ThreeDotMenu
              onSave={() => Alert.alert('Saved', 'Document saved.')}
              onEdit={() => Alert.alert('Edit', 'Edit mode not available in view.')}
              onReturn={onClose}
            />
          </View>

          <ScrollView contentContainerStyle={DV.docPage} showsVerticalScrollIndicator={false}>
            <View style={DV.paper}>
              <Text style={DV.paperCenter}>Barangay ___________________</Text>
              <Text style={DV.paperCenter}>Sangguniang Kabataan</Text>
              <Text style={[DV.paperCenter, DV.bold, { marginTop: 10 }]}>SK ANNUAL BUDGET</Text>
              <Text style={[DV.paperCenter, { marginBottom: 14 }]}>Fiscal Year: 2026</Text>

              <View style={DV.table}>
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
  overlay:    { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' },
  sheet:      { backgroundColor: COLORS.offWhite, borderTopLeftRadius: 20, borderTopRightRadius: 20, height: SCREEN_HEIGHT * 0.92, zIndex: 1 },
  topBar:     { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.white, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.lightGray, gap: 10 },
  backBtn:    { paddingHorizontal: 4 },
  backText:   { fontSize: 13, color: COLORS.navy, fontWeight: '700' },
  sheetTitle: { flex: 1, fontSize: 13, fontWeight: '700', color: COLORS.darkText },
  docPage:    { padding: 20, paddingBottom: 100 },
  paper:      { backgroundColor: COLORS.white, borderRadius: 8, padding: 20, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6 },
  paperCenter:{ textAlign: 'center', fontSize: 11, color: COLORS.darkText, marginBottom: 4 },
  bold:       { fontWeight: '800', letterSpacing: 0.5 },
  table:      { borderWidth: 1, borderColor: '#ccc', marginTop: 14, borderRadius: 4, overflow: 'hidden' },
  tRow:       { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#e0e0e0' },
  tCell:      { flex: 1, paddingVertical: 7, paddingHorizontal: 8, fontSize: 10, color: COLORS.darkText, borderRightWidth: 1, borderRightColor: '#e0e0e0' },
  tHead:      { fontWeight: '700', fontSize: 10, color: '#333' },
  sigRow:     { flexDirection: 'row', justifyContent: 'space-around', marginTop: 24, marginBottom: 8 },
  sigBlock:   { alignItems: 'center', gap: 4 },
  sigLine:    { width: 100, height: 1, backgroundColor: COLORS.darkText },
  sigLabel:   { fontSize: 9, color: COLORS.subText },
  bottomBar:  { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: COLORS.white, borderTopWidth: 1, borderTopColor: COLORS.lightGray, paddingHorizontal: 20, paddingVertical: 12, alignItems: 'center' },
  approveBtn: { backgroundColor: COLORS.navy, borderRadius: 10, paddingVertical: 12, paddingHorizontal: 40 },
  approveBtnText: { color: COLORS.white, fontWeight: '800', fontSize: 14 },
});

// ─── MAIN SCREEN ──────────────────────────────────────────────────────────────
export default function LYDOMonitorBudgetScreen() {
  const router = useRouter();
  const { activeTab, setActiveTab } = useNav();
  const { logout } = useAuth();

  const [activeMonitorTab, setActiveMonitorTab] = useState('Budget');
  const [currentStep, setCurrentStep]           = useState(1);   // 1 | 2 | 3
  const [searchText, setSearchText]             = useState('');
  const notif = useLydoNotificationCenter();
  const [sidebarVisible, setSidebarVisible]     = useState(false);
  const [currentTime, setCurrentTime]           = useState('');

  const today = new Date().toLocaleDateString('en-PH', {
    timeZone: 'Asia/Manila', month: 'long', day: 'numeric', year: 'numeric',
  });

  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString('en-PH', {
          timeZone: 'Asia/Manila',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        })
      );
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, []);
  const [viewingItem, setViewingItem]           = useState(null);

  const handleNav = (tab) => {
    setActiveTab(tab);
    setSidebarVisible(false);
    if (tab === 'Dashboard') router.push('/(tabs)/lydo-dashboard');
    else if (tab === 'Documents') router.push('/(tabs)/lydo-document');
    else if (tab === 'Monitor') router.push('/(tabs)/lydo-monitor');
    else if (tab === 'Barangay') router.push('/(tabs)/lydo-accounts');
    else if (tab === 'Logs') router.push('/(tabs)/lydo-logs');
  };

  const handleLogout = () => {
    logout();
    router.replace('/');
  };

  const handleMonitorTabPress = (tab) => {
    if (tab === 'Report') { router.push('/(tabs)/lydo-monitor-report'); return; }
    if (tab === 'Consultation') { router.push('/(tabs)/lydo-monitor'); return; }
    if (tab !== 'Budget') { handleNav('Monitor'); return; }
    if (tab === 'Deadlines') { router.push('/(tabs)/lydo-monitor-deadlines'); return; }
    setActiveMonitorTab(tab);
    setCurrentStep(1);
    setSearchText('');
  };

  // Filtered rows (search only on step 1)
  const rows = BUDGET_ROWS.filter(r =>
    currentStep !== 1 || (
      r.barangay.toLowerCase().includes(searchText.toLowerCase()) ||
      r.document.toLowerCase().includes(searchText.toLowerCase())
    )
  );

  // ── STEP 1: Submitted Budget table ───────────────────────────────────────────
  const renderStep1 = () => (
    <View style={S.tableContainer}>
      {/* Header */}
      <View style={S.tableHeader}>
        <View style={S.colBarangay}><Text style={S.tableHeaderText}>Barangay</Text></View>
        <View style={S.colDocument}><Text style={S.tableHeaderText}>Document</Text></View>
        <View style={S.colDateTime} />
        <View style={S.colAction} />
      </View>
      {rows.length === 0 ? (
        <View style={S.emptyState}><Text style={S.emptyText}>No records found.</Text></View>
      ) : rows.map((item, idx) => (
        <View key={item.id} style={[S.tableRow, idx % 2 === 1 && S.tableRowEven]}>
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
            <TouchableOpacity
              style={S.viewBtn}
              onPress={() => setViewingItem(item)}
              activeOpacity={0.75}
            >
              <Text style={S.viewBtnText}>View</Text>
            </TouchableOpacity>
          </View>
        </View>
      ))}
    </View>
  );

  // ── STEP 2 & 3: Review Summary / Send to SK table ─────────────────────────
  const renderSummaryTable = () => (
    <View style={S.tableContainer}>
      <View style={S.tableHeader}>
        <View style={S.colBarangay}><Text style={S.tableHeaderText}>Barangay</Text></View>
        <View style={S.colBudget}>
          <Text style={[S.tableHeaderText, { textAlign: 'right' }]}>Annual Budget</Text>
        </View>
      </View>
      {rows.map((item, idx) => (
        <View key={item.id} style={[S.tableRow, idx % 2 === 1 && S.tableRowEven]}>
          <View style={S.colBarangay}>
            <Text style={S.cellBarangay}>{item.barangay}</Text>
          </View>
          <View style={S.colBudget}>
            <Text style={S.cellBudget}>{item.annualBudget}</Text>
          </View>
        </View>
      ))}
    </View>
  );

  // ── Main Content ─────────────────────────────────────────────────────────────
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
              <TouchableOpacity style={styles.bellBtn} activeOpacity={0.7} onPress={notif.open}>
                <LydoBellIcon count={notif.count} />
              </TouchableOpacity>
        </View>
      )}

      {/* Desktop Header */}
      {!isMobile && (
        <View style={S.header}>
          <View>
            <Text style={S.headerSub}>SANGGUNIANG KABATAAN FEDERATION</Text>
            <Text style={S.headerTitle}>RIZAL, LAGUNA</Text>
            <Text style={S.headerDesc}>
              SK Full Disclosure Policy Compliance Portal for the Submission and Validation{'\n'}of Statutory Financial Reports and Developmental Plans
            </Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={S.datetimeCard}>
              <View style={S.datetimeRow}>
                <View style={S.datetimeDivider} />
                <View style={S.datetimeBlock}>
                  <Text style={S.datetimeLabel}>DATE</Text>
                  <Text style={S.datetimeValue}>{today}</Text>
                </View>
                <View style={S.datetimeSeparator} />
                <View style={[S.datetimeDivider, { backgroundColor: '#22C55E' }]} />
                <View style={S.datetimeBlock}>
                  <Text style={S.datetimeLabel}>TIME (PHT)</Text>
                  <Text style={[S.datetimeValue, S.datetimeTime]}>{currentTime}</Text>
                </View>
              </View>
            </View>
              <TouchableOpacity style={styles.bellBtn} activeOpacity={0.7} onPress={notif.open}>
                <LydoBellIcon count={notif.count} />
              </TouchableOpacity>
          </View>
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
      </View>

      {/* ── Top Control Row: Search (step 1) + Section Title + Step 3 actions ── */}
      <View style={S.topControlRow}>
        {/* Search — only on step 1 */}
        {currentStep === 1 ? (
          <View style={S.searchBox}>
            <Text style={{ fontSize: 12, marginRight: 4 }}>🔍</Text>
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
        ) : (
          <View style={{ flex: 1 }} />
        )}

        {/* Section label */}
        <Text style={S.sectionLabel}>Setting Annual Budget</Text>

        {/* Step 3 Save / Forward actions — inline right of title */}
        {currentStep === 3 && (
          <View style={S.step3Actions}>
            <TouchableOpacity
              style={S.saveBtn}
              onPress={() => Alert.alert('Saved', 'Budget summary saved.')}
              activeOpacity={0.85}
            >
              <Text style={S.saveBtnText}>Save  💾</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={S.forwardBtn}
              onPress={() => Alert.alert('Forwarded', 'Budget sent to SK Chairperson.')}
              activeOpacity={0.85}
            >
              <Text style={S.forwardBtnText}>Forward  ➤</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* ── Step Indicator ── */}
      <View style={S.stepWrap}>
        <StepIndicator currentStep={currentStep} onStepPress={setCurrentStep} />
      </View>

      {/* ── Table ── */}
      {currentStep === 1 ? renderStep1() : renderSummaryTable()}

      {/* ── Next Step Button (steps 1 and 2 only) ── */}
      {currentStep < 3 && (
        <TouchableOpacity
          style={S.nextBtn}
          onPress={() => setCurrentStep(s => s + 1)}
          activeOpacity={0.85}
        >
          <Text style={S.nextBtnText}>
            {currentStep === 1 ? 'Proceed to Review Summary →' : 'Proceed to Send to SK →'}
          </Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );

  return (
    <>
      <Head>
        <title>LYDO Budget Monitor · SK Monitoring</title>
      </Head>
      <SafeAreaView style={S.safe}>
        <StatusBar barStyle="light-content" backgroundColor={COLORS.navy} />

        {/* Notification Modal — lists documents sent by SK officials */}
        <LydoNotificationModal
          {...notif.modalProps}
          onReview={(doc) => {
            notif.close();
            router.push({
              pathname: '/(tabs)/lydo-monitor',
              params: { viewFilter: 'submitted' },
            });
          }}
        />

        <View style={S.layout}>
          {/* Mobile: Sidebar as overlay */}
          {isMobile && sidebarVisible && (
            <TouchableOpacity
              style={S.sidebarOverlay}
              activeOpacity={1}
              onPress={() => setSidebarVisible(false)}
            />
          )}

          <Sidebar
            activeTab={activeTab}
            onNavPress={handleNav}
            onLogout={handleLogout}
            isMobile={isMobile}
            sidebarVisible={sidebarVisible}
            navItems={LYDO_NAV_ITEMS}
            logoSource={require('./../../assets/images/lydo-logo.png')}
          />

          {renderContent()}
        </View>

        {/* Document Viewer Modal */}
        {viewingItem && (
          <BudgetDocumentViewer
            item={viewingItem}
            onClose={() => setViewingItem(null)}
          />
        )}
      </SafeAreaView>
    </>
  );
}

// ─── STYLES ───────────────────────────────────────────────────────────────────
const S = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: COLORS.navy },
  layout: { flex: 1, flexDirection: 'row' },

  sidebarOverlay: {
    position: 'absolute', left: 0, top: 0, bottom: 0, right: 0,
    backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 5,
  },

  // Main
  main:        { flex: 1, backgroundColor: COLORS.offWhite, borderTopLeftRadius: 20 },
  mainMobile:  { borderTopLeftRadius: 0 },
  mainContent: { padding: isMobile ? 12 : 20, paddingBottom: 40 },

  // Mobile Header
  mobileHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: COLORS.lightGray },
  menuBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.cardBg, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, elevation: 2 },
  menuIconContainer: { width: 18, height: 14, justifyContent: 'space-between' },
  menuLine:    { width: 18, height: 2, backgroundColor: COLORS.navy, borderRadius: 1 },
  mobileTitle: { fontSize: 16, fontWeight: '800', color: COLORS.darkText },

  // Desktop Header
  header:    { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 },
  headerSub: { fontSize: 10, fontWeight: '600', color: COLORS.subText, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 2 },
  headerTitle: { fontSize: 20, fontWeight: '900', color: COLORS.darkText, letterSpacing: 0.5 },
  headerDesc: { fontSize: 15, fontWeight: '700', color: COLORS.darkText, marginTop: 6, lineHeight: 17 },

  // Datetime card
  datetimeCard: { backgroundColor: '#F7F5F2', borderRadius: 12, paddingVertical: 10, paddingHorizontal: 16, borderWidth: 1, borderColor: '#E0DDD9', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  datetimeRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  datetimeSeparator: { width: 1, height: 36, backgroundColor: '#D0CCC8', marginHorizontal: 4 },
  datetimeDivider: { width: 3, height: 28, borderRadius: 2, backgroundColor: '#133E75' },
  datetimeBlock: { flexDirection: 'column' },
  datetimeLabel: { fontSize: 9, fontWeight: '700', color: '#666666', letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 1 },
  datetimeValue: { fontSize: 13, fontWeight: '700', color: '#1A1A1A', letterSpacing: 0.2 },
  datetimeTime: { fontVariant: ['tabular-nums'], color: '#133E75', fontSize: 14, fontWeight: '800' },

  // Bell
  bellBtn:   { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.cardBg, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 6, elevation: 3 },
  notifBadge:    { position: 'absolute', top: -2, right: -2, width: 16, height: 16, borderRadius: 8, backgroundColor: COLORS.gold, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: COLORS.white },
  notifBadgeText:{ fontSize: 8, fontWeight: '900', color: COLORS.navy },

  // Monitor Tabs
  monitorTabBar: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: COLORS.lightGray, marginBottom: 14, overflowX: 'hidden', overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.30, shadowRadius: 3, elevation: 6,},
  monitorTab: { flex: 1, paddingHorizontal: isMobile ? 8 : 40, backgroundColor: COLORS.navy, paddingVertical: 10, borderBottomWidth: 0, borderBottomColor: 'transparent', marginBottom: -1, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', alignItems: 'center' },
  monitorTabActive: { backgroundColor: COLORS.gold, borderRadius: 4, borderBottomColor: COLORS.gold, borderColor: COLORS.gold, shadowColor: COLORS.gold, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.4, shadowRadius: 4, elevation: 3 },
  monitorTabText: { fontSize: isMobile ? 10 : 13, fontWeight: '600', color: COLORS.white },
  monitorTabTextActive: { color: COLORS.darkText, fontWeight: '800' },

  // Top control row
  topControlRow: {
    flexDirection: 'row', alignItems: 'center',
    marginBottom: 12, gap: 8, flexWrap: 'wrap',
  },
  searchBox: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.white, borderRadius: 20,
    borderWidth: 1, borderColor: COLORS.lightGray,
    paddingHorizontal: 10, paddingVertical: 6,
    width: isMobile ? 120 : 180,
  },
  searchInput: { flex: 1, fontSize: 11, color: COLORS.darkText },
  sectionLabel: {
    fontSize: isMobile ? 12 : 14, fontWeight: '700', color: COLORS.darkText,
  },

  // Step 3 inline actions
  step3Actions: {
    flexDirection: 'row', gap: 6, marginLeft: 'auto',
  },
  saveBtn: {
    paddingHorizontal: isMobile ? 10 : 12, paddingVertical: 6,
    borderRadius: 8, borderWidth: 1.5, borderColor: COLORS.navy,
    backgroundColor: COLORS.white,
  },
  saveBtnText: { fontSize: 10, fontWeight: '700', color: COLORS.navy },
  forwardBtn: {
    paddingHorizontal: isMobile ? 10 : 12, paddingVertical: 6,
    borderRadius: 8, backgroundColor: COLORS.navy,
  },
  forwardBtnText: { fontSize: 10, fontWeight: '700', color: COLORS.white },

  // Step Indicator wrapper
  stepWrap: {
    marginBottom: 16,
    backgroundColor: COLORS.white, borderRadius: 12,
    paddingHorizontal: isMobile ? 8 : 16, paddingVertical: 14,
    borderWidth: 1, borderColor: COLORS.lightGray, elevation: 1,
  },
  stepRow:     { flexDirection: 'row', alignItems: 'center' },
  stepItem:    { flexDirection: 'row', alignItems: 'center', flex: 1 },
  stepLabelRow:{ flexDirection: 'row', alignItems: 'center', gap: isMobile ? 4 : 6 },
  stepCircle:  {
    width: isMobile ? 20 : 22, height: isMobile ? 20 : 22, borderRadius: isMobile ? 10 : 11,
    borderWidth: 2, borderColor: COLORS.midGray,
    backgroundColor: COLORS.white, alignItems: 'center', justifyContent: 'center',
  },
  stepCircleActive:  { borderColor: COLORS.navy, backgroundColor: COLORS.navy },
  stepCircleComplete:{ borderColor: COLORS.navy, backgroundColor: COLORS.navy },
  stepNum:        { fontSize: isMobile ? 9 : 10, fontWeight: '700', color: COLORS.midGray },
  stepNumActive:  { color: COLORS.white },
  stepCheckmark:  { fontSize: isMobile ? 9 : 10, color: COLORS.white, fontWeight: '900' },
  stepLabel:      { fontSize: isMobile ? 8 : 11, color: COLORS.midGray, fontWeight: '500' },
  stepLabelActive:   { color: COLORS.navy, fontWeight: '800' },
  stepLabelComplete: { color: COLORS.navy, fontWeight: '700' },
  stepLineWrap: { flex: 1, paddingHorizontal: isMobile ? 3 : 6 },
  stepLine:       { height: 1.5, backgroundColor: COLORS.midGray, flex: 1 },
  stepLineFilled: { backgroundColor: COLORS.navy },

  // Next button
  nextBtn: {
    marginTop: 16,
    alignSelf: isMobile ? 'stretch' : 'flex-end',
    backgroundColor: COLORS.navy,
    borderRadius: 10, paddingHorizontal: 18, paddingVertical: 11,
    alignItems: 'center',
  },
  nextBtnText: { fontSize: isMobile ? 12 : 13, fontWeight: '700', color: COLORS.white },

  // Table
  tableContainer: { backgroundColor: COLORS.white, borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: COLORS.lightGray, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6 },
  tableHeader:    { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.white, paddingVertical: 9, paddingHorizontal: 10, borderBottomWidth: 1, borderBottomColor: COLORS.lightGray },
  tableHeaderText:{ fontSize: isMobile ? 9 : 12, fontWeight: '700', color: COLORS.darkText },
  tableRow:       { flexDirection: 'row', alignItems: 'center', paddingVertical: 9, paddingHorizontal: 10, borderBottomWidth: 1, borderBottomColor: COLORS.lightGray, backgroundColor: COLORS.white },
  tableRowEven:   { backgroundColor: '#FAFAFA' },

  // Step 1 columns
  colBarangay: { width: isMobile ? 85 : 180, paddingRight: 6 },
  colDocument: { flex: 1, paddingRight: 6 },
  colDateTime: { width: isMobile ? 60 : 110, alignItems: 'flex-end', paddingRight: 6 },
  colAction:   { width: 48, alignItems: 'center' },

  // Step 2/3 columns
  colBudget: { flex: 1, alignItems: 'flex-end', paddingRight: 8 },

  cellBarangay: { fontSize: isMobile ? 10 : 13, fontWeight: '600', color: COLORS.darkText },
  cellDocument: { fontSize: isMobile ? 9 : 12, color: COLORS.subText },
  cellTime:     { fontSize: 9, color: COLORS.subText, textAlign: 'right' },
  cellDate:     { fontSize: 9, color: COLORS.subText, textAlign: 'right' },
  cellBudget:   { fontSize: isMobile ? 10 : 13, color: COLORS.darkText, fontWeight: '500', textAlign: 'right' },

  viewBtn:     { backgroundColor: COLORS.navy, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 5 },
  viewBtnText: { fontSize: 10, fontWeight: '700', color: COLORS.white },

  emptyState: { alignItems: 'center', paddingVertical: 40 },
  emptyText:  { fontSize: 14, color: COLORS.midGray },
});