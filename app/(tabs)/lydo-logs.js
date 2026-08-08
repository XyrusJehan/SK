import { useFocusEffect } from 'expo-router';
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  View, Text, TextInput, ScrollView, TouchableOpacity,
  StyleSheet, SafeAreaView, StatusBar, Dimensions, Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useNav } from './navContext';
import { useAuth } from './authContext';
import { supabase } from '../../utils/supabase';

// Supabase returns timestamps without a timezone suffix (e.g. '2026-05-28 03:50:28').
// JS treats that as local time, not UTC, causing an 8-hour display error in PHT.
// This helper forces correct UTC parsing before any display conversion.
const toUtcDate = (dateStr) => {
  if (!dateStr) return new Date();
  const iso = dateStr.toString().replace(' ', 'T').replace(/Z?$/, 'Z');
  return new Date(iso);
};

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const isMobile = SCREEN_WIDTH < 768;

// ─── NAV TABS ─────────────────────────────────────────────────────────────────
const NAV_TABS = ['Dashboard', 'Documents', 'Monitor', 'Barangay', 'Logs'];

// ─── SIDEBAR NAV ICONS (pure React Native Views — no react-native-svg) ────────

// Dashboard: 2×2 grid of rounded squares
const NavDashboardIcon = ({ color = '#fff', size = 16 }) => {
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
const NavDocumentsIcon = ({ color = '#fff', size = 16 }) => {
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
const NavMonitorIcon = ({ color = '#fff', size = 16 }) => (
  <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
    <View style={{ width: size * 0.82, height: size * 0.82, borderRadius: size * 0.41, borderWidth: 1.5, borderColor: color, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' }}>
      <View style={{ position: 'absolute', height: 1.5, width: '100%', backgroundColor: color }} />
      <View style={{ width: size * 0.38, height: size * 0.78, borderRadius: size * 0.19, borderWidth: 1.5, borderColor: color, backgroundColor: 'transparent' }} />
    </View>
  </View>
);

// Barangay: building/institution icon — base + columns hint
const NavBarangayIcon = ({ color = '#fff', size = 16 }) => {
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
const NavLogsIcon = ({ color = '#fff', size = 16 }) => (
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
const NavLogoutIcon = ({ color = '#fff', size = 16 }) => (
  <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
    <View style={{ position: 'absolute', left: 0, top: 0, width: size * 0.55, height: size, borderWidth: 1.5, borderColor: color, borderRadius: size * 0.08 }} />
    <View style={{ position: 'absolute', right: size * 0.02, width: size * 0.52, height: 1.8, backgroundColor: color, borderRadius: 1 }} />
    <View style={{ position: 'absolute', right: size * 0.02, width: size * 0.2, height: size * 0.2, borderTopWidth: 1.8, borderRightWidth: 1.8, borderColor: color, transform: [{ rotate: '45deg' }], marginTop: -size * 0.01 }} />
  </View>
);

// ─── COLORS ───────────────────────────────────────────────────────────────────
const COLORS = {
  navy:        '#133E75',
  navyDark:    '#0D2B52',
  maroon:      '#8B0000',
  gold:        '#E8C547',
  white:       '#FFFFFF',
  offWhite:    '#F7F5F2',
  lightGray:   '#E8ECF0',
  midGray:     '#B0B8C4',
  darkText:    '#1A2332',
  subText:     '#6B7A8F',
  cardBg:      '#FFFFFF',
  borderColor: '#E2E8F0',
};

// ─── ACTION CONFIG ─────────────────────────────────────────────────────────────
const ACTION_CONFIG = {
  'Forward template':    { bg: '#EEF0FB', text: '#3949AB', border: '#C5CAE9' },
  'Approve proposal':    { bg: '#E8F5E9', text: '#2E7D32', border: '#A5D6A7' },
  'Return proposal':     { bg: '#FEE2E2', text: '#B91C1C', border: '#FCA5A5' },
  'Forward budget':      { bg: '#EDE7F6', text: '#6A1B9A', border: '#CE93D8' },
  'Add template':        { bg: '#FFF3E0', text: '#BF6000', border: '#FFCC80' },
  'Replace template':    { bg: '#FFF8E1', text: '#F57F17', border: '#FFE082' },
  'Add/replace template':{ bg: '#FFF8E1', text: '#F57F17', border: '#FFE082' },
  'Add account':         { bg: '#E0F7FA', text: '#00695C', border: '#80CBC4' },
  'Add barangay':        { bg: '#F3E5F5', text: '#7B1FA2', border: '#CE93D8' },
};

const LEGEND_ITEMS = [
  { label: 'Forward template',    color: '#3949AB' },
  { label: 'Approve proposal',    color: '#2E7D32' },
  { label: 'Forward budget',      color: '#6A1B9A' },
  { label: 'Add/replace template',color: '#F57F17' },
  { label: 'Add account',         color: '#00695C' },
  { label: 'Add barangay',        color: '#7B1FA2' },
];

const ACTION_FILTER_OPTIONS = [
  'All',
  'Forward template',
  'Approve proposal',
  'Return proposal',
  'Forward budget',
  'Add template',
  'Replace template',
  'Add/replace template',
  'Add account',
  'Add barangay',
];

const DATE_RANGES = ['All time', 'Today', 'This week', 'This month', 'Last 3 months'];

// ─── ICON COMPONENTS ──────────────────────────────────────────────────────────
const BellIcon = ({ hasNotif }) => (
  <View style={styles.bellWrapper}>
    <View style={styles.bellBody} />
    <View style={styles.bellBottom} />
    {hasNotif && <View style={styles.bellDot} />}
  </View>
);

const MenuIcon = () => (
  <View style={styles.menuIconContainer}>
    <View style={styles.menuLine} />
    <View style={styles.menuLine} />
    <View style={styles.menuLine} />
  </View>
);

const SearchIcon = ({ color = COLORS.midGray }) => (
  <View style={styles.searchIconWrap}>
    <View style={[styles.searchCircle, { borderColor: color }]} />
    <View style={[styles.searchHandle, { backgroundColor: color }]} />
  </View>
);

const LogsIcon = () => (
  <View style={styles.logsIconWrap}>
    <View style={styles.logsIconPage}>
      <View style={styles.logsIconLine} />
      <View style={styles.logsIconLine} />
      <View style={[styles.logsIconLine, { width: '60%' }]} />
    </View>
  </View>
);

const ChevronIcon = () => (
  <View style={styles.chevronWrap}>
    <View style={styles.chevronLeft} />
    <View style={styles.chevronRight} />
  </View>
);

// ─── ANCHORED DROPDOWN OVERLAY ────────────────────────────────────────────────
function AnchoredDropdown({ visible, anchor, options, selected, onSelect, onClose, title }) {
  if (!visible || !anchor) return null;
  return (
    <>
      <TouchableOpacity
        style={StyleSheet.absoluteFillObject}
        activeOpacity={1}
        onPress={onClose}
      />
      <View style={[styles.dropMenu, { top: anchor.y + anchor.height + 4, left: anchor.x }]}>
        <Text style={styles.dropTitle}>{title}</Text>
        {options.map((opt) => (
          <TouchableOpacity
            key={opt}
            style={[styles.dropItem, selected === opt && styles.dropItemActive]}
            onPress={() => { onSelect(opt); onClose(); }}
            activeOpacity={0.75}
          >
            <Text style={[styles.dropItemText, selected === opt && styles.dropItemTextActive]}>
              {opt}
            </Text>
            {selected === opt && <Text style={styles.dropCheckmark}>✓</Text>}
          </TouchableOpacity>
        ))}
      </View>
    </>
  );
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
export default function LYDOLogsScreen() {
  const router = useRouter();
  const { activeTab, setActiveTab } = useNav();
  const { logout, user } = useAuth();

  const [searchText, setSearchText] = useState('');
  const [actionFilter, setActionFilter] = useState('All');
  const [dateFilter, setDateFilter] = useState('All time');
  const [actionDropVisible, setActionDropVisible] = useState(false);
  const [dateDropVisible, setDateDropVisible] = useState(false);
  const [actionAnchor, setActionAnchor] = useState(null);
  const [dateAnchor, setDateAnchor] = useState(null);
  const actionButtonRef = useRef(null);
  const dateButtonRef = useRef(null);
  const safeAreaRef = useRef(null);
  const [sidebarVisible, setSidebarVisible] = useState(false);
  const [notifCount]                        = useState(2);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime]       = useState('');

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

  const municipalityName = user?.barangay?.municipality || 'Rizal, Laguna';

  useEffect(() => {
    if (user && user.role !== 'lydo') router.replace('/');
  }, [user]);

  useEffect(() => {
    setActiveTab('Logs');
  }, []);

  // ── Fetch logs — runs every time the screen comes into focus ──────────────
  useFocusEffect(
    useCallback(() => {
      const fetchLogs = async () => {
        setLoading(true);
        try {
          const { data, error } = await supabase
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
            .limit(100);

          if (error) {
            console.error('Error fetching LYDO logs:', error);
            setLogs([]);
            return;
          }

          const mapped = (data || []).map((row) => ({
            id: row.id,
            action: row.action || 'Forward template',
            description: row.description || '',
            createdAt: toUtcDate(row.created_at),
            performedBy: row.performed_by
              ? `${row.performed_by.first_name} ${row.performed_by.last_name}`
              : 'LYDO Officer',
          }));

          setLogs(mapped);
        } catch (err) {
          console.error('Fetch error:', err);
          setLogs([]);
        } finally {
          setLoading(false);
        }
      };

      fetchLogs();
    }, [])
  );

  // ── Date filter helper ─────────────────────────────────────────────────────
  const isInDateRange = (date) => {
    if (dateFilter === 'All time') return true;
    const now = new Date();
    const d = new Date(date);
    if (dateFilter === 'Today') return d.toDateString() === now.toDateString();
    if (dateFilter === 'This week') {
      const weekAgo = new Date(now); weekAgo.setDate(now.getDate() - 7);
      return d >= weekAgo;
    }
    if (dateFilter === 'This month') return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    if (dateFilter === 'Last 3 months') {
      const threeMonthsAgo = new Date(now); threeMonthsAgo.setMonth(now.getMonth() - 3);
      return d >= threeMonthsAgo;
    }
    return true;
  };

  // ── Filtered logs ──────────────────────────────────────────────────────────
  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      const matchAction = actionFilter === 'All' || log.action?.toLowerCase() === actionFilter.toLowerCase();
      const matchDate = isInDateRange(log.createdAt);
      const q = searchText.toLowerCase();
      const matchSearch = !q ||
        log.action.toLowerCase().includes(q) ||
        log.description.toLowerCase().includes(q) ||
        log.performedBy.toLowerCase().includes(q);
      return matchAction && matchDate && matchSearch;
    });
  }, [logs, actionFilter, dateFilter, searchText]);

  // ── Measure button position ────────────────────────────────────────────────
  const measureButton = (ref, setAnchor) => {
    ref.current?.measureInWindow((x, y, width, height) => {
      setAnchor({ x, y, width, height });
    });
  };

  // ── Navigation ─────────────────────────────────────────────────────────────
  const handleNav = (tab) => {
    setActiveTab(tab);
    setSidebarVisible(false);
    if (tab === 'Dashboard') router.push('/(tabs)/lydo-dashboard');
    else if (tab === 'Documents') router.push('/(tabs)/lydo-document');
    else if (tab === 'Monitor') router.push('/(tabs)/lydo-monitor');
    else if (tab === 'Barangay') router.push('/(tabs)/lydo-accounts');
    else if (tab === 'Logs') router.push('/(tabs)/lydo-logs');

  };

  const handleLogout = () => { logout(); router.replace('/'); };

  const formatDate = (date) =>
    new Date(date).toLocaleDateString('en-PH', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', year: 'numeric' });

  const formatTime = (date) =>
    new Date(date).toLocaleTimeString('en-PH', { timeZone: 'Asia/Manila', hour: 'numeric', minute: '2-digit', hour12: true });

  // ── Sidebar ────────────────────────────────────────────────────────────────
  const NAV_ITEMS = [
    { tab: 'Dashboard', IconComponent: NavDashboardIcon },
    { tab: 'Documents', IconComponent: NavDocumentsIcon },
    { tab: 'Monitor',   IconComponent: NavMonitorIcon   },
    { tab: 'Barangay',  IconComponent: NavBarangayIcon  },
    { tab: 'Logs',      IconComponent: NavLogsIcon      },
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
          <NavLogoutIcon color="rgba(255,255,255,0.85)" size={16} />
          <Text style={styles.logoutText}>Logout</Text>
        </View>
      </TouchableOpacity>
    </View>
  );

  // ── Action badge ───────────────────────────────────────────────────────────
  const renderActionBadge = (action) => {
    const cfg = ACTION_CONFIG[action] || ACTION_CONFIG['Forward template'];
    return (
      <View style={[styles.actionBadge, { backgroundColor: cfg.bg, borderColor: cfg.border }]}>
        <Text style={[styles.actionBadgeText, { color: cfg.text }]}>{action}</Text>
      </View>
    );
  };

  return (
    <>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.navy} />

      <SafeAreaView ref={safeAreaRef} style={styles.safe}>
        {/* Dropdown overlays — anchored above everything */}
        <AnchoredDropdown
          visible={actionDropVisible}
          anchor={actionAnchor}
          options={ACTION_FILTER_OPTIONS}
          selected={actionFilter}
          onSelect={setActionFilter}
          onClose={() => setActionDropVisible(false)}
          title="Filter by Action"
        />
        <AnchoredDropdown
          visible={dateDropVisible}
          anchor={dateAnchor}
          options={DATE_RANGES}
          selected={dateFilter}
          onSelect={setDateFilter}
          onClose={() => setDateDropVisible(false)}
          title="Filter by Date Range"
        />

        <View style={styles.layout}>
          {isMobile && sidebarVisible && (
            <TouchableOpacity style={styles.sidebarOverlay} activeOpacity={1} onPress={() => setSidebarVisible(false)} />
          )}
          {isMobile ? (sidebarVisible && renderSidebar()) : renderSidebar()}

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
                <Text style={styles.mobileTitle}>Activity Logs</Text>
                <View style={{ width: 40 }} />
              </View>
            )}

            {/* Desktop Header */}
            {!isMobile && (
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
            )}

            {/* Section title */}
            <View style={styles.sectionTitleRow}>
              <LogsIcon />
              <Text style={styles.sectionTitle}>Activity logs</Text>
            </View>

            {/* Filter bar */}
            <View style={styles.filterRow}>
              {/* Action filter */}
              <TouchableOpacity
                ref={actionButtonRef}
                style={styles.filterDropdown}
                onPress={() => {
                  setDateDropVisible(false);
                  if (!actionDropVisible) measureButton(actionButtonRef, setActionAnchor);
                  setActionDropVisible(!actionDropVisible);
                }}
                activeOpacity={0.8}
              >
                <Text style={styles.filterDropdownText}>
                  {actionFilter === 'All' ? 'Filter' : actionFilter}
                </Text>
                <View style={styles.filterDivider} />
                <ChevronIcon />
              </TouchableOpacity>

              {/* Date Range filter */}
              <TouchableOpacity
                ref={dateButtonRef}
                style={styles.filterDropdown}
                onPress={() => {
                  setActionDropVisible(false);
                  if (!dateDropVisible) measureButton(dateButtonRef, setDateAnchor);
                  setDateDropVisible(!dateDropVisible);
                }}
                activeOpacity={0.8}
              >
                <Text style={styles.filterDropdownText}>
                  {dateFilter === 'All time' ? 'Date Range' : dateFilter}
                </Text>
                <View style={styles.filterDivider} />
                <ChevronIcon />
              </TouchableOpacity>
            </View>

            {/* Legend */}
            <View style={styles.legendRow}>
              {LEGEND_ITEMS.map((item) => (
                <View key={item.label} style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: item.color }]} />
                  <Text style={styles.legendLabel}>{item.label}</Text>
                </View>
              ))}
            </View>

            {/* Activity Log Card */}
            <View style={styles.card}>
              {/* Card Header */}
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>Action history</Text>
                <View style={styles.logSearchBar}>
                  <SearchIcon color="#999" />
                  <TextInput
                    style={styles.logSearchInput}
                    placeholder="Search logs"
                    placeholderTextColor={COLORS.midGray}
                    value={searchText}
                    onChangeText={setSearchText}
                  />
                </View>
              </View>

              {/* Table Header */}
              {!isMobile && (
                <View style={styles.tableHead}>
                  <View style={[styles.tableHeadCol, styles.colAction]}>
                    <Text style={styles.tableHeadCell}>ACTION TYPE</Text>
                  </View>
                  <View style={[styles.tableHeadCol, styles.colDesc]}>
                    <Text style={styles.tableHeadCell}>DESCRIPTION</Text>
                  </View>
                  <View style={[styles.tableHeadCol, styles.colDate]}>
                    <Text style={[styles.tableHeadCell, { textAlign: 'right' }]}>DATE & TIME</Text>
                  </View>
                </View>
              )}

              {/* Table rows */}
              {loading ? (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyText}>Loading logs…</Text>
                </View>
              ) : filteredLogs.length === 0 ? (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyEmoji}>📋</Text>
                  <Text style={styles.emptyText}>No activity logs found</Text>
                  <Text style={styles.emptySubText}>
                    {searchText || actionFilter !== 'All' || dateFilter !== 'All time'
                      ? 'Try adjusting your filters or search.'
                      : 'Activity will appear here once actions are taken.'}
                  </Text>
                </View>
              ) : (
                filteredLogs.map((log, idx) => (
                  <View
                    key={log.id}
                    style={[
                      styles.tableRow,
                      idx % 2 === 0 && styles.tableRowAlt,
                      idx === filteredLogs.length - 1 && styles.tableRowLast,
                    ]}
                  >
                    {isMobile ? (
                      // Mobile: stacked layout
                      <View style={styles.mobileRow}>
                        <View style={styles.mobileRowTop}>
                          {renderActionBadge(log.action)}
                          <Text style={styles.dateText}>{formatDate(log.createdAt)}</Text>
                        </View>
                        <Text style={styles.descText} numberOfLines={2}>{log.description}</Text>
                      </View>
                    ) : (
                      // Desktop: columns layout
                      <>
                        <View style={[styles.tableCell, styles.colAction]}>
                          {renderActionBadge(log.action)}
                        </View>
                        <View style={[styles.tableCell, styles.colDesc]}>
                          <Text style={styles.descText}>{log.description}</Text>
                        </View>
                        <View style={[styles.tableCell, styles.colDate]}>
                          <Text style={styles.dateText}>
                            {formatDate(log.createdAt)} | {formatTime(log.createdAt)}
                          </Text>
                        </View>
                      </>
                    )}
                  </View>
                ))
              )}
            </View>

          </ScrollView>
        </View>
      </SafeAreaView>
    </>
  );
}

