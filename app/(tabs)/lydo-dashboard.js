import { useFocusEffect, useRouter } from 'expo-router';
import Head from 'expo-router/head';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Modal,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { useAuth } from './authContext';
import { useNav } from './navContext';
// NOTE: SafeAreaView from core 'react-native' only applies inset padding on
// iOS — it's a documented no-op on Android, which is why content (and the
// mobile sidebar drawer) rendered underneath the status bar there. The
// context-aware version below works correctly on both platforms.
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../utils/supabase';
import AnnualComplianceGraph from '../components/AnnualComplianceGraph';
import TopBarangaysRanking from '../components/TopBarangaysRanking';
import Sidebar, { LYDO_NAV_ITEMS } from './../components/Sidebar';
import MobileHeader, { MobileHeaderSpacer } from './mobileHeader';
import { LydoBellIcon, LydoNotificationModal, useLydoNotificationCenter } from './notificationCenter';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const isMobile = SCREEN_WIDTH < 768;

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

// Helper to get activity type based on action
const getActivityType = (action) => {
  if (!action) return 'create';
  const lower = action.toLowerCase();
  if (lower.includes('approve') || lower.includes('forward')) return 'approved';
  if (lower.includes('return')) return 'returned';
  if (lower.includes('add') || lower.includes('create')) return 'create';
  return 'create';
};

// Helper to get activity icon based on action
const getActivityIcon = (action) => {
  if (!action) return '✎';
  const lower = action.toLowerCase();
  if (lower.includes('approve')) return '✔';
  if (lower.includes('forward')) return '▷';
  if (lower.includes('return')) return '↩';
  if (lower.includes('add template') || lower.includes('replace template')) return '➕';
  if (lower.includes('add account') || lower.includes('add barangay')) return '👤';
  return '✎';
};

// ─── NAV TABS ─────────────────────────────────────────────────────────────────
const NAV_TABS = ['Dashboard', 'Documents', 'Monitor', 'Barangay', 'Logs'];

const CAL_MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const CAL_DOWS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

// ─── COLORS ───────────────────────────────────────────────────────────────────
const COLORS = {
  navy: '#133E75',
  navyDark: '#0D2B52',
  white: '#FFFFFF',
  offWhite: '#F7F5F2',
  lightGray: '#ECECEC',
  midGray: '#B0B8C4',
  darkText: '#1A2332',
  subText: '#6B7A8F',
  green: '#22C55E',
  greenLight: '#DCFCE7',
  orange: '#F97316',
  orangeLight: '#FEF3C7',
  red: '#EF4444',
  redLight: '#FEE2E2',
  blue: '#3B82F6',
  blueLight: '#DBEAFE',
  yellow: '#EAB308',
  yellowLight: '#FEF9C3',
  cardBg: '#FFFFFF',
  borderColor: '#E0DDD9',
};

// ─── HEROUI-INSPIRED DESIGN TOKENS ────────────────────────────────────────────
// Mirrors HeroUI's default theme (neutral "default" scale + semantic colors +
// radius scale) so RN components read as HeroUI Cards/Chips/Buttons even
// though the actual HeroUI package can't run on React Native. The app's navy
// is kept as "primary" so this stays on-brand with the rest of the screen.
// (Same token set as sk-dashboard.js — kept in sync across both screens.)
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

// Chip background / icon color per activity type, used by the Recent
// Activity list — same tone pattern as STAT_TONES / QUICK_ACTION_TONES.
const ACTIVITY_TONES = {
  approved: { chipBg: HERO.success50, chipColor: HERO.success600 },
  returned: { chipBg: HERO.warning50, chipColor: HERO.warning600 },
  create: { chipBg: HERO.primary50, chipColor: HERO.primary },
};

// ─── MOCK / STATIC DATA ───────────────────────────────────────────────────────
// Badge values will be dynamically updated in the render
const MONITORING_TASKS_BASE = [
  { id: '1', description: 'Remind barangays with missing documents', action: 'Send Reminder', actionType: 'reminder', badgeProp: 'missingDocs' },
  { id: '2', description: 'Review submitted proposals of SK', action: 'Review Now', actionType: 'review', badgeProp: 'proposalsForReview', viewFilter: 'submitted' },
  { id: '3', description: 'Follow up near deadline submission', action: 'Send Reminder', actionType: 'reminder', badgeProp: 'approachingDeadlines' },
  { id: '4', description: 'Review returned proposals of SK', action: 'Review Now', actionType: 'review', badgeProp: 'forRevision', viewFilter: 'revision' },
];

// Tones map to the HeroUI-inspired semantic palette (HERO) rather than raw
// hex per action — same bg50 + color600 pairing used by the HeroUI-style
// chips elsewhere in the app.
const QUICK_ACTION_TONES = {
  primary: { chipBg: HERO.primary50, chipColor: HERO.primary },
  warning: { chipBg: HERO.warning50, chipColor: HERO.warning600 },
  danger: { chipBg: HERO.danger50, chipColor: HERO.danger },
  default: { chipBg: HERO.default100, chipColor: HERO.default500 },
};

const QUICK_ACTIONS = [
  { id: 'consultation', label: 'Consultation', badgeProp: 'proposalsForReview', tone: 'primary', icon: '💬', route: '/(tabs)/lydo-monitor', viewFilter: 'submitted' },
  { id: 'budget', label: 'View Budget', tone: 'primary', icon: '📊', route: '/(tabs)/lydo-monitor-budget' },
  { id: 'export', label: 'Export  Reports', tone: 'primary', icon: '⬇', route: '/(tabs)/lydo-monitor-report' },
  { id: 'calendar', label: 'View Deadline Calendar', tone: 'warning', icon: '📅', route: null },
  { id: 'missing', label: 'View Missing Documents', tone: 'danger', icon: '📄', action: 'showMissingDocs' },
  { id: 'archive', label: 'View Archive', tone: 'default', icon: '🗃', route: null },
  { id: 'task', label: 'Create Task', tone: 'primary', icon: null, route: null, fullWidth: true },
];

