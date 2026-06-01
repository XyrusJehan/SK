import React, { useState, useEffect } from 'react';
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

const COLORS = {
  maroon: '#8B0000', maroonDark: '#6B0000', maroonLight: '#A50000',
  gold: '#E8C547', accent: '#D4A017', calGold: '#E8A020',
  white: '#FFFFFF', offWhite: '#F7F5F2', lightGray: '#ECECEC',
  midGray: '#B0B0B0', darkText: '#1A1A1A', subText: '#666666',
  teal: '#2A7B7B', cardBg: '#FFFFFF', shadow: 'rgba(0,0,0,0.08)',
  navy: '#133E75',
};

const CAL_MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const CAL_DAY_NAMES = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const CAL_DOWS = ['SUN','MON','TUE','WED','THU','FRI','SAT'];
const CAL_TIMES = ['6:00 AM','6:30 AM','7:00 AM','7:30 AM','8:00 AM','8:30 AM','9:00 AM','9:30 AM','10:00 AM'];

// ─── NAV ICONS (pure React Native Views — no react-native-svg dependency) ─────

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
        {/* body border */}
        <View style={{ position: 'absolute', left: 0, right: 0, top: fold, bottom: 0, borderWidth: 1.5, borderColor: color, borderRadius: size * 0.08 }} />
        {/* fold triangle approximation */}
        <View style={{ position: 'absolute', top: 0, right: 0, width: fold, height: fold, backgroundColor: color, borderBottomLeftRadius: size * 0.06 }} />
        <View style={{ position: 'absolute', top: 0, left: 0, width: w - fold, height: fold, borderTopWidth: 1.5, borderLeftWidth: 1.5, borderColor: color, borderTopLeftRadius: size * 0.08 }} />
        {/* lines */}
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
        {/* header strip */}
        <View style={{ height: size * 0.22, backgroundColor: color, width: '100%' }} />
        {/* dot row */}
        <View style={{ flex: 1, flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', paddingHorizontal: size * 0.05 }}>
          {[0,1,2].map(i => <View key={i} style={{ width: size * 0.1, height: size * 0.1, borderRadius: size * 0.05, backgroundColor: color }} />)}
        </View>
      </View>
      {/* binding pegs */}
      <View style={{ position: 'absolute', top: 0, flexDirection: 'row', gap: size * 0.32 }}>
        {[0,1].map(i => <View key={i} style={{ width: size * 0.1, height: size * 0.2, backgroundColor: color, borderRadius: size * 0.05 }} />)}
      </View>
    </View>
  );
};

