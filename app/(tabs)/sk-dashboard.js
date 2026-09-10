import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import Head from 'expo-router/head';
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions, Image, Modal,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
// NOTE: SafeAreaView from core 'react-native' only applies inset padding on
// iOS — it's a documented no-op on Android, which is why content (and the
// mobile sidebar drawer) rendered underneath the status bar there. The
// context-aware version below works correctly on both platforms.
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../utils/supabase';
import { useAuth } from './authContext';
import { useNav } from './navContext';
import Sidebar from './../components/Sidebar';
import { BellIcon } from './notificationCenter';
import MobileHeader, { MobileHeaderSpacer } from './mobileHeader';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const isMobile = SCREEN_WIDTH < 768;

// ─── PERSISTED "SEEN" COUNTS ──────────────────────────────────────────────────
// The bell badge counts how many notifications are NEW since the user last
// opened the bell modal. Those seen counts are kept in AsyncStorage so they
// survive pull-to-refresh, screen re-mounts, and app restarts.
const SEEN_KEYS = {
  approved:  'sk_notif_seen_approved',
  templates: 'sk_notif_seen_templates',
  returned:  'sk_notif_seen_returned',
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
      approved:  parseInt(entries[0] || '0', 10) || 0,
      templates: parseInt(entries[1] || '0', 10) || 0,
      returned:  parseInt(entries[2] || '0', 10) || 0,
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
      AsyncStorage.setItem(SEEN_KEYS.approved,  String(counts.approved  || 0)),
      AsyncStorage.setItem(SEEN_KEYS.templates, String(counts.templates || 0)),
      AsyncStorage.setItem(SEEN_KEYS.returned,  String(counts.returned  || 0)),
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

const CAL_MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const CAL_DAY_NAMES = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const CAL_DOWS = ['SUN','MON','TUE','WED','THU','FRI','SAT'];

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
                <View style={calStyles.legendItem}>
                  <View style={[calStyles.legendDot, { backgroundColor: '#22C55E' }]} />
                  <Text style={calStyles.legendText}>Met</Text>
                </View>
                <View style={calStyles.legendItem}>
                  <View style={[calStyles.legendDot, { backgroundColor: COLORS.calGold }]} />
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
          <TouchableOpacity style={calStyles.closeBtn} onPress={onClose} activeOpacity={0.8}>
            <Text style={calStyles.closeBtnText}>✕</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ─── NOTIFICATION MODAL ──────────────────────────────────────────────────────
// Lists every notification relevant to the SK: documents returned by LYDO,
// documents approved by LYDO, templates forwarded by LYDO, and approaching
// submission deadlines. Rows are grouped by category via tab pills (with
// counts), each row shows a relative timestamp, and tapping a row deep-links
// to the relevant screen.
function NotificationModal({
  visible,
  onClose,
  returnedDocuments,
  approvedDocuments,
  forwardedTemplates,
  approachingDeadlines,
  unviewedCounts = { returned: 0, approved: 0, templates: 0, deadlines: 0 },
  onMarkAllRead,
  onViewCategory,
  onOpenRoute,
}) {
  // ── Filter state ──
  const TABS = ['all', 'returned', 'approved', 'templates', 'deadlines'];
  const [activeTab, setActiveTab] = useState('all');
  const [dropdownVisible, setDropdownVisible] = useState(false);

  useEffect(() => {
    if (!visible) {
      setDropdownVisible(false);
      setActiveTab('all');
    }
  }, [visible]);

  // Selecting a specific category tab (not "All") counts as viewing that
  // category, so its unread badge clears. "All" never auto-clears anything —
  // that only happens via the explicit "Mark all read" button.
  useEffect(() => {
    if (visible && activeTab !== 'all' && onViewCategory) {
      onViewCategory(activeTab);
    }
  }, [visible, activeTab, onViewCategory]);

  // ── Build the unified notification list once per data change ──
  const notifications = React.useMemo(() => {
    const items = [];

    returnedDocuments.forEach((doc) => {
      items.push({
        id: `returned-${doc.id}`,
        type: 'returned',
        title: doc.title || 'Returned document',
        subtitle: 'Returned for revision',
        rawDate: doc.returned_at || doc.created_at,
        icon: '↩',
        accentBg: '#FFEDD5',
        iconColor: '#F97316',
      });
    });

    approvedDocuments.forEach((doc) => {
      items.push({
        id: `approved-${doc.id}`,
        type: 'approved',
        title: doc.title || 'Approved document',
        subtitle: 'Approved by LYDO',
        rawDate: doc.approved_at || doc.created_at,
        icon: '✅',
        accentBg: '#DCFCE7',
        iconColor: '#22C55E',
      });
    });

    forwardedTemplates.forEach((doc) => {
      items.push({
        id: `template-${doc.id}`,
        type: 'templates',
        title: doc.title || 'New template',
        subtitle: `New template received (v${doc.version || 1})`,
        rawDate: doc.distributed_at || doc.date,
        icon: '📄',
        accentBg: '#EDE9FE',
        iconColor: '#8B5CF6',
      });
    });

    approachingDeadlines.forEach((item) => {
      items.push({
        id: `deadline-${item.id}`,
        type: 'deadlines',
        title: item.title || 'Upcoming deadline',
        subtitle:
          item.daysLeft < 0
            ? `${Math.abs(item.daysLeft)} days overdue`
            : item.daysLeft === 0
              ? 'Due today'
              : `${item.daysLeft} day${item.daysLeft !== 1 ? 's' : ''} left`,
        rawDate: item.deadlineIso || item.deadline,
        icon: '⏰',
        accentBg: item.urgent ? '#FEE2E2' : '#FEF3C7',
        iconColor: item.urgent ? '#EF4444' : '#F97316',
      });
    });

    // Sort by raw date descending (latest first). Items missing a date sink to
    // the bottom of the list.
    return items.sort((a, b) => {
      const ta = a.rawDate ? toUtcDate(a.rawDate).getTime() : 0;
      const tb = b.rawDate ? toUtcDate(b.rawDate).getTime() : 0;
      return tb - ta;
    });
  }, [returnedDocuments, approvedDocuments, forwardedTemplates, approachingDeadlines]);

  // ── Per-category counts for the tab pills ──
  const counts = React.useMemo(() => {
    const c = { all: notifications.length, returned: 0, approved: 0, templates: 0, deadlines: 0 };
    notifications.forEach((n) => { c[n.type] = (c[n.type] || 0) + 1; });
    return c;
  }, [notifications]);

  // ── Unread badge counts for the dropdown ──
  // These are separate from `counts` above: `counts` is the total number of
  // items in each category (used for the header subtitle and list), while
  // `badgeCounts` is how many of those are still unread. Unread counts drop
  // to 0 the moment the modal is viewed or "Mark all read" is pressed, since
  // `unviewedCounts` is driven by the same seen-state as the bell badge.
  const badgeCounts = React.useMemo(() => {
    const returned  = unviewedCounts.returned  || 0;
    const approved  = unviewedCounts.approved  || 0;
    const templates = unviewedCounts.templates || 0;
    const deadlines = unviewedCounts.deadlines || 0;
    return { all: returned + approved + templates + deadlines, returned, approved, templates, deadlines };
  }, [unviewedCounts]);

  const filteredNotifications = React.useMemo(() => {
    if (activeTab === 'all') return notifications;
    return notifications.filter((n) => n.type === activeTab);
  }, [notifications, activeTab]);

  // ── Philippine-time helpers ──
  const formatLongDate = (dateStr) => {
    if (!dateStr) return '';
    return toPhilippineDate(dateStr, { month: 'short', day: 'numeric', year: 'numeric' });
  };
  const formatTimeOfDay = (dateStr) => {
    if (!dateStr) return '';
    return toPhilippineTime(dateStr, { hour: '2-digit', minute: '2-digit' });
  };

  // Relative time string ("2h ago", "Yesterday", "3d ago") anchored on
  // Philippine wall-clock time, not raw UTC, so the user sees their local clock.
  const formatRelative = (dateStr) => {
    if (!dateStr) return '';
    const target = toUtcDate(dateStr);
    if (isNaN(target.getTime())) return '';
    // Current Philippine wall-clock time
    const nowPh = new Date(
      new Date().toLocaleString('en-US', { timeZone: 'Asia/Manila' })
    );
    const targetPh = new Date(
      target.toLocaleString('en-US', { timeZone: 'Asia/Manila' })
    );
    const diffMs = nowPh.getTime() - targetPh.getTime();
    if (diffMs < 0) return formatLongDate(dateStr);
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    // calendar-day comparison in PHT
    const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const dayDelta = Math.round((startOfDay(nowPh) - startOfDay(targetPh)) / (24 * 3600 * 1000));
    if (dayDelta === 1) return 'Yesterday';
    if (dayDelta < 7) return `${dayDelta}d ago`;
    return formatLongDate(dateStr);
  };

  // Per-tab navigation targets — tapping a row routes the user to the screen
  // that owns that data.
  const tabRoute = {
    returned: () => '/(tabs)/sk-document-management?initialTab=Returned',
    approved: () => '/(tabs)/sk-document-management?initialTab=Approved',
    templates: () => '/(tabs)/sk-portal',
    deadlines: () => '/(tabs)/sk-document-management?initialTab=Saved',
  }[activeTab];

  const handleRowPress = (item) => {
    const route = tabRoute ? tabRoute() : '/(tabs)/sk-document-management';
    if (onOpenRoute) onOpenRoute(route);
  };

  const handleMarkAllRead = () => {
    if (onMarkAllRead) onMarkAllRead();
  };

  // Human-friendly label for the active tab — reused by the empty state.
  const activeLabel =
    activeTab === 'all' ? 'All'
    : activeTab === 'returned' ? 'Returned'
    : activeTab === 'approved' ? 'Approved'
    : activeTab === 'templates' ? 'Templates'
    : 'Deadlines';

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={notifModalStyles.backdrop} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} onPress={() => {}} style={notifModalStyles.caret} />
        <TouchableOpacity activeOpacity={1} onPress={() => {}} style={notifModalStyles.modal}>
          {/* ── Header ── */}
          <View style={notifModalStyles.header}>
            <View style={notifModalStyles.headerLeft}>
              <View style={notifModalStyles.headerIcon}>
                <Text style={notifModalStyles.headerIconText}>🔔</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={notifModalStyles.title}>Notifications</Text>
                <Text style={notifModalStyles.headerSub}>
                  {counts.all} update{counts.all !== 1 ? 's' : ''} from LYDO
                </Text>
              </View>
            </View>
            <View style={notifModalStyles.headerActions}>
              <TouchableOpacity
                style={notifModalStyles.markAllBtn}
                onPress={handleMarkAllRead}
                activeOpacity={0.8}
                disabled={counts.all === 0}
              >
                <Text style={notifModalStyles.markAllBtnText}>Mark all read</Text>
              </TouchableOpacity>
              <TouchableOpacity style={notifModalStyles.closeBtn} onPress={onClose} activeOpacity={0.8}>
                <Text style={notifModalStyles.closeBtnText}>✕</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* ── Dropdown filter (All / Returned / Approved / Templates / Deadlines) ── */}
          <View style={notifModalStyles.filterContainer}>
            <TouchableOpacity
              style={notifModalStyles.dropdownButton}
              onPress={() => setDropdownVisible(!dropdownVisible)}
              activeOpacity={0.8}
            >
              <View style={notifModalStyles.dropdownButtonLeft}>
                <Text style={notifModalStyles.dropdownButtonText}>{activeLabel}</Text>
                {badgeCounts[activeTab] > 0 && (
                  <View style={notifModalStyles.dropdownButtonBadge}>
                    <Text style={notifModalStyles.dropdownButtonBadgeText}>
                      {badgeCounts[activeTab] > 99 ? '99+' : badgeCounts[activeTab]}
                    </Text>
                  </View>
                )}
              </View>
              <Text style={notifModalStyles.dropdownArrow}>{dropdownVisible ? '▲' : '▼'}</Text>
            </TouchableOpacity>

            {dropdownVisible && (
              <View style={notifModalStyles.dropdownMenu}>
                {TABS.map((tab, idx) => {
                  const isActive = activeTab === tab;
                  const itemLabel =
                    tab === 'all' ? 'All'
                    : tab === 'returned' ? 'Returned'
                    : tab === 'approved' ? 'Approved'
                    : tab === 'templates' ? 'Templates'
                    : 'Deadlines';
                  const itemCount = badgeCounts[tab] || 0;
                  return (
                    <TouchableOpacity
                      key={tab}
                      style={[
                        notifModalStyles.dropdownItem,
                        isActive && notifModalStyles.dropdownItemActive,
                        idx < TABS.length - 1 && notifModalStyles.dropdownItemBorder,
                      ]}
                      onPress={() => { setActiveTab(tab); setDropdownVisible(false); }}
                      activeOpacity={0.8}
                    >
                      <Text style={[notifModalStyles.dropdownItemText, isActive && notifModalStyles.dropdownItemTextActive]}>
                        {itemLabel}
                      </Text>
                      {itemCount > 0 && (
                        <View style={[notifModalStyles.dropdownItemBadge, isActive && notifModalStyles.dropdownItemBadgeActive]}>
                          <Text style={[notifModalStyles.dropdownItemBadgeText, isActive && notifModalStyles.dropdownItemBadgeTextActive]}>
                            {itemCount > 99 ? '99+' : itemCount}
                          </Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </View>

          {/* ── Body ── */}
          <View style={notifModalStyles.listContainer}>
            {filteredNotifications.length === 0 ? (
              <View style={notifModalStyles.emptyState}>
                <View style={notifModalStyles.emptyIconCircle}>
                  <Text style={notifModalStyles.emptyIcon}>🔕</Text>
                </View>
                <Text style={notifModalStyles.emptyText}>You're all caught up</Text>
                <Text style={notifModalStyles.emptySubText}>
                  {activeTab === 'all'
                    ? 'No updates from LYDO right now. New returned documents, approvals, templates, and deadline reminders will appear here.'
                    : `No ${activeLabel.toLowerCase()} updates right now.`}
                </Text>
              </View>
            ) : (
              <ScrollView
                style={notifModalStyles.list}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={notifModalStyles.listContent}
              >
                {filteredNotifications.map((item) => (
                  <TouchableOpacity
                    key={item.id}
                    style={notifModalStyles.notifItem}
                    onPress={() => handleRowPress(item)}
                    activeOpacity={0.7}
                  >
                    <View style={[notifModalStyles.notifIcon, { backgroundColor: item.accentBg }]}>
                      <Text style={[notifModalStyles.notifIconText, { color: item.iconColor }]}>{item.icon}</Text>
                    </View>
                    <View style={notifModalStyles.notifContent}>
                      <Text style={notifModalStyles.notifTitle} numberOfLines={1}>{item.title}</Text>
                      <Text style={[notifModalStyles.notifSubtitle, { color: item.iconColor }]} numberOfLines={1}>
                        {item.subtitle}
                      </Text>
                      <View style={notifModalStyles.notifMetaRow}>
                        <Text style={notifModalStyles.notifRelative}>{formatRelative(item.rawDate)}</Text>
                        {item.rawDate && (
                          <>
                            <Text style={notifModalStyles.notifDotSep}>•</Text>
                            <Text style={notifModalStyles.notifDate}>{formatLongDate(item.rawDate)}</Text>
                            <Text style={notifModalStyles.notifDotSep}>•</Text>
                            <Text style={notifModalStyles.notifTime}>{formatTimeOfDay(item.rawDate)}</Text>
                          </>
                        )}
                      </View>
                    </View>
                    <Text style={notifModalStyles.notifChevron}>›</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

// ─── APPROACHING DEADLINES ────────────────────────────────────────────────────
// Now derived live from submission_deadlines (see fetchTasks below) instead of
// this static mock list.

// ─── QUICK ACTIONS DATA ───────────────────────────────────────────────────────
// Badge values will be dynamically updated in the render
const SK_QUICK_ACTIONS = [
  { id: 'proposal', label: 'Create Proposal', icon: '🔔', color: '#133E75' },
  { id: 'drafts', label: 'View Drafts', icon: '📋', color: '#133E75' },
  { id: 'logs', label: 'Activity logs', icon: '📝', color: '#133E75' },
  { id: 'upload', label: 'Scan & Upload', icon: '📄', color: '#133E75', isScan: true },
  { id: 'consultation', label: 'Consultation', icon: '💬', color: '#133E75' },
  { id: 'calendar', label: 'View Deadline Calendar', icon: '📅', color: '#F97316', badgeProp: 'deadlinesCount' },
  { id: 'archive', label: 'View Archive', icon: '🗃', color: '#6B7A8F' },
  { id: 'returned', label: 'Returned Proposal', icon: '↩', color: '#9333EA', badgeProp: 'returnedProposalsCount' },
];

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
export default function HomeScreen({ navigation }) {
  const router = useRouter();
  const { activeTab, setActiveTab } = useNav();
  const { logout, user } = useAuth();
  const [notifCount, setNotifCount] = useState(0);
  const [seenApprovedCount, setSeenApprovedCount] = useState(0);
  const [seenTemplatesCount, setSeenTemplatesCount] = useState(0);
  const [seenReturnedCount, setSeenReturnedCount] = useState(0);
  const [seenDeadlinesCount, setSeenDeadlinesCount] = useState(0);
  const [seenLoaded, setSeenLoaded] = useState(false);
  const [sidebarVisible, setSidebarVisible] = useState(false);
  const [calendarVisible, setCalendarVisible] = useState(false);
  const [notificationModalVisible, setNotificationModalVisible] = useState(false);
  const [returnedDocuments, setReturnedDocuments] = useState([]);
  const [approvedDocuments, setApprovedDocuments] = useState([]);
  const [forwardedTemplates, setForwardedTemplates] = useState([]);
  const [docStats, setDocStats] = useState({ total: 0, submitted: 0, forRevision: 0, approved: 0, drafts: 0 });
  const [recentActivities, setRecentActivities] = useState([]);
  // Bumped on every screen focus so fetches always re-run with the latest server data
  const [refreshKey, setRefreshKey] = useState(0);
  const [complianceTasks, setComplianceTasks] = useState([]);
  const [approachingDeadlines, setApproachingDeadlines] = useState([]);
  const [consultationsCount, setConsultationsCount] = useState(0);
  const [returnedProposalsCount, setReturnedProposalsCount] = useState(0);
  const [deadlinesCount, setDeadlinesCount] = useState(0);

  useEffect(() => {
    if (user && user.role !== 'sk') router.replace('/');
  }, [user]);

  // Load persisted "seen" counts once on mount so the bell badge doesn't show
  // stale notifications as "new" after a refresh or app restart.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const stored = await loadSeenCounts();
      if (cancelled) return;
      setSeenApprovedCount(stored.approved);
      setSeenTemplatesCount(stored.templates);
      setSeenReturnedCount(stored.returned);
      setSeenDeadlinesCount(stored.deadlines);
      setSeenLoaded(true);
    })();
    return () => { cancelled = true; };
  }, []);

  // Persist seen counts to AsyncStorage whenever they change after the
  // initial load. This keeps the bell badge accurate across refreshes.
  useEffect(() => {
    if (!seenLoaded) return;
    saveSeenCounts({
      approved:  seenApprovedCount,
      templates: seenTemplatesCount,
      returned:  seenReturnedCount,
      deadlines: seenDeadlinesCount,
    });
  }, [seenLoaded, seenApprovedCount, seenTemplatesCount, seenReturnedCount, seenDeadlinesCount]);

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

      // Set returned proposals count for badge
      setReturnedProposalsCount(forRevision);

      // Store returned documents for notification modal
      const returnedDocs = (documents || []).filter(d => d.status === 'returned').map(doc => ({
        id: doc.document_id,
        title: doc.title,
        created_at: doc.created_at,
        returned_at: doc.submitted_at || doc.saved_at,
        date: doc.submitted_at || doc.saved_at || doc.created_at,
      }));
      setReturnedDocuments(returnedDocs);

      // Store approved documents for notification modal (approved by LYDO)
      const approvedDocs = (documents || []).filter(d => d.status === 'approved').map(doc => ({
        id: doc.document_id,
        title: doc.title,
        created_at: doc.created_at,
        approved_at: doc.reviewed_at || doc.submitted_at,
        date: doc.reviewed_at || doc.submitted_at || doc.created_at,
      }));
      setApprovedDocuments(approvedDocs);

      // Fetch forwarded templates from template_distributions
      try {
        const { data: distributions, error: distError } = await supabase
          .from('template_distributions')
          .select(`
            distribution_id,
            distributed_at,
            template_id,
            templates (
              template_id,
              title,
              template_category,
              version
            )
          `)
          .eq('barangay_id', barangayId)
          .order('distributed_at', { ascending: false });

        if (!distError && distributions) {
          const forwarded = distributions.map(d => ({
            id: d.distribution_id,
            title: d.templates?.title || 'Template',
            category: d.templates?.template_category || 'General',
            version: d.templates?.version || 1,
            distributed_at: d.distributed_at,
            date: d.distributed_at,
          }));
          setForwardedTemplates(forwarded);
        }
      } catch (error) {
        console.error('Error fetching forwarded templates:', error);
      }

      // Recent activities are fetched separately by fetchRecentActivities
      // so this section only handles documents and notifications.
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

  // Fetch consultations (documents submitted to LYDO for review) for this barangay
  const fetchConsultations = useCallback(async () => {
    if (!barangayId) return;
    try {
      const { count: consultCount } = await supabase
        .from('documents')
        .select('*', { count: 'exact', head: true })
        .eq('barangay_id', barangayId)
        .eq('status', 'submitted');

      setConsultationsCount(consultCount || 0);
    } catch (error) { console.error('Error fetching consultations:', error); }
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

      // Set deadlines count for badge (only count pending/partially met deadlines)
      const notMetCount = (deadlines || []).filter(d => !d.is_met).length;
      setDeadlinesCount(notMetCount);

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

      // Approaching Deadline card: only deadlines not yet met, nearest first.
      const todayUtc = Date.UTC(new Date().getFullYear(), new Date().getMonth(), new Date().getDate());
      const approaching = (deadlines || [])
        .filter((d) => !d.is_met)
        .map((d) => {
          const deadlineUtc = parseDateOnly(d.deadline_date);
          const daysLeft = Math.round((deadlineUtc - todayUtc) / (24 * 60 * 60 * 1000));
          return {
            id: d.deadline_id.toString(),
            title: d.description || d.document_type,
            deadline: new Date(deadlineUtc).toLocaleDateString('en-PH', { timeZone: 'UTC', month: 'long', day: 'numeric', year: 'numeric' }),
            deadlineIso: d.deadline_date, // raw ISO for the notification modal
            daysLeft,
            urgent: daysLeft <= 3,
          };
        })
        .sort((a, b) => a.daysLeft - b.daysLeft);
      setApproachingDeadlines(approaching);
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
    fetchConsultations();
    fetchRecentActivities();
  }, [refreshKey, barangayId, fetchDocuments, fetchTasks, fetchConsultations, fetchRecentActivities]);

  // Compute unviewed notification counts per category.
// Each category contributes only its NEW items (count - last seen count).
// When the modal is opened, the seen counts are bumped to match current counts
// so that category contributes 0 next time — until a new item arrives.
// Until seen counts have been loaded from AsyncStorage, treat everything as
// already seen — this prevents a flash of the old count on first paint after
// a refresh.
const seenReady = seenLoaded ? 1 : 0;
  const unviewedApproved  = seenReady ? Math.max(0, approvedDocuments.length  - seenApprovedCount)  : 0;
  const unviewedTemplates = seenReady ? Math.max(0, forwardedTemplates.length - seenTemplatesCount) : 0;
  const unviewedReturned  = seenReady ? Math.max(0, returnedProposalsCount   - seenReturnedCount)  : 0;
  const unviewedDeadlines = seenReady ? Math.max(0, deadlinesCount           - seenDeadlinesCount) : 0;

  const totalUnviewed = unviewedApproved + unviewedTemplates + unviewedReturned + unviewedDeadlines;

  // Update notification count when unviewed counts change. BellIcon's own
  // numbered badge (count > 0) now handles showing "there's something new" —
  // no separate boolean needed.
  useEffect(() => {
    setNotifCount(totalUnviewed);
  }, [totalUnviewed]);

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
    if (type === 'scan') return '#8B5CF6';
    return '#3B82F6';
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
        visible={notificationModalVisible}
        onClose={() => setNotificationModalVisible(false)}
        returnedDocuments={returnedDocuments}
        approvedDocuments={approvedDocuments}
        forwardedTemplates={forwardedTemplates}
        approachingDeadlines={approachingDeadlines}
        unviewedCounts={{
          returned: unviewedReturned,
          approved: unviewedApproved,
          templates: unviewedTemplates,
          deadlines: unviewedDeadlines,
        }}
        onViewCategory={(category) => {
          // Selecting a specific tab marks only that category as seen —
          // "All" is intentionally excluded, since it only clears via
          // the "Mark all read" button.
          if (category === 'returned')  setSeenReturnedCount(returnedProposalsCount);
          if (category === 'approved')  setSeenApprovedCount(approvedDocuments.length);
          if (category === 'templates') setSeenTemplatesCount(forwardedTemplates.length);
          if (category === 'deadlines') setSeenDeadlinesCount(deadlinesCount);
        }}
        onMarkAllRead={() => {
          // Treat the current inventory as fully seen across every category —
          // this clears the bell badge count and red dot.
          setSeenApprovedCount(approvedDocuments.length);
          setSeenTemplatesCount(forwardedTemplates.length);
          setSeenReturnedCount(returnedProposalsCount);
          setSeenDeadlinesCount(deadlinesCount);
          setHasUnviewedNotif(false);
        }}
        onOpenRoute={(route) => {
          setNotificationModalVisible(false);
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
            onBellPress={() => setNotificationModalVisible(true)}
            bellCount={notifCount}
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
                  setNotificationModalVisible(true);
                }}>
                  <BellIcon count={notifCount} />
                </TouchableOpacity>
              </View>
            </View>
          )}

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
            {approachingDeadlines.length > 0 ? (
              approachingDeadlines.slice(0, 5).map((item) => (
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
              <Text style={styles.deadlineEmptyText}>No upcoming deadlines — you're all caught up.</Text>
            )}
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
                {complianceTasks.length > 0 ? (
                  complianceTasks.map((task, idx, arr) => (
                    <View key={task.id} style={[styles.taskRow, idx < arr.length - 1 && styles.taskRowBorder]}>
                      <View style={[styles.taskStatusDot, task.isMet ? styles.taskStatusDotMet : styles.taskStatusDotPending]} />
                      <Text style={styles.taskDesc}>{task.description}</Text>
                      <TouchableOpacity
                        style={[
                          styles.taskBtn,
                          task.isMet ? styles.taskBtnMet : styles.taskBtnPending,
                        ]}
                        onPress={() => handleTaskAction(task)}
                        activeOpacity={0.8}
                      >
                        <Text style={[styles.taskBtnText, task.isMet ? styles.taskBtnMetText : styles.taskBtnPendingText]}>
                          {task.isMet ? 'Completed' : task.action}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  ))
                ) : (
                  <Text style={styles.noTaskText}>No Pending Task</Text>
                )}
              </View>

              {/* Recent Activity */}
              <View style={styles.card}>
                <View style={styles.cardHeaderRow}>
                  <Text style={styles.cardTitle}>Recent Activity</Text>
                  <TouchableOpacity onPress={() => router.push('/(tabs)/sk-logs')}>
                    <Text style={styles.viewAll}>View All</Text>
                  </TouchableOpacity>
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
                
              </View>
              <View style={styles.divider} />
              <View style={styles.quickGrid}>
                {SK_QUICK_ACTIONS.map((action) => {
                  // Get badge count based on the badgeProp
                  let badgeCount = 0;
                  if (action.badgeProp === 'returnedProposalsCount') badgeCount = returnedProposalsCount;
                  else if (action.badgeProp === 'deadlinesCount') badgeCount = deadlinesCount;

                  return (
                    <TouchableOpacity
                      key={action.id}
                      style={[
                        styles.quickBtn,
                        action.isScan && styles.quickBtnScan,
                        { position: 'relative' }
                      ]}
                      activeOpacity={0.8}
                      onPress={() => handleQuickAction(action.id)}
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
            </View>

          </View>

          <View style={{ height: 32 }} />
        </ScrollView>
        </View>
      </View>
    </SafeAreaView>
    </>
  );
}

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
  legendSplitDot: {
    width: 8, height: 8, borderRadius: 4, overflow: 'hidden',
  },
  legendSplitTop: { height: '50%', backgroundColor: '#22C55E' },
  legendSplitBottom: { height: '50%', backgroundColor: COLORS.calGold },
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
  dayCellAccentPending: { position: 'absolute', top: 0, left: 0, bottom: 0, width: 3, backgroundColor: COLORS.calGold },
  dayCellAccentPartialTop: { position: 'absolute', top: 0, left: 0, height: '50%', width: 3, backgroundColor: '#22C55E' },
  dayCellAccentPartialBottom: { position: 'absolute', bottom: 0, left: 0, height: '50%', width: 3, backgroundColor: COLORS.calGold },

  dayText: { fontSize: isMobile ? 13 : 14, fontWeight: '700', color: COLORS.navy },
  dayTextGhost: { color: '#ddd' },

  todayTag: {
    fontSize: 7, fontWeight: '800', color: COLORS.navy,
    letterSpacing: 0.5, marginTop: 2,
  },

  dotCluster: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 4 },
  dot: { width: 5, height: 5, borderRadius: 2.5 },
  dotMet: { backgroundColor: '#22C55E' },
  dotPending: { backgroundColor: COLORS.calGold },
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
  tooltipDotPending: { backgroundColor: COLORS.calGold },
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
  sidePanelTitle: {
    fontSize: 12.5, fontWeight: '800', color: COLORS.white,
    letterSpacing: 0.6, lineHeight: 16,
  },
  sidePanelYear: {
    fontSize: 10.5, fontWeight: '600', color: 'rgba(255,255,255,0.65)',
    marginTop: 2, letterSpacing: 0.5,
  },

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

// ─── NOTIFICATION MODAL STYLES ─────────────────────────────────────────────────
const notifModalStyles = StyleSheet.create({
  backdrop: {
    flex: 1, backgroundColor: 'rgba(15,23,42,0.25)',
    alignItems: 'flex-end',
    paddingTop: isMobile ? 58 : 84,
    paddingRight: isMobile ? 10 : 24,
  },
  caret: {
    width: 16, height: 16, backgroundColor: COLORS.navy,
    borderTopLeftRadius: 3,
    transform: [{ rotate: '45deg' }],
    marginBottom: -8, marginRight: isMobile ? 18 : 26,
  },
  modal: {
    width: isMobile ? SCREEN_WIDTH - 20 : 400,
    height: isMobile ? 460 : 560,
    backgroundColor: COLORS.white, borderRadius: 16, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.22, shadowRadius: 22, elevation: 18,
  },

  // ── Header ──
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14, backgroundColor: COLORS.navy,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  headerIcon: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  headerIconText: { fontSize: 18 },
  title: { fontSize: 16, fontWeight: '800', color: COLORS.white, letterSpacing: 0.3 },
  headerSub: { fontSize: 11.5, fontWeight: '600', color: 'rgba(255,255,255,0.7)', marginTop: 2 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  markAllBtn: {
    paddingHorizontal: 10, paddingVertical: 7, borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.15)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)',
  },
  markAllBtnText: { fontSize: 11, fontWeight: '700', color: COLORS.white, letterSpacing: 0.3 },
  closeBtn: { width: 30, height: 30, borderRadius: 15, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  closeBtnText: { fontSize: 14, color: COLORS.white, fontWeight: '700' },

  // ── Dropdown filter ──
  filterContainer: {
    paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#F8FAFC',
    position: 'relative', zIndex: 10,
  },
  dropdownButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: COLORS.navy, borderRadius: 10,
  },
  dropdownButtonLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dropdownButtonText: { fontSize: 14, fontWeight: '700', color: COLORS.white, letterSpacing: 0.3 },
  dropdownButtonBadge: {
    minWidth: 22, height: 18, borderRadius: 9,
    backgroundColor: 'rgba(255,255,255,0.25)', paddingHorizontal: 6,
    alignItems: 'center', justifyContent: 'center',
  },
  dropdownButtonBadgeText: { fontSize: 11, fontWeight: '800', color: COLORS.white },
  dropdownArrow: { fontSize: 11, fontWeight: '800', color: COLORS.white },
  dropdownMenu: {
    position: 'absolute', top: 52, left: 16, right: 16,
    backgroundColor: COLORS.white, borderRadius: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18, shadowRadius: 10, elevation: 8,
    borderWidth: 1, borderColor: '#E5E7EB', overflow: 'hidden',
  },
  dropdownItem: {
    paddingHorizontal: 16, paddingVertical: 12,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  dropdownItemBorder: { borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  dropdownItemActive: { backgroundColor: '#F0F4FA' },
  dropdownItemText: { fontSize: 14, fontWeight: '500', color: '#374151' },
  dropdownItemTextActive: { color: COLORS.navy, fontWeight: '800' },
  dropdownItemBadge: {
    minWidth: 22, height: 18, borderRadius: 9,
    backgroundColor: '#EEF2F7', paddingHorizontal: 6,
    alignItems: 'center', justifyContent: 'center',
  },
  dropdownItemBadgeActive: { backgroundColor: COLORS.navy },
  dropdownItemBadgeText: { fontSize: 11, fontWeight: '800', color: '#374151' },
  dropdownItemBadgeTextActive: { color: COLORS.white },

  // ── List / body ──
  listContainer: { flex: 1, backgroundColor: COLORS.white },
  list: { flex: 1 },
  listContent: { paddingVertical: 6 },
  notifItem: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 12, paddingHorizontal: 14,
    borderBottomWidth: 1, borderBottomColor: '#F1F5F9',
    gap: 10,
  },
  notifIcon: {
    width: 42, height: 42, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  notifIconText: { fontSize: 18 },
  notifContent: { flex: 1 },
  notifTitle: { fontSize: 14, fontWeight: '700', color: COLORS.darkText, marginBottom: 2 },
  notifSubtitle: { fontSize: 12, fontWeight: '700', marginBottom: 4 },
  notifMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 5, flexWrap: 'wrap' },
  notifRelative: { fontSize: 11.5, fontWeight: '700', color: COLORS.subText },
  notifDotSep: { fontSize: 9, color: '#CBD5E1' },
  notifDate: { fontSize: 11, color: COLORS.subText },
  notifTime: {
    fontSize: 11, fontWeight: '700', color: COLORS.navy,
    fontVariant: ['tabular-nums'],
  },
  notifChevron: { fontSize: 22, color: '#94A3B8', marginLeft: 4, lineHeight: 22 },

  // ── Empty state ──
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 60, paddingHorizontal: 32 },
  emptyIconCircle: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: '#F1F5F9',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 16,
  },
  emptyIcon: { fontSize: 36 },
  emptyText: { fontSize: 16, fontWeight: '800', color: COLORS.darkText, marginBottom: 6 },
  emptySubText: {
    fontSize: 13, color: COLORS.subText, textAlign: 'center',
    lineHeight: 19, maxWidth: 340,
  },
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
  headerRight:    { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  
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
  taskStatusDot: { width: 8, height: 8, borderRadius: 4 },
  taskStatusDotMet: { backgroundColor: '#22C55E' },
  taskStatusDotPending: { backgroundColor: '#F59E0B' },
  taskBtnMet: { borderColor: '#22C55E', backgroundColor: '#22C55E' },
  taskBtnMetText: { color: COLORS.white },
  taskBtnPending: { borderColor: '#F59E0B', backgroundColor: '#FEF3C7' },
  taskBtnPendingText: { color: '#B45309' },
  noTaskText: { fontSize: 13, color: COLORS.subText, paddingVertical: 14, textAlign: 'center' },

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