// ─── ICON COMPONENTS ──────────────────────────────────────────────────────────
// ─── SEGMENTED DONUT CHART (SVG-free, stacked arc rings) ─────────────────────
//
// Strategy: render a full circle for each segment, clipped by rotating a
// half-mask. We stack three colored rings (each a full circle) and use
// overflow:hidden + rotated containers to reveal only each segment's slice.
// This is the standard "CSS pie" trick adapted to React Native Views.
//
// For simplicity and reliability we render a horizontal segmented bar + a
// large centred percentage number — this is readable, works without SVG, and
// accurately reflects proportions.
const DonutChart = ({ submitted, awaiting, incomplete, total }) => {
  const safeTotal = total > 0 ? total : 1;
  const submittedPct = Math.round((submitted / safeTotal) * 100);
  const awaitingPct = Math.round((awaiting / safeTotal) * 100);
  const incompletePct = Math.max(0, 100 - submittedPct - awaitingPct);

  // Determine dominant color per quadrant (top/right/bottom/left) by
  // walking the pie clockwise: submitted → awaiting → incomplete.
  // Each quadrant represents 25% of the circle.
  const getQuadrantColor = (startPct) => {
    const midPct = startPct + 12.5; // midpoint of this quadrant
    if (midPct <= submittedPct) return COLORS.green;
    if (midPct <= submittedPct + awaitingPct) return COLORS.yellow;
    return COLORS.red;
  };

  return (
    <View style={{ alignItems: 'center', justifyContent: 'center' }}>
      {/* Segmented ring — 4-border CSS pie trick */}
      <View style={[styles.donutOuter, {
        borderTopColor: getQuadrantColor(0),
        borderRightColor: getQuadrantColor(25),
        borderBottomColor: getQuadrantColor(50),
        borderLeftColor: getQuadrantColor(75),
      }]}>
        <View style={styles.donutInner}>
          <Text style={styles.donutPercent}>{submittedPct}%</Text>
          <Text style={styles.donutLabel}>Submitted</Text>
        </View>
      </View>

      {/* Proportional bar under the ring */}
      <View style={styles.donutBar}>
        {submittedPct > 0 && <View style={[styles.donutBarSeg, { flex: submittedPct, backgroundColor: COLORS.green }]} />}
        {awaitingPct > 0 && <View style={[styles.donutBarSeg, { flex: awaitingPct, backgroundColor: COLORS.yellow }]} />}
        {incompletePct > 0 && <View style={[styles.donutBarSeg, { flex: incompletePct, backgroundColor: COLORS.red }]} />}
      </View>
    </View>
  );
};