// ─── STYLES ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  // ── Layout
  safe: { flex: 1, backgroundColor: COLORS.navy },
  layout: { flex: 1, flexDirection: 'row' },
  sidebar: {
    width: 250, backgroundColor: COLORS.navy,
    alignItems: 'center', paddingTop: 20, paddingBottom: 24, paddingHorizontal: 10, zIndex: 10,
  },
  sidebarOverlay: {
    position: 'absolute', left: 0, top: 0, bottom: 0, right: 0,
    backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 5,
  },
  sidebarSpacer: { height: 28 },
  navItemInner: { flexDirection: 'row', alignItems: 'center', gap: 10 },

  // ── Sidebar elements
  logoPill: {
    marginTop: 20,
    width: 70, height: 70, borderRadius: 35,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 8, borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)',
  },
  logoImage: {
    width: 110,
    height: 110,
  },
  navItem: {
    width: '100%', paddingVertical: 12, paddingHorizontal: 12,
    borderRadius: 24, marginBottom: 8, alignItems: 'center',
    borderWidth: 1.5, borderColor: COLORS.white, backgroundColor: COLORS.navy,
  },
  navItemActive: { backgroundColor: COLORS.white, borderColor: '#000' },
  navLabel: { fontSize: 13, fontWeight: '600', color: COLORS.white, letterSpacing: 0.3 },
  navLabelActive: { color: '#000', fontWeight: '800' },
  logoutBtn: {
    width: '100%', paddingVertical: 12, paddingHorizontal: 12,
    borderRadius: 24, marginTop: 8, alignItems: 'center',
    borderWidth: 1.5, borderColor: COLORS.white, backgroundColor: 'rgba(255,255,255,0.1)',
  },
  logoutText: { fontSize: 13, fontWeight: '600', color: COLORS.white, letterSpacing: 0.3 },

  // ── Main area
  main: { flex: 1, backgroundColor: COLORS.offWhite, borderTopLeftRadius: 20 },
  mainMobile: { borderTopLeftRadius: 0 },
  mainContent: { padding: 20, paddingBottom: 40 },

  // ── Mobile header
  mobileHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 12, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: COLORS.lightGray,
  },
  menuBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: COLORS.cardBg, alignItems: 'center', justifyContent: 'center',
  },
  menuIconContainer: { width: 20, height: 16, justifyContent: 'space-between' },
  menuLine: { width: 20, height: 2, backgroundColor: COLORS.navy, borderRadius: 1 },
  mobileTitle: { fontSize: 16, fontWeight: '800', color: COLORS.darkText },

  // ── Page header
  header:      { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 },
  headerSub:   { fontSize: 10, fontWeight: '600', color: COLORS.subText, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 2 },
  headerTitle: { fontSize: 20, fontWeight: '900', color: COLORS.darkText, letterSpacing: 0.5 },

  // ── Datetime card
  datetimeCard:      { backgroundColor: '#F7F5F2', borderRadius: 12, paddingVertical: 10, paddingHorizontal: 16, borderWidth: 1, borderColor: '#E0DDD9', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  datetimeRow:       { flexDirection: 'row', alignItems: 'center', gap: 12 },
  datetimeSeparator: { width: 1, height: 36, backgroundColor: '#D0CCC8', marginHorizontal: 4 },
  datetimeDivider:   { width: 3, height: 28, borderRadius: 2, backgroundColor: '#133E75' },
  datetimeBlock:     { flexDirection: 'column' },
  datetimeLabel:     { fontSize: 9, fontWeight: '700', color: '#666666', letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 1 },
  datetimeValue:     { fontSize: 13, fontWeight: '700', color: '#1A1A1A', letterSpacing: 0.2 },
  datetimeTime:      { fontVariant: ['tabular-nums'], color: '#133E75', fontSize: 14, fontWeight: '800' },

  // ── Bell
  bellBtn:        { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.cardBg, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 6, elevation: 3 },
  bellWrapper:    { width: 20, height: 22, alignItems: 'center' },
  bellBody:       { width: 14, height: 12, borderRadius: 7, borderWidth: 2, borderColor: COLORS.maroon, marginTop: 4 },
  bellBottom:     { width: 8, height: 4, borderBottomLeftRadius: 4, borderBottomRightRadius: 4, backgroundColor: COLORS.maroon, marginTop: -1 },
  bellDot:        { position: 'absolute', top: 0, right: 1, width: 7, height: 7, borderRadius: 4, backgroundColor: COLORS.gold, borderWidth: 1.5, borderColor: COLORS.cardBg },
  notifBadge:     { position: 'absolute', top: -2, right: -2, width: 16, height: 16, borderRadius: 8, backgroundColor: COLORS.gold, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: COLORS.white },
  notifBadgeText: { fontSize: 8, fontWeight: '900', color: COLORS.navy },

  // ── Section title
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 20 },
  sectionTitle: { fontSize: isMobile ? 15 : 17, fontWeight: '800', color: COLORS.darkText },

  // ── Logs icon (drawn)
  logsIconWrap: { width: 26, height: 26, alignItems: 'center', justifyContent: 'center' },
  logsIconPage: {
    width: 20, height: 22, borderWidth: 2, borderColor: COLORS.darkText,
    borderRadius: 3, paddingHorizontal: 3, paddingVertical: 4,
    justifyContent: 'space-between',
  },
  logsIconLine: { width: '100%', height: 2, backgroundColor: COLORS.darkText, borderRadius: 1 },

  // ── Filters
  filterRow: { flexDirection: 'row', gap: 12, marginBottom: 16, flexWrap: 'wrap' },
  filterDropdown: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1.5, borderColor: '#CCCCCC', borderRadius: 8,
    paddingVertical: 9, paddingHorizontal: 14,
    backgroundColor: COLORS.white, minWidth: isMobile ? 140 : 170,
    gap: 8,
  },
  filterDropdownText: { fontSize: 13, fontWeight: '600', color: COLORS.darkText, flex: 1 },
  filterDivider: { width: 1, height: 16, backgroundColor: '#DDDDDD' },
  chevronWrap: { width: 10, height: 6, justifyContent: 'flex-end', alignItems: 'center' },
  chevronLeft: {
    width: 6, height: 2, backgroundColor: '#888',
    borderRadius: 1, transform: [{ rotate: '45deg' }, { translateX: 2.5 }],
  },
  chevronRight: {
    width: 6, height: 2, backgroundColor: '#888',
    borderRadius: 1, transform: [{ rotate: '-45deg' }, { translateX: -2.5 }],
    marginTop: -2,
  },

  // ── Legend
  legendRow: { flexDirection: 'row', flexWrap: 'wrap', gap: isMobile ? 10 : 20, marginBottom: 20 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 2 },
  legendLabel: { fontSize: isMobile ? 11 : 12, color: COLORS.darkText, fontWeight: '500' },

  // ── Card
  card: {
    backgroundColor: COLORS.cardBg, borderRadius: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.07, shadowRadius: 12, elevation: 4,
    borderWidth: 1, borderColor: COLORS.lightGray,
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: isMobile ? 14 : 20,
    paddingVertical: isMobile ? 12 : 16,
    borderBottomWidth: 1, borderBottomColor: COLORS.lightGray,
    flexWrap: 'wrap', gap: 10,
  },
  cardTitle: { fontSize: isMobile ? 14 : 16, fontWeight: '800', color: COLORS.darkText },

  // ── Log search bar
  logSearchBar: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1.5, borderColor: COLORS.lightGray,
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8,
    backgroundColor: COLORS.offWhite,
    minWidth: isMobile ? 160 : 220,
  },
  searchIconWrap: { width: 16, height: 16, marginRight: 8, justifyContent: 'center', alignItems: 'center' },
  searchCircle: {
    width: 10, height: 10, borderRadius: 5, borderWidth: 1.5,
    position: 'absolute', top: 0, left: 0,
  },
  searchHandle: {
    width: 2, height: 5, borderRadius: 1,
    position: 'absolute', bottom: 0, right: 1.5,
    transform: [{ rotate: '-45deg' }],
  },
  logSearchInput: { flex: 1, fontSize: 13, color: COLORS.darkText, padding: 0 },

  // ── Table
  tableHead: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: isMobile ? 14 : 20, paddingVertical: 10,
    backgroundColor: '#F3F4F6', borderBottomWidth: 1, borderBottomColor: COLORS.lightGray,
  },
  tableHeadCol: { paddingHorizontal: 6 },
  tableHeadCell: {
    fontSize: 11, fontWeight: '700', color: COLORS.subText,
    letterSpacing: 0.8, textTransform: 'uppercase',
  },
  tableRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: isMobile ? 14 : 20, paddingVertical: isMobile ? 12 : 16,
    borderBottomWidth: 1, borderBottomColor: COLORS.lightGray,
  },
  tableRowAlt: { backgroundColor: '#FAFAFA' },
  tableRowLast: { borderBottomWidth: 0 },
  tableCell: { paddingHorizontal: 6 },

  // ── Column widths
  colAction: { flex: 1.8, alignItems: 'flex-start', justifyContent: 'center' },
  colDesc:   { flex: 3.5 },
  colDate:   { flex: 2, alignItems: 'flex-end' },

  // ── Action badge
  actionBadge: {
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 20, borderWidth: 1,
  },
  actionBadgeText: { fontSize: isMobile ? 10 : 11, fontWeight: '700', letterSpacing: 0.2 },

  // ── Description & date
  descText: { fontSize: isMobile ? 12 : 13, color: COLORS.darkText, lineHeight: 19 },
  dateText: { fontSize: isMobile ? 11 : 12, fontWeight: '600', color: COLORS.navy },

  // ── Mobile stacked row
  mobileRow: { flex: 1, gap: 8 },
  mobileRowTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },

  // ── Empty state
  emptyState: { alignItems: 'center', paddingVertical: 48, paddingHorizontal: 24 },
  emptyEmoji: { fontSize: 36, marginBottom: 12 },
  emptyText: { fontSize: 15, fontWeight: '700', color: COLORS.darkText, marginBottom: 6 },
  emptySubText: { fontSize: 13, color: COLORS.subText, textAlign: 'center', lineHeight: 20 },

  // ── Dropdown (anchored overlay on SafeAreaView)
  dropMenu: {
    position: 'absolute',
    backgroundColor: COLORS.white, borderRadius: 14,
    paddingVertical: 8, minWidth: 220,
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18, shadowRadius: 20, elevation: 20,
    zIndex: 9999,
    borderWidth: 1, borderColor: COLORS.lightGray,
  },
  dropTitle: {
    fontSize: 12, fontWeight: '700', color: COLORS.subText,
    letterSpacing: 1, textTransform: 'uppercase',
    paddingHorizontal: 16, paddingTop: 8, paddingBottom: 10,
    borderBottomWidth: 1, borderBottomColor: COLORS.lightGray,
    marginBottom: 4,
  },
  dropItem: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
  },
  dropItemActive: { backgroundColor: COLORS.navy + '10' },
  dropItemText: { fontSize: 14, color: COLORS.darkText, fontWeight: '500' },
  dropItemTextActive: { color: COLORS.navy, fontWeight: '700' },
  dropCheckmark: { fontSize: 14, color: COLORS.navy, fontWeight: '700' },
});