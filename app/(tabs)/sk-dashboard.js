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

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
export default function HomeScreen({ navigation }) {
  const router = useRouter();
  const { activeTab, setActiveTab } = useNav();
  const { logout, user } = useAuth();
  const [searchText, setSearchText] = useState('');
  const [sortBy, setSortBy] = useState('Newest');
  const [notifCount] = useState(2);
  const [sidebarVisible, setSidebarVisible] = useState(false);
  const [calendarVisible, setCalendarVisible] = useState(false); // ← NEW
  const [docStats, setDocStats] = useState({ total: 0, published: 0, drafts: 0, archived: 0 });
  const [recentActivities, setRecentActivities] = useState([]);
  const [tasks, setTasks] = useState([]);

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
        // Fetch all documents for this barangay
        const { data: documents, error } = await supabase
          .from('documents')
          .select('status')
          .eq('barangay_id', barangayId);

        if (error) {
          console.error('Error fetching documents:', error);
          return;
        }

        // Calculate stats
        const total = documents?.length || 0;
        const published = documents?.filter(d => d.status === 'published').length || 0;
        const drafts = documents?.filter(d => d.status === 'draft').length || 0;
        const archived = documents?.filter(d => d.status === 'archived').length || 0;

        setDocStats({ total, published, drafts, archived });
      } catch (error) {
        console.error('Error:', error);
      }
    };

    fetchDocuments();
  }, [barangayId]);

  // Fetch recent activities/documents for this barangay
  useEffect(() => {
    const fetchActivities = async () => {
      if (!barangayId) return;

      try {
        const { data: documents, error } = await supabase
          .from('documents')
          .select('title, status, created_at')
          .eq('barangay_id', barangayId)
          .order('created_at', { ascending: false })
          .limit(5);

        if (error) {
          console.error('Error fetching activities:', error);
          return;
        }

        const activities = documents?.map(doc => ({
          id: doc.title,
          label: doc.title,
          time: new Date(doc.created_at).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' }),
          date: new Date(doc.created_at).toLocaleDateString('en-PH', { month: 'numeric', day: 'numeric', year: '2-digit' }),
          type: doc.status === 'published' ? 'upload' : 'create',
        })) || [];

        setRecentActivities(activities);
      } catch (error) {
        console.error('Error:', error);
      }
    };

    fetchActivities();
  }, [barangayId]);

  // Fetch tasks/deadlines for this barangay
  useEffect(() => {
    const fetchTasks = async () => {
      if (!barangayId) return;

      try {
        const { data: deadlines, error } = await supabase
          .from('submission_deadlines')
          .select('*')
          .eq('barangay_id', barangayId)
          .order('deadline_date', { ascending: true });

        if (error) {
          console.error('Error fetching tasks:', error);
          return;
        }

        const taskList = deadlines?.map(d => ({
          id: d.deadline_id.toString(),
          description: d.title || d.document_type,
          action: 'Upload',
          urgent: new Date(d.deadline_date) <= new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // urgent if within 7 days
        })) || [];

        setTasks(taskList);
      } catch (error) {
        console.error('Error:', error);
      }
    };

    fetchTasks();
  }, [barangayId]);

  const handleNavPress = (tab) => {
    if (tab === 'Dashboard') router.push('/(tabs)/sk-dashboard');
    else if (tab === 'Documents') router.push('/(tabs)/sk-document');
    else if (tab === 'Planning') router.push('/(tabs)/sk-planning');
    else if (tab === 'Portal') router.push('/(tabs)/sk-portal');
    else if (tab === 'Account') router.push('/(tabs)/sk-account');
    setActiveTab(tab);
    setSidebarVisible(false);
  };

  const handleLogout = () => { logout(); router.replace('/'); };

  const sortedActivities = sortBy === 'Name'
    ? [...recentActivities].sort((a, b) => a.label.localeCompare(b.label))
    : recentActivities;

  const renderSidebar = () => (
    <View style={styles.sidebar}>
      <View style={styles.logoPill}>
        <Image source={require('./../../assets/images/sk-logo.png')} style={styles.logoImage} resizeMode="contain" />
      </View>
      <View style={styles.sidebarSpacer} />
      {['Dashboard', 'Documents', 'Planning', 'Portal', 'Account'].map((tab) => {
        const active = activeTab === tab;
        return (
          <TouchableOpacity key={tab} style={[styles.navItem, active && styles.navItemActive]} onPress={() => handleNavPress(tab)} activeOpacity={0.8}>
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

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.maroon} />

      {/* ── Calendar Modal ── */}
      <CalendarModal visible={calendarVisible} onClose={() => setCalendarVisible(false)} />

      <View style={styles.layout}>
        {isMobile && sidebarVisible && (
          <TouchableOpacity style={styles.sidebarOverlay} activeOpacity={1} onPress={() => setSidebarVisible(false)} />
        )}
        {isMobile ? (sidebarVisible && renderSidebar()) : renderSidebar()}

        <ScrollView style={[styles.main, isMobile && styles.mainMobile]} contentContainerStyle={styles.mainContent} showsVerticalScrollIndicator={false}>

          {/* Mobile Header */}
          {isMobile && (
            <View style={styles.mobileHeader}>
              <TouchableOpacity style={styles.menuBtn} onPress={() => setSidebarVisible(!sidebarVisible)}>
                <MenuIcon />
              </TouchableOpacity>
              <Text style={styles.mobileTitle}>SK Home</Text>
              <View style={styles.mobileHeaderActions}>
                <TouchableOpacity style={styles.mobileActionBtn} activeOpacity={0.7} onPress={() => setCalendarVisible(true)}>
                  <Text style={styles.mobileActionIcon}>📅</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.mobileActionBtn, styles.mobileArchivesBtn]} activeOpacity={0.7}>
                  <Text style={styles.mobileActionIcon}>🗃️</Text>
                </TouchableOpacity>
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

                {/* View Calendar — opens modal */}
                <TouchableOpacity style={styles.headerActionBtn} activeOpacity={0.7} onPress={() => setCalendarVisible(true)}>
                  <Text style={styles.headerActionIcon}>📅</Text>
                  <Text style={styles.headerActionLabel}>View Calendar</Text>
                </TouchableOpacity>

                <TouchableOpacity style={[styles.headerActionBtn, styles.archivesBtn]} activeOpacity={0.7}>
                  <Text style={styles.headerActionIcon}>🗃️</Text>
                  <Text style={[styles.headerActionLabel, styles.archivesBtnText]}>Archives</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Search */}
          <View style={styles.searchBar}>
            <SearchIcon />
            <TextInput
              style={styles.searchInput}
              placeholder="Search documents, tasks…"
              placeholderTextColor={COLORS.midGray}
              value={searchText}
              onChangeText={setSearchText}
            />
          </View>

          {/* Stats */}
          <View style={styles.statsRow}>
            {[
              { id: 'total', label: 'Total Documents', value: docStats.total, icon: '🗂️', color: '#133E75', light: '#E3EDF9' },
              { id: 'published', label: 'Published', value: docStats.published, icon: '✅', color: '#1A6B38', light: '#E8F5E9' },
              { id: 'drafts', label: 'Drafts', value: docStats.drafts, icon: '📝', color: '#A04010', light: '#FDF2EA' },
              { id: 'archived', label: 'Archived', value: docStats.archived, icon: '🗃️', color: '#5A2EA0', light: '#F2EEF9' },
            ].map((stat) => (
              <View key={stat.id} style={[styles.statCard, { backgroundColor: stat.light, borderLeftColor: stat.color }]}>
                <View style={[styles.statIconWrap, { backgroundColor: stat.color }]}>
                  <Text style={styles.statIcon}>{stat.icon}</Text>
                </View>
                <View style={styles.statInfo}>
                  <Text style={[styles.statValue, { color: stat.color }]}>{stat.value}</Text>
                  <Text style={styles.statLabel}>{stat.label}</Text>
                </View>
              </View>
            ))}
          </View>

          {/* Tasks */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.cardHeaderAccent} />
              <Text style={styles.cardTitle}>Tasks</Text>
              <View style={styles.taskBadge}><Text style={styles.taskBadgeText}>{tasks.length}</Text></View>
            </View>
            <View style={styles.tableHead}>
              <Text style={[styles.tableHeadCell, { flex: 1 }]}>Task</Text>
              <Text style={styles.tableHeadCell}>Action</Text>
            </View>
            {tasks.map((task, idx) => (
              <View key={task.id} style={[styles.tableRow, idx % 2 === 0 && styles.tableRowAlt]}>
                <View style={styles.taskDescRow}>
                  {task.urgent && <View style={styles.urgentDot} />}
                  <Text style={styles.taskDesc}>{task.description}</Text>
                </View>
                <TouchableOpacity style={[styles.actionBtn, task.action === 'Upload' ? styles.actionBtnUpload : styles.actionBtnCreate]} activeOpacity={0.8}>
                  <Text style={styles.actionBtnText}>{task.action}</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>

          {/* Recent Activity */}
          <View style={[styles.card, { marginBottom: 32 }]}>
            <View style={styles.cardHeader}>
              <View style={[styles.cardHeaderAccent, { backgroundColor: COLORS.teal }]} />
              <Text style={styles.cardTitle}>Recent Activity</Text>
              <View style={styles.sortRow}>
                <Text style={styles.sortLabel}>Sort by: </Text>
                {['Newest', 'Name'].map((s) => (
                  <TouchableOpacity key={s} onPress={() => setSortBy(s)} style={[styles.sortBtn, sortBy === s && styles.sortBtnActive]}>
                    <Text style={[styles.sortBtnText, sortBy === s && styles.sortBtnTextActive]}>{s}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            {sortedActivities.map((act, idx) => (
              <View key={act.id} style={[styles.activityRow, idx < sortedActivities.length - 1 && styles.activityRowBorder]}>
                <ActivityDot type={act.type} />
                <View style={styles.activityInfo}>
                  <Text style={styles.activityLabel}>{act.label}</Text>
                  <Text style={styles.activityMeta}>{act.type === 'upload' ? '↑ Uploaded' : '✎ Created'}</Text>
                </View>
                <View style={styles.activityTime}>
                  <Text style={styles.activityTimeText}>{act.time}</Text>
                  <Text style={styles.activityDateText}>{act.date}</Text>
                </View>
              </View>
            ))}
          </View>

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
  sidebar: {
    width: 250, backgroundColor: '#133E75',
    alignItems: 'center', paddingTop: 20, paddingBottom: 24, paddingHorizontal: 10, zIndex: 10,
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
  sidebarSpacer: { height: 28 },
  logoutBtn: {
    width: '100%', paddingVertical: 12, paddingHorizontal: 12,
    borderRadius: 24, marginTop: 8, alignItems: 'center',
    borderWidth: 1.5, borderColor: COLORS.white, backgroundColor: 'rgba(255,255,255,0.1)',
  },
  logoutText: { fontSize: 13, fontWeight: '600', color: '#ffffff', letterSpacing: 0.3 },
  navItem: {
    width: '100%', paddingVertical: 12, paddingHorizontal: 12,
    borderRadius: 24, marginBottom: 8, alignItems: 'center',
    borderWidth: 1.5, borderColor: COLORS.white, backgroundColor: '#133E75',
  },
  navItemActive: { backgroundColor: '#ffffff', borderWidth: 1.5, borderColor: '#000000' },
  navLabel: { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.8)', letterSpacing: 0.3 },
  navLabelActive: { color: '#000000', fontWeight: '800' },
  main: { flex: 1, backgroundColor: COLORS.offWhite, borderTopLeftRadius: 20 },
  mainMobile: { borderTopLeftRadius: 0 },
  mainContent: { padding: isMobile ? 12 : 20, paddingBottom: isMobile ? 24 : 40 },
  mobileHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 12, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: COLORS.lightGray,
  },
  menuBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.cardBg, alignItems: 'center', justifyContent: 'center' },
  menuIconContainer: { width: 20, height: 16, justifyContent: 'space-between' },
  menuLine: { width: 20, height: 2, backgroundColor: COLORS.maroon, borderRadius: 1 },
  mobileTitle: { fontSize: 16, fontWeight: '800', color: COLORS.darkText },
  mobileHeaderActions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  mobileActionBtn: {
    width: 32, height: 32, borderRadius: 16, backgroundColor: COLORS.cardBg,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, elevation: 2,
  },
  mobileArchivesBtn: { backgroundColor: '#133E75' },
  mobileActionIcon: { fontSize: 14 },
  header: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: isMobile ? 12 : 16 },
  headerSub: { fontSize: isMobile ? 8 : 10, fontWeight: '600', color: COLORS.subText, letterSpacing: 2, marginBottom: 2, textTransform: 'uppercase' },
  headerTitle: { fontSize: isMobile ? 16 : 20, fontWeight: '900', color: COLORS.darkText, letterSpacing: 0.5 },
  bellWrapper: { width: 20, height: 22, alignItems: 'center' },
  bellBody: { width: 14, height: 12, borderRadius: 7, borderWidth: 2, borderColor: COLORS.maroon, marginTop: 4 },
  bellBottom: { width: 8, height: 4, borderBottomLeftRadius: 4, borderBottomRightRadius: 4, backgroundColor: COLORS.maroon, marginTop: -1 },
  bellDot: { position: 'absolute', top: 0, right: 1, width: 7, height: 7, borderRadius: 4, backgroundColor: COLORS.gold, borderWidth: 1.5, borderColor: COLORS.cardBg },
  notifBadge: { position: 'absolute', top: -2, right: -2, width: 16, height: 16, borderRadius: 8, backgroundColor: COLORS.gold, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: COLORS.white },
  notifBadgeText: { fontSize: 8, fontWeight: '900', color: COLORS.maroon },
  bellBtnMobile: { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.cardBg, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 3, elevation: 2 },
  notifBadgeMobile: { position: 'absolute', top: -2, right: -2, width: 14, height: 14, borderRadius: 7, backgroundColor: COLORS.gold, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: COLORS.white },
  notifBadgeTextMobile: { fontSize: 7, fontWeight: '900', color: COLORS.maroon },
  searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.cardBg, borderRadius: isMobile ? 10 : 14, paddingHorizontal: isMobile ? 12 : 14, paddingVertical: isMobile ? 8 : 10, marginBottom: isMobile ? 14 : 20, borderWidth: 1.5, borderColor: COLORS.maroon + '33', shadowColor: COLORS.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 6, elevation: 2 },
  searchIcon: { width: 18, height: 18, marginRight: 10, justifyContent: 'center', alignItems: 'center' },
  searchCircle: { width: 11, height: 11, borderRadius: 6, borderWidth: 2, borderColor: COLORS.midGray, position: 'absolute', top: 0, left: 0 },
  searchHandle: { width: 2, height: 6, backgroundColor: COLORS.midGray, borderRadius: 1, position: 'absolute', bottom: 0, right: 1, transform: [{ rotate: '-45deg' }] },
  searchInput: { flex: 1, fontSize: isMobile ? 13 : 14, color: COLORS.darkText, padding: 0 },
  card: { backgroundColor: COLORS.cardBg, borderRadius: isMobile ? 12 : 18, marginBottom: isMobile ? 12 : 18, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 4, overflow: 'hidden' },
  cardHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: isMobile ? 12 : 16, paddingVertical: isMobile ? 10 : 14, borderBottomWidth: 1, borderBottomColor: COLORS.lightGray, gap: 8 },
  cardHeaderAccent: { width: 4, height: isMobile ? 14 : 18, borderRadius: 2, backgroundColor: COLORS.maroon },
  cardTitle: { fontSize: isMobile ? 13 : 15, fontWeight: '800', color: COLORS.darkText, flex: 1, letterSpacing: 0.2 },
  taskBadge: { backgroundColor: COLORS.maroon, borderRadius: 10, paddingHorizontal: 6, paddingVertical: 2 },
  taskBadgeText: { fontSize: 10, fontWeight: '700', color: COLORS.white },
  tableHead: { flexDirection: 'row', paddingHorizontal: isMobile ? 10 : 16, paddingVertical: isMobile ? 6 : 8, backgroundColor: COLORS.maroon + '10', borderBottomWidth: 1, borderBottomColor: COLORS.lightGray },
  tableHeadCell: { fontSize: isMobile ? 9 : 11, fontWeight: '700', color: COLORS.maroon, letterSpacing: 0.8, textTransform: 'uppercase', width: isMobile ? 60 : 70, textAlign: 'center' },
  tableRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: isMobile ? 10 : 16, paddingVertical: isMobile ? 8 : 12, borderBottomWidth: 1, borderBottomColor: COLORS.lightGray },
  tableRowAlt: { backgroundColor: COLORS.offWhite },
  taskDescRow: { flex: 1, flexDirection: 'row', alignItems: 'flex-start', gap: 6, paddingRight: 6 },
  urgentDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.maroon, marginTop: 4 },
  taskDesc: { flex: 1, fontSize: isMobile ? 11 : 13, color: COLORS.darkText, lineHeight: isMobile ? 16 : 19 },
  actionBtn: { width: isMobile ? 54 : 70, paddingVertical: isMobile ? 5 : 7, borderRadius: isMobile ? 12 : 20, alignItems: 'center' },
  actionBtnUpload: { backgroundColor: COLORS.maroon },
  actionBtnCreate: { backgroundColor: COLORS.teal },
  actionBtnText: { fontSize: isMobile ? 10 : 12, fontWeight: '700', color: COLORS.white, letterSpacing: 0.3 },
  sortRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  sortLabel: { fontSize: isMobile ? 10 : 11, color: COLORS.subText, fontWeight: '500' },
  sortBtn: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 },
  sortBtnActive: { backgroundColor: COLORS.teal + '20' },
  sortBtnText: { fontSize: isMobile ? 10 : 11, fontWeight: '600', color: COLORS.midGray },
  sortBtnTextActive: { color: COLORS.teal },
  activityRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: isMobile ? 10 : 16, paddingVertical: isMobile ? 10 : 14, gap: isMobile ? 8 : 12 },
  activityRowBorder: { borderBottomWidth: 1, borderBottomColor: COLORS.lightGray },
  activityDot: { width: 8, height: 8, borderRadius: 4 },
  activityInfo: { flex: 1 },
  activityLabel: { fontSize: isMobile ? 11 : 13, fontWeight: '600', color: COLORS.darkText, lineHeight: isMobile ? 15 : 18 },
  activityMeta: { fontSize: isMobile ? 10 : 11, color: COLORS.subText, marginTop: 2 },
  activityTime: { alignItems: 'flex-end' },
  activityTimeText: { fontSize: isMobile ? 10 : 12, fontWeight: '700', color: COLORS.maroon },
  activityDateText: { fontSize: isMobile ? 9 : 11, color: COLORS.subText, marginTop: 1 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerActionBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 7, paddingHorizontal: 12, borderRadius: 20, backgroundColor: COLORS.cardBg, borderWidth: 1, borderColor: COLORS.lightGray, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  archivesBtn: { backgroundColor: '#133E75', borderColor: '#133E75' },
  headerActionIcon: { fontSize: 16 },
  headerActionLabel: { fontSize: 12, fontWeight: '600', color: COLORS.darkText },
  archivesBtnText: { color: COLORS.white },
  statsRow: { flexDirection: isMobile ? 'column' : 'row', gap: isMobile ? 8 : 12, marginBottom: isMobile ? 14 : 20 },
  statCard: { flexDirection: 'row', alignItems: 'center', gap: isMobile ? 8 : 12, borderRadius: isMobile ? 10 : 14, paddingVertical: isMobile ? 10 : 14, paddingHorizontal: isMobile ? 10 : 14, borderLeftWidth: 4, flex: isMobile ? undefined : 1, shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.07, shadowRadius: 8, elevation: 3 },
  statIconWrap: { width: isMobile ? 36 : 44, height: isMobile ? 36 : 44, borderRadius: isMobile ? 8 : 12, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  statIcon: { fontSize: isMobile ? 16 : 20 },
  statInfo: { flex: 1 },
  statValue: { fontSize: isMobile ? 22 : 30, fontWeight: '900', lineHeight: isMobile ? 26 : 34, letterSpacing: -0.5 },
  statLabel: { fontSize: isMobile ? 10 : 11, fontWeight: '600', color: COLORS.subText, marginTop: 2, letterSpacing: 0.2 },
});