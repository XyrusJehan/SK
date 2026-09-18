import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import Head from 'expo-router/head';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Modal,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import AnnualComplianceGraph from '../components/AnnualComplianceGraph';
import TopBarangaysRanking from '../components/TopBarangaysRanking';
// NOTE: SafeAreaView from core 'react-native' only applies inset padding on
// iOS — it's a documented no-op on Android, which is why content (and the
// mobile sidebar drawer) rendered underneath the status bar there. The
// context-aware version below works correctly on both platforms.
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../utils/supabase';
import Sidebar from './../components/Sidebar';
import { useAuth } from './authContext';
import MobileHeader, { MobileHeaderSpacer } from './mobileHeader';
import { useNav } from './navContext';
import { BellIcon, NotificationModal, useNotificationCenter } from './notificationCenter';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const isMobile = SCREEN_WIDTH < 768;

// ─── PERSISTED "SEEN" COUNTS ──────────────────────────────────────────────────
// The bell badge counts how many notifications are NEW since the user last
// opened the bell modal. Those seen counts are kept in AsyncStorage so they
// survive pull-to-refresh, screen re-mounts, and app restarts.
const SEEN_KEYS = {
  approved: 'sk_notif_seen_approved',
  templates: 'sk_notif_seen_templates',
  returned: 'sk_notif_seen_returned',
  deadlines: 'sk_notif_seen_deadlines',
};

const loadSeenCounts = async () => {
  try {
    const entries = await Promise.all([
      AsyncStorage.getItem(SEEN_KEYS.approved),
      AsyncStorage.getItem(SEEN_KEYS.templates),
      AsyncStorage.getItem(SEEN_KEYS.returned),
      AsyncStorage.getItem(SEEN_KEYS.deadlines),
    ]);
    return {
      approved: parseInt(entries[0] || '0', 10) || 0,
      templates: parseInt(entries[1] || '0', 10) || 0,
      returned: parseInt(entries[2] || '0', 10) || 0,
      deadlines: parseInt(entries[3] || '0', 10) || 0,
    };
  } catch (err) {
    console.error('Error loading seen counts:', err);
    return { approved: 0, templates: 0, returned: 0, deadlines: 0 };
  }
};

const saveSeenCounts = async (counts) => {
  try {
    await Promise.all([
      AsyncStorage.setItem(SEEN_KEYS.approved, String(counts.approved || 0)),
      AsyncStorage.setItem(SEEN_KEYS.templates, String(counts.templates || 0)),
      AsyncStorage.setItem(SEEN_KEYS.returned, String(counts.returned || 0)),
      AsyncStorage.setItem(SEEN_KEYS.deadlines, String(counts.deadlines || 0)),
    ]);
  } catch (err) {
    console.error('Error saving seen counts:', err);
  }
};

// Supabase timestamps have no 'Z' suffix — JS mis-parses them as local time.
// toUtcDate forces correct UTC parsing before PHT display.
const toUtcDate = (dateStr) => {
  if (!dateStr) return new Date();
  if (dateStr instanceof Date) return dateStr;
  const iso = String(dateStr).replace(' ', 'T').replace(/Z?$/, 'Z');
  return new Date(iso);
};

const toPhilippineDate = (dateStr, options) => {
  if (!dateStr) return '';
  const d = toUtcDate(dateStr);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-PH', { timeZone: 'Asia/Manila', ...options });
};

const toPhilippineTime = (dateStr, options) => {
  if (!dateStr) return '';
  const d = toUtcDate(dateStr);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('en-PH', { timeZone: 'Asia/Manila', ...options });
};

const COLORS = {
  maroon: '#8B0000', maroonDark: '#6B0000', maroonLight: '#A50000',
  gold: '#E8C547', accent: '#D4A017', calGold: '#E8A020',
  white: '#FFFFFF', offWhite: '#F7F5F2', lightGray: '#ECECEC',
  midGray: '#B0B0B0', darkText: '#1A1A1A', subText: '#666666',
  teal: '#2A7B7B', cardBg: '#FFFFFF', shadow: 'rgba(0,0,0,0.08)',
  navy: '#133E75',
};

// ─── HEROUI-INSPIRED DESIGN TOKENS ────────────────────────────────────────────
// Mirrors HeroUI's default theme (neutral "default" scale + semantic colors +
// radius scale) so RN components read as HeroUI Cards/Chips/Buttons even
// though the actual HeroUI package can't run on React Native. The app's navy
// is kept as "primary" so this stays on-brand with the rest of the screen.
const HERO = {
  primary: COLORS.navy, primary50: '#EEF3FA', primary100: '#DCE7F4', primary600: '#0F2F58',
  secondary: '#9353D3', secondary50: '#F2EAFA', secondary100: '#E4D4F4', secondary600: '#6F2DA8',
  success: '#17C964', success50: '#EFFCF4', success100: '#D7F5E3', success600: '#12A150',
  warning: '#F5A524', warning50: '#FEF7EC', warning100: '#FCEACB', warning600: '#B45309',
  danger: '#F31260', danger50: '#FEF0F4',
  default50: '#FAFAFA', default100: '#F4F4F5', default200: '#E4E4E7', default300: '#D4D4D8',
  default500: '#71717A', foreground: '#11181C', white: '#FFFFFF',
  radiusSm: 8, radiusMd: 12, radiusLg: 16, radiusXl: 22, radiusFull: 999,
  shadowSm: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 3, elevation: 2 },
  shadowMd: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.10, shadowRadius: 10, elevation: 6 },
};

// Chip background / icon color / accent border per tone, for the top stat
// cards row — same bg50 + color600 pairing as QUICK_ACTION_TONES.
const STAT_TONES = {
  primary: { chipBg: HERO.primary50, chipColor: HERO.primary, accent: HERO.primary },
  success: { chipBg: HERO.success50, chipColor: HERO.success600, accent: HERO.success },
  warning: { chipBg: HERO.warning50, chipColor: HERO.warning600, accent: HERO.warning },
  danger: { chipBg: HERO.danger50, chipColor: HERO.danger, accent: HERO.danger },
};

// Chip background / icon color per activity type — same tone pattern as
// QUICK_ACTION_TONES / STAT_TONES, used by the Recent Activity list.
const ACTIVITY_TONES = {
  submit: { chipBg: HERO.success50, chipColor: HERO.success600 },
  returned: { chipBg: HERO.warning50, chipColor: HERO.warning600 },
  scan: { chipBg: HERO.secondary50, chipColor: HERO.secondary600 },
  create: { chipBg: HERO.primary50, chipColor: HERO.primary },
};

const CAL_MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const CAL_DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const CAL_DOWS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

// Nav icons + NAV_ITEMS now live in the shared Sidebar module (see import above).

// ─── ICON COMPONENTS ──────────────────────────────────────────────────────────
// BellIcon now lives in notificationCenter.js and is imported above — kept
// there so every screen (SK + LYDO) shares one definition instead of each
// file redrawing its own bell.

const SearchIcon = () => (
  <View style={styles.searchIcon}>
    <View style={styles.searchCircle} />
    <View style={styles.searchHandle} />
  </View>
);

const ActivityDot = ({ type }) => (
  <View style={[styles.activityDot, { backgroundColor: type === 'upload' ? COLORS.accent : COLORS.teal }]} />
);

// ─── ANNUAL COMPLIANCE TIMELINE ──────────────────────────────────────────────
// Timeline entries are now derived live from submission_deadlines (see
// CalendarModal below) instead of this static mock list.

