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
  Modal,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useNav } from './navContext';
import { useAuth } from './authContext';
import { supabase } from '../../utils/supabase';

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

const CAL_MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const CAL_DOWS = ['SUN','MON','TUE','WED','THU','FRI','SAT'];

// ─── SIDEBAR NAV ICONS (pure React Native Views — no react-native-svg) ────────

// Dashboard: 2×2 grid of rounded squares
const DashboardIcon = ({ color = '#fff', size = 16 }) => {
  const s = size * 0.38, gap = size * 0.12, r = size * 0.12;
  const box = { width: s, height: s, borderRadius: r, backgroundColor: color };
  return (
    <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
      <View style={{ flexDirection: 'row', gap }}><View style={box} /><View style={box} /></View>
      <View style={{ height: gap }} />
      <View style={{ flexDirection: 'row', gap }}><View style={box} /><View style={box} /></View>
    </View>
  );
};

// Documents: file shape with fold + two lines
const DocumentsIcon = ({ color = '#fff', size = 16 }) => {
  const w = size * 0.6, h = size * 0.78, fold = size * 0.22;
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

// Monitor: simple globe — circle + horizontal line + vertical oval hint
const MonitorIcon = ({ color = '#fff', size = 16 }) => (
  <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
    <View style={{ width: size * 0.82, height: size * 0.82, borderRadius: size * 0.41, borderWidth: 1.5, borderColor: color, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' }}>
      <View style={{ position: 'absolute', height: 1.5, width: '100%', backgroundColor: color }} />
      <View style={{ width: size * 0.38, height: size * 0.78, borderRadius: size * 0.19, borderWidth: 1.5, borderColor: color, backgroundColor: 'transparent' }} />
    </View>
  </View>
);

// Barangay: building/institution icon — base + columns hint
const BarangayIcon = ({ color = '#fff', size = 16 }) => {
  const bw = 1.5;
  return (
    <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
      {/* roof / triangle top */}
      <View style={{ width: size * 0.82, height: size * 0.22, borderLeftWidth: bw, borderRightWidth: bw, borderTopWidth: bw, borderColor: color, borderTopLeftRadius: size * 0.06, borderTopRightRadius: size * 0.06 }} />
      {/* body */}
      <View style={{ width: size * 0.82, height: size * 0.52, borderLeftWidth: bw, borderRightWidth: bw, borderBottomWidth: bw, borderColor: color, flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', paddingHorizontal: size * 0.08, paddingBottom: size * 0.06 }}>
        {[0, 1, 2].map(i => (
          <View key={i} style={{ width: size * 0.1, height: size * 0.36, backgroundColor: color, borderRadius: size * 0.03 }} />
        ))}
      </View>
    </View>
  );
};

// Logs: clipboard with lines
const LogsIcon = ({ color = '#fff', size = 16 }) => (
  <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
    <View style={{ width: size * 0.75, height: size * 0.85, borderWidth: 1.5, borderColor: color, borderRadius: size * 0.1, paddingHorizontal: size * 0.1, paddingVertical: size * 0.1, justifyContent: 'space-around' }}>
      <View style={{ position: 'absolute', top: -size * 0.08, alignSelf: 'center', width: size * 0.3, height: size * 0.14, backgroundColor: color, borderRadius: size * 0.04 }} />
      {[0, 1, 2].map(i => (
        <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: size * 0.08, marginTop: i === 0 ? size * 0.1 : 0 }}>
          <View style={{ width: size * 0.1, height: size * 0.1, borderRadius: size * 0.05, backgroundColor: color }} />
          <View style={{ flex: 1, height: 1.5, backgroundColor: color, borderRadius: 1 }} />
        </View>
      ))}
    </View>
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

// ─── COLORS ───────────────────────────────────────────────────────────────────
const COLORS = {
  navy:       '#133E75',
  navyDark:   '#0D2B52',
  white:      '#FFFFFF',
  offWhite:   '#F7F5F2',
  lightGray:  '#ECECEC',
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
  borderColor:'#E0DDD9',
};

// ─── MOCK / STATIC DATA ───────────────────────────────────────────────────────
// Badge values will be dynamically updated in the render
const MONITORING_TASKS_BASE = [
  { id: '1', description: 'Remind barangays with missing documents', action: 'Send Reminder', actionType: 'reminder', badgeProp: 'missingDocs' },
  { id: '2', description: 'Review submitted proposals of SK', action: 'Review Now', actionType: 'review', badgeProp: 'proposalsForReview' },
  { id: '3', description: 'Follow up near deadline submission', action: 'Send Reminder', actionType: 'reminder', badgeProp: 'approachingDeadlines' },
  { id: '4', description: 'Review returned proposals of SK', action: 'Review Now', actionType: 'review', badgeProp: 'forRevision' },
];

const QUICK_ACTIONS = [
  { id: 'consultation', label: 'Consultation', badgeProp: 'proposalsForReview', color: COLORS.navy, icon: '💬', route: '/(tabs)/lydo-monitor' },
  { id: 'budget', label: 'View Budget', color: '#1A2332', icon: '📊', route: '/(tabs)/lydo-monitor-budget' },
  { id: 'export', label: 'Export  Reports', color: COLORS.navy, icon: '⬇', route: '/(tabs)/lydo-monitor-report' },
  { id: 'calendar', label: 'View Deadline Calendar', color: '#F97316', icon: '📅', route: null },
  { id: 'missing', label: 'View Missing Documents', color: '#EF4444', icon: '📄', action: 'showMissingDocs' },
  { id: 'archive', label: 'View Archive', color: '#6B7A8F', icon: '🗃', route: null },
  { id: 'task', label: 'Create Task', color: COLORS.navy, icon: null, route: null, fullWidth: true },
];

// ─── ICON COMPONENTS ──────────────────────────────────────────────────────────
const BellIcon = ({ hasNotif }) => (
  <View style={ic.bellWrapper}>
    <View style={ic.bellBody} />
    <View style={ic.bellBottom} />
    {hasNotif && <View style={ic.bellDot} />}
  </View>
);

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
  bellWrapper: { width: 20, height: 22, alignItems: 'center' },
  bellBody: { width: 14, height: 12, borderRadius: 7, borderWidth: 2, borderColor: '#8B0000', marginTop: 4 },
  bellBottom: { width: 8, height: 4, borderBottomLeftRadius: 4, borderBottomRightRadius: 4, backgroundColor: '#8B0000', marginTop: -1 },
  bellDot: { position: 'absolute', top: 0, right: 1, width: 7, height: 7, borderRadius: 4, backgroundColor: '#E8C547', borderWidth: 1.5, borderColor: COLORS.white },
});

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
  const submittedPct  = Math.round((submitted  / safeTotal) * 100);
  const awaitingPct   = Math.round((awaiting   / safeTotal) * 100);
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
        borderTopColor:    getQuadrantColor(0),
        borderRightColor:  getQuadrantColor(25),
        borderBottomColor: getQuadrantColor(50),
        borderLeftColor:   getQuadrantColor(75),
      }]}>
        <View style={styles.donutInner}>
          <Text style={styles.donutPercent}>{submittedPct}%</Text>
          <Text style={styles.donutLabel}>Submitted</Text>
        </View>
      </View>

      {/* Proportional bar under the ring */}
      <View style={styles.donutBar}>
        {submittedPct  > 0 && <View style={[styles.donutBarSeg, { flex: submittedPct,  backgroundColor: COLORS.green  }]} />}
        {awaitingPct   > 0 && <View style={[styles.donutBarSeg, { flex: awaitingPct,   backgroundColor: COLORS.yellow }]} />}
        {incompletePct > 0 && <View style={[styles.donutBarSeg, { flex: incompletePct, backgroundColor: COLORS.red    }]} />}
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
                <View style={calStyles.legendItem}>
                  <View style={[calStyles.legendDot, { backgroundColor: '#22C55E' }]} />
                  <Text style={calStyles.legendText}>Met</Text>
                </View>
                <View style={calStyles.legendItem}>
                  <View style={[calStyles.legendDot, { backgroundColor: '#E8A020' }]} />
                  <Text style={calStyles.legendText}>Pending</Text>
                </View>
                <View style={calStyles.legendItem}>
                  <View style={calStyles.legendSplitDot}>
                    <View style={calStyles.legendSplitTop} />
                    <View style={calStyles.legendSplitBottom} />
                  </View>
                  <Text style={calStyles.legendText}>Partially met</Text>
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
          <TouchableOpacity style={calStyles.closeBtn} onPress={onClose} activeOpacity={0.8}>
            <Text style={calStyles.closeBtnText}>✕</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

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
  const [calendarVisible, setCalendarVisible] = useState(false);
  const [activities, setActivities] = useState([]);
  const [totalBarangays, setTotalBarangays] = useState(0);
  const [complianceData, setComplianceData] = useState([]);
  const [totalDocuments, setTotalDocuments] = useState(0);
  const [forRevision, setForRevision] = useState(0);
  const [approved, setApproved] = useState(0);
  const [missingDocs, setMissingDocs] = useState(0);
  const [currentTime, setCurrentTime] = useState('');
  const [notifCount, setNotifCount] = useState(0);
  const [progressData, setProgressData] = useState({ submitted: 0, awaiting: 0, incomplete: 0, total: 0 });
  const [approachingDeadlines, setApproachingDeadlines] = useState([]);
  const [proposalsForReview, setProposalsForReview] = useState(0);
  const [consultationsCount, setConsultationsCount] = useState(0);
  const [lydoActivities, setLydoActivities] = useState([]);
  const [missingDocsModalVisible, setMissingDocsModalVisible] = useState(false);
  const [missingDocsList, setMissingDocsList] = useState([]);

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

  useEffect(() => {
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
  }, []);

  // ── Update notification count when badge counts change ───────────────────────
  useEffect(() => {
    const total = proposalsForReview + consultationsCount + forRevision + missingDocs;
    setNotifCount(total);
  }, [proposalsForReview, consultationsCount, forRevision, missingDocs]);

  // ── Approaching Deadline card — org-wide, grouped across all barangays ──
  // Each submission_deadlines row is per-barangay, so a single logical
  // deadline (e.g. "ABYIP due Jan 6") appears as one row per barangay. We
  // group those rows by document_type + description + deadline_date and
  // roll them up into submitted/pending counts, matching how the card is
  // meant to be read (e.g. "Submitted: 7/11").
  useEffect(() => {
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
  }, []);

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

  // ── SIDEBAR ──
  const NAV_ITEMS = [
    { tab: 'Dashboard', IconComponent: DashboardIcon },
    { tab: 'Documents', IconComponent: DocumentsIcon },
    { tab: 'Monitor',   IconComponent: MonitorIcon   },
    { tab: 'Barangay',  IconComponent: BarangayIcon  },
    { tab: 'Logs',      IconComponent: LogsIcon      },
  ];

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
      {NAV_ITEMS.map(({ tab, IconComponent }) => {
        const active = activeTab === tab;
        const iconColor = active ? '#133E75' : 'rgba(255,255,255,0.85)';
        return (
          <TouchableOpacity
            key={tab}
            style={[styles.navItem, active && styles.navItemActive]}
            onPress={() => handleNav(tab)}
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

  const activityIconColor = (type) => {
    if (type === 'approved') return COLORS.green;
    if (type === 'returned') return COLORS.orange;
    return COLORS.blue;
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.navy} />
      <CalendarModal visible={calendarVisible} onClose={() => setCalendarVisible(false)} />

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
              <TouchableOpacity style={styles.bellBtn} activeOpacity={0.7}>
                <BellIcon hasNotif={notifCount > 0} />
                {notifCount > 0 && (
                  <View style={styles.notifBadge}>
                    <Text style={styles.notifBadgeText}>{notifCount}</Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>
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
            <View style={[styles.card, styles.flex1]}>
              <Text style={styles.cardTitle}>Submission Progress Overview</Text>
              <View style={styles.divider} />
              <View style={styles.progressContent}>
                <DonutChart
                  submitted={progressData.submitted}
                  awaiting={progressData.awaiting}
                  incomplete={progressData.incomplete}
                  total={progressData.total}
                />
                <View style={styles.progressLegend}>
                  {[
                    { label: 'Submitted',          color: COLORS.green,  count: progressData.submitted  },
                    { label: 'Awaiting Submission', color: COLORS.yellow, count: progressData.awaiting   },
                    { label: 'Incomplete',          color: COLORS.red,    count: progressData.incomplete },
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
              {/* Monitoring Tasks */}
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Monitoring Tasks</Text>
                <View style={styles.divider} />
                {MONITORING_TASKS_BASE.map((task, idx) => {
                  // Get badge count based on the badgeProp
                  let badgeCount = 0;
                  if (task.badgeProp === 'proposalsForReview') badgeCount = proposalsForReview;
                  else if (task.badgeProp === 'forRevision') badgeCount = forRevision;
                  else if (task.badgeProp === 'missingDocs') badgeCount = missingDocs;
                  else if (task.badgeProp === 'approachingDeadlines') badgeCount = approachingDeadlines.filter(d => d.urgent).length;

                  return (
                    <View key={task.id} style={[styles.taskRow, idx < MONITORING_TASKS_BASE.length - 1 && styles.taskRowBorder]}>
                      <Text style={styles.taskDesc}>{task.description}</Text>
                      <View style={styles.taskBtnWrapper}>
                        {badgeCount > 0 && (
                          <View style={styles.taskBadge}>
                            <Text style={styles.taskBadgeText}>{badgeCount}</Text>
                          </View>
                        )}
                        <TouchableOpacity
                          style={styles.taskBtn}
                          onPress={task.actionType === 'reminder' ? handleSendReminder : undefined}
                          activeOpacity={0.8}
                        >
                          <Text style={styles.taskBtnText}>{task.action}</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })}
              </View>

              {/* Recent Activity */}
              <View style={styles.card}>
                <View style={styles.cardHeaderRow}>
                  <Text style={styles.cardTitle}>Recent Activity</Text>
                  <TouchableOpacity onPress={() => router.push('/(tabs)/lydo-logs')}>
                    <Text style={styles.viewAll}>View All</Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.divider} />
                {(lydoActivities.length > 0 ? lydoActivities.slice(0, 3) : [
                  { id: '1', label: 'No recent activity', description: '', performedBy: '', time: '--:--', date: '--', type: 'create', icon: '✎' },
                ]).map((act, idx, arr) => (
                  <View key={act.id} style={[styles.activityRow, idx < arr.length - 1 && styles.activityRowBorder]}>
                    <View style={[styles.activityIconBox, { backgroundColor: activityIconColor(act.type) + '20' }]}>
                      <Text style={[styles.activityIcon, { color: activityIconColor(act.type) }]}>{act.icon}</Text>
                    </View>
                    <View style={styles.activityInfo}>
                      <Text style={styles.activityLabel}>{act.label}</Text>
                      <Text style={styles.activityMeta}>{act.description || act.performedBy}</Text>
                    </View>
                    <View style={styles.activityTime}>
                      <Text style={styles.activityDateText}>{act.date}</Text>
                      <Text style={styles.activityTimeText}>{act.time}</Text>
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
                {QUICK_ACTIONS.filter(a => !a.fullWidth).map((action) => {
                  // Get badge count based on the badgeProp
                  let badgeCount = 0;
                  if (action.badgeProp === 'proposalsForReview') badgeCount = proposalsForReview;

                  return (
                    <TouchableOpacity
                      key={action.id}
                      style={styles.quickBtn}
                      activeOpacity={0.8}
                      onPress={() => {
                        if (action.id === 'calendar') setCalendarVisible(true);
                        else if (action.id === 'missing') setMissingDocsModalVisible(true);
                        else if (action.route) router.push(action.route);
                      }}
                    >
                      <View style={[styles.quickIconBox, { backgroundColor: action.color + '18' }]}>
                        <Text style={styles.quickIcon}>{action.icon}</Text>
                      </View>
                      <Text style={styles.quickLabel}>{action.label}</Text>
                      {badgeCount > 0 && (
                        <View style={styles.quickBadge}>
                          <Text style={styles.quickBadgeText}>{badgeCount}</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
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
  navItemInner: { flexDirection: 'row', alignItems: 'center', gap: 10 },
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
  mainContent: { padding: 20, paddingBottom: 40 },

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

  // Desktop Header
  header: {
    flexDirection: 'row', alignItems: 'flex-start',
    justifyContent: 'space-between', marginBottom: 16,
  },
  headerSub: {
    fontSize: 10, fontWeight: '600', color: COLORS.subText,
    letterSpacing: 2, textTransform: 'uppercase', marginBottom: 2,
  },
  headerTitle: { fontSize: 20, fontWeight: '900', color: COLORS.darkText, letterSpacing: 0.5 },
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

  // Bell
  bellBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: COLORS.cardBg, alignItems: 'center', justifyContent: 'center',
    shadowColor: 'rgba(0,0,0,0.08)', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1, shadowRadius: 6, elevation: 3,
  },
  notifBadge: {
    position: 'absolute', top: -2, right: -2,
    width: 16, height: 16, borderRadius: 8,
    backgroundColor: '#E8C547', alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: COLORS.white,
  },
  notifBadgeText: { fontSize: 8, fontWeight: '900', color: '#133E75' },

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

// ─── CALENDAR STYLES ──────────────────────────────────────────────────────────
const calStyles = StyleSheet.create({
  backdrop: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center', alignItems: 'center', padding: 24,
  },
  modal: {
    backgroundColor: COLORS.navy, borderRadius: 20,
    width: isMobile ? '100%' : 940, maxWidth: 940, padding: 16,
    position: 'relative',
  },
  closeBtn: {
    position: 'absolute', top: -14, right: -14,
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: COLORS.white,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4, elevation: 6,
  },
  closeBtnText: { color: COLORS.navy, fontSize: 14, fontWeight: '800' },
  body: { flexDirection: isMobile ? 'column' : 'row', gap: 14 },

  /* ── Left: Calendar panel ── */
  calPanel: {
    flex: isMobile ? undefined : 1,
    backgroundColor: COLORS.white, borderRadius: 16,
    padding: isMobile ? 14 : 18,
  },
  calNav: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: 12,
  },
  navBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: COLORS.offWhite,
    alignItems: 'center', justifyContent: 'center',
  },
  navArrow: { fontSize: 18, color: COLORS.navy, lineHeight: 20, fontWeight: '800' },
  monthLabel: {
    fontSize: isMobile ? 14 : 16, fontWeight: '800',
    color: COLORS.navy, letterSpacing: 1,
  },

  /* Legend */
  legendRow: {
    flexDirection: 'row', alignItems: 'center', gap: 16,
    marginBottom: 12, paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: COLORS.lightGray,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendSplitDot: { width: 8, height: 8, borderRadius: 4, overflow: 'hidden' },
  legendSplitTop: { height: '50%', backgroundColor: '#22C55E' },
  legendSplitBottom: { height: '50%', backgroundColor: '#E8A020' },
  legendText: { fontSize: 11, fontWeight: '600', color: COLORS.subText },

  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  dowCell: { width: `${100 / 7}%`, alignItems: 'center', paddingBottom: 8 },
  dowText: { fontSize: 10.5, fontWeight: '700', color: '#999', letterSpacing: 0.5 },

  dayCellWrap: { width: `${100 / 7}%`, position: 'relative', marginBottom: 5, zIndex: 1 },
  dayCellWrapActive: { zIndex: 999, elevation: 999 },
  dayCell: {
    flex: 1, minHeight: isMobile ? 54 : 64,
    alignItems: 'center', justifyContent: 'flex-start', paddingTop: 6,
    borderRadius: 9, backgroundColor: COLORS.white,
    borderWidth: 1, borderColor: '#F0F0F0',
    marginHorizontal: 1.5,
    position: 'relative', overflow: 'hidden',
  },
  dayCellWeekend: { backgroundColor: '#FBFBFD' },
  dayCellGhost: { backgroundColor: 'transparent', borderColor: 'transparent' },
  dayCellToday: { borderWidth: 1.5, borderColor: COLORS.navy },
  dayCellTintPending: { backgroundColor: '#FFFBEB', borderColor: '#FDECC8' },
  dayCellTintMet: { backgroundColor: '#F0FDF4', borderColor: '#CFF3DA' },
  dayCellTintPartial: { backgroundColor: '#FAFAFC', borderColor: '#EDEDF2' },

  dayCellAccentMet: { position: 'absolute', top: 0, left: 0, bottom: 0, width: 3, backgroundColor: '#22C55E' },
  dayCellAccentPending: { position: 'absolute', top: 0, left: 0, bottom: 0, width: 3, backgroundColor: '#E8A020' },
  dayCellAccentPartialTop: { position: 'absolute', top: 0, left: 0, height: '50%', width: 3, backgroundColor: '#22C55E' },
  dayCellAccentPartialBottom: { position: 'absolute', bottom: 0, left: 0, height: '50%', width: 3, backgroundColor: '#E8A020' },

  dayText: { fontSize: isMobile ? 13 : 14, fontWeight: '700', color: COLORS.navy },
  dayTextGhost: { color: '#ddd' },

  todayTag: { fontSize: 7, fontWeight: '800', color: COLORS.navy, letterSpacing: 0.5, marginTop: 2 },

  dotCluster: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 4 },
  dot: { width: 5, height: 5, borderRadius: 2.5 },
  dotMet: { backgroundColor: '#22C55E' },
  dotPending: { backgroundColor: '#E8A020' },
  dotExtra: { fontSize: 8, fontWeight: '800', color: COLORS.subText, marginLeft: 1 },

  dayCellCaption: {
    fontSize: 8, fontWeight: '700', color: COLORS.subText,
    textAlign: 'center', marginTop: 2, paddingHorizontal: 3,
  },

  /* Tooltip popover */
  tooltip: {
    position: 'absolute', top: '108%', left: '-20%', right: '-120%',
    zIndex: 99, backgroundColor: COLORS.white, borderRadius: 10,
    padding: 12, elevation: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2, shadowRadius: 6,
  },
  tooltipDate: { fontSize: 12.5, fontWeight: '800', color: COLORS.navy, marginBottom: 6 },
  tooltipItemRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  tooltipDot: { width: 7, height: 7, borderRadius: 3.5, flexShrink: 0 },
  tooltipDotMet: { backgroundColor: '#22C55E' },
  tooltipDotPending: { backgroundColor: '#E8A020' },
  tooltipItemText: { flex: 1, fontSize: 12, color: '#333', lineHeight: 16 },
  tooltipStatusText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.3 },
  tooltipStatusMetText: { color: '#22C55E' },
  tooltipStatusPendingText: { color: '#B45309' },

  /* ── Right: Annual Compliance Timeline panel ── */
  sidePanel: {
    width: isMobile ? '100%' : 260,
    backgroundColor: COLORS.white, borderRadius: 16,
    overflow: 'hidden',
    maxHeight: isMobile ? 320 : 500,
  },
  sidePanelHeader: {
    backgroundColor: COLORS.navy, paddingHorizontal: 16, paddingVertical: 14,
  },
  sidePanelTitle: { fontSize: 12.5, fontWeight: '800', color: COLORS.white, letterSpacing: 0.6, lineHeight: 16 },
  sidePanelYear: { fontSize: 10.5, fontWeight: '600', color: 'rgba(255,255,255,0.65)', marginTop: 2, letterSpacing: 0.5 },

  sideEmptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  sideEmptyText: { fontSize: 13, color: '#888', textAlign: 'center', lineHeight: 18 },

  /* Timeline groups */
  timelineGroup: {
    paddingHorizontal: 14, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: '#F0F1F5',
  },
  timelineGroupHighlight: { backgroundColor: '#FFFBEB' },
  timelineGroupHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 6,
  },
  timelineMonth: { fontSize: 11.5, fontWeight: '800', color: COLORS.navy, letterSpacing: 0.4 },
  timelineMonthHighlight: { color: '#B45309' },
  nextBadge: {
    fontSize: 8.5, fontWeight: '800', color: '#B45309',
    backgroundColor: '#FEF3C7', borderRadius: 6,
    paddingHorizontal: 6, paddingVertical: 2, letterSpacing: 0.5,
  },
  timelineItemRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 4 },
  timelineStatusIcon: {
    width: 15, height: 15, borderRadius: 7.5, flexShrink: 0,
    alignItems: 'center', justifyContent: 'center', marginTop: 1,
  },
  timelineStatusIconMet: { backgroundColor: '#22C55E' },
  timelineStatusIconPending: { backgroundColor: '#F3E8C4' },
  timelineStatusIconText: { fontSize: 9, fontWeight: '900', color: COLORS.white, lineHeight: 10 },
  timelineLabel: { flex: 1, fontSize: 12, color: '#444', lineHeight: 16, fontWeight: '500' },
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