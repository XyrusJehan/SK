import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  Alert,
  Dimensions,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useNav } from './navContext';
import { useAuth } from './authContext';
import { supabase } from '../../utils/supabase';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const isMobile = SCREEN_WIDTH < 768;

// ─── NAV TABS ─────────────────────────────────────────────────────────────────
const NAV_TABS = ['Dashboard', 'Documents', 'Monitor', 'Barangay'];

// ─── COLORS ───────────────────────────────────────────────────────────────────
const COLORS = {
  navy:       '#133E75',
  navyDark:   '#0D2B52',
  white:      '#FFFFFF',
  offWhite:   '#F5F7FA',
  lightGray:  '#E8ECF0',
  midGray:    '#B0B8C4',
  darkText:   '#1A2332',
  subText:    '#6B7A8F',
  green:      '#22C55E',
  greenLight: '#DCFCE7',
  orange:     '#F97316',
  orangeLight:'#FEF3C7',
  red:        '#EF4444',
  redLight:   '#FEE2E2',
  blue:       '#3B82F6',
  blueLight:  '#DBEAFE',
  yellow:     '#EAB308',
  yellowLight:'#FEF9C3',
  cardBg:     '#FFFFFF',
  borderColor:'#E2E8F0',
};

// ─── MOCK / STATIC DATA ───────────────────────────────────────────────────────
const MONITORING_TASKS = [
  { id: '1', description: 'Remind barangays with missing documents', action: 'Send Reminder', actionType: 'reminder' },
  { id: '2', description: 'Review submitted proposals of SK', action: 'Review Now', actionType: 'review', badge: 3 },
  { id: '3', description: 'Follow up near deadline submission', action: 'Send Reminder', actionType: 'reminder' },
  { id: '4', description: 'Review returned proposals of SK', action: 'Review Now', actionType: 'review' },
];

const APPROACHING_DEADLINES = [
  { id: '1', title: 'Approved Annual Budget', deadline: 'January 6, 2026', daysLeft: 1, submitted: 7, total: 11, pending: 4, urgent: true },
  { id: '2', title: 'Annual Budget Youth Investment Program', deadline: 'January 6, 2026', daysLeft: 10, submitted: 7, total: 11, pending: 4, urgent: false },
];

const QUICK_ACTIONS = [
  { id: 'consultation', label: 'Consultation', badge: 5, color: COLORS.navy, icon: '💬', route: null },
  { id: 'budget', label: 'View Budget', color: '#1A2332', icon: '📊', route: null },
  { id: 'export', label: 'Export  Reports', color: COLORS.navy, icon: '⬇', route: null },
  { id: 'calendar', label: 'View Deadline Calendar', color: '#F97316', icon: '📅', route: null },
  { id: 'missing', label: 'View Missing Documents', color: '#EF4444', icon: '📄', route: null },
  { id: 'archive', label: 'View Archive', color: '#6B7A8F', icon: '🗃', route: null },
  { id: 'task', label: 'Create Task', color: COLORS.navy, icon: null, route: null, fullWidth: true },
];

const COMPLIANCE_DATA = [
  { label: 'Fully Compliant', count: 6, color: COLORS.green },
  { label: 'With Missing Documents', count: 3, color: COLORS.orange },
  { label: 'Near Deadline', count: 1, color: COLORS.yellow },
  { label: 'Overdue', count: 1, color: COLORS.red },
];

// ─── ICON COMPONENTS ──────────────────────────────────────────────────────────
const MenuIcon = () => (
  <View style={ic.menuIconContainer}>
    <View style={ic.menuLine} />
    <View style={ic.menuLine} />
    <View style={ic.menuLine} />
  </View>
);

const ic = StyleSheet.create({
  menuIconContainer: { width: 20, height: 16, justifyContent: 'space-between' },
  menuLine: { width: 20, height: 2, backgroundColor: COLORS.navy, borderRadius: 1 },
});