// Portal: simple globe — circle + horizontal line + vertical oval hint
const PortalIcon = ({ color = '#fff', size = 16 }) => (
  <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
    <View style={{ width: size * 0.82, height: size * 0.82, borderRadius: size * 0.41, borderWidth: 1.5, borderColor: color, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' }}>
      {/* equator */}
      <View style={{ position: 'absolute', height: 1.5, width: '100%', backgroundColor: color }} />
      {/* meridian oval */}
      <View style={{ width: size * 0.38, height: size * 0.78, borderRadius: size * 0.19, borderWidth: 1.5, borderColor: color, backgroundColor: 'transparent' }} />
    </View>
  </View>
);

// Logs: clipboard with checkmark lines
const LogsIcon = ({ color = '#fff', size = 16 }) => (
  <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
    <View style={{ width: size * 0.75, height: size * 0.85, borderWidth: 1.5, borderColor: color, borderRadius: size * 0.1, paddingHorizontal: size * 0.1, paddingVertical: size * 0.1, justifyContent: 'space-around' }}>
      {/* clip tab */}
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
    {/* head */}
    <View style={{ width: size * 0.38, height: size * 0.38, borderRadius: size * 0.19, borderWidth: 1.5, borderColor: color, marginBottom: size * 0.04 }} />
    {/* shoulders arc: bottom half of a larger circle */}
    <View style={{ width: size * 0.72, height: size * 0.36, borderBottomLeftRadius: size * 0.36, borderBottomRightRadius: size * 0.36, borderWidth: 1.5, borderColor: color, borderTopWidth: 0, overflow: 'hidden' }} />
  </View>
);

// Logout: door with arrow
const LogoutNavIcon = ({ color = '#fff', size = 16 }) => (
  <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
    {/* door frame — left 60% */}
    <View style={{ position: 'absolute', left: 0, top: 0, width: size * 0.55, height: size, borderWidth: 1.5, borderColor: color, borderRadius: size * 0.08 }} />
    {/* arrow shaft */}
    <View style={{ position: 'absolute', right: size * 0.02, width: size * 0.52, height: 1.8, backgroundColor: color, borderRadius: 1 }} />
    {/* arrowhead */}
    <View style={{ position: 'absolute', right: size * 0.02, width: size * 0.2, height: size * 0.2, borderTopWidth: 1.8, borderRightWidth: 1.8, borderColor: color, transform: [{ rotate: '45deg' }], marginTop: -size * 0.01 }} />
  </View>
);

// ─── ICON COMPONENTS ──────────────────────────────────────────────────────────
const BellIcon = ({ hasNotif }) => (
  <View style={styles.bellWrapper}>
    <View style={styles.bellBody} />
    <View style={styles.bellBottom} />
    {hasNotif && <View style={styles.bellDot} />}
  </View>
);

const SearchIcon = () => (
  <View style={styles.searchIcon}>
    <View style={styles.searchCircle} />
    <View style={styles.searchHandle} />
  </View>
);

const ActivityDot = ({ type }) => (
  <View style={[styles.activityDot, { backgroundColor: type === 'upload' ? COLORS.accent : COLORS.teal }]} />
);

const MenuIcon = () => (
  <View style={styles.menuIconContainer}>
    <View style={styles.menuLine} />
    <View style={styles.menuLine} />
    <View style={styles.menuLine} />
  </View>
);

// ─── ANNUAL COMPLIANCE TIMELINE DATA ─────────────────────────────────────────
const COMPLIANCE_TIMELINE = [
  { month: 'Jan 15', label: 'Q4 2025 Vendor Certifications' },
  { month: 'Feb 25', label: 'Q4 2025 Vendor Allions' },
  { month: 'Mar 31', label: 'Annual Data Privacy Audit' },
  { month: 'May 16', label: 'Q2 Tax Compliance (IRS Form 990)', highlight: true },
  { month: 'Jun 16', label: 'Q2 Tax Compliance Audit' },
  { month: 'Jul 24', label: 'Q2 Tax Compliance (IRS Form 990)' },
  { month: 'Aug 24', label: 'Board Resolution Filing' },
  { month: 'Sep 30', label: 'Board Resolution Filing' },
  { month: 'Sep 30', label: 'Board Resolution Filing' },
  { month: 'Dec 31', label: 'Annual Employee Code of Conduct' },
];

// ─── CALENDAR MODAL ───────────────────────────────────────────────────────────
function CalendarModal({ visible, onClose }) {
  const now = new Date();
  const todayY = now.getFullYear();
  const todayM = now.getMonth();
  const todayD = now.getDate();

  const [cur, setCur] = useState({ y: todayY, m: todayM });
  const [selD, setSelD] = useState(todayD);
  const [selMonth, setSelMonth] = useState(todayM);
  const [selYear, setSelYear] = useState(todayY);
  const [timeIdx, setTimeIdx] = useState(4);
  const [tooltip, setTooltip] = useState(null); // { day, label }

  // Deadline definitions per month (day → label)
  const deadlines = {
    4: 'Q2 Tax Compliance (IRS Form 990)',  // May 4 example
    16: 'Q2 Tax Compliance (IRS Form 990)',
    24: 'Board Resolution Filing',
  };
  const todayKey = `${todayY}-${todayM}-${todayD}`;

  const isDeadline = (y, m, d) => !!(deadlines[d]) && y === cur.y && m === cur.m;
  const isToday = (y, m, d) => y === todayY && m === todayM && d === todayD;

  const shiftMonth = (dir) => {
    setTooltip(null);
    setCur((prev) => {
      let m = prev.m + dir;
      let y = prev.y;
      if (m < 0) { m = 11; y--; }
      if (m > 11) { m = 0; y++; }
      return { y, m };
    });
  };

  const pickDay = (d) => {
    setSelD(d);
    setSelMonth(cur.m);
    setSelYear(cur.y);
    if (deadlines[d]) {
      setTooltip(tooltip?.day === d ? null : { day: d, label: deadlines[d] });
    } else {
      setTooltip(null);
    }
  };

  const buildCells = () => {
    const { y, m } = cur;
    const firstDow = new Date(y, m, 1).getDay();
    const dim = new Date(y, m + 1, 0).getDate();
    const prevDim = new Date(y, m, 0).getDate();
    const cells = [];
    for (let i = 0; i < firstDow; i++) cells.push({ day: prevDim - firstDow + 1 + i, ghost: true });
    for (let d = 1; d <= dim; d++) {
      cells.push({
        day: d, ghost: false,
        deadline: isDeadline(cur.y, cur.m, d),
        today: isToday(cur.y, cur.m, d),
      });
    }
    const tail = (firstDow + dim) % 7;
    if (tail > 0) for (let i = 1; i <= 7 - tail; i++) cells.push({ day: i, ghost: true });
    return cells;
  };

  const cells = buildCells();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={calStyles.backdrop}>
        <View style={calStyles.modal}>
          <TouchableOpacity style={calStyles.closeBtn} onPress={onClose} activeOpacity={0.8}>
            <Text style={calStyles.closeBtnText}>✕</Text>
          </TouchableOpacity>

          <View style={calStyles.body}>

            {/* ── Left: Calendar Panel ── */}
            <View style={calStyles.calPanel}>
              {/* Nav header */}
              <View style={calStyles.calNav}>
                <TouchableOpacity style={calStyles.navBtn} onPress={() => shiftMonth(-1)} activeOpacity={0.8}>
                  <Text style={calStyles.navArrow}>‹</Text>
                </TouchableOpacity>
                <Text style={calStyles.monthLabel}>{CAL_MONTHS[cur.m].toUpperCase()} {cur.y} DEADLINES</Text>
                <TouchableOpacity style={calStyles.navBtn} onPress={() => shiftMonth(1)} activeOpacity={0.8}>
                  <Text style={calStyles.navArrow}>›</Text>
                </TouchableOpacity>
              </View>

              {/* Day-of-week headers */}
              <View style={calStyles.grid}>
                {CAL_DOWS.map((d) => (
                  <View key={d} style={calStyles.dowCell}>
                    <Text style={calStyles.dowText}>{d}</Text>
                  </View>
                ))}

                {/* Day cells */}
                {cells.map((cell, idx) => {
                  const showTooltip = tooltip?.day === cell.day && !cell.ghost;
                  return (
                    <View key={idx} style={calStyles.dayCellWrap}>
                      <TouchableOpacity
                        style={[
                          calStyles.dayCell,
                          cell.ghost && calStyles.dayCellGhost,
                          !cell.ghost && cell.today && calStyles.dayCellToday,
                          !cell.ghost && cell.deadline && calStyles.dayCellDeadline,
                        ]}
                        onPress={() => !cell.ghost && pickDay(cell.day)}
                        activeOpacity={cell.ghost ? 1 : 0.75}
                        disabled={cell.ghost}
                      >
                        <Text style={[
                          calStyles.dayText,
                          cell.ghost && calStyles.dayTextGhost,
                          !cell.ghost && cell.today && calStyles.dayTextToday,
                          !cell.ghost && cell.deadline && calStyles.dayTextDeadline,
                        ]}>
                          {cell.day}
                        </Text>
                        {!cell.ghost && (cell.today || cell.deadline) && (
                          <Text style={calStyles.dayCellSub}>
                            {cell.today ? 'Deadline' : 'Standard\nWorkday'}
                          </Text>
                        )}
                        {!cell.ghost && !cell.today && !cell.deadline && (
                          <Text style={calStyles.dayCellSub}>{'Standard\nWorkday'}</Text>
                        )}
                      </TouchableOpacity>
                      {/* Tooltip popover */}
                      {showTooltip && (
                        <View style={calStyles.tooltip}>
                          <Text style={calStyles.tooltipTitle}>
                            {CAL_MONTHS[cur.m]} {cell.day} – {deadlines[cell.day]}
                          </Text>
                        </View>
                      )}
                    </View>
                  );
                })}
              </View>
            </View>

            {/* ── Right: Annual Compliance Timeline ── */}
            <View style={calStyles.sidePanel}>
              <View style={calStyles.sidePanelHeader}>
                <Text style={calStyles.sidePanelTitle}>ANNUAL COMPLIANCE{'\n'}TIMELINE - {cur.y}</Text>
              </View>

              <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
                {COMPLIANCE_TIMELINE.map((item, idx) => (
                  <View
                    key={idx}
                    style={[calStyles.timelineRow, item.highlight && calStyles.timelineRowHighlight]}
                  >
                    <View style={[calStyles.timelineDot, item.highlight && calStyles.timelineDotHighlight]} />
                    <Text style={[calStyles.timelineMonth, item.highlight && calStyles.timelineMonthHighlight]}>
                      {item.month}
                    </Text>
                    <Text style={[calStyles.timelineLabel, item.highlight && calStyles.timelineLabelHighlight]}>
                      {item.label}
                    </Text>
                  </View>
                ))}
              </ScrollView>

              {/* Time selector */}
              <View style={calStyles.timeRow}>
                <Text style={calStyles.timeLabel}>Time</Text>
                <TouchableOpacity
                  style={calStyles.timeBtn}
                  onPress={() => setTimeIdx((i) => (i + 1) % CAL_TIMES.length)}
                  activeOpacity={0.8}
                >
                  <Text style={calStyles.timeBtnText}>{CAL_TIMES[timeIdx]}</Text>
                </TouchableOpacity>
              </View>
            </View>

          </View>
        </View>
      </View>
    </Modal>
  );
}

// ─── APPROACHING DEADLINES DATA ──────────────────────────────────────────────
const APPROACHING_DEADLINES = [
  { id: '1', title: 'Approved Annual Budget', deadline: 'January 6, 2026', daysLeft: 1, urgent: true },
  { id: '2', title: 'Annual Budget Youth Investment Program', deadline: 'January 6, 2026', daysLeft: 10, urgent: false },
];

// ─── QUICK ACTIONS DATA ───────────────────────────────────────────────────────
const SK_QUICK_ACTIONS = [
  { id: 'proposal', label: 'Create Proposal', icon: '🔔', color: '#133E75' },
  { id: 'drafts', label: 'View Drafts', icon: '📋', color: '#133E75' },
  { id: 'logs', label: 'Activity logs', icon: '📝', color: '#133E75' },
  { id: 'upload', label: 'Scan & Upload', icon: '📄', color: '#133E75', isScan: true },
  { id: 'consultation', label: 'Consultation', icon: '💬', color: '#133E75', badge: 2 },
  { id: 'calendar', label: 'View Deadline Calendar', icon: '📅', color: '#F97316' },
  { id: 'archive', label: 'View Archive', icon: '🗃', color: '#6B7A8F' },
  { id: 'returned', label: 'Returned Proposal', icon: '💬', color: '#9333EA', badge: 2 },
];

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
export default function HomeScreen({ navigation }) {
  const router = useRouter();
  const { activeTab, setActiveTab } = useNav();
  const { logout, user } = useAuth();
  const [notifCount] = useState(2);
  const [sidebarVisible, setSidebarVisible] = useState(false);
  const [calendarVisible, setCalendarVisible] = useState(false);
  const [docStats, setDocStats] = useState({ total: 0, submitted: 0, forRevision: 0, approved: 0, drafts: 0 });
  const [recentActivities, setRecentActivities] = useState([]);
  const [complianceTasks, setComplianceTasks] = useState([]);

  useEffect(() => {
    if (user && user.role !== 'sk') router.replace('/');
  }, [user]);

  const barangayName = user?.barangay?.barangay_name || 'Unknown Barangay';
  const barangayId = user?.barangayId;

  useEffect(() => {
    if (user && user.role === 'sk' && !barangayId) {
      alert('No barangay assigned to your account. Please contact administrator.');
      logout();
      router.replace('/');
    }
  }, [user, barangayId]);

  // Fetch documents filtered by barangay_id
  useEffect(() => {
    const fetchDocuments = async () => {
      if (!barangayId) return;
      try {
        const { data: documents, error } = await supabase
          .from('documents')
          .select('status, title, created_at, submitted_at, saved_at')
          .eq('barangay_id', barangayId)
          .order('created_at', { ascending: false });

        if (error) { console.error('Error fetching documents:', error); return; }

        const total = documents?.length || 0;
        const submitted = documents?.filter(d => ['submitted', 'approved', 'returned'].includes(d.status)).length || 0;
        const forRevision = documents?.filter(d => d.status === 'returned').length || 0;
        const approved = documents?.filter(d => d.status === 'approved').length || 0;
        const drafts = documents?.filter(d => d.status === 'draft').length || 0;

        setDocStats({ total, submitted, forRevision, approved, drafts });

        // Build recent activities from docs
        const acts = (documents || []).slice(0, 5).map(doc => {
          const date = doc.submitted_at || doc.saved_at || doc.created_at;
          let label = doc.title;
          let actionType = 'create';
          let role = 'Secretary';
          if (doc.status === 'submitted' || doc.status === 'approved') { actionType = 'submit'; role = 'Treasurer'; }
          else if (doc.status === 'returned') { actionType = 'returned'; role = 'Chairman'; }
          return {
            id: doc.title + date,
            label,
            role,
            time: new Date(doc.created_at).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' }),
            date: new Date(doc.created_at).toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' }),
            type: actionType,
          };
        });
        setRecentActivities(acts);
      } catch (error) { console.error('Error:', error); }
    };
    fetchDocuments();
  }, [barangayId]);

  // Fetch compliance tasks/deadlines
  useEffect(() => {
    const fetchTasks = async () => {
      if (!barangayId) return;
      try {
        const { data: deadlines, error } = await supabase
          .from('submission_deadlines')
          .select('*')
          .eq('barangay_id', barangayId)
          .order('deadline_date', { ascending: true });

        if (error) { console.error('Error fetching tasks:', error); return; }

        const taskList = (deadlines || []).map(d => ({
          id: d.deadline_id.toString(),
          description: d.title || d.document_type,
          action: d.action_type === 'publish' ? 'Publish' : 'Submit',
          urgent: new Date(d.deadline_date) <= new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        }));
        setComplianceTasks(taskList);
      } catch (error) { console.error('Error:', error); }
    };
    fetchTasks();
  }, [barangayId]);

  const handleNavPress = (tab) => {
    if (tab === 'Dashboard') router.push('/(tabs)/sk-dashboard');
    else if (tab === 'Documents') router.push('/(tabs)/sk-document');
    else if (tab === 'Planning') router.push('/(tabs)/sk-planning');
    else if (tab === 'Portal') router.push('/(tabs)/sk-portal');
    else if (tab === 'Logs') router.push('/(tabs)/sk-logs');
    else if (tab === 'Account') router.push('/(tabs)/sk-account');
    setActiveTab(tab);
    setSidebarVisible(false);
  };

  const handleLogout = () => { logout(); router.replace('/'); };

  const handleQuickAction = (id) => {
    if (id === 'calendar') setCalendarVisible(true);
    else if (id === 'proposal') router.push('/(tabs)/sk-planning');
    else if (id === 'drafts') router.push('/(tabs)/sk-document-management?initialTab=Drafts');
    else if (id === 'logs') router.push('/(tabs)/sk-logs');
    else if (id === 'consultation') router.push('/(tabs)/sk-document-management?initialTab=Saved');
    else if (id === 'upload') router.push('/(tabs)/sk-document-list?openScanner=true');
    else if (id === 'returned') router.push('/(tabs)/sk-document-management?initialTab=Returned');
    else if (id === 'archive') router.push('/(tabs)/sk-document');
  };

  const activityIconColor = (type) => {
    if (type === 'submit') return '#22C55E';
    if (type === 'returned') return '#F97316';
    return '#3B82F6';
  };

  const activityIcon = (type) => {
    if (type === 'submit') return '↑';
    if (type === 'returned') return '↩';
    return '✎';
  };

  const NAV_ITEMS = [
    { tab: 'Dashboard', IconComponent: DashboardIcon },
    { tab: 'Documents', IconComponent: DocumentsIcon },
    { tab: 'Planning',  IconComponent: PlanningIcon  },
    { tab: 'Portal',    IconComponent: PortalIcon    },
    { tab: 'Logs',      IconComponent: LogsIcon      },
    { tab: 'Account',   IconComponent: AccountIcon   },
  ];

  const renderSidebar = () => (
    <View style={[styles.sidebar, isMobile && !sidebarVisible && styles.sidebarHidden]}>
      <View style={styles.logoPill}>
        <Image source={require('./../../assets/images/sk-logo.png')} style={styles.logoImage} resizeMode="contain" />
      </View>
      <View style={{ height: 28 }} />
      {NAV_ITEMS.map(({ tab, IconComponent }) => {
        const active = activeTab === tab;
        const iconColor = active ? '#133E75' : 'rgba(255,255,255,0.85)';
        return (
          <TouchableOpacity key={tab} style={[styles.navItem, active && styles.navItemActive]} onPress={() => handleNavPress(tab)} activeOpacity={0.8}>
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

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.navy} />

      {/* ── Calendar Modal ── */}
      <CalendarModal visible={calendarVisible} onClose={() => setCalendarVisible(false)} />

      <View style={styles.layout}>
        {isMobile && sidebarVisible && (
          <TouchableOpacity style={styles.sidebarOverlay} activeOpacity={1} onPress={() => setSidebarVisible(false)} />
        )}
        {renderSidebar()}

        <ScrollView style={[styles.main, isMobile && styles.mainMobile]} contentContainerStyle={styles.mainContent} showsVerticalScrollIndicator={false}>

          {/* Mobile Header */}
          {isMobile && (
            <View style={styles.mobileHeader}>
              <TouchableOpacity style={styles.menuBtn} onPress={() => setSidebarVisible(!sidebarVisible)}>
                <MenuIcon />
              </TouchableOpacity>
              <Text style={styles.mobileTitle}>SK Dashboard</Text>
              <View style={styles.mobileHeaderActions}>
<TouchableOpacity style={styles.bellBtnMobile} activeOpacity={0.7}>
                  <BellIcon hasNotif={notifCount > 0} />
                  {notifCount > 0 && (
                    <View style={styles.notifBadgeMobile}>
                      <Text style={styles.notifBadgeTextMobile}>{notifCount}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Desktop Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.headerSub}>SANGGUNIANG KABATAAN</Text>
              <Text style={styles.headerTitle}>{barangayName.toUpperCase()}</Text>
            </View>
            {!isMobile && (
              <View style={styles.headerActions}>
                <TouchableOpacity style={styles.headerActionBtn} activeOpacity={0.7}>
                  <View style={{ position: 'relative' }}>
                    <BellIcon hasNotif={notifCount > 0} />
                    {notifCount > 0 && (
                      <View style={styles.notifBadge}>
                        <Text style={styles.notifBadgeText}>{notifCount}</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.headerActionLabel}>Notification</Text>
                </TouchableOpacity>

              </View>
            )}
          </View>

          {/* ── STAT CARDS ROW ── */}
          <View style={isMobile ? styles.statsCol : styles.statsRow}>
            {[
              { id: 'total',      label: 'Total Documents',  sub: 'This Fiscal Year', value: docStats.total,      icon: '🗂️', iconBg: '#EFF6FF', iconColor: COLORS.navy,    border: COLORS.navy },
              { id: 'submitted',  label: 'Total Submitted',  sub: null,               value: docStats.submitted,  icon: '📋', iconBg: '#F0FDF4', iconColor: '#22C55E',      border: '#22C55E' },
              { id: 'revision',   label: 'For Revision',     sub: null,               value: docStats.forRevision,icon: '✏️', iconBg: '#FEF3C7', iconColor: '#F97316',      border: '#F97316' },
              { id: 'approved',   label: 'Approved',         sub: null,               value: docStats.approved,   icon: '✅', iconBg: '#DCFCE7', iconColor: '#22C55E',      border: '#22C55E' },
              { id: 'drafts',     label: 'Total Drafts',     sub: null,               value: docStats.drafts,     icon: '📝', iconBg: '#FEE2E2', iconColor: '#EF4444',      border: '#EF4444' },
            ].map((stat) => (
              <View key={stat.id} style={[styles.statCard, { borderTopColor: stat.border, borderTopWidth: 3 }]}>
                <View style={[styles.statIconWrap, { backgroundColor: stat.iconBg }]}>
                  <Text style={styles.statIcon}>{stat.icon}</Text>
                </View>
                <Text style={[styles.statValue, { color: stat.iconColor }]}>{stat.value}</Text>
                <Text style={styles.statLabel}>{stat.label}</Text>
                {stat.sub ? <Text style={styles.statSub}>{stat.sub}</Text> : null}
              </View>
            ))}
          </View>

          {/* ── APPROACHING DEADLINE ── */}
          <View style={styles.deadlineCard}>
            <View style={styles.deadlineHeader}>
              <View style={styles.deadlineHeaderLeft}>
                <Text style={styles.deadlineIcon}>⏰</Text>
                <Text style={styles.deadlineTitle}>Approaching  Deadline</Text>
              </View>
              <TouchableOpacity><Text style={styles.viewAll}>View All</Text></TouchableOpacity>
            </View>
            {APPROACHING_DEADLINES.map((item) => (
              <View key={item.id} style={styles.deadlineRow}>
                <Text style={styles.deadlineDocTitle}>{item.title}</Text>
                <Text style={styles.deadlineDate}>
                  <Text style={styles.deadlineDateLabel}>Deadline: </Text>{item.deadline}
                </Text>
                <Text style={[styles.daysLeft, item.urgent ? styles.daysLeftUrgent : styles.daysLeftNormal]}>
                  {item.daysLeft} Day{item.daysLeft !== 1 ? 's' : ''} Left
                </Text>
              </View>
            ))}
          </View>

          {/* ── BOTTOM TWO COLUMNS ── */}
          <View style={isMobile ? styles.twoColColumn : styles.twoColRow}>

            {/* Left: Compliance Tasks + Recent Activity */}
            <View style={[styles.flex1_5, { gap: 14 }]}>

              {/* Compliance Tasks */}
              <View style={styles.card}>
                <View style={styles.cardHeaderRow}>
                  <Text style={styles.cardTitle}>Compliance Tasks</Text>
                  <TouchableOpacity><Text style={styles.viewAll}>View All</Text></TouchableOpacity>
                </View>
                <View style={styles.divider} />
                {(complianceTasks.length > 0 ? complianceTasks : [
                  { id: '1', description: 'Submit the Approved Annual Budget to LYDO', action: 'Submit' },
                  { id: '2', description: 'Submit Annual Budget Youth Investment Program proposal', action: 'Submit' },
                  { id: '3', description: 'Publish the Comprehensive Barangay Youth Development Program to policy board', action: 'Publish' },
                  { id: '4', description: 'Submit Monthly Report for the month of february', action: 'Submit' },
                ]).map((task, idx, arr) => (
                  <View key={task.id} style={[styles.taskRow, idx < arr.length - 1 && styles.taskRowBorder]}>
                    <Text style={styles.taskDesc}>{task.description}</Text>
                    <TouchableOpacity style={[styles.taskBtn, task.action === 'Publish' && styles.taskBtnPublish]} activeOpacity={0.8}>
                      <Text style={[styles.taskBtnText, task.action === 'Publish' && styles.taskBtnPublishText]}>{task.action}</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>

              {/* Recent Activity */}
              <View style={styles.card}>
                <View style={styles.cardHeaderRow}>
                  <Text style={styles.cardTitle}>Recent Activity</Text>
                  <TouchableOpacity><Text style={styles.viewAll}>View All</Text></TouchableOpacity>
                </View>
                <View style={styles.divider} />
                {(recentActivities.length > 0 ? recentActivities.slice(0, 3) : [
                  { id: '1', label: 'Submitted the Approved Annual Budget to LYDO', role: 'Treasurer',  time: '3:00 PM', date: 'May 30, 2026', type: 'submit' },
                  { id: '2', label: 'Created draft for Annual Budget Youth Investment Program', role: 'Secretary',  time: '3:00 PM', date: 'May 30, 2026', type: 'create' },
                  { id: '3', label: 'Published the Comprehensive Barangay Youth Development Program to policy board', role: 'Chairman', time: '3:00 PM', date: 'May 30, 2026', type: 'submit' },
                ]).map((act, idx, arr) => (
                  <View key={act.id} style={[styles.activityRow, idx < arr.length - 1 && styles.activityRowBorder]}>
                    <View style={[styles.activityIconBox, { backgroundColor: activityIconColor(act.type) + '20' }]}>
                      <Text style={[styles.activityIconText, { color: activityIconColor(act.type) }]}>{activityIcon(act.type)}</Text>
                    </View>
                    <View style={styles.activityInfo}>
                      <Text style={styles.activityLabel}>{act.label}</Text>
                      <Text style={styles.activityMeta}>{act.role}</Text>
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
              <View style={styles.quickActionsHeader}>
                <Text style={styles.cardTitle}>Quick Actions</Text>
                <Text style={styles.scanLabel}>Scan</Text>
              </View>
              <View style={styles.divider} />
              <View style={styles.quickGrid}>
                {SK_QUICK_ACTIONS.map((action) => (
                  <TouchableOpacity
                    key={action.id}
                    style={[styles.quickBtn, action.isScan && styles.quickBtnScan]}
                    activeOpacity={0.8}
                    onPress={() => handleQuickAction(action.id)}
                  >
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
            </View>

          </View>

          <View style={{ height: 32 }} />
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

// ─── CALENDAR STYLES ──────────────────────────────────────────────────────────
const calStyles = StyleSheet.create({
  backdrop: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center', alignItems: 'center', padding: 16,
  },
  modal: {
    backgroundColor: COLORS.navy, borderRadius: 20,
    width: isMobile ? '100%' : 740, maxWidth: 740, padding: 16,
  },
  closeBtn: {
    alignSelf: 'flex-end', width: 28, height: 28, borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center', justifyContent: 'center', marginBottom: 10,
  },
  closeBtnText: { color: COLORS.white, fontSize: 14, fontWeight: '700' },
  body: { flexDirection: isMobile ? 'column' : 'row', gap: 12 },

  /* ── Left: Calendar panel ── */
  calPanel: {
    flex: isMobile ? undefined : 1,
    backgroundColor: COLORS.white, borderRadius: 14,
    padding: isMobile ? 12 : 16,
  },
  calNav: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: 16,
  },
  navBtn: {
    width: 32, height: 32, borderRadius: 16,
    borderWidth: 1.5, borderColor: '#bbb',
    backgroundColor: '#f0f0f0',
    alignItems: 'center', justifyContent: 'center',
  },
  navArrow: { fontSize: 20, color: COLORS.navy, lineHeight: 22, marginTop: -2 },
  monthLabel: {
    fontSize: isMobile ? 13 : 15, fontWeight: '800',
    color: COLORS.navy, letterSpacing: 1, textAlign: 'center',
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  dowCell: { width: `${100 / 7}%`, alignItems: 'center', paddingBottom: 6 },
  dowText: { fontSize: 10, fontWeight: '700', color: '#888', letterSpacing: 0.5 },

  dayCellWrap: { width: `${100 / 7}%`, position: 'relative', marginBottom: 4 },
  dayCell: {
    flex: 1, minHeight: isMobile ? 40 : 50,
    alignItems: 'center', justifyContent: 'flex-start', paddingTop: 5,
    borderRadius: 8, backgroundColor: '#e8eaf0',
    marginHorizontal: 1,
  },
  dayCellGhost: { backgroundColor: 'transparent' },
  dayCellToday: { backgroundColor: COLORS.calGold },
  dayCellDeadline: { backgroundColor: COLORS.calGold },
  dayText: { fontSize: isMobile ? 12 : 13, fontWeight: '700', color: COLORS.navy },
  dayTextGhost: { color: '#ccc' },
  dayTextToday: { color: COLORS.white },
  dayTextDeadline: { color: COLORS.white },
  dayCellSub: {
    fontSize: 7, color: '#666',
    textAlign: 'center', lineHeight: 9, marginTop: 2,
  },

  /* Tooltip popover */
  tooltip: {
    position: 'absolute', top: '110%', left: '-20%', right: '-120%',
    zIndex: 99, backgroundColor: COLORS.white, borderRadius: 8,
    padding: 8, elevation: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2, shadowRadius: 6,
  },
  tooltipTitle: { fontSize: 11, fontWeight: '700', color: COLORS.navy, lineHeight: 15 },

  /* ── Right: Annual Compliance Timeline panel ── */
  sidePanel: {
    width: isMobile ? '100%' : 220,
    backgroundColor: COLORS.white, borderRadius: 14,
    overflow: 'hidden',
    maxHeight: isMobile ? 300 : 420,
  },
  sidePanelHeader: {
    backgroundColor: COLORS.navy, paddingHorizontal: 14, paddingVertical: 12,
    alignItems: 'center',
  },
  sidePanelTitle: {
    fontSize: 12, fontWeight: '800', color: COLORS.white,
    textAlign: 'center', letterSpacing: 0.8, lineHeight: 17,
  },

  /* Timeline rows */
  timelineRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 7,
    borderBottomWidth: 1, borderBottomColor: '#eef0f5', gap: 8,
  },
  timelineRowHighlight: {
    borderWidth: 1.5, borderColor: COLORS.calGold,
    borderRadius: 8, marginHorizontal: 6, marginVertical: 2,
    backgroundColor: '#fffdf6',
  },
  timelineDot: {
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: COLORS.navy, flexShrink: 0,
  },
  timelineDotHighlight: { backgroundColor: COLORS.calGold },
  timelineMonth: { fontSize: 10, fontWeight: '700', color: COLORS.navy, width: 38, flexShrink: 0 },
  timelineMonthHighlight: { color: COLORS.calGold },
  timelineLabel: { flex: 1, fontSize: 10, color: '#444', lineHeight: 14 },
  timelineLabelHighlight: { fontWeight: '700', color: COLORS.navy },

  /* Time row */
  timeRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderTopWidth: 1, borderTopColor: '#e0e8f0',
    paddingHorizontal: 12, paddingVertical: 9,
  },
  timeLabel: { fontSize: 12, fontWeight: '700', color: COLORS.navy },
  timeBtn: {
    backgroundColor: '#e8eaf5', borderWidth: 1.5, borderColor: '#c8d0e8',
    borderRadius: 8, paddingHorizontal: 12, paddingVertical: 5,
  },
  timeBtnText: { fontSize: 12, fontWeight: '700', color: COLORS.navy },
});

// ─── DASHBOARD STYLES ─────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#133E75' },
  layout: { flex: 1, flexDirection: 'row' },

  // ── Sidebar (unchanged) ──
  sidebar: {
    width: 250, backgroundColor: '#133E75',
    alignItems: 'center', paddingTop: 20, paddingBottom: 24, paddingHorizontal: 10, zIndex: 20,
    ...(isMobile ? { position: 'absolute', top: 0, left: 0, bottom: 0, zIndex: 20 } : {}),
  },
  sidebarHidden: { display: 'none' },
  sidebarOverlay: { position: 'absolute', left: 0, top: 0, bottom: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 15 },
  logoPill: { marginTop: 20, width: 70, height: 70, borderRadius: 35, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center', marginBottom: 8, borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)' },
  logoImage: { width: 100, height: 100 },
  logoutBtn: { width: '100%', paddingVertical: 12, paddingHorizontal: 12, borderRadius: 24, marginTop: 8, alignItems: 'center', borderWidth: 1.5, borderColor: COLORS.white, backgroundColor: 'rgba(255,255,255,0.1)' },
  logoutText: { fontSize: 13, fontWeight: '600', color: '#ffffff', letterSpacing: 0.3 },
  navItem: { width: '100%', paddingVertical: 12, paddingHorizontal: 12, borderRadius: 24, marginBottom: 8, alignItems: 'center', borderWidth: 1.5, borderColor: COLORS.white, backgroundColor: '#133E75' },
  navItemActive: { backgroundColor: '#ffffff', borderWidth: 1.5, borderColor: '#000000' },
  navItemInner: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  navIcon: { fontSize: 15, color: 'rgba(255,255,255,0.85)' },
  navIconActive: { color: '#000000' },
  navLabel: { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.8)', letterSpacing: 0.3 },
  navLabelActive: { color: '#000000', fontWeight: '800' },

  // ── Main area ──
  main: { flex: 1, backgroundColor: COLORS.offWhite, borderTopLeftRadius: 20 },
  mainMobile: { borderTopLeftRadius: 0 },
  mainContent: { padding: isMobile ? 12 : 20, paddingBottom: isMobile ? 24 : 40 },

  // ── Mobile header ──
  mobileHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: COLORS.lightGray },
  menuBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.cardBg, alignItems: 'center', justifyContent: 'center' },
  menuIconContainer: { width: 20, height: 16, justifyContent: 'space-between' },
  menuLine: { width: 20, height: 2, backgroundColor: COLORS.navy, borderRadius: 1 },
  mobileTitle: { fontSize: 16, fontWeight: '800', color: COLORS.darkText },
  mobileHeaderActions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  mobileActionBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: COLORS.cardBg, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, elevation: 2 },
  mobileArchivesBtn: { backgroundColor: '#133E75' },
  mobileActionIcon: { fontSize: 14 },

  // ── Desktop header (unchanged) ──
  header: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: isMobile ? 12 : 16 },
  headerSub: { fontSize: isMobile ? 8 : 10, fontWeight: '600', color: COLORS.subText, letterSpacing: 2, marginBottom: 2, textTransform: 'uppercase' },
  headerTitle: { fontSize: isMobile ? 16 : 20, fontWeight: '900', color: COLORS.darkText, letterSpacing: 0.5 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerActionBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 7, paddingHorizontal: 12, borderRadius: 20, backgroundColor: COLORS.cardBg, borderWidth: 1, borderColor: COLORS.lightGray, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  archivesBtn: { backgroundColor: '#133E75', borderColor: '#133E75' },
  headerActionIcon: { fontSize: 16 },
  headerActionLabel: { fontSize: 12, fontWeight: '600', color: COLORS.darkText },
  archivesBtnText: { color: COLORS.white },

  // ── Bell icons ──
  bellWrapper: { width: 20, height: 22, alignItems: 'center' },
  bellBody: { width: 14, height: 12, borderRadius: 7, borderWidth: 2, borderColor: COLORS.maroon, marginTop: 4 },
  bellBottom: { width: 8, height: 4, borderBottomLeftRadius: 4, borderBottomRightRadius: 4, backgroundColor: COLORS.maroon, marginTop: -1 },
  bellDot: { position: 'absolute', top: 0, right: 1, width: 7, height: 7, borderRadius: 4, backgroundColor: COLORS.gold, borderWidth: 1.5, borderColor: COLORS.cardBg },
  notifBadge: { position: 'absolute', top: -2, right: -2, width: 16, height: 16, borderRadius: 8, backgroundColor: COLORS.gold, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: COLORS.white },
  notifBadgeText: { fontSize: 8, fontWeight: '900', color: COLORS.navy },
  bellBtnMobile: { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.cardBg, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 3, elevation: 2 },
  notifBadgeMobile: { position: 'absolute', top: -2, right: -2, width: 14, height: 14, borderRadius: 7, backgroundColor: COLORS.gold, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: COLORS.white },
  notifBadgeTextMobile: { fontSize: 7, fontWeight: '900', color: COLORS.navy },

  // ── Stat Cards ──
  statsRow: { flexDirection: isMobile ? 'column' : 'row', gap: isMobile ? 8 : 10, marginBottom: isMobile ? 14 : 18, flexWrap: 'wrap' },
  statsCol: { flexDirection: 'column', gap: 8, marginBottom: 14 },
  statCard: {
    flex: 1, minWidth: isMobile ? '100%' : 100,
    backgroundColor: COLORS.cardBg, borderRadius: 14,
    padding: 14, borderWidth: 1, borderColor: COLORS.lightGray,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  statIconWrap: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  statIcon: { fontSize: 18 },
  statValue: { fontSize: 28, fontWeight: '900', color: COLORS.darkText, lineHeight: 34 },
  statLabel: { fontSize: 12, fontWeight: '600', color: COLORS.darkText, marginTop: 2 },
  statSub: { fontSize: 11, color: COLORS.navy, fontWeight: '500', marginTop: 2 },

  // ── Approaching Deadline Card ──
  deadlineCard: { backgroundColor: '#EFF6FF', borderRadius: 14, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: '#BFDBFE' },
  deadlineHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  deadlineHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  deadlineIcon: { fontSize: 16 },
  deadlineTitle: { fontSize: 15, fontWeight: '800', color: COLORS.navy },
  viewAll: { fontSize: 13, fontWeight: '700', color: COLORS.navy },
  deadlineRow: { flexDirection: isMobile ? 'column' : 'row', alignItems: isMobile ? 'flex-start' : 'center', paddingVertical: 8, gap: isMobile ? 4 : 12, flexWrap: 'wrap', borderTopWidth: 1, borderTopColor: '#BFDBFE' },
  deadlineDocTitle: { flex: 2, fontSize: 13, fontWeight: '700', color: COLORS.navy, minWidth: 160 },
  deadlineDate: { fontSize: 12, color: COLORS.darkText, flex: 1.5 },
  deadlineDateLabel: { fontWeight: '700', color: COLORS.navy },
  daysLeft: { fontSize: 12, fontWeight: '800', flex: 1 },
  daysLeftUrgent: { color: '#EF4444' },
  daysLeftNormal: { color: COLORS.darkText },

  // ── Two column layout ──
  twoColRow: { flexDirection: 'row', gap: 14, marginBottom: 14 },
  twoColColumn: { flexDirection: 'column', gap: 14, marginBottom: 14 },
  flex1: { flex: 1 },
  flex1_5: { flex: 1.5 },

  // ── Generic Card ──
  card: {
    backgroundColor: COLORS.cardBg, borderRadius: 14, padding: 16,
    borderWidth: 1, borderColor: COLORS.lightGray,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  cardTitle: { fontSize: 15, fontWeight: '800', color: COLORS.darkText },
  cardHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  divider: { height: 1, backgroundColor: COLORS.lightGray, marginVertical: 12 },

  // ── Compliance Tasks ──
  taskRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, gap: 10 },
  taskRowBorder: { borderBottomWidth: 1, borderBottomColor: COLORS.lightGray },
  taskDesc: { flex: 1, fontSize: 13, color: COLORS.darkText, lineHeight: 19 },
  taskBtn: { paddingHorizontal: 16, paddingVertical: 7, borderRadius: 20, borderWidth: 1.5, borderColor: COLORS.navy, backgroundColor: COLORS.white },
  taskBtnText: { fontSize: 12, fontWeight: '700', color: COLORS.navy, letterSpacing: 0.2 },
  taskBtnPublish: { borderColor: '#22C55E', backgroundColor: '#22C55E' },
  taskBtnPublishText: { color: COLORS.white },

  // ── Recent Activity ──
  activityRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, gap: 10 },
  activityRowBorder: { borderBottomWidth: 1, borderBottomColor: COLORS.lightGray },
  activityIconBox: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  activityIconText: { fontSize: 15, fontWeight: '700' },
  activityInfo: { flex: 1 },
  activityLabel: { fontSize: 13, fontWeight: '600', color: COLORS.darkText, lineHeight: 18 },
  activityMeta: { fontSize: 11, color: COLORS.subText, marginTop: 2 },
  activityTime: { alignItems: 'flex-end' },
  activityTimeText: { fontSize: 12, fontWeight: '700', color: COLORS.darkText },
  activityDateText: { fontSize: 11, color: COLORS.subText, marginTop: 1 },

  // ── Quick Actions ──
  quickActionsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  scanLabel: { fontSize: 15, fontWeight: '800', color: COLORS.darkText },
  quickGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 4 },
  quickBtn: {
    width: '47%', flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.white, borderRadius: 14, padding: 12, gap: 8,
    borderWidth: 1.5, borderColor: COLORS.lightGray,
    position: 'relative', minHeight: 54,
  },
  quickBtnScan: {},
  quickIconBox: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  quickIcon: { fontSize: 18 },
  quickLabel: { flex: 1, fontSize: 12, fontWeight: '600', color: COLORS.darkText, lineHeight: 17 },
  quickLabelBold: { fontWeight: '800' },
  quickBadge: { position: 'absolute', top: 6, right: 8, backgroundColor: '#EF4444', borderRadius: 10, minWidth: 20, height: 20, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  quickBadgeText: { fontSize: 11, fontWeight: '800', color: COLORS.white },
});