// ─── CALENDAR MODAL (view-only — no editing, org-wide across all barangays) ──
function CalendarModal({ visible, onClose }) {
  const now = new Date();
  const todayY = now.getFullYear();
  const todayM = now.getMonth();
  const todayD = now.getDate();

  const [cur, setCur] = useState({ y: todayY, m: todayM });
  const [tooltip, setTooltip] = useState(null); // { day, items }
  const [yearDeadlines, setYearDeadlines] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(null);

  // Parse a Postgres `date` (YYYY-MM-DD) without timezone drift.
  const parseIsoDate = (isoDateString) => {
    const [y, m, d] = isoDateString.slice(0, 10).split('-').map(Number);
    return { y, m: m - 1, d };
  };

  const labelFor = (row) => {
    const base = row.description || row.document_type;
    const brgy = row.barangay?.barangay_name;
    return brgy ? `${base} — ${brgy}` : base;
  };

  // ── Fetch every deadline (across all barangays) for the displayed year ──
  useEffect(() => {
    if (!visible) return;
    let cancelled = false;

    const fetchYearDeadlines = async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const from = `${cur.y}-01-01`;
        const to = `${cur.y}-12-31`;
        const { data, error } = await supabase
          .from('submission_deadlines')
          .select('deadline_id, document_type, description, deadline_date, is_met, barangay:barangays(barangay_name)')
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
  }, [visible, cur.y]);

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
              <View style={calStyles.calNav}>
                <TouchableOpacity style={calStyles.navBtn} onPress={() => shiftMonth(-1)} activeOpacity={0.8}>
                  <Text style={calStyles.navArrow}>‹</Text>
                </TouchableOpacity>
                <Text style={calStyles.monthLabel}>{CAL_MONTHS[cur.m].toUpperCase()} {cur.y}</Text>
                <TouchableOpacity style={calStyles.navBtn} onPress={() => shiftMonth(1)} activeOpacity={0.8}>
                  <Text style={calStyles.navArrow}>›</Text>
                </TouchableOpacity>
              </View>

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

              <View style={calStyles.grid}>
                {CAL_DOWS.map((d) => (
                  <View key={d} style={calStyles.dowCell}>
                    <Text style={calStyles.dowText}>{d}</Text>
                  </View>
                ))}

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

                        <Text style={[calStyles.dayText, cell.ghost && calStyles.dayTextGhost]}>
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
                <Text style={calStyles.sidePanelYear}>{cur.y} · All Barangays</Text>
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

// Notification modal now lives in notificationCenter.js as LydoNotificationModal (shared).

// ─── STAT CARD (HeroUI-inspired) ─────────────────────────────────────────────
const StatCard = ({ icon, value, label, sub, tone = 'primary' }) => {
  const t = STAT_TONES[tone] || STAT_TONES.primary;
  return (
    <View style={[styles.heroStatCard, { borderTopColor: t.accent }]}>
      <View style={[styles.heroStatIconWrap, { backgroundColor: t.chipBg }]}>
        <Text style={styles.heroStatIcon}>{icon}</Text>
      </View>
      <Text style={[styles.heroStatValue, { color: t.chipColor }]}>{value}</Text>
      <Text style={styles.heroStatLabel}>{label}</Text>
      {sub ? <Text style={styles.heroStatSub}>{sub}</Text> : null}
    </View>
  );
};

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
export default function LYDOHomeScreen() {
  const router = useRouter();
  const { activeTab, setActiveTab } = useNav();
  const { logout, user } = useAuth();

  const [sidebarVisible, setSidebarVisible] = useState(false);
  const [calendarVisible, setCalendarVisible] = useState(false);
  const [activities, setActivities] = useState([]);
  const [totalBarangays, setTotalBarangays] = useState(0);
  const [complianceData, setComplianceData] = useState([]);
  const [totalDocuments, setTotalDocuments] = useState(0);
  const [forRevision, setForRevision] = useState(0);
  const [approved, setApproved] = useState(0);
  const [missingDocs, setMissingDocs] = useState(0);
  const [currentTime, setCurrentTime] = useState('');
  const [progressData, setProgressData] = useState({ submitted: 0, awaiting: 0, incomplete: 0, total: 0 });
  const [approachingDeadlines, setApproachingDeadlines] = useState([]);
  const [proposalsForReview, setProposalsForReview] = useState(0);
  const [consultationsCount, setConsultationsCount] = useState(0);
  const [lydoActivities, setLydoActivities] = useState([]);
  const [missingDocsModalVisible, setMissingDocsModalVisible] = useState(false);
  const [missingDocsList, setMissingDocsList] = useState([]);

  // Shared LYDO bell badge + dropdown (documents SK officials submitted for
  // review). See notificationCenter.js — reused by every LYDO screen.
  const notif = useLydoNotificationCenter();

  useEffect(() => {
    if (user && user.role !== 'lydo') router.replace('/');
  }, [user]);

  useEffect(() => {
    setActiveTab('Dashboard');
  }, []);

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

  // Fetch data when screen is focused - always load latest
  useFocusEffect(
    React.useCallback(() => {
      const fetchData = async () => {
        try {
          // Get all barangays with their IDs
          const { data: brgyData, count: brgyCount } = await supabase
            .from('barangays')
            .select('barangay_id', { count: 'exact' });
          if (brgyCount) setTotalBarangays(brgyCount);

          // Get full barangay data for compliance calculation
          const { data: allBarangays } = await supabase
            .from('barangays')
            .select('barangay_id');

          const barangayList = allBarangays || [];

          // Fetch compliance data from documents table
          const { data: docsData } = await supabase
            .from('documents')
            .select('status');

          if (docsData) {
            const total = docsData.length;
            setTotalDocuments(total);

            const submitted = docsData.filter(d => d.status === 'submitted').length;
            const approvedCount = docsData.filter(d => d.status === 'approved').length;
            const returned = docsData.filter(d => d.status === 'returned').length;
            const drafts = docsData.filter(d => d.status === 'draft' || d.status === 'saved').length;

            setApproved(approvedCount);
            setForRevision(returned);
            setMissingDocs(total - submitted - approvedCount - returned);

            // Submission Progress: submitted+approved = submitted, returned = incomplete, rest = awaiting
            const submittedTotal = submitted + approvedCount;
            const incompleteTotal = returned;
            const awaitingTotal = Math.max(0, total - submittedTotal - incompleteTotal);
            setProgressData({
              submitted: submittedTotal,
              awaiting: awaitingTotal,
              incomplete: incompleteTotal,
              total: total || 1, // avoid division by zero
            });
          }

          // Calculate compliance data based on actual barangay document status
          // Fetch all documents with barangay info
          const { data: allDocs } = await supabase
            .from('documents')
            .select('document_id, status, title, document_type, barangay_id, barangays(barangay_name)');

          // Fetch all deadlines to determine required documents
          const { data: allDeadlines } = await supabase
            .from('submission_deadlines')
            .select('deadline_id, document_type, description, deadline_date, barangay_id, is_met, barangays(barangay_name)');

          // Get missing documents: barangays that haven't submitted based on deadlines
          const missingDocsWithBrgy = [];

          // Group deadlines by document type and barangay
          const deadlineMap = {};
          (allDeadlines || []).forEach(d => {
            const key = `${d.barangay_id}-${d.document_type}`;
            if (!deadlineMap[key]) {
              deadlineMap[key] = {
                barangay_id: d.barangay_id,
                barangay: d.barangays?.barangay_name || 'Unknown',
                document_type: d.document_type,
                description: d.description,
                is_met: d.is_met,
              };
            }
          });

          // For each deadline, check if the document was submitted
          Object.values(deadlineMap).forEach(deadline => {
            if (!deadline.is_met) {
              // Check if there's a submitted/approved document for this barangay and document type
              const submittedDoc = (allDocs || []).find(doc =>
                doc.barangay_id === deadline.barangay_id &&
                doc.document_type === deadline.document_type &&
                (doc.status === 'submitted' || doc.status === 'approved')
              );

              if (!submittedDoc) {
                missingDocsWithBrgy.push({
                  id: `${deadline.barangay_id}-${deadline.document_type}`,
                  title: deadline.description || deadline.document_type,
                  barangay: deadline.barangay,
                  status: 'Not Submitted',
                });
              }
            }
          });

          setMissingDocsList(missingDocsWithBrgy);

          const barangayStats = {};

          // Initialize stats for each barangay
          barangayList.forEach(brgy => {
            barangayStats[brgy.barangay_id] = {
              hasSubmitted: false,
              hasApproved: false,
              hasMissing: false,
              hasOverdue: false,
              hasNearDeadline: false,
            };
          });

          // Check document statuses per barangay
          allDocs?.forEach(doc => {
            if (doc.barangay_id && barangayStats[doc.barangay_id]) {
              if (doc.status === 'submitted' || doc.status === 'approved') {
                barangayStats[doc.barangay_id].hasSubmitted = true;
              }
              if (doc.status === 'approved') {
                barangayStats[doc.barangay_id].hasApproved = true;
              }
            }
          });

          // Check deadline status per barangay - use deadlines to determine missing documents
          const today = new Date();
          const threeDaysFromNow = new Date(today.getTime() + (3 * 24 * 60 * 60 * 1000));

          // Track which barangays have unfulfilled deadlines (missing documents)
          const barangaysWithMissing = new Set();

          allDeadlines?.forEach(deadline => {
            if (deadline.barangay_id && barangayStats[deadline.barangay_id]) {
              const deadlineDate = new Date(deadline.deadline_date);

              // Check if this deadline is not met (missing document)
              if (!deadline.is_met) {
                // Check if there's a submitted/approved document for this deadline
                const hasDocument = (allDocs || []).some(doc =>
                  doc.barangay_id === deadline.barangay_id &&
                  doc.document_type === deadline.document_type &&
                  (doc.status === 'submitted' || doc.status === 'approved')
                );

                if (!hasDocument) {
                  barangayStats[deadline.barangay_id].hasMissing = true;
                  barangaysWithMissing.add(deadline.barangay_id);
                }

                if (deadlineDate < today) {
                  barangayStats[deadline.barangay_id].hasOverdue = true;
                } else if (deadlineDate <= threeDaysFromNow) {
                  barangayStats[deadline.barangay_id].hasNearDeadline = true;
                }
              }
            }
          });

          // Count barangays in each category
          let fullyCompliant = 0;
          let withMissingDocs = 0;
          let nearDeadline = 0;
          let overdue = 0;

          Object.values(barangayStats).forEach(stats => {
            if (stats.hasSubmitted || stats.hasApproved) {
              if (!stats.hasMissing && !stats.hasOverdue && !stats.hasNearDeadline) {
                fullyCompliant++;
              }
            }
            if (stats.hasMissing) {
              withMissingDocs++;
            }
            if (stats.hasNearDeadline && !stats.hasOverdue) {
              nearDeadline++;
            }
            if (stats.hasOverdue) {
              overdue++;
            }
          });

          setComplianceData([
            { label: 'Fully Compliant', count: fullyCompliant, color: COLORS.green },
            { label: 'With Missing Documents', count: withMissingDocs, color: COLORS.orange },
            { label: 'Near Deadline', count: nearDeadline, color: COLORS.yellow },
            { label: 'Overdue', count: overdue, color: COLORS.red },
          ]);

          // Fetch proposals awaiting review (submitted status) - these need LYDO review
          const { count: submittedCount } = await supabase
            .from('documents')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'submitted');
          setProposalsForReview(submittedCount || 0);

          // Fetch consultations/meetings that need attention
          const { count: consultCount } = await supabase
            .from('consultations')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'pending');
          setConsultationsCount(consultCount || 0);

          const { data: docsData2 } = await supabase
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
              return {
                id: doc.document_id,
                label: actionLabel,
                barangay: doc.barangay?.barangay_name || 'Unknown Barangay',
                time: toPhilippineTime(date, { hour: '2-digit', minute: '2-digit' }),
                date: toPhilippineDate(date, { month: 'long', day: 'numeric', year: 'numeric' }),
                type: actionType,
                icon,
              };
            });
            setActivities(formatted);
          }

          // Fetch LYDO activity logs for Recent Activity section
          const { data: lydoLogs, error: lydoLogsError } = await supabase
            .from('lydo_activity_logs')
            .select(`
              id,
              action,
              description,
              created_at,
              performed_by:users!lydo_activity_logs_user_id_fkey (
                first_name,
                last_name
              )
            `)
            .order('created_at', { ascending: false })
            .limit(10);

          if (lydoLogsError) {
            console.error('Error fetching LYDO activity logs:', lydoLogsError);
          } else if (lydoLogs) {
            const formattedLogs = lydoLogs.map(log => ({
              id: log.id,
              label: log.action || 'Action',
              description: log.description || '',
              performedBy: log.performed_by
                ? `${log.performed_by.first_name} ${log.performed_by.last_name}`
                : 'LYDO Officer',
              time: toPhilippineTime(log.created_at, { hour: '2-digit', minute: '2-digit' }),
              date: toPhilippineDate(log.created_at, { month: 'long', day: 'numeric', year: 'numeric' }),
              type: getActivityType(log.action),
              icon: getActivityIcon(log.action),
            }));
            setLydoActivities(formattedLogs);
          }
        } catch (e) {
          console.error(e);
        }
      };
      fetchData();
    }, [])
  );

  // ── Approaching Deadline card — org-wide, grouped across all barangays ──
  // Each submission_deadlines row is per-barangay, so a single logical
  // deadline (e.g. "ABYIP due Jan 6") appears as one row per barangay. We
  // group those rows by document_type + description + deadline_date and
  // roll them up into submitted/pending counts, matching how the card is
  // meant to be read (e.g. "Submitted: 7/11").
  useFocusEffect(
    React.useCallback(() => {
      // Parse a Postgres `date` (YYYY-MM-DD) as a UTC midnight instant, to
      // avoid local-timezone drift shifting the day by ±1.
      const parseDateOnly = (dateStr) => {
        const [y, m, d] = dateStr.toString().slice(0, 10).split('-').map(Number);
        return Date.UTC(y, m - 1, d);
      };

      const fetchApproachingDeadlines = async () => {
        try {
          const { data, error } = await supabase
            .from('submission_deadlines')
            .select('deadline_id, document_type, description, deadline_date, is_met')
            .order('deadline_date', { ascending: true });

          if (error) throw error;

          const groups = {};
          (data || []).forEach((row) => {
            const key = `${row.document_type}|${row.description}|${row.deadline_date}`;
            if (!groups[key]) {
              groups[key] = {
                id: key,
                title: row.description || row.document_type,
                deadline_date: row.deadline_date,
                total: 0,
                submitted: 0,
              };
            }
            groups[key].total += 1;
            if (row.is_met) groups[key].submitted += 1;
          });

          const todayUtc = Date.UTC(new Date().getFullYear(), new Date().getMonth(), new Date().getDate());
          const approaching = Object.values(groups)
            .filter((g) => g.submitted < g.total) // only deadlines still pending somewhere
            .map((g) => {
              const deadlineUtc = parseDateOnly(g.deadline_date);
              const daysLeft = Math.round((deadlineUtc - todayUtc) / (24 * 60 * 60 * 1000));
              return {
                id: g.id,
                title: g.title,
                deadline: new Date(deadlineUtc).toLocaleDateString('en-PH', { timeZone: 'UTC', month: 'long', day: 'numeric', year: 'numeric' }),
                daysLeft,
                submitted: g.submitted,
                total: g.total,
                pending: g.total - g.submitted,
                urgent: daysLeft <= 3,
              };
            })
            .sort((a, b) => a.daysLeft - b.daysLeft);

          setApproachingDeadlines(approaching);
        } catch (err) {
          console.error('Error fetching approaching deadlines:', err);
        }
      };

      fetchApproachingDeadlines();
    }, [])
  );

  const today = toPhilippineDate(new Date(), { weekday: undefined, month: 'long', day: 'numeric', year: 'numeric' });

  const handleNav = (tab) => {
    setActiveTab(tab);
    setSidebarVisible(false);
    if (tab === 'Dashboard') router.push('/(tabs)/lydo-dashboard');
    else if (tab === 'Documents') router.push('/(tabs)/lydo-document');
    else if (tab === 'Monitor') router.push('/(tabs)/lydo-monitor');
    if (tab === 'Barangay') router.push('/(tabs)/lydo-accounts');
    if (tab === 'Logs') router.push('/(tabs)/lydo-logs');
  };

  const handleLogout = () => { logout(); router.replace('/'); };

  const handleSendReminder = () => Alert.alert('Reminder Sent', 'All non-compliant barangays have been notified.');

  // Handle monitoring task button click
  const handleMonitoringTask = (task) => {
    if (task.actionType === 'reminder') {
      handleSendReminder();
    } else if (task.actionType === 'review' && task.viewFilter) {
      // Navigate to lydo-monitor with the appropriate filter
      router.push({
        pathname: '/(tabs)/lydo-monitor',
        params: { viewFilter: task.viewFilter },
      });
    }
  };

  const activityIconColor = (type) => {
    if (type === 'approved') return COLORS.green;
    if (type === 'returned') return COLORS.orange;
    return COLORS.blue;
  };

  return (
    <>
      <Head>
        <title>LYDO Dashboard · SK Monitoring</title>
      </Head>
      <SafeAreaView style={styles.safe} edges={isMobile ? ['left', 'right', 'bottom'] : ['top', 'left', 'right', 'bottom']}>
        <StatusBar barStyle="light-content" backgroundColor={COLORS.navy} />
        <CalendarModal visible={calendarVisible} onClose={() => setCalendarVisible(false)} />

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

        {/* Missing Documents Modal */}
        <Modal visible={missingDocsModalVisible} transparent animationType="fade" onRequestClose={() => setMissingDocsModalVisible(false)}>
          <View style={missingModalStyles.backdrop}>
            <View style={missingModalStyles.modal}>
              <View style={missingModalStyles.header}>
                <View style={{ flex: 1 }}>
                  <Text style={missingModalStyles.title}>Missing Documents</Text>
                  <Text style={missingModalStyles.subtitle}>
                    {missingDocsList.length > 0
                      ? `${missingDocsList.length} document${missingDocsList.length !== 1 ? 's' : ''} not yet submitted`
                      : 'All barangays are up to date'}
                  </Text>
                </View>
                <TouchableOpacity style={missingModalStyles.closeBtn} onPress={() => setMissingDocsModalVisible(false)} activeOpacity={0.8}>
                  <Text style={missingModalStyles.closeText}>✕</Text>
                </TouchableOpacity>
              </View>
              <View style={missingModalStyles.divider} />

              <ScrollView
                style={missingModalStyles.body}
                contentContainerStyle={missingModalStyles.bodyContent}
                showsVerticalScrollIndicator={false}
              >
                {missingDocsList.length === 0 ? (
                  <View style={missingModalStyles.emptyState}>
                    <Text style={missingModalStyles.emptyText}>No missing documents</Text>
                    <Text style={missingModalStyles.emptySubText}>All barangays have submitted their documents.</Text>
                  </View>
                ) : (
                  <View style={missingModalStyles.list}>
                    {missingDocsList.map((doc, idx) => (
                      <View key={doc.id} style={[missingModalStyles.itemRow, idx < missingDocsList.length - 1 && missingModalStyles.itemRowBorder]}>
                        <View style={missingModalStyles.itemInfo}>
                          <Text style={missingModalStyles.itemTitle}>{doc.title}</Text>
                          <Text style={missingModalStyles.itemBarangay}>{doc.barangay}</Text>
                        </View>
                        <View style={[missingModalStyles.statusBadge, missingModalStyles.statusNotSubmitted]}>
                          <Text style={[missingModalStyles.statusText, missingModalStyles.statusNotSubmittedText]}>
                            Not Submitted
                          </Text>
                        </View>
                      </View>
                    ))}
                  </View>
                )}
              </ScrollView>
            </View>
          </View>
        </Modal>

        <View style={styles.layout}>
          {/* Sidebar overlay (mobile) */}
          {isMobile && sidebarVisible && (
            <TouchableOpacity style={styles.sidebarOverlay} activeOpacity={1} onPress={() => setSidebarVisible(false)} />
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

          {/* ── MAIN CONTENT ── */}
          <View style={[styles.main, isMobile && styles.mainMobile]}>
            <MobileHeader
              title="LYDO Dashboard"
              onMenuPress={() => setSidebarVisible(!sidebarVisible)}
              onBellPress={notif.open}
              bellCount={notif.count}
              BellIcon={LydoBellIcon}

              colors={COLORS}
              hidden={isMobile && sidebarVisible}
            />
            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={styles.mainContent}
              showsVerticalScrollIndicator={false}
            >
              <MobileHeaderSpacer />

              {/* ── PAGE HEADER ── */}
              <View style={styles.header}>
                <View>
                  <Text style={styles.headerSub}>SANGGUNIANG KABATAAN FEDERATION</Text>
                  <Text style={styles.headerTitle}>RIZAL, LAGUNA</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <View style={styles.datetimeCard}>
                    <View style={styles.datetimeRow}>
                      <View style={styles.datetimeDivider} />
                      <View style={styles.datetimeBlock}>
                        <Text style={styles.datetimeLabel}>DATE</Text>
                        <Text style={styles.datetimeValue}>{today}</Text>
                      </View>
                      <View style={styles.datetimeSeparator} />
                      <View style={[styles.datetimeDivider, { backgroundColor: '#22C55E' }]} />
                      <View style={styles.datetimeBlock}>
                        <Text style={styles.datetimeLabel}>TIME (PHT)</Text>
                        <Text style={[styles.datetimeValue, styles.datetimeTime]}>{currentTime}</Text>
                      </View>
                    </View>
                  </View>
                  <TouchableOpacity style={styles.bellBtn} activeOpacity={0.7} onPress={notif.open}>
                    <LydoBellIcon count={notif.count} />
                  </TouchableOpacity>
                </View>
              </View>

              {/* ── STAT CARDS ROW ── */}
              <View style={isMobile ? styles.statsColumn : styles.statsRow}>
                <StatCard icon="👥" value={totalBarangays} label="Total Barangay" sub="This Fiscal Year" tone="primary" />
                <StatCard icon="📄" value={totalDocuments} label="Total Documents" sub="This Fiscal Year" tone="success" />
                <StatCard icon="✏️" value={forRevision} label="For Revision" tone="warning" />
                <StatCard icon="✅" value={approved} label="Approved" tone="success" />
                <StatCard icon="⚠️" value={missingDocs} label="Missing Documents" tone="danger" />
              </View>

              {/* ── COMPLIANCE + PROGRESS ROW (HeroUI-inspired cards) ── */}
              <View style={isMobile ? styles.twoColColumn : styles.twoColRow}>
                {/* Compliance Status */}
                <View style={[styles.heroCard, styles.flex1]}>
                  <View style={styles.heroCardHeaderRow}>
                    <Text style={styles.heroCardTitle}>Barangay Compliance Status</Text>
                  </View>
                  {complianceData.map((item) => (
                    <View key={item.label} style={styles.complianceRow}>
                      <View style={[styles.complianceDot, { backgroundColor: item.color }]} />
                      <Text style={styles.complianceLabel}>{item.label}</Text>
                      <Text style={[styles.complianceCount, { color: item.color }]}>{item.count}</Text>
                    </View>
                  ))}
                  <View style={styles.divider} />
                  <Text style={styles.complianceTotal}>
                    Total Barangays: {totalBarangays}
                  </Text>
                </View>

                {/* Submission Progress */}
                <View style={[styles.heroCard, styles.flex1]}>
                  <View style={styles.heroCardHeaderRow}>
                    <Text style={styles.heroCardTitle}>Submission Progress Overview</Text>
                  </View>
                  <View style={styles.progressContent}>
                    <DonutChart
                      submitted={progressData.submitted}
                      awaiting={progressData.awaiting}
                      incomplete={progressData.incomplete}
                      total={progressData.total}
                    />
                    <View style={styles.progressLegend}>
                      {[
                        { label: 'Submitted', color: COLORS.green, count: progressData.submitted },
                        { label: 'Awaiting Submission', color: COLORS.yellow, count: progressData.awaiting },
                        { label: 'Incomplete', color: COLORS.red, count: progressData.incomplete },
                      ].map(l => (
                        <View key={l.label} style={styles.legendRow}>
                          <View style={[styles.legendDot, { backgroundColor: l.color }]} />
                          <Text style={styles.legendLabel}>{l.label}</Text>
                          <Text style={[styles.legendCount, { color: l.color }]}>{l.count}</Text>
                        </View>
                      ))}
                      <View style={styles.legendDivider} />
                      <Text style={styles.legendTotal}>Total: {progressData.total}</Text>
                    </View>
                  </View>
                </View>
              </View>

              {/* Annual Compliance Graph */}
              <AnnualComplianceGraph />

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
                {approachingDeadlines.length > 0 ? (
                  approachingDeadlines.slice(0, 5).map((item) => (
                    <View key={item.id} style={styles.deadlineRow}>
                      <Text style={styles.deadlineDocTitle}>{item.title}</Text>
                      <Text style={styles.deadlineDate}>
                        <Text style={styles.deadlineDateLabel}>Deadline: </Text>
                        {item.deadline}
                      </Text>
                      <Text style={[styles.daysLeft, item.urgent ? styles.daysLeftUrgent : styles.daysLeftNormal]}>
                        {item.daysLeft < 0
                          ? `${Math.abs(item.daysLeft)} Day${Math.abs(item.daysLeft) !== 1 ? 's' : ''} Overdue`
                          : item.daysLeft === 0
                            ? 'Due Today'
                            : `${item.daysLeft} Day${item.daysLeft !== 1 ? 's' : ''} Left`}
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
                  ))
                ) : (
                  <Text style={styles.deadlineEmptyText}>No upcoming deadlines — all barangays are caught up.</Text>
                )}
              </View>

              {/* ── BOTTOM TWO COLUMNS ── */}
              <View style={isMobile ? styles.twoColColumn : styles.twoColRow}>
                {/* Left: Monitoring Tasks + Recent Activity */}
                <View style={[styles.flex1_5, { gap: 14 }]}>
                  {/* Monitoring Tasks (HeroUI-inspired) */}
                  <View style={styles.heroCard}>
                    <View style={styles.heroCardHeaderRow}>
                      <Text style={styles.heroCardTitle}>Monitoring Tasks</Text>
                    </View>
                    {MONITORING_TASKS_BASE.map((task, idx) => {
                      // Get badge count based on the badgeProp
                      let badgeCount = 0;
                      if (task.badgeProp === 'proposalsForReview') badgeCount = proposalsForReview;
                      else if (task.badgeProp === 'forRevision') badgeCount = forRevision;
                      else if (task.badgeProp === 'missingDocs') badgeCount = missingDocs;
                      else if (task.badgeProp === 'approachingDeadlines') badgeCount = approachingDeadlines.filter(d => d.urgent).length;

                      return (
                        <View key={task.id} style={[styles.heroTaskRow, idx < MONITORING_TASKS_BASE.length - 1 && styles.heroTaskRowBorder]}>
                          <Text style={styles.heroTaskDesc}>{task.description}</Text>
                          <View style={styles.heroTaskBtnWrapper}>
                            {badgeCount > 0 && (
                              <View style={styles.heroTaskBadge}>
                                <Text style={styles.heroTaskBadgeText}>{badgeCount}</Text>
                              </View>
                            )}
                            <TouchableOpacity
                              style={styles.heroTaskBtn}
                              onPress={() => handleMonitoringTask(task)}
                              activeOpacity={0.8}
                            >
                              <Text style={styles.heroTaskBtnText}>{task.action}</Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      );
                    })}
                  </View>

                  {/* Recent Activity (HeroUI-inspired) */}
                  <View style={styles.heroCard}>
                    <View style={styles.heroCardHeaderRow}>
                      <Text style={styles.heroCardTitle}>Recent Activity</Text>
                      <TouchableOpacity onPress={() => router.push('/(tabs)/lydo-logs')}>
                        <Text style={styles.heroViewAll}>View All</Text>
                      </TouchableOpacity>
                    </View>
                    {(lydoActivities.length > 0 ? lydoActivities.slice(0, 3) : [
                      { id: '1', label: 'No recent activity', description: '', performedBy: '', time: '--:--', date: '--', type: 'create', icon: '✎' },
                    ]).map((act, idx, arr) => {
                      const tone = ACTIVITY_TONES[act.type] || ACTIVITY_TONES.create;
                      return (
                        <View key={act.id} style={[styles.heroActivityRow, idx < arr.length - 1 && styles.heroActivityRowBorder]}>
                          <View style={[styles.heroActivityIconBox, { backgroundColor: tone.chipBg }]}>
                            <Text style={[styles.heroActivityIconText, { color: tone.chipColor }]}>{act.icon}</Text>
                          </View>
                          <View style={styles.heroActivityInfo}>
                            <Text style={styles.heroActivityLabel}>{act.label}</Text>
                            <Text style={styles.heroActivityMeta}>{act.description || act.performedBy}</Text>
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
                    {QUICK_ACTIONS.filter(a => !a.fullWidth).map((action) => {
                      // Get badge count based on the badgeProp
                      let badgeCount = 0;
                      if (action.badgeProp === 'proposalsForReview') badgeCount = proposalsForReview;
                      const tone = QUICK_ACTION_TONES[action.tone] || QUICK_ACTION_TONES.primary;

                      return (
                        <TouchableOpacity
                          key={action.id}
                          style={styles.heroQuickBtn}
                          activeOpacity={0.7}
                          onPress={() => {
                            if (action.id === 'calendar') setCalendarVisible(true);
                            else if (action.id === 'missing') setMissingDocsModalVisible(true);
                            else if (action.route) {
                              // Pass viewFilter param if defined
                              const params = action.viewFilter ? { viewFilter: action.viewFilter } : {};
                              router.push({ pathname: action.route, params });
                            }
                          }}
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
                  <TouchableOpacity style={styles.heroCreateTaskBtn} activeOpacity={0.8}>
                    <Text style={styles.heroCreateTaskText}>Create Task</Text>
                  </TouchableOpacity>
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

// ─── STYLES ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.navy },
  layout: { flex: 1, flexDirection: 'row' },

  // Sidebar
  sidebarOverlay: {
    position: 'absolute', left: 0, top: 0, bottom: 0, right: 0,
    backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 5,
  },

  // Main
  main: { flex: 1, backgroundColor: COLORS.offWhite, borderTopLeftRadius: 20 },
  mainMobile: { borderTopLeftRadius: 0 },
  mainContent: { padding: 20, paddingBottom: 40 },

  // Desktop Header
  header: {
    flexDirection: 'row', alignItems: 'flex-start',
    justifyContent: 'space-between', marginBottom: 16,
  },
  headerSub: {
    fontSize: 10, fontWeight: '600', color: COLORS.subText,
    letterSpacing: 2, textTransform: 'uppercase', marginBottom: 2,
  },
  headerTitle: {
    fontSize: 20, fontWeight: '900', color: COLORS.darkText, letterSpacing: 0.5,
    borderBottomWidth: 2, borderBottomColor: COLORS.lightGray, paddingBottom: 4, marginBottom: 6,
  },
  datetimeCard: {
    backgroundColor: '#F7F5F2',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#E0DDD9',
    marginTop: isMobile ? 12 : 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  datetimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  datetimeSeparator: {
    width: 1,
    height: 36,
    backgroundColor: '#D0CCC8',
    marginHorizontal: 4,
  },
  datetimeDivider: {
    width: 3,
    height: 28,
    borderRadius: 2,
    backgroundColor: COLORS.navy,
  },
  datetimeBlock: {
    flexDirection: 'column',
  },
  datetimeLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: COLORS.subText,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 1,
  },
  datetimeValue: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.darkText,
    letterSpacing: 0.2,
  },
  datetimeTime: {
    fontVariant: ['tabular-nums'],
    color: COLORS.navy,
    fontSize: 14,
    fontWeight: '800',
  },

  // Bell — unread-count badge lives in LydoBellIcon (notificationCenter.js);
  // only the button containers are styled here.
  bellBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: COLORS.white, alignItems: 'center', justifyContent: 'center',
    shadowColor: COLORS.navy, shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15, shadowRadius: 8, elevation: 4,
  },

  // ── Stat Cards (HeroUI-inspired) ──
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 18, flexWrap: 'wrap' },
  statsColumn: { flexDirection: 'column', gap: 10, marginBottom: 18 },
  heroStatCard: {
    flex: 1, minWidth: isMobile ? '100%' : 120,
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

  // ── Generic Card (HeroUI-inspired) ──
  heroCard: {
    backgroundColor: HERO.white, borderRadius: HERO.radiusXl, padding: 18,
    borderWidth: 1, borderColor: HERO.default200,
    ...HERO.shadowMd,
  },
  heroCardHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  heroCardTitle: { fontSize: 16, fontWeight: '800', color: HERO.foreground },
  heroViewAll: { fontSize: 12.5, fontWeight: '700', color: HERO.primary },
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
  progressContent: {
    flexDirection: 'row', alignItems: 'center',
    gap: 20, paddingVertical: 8,
    justifyContent: 'center',
  },
  donutOuter: {
    width: 120, height: 120, borderRadius: 60,
    borderWidth: 13, borderColor: COLORS.green,
    alignItems: 'center', justifyContent: 'center',
  },
  donutInner: { alignItems: 'center' },
  donutPercent: { fontSize: 20, fontWeight: '900', color: COLORS.darkText },
  donutLabel: { fontSize: 10, color: COLORS.subText, fontWeight: '600' },
  donutBar: {
    flexDirection: 'row', height: 7, borderRadius: 4,
    overflow: 'hidden', width: 120, marginTop: 10,
  },
  donutBarSeg: { height: 7 },
  progressLegend: { gap: 10, flex: 1, justifyContent: 'center' },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  legendDot: { width: 9, height: 9, borderRadius: 5 },
  legendLabel: { flex: 1, fontSize: 12, color: COLORS.darkText, fontWeight: '500' },
  legendCount: { fontSize: 14, fontWeight: '800' },
  legendDivider: { height: 1, backgroundColor: COLORS.borderColor, marginVertical: 4 },
  legendTotal: { fontSize: 12, fontWeight: '700', color: COLORS.navy },

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
  deadlineEmptyText: { fontSize: 13, color: COLORS.darkText, paddingVertical: 8 },
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

  // ── Monitoring Tasks (HeroUI-inspired) ──
  heroTaskRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, gap: 10 },
  heroTaskRowBorder: { borderBottomWidth: 1, borderBottomColor: HERO.default200 },
  heroTaskDesc: { flex: 1, fontSize: 13, color: HERO.foreground, lineHeight: 19 },
  heroTaskBtnWrapper: { flexDirection: 'row', alignItems: 'center' },
  heroTaskBtn: {
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: HERO.radiusFull,
    borderWidth: 1, borderColor: HERO.primary100, backgroundColor: HERO.primary50,
  },
  heroTaskBtnText: { fontSize: 12, fontWeight: '700', color: HERO.primary, letterSpacing: 0.2 },
  heroTaskBadge: {
    width: 20, height: 20, borderRadius: HERO.radiusFull,
    backgroundColor: HERO.danger,
    alignItems: 'center', justifyContent: 'center',
    marginRight: 6,
  },
  heroTaskBadgeText: { fontSize: 10, fontWeight: '800', color: HERO.white },

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
  heroCreateTaskBtn: {
    backgroundColor: HERO.primary50, borderRadius: HERO.radiusLg, paddingVertical: 14,
    alignItems: 'center', borderWidth: 1, borderColor: HERO.primary100, marginTop: 14,
  },
  heroCreateTaskText: { fontSize: 13.5, fontWeight: '700', color: HERO.primary },
});

// ─── CALENDAR STYLES (HeroUI-inspired, mirrors sk-dashboard.js) ──────────────
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

// ─── MISSING DOCUMENTS MODAL STYLES ──────────────────────────────────────────
const missingModalStyles = StyleSheet.create({
  backdrop: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center', alignItems: 'center', padding: 24,
  },
  modal: {
    backgroundColor: COLORS.white, borderRadius: 16,
    width: isMobile ? '92%' : 480,
    height: isMobile ? '75%' : 560,
    overflow: 'hidden', elevation: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.25, shadowRadius: 20,
  },
  header: {
    flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14, backgroundColor: COLORS.navy,
  },
  title: { fontSize: 16, fontWeight: '800', color: COLORS.white },
  subtitle: { fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.75)', marginTop: 3 },
  closeBtn: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center',
    marginLeft: 12,
  },
  closeText: { fontSize: 12, fontWeight: '700', color: COLORS.white },
  divider: { height: 1, backgroundColor: COLORS.lightGray },
  body: { flex: 1 },
  bodyContent: { padding: 16, flexGrow: 1 },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 40 },
  emptyText: { fontSize: 15, fontWeight: '700', color: COLORS.darkText, marginBottom: 4 },
  emptySubText: { fontSize: 13, color: COLORS.subText, textAlign: 'center' },
  list: { flex: 1 },
  itemRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, gap: 10 },
  itemRowBorder: { borderBottomWidth: 1, borderBottomColor: COLORS.lightGray },
  itemInfo: { flex: 1 },
  itemTitle: { fontSize: 13, fontWeight: '600', color: COLORS.darkText, marginBottom: 2 },
  itemBarangay: { fontSize: 12, color: COLORS.subText },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  statusDraft: { backgroundColor: '#FEF3C7' },
  statusSaved: { backgroundColor: '#DBEAFE' },
  statusNotSubmitted: { backgroundColor: '#FEE2E2' },
  statusText: { fontSize: 10, fontWeight: '700' },
  statusDraftText: { color: '#B45309' },
  statusSavedText: { color: '#1D4ED8' },
  statusNotSubmittedText: { color: '#DC2626' },
});

// Notification modal styles now live in notificationCenter.js (shared).