// ─── CALENDAR MODAL ───────────────────────────────────────────────────────────
function CalendarModal({ visible, onClose, barangayId }) {
  const now = new Date();
  const todayY = now.getFullYear();
  const todayM = now.getMonth();
  const todayD = now.getDate();

  const [cur, setCur] = useState({ y: todayY, m: todayM });
  const [tooltip, setTooltip] = useState(null); // { day, label }
  const [yearDeadlines, setYearDeadlines] = useState([]); // raw rows for cur.y
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(null);

  // Parse a Postgres `date` (YYYY-MM-DD) without timezone drift.
  const parseIsoDate = (isoDateString) => {
    const [y, m, d] = isoDateString.slice(0, 10).split('-').map(Number);
    return { y, m: m - 1, d };
  };

  const labelFor = (row) => row.description || row.document_type;

  // ── Fetch every deadline that falls within the currently displayed year ──
  useEffect(() => {
    if (!visible || !barangayId) return;
    let cancelled = false;

    const fetchYearDeadlines = async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const from = `${cur.y}-01-01`;
        const to = `${cur.y}-12-31`;
        const { data, error } = await supabase
          .from('submission_deadlines')
          .select('deadline_id, document_type, description, deadline_date, is_met')
          .eq('barangay_id', barangayId)
          .gte('deadline_date', from)
          .lte('deadline_date', to)
          .order('deadline_date', { ascending: true });

        if (error) throw error;
        if (!cancelled) setYearDeadlines(data || []);
      } catch (err) {
        console.error('Error fetching deadlines:', err);
        if (!cancelled) setLoadError('Could not load deadlines.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchYearDeadlines();
    return () => { cancelled = true; };
  }, [visible, barangayId, cur.y]);

  // ── Deadlines that fall in the month currently on screen, keyed by day ──
  const monthDeadlines = React.useMemo(() => {
    const map = {};
    yearDeadlines.forEach((row) => {
      const { y, m, d } = parseIsoDate(row.deadline_date);
      if (y === cur.y && m === cur.m) {
        if (!map[d]) map[d] = [];
        map[d].push(row);
      }
    });
    return map;
  }, [yearDeadlines, cur.y, cur.m]);

  const isDeadline = (d) => !!monthDeadlines[d];
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
    if (monthDeadlines[d]) {
      const items = monthDeadlines[d].map((row) => ({ label: labelFor(row), isMet: !!row.is_met }));
      setTooltip(tooltip?.day === d ? null : { day: d, items });
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
      const dayDeadlines = monthDeadlines[d];
      const total = dayDeadlines ? dayDeadlines.length : 0;
      const metCount = dayDeadlines ? dayDeadlines.filter((r) => r.is_met).length : 0;
      const deadlineStatus = total === 0 ? null : metCount === total ? 'met' : metCount === 0 ? 'pending' : 'partial';
      cells.push({
        day: d, ghost: false,
        deadline: isDeadline(d),
        deadlineStatus,
        metCount,
        totalCount: total,
        items: dayDeadlines ? dayDeadlines.map((r) => ({ isMet: !!r.is_met })) : [],
        caption: total === 1 ? dayDeadlines[0].document_type : total > 1 ? `${total} deadlines` : null,
        today: isToday(cur.y, cur.m, d),
      });
    }
    const tail = (firstDow + dim) % 7;
    if (tail > 0) for (let i = 1; i <= 7 - tail; i++) cells.push({ day: i, ghost: true });
    return cells;
  };

  const cells = buildCells();

  // ── Annual Compliance Timeline (right panel) — every deadline this year ──
  const todayIso = `${todayY}-${String(todayM + 1).padStart(2, '0')}-${String(todayD).padStart(2, '0')}`;
  const nextUpcomingId = React.useMemo(() => {
    const upcoming = yearDeadlines.filter((r) => r.deadline_date >= todayIso);
    return upcoming.length > 0 ? upcoming[0].deadline_id : null;
  }, [yearDeadlines, todayIso]);

  const timelineRows = yearDeadlines.map((row) => {
    const { m, d } = parseIsoDate(row.deadline_date);
    return {
      id: row.deadline_id,
      month: `${CAL_MONTHS[m].slice(0, 3)} ${d}`,
      label: labelFor(row),
      highlight: row.deadline_id === nextUpcomingId,
      isMet: !!row.is_met,
    };
  });

  const timelineGroups = React.useMemo(() => {
    const groups = [];
    timelineRows.forEach((row) => {
      const last = groups[groups.length - 1];
      if (last && last.month === row.month) {
        last.items.push(row);
        if (row.highlight) last.highlight = true;
      } else {
        groups.push({ month: row.month, items: [row], highlight: row.highlight });
      }
    });
    return groups;
  }, [timelineRows]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={calStyles.backdrop}>
        <View style={calStyles.modal}>
          <View style={calStyles.modalHeader}>
            <View>
              <Text style={calStyles.modalEyebrow}>COMPLIANCE CALENDAR</Text>
              <Text style={calStyles.modalTitle}>Annual Compliance Monitoring</Text>
            </View>
            <TouchableOpacity style={calStyles.closeBtn} onPress={onClose} activeOpacity={0.75}>
              <Text style={calStyles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>
          <View style={calStyles.body}>

            {/* ── Left: Calendar Panel ── */}
            <View style={calStyles.calPanel}>
              {/* Nav header */}
              <View style={calStyles.calNav}>
                <TouchableOpacity style={calStyles.navBtn} onPress={() => shiftMonth(-1)} activeOpacity={0.8}>
                  <Text style={calStyles.navArrow}>‹</Text>
                </TouchableOpacity>
                <Text style={calStyles.monthLabel}>{CAL_MONTHS[cur.m].toUpperCase()} {cur.y}</Text>
                <TouchableOpacity style={calStyles.navBtn} onPress={() => shiftMonth(1)} activeOpacity={0.8}>
                  <Text style={calStyles.navArrow}>›</Text>
                </TouchableOpacity>
              </View>

              {/* Legend */}
              <View style={calStyles.legendRow}>
                <View style={[calStyles.legendChip, { backgroundColor: HERO.success50 }]}>
                  <View style={[calStyles.legendDot, { backgroundColor: HERO.success }]} />
                  <Text style={[calStyles.legendText, { color: HERO.success600 }]}>Met</Text>
                </View>
                <View style={[calStyles.legendChip, { backgroundColor: HERO.warning50 }]}>
                  <View style={[calStyles.legendDot, { backgroundColor: HERO.warning }]} />
                  <Text style={[calStyles.legendText, { color: HERO.warning600 }]}>Pending</Text>
                </View>
                <View style={[calStyles.legendChip, { backgroundColor: HERO.default100 }]}>
                  <View style={calStyles.legendSplitDot}>
                    <View style={calStyles.legendSplitTop} />
                    <View style={calStyles.legendSplitBottom} />
                  </View>
                  <Text style={[calStyles.legendText, { color: HERO.default500 }]}>Partially met</Text>
                </View>
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
                  const weekend = idx % 7 === 0 || idx % 7 === 6;
                  const visibleDots = cell.items ? cell.items.slice(0, 4) : [];
                  const extraDots = (cell.items ? cell.items.length : 0) - visibleDots.length;
                  return (
                    <View
                      key={idx}
                      style={[calStyles.dayCellWrap, showTooltip && calStyles.dayCellWrapActive]}
                    >
                      <TouchableOpacity
                        style={[
                          calStyles.dayCell,
                          !cell.ghost && weekend && calStyles.dayCellWeekend,
                          cell.ghost && calStyles.dayCellGhost,
                          !cell.ghost && cell.deadlineStatus === 'pending' && calStyles.dayCellTintPending,
                          !cell.ghost && cell.deadlineStatus === 'met' && calStyles.dayCellTintMet,
                          !cell.ghost && cell.deadlineStatus === 'partial' && calStyles.dayCellTintPartial,
                          !cell.ghost && cell.today && calStyles.dayCellToday,
                        ]}
                        onPress={() => !cell.ghost && pickDay(cell.day)}
                        activeOpacity={cell.ghost ? 1 : 0.75}
                        disabled={cell.ghost}
                      >
                        {!cell.ghost && cell.deadlineStatus === 'met' && <View style={calStyles.dayCellAccentMet} />}
                        {!cell.ghost && cell.deadlineStatus === 'pending' && <View style={calStyles.dayCellAccentPending} />}
                        {!cell.ghost && cell.deadlineStatus === 'partial' && (
                          <>
                            <View style={calStyles.dayCellAccentPartialTop} />
                            <View style={calStyles.dayCellAccentPartialBottom} />
                          </>
                        )}

                        <Text style={[
                          calStyles.dayText,
                          cell.ghost && calStyles.dayTextGhost,
                        ]}>
                          {cell.day}
                        </Text>

                        {!cell.ghost && cell.deadline && (
                          <>
                            <View style={calStyles.dotCluster}>
                              {visibleDots.map((it, i) => (
                                <View key={i} style={[calStyles.dot, it.isMet ? calStyles.dotMet : calStyles.dotPending]} />
                              ))}
                              {extraDots > 0 && <Text style={calStyles.dotExtra}>+{extraDots}</Text>}
                            </View>
                            <Text style={calStyles.dayCellCaption} numberOfLines={1}>{cell.caption}</Text>
                          </>
                        )}
                        {!cell.ghost && cell.today && (
                          <Text style={calStyles.todayTag}>TODAY</Text>
                        )}
                      </TouchableOpacity>
                      {/* Tooltip popover */}
                      {showTooltip && (
                        <View style={calStyles.tooltip}>
                          <Text style={calStyles.tooltipDate}>
                            {CAL_MONTHS[cur.m]} {cell.day}
                          </Text>
                          {tooltip.items.map((it, i) => (
                            <View key={i} style={calStyles.tooltipItemRow}>
                              <View style={[calStyles.tooltipDot, it.isMet ? calStyles.tooltipDotMet : calStyles.tooltipDotPending]} />
                              <Text style={calStyles.tooltipItemText}>{it.label}</Text>
                              <Text style={[calStyles.tooltipStatusText, it.isMet ? calStyles.tooltipStatusMetText : calStyles.tooltipStatusPendingText]}>
                                {it.isMet ? 'Met' : 'Pending'}
                              </Text>
                            </View>
                          ))}
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
                <Text style={calStyles.sidePanelTitle}>Annual Compliance Timeline</Text>
                <Text style={calStyles.sidePanelYear}>{cur.y}</Text>
              </View>

              {loading ? (
                <View style={calStyles.sideEmptyState}>
                  <ActivityIndicator color={COLORS.navy} />
                </View>
              ) : loadError ? (
                <View style={calStyles.sideEmptyState}>
                  <Text style={calStyles.sideEmptyText}>{loadError}</Text>
                </View>
              ) : timelineGroups.length === 0 ? (
                <View style={calStyles.sideEmptyState}>
                  <Text style={calStyles.sideEmptyText}>No deadlines set for {cur.y} yet.</Text>
                </View>
              ) : (
                <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
                  {timelineGroups.map((group, gi) => (
                    <View key={gi} style={[calStyles.timelineGroup, group.highlight && calStyles.timelineGroupHighlight]}>
                      <View style={calStyles.timelineGroupHeader}>
                        <Text style={[calStyles.timelineMonth, group.highlight && calStyles.timelineMonthHighlight]}>
                          {group.month}
                        </Text>
                        {group.highlight && <Text style={calStyles.nextBadge}>NEXT</Text>}
                      </View>
                      {group.items.map((item) => (
                        <View key={item.id} style={calStyles.timelineItemRow}>
                          <View style={[calStyles.timelineStatusIcon, item.isMet ? calStyles.timelineStatusIconMet : calStyles.timelineStatusIconPending]}>
                            <Text style={calStyles.timelineStatusIconText}>{item.isMet ? '✓' : '•'}</Text>
                          </View>
                          <Text style={calStyles.timelineLabel} numberOfLines={2}>{item.label}</Text>
                        </View>
                      ))}
                    </View>
                  ))}
                </ScrollView>
              )}
            </View>

          </View>
        </View>
      </View>
    </Modal>
  );
}

// ─── APPROACHING DEADLINES ────────────────────────────────────────────────────
// Now derived live from submission_deadlines (see fetchTasks below) instead of
// this static mock list.

// ─── QUICK ACTIONS DATA ───────────────────────────────────────────────────────
// Badge values will be dynamically updated in the render. Tones map to the
// HeroUI-inspired semantic palette (HERO) rather than raw hex per action.
const SK_QUICK_ACTIONS = [
  { id: 'proposal', label: 'Create Proposal', icon: '🔔', tone: 'primary' },
  { id: 'drafts', label: 'View Drafts', icon: '📋', tone: 'primary' },
  { id: 'logs', label: 'Activity logs', icon: '📝', tone: 'primary' },
  { id: 'upload', label: 'Scan & Upload', icon: '📄', tone: 'primary', isScan: true },
  { id: 'consultation', label: 'Consultation', icon: '💬', tone: 'primary' },
  { id: 'calendar', label: 'View Deadline Calendar', icon: '📅', tone: 'warning', badgeProp: 'deadlinesCount' },
  { id: 'archive', label: 'View Archive', icon: '🗃', tone: 'default' },
  { id: 'returned', label: 'Returned Proposal', icon: '↩', tone: 'secondary', badgeProp: 'returnedProposalsCount' },
];

// Chip background / icon color per tone — same bg50 + color600 pairing used
// by the HeroUI-style status chips elsewhere in the app (see STATUS_META in
// AnnualComplianceGraph).
const QUICK_ACTION_TONES = {
  primary: { chipBg: HERO.primary50, chipColor: HERO.primary },
  warning: { chipBg: HERO.warning50, chipColor: HERO.warning600 },
  secondary: { chipBg: HERO.secondary50, chipColor: HERO.secondary600 },
  default: { chipBg: HERO.default100, chipColor: HERO.default500 },
};

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
export default function HomeScreen({ navigation }) {
  const router = useRouter();
  const { activeTab, setActiveTab } = useNav();
  const { logout, user } = useAuth();
  const barangayName = user?.barangay?.barangay_name || 'Unknown Barangay';
  const barangayId = user?.barangayId;
  const notificationCenter = useNotificationCenter(barangayId);
  const [sidebarVisible, setSidebarVisible] = useState(false);
  const [calendarVisible, setCalendarVisible] = useState(false);
  const [docStats, setDocStats] = useState({ total: 0, submitted: 0, forRevision: 0, approved: 0, drafts: 0 });
  const [recentActivities, setRecentActivities] = useState([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const [complianceTasks, setComplianceTasks] = useState([]);

  useEffect(() => {
    if (user && user.role !== 'sk') router.replace('/');
  }, [user]);

  // Load persisted "seen" counts once on mount so the bell badge doesn't show
  // stale notifications as "new" after a refresh or app restart.
  // NOTE: This logic is now handled by useNotificationCenter hook, so we remove this effect.

  // Fetch documents filtered by barangay_id
  const fetchDocuments = useCallback(async () => {
    if (!barangayId) return;
    try {
      const { data: documents, error } = await supabase
        .from('documents')
        .select('document_id, status, title, created_at, submitted_at, saved_at, reviewed_at')
        .eq('barangay_id', barangayId)
        .order('created_at', { ascending: false });

      if (error) { console.error('Error fetching documents:', error); return; }

      const total = documents?.length || 0;
      const submitted = documents?.filter(d => ['submitted', 'approved', 'returned'].includes(d.status)).length || 0;
      const forRevision = documents?.filter(d => d.status === 'returned').length || 0;
      const approved = documents?.filter(d => d.status === 'approved').length || 0;
      const drafts = documents?.filter(d => d.status === 'draft').length || 0;

      setDocStats({ total, submitted, forRevision, approved, drafts });
    } catch (error) { console.error('Error:', error); }
  }, [barangayId, refreshKey]);

  // Fetch recent activity from sk_activity_logs (same source as sk-logs.js)
  const fetchRecentActivities = useCallback(async () => {
    if (!barangayId) return;
    try {
      // 1. Get all users in this barangay to map user_id → officer info
      const { data: barangayUsers, error: usersError } = await supabase
        .from('users')
        .select('user_id, first_name, last_name, middle_initial, position')
        .eq('barangay_id', barangayId);

      if (usersError || !barangayUsers || barangayUsers.length === 0) {
        setRecentActivities([]);
        return;
      }

      const userMap = {};
      barangayUsers.forEach((u) => {
        const nameParts = [u.first_name, u.middle_initial, u.last_name].filter(Boolean);
        userMap[u.user_id] = {
          fullName: nameParts.join(' '),
          position: u.position
            ? u.position.charAt(0).toUpperCase() + u.position.slice(1)
            : 'Officer',
        };
      });

      const barangayUserIds = barangayUsers.map((u) => u.user_id);

      // 2. Fetch the latest activity logs for those users
      const { data, error } = await supabase
        .from('sk_activity_logs')
        .select('id, action, description, created_at, user_id')
        .in('user_id', barangayUserIds)
        .order('created_at', { ascending: false })
        .limit(5);

      if (error || !data) {
        setRecentActivities([]);
        return;
      }

      // 3. Map into dashboard's existing { label, role, time, date, type } shape
      const acts = data.map((row) => {
        const officer = userMap[row.user_id] || { fullName: 'Unknown', position: 'Officer' };
        const action = row.action || 'Create document';
        // Map action strings to the dashboard's icon type
        let type = 'create';
        if (action === 'Submit to LYDO') type = 'submit';
        else if (action === 'Scan & upload') type = 'scan';
        else if (action === 'Upload to website') type = 'submit';
        else if (action === 'Return document') type = 'returned';

        return {
          id: row.id,
          label: row.description || action,
          role: `${officer.fullName} · ${officer.position}`,
          time: toPhilippineTime(row.created_at, { hour: 'numeric', minute: '2-digit', hour12: true }),
          date: toPhilippineDate(row.created_at, { month: 'short', day: 'numeric', year: 'numeric' }),
          type,
        };
      });

      setRecentActivities(acts);
    } catch (err) {
      console.error('Error fetching recent activities:', err);
      setRecentActivities([]);
    }
  }, [barangayId, refreshKey]);

  // Parse a Postgres `date` (YYYY-MM-DD) as a UTC midnight instant, avoiding
  // local-timezone drift that could shift the day by ±1.
  const parseDateOnly = (dateStr) => {
    const [y, m, d] = dateStr.toString().slice(0, 10).split('-').map(Number);
    return Date.UTC(y, m - 1, d);
  };

  // Helper to map document_type to folder_category
  const getFolderCategory = (docType) => {
    const planningTypes = [
      'Comprehensive Barangay Youth Development Plan (CBYDP)',
      'Annual Barangay Youth Investment Program (ABYIP)',
      'SK PPK Template', 'Program of Work', 'Work Plans', 'Project Proposals',
    ];
    const financialTypes = [
      'Approved Annual Budget', 'SK Supplemental Budget',
      'Registry of Cash Receipts and Deposits', 'Registry of Cash Disbursements',
      'Monthly Itemized List', 'Quarterly Financial Reports',
      'Disbursement Vouchers', 'Liquidation Reports',
    ];
    const governanceTypes = ['Resolutions', 'Ordinances'];
    const performanceTypes = [
      'Accomplishment Reports', 'Documentation', 'Event Reports', 'Minutes of Meetings',
      'Barangay Youth Investment Monitoring Form', 'Monthly/Quarterly Accomplishment Report',
    ];

    if (planningTypes.includes(docType)) return 'planning';
    if (financialTypes.includes(docType)) return 'financial';
    if (governanceTypes.includes(docType)) return 'governance';
    if (performanceTypes.includes(docType)) return 'performance';
    return null;
  };

  // Handle compliance task button click
  const handleTaskAction = async (task) => {
    // If already completed, do nothing
    if (task.isMet) return;

    try {
      // First, find the matching document type ID from document_types table
      // The description/document_type from submission_deadlines may be the full name or shorthand
      const { data: docTypeRecords } = await supabase
        .from('document_types')
        .select('id, document_type')
        .or(`document_type.ilike.%${task.description}%,document_type.ilike.%${task.document_type}%`)
        .limit(1);

      const docTypeId = docTypeRecords && docTypeRecords.length > 0
        ? String(docTypeRecords[0].id)
        : task.document_type;

      // Check if document already exists for this document type
      const { data: existingDocs } = await supabase
        .from('documents')
        .select('document_id, status')
        .eq('barangay_id', barangayId)
        .eq('document_type', docTypeId)
        .in('status', ['saved', 'submitted', 'approved', 'returned'])
        .limit(1);

      const folderCategory = task.folder_category || getFolderCategory(task.document_type);

      if (existingDocs && existingDocs.length > 0) {
        // Document exists - go to document management Saved tab
        router.push({ pathname: '/(tabs)/sk-document-management', params: { initialTab: 'Saved' } });
      } else {
        // Document doesn't exist - go to document list with upload modal
        // Use document_type for querying, but pass description for the title display
        router.push({
          pathname: '/(tabs)/sk-document-list',
          params: {
            category: folderCategory ? folderCategory.charAt(0).toUpperCase() + folderCategory.slice(1) : 'Planning',
            subType: docTypeId,
            docTitle: task.description,
            openUpload: 'true',
          },
        });
      }
    } catch (error) {
      console.error('Error checking document status:', error);
      // Default to going to document list
      router.push({ pathname: '/(tabs)/sk-document-list' });
    }
  };

  // Fetch compliance tasks/deadlines
  const fetchTasks = useCallback(async () => {
    if (!barangayId) return;
    try {
      const { data: deadlines, error } = await supabase
        .from('submission_deadlines')
        .select('*')
        .eq('barangay_id', barangayId)
        .order('deadline_date', { ascending: true });

      if (error) { console.error('Error fetching tasks:', error); return; }

      // Get all document types to map short codes to IDs
      const { data: docTypes } = await supabase
        .from('document_types')
        .select('id, document_type');

      // Build a map of document_type names/shortcodes to IDs
      const docTypeToId = {};
      (docTypes || []).forEach(dt => {
        const name = (dt.document_type || '').trim().toLowerCase();
        docTypeToId[name] = String(dt.id);
        const shortMatch = name.match(/\b\w/g);
        if (shortMatch) {
          docTypeToId[shortMatch.join('')] = String(dt.id);
        }
      });

      // Get all approved documents for this barangay
      const { data: docs } = await supabase
        .from('documents')
        .select('document_id, document_type, status, title')
        .eq('barangay_id', barangayId)
        .eq('status', 'approved');

      // Build a map: document_type_id -> exists
      const approvedDocsSet = new Set((docs || []).map(d => d.document_type));

      const now = new Date().toISOString();
      const taskList = [];

      for (const d of (deadlines || [])) {
        const docType = d.document_type;
        const descFromDeadline = (d.description || '').toLowerCase().trim();

        // Find matching document type ID
        let docTypeId = docTypeToId[docType.toUpperCase()] ||
          docTypeToId[docType.toLowerCase()] ||
          docTypeToId[descFromDeadline];

        if (!docTypeId) {
          const matched = (docTypes || []).find(dt =>
            (dt.document_type || '').toLowerCase().includes(descFromDeadline) ||
            descFromDeadline.includes((dt.document_type || '').toLowerCase().trim())
          );
          if (matched) {
            docTypeId = String(matched.id);
          }
        }

        // Check if there's an approved document
        const hasApprovedDoc = docTypeId ? approvedDocsSet.has(docTypeId) : false;

        // If deadline says not met but there's an approved doc, update it
        let isMet = !!d.is_met;
        if (!isMet && hasApprovedDoc) {
          await supabase
            .from('submission_deadlines')
            .update({ is_met: true, met_at: now })
            .eq('deadline_id', d.deadline_id);
          isMet = true;
        }

        const folderCategory = getFolderCategory(docType);
        taskList.push({
          id: d.deadline_id.toString(),
          description: d.description || docType,
          action: d.action_type === 'publish' ? 'Publish' : 'Submit',
          urgent: new Date(d.deadline_date) <= new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          isMet: isMet,
          document_type: docType,
          folder_category: folderCategory,
        });
      }
      setComplianceTasks(taskList);
    } catch (error) { console.error('Error:', error); }
  }, [barangayId, refreshKey]);

  // Refresh all data whenever the screen comes into focus.
  // The focus effect bumps refreshKey; the effect below listens for that bump
  // and re-invokes every fetch, so the dashboard always shows the latest server data.
  useFocusEffect(
    useCallback(() => {
      setRefreshKey((k) => k + 1);
    }, [])
  );

  useEffect(() => {
    if (!barangayId) return;
    fetchDocuments();
    fetchTasks();
    fetchRecentActivities();
  }, [refreshKey, barangayId, fetchDocuments, fetchTasks, fetchRecentActivities]);

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

  const activityIcon = (type) => {
    if (type === 'submit') return '↑';
    if (type === 'returned') return '↩';
    if (type === 'scan') return '↓';
    return '✎';
  };

  const renderSidebar = () => (
    <Sidebar
      activeTab={activeTab}
      onNavPress={handleNavPress}
      onLogout={handleLogout}
      isMobile={isMobile}
      sidebarVisible={sidebarVisible}
    />
  );

  return (
    <>
      <Head>
        <title>Dashboard · SK Monitoring</title>
      </Head>
      <SafeAreaView style={styles.safe} edges={isMobile ? ['left', 'right', 'bottom'] : ['top', 'left', 'right', 'bottom']}>
        <StatusBar barStyle="light-content" backgroundColor={COLORS.navy} />

        {/* ── Calendar Modal ── */}
        <CalendarModal visible={calendarVisible} onClose={() => setCalendarVisible(false)} barangayId={barangayId} />

        {/* ── Notification Modal ── */}
        <NotificationModal
          visible={notificationCenter.visible}
          onClose={notificationCenter.close}
          returnedDocuments={notificationCenter.returnedDocuments}
          approvedDocuments={notificationCenter.approvedDocuments}
          forwardedTemplates={notificationCenter.forwardedTemplates}
          approachingDeadlines={notificationCenter.approachingDeadlines}
          reminders={notificationCenter.reminders}
          unviewedCounts={notificationCenter.unviewedCounts}
          onViewCategory={notificationCenter.onViewCategory}
          onMarkAllRead={notificationCenter.onMarkAllRead}
          onOpenRoute={(route) => {
            notificationCenter.close();
            // Tiny delay so the modal close animation can complete before push.
            setTimeout(() => router.push(route), 120);
          }}
        />

        <View style={styles.layout}>
          {isMobile && sidebarVisible && (
            <TouchableOpacity style={styles.sidebarOverlay} activeOpacity={1} onPress={() => setSidebarVisible(false)} />
          )}
          {renderSidebar()}

          <View style={[styles.main, isMobile && styles.mainMobile]}>
            <MobileHeader
              title="SK Dashboard"
              onMenuPress={() => setSidebarVisible(!sidebarVisible)}
              onBellPress={() => notificationCenter.setVisible(true)}
              bellCount={notificationCenter.count}
              BellIcon={BellIcon}
              hidden={sidebarVisible}
              colors={COLORS}

            />
            <ScrollView style={styles.mainScroll} contentContainerStyle={styles.mainContent} showsVerticalScrollIndicator={false}>
              <MobileHeaderSpacer />

              {/* Desktop Header */}
              {!isMobile && (
                <View style={styles.header}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.headerSub}>SANGGUNIANG KABATAAN</Text>
                    <Text style={styles.headerTitle}>{barangayName.toUpperCase()}</Text>
                  </View>
                  <View style={styles.headerActions}>
                    <TouchableOpacity style={styles.bellBtn} activeOpacity={0.7} onPress={() => {
                      notificationCenter.setVisible(true);
                    }}>
                      <BellIcon count={notificationCenter.count} />
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {/* ── STAT CARDS ROW ── */}
              <View style={isMobile ? styles.statsCol : styles.statsRow}>
                {[
                  { id: 'total', label: 'Total Documents', sub: 'This Fiscal Year', value: docStats.total, icon: '🗂️', tone: 'primary' },
                  { id: 'submitted', label: 'Total Submitted', sub: null, value: docStats.submitted, icon: '📋', tone: 'success' },
                  { id: 'revision', label: 'For Revision', sub: null, value: docStats.forRevision, icon: '✏️', tone: 'warning' },
                  { id: 'approved', label: 'Approved', sub: null, value: docStats.approved, icon: '✅', tone: 'success' },
                  { id: 'drafts', label: 'Total Drafts', sub: null, value: docStats.drafts, icon: '📝', tone: 'danger' },
                ].map((stat) => {
                  const tone = STAT_TONES[stat.tone] || STAT_TONES.primary;
                  return (
                    <View key={stat.id} style={[styles.heroStatCard, { borderTopColor: tone.accent }]}>
                      <View style={[styles.heroStatIconWrap, { backgroundColor: tone.chipBg }]}>
                        <Text style={styles.heroStatIcon}>{stat.icon}</Text>
                      </View>
                      <Text style={[styles.heroStatValue, { color: tone.chipColor }]}>{stat.value}</Text>
                      <Text style={styles.heroStatLabel}>{stat.label}</Text>
                      {stat.sub ? <Text style={styles.heroStatSub}>{stat.sub}</Text> : null}
                    </View>
                  );
                })}
              </View>

              {/* Annual Compliance Graph */}
              <AnnualComplianceGraph />

              {/* ── APPROACHING DEADLINE ── */}

              {/* ── APPROACHING DEADLINE ── */}
              <View style={styles.deadlineCard}>
                <View style={styles.deadlineHeader}>
                  <View style={styles.deadlineHeaderLeft}>
                    <Text style={styles.deadlineIcon}>⏰</Text>
                    <Text style={styles.deadlineTitle}>Approaching  Deadline</Text>
                  </View>
                  <TouchableOpacity onPress={() => notificationCenter.setVisible(true)}>
                    <Text style={styles.viewAll}>View All</Text>
                  </TouchableOpacity>
                </View>
                {notificationCenter.approachingDeadlines.length > 0 ? (
                  notificationCenter.approachingDeadlines.slice(0, 5).map((item) => (
                    <View key={item.id} style={styles.deadlineRow}>
                      <Text style={styles.deadlineDocTitle}>{item.title}</Text>
                      <Text style={styles.deadlineDate}>
                        <Text style={styles.deadlineDateLabel}>Deadline: </Text>{item.deadline}
                      </Text>
                      <Text style={[styles.daysLeft, item.urgent ? styles.daysLeftUrgent : styles.daysLeftNormal]}>
                        {item.daysLeft < 0
                          ? `${Math.abs(item.daysLeft)} Day${Math.abs(item.daysLeft) !== 1 ? 's' : ''} Overdue`
                          : item.daysLeft === 0
                            ? 'Due Today'
                            : `${item.daysLeft} Day${item.daysLeft !== 1 ? 's' : ''} Left`}
                      </Text>
                    </View>
                  ))
                ) : (
                  <Text style={styles.deadlineEmptyText}>{"No upcoming deadlines — you're all caught up."}</Text>
                )}
              </View>

              {/* ── BOTTOM TWO COLUMNS ── */}
              <View style={isMobile ? styles.twoColColumn : styles.twoColRow}>

                {/* Left: Compliance Tasks + Recent Activity */}
                <View style={[styles.flex1_5, { gap: 14 }]}>

                  {/* Compliance Tasks */}
                  <View style={styles.heroCard}>
                    <View style={styles.heroCardHeaderRow}>
                      <Text style={styles.heroCardTitle}>Compliance Tasks</Text>
                      <TouchableOpacity><Text style={styles.heroViewAll}>View All</Text></TouchableOpacity>
                    </View>
                    {complianceTasks.length > 0 ? (
                      complianceTasks.map((task, idx, arr) => (
                        <View key={task.id} style={[styles.heroTaskRow, idx < arr.length - 1 && styles.heroTaskRowBorder]}>
                          <View style={[styles.heroTaskStatusDot, task.isMet ? styles.heroTaskStatusDotMet : styles.heroTaskStatusDotPending]} />
                          <Text style={styles.heroTaskDesc}>{task.description}</Text>
                          <TouchableOpacity
                            style={[
                              styles.heroTaskBtn,
                              task.isMet ? styles.heroTaskBtnMet : styles.heroTaskBtnPending,
                            ]}
                            onPress={() => handleTaskAction(task)}
                            activeOpacity={0.8}
                          >
                            <Text style={[styles.heroTaskBtnText, task.isMet ? styles.heroTaskBtnMetText : styles.heroTaskBtnPendingText]}>
                              {task.isMet ? 'Completed' : task.action}
                            </Text>
                          </TouchableOpacity>
                        </View>
                      ))
                    ) : (
                      <Text style={styles.heroNoTaskText}>No Pending Task</Text>
                    )}
                  </View>

                  {/* Recent Activity */}
                  <View style={styles.heroCard}>
                    <View style={styles.heroCardHeaderRow}>
                      <Text style={styles.heroCardTitle}>Recent Activity</Text>
                      <TouchableOpacity onPress={() => router.push('/(tabs)/sk-logs')}>
                        <Text style={styles.heroViewAll}>View All</Text>
                      </TouchableOpacity>
                    </View>
                    {(recentActivities.length > 0 ? recentActivities.slice(0, 3) : [
                      { id: '1', label: 'Submitted the Approved Annual Budget to LYDO', role: 'Treasurer', time: '3:00 PM', date: 'May 30, 2026', type: 'submit' },
                      { id: '2', label: 'Created draft for Annual Budget Youth Investment Program', role: 'Secretary', time: '3:00 PM', date: 'May 30, 2026', type: 'create' },
                      { id: '3', label: 'Published the Comprehensive Barangay Youth Development Program to policy board', role: 'Chairman', time: '3:00 PM', date: 'May 30, 2026', type: 'submit' },
                    ]).map((act, idx, arr) => {
                      const tone = ACTIVITY_TONES[act.type] || ACTIVITY_TONES.create;
                      return (
                        <View key={act.id} style={[styles.heroActivityRow, idx < arr.length - 1 && styles.heroActivityRowBorder]}>
                          <View style={[styles.heroActivityIconBox, { backgroundColor: tone.chipBg }]}>
                            <Text style={[styles.heroActivityIconText, { color: tone.chipColor }]}>{activityIcon(act.type)}</Text>
                          </View>
                          <View style={styles.heroActivityInfo}>
                            <Text style={styles.heroActivityLabel}>{act.label}</Text>
                            <Text style={styles.heroActivityMeta}>{act.role}</Text>
                          </View>
                          <View style={styles.heroActivityTime}>
                            <Text style={styles.heroActivityTimeText}>{act.time}</Text>
                            <Text style={styles.heroActivityDateText}>{act.date}</Text>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                </View>

                {/* Right: Quick Actions — HeroUI-style chip card */}
                <View style={[styles.heroQuickCard, styles.flex1, { alignSelf: 'flex-start' }]}>
                  <View style={styles.heroQuickHeader}>
                    <Text style={styles.heroQuickEyebrow}>QUICK ACCESS</Text>
                    <Text style={styles.heroQuickTitle}>Quick Actions</Text>
                  </View>
                  <View style={styles.heroQuickGrid}>
                    {SK_QUICK_ACTIONS.map((action) => {
                      // Get badge count based on the badgeProp
                      let badgeCount = 0;
                      if (action.badgeProp === 'returnedProposalsCount') badgeCount = notificationCenter.returnedDocuments.length;
                      else if (action.badgeProp === 'deadlinesCount') badgeCount = notificationCenter.approachingDeadlines.length;
                      const tone = QUICK_ACTION_TONES[action.tone] || QUICK_ACTION_TONES.primary;

                      return (
                        <TouchableOpacity
                          key={action.id}
                          style={styles.heroQuickBtn}
                          activeOpacity={0.7}
                          onPress={() => handleQuickAction(action.id)}
                        >
                          <View style={[styles.heroQuickIconChip, { backgroundColor: tone.chipBg }]}>
                            <Text style={[styles.heroQuickIcon, { color: tone.chipColor }]}>{action.icon}</Text>
                          </View>
                          <Text style={styles.heroQuickLabel} numberOfLines={2}>{action.label}</Text>
                          {badgeCount > 0 && (
                            <View style={styles.heroQuickBadge}>
                              <Text style={styles.heroQuickBadgeText}>{badgeCount > 9 ? '9+' : badgeCount}</Text>
                            </View>
                          )}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>

              </View>

              {/* Top Barangays Ranking */}
              <TopBarangaysRanking />
              <View style={{ height: 32 }} />
            </ScrollView>
          </View>
        </View>
      </SafeAreaView>
    </>
  );
}

// ─── CALENDAR STYLES (HeroUI-inspired) ────────────────────────────────────────
const calStyles = StyleSheet.create({
  backdrop: {
    flex: 1, backgroundColor: 'rgba(17,24,28,0.6)',
    justifyContent: 'center', alignItems: 'center', padding: 24,
  },
  modal: {
    backgroundColor: HERO.default50, borderRadius: HERO.radiusXl,
    width: isMobile ? '100%' : 960, maxWidth: 960, padding: isMobile ? 14 : 18,
    borderWidth: 1, borderColor: HERO.default200,
    ...HERO.shadowMd,
  },

  /* Header — HeroUI ModalHeader: eyebrow + title, icon-only close button */
  modalHeader: {
    flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between',
    marginBottom: 14,
  },
  modalEyebrow: {
    fontSize: 10, fontWeight: '700', color: HERO.default500,
    letterSpacing: 1.2, marginBottom: 2,
  },
  modalTitle: { fontSize: 17, fontWeight: '800', color: HERO.foreground },
  closeBtn: {
    width: 32, height: 32, borderRadius: HERO.radiusFull,
    backgroundColor: HERO.white, borderWidth: 1, borderColor: HERO.default200,
    alignItems: 'center', justifyContent: 'center',
    ...HERO.shadowSm,
  },
  closeBtnText: { color: HERO.default500, fontSize: 13, fontWeight: '800' },

  body: { flexDirection: isMobile ? 'column' : 'row', gap: 14 },

  /* ── Left: Calendar panel ── */
  calPanel: {
    flex: isMobile ? undefined : 1,
    backgroundColor: HERO.white, borderRadius: HERO.radiusLg,
    padding: isMobile ? 14 : 18,
    borderWidth: 1, borderColor: HERO.default200,
  },
  calNav: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: 14,
  },
  navBtn: {
    width: 32, height: 32, borderRadius: HERO.radiusFull,
    backgroundColor: HERO.default100, borderWidth: 1, borderColor: HERO.default200,
    alignItems: 'center', justifyContent: 'center',
  },
  navArrow: { fontSize: 18, color: HERO.foreground, lineHeight: 20, fontWeight: '800' },
  monthLabel: {
    fontSize: isMobile ? 13.5 : 15, fontWeight: '800',
    color: HERO.foreground, letterSpacing: 0.8,
  },

  /* Legend — HeroUI-style chips */
  legendRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap',
    marginBottom: 14, paddingBottom: 14,
    borderBottomWidth: 1, borderBottomColor: HERO.default200,
  },
  legendChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: HERO.radiusFull,
  },
  legendDot: { width: 7, height: 7, borderRadius: 3.5 },
  legendSplitDot: {
    width: 7, height: 7, borderRadius: 3.5, overflow: 'hidden',
  },
  legendSplitTop: { height: '50%', backgroundColor: HERO.success },
  legendSplitBottom: { height: '50%', backgroundColor: HERO.warning },
  legendText: { fontSize: 11, fontWeight: '700' },

  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  dowCell: { width: `${100 / 7}%`, alignItems: 'center', paddingBottom: 8 },
  dowText: { fontSize: 10.5, fontWeight: '700', color: HERO.default500, letterSpacing: 0.5 },

  dayCellWrap: { width: `${100 / 7}%`, position: 'relative', marginBottom: 5, zIndex: 1 },
  dayCellWrapActive: { zIndex: 999, elevation: 999 },
  dayCell: {
    flex: 1, minHeight: isMobile ? 54 : 64,
    alignItems: 'center', justifyContent: 'flex-start', paddingTop: 6,
    borderRadius: HERO.radiusMd, backgroundColor: HERO.white,
    borderWidth: 1, borderColor: HERO.default100,
    marginHorizontal: 1.5,
    position: 'relative', overflow: 'hidden',
  },
  dayCellWeekend: { backgroundColor: HERO.default50 },
  dayCellGhost: { backgroundColor: 'transparent', borderColor: 'transparent' },
  dayCellToday: { borderWidth: 1.5, borderColor: HERO.primary },

  dayCellTintPending: { backgroundColor: HERO.warning50, borderColor: HERO.warning100 },
  dayCellTintMet: { backgroundColor: HERO.success50, borderColor: HERO.success100 },
  dayCellTintPartial: { backgroundColor: HERO.default50, borderColor: HERO.default200 },

  dayCellAccentMet: { position: 'absolute', top: 0, left: 0, bottom: 0, width: 3, backgroundColor: HERO.success },
  dayCellAccentPending: { position: 'absolute', top: 0, left: 0, bottom: 0, width: 3, backgroundColor: HERO.warning },
  dayCellAccentPartialTop: { position: 'absolute', top: 0, left: 0, height: '50%', width: 3, backgroundColor: HERO.success },
  dayCellAccentPartialBottom: { position: 'absolute', bottom: 0, left: 0, height: '50%', width: 3, backgroundColor: HERO.warning },

  dayText: { fontSize: isMobile ? 13 : 14, fontWeight: '700', color: HERO.foreground },
  dayTextGhost: { color: HERO.default300 },

  todayTag: {
    fontSize: 7, fontWeight: '800', color: HERO.primary,
    letterSpacing: 0.5, marginTop: 2,
  },

  dotCluster: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 4 },
  dot: { width: 5, height: 5, borderRadius: 2.5 },
  dotMet: { backgroundColor: HERO.success },
  dotPending: { backgroundColor: HERO.warning },
  dotExtra: { fontSize: 8, fontWeight: '800', color: HERO.default500, marginLeft: 1 },

  dayCellCaption: {
    fontSize: 8, fontWeight: '700', color: HERO.default500,
    textAlign: 'center', marginTop: 2, paddingHorizontal: 3,
  },

  /* Tooltip popover — HeroUI Popover */
  tooltip: {
    position: 'absolute', top: '108%', left: '-20%', right: '-120%',
    zIndex: 99, backgroundColor: HERO.white, borderRadius: HERO.radiusLg,
    padding: 12, elevation: 10,
    borderWidth: 1, borderColor: HERO.default200,
    ...HERO.shadowMd,
  },
  tooltipDate: { fontSize: 12.5, fontWeight: '800', color: HERO.foreground, marginBottom: 6 },
  tooltipItemRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  tooltipDot: { width: 7, height: 7, borderRadius: 3.5, flexShrink: 0 },
  tooltipDotMet: { backgroundColor: HERO.success },
  tooltipDotPending: { backgroundColor: HERO.warning },
  tooltipItemText: { flex: 1, fontSize: 12, color: HERO.foreground, lineHeight: 16 },
  tooltipStatusText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.3 },
  tooltipStatusMetText: { color: HERO.success600 },
  tooltipStatusPendingText: { color: HERO.warning600 },

  /* ── Right: Annual Compliance Timeline panel — HeroUI Card ── */
  sidePanel: {
    width: isMobile ? '100%' : 270,
    backgroundColor: HERO.white, borderRadius: HERO.radiusLg,
    overflow: 'hidden',
    maxHeight: isMobile ? 320 : 500,
    borderWidth: 1, borderColor: HERO.default200,
  },
  sidePanelHeader: {
    backgroundColor: HERO.primary50, paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: HERO.default200,
  },
  sidePanelTitle: {
    fontSize: 12.5, fontWeight: '800', color: HERO.primary,
    letterSpacing: 0.6, lineHeight: 16,
  },
  sidePanelYear: {
    fontSize: 10.5, fontWeight: '600', color: HERO.default500,
    marginTop: 2, letterSpacing: 0.5,
  },

  sideEmptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  sideEmptyText: { fontSize: 13, color: HERO.default500, textAlign: 'center', lineHeight: 18 },

  /* Timeline groups */
  timelineGroup: {
    paddingHorizontal: 14, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: HERO.default100,
  },
  timelineGroupHighlight: { backgroundColor: HERO.warning50 },
  timelineGroupHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 6,
  },
  timelineMonth: { fontSize: 11.5, fontWeight: '800', color: HERO.foreground, letterSpacing: 0.4 },
  timelineMonthHighlight: { color: HERO.warning600 },
  nextBadge: {
    fontSize: 8.5, fontWeight: '800', color: HERO.white,
    backgroundColor: HERO.primary, borderRadius: HERO.radiusFull,
    paddingHorizontal: 7, paddingVertical: 2.5, letterSpacing: 0.5,
  },
  timelineItemRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 4 },
  timelineStatusIcon: {
    width: 16, height: 16, borderRadius: HERO.radiusFull, flexShrink: 0,
    alignItems: 'center', justifyContent: 'center', marginTop: 1,
  },
  timelineStatusIconMet: { backgroundColor: HERO.success },
  timelineStatusIconPending: { backgroundColor: HERO.warning100 },
  timelineStatusIconText: { fontSize: 9, fontWeight: '900', color: HERO.white, lineHeight: 10 },
  timelineLabel: { flex: 1, fontSize: 12, color: HERO.foreground, lineHeight: 16, fontWeight: '500' },
});

// ─── DASHBOARD STYLES ─────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#133E75' },
  layout: { flex: 1, flexDirection: 'row' },

  // ── Sidebar now rendered by the shared Sidebar module ──
  sidebarOverlay: { position: 'absolute', left: 0, top: 0, bottom: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 15 },

  // ── Main area ──
  main: { flex: 1, backgroundColor: COLORS.offWhite, borderTopLeftRadius: 20 },
  mainMobile: { borderTopLeftRadius: 0 },
  mainScroll: { flex: 1 },
  mainContent: { padding: 20, paddingBottom: 40 },

  // ── Desktop header (unchanged) ──
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

  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerActionBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 7, paddingHorizontal: 12, borderRadius: 20, backgroundColor: COLORS.cardBg, borderWidth: 1, borderColor: COLORS.lightGray, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  archivesBtn: { backgroundColor: '#133E75', borderColor: '#133E75' },
  headerActionIcon: { fontSize: 16 },
  headerActionLabel: { fontSize: 12, fontWeight: '600', color: COLORS.darkText },
  archivesBtnText: { color: COLORS.white },
  bellBtn: {
    position: 'relative',
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: COLORS.cardBg, alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08, shadowRadius: 6, elevation: 3,
  },

  // ── Bell icon — the unread-count badge itself now lives in BellIcon
  // (notificationCenter.js), so only the button container is styled here.
  bellBtnMobile: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: COLORS.white, alignItems: 'center', justifyContent: 'center',
    shadowColor: COLORS.navy, shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15, shadowRadius: 6, elevation: 4,
  },

  // ── Stat Cards (HeroUI-inspired) ──
  statsRow: { flexDirection: isMobile ? 'column' : 'row', gap: isMobile ? 8 : 10, marginBottom: isMobile ? 14 : 18, flexWrap: 'wrap' },
  statsCol: { flexDirection: 'column', gap: 8, marginBottom: 14 },
  heroStatCard: {
    flex: 1, minWidth: isMobile ? '100%' : 100,
    backgroundColor: HERO.white, borderRadius: HERO.radiusLg,
    padding: 14, borderWidth: 1, borderColor: HERO.default200,
    borderTopWidth: 3,
    ...HERO.shadowSm,
  },
  heroStatIconWrap: { width: 36, height: 36, borderRadius: HERO.radiusMd, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  heroStatIcon: { fontSize: 18 },
  heroStatValue: { fontSize: 28, fontWeight: '900', lineHeight: 34 },
  heroStatLabel: { fontSize: 12, fontWeight: '700', color: HERO.foreground, marginTop: 2 },
  heroStatSub: { fontSize: 10.5, fontWeight: '700', color: HERO.default500, letterSpacing: 0.4, marginTop: 2, textTransform: 'uppercase' },

  // ── Approaching Deadline Card ──
  deadlineCard: { backgroundColor: '#EFF6FF', borderRadius: 14, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: '#BFDBFE' },
  deadlineEmptyText: { fontSize: 13, color: COLORS.subText, paddingVertical: 8 },
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

  cardTitle: { fontSize: 15, fontWeight: '800', color: COLORS.darkText },
  cardHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },

  // ── Generic Card (HeroUI-inspired) ──
  heroCard: {
    backgroundColor: HERO.white, borderRadius: HERO.radiusXl, padding: 18,
    borderWidth: 1, borderColor: HERO.default200,
    ...HERO.shadowMd,
  },
  heroCardHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  heroCardTitle: { fontSize: 16, fontWeight: '800', color: HERO.foreground },
  heroViewAll: { fontSize: 12.5, fontWeight: '700', color: HERO.primary },

  // ── Compliance Tasks (HeroUI-inspired) ──
  heroTaskRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, gap: 10 },
  heroTaskRowBorder: { borderBottomWidth: 1, borderBottomColor: HERO.default200 },
  heroTaskDesc: { flex: 1, fontSize: 13, color: HERO.foreground, lineHeight: 19 },
  heroTaskStatusDot: { width: 8, height: 8, borderRadius: HERO.radiusFull },
  heroTaskStatusDotMet: { backgroundColor: HERO.success },
  heroTaskStatusDotPending: { backgroundColor: HERO.warning },
  heroTaskBtn: { paddingHorizontal: 16, paddingVertical: 7, borderRadius: HERO.radiusFull, borderWidth: 1 },
  heroTaskBtnText: { fontSize: 12, fontWeight: '700', letterSpacing: 0.2 },
  heroTaskBtnMet: { borderColor: HERO.success, backgroundColor: HERO.success },
  heroTaskBtnMetText: { color: HERO.white },
  heroTaskBtnPending: { borderColor: HERO.warning100, backgroundColor: HERO.warning50 },
  heroTaskBtnPendingText: { color: HERO.warning600 },
  heroNoTaskText: { fontSize: 13, color: HERO.default500, paddingVertical: 14, textAlign: 'center' },

  // ── Recent Activity (HeroUI-inspired) ──
  heroActivityRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, gap: 10 },
  heroActivityRowBorder: { borderBottomWidth: 1, borderBottomColor: HERO.default200 },
  heroActivityIconBox: { width: 36, height: 36, borderRadius: HERO.radiusMd, alignItems: 'center', justifyContent: 'center' },
  heroActivityIconText: { fontSize: 15, fontWeight: '700' },
  heroActivityInfo: { flex: 1 },
  heroActivityLabel: { fontSize: 13, fontWeight: '700', color: HERO.foreground, lineHeight: 18 },
  heroActivityMeta: { fontSize: 11, color: HERO.default500, marginTop: 2 },
  heroActivityTime: { alignItems: 'flex-end' },
  heroActivityTimeText: { fontSize: 12, fontWeight: '700', color: HERO.foreground },
  heroActivityDateText: { fontSize: 11, color: HERO.default500, marginTop: 1 },

  // ── Quick Actions (HeroUI-inspired card) ──
  heroQuickCard: {
    backgroundColor: HERO.white, borderRadius: HERO.radiusXl, padding: 18,
    borderWidth: 1, borderColor: HERO.default200,
    ...HERO.shadowMd,
  },
  heroQuickHeader: { marginBottom: 14 },
  heroQuickEyebrow: { fontSize: 10, fontWeight: '700', color: HERO.default500, letterSpacing: 1.2, marginBottom: 2 },
  heroQuickTitle: { fontSize: 16, fontWeight: '800', color: HERO.foreground },
  heroQuickGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  heroQuickBtn: {
    width: '47%', flexDirection: 'row', alignItems: 'center',
    backgroundColor: HERO.default50, borderRadius: HERO.radiusLg, padding: 12, gap: 10,
    borderWidth: 1, borderColor: HERO.default200,
    position: 'relative', minHeight: 58,
  },
  heroQuickIconChip: {
    width: 38, height: 38, borderRadius: HERO.radiusMd,
    alignItems: 'center', justifyContent: 'center',
  },
  heroQuickIcon: { fontSize: 17 },
  heroQuickLabel: { flex: 1, fontSize: 12, fontWeight: '700', color: HERO.foreground, lineHeight: 16 },
  heroQuickBadge: {
    position: 'absolute', top: -6, right: -6,
    backgroundColor: HERO.danger, borderRadius: HERO.radiusFull,
    minWidth: 20, height: 20, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 4, borderWidth: 2, borderColor: HERO.white,
  },
  heroQuickBadgeText: { fontSize: 10.5, fontWeight: '800', color: HERO.white },
});