// ─── DONUT CHART (SVG-free, CSS approximation) ────────────────────────────────
const DonutChart = ({ percentage }) => (
  <View style={styles.donutOuter}>
    <View style={styles.donutInner}>
      <Text style={styles.donutPercent}>{percentage}%</Text>
      <Text style={styles.donutLabel}>Completed</Text>
    </View>
  </View>
);

// ─── STAT CARD ────────────────────────────────────────────────────────────────
const StatCard = ({ icon, value, label, sub, iconBg, iconColor, borderColor }) => (
  <View style={[styles.statCard, borderColor ? { borderTopWidth: 3, borderTopColor: borderColor } : {}]}>
    <View style={styles.statCardTop}>
      <View style={[styles.statIconBox, { backgroundColor: iconBg || COLORS.blueLight }]}>
        <Text style={[styles.statIcon, { color: iconColor || COLORS.blue }]}>{icon}</Text>
      </View>
    </View>
    <Text style={styles.statValue}>{value}</Text>
    <Text style={styles.statLabel}>{label}</Text>
    {sub ? <Text style={styles.statSub}>{sub}</Text> : null}
  </View>
);

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
export default function LYDOHomeScreen() {
  const router = useRouter();
  const { activeTab, setActiveTab } = useNav();
  const { logout, user } = useAuth();

  const [sidebarVisible, setSidebarVisible] = useState(false);
  const [activities, setActivities] = useState([]);
  const [totalBarangays, setTotalBarangays] = useState(14);
  const [totalDocuments, setTotalDocuments] = useState(150);
  const [forRevision, setForRevision] = useState(7);
  const [approved, setApproved] = useState(4);
  const [missingDocs, setMissingDocs] = useState(3);

  useEffect(() => {
    if (user && user.role !== 'lydo') router.replace('/');
  }, [user]);

  useEffect(() => {
    setActiveTab('Dashboard');
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data: brgyData } = await supabase
          .from('barangays')
          .select('barangay_id', { count: 'exact' });
        if (brgyData) setTotalBarangays(brgyData.length || 0);

        const { data: docsData } = await supabase
          .from('documents')
          .select(`document_id, title, status, created_at, saved_at, submitted_at, barangay:barangays(barangay_name)`)
          .order('created_at', { ascending: false })
          .limit(10);

        if (docsData) {
          const formatted = docsData.map(doc => {
            let actionLabel = 'Created document';
            let actionType = 'create';
            let icon = '✎';
            if (doc.status === 'submitted' || doc.status === 'approved') {
              actionLabel = doc.status === 'approved' ? 'Approved Annual Budget' : 'Sent the ABYIP Template';
              actionType = 'approved';
              icon = doc.status === 'approved' ? '✔' : '▷';
            } else if (doc.status === 'returned') {
              actionLabel = 'Returned ABYIP Proposal';
              actionType = 'returned';
              icon = '↩';
            }
            const date = doc.submitted_at || doc.saved_at || doc.created_at;
            const dateObj = date ? new Date(date) : new Date();
            return {
              id: doc.document_id,
              label: actionLabel,
              barangay: doc.barangay?.barangay_name || 'Unknown Barangay',
              time: dateObj.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
              date: dateObj.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
              type: actionType,
              icon,
            };
          });
          setActivities(formatted);
        }
      } catch (e) {
        console.error(e);
      }
    };
    fetchData();
  }, []);

  const today = new Date().toLocaleDateString('en-US', { weekday: undefined, month: 'long', day: 'numeric', year: 'numeric' });

  const handleNav = (tab) => {
    setActiveTab(tab);
    setSidebarVisible(false);
    if (tab === 'Dashboard') router.push('/(tabs)/lydo-dashboard');
    else if (tab === 'Documents') router.push('/(tabs)/lydo-document');
    else if (tab === 'Monitor') router.push('/(tabs)/lydo-monitor');
        if (tab === 'Barangay') router.push('/(tabs)/lydo-accounts');
  };

  const handleLogout = () => { logout(); router.replace('/'); };

  const handleSendReminder = () => Alert.alert('Reminder Sent', 'All non-compliant barangays have been notified.');

  // ── SIDEBAR ──
  const renderSidebar = () => (
    <View style={styles.sidebar}>
      <View style={styles.logoPill}>
        <Image
          source={require('./../../assets/images/lydo-logo.png')}
          style={styles.logoImage}
          resizeMode="contain"
        />
      </View>
      <View style={styles.sidebarSpacer} />
      {NAV_TABS.map((tab) => {
        const active = activeTab === tab;
        return (
          <TouchableOpacity
            key={tab}
            style={[styles.navItem, active && styles.navItemActive]}
            onPress={() => handleNav(tab)}
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

  const activityIconColor = (type) => {
    if (type === 'approved') return COLORS.green;
    if (type === 'returned') return COLORS.orange;
    return COLORS.blue;
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.navy} />
      <View style={styles.layout}>
        {/* Sidebar overlay (mobile) */}
        {isMobile && sidebarVisible && (
          <TouchableOpacity style={styles.sidebarOverlay} activeOpacity={1} onPress={() => setSidebarVisible(false)} />
        )}
        {isMobile ? (sidebarVisible && renderSidebar()) : renderSidebar()}

        {/* ── MAIN CONTENT ── */}
        <ScrollView
          style={[styles.main, isMobile && styles.mainMobile]}
          contentContainerStyle={styles.mainContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Mobile Header */}
          {isMobile && (
            <View style={styles.mobileHeader}>
              <TouchableOpacity style={styles.menuBtn} onPress={() => setSidebarVisible(!sidebarVisible)}>
                <MenuIcon />
              </TouchableOpacity>
              <Text style={styles.mobileTitle}>LYDO Dashboard</Text>
              <View style={{ width: 40 }} />
            </View>
          )}

          {/* ── PAGE HEADER ── */}
          <View style={styles.pageHeader}>
            <View>
              <Text style={styles.headerSub}>SANGGUNIANG KABATAAN FEDERATION</Text>
              <Text style={styles.headerTitle}>RIZAL, LAGUNA</Text>
            </View>
            <Text style={styles.todayText}>Today: {today}</Text>
          </View>

          {/* ── STAT CARDS ROW ── */}
          <View style={isMobile ? styles.statsColumn : styles.statsRow}>
            <StatCard icon="👥" value={totalBarangays} label="Total Barangay" sub="This Fiscal Year" iconBg="#EFF6FF" iconColor={COLORS.navy} />
            <StatCard icon="📄" value={totalDocuments} label="Total Documents" sub="This Fiscal Year" iconBg="#F0FDF4" iconColor={COLORS.green} />
            <StatCard icon="✏️" value={forRevision} label="For Revision" iconBg="#FEF3C7" iconColor={COLORS.orange} />
            <StatCard icon="✅" value={approved} label="Approved" iconBg="#DCFCE7" iconColor={COLORS.green} />
            <StatCard icon="⚠️" value={missingDocs} label="Missing Documents" iconBg="#FEE2E2" iconColor={COLORS.red} borderColor={COLORS.red} />
          </View>

          {/* ── COMPLIANCE + PROGRESS ROW ── */}
          <View style={isMobile ? styles.twoColColumn : styles.twoColRow}>
            {/* Compliance Status */}
            <View style={[styles.card, styles.flex1]}>
              <Text style={styles.cardTitle}>Barangay Compliance Status</Text>
              <View style={styles.divider} />
              {COMPLIANCE_DATA.map((item) => (
                <View key={item.label} style={styles.complianceRow}>
                  <View style={[styles.complianceDot, { backgroundColor: item.color }]} />
                  <Text style={styles.complianceLabel}>{item.label}</Text>
                  <Text style={[styles.complianceCount, { color: item.color }]}>{item.count}</Text>
                </View>
              ))}
              <View style={styles.divider} />
              <Text style={styles.complianceTotal}>
                Total Barangays: {COMPLIANCE_DATA.reduce((s, i) => s + i.count, 0)}
              </Text>
            </View>

            {/* Submission Progress */}
            <View style={[styles.card, styles.flex1]}>
              <Text style={styles.cardTitle}>Submission Progress Overview</Text>
              <View style={styles.divider} />
              <View style={styles.progressContent}>
                <DonutChart percentage={72} />
                <View style={styles.progressLegend}>
                  {[
                    { label: 'Submitted', color: COLORS.green },
                    { label: 'Awaiting Submission', color: COLORS.yellow },
                    { label: 'Incomplete', color: COLORS.red },
                  ].map(l => (
                    <View key={l.label} style={styles.legendRow}>
                      <View style={[styles.legendDot, { backgroundColor: l.color }]} />
                      <Text style={styles.legendLabel}>{l.label}</Text>
                    </View>
                  ))}
                </View>
              </View>
            </View>
          </View>

          {/* ── APPROACHING DEADLINE ── */}
          <View style={styles.deadlineCard}>
            <View style={styles.deadlineHeader}>
              <View style={styles.deadlineHeaderLeft}>
                <Text style={styles.deadlineIcon}>⏰</Text>
                <Text style={styles.deadlineTitle}>Approaching Deadline</Text>
              </View>
              <TouchableOpacity>
                <Text style={styles.viewAll}>View All</Text>
              </TouchableOpacity>
            </View>
            {APPROACHING_DEADLINES.map((item) => (
              <View key={item.id} style={styles.deadlineRow}>
                <Text style={styles.deadlineDocTitle}>{item.title}</Text>
                <Text style={styles.deadlineDate}>
                  <Text style={styles.deadlineDateLabel}>Deadline: </Text>
                  {item.deadline}
                </Text>
                <Text style={[styles.daysLeft, item.urgent ? styles.daysLeftUrgent : styles.daysLeftNormal]}>
                  {item.daysLeft} Day{item.daysLeft !== 1 ? 's' : ''} Left
                </Text>
                <Text style={styles.deadlineStats}>
                  <Text style={styles.deadlineStatLabel}>Submitted: </Text>
                  <Text style={styles.deadlineStatValue}>{item.submitted}/{item.total}</Text>
                </Text>
                <Text style={styles.deadlineStats}>
                  <Text style={styles.deadlineStatLabel}>Pending: </Text>
                  <Text style={styles.deadlineStatValue}>{item.pending}/{item.total}</Text>
                </Text>
              </View>
            ))}
          </View>

          {/* ── BOTTOM TWO COLUMNS ── */}
          <View style={isMobile ? styles.twoColColumn : styles.twoColRow}>
            {/* Left: Monitoring Tasks + Recent Activity */}
            <View style={[styles.flex1_5, { gap: 14 }]}>
              {/* Monitoring Tasks */}
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Monitoring Tasks</Text>
                <View style={styles.divider} />
                {MONITORING_TASKS.map((task, idx) => (
                  <View key={task.id} style={[styles.taskRow, idx < MONITORING_TASKS.length - 1 && styles.taskRowBorder]}>
                    <Text style={styles.taskDesc}>{task.description}</Text>
                    <View style={styles.taskBtnWrapper}>
                      {task.badge ? (
                        <View style={styles.taskBadge}>
                          <Text style={styles.taskBadgeText}>{task.badge}</Text>
                        </View>
                      ) : null}
                      <TouchableOpacity
                        style={styles.taskBtn}
                        onPress={task.actionType === 'reminder' ? handleSendReminder : undefined}
                        activeOpacity={0.8}
                      >
                        <Text style={styles.taskBtnText}>{task.action}</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </View>

              {/* Recent Activity */}
              <View style={styles.card}>
                <View style={styles.cardHeaderRow}>
                  <Text style={styles.cardTitle}>Recent Activity</Text>
                  <TouchableOpacity>
                    <Text style={styles.viewAll}>View All</Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.divider} />
                {(activities.length > 0 ? activities.slice(0, 3) : [
                  { id: '1', label: 'Approved Annual Budget', barangay: 'Barangay San Jose', time: '3:00 PM', date: 'May 30, 2026', type: 'approved', icon: '✔' },
                  { id: '2', label: 'Sent the ABYIP Template', barangay: 'Barangay San Roque', time: '3:00 PM', date: 'May 30, 2026', type: 'create', icon: '▷' },
                  { id: '3', label: 'Returned ABYIP Proposal', barangay: 'Barangay San José', time: '3:00 PM', date: 'May 30, 2026', type: 'returned', icon: '↩' },
                ]).map((act, idx, arr) => (
                  <View key={act.id} style={[styles.activityRow, idx < arr.length - 1 && styles.activityRowBorder]}>
                    <View style={[styles.activityIconBox, { backgroundColor: activityIconColor(act.type) + '20' }]}>
                      <Text style={[styles.activityIcon, { color: activityIconColor(act.type) }]}>{act.icon}</Text>
                    </View>
                    <View style={styles.activityInfo}>
                      <Text style={styles.activityLabel}>{act.label}</Text>
                      <Text style={styles.activityMeta}>{act.barangay}</Text>
                    </View>
                    <View style={styles.activityTime}>
                      <Text style={styles.activityTimeText}>{act.time}</Text>
                      <Text style={styles.activityDateText}>{act.date}</Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>

            {/* Right: Quick Actions */}
            <View style={[styles.card, styles.flex1, { alignSelf: 'flex-start' }]}>
              <Text style={styles.cardTitle}>Quick Actions</Text>
              <View style={styles.divider} />
              <View style={styles.quickGrid}>
                {QUICK_ACTIONS.filter(a => !a.fullWidth).map((action) => (
                  <TouchableOpacity key={action.id} style={styles.quickBtn} activeOpacity={0.8}>
                    <View style={[styles.quickIconBox, { backgroundColor: action.color + '18' }]}>
                      <Text style={styles.quickIcon}>{action.icon}</Text>
                    </View>
                    <Text style={styles.quickLabel}>{action.label}</Text>
                    {action.badge ? (
                      <View style={styles.quickBadge}>
                        <Text style={styles.quickBadgeText}>{action.badge}</Text>
                      </View>
                    ) : null}
                  </TouchableOpacity>
                ))}
              </View>
              <TouchableOpacity style={styles.createTaskBtn} activeOpacity={0.8}>
                <Text style={styles.createTaskText}>Create Task</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={{ height: 32 }} />
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

// ─── STYLES ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.navy },
  layout: { flex: 1, flexDirection: 'row' },

  // Sidebar
  sidebar: {
    width: 250,
    backgroundColor: COLORS.navy,
    alignItems: 'center',
    paddingTop: 20,
    paddingBottom: 24,
    paddingHorizontal: 10,
    zIndex: 10,
  },
  sidebarOverlay: {
    position: 'absolute', left: 0, top: 0, bottom: 0, right: 0,
    backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 5,
  },
  logoPill: {
    marginTop: 20,
    width: 70, height: 70, borderRadius: 35,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 8, borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)',
  },
  logoImage: { width: 110, height: 110 },
  sidebarSpacer: { height: 28 },
  navItem: {
    width: '100%', paddingVertical: 12, paddingHorizontal: 12,
    borderRadius: 24, marginBottom: 8, alignItems: 'center',
    borderWidth: 1.5, borderColor: COLORS.white,
    backgroundColor: COLORS.navy,
  },
  navItemActive: { backgroundColor: COLORS.white, borderColor: '#000' },
  navLabel: { fontSize: 13, fontWeight: '600', color: COLORS.white, letterSpacing: 0.3 },
  navLabelActive: { color: '#000', fontWeight: '800' },
  logoutBtn: {
    width: '100%', paddingVertical: 12, paddingHorizontal: 12,
    borderRadius: 24, marginTop: 8, alignItems: 'center',
    borderWidth: 1.5, borderColor: COLORS.white,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  logoutText: { fontSize: 13, fontWeight: '600', color: COLORS.white, letterSpacing: 0.3 },

  // Main
  main: { flex: 1, backgroundColor: COLORS.offWhite, borderTopLeftRadius: 20 },
  mainMobile: { borderTopLeftRadius: 0 },
  mainContent: { padding: isMobile ? 14 : 24 },

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
  mobileTitle: { fontSize: 18, fontWeight: '800', color: COLORS.darkText },

  // Page Header
  pageHeader: {
    flexDirection: isMobile ? 'column' : 'row',
    alignItems: isMobile ? 'flex-start' : 'flex-end',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  headerSub: {
    fontSize: 11, fontWeight: '600', color: COLORS.subText,
    letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 2,
  },
  headerTitle: { fontSize: 26, fontWeight: '900', color: COLORS.darkText, letterSpacing: 0.3 },
  todayText: {
    fontSize: 13, fontWeight: '700', color: COLORS.navy,
    marginTop: isMobile ? 6 : 0,
  },

  // Stat Cards
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 18, flexWrap: 'wrap' },
  statsColumn: { flexDirection: 'column', gap: 10, marginBottom: 18 },
  statCard: {
    flex: 1, minWidth: isMobile ? '100%' : 120,
    backgroundColor: COLORS.cardBg, borderRadius: 14,
    padding: 14, borderWidth: 1, borderColor: COLORS.borderColor,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  statCardTop: { marginBottom: 8 },
  statIconBox: {
    width: 36, height: 36, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  statIcon: { fontSize: 18 },
  statValue: { fontSize: 28, fontWeight: '900', color: COLORS.darkText, lineHeight: 34 },
  statLabel: { fontSize: 12, fontWeight: '600', color: COLORS.darkText, marginTop: 2 },
  statSub: { fontSize: 11, color: COLORS.navy, fontWeight: '500', marginTop: 2 },

  // Card
  card: {
    backgroundColor: COLORS.cardBg, borderRadius: 14, padding: 16,
    borderWidth: 1, borderColor: COLORS.borderColor,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  cardTitle: { fontSize: 15, fontWeight: '800', color: COLORS.darkText, marginBottom: 0 },
  cardHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  divider: { height: 1, backgroundColor: COLORS.borderColor, marginVertical: 12 },

  // Two Col
  twoColRow: { flexDirection: 'row', gap: 14, marginBottom: 14 },
  twoColColumn: { flexDirection: 'column', gap: 14, marginBottom: 14 },
  flex1: { flex: 1 },
  flex1_5: { flex: 1.5 },

  // Compliance
  complianceRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, gap: 8 },
  complianceDot: { width: 10, height: 10, borderRadius: 5 },
  complianceLabel: { flex: 1, fontSize: 13, color: COLORS.darkText, fontWeight: '500' },
  complianceCount: { fontSize: 14, fontWeight: '800' },
  complianceTotal: { fontSize: 13, fontWeight: '700', color: COLORS.navy },

  // Progress
  progressContent: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingVertical: 4 },
  donutOuter: {
    width: 90, height: 90, borderRadius: 45,
    borderWidth: 10, borderColor: COLORS.green,
    borderLeftColor: COLORS.yellow,
    borderBottomColor: COLORS.red,
    alignItems: 'center', justifyContent: 'center',
  },
  donutInner: { alignItems: 'center' },
  donutPercent: { fontSize: 16, fontWeight: '900', color: COLORS.darkText },
  donutLabel: { fontSize: 9, color: COLORS.subText, fontWeight: '600' },
  progressLegend: { gap: 8, flex: 1 },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendLabel: { fontSize: 12, color: COLORS.darkText, fontWeight: '500' },

  // Deadline Card
  deadlineCard: {
    backgroundColor: '#EFF6FF',
    borderRadius: 14, padding: 16, marginBottom: 14,
    borderWidth: 1, borderColor: '#BFDBFE',
  },
  deadlineHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 12,
  },
  deadlineHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  deadlineIcon: { fontSize: 16 },
  deadlineTitle: { fontSize: 15, fontWeight: '800', color: COLORS.navy },
  viewAll: { fontSize: 13, fontWeight: '700', color: COLORS.navy },
  deadlineRow: {
    flexDirection: isMobile ? 'column' : 'row',
    alignItems: isMobile ? 'flex-start' : 'center',
    paddingVertical: 8, gap: isMobile ? 4 : 12, flexWrap: 'wrap',
    borderTopWidth: 1, borderTopColor: '#BFDBFE',
  },
  deadlineDocTitle: { flex: 2, fontSize: 13, fontWeight: '700', color: COLORS.navy, minWidth: 160 },
  deadlineDate: { fontSize: 12, color: COLORS.darkText, flex: 1.5 },
  deadlineDateLabel: { fontWeight: '700', color: COLORS.navy },
  daysLeft: { fontSize: 12, fontWeight: '800', flex: 1 },
  daysLeftUrgent: { color: COLORS.red },
  daysLeftNormal: { color: COLORS.darkText },
  deadlineStats: { fontSize: 12, color: COLORS.darkText, flex: 1 },
  deadlineStatLabel: { fontWeight: '700', color: COLORS.navy },
  deadlineStatValue: { fontWeight: '600' },

  // Monitoring Tasks
  taskRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 14, gap: 10,
  },
  taskRowBorder: { borderBottomWidth: 1, borderBottomColor: COLORS.borderColor },
  taskDesc: { flex: 1, fontSize: 13, color: COLORS.darkText, lineHeight: 19 },
  taskBtnWrapper: { flexDirection: 'row', alignItems: 'center' },
  taskBtn: {
    paddingHorizontal: 16, paddingVertical: 8,
    borderRadius: 20, borderWidth: 1.5,
    borderColor: COLORS.navy, backgroundColor: COLORS.white,
  },
  taskBtnText: { fontSize: 12, fontWeight: '700', color: COLORS.navy, letterSpacing: 0.2 },
  taskBadge: {
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: COLORS.red,
    alignItems: 'center', justifyContent: 'center',
    marginRight: 6,
  },
  taskBadgeText: { fontSize: 10, fontWeight: '800', color: COLORS.white },

  // Activity
  activityRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, gap: 10 },
  activityRowBorder: { borderBottomWidth: 1, borderBottomColor: COLORS.borderColor },
  activityIconBox: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  activityIcon: { fontSize: 15, fontWeight: '700' },
  activityInfo: { flex: 1 },
  activityLabel: { fontSize: 13, fontWeight: '600', color: COLORS.darkText, lineHeight: 18 },
  activityMeta: { fontSize: 11, color: COLORS.subText, marginTop: 2 },
  activityTime: { alignItems: 'flex-end' },
  activityTimeText: { fontSize: 12, fontWeight: '700', color: COLORS.darkText },
  activityDateText: { fontSize: 11, color: COLORS.subText, marginTop: 1 },

  // Quick Actions
  quickGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 10,
  },
  quickBtn: {
    width: '47%', flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.white, borderRadius: 14, padding: 14, gap: 10,
    borderWidth: 1.5, borderColor: COLORS.borderColor,
    position: 'relative', minHeight: 60,
  },
  quickIconBox: {
    width: 40, height: 40, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  quickIcon: { fontSize: 20 },
  quickBadge: {
    position: 'absolute', top: 8, right: 10,
    backgroundColor: COLORS.red, borderRadius: 10,
    minWidth: 20, height: 20, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 4,
  },
  quickBadgeText: { fontSize: 11, fontWeight: '800', color: COLORS.white },
  quickLabel: { flex: 1, fontSize: 13, fontWeight: '700', color: COLORS.darkText, lineHeight: 18 },
  createTaskBtn: {
    backgroundColor: COLORS.white, borderRadius: 14, paddingVertical: 16,
    alignItems: 'center', borderWidth: 1.5, borderColor: COLORS.borderColor, marginTop: 4,
  },
  createTaskText: { fontSize: 14, fontWeight: '700', color: COLORS.darkText },
});