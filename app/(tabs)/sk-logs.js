import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  View, Text, TextInput, ScrollView, TouchableOpacity,
  StyleSheet, SafeAreaView, StatusBar, Dimensions, Image,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useNav } from './navContext';
import { useAuth } from './authContext';
import { supabase } from '../../utils/supabase';
import { NotificationModal, useNotificationCenter, BellIcon } from './notificationCenter';
import Sidebar from './../components/Sidebar';
import Head from 'expo-router/head';
import MobileHeader, { MobileHeaderSpacer } from './mobileHeader';
const { width: SCREEN_WIDTH } = Dimensions.get('window');
const isMobile = SCREEN_WIDTH < 768;

// Supabase returns timestamps without a timezone suffix (e.g. '2026-05-28 03:50:28').
// JS treats that as local time, not UTC, causing an 8-hour display error in PHT.
// This helper forces correct UTC parsing before any display conversion.
const toUtcDate = (dateStr) => {
  if (!dateStr) return new Date();
  const iso = dateStr.toString().replace(' ', 'T').replace(/Z?$/, 'Z');
  return new Date(iso);
};

const COLORS = {
  maroon: '#8B0000', maroonDark: '#6B0000', maroonLight: '#A50000',
  gold: '#E8C547', accent: '#D4A017', calGold: '#E8A020',
  white: '#FFFFFF', offWhite: '#F7F5F2', lightGray: '#ECECEC',
  midGray: '#B0B0B0', darkText: '#1A1A1A', subText: '#666666',
  teal: '#2A7B7B', cardBg: '#FFFFFF', shadow: 'rgba(0,0,0,0.08)',
  navy: '#133E75',
};

// ─── ACTION CONFIG ─────────────────────────────────────────────────────────────
const ACTION_CONFIG = {
  'Create document': { bg: '#EEF0FB', text: '#3949AB', border: '#C5CAE9' },
  'Submit to LYDO':  { bg: '#EDE7F6', text: '#6A1B9A', border: '#CE93D8' },
  'Scan & upload':   { bg: '#E8F5E9', text: '#2E7D32', border: '#A5D6A7' },
  'Upload to website':{ bg: '#FFF3E0', text: '#BF6000', border: '#FFCC80' },
};

const LEGEND_ITEMS = [
  { label: 'Create document',   color: '#3949AB' },
  { label: 'Submit to LYDO',    color: '#6A1B9A' },
  { label: 'Scan & upload',     color: '#2E7D32' },
  { label: 'Upload to website', color: '#BF6000' },
];

const POSITIONS = ['All', 'Chairman', 'Secretary', 'Treasurer'];
const DATE_RANGES = ['All time', 'Today', 'This week', 'This month', 'Last 3 months'];

// ─── ICON COMPONENTS ──────────────────────────────────────────────────────────
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
        <View style={{ position: 'absolute', left: 0, right: 0, top: fold, bottom: 0, borderWidth: 1.5, borderColor: color, borderRadius: size * 0.08 }} />
        <View style={{ position: 'absolute', top: 0, right: 0, width: fold, height: fold, backgroundColor: color, borderBottomLeftRadius: size * 0.06 }} />
        <View style={{ position: 'absolute', top: 0, left: 0, width: w - fold, height: fold, borderTopWidth: 1.5, borderLeftWidth: 1.5, borderColor: color, borderTopLeftRadius: size * 0.08 }} />
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
        <View style={{ height: size * 0.22, backgroundColor: color, width: '100%' }} />
        <View style={{ flex: 1, flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', paddingHorizontal: size * 0.05 }}>
          {[0,1,2].map(i => <View key={i} style={{ width: size * 0.1, height: size * 0.1, borderRadius: size * 0.05, backgroundColor: color }} />)}
        </View>
      </View>
      <View style={{ position: 'absolute', top: 0, flexDirection: 'row', gap: size * 0.32 }}>
        {[0,1].map(i => <View key={i} style={{ width: size * 0.1, height: size * 0.2, backgroundColor: color, borderRadius: size * 0.05 }} />)}
      </View>
    </View>
  );
};

// Portal: simple globe
const PortalIcon = ({ color = '#fff', size = 16 }) => (
  <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
    <View style={{ width: size * 0.82, height: size * 0.82, borderRadius: size * 0.41, borderWidth: 1.5, borderColor: color, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' }}>
      <View style={{ position: 'absolute', height: 1.5, width: '100%', backgroundColor: color }} />
      <View style={{ width: size * 0.38, height: size * 0.78, borderRadius: size * 0.19, borderWidth: 1.5, borderColor: color, backgroundColor: 'transparent' }} />
    </View>
  </View>
);

// Account: head + shoulders silhouette
const AccountIcon = ({ color = '#fff', size = 16 }) => (
  <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
    <View style={{ width: size * 0.38, height: size * 0.38, borderRadius: size * 0.19, borderWidth: 1.5, borderColor: color, marginBottom: size * 0.04 }} />
    <View style={{ width: size * 0.72, height: size * 0.36, borderBottomLeftRadius: size * 0.36, borderBottomRightRadius: size * 0.36, borderWidth: 1.5, borderColor: color, borderTopWidth: 0, overflow: 'hidden' }} />
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

// BellIcon now lives in notificationCenter.js and is imported above — shared
// across every screen (SK + LYDO, desktop + mobile) instead of being redrawn here.

const SearchIcon = ({ color = COLORS.midGray }) => (
  <View style={styles.searchIconWrap}>
    <View style={[styles.searchCircle, { borderColor: color }]} />
    <View style={[styles.searchHandle, { backgroundColor: color }]} />
  </View>
);

const PageLogsIcon = () => (
  <View style={styles.logsIconWrap}>
    <View style={styles.logsIconPage}>
      <View style={styles.logsIconLine} />
      <View style={styles.logsIconLine} />
      <View style={[styles.logsIconLine, { width: '60%' }]} />
    </View>
  </View>
);

// Logs nav icon: clipboard with clip tab + 3 dot-line rows (matches sk-dashboard)
const LogsIcon = ({ color = '#fff', size = 16 }) => (
  <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
    <View style={{ width: size * 0.75, height: size * 0.85, borderWidth: 1.5, borderColor: color, borderRadius: size * 0.1, paddingHorizontal: size * 0.1, paddingVertical: size * 0.1, justifyContent: 'space-around' }}>
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

const ChevronIcon = () => (
  <View style={styles.chevronWrap}>
    <View style={styles.chevronLeft} />
    <View style={styles.chevronRight} />
  </View>
);

// ─── ANCHORED DROPDOWN OVERLAY ────────────────────────────────────────────────
// Rendered at the root SafeAreaView level — immune to ScrollView/card clipping.
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
export default function LogsScreen() {
  const router = useRouter();
  const { activeTab, setActiveTab } = useNav();
  const { logout, user } = useAuth();

  const [searchText, setSearchText] = useState('');
  const [positionFilter, setPositionFilter] = useState('All');
  const [dateFilter, setDateFilter] = useState('All time');
  const [posDropVisible, setPosDropVisible] = useState(false);
  const [dateDropVisible, setDateDropVisible] = useState(false);
  const [posAnchor, setPosAnchor] = useState(null);
  const [dateAnchor, setDateAnchor] = useState(null);
  const posButtonRef = useRef(null);
  const dateButtonRef = useRef(null);
  const safeAreaRef = useRef(null);
  const [sidebarVisible, setSidebarVisible] = useState(false);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  const barangayName = user?.barangay?.barangay_name || 'Unknown Barangay';
  const barangayId = user?.barangayId;

  // ── Shared notification bell (returned/approved docs, templates, deadlines) ──
  const notif = useNotificationCenter(barangayId);
  const notifCount = notif.count;

  useEffect(() => {
    if (user && user.role !== 'sk') router.replace('/');
  }, [user]);

  // ── Fetch logs from Supabase — runs every time the screen comes into focus ─
  useFocusEffect(
    useCallback(() => {
      const fetchLogs = async () => {
        if (!barangayId) return;
        setLoading(true);

        try {
          // Step 1: get all user_ids that belong to this barangay
          const { data: barangayUsers, error: usersError } = await supabase
            .from('users')
            .select('user_id, first_name, last_name, middle_initial, position')
            .eq('barangay_id', barangayId);

          if (usersError) {
            console.error('Error fetching barangay users:', usersError);
            setLogs([]);
            return;
          }

          if (!barangayUsers || barangayUsers.length === 0) {
            setLogs([]);
            return;
          }

          // Build a lookup map: user_id → user info
          const userMap = {};
          barangayUsers.forEach((u) => {
            const nameParts = [u.first_name, u.middle_initial, u.last_name].filter(Boolean);
            userMap[u.user_id] = {
              fullName: nameParts.join(' '),
              position: u.position || 'Officer',
            };
          });

          const barangayUserIds = barangayUsers.map((u) => u.user_id);

          // Step 2: fetch sk_activity_logs for those users only
          const { data, error } = await supabase
            .from('sk_activity_logs')
            .select('id, action, description, created_at, user_id')
            .in('user_id', barangayUserIds)
            .order('created_at', { ascending: false })
            .limit(100);

          if (error) {
            console.error('Error fetching logs:', error);
            setLogs([]);
            return;
          }

          if (!data || data.length === 0) {
            setLogs([]);
            return;
          }

          const mapped = data.map((row) => {
            const officer = userMap[row.user_id] || { fullName: 'Unknown', position: 'Officer' };
            return {
              id: row.id,
              officerName: officer.fullName,
              position: officer.position
                ? officer.position.charAt(0).toUpperCase() + officer.position.slice(1)
                : 'Officer',
              action: row.action || 'Create document',
              description: row.description || '',
              createdAt: toUtcDate(row.created_at),
            };
          });

          setLogs(mapped);
        } catch (err) {
          console.error('Fetch error:', err);
          setLogs([]);
        } finally {
          setLoading(false);
        }
      };

      fetchLogs();
    }, [barangayId])
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
      const matchPos = positionFilter === 'All' || log.position?.toLowerCase() === positionFilter.toLowerCase();
      const matchDate = isInDateRange(log.createdAt);
      const q = searchText.toLowerCase();
      const matchSearch = !q ||
        log.officerName.toLowerCase().includes(q) ||
        log.action.toLowerCase().includes(q) ||
        log.description.toLowerCase().includes(q) ||
        log.position.toLowerCase().includes(q);
      return matchPos && matchDate && matchSearch;
    });
  }, [logs, positionFilter, dateFilter, searchText]);

  const measureButton = (ref, setAnchor) => {
    ref.current?.measureInWindow((x, y, width, height) => {
      setAnchor({ x, y, width, height });
    });
  };

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

  const formatDate = (date) =>
    new Date(date).toLocaleDateString('en-PH', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', year: 'numeric' });

  const formatTime = (date) =>
    new Date(date).toLocaleTimeString('en-PH', { timeZone: 'Asia/Manila', hour: 'numeric', minute: '2-digit', hour12: true });


    const renderSidebar = () => (
      <Sidebar
        activeTab={activeTab}
        onNavPress={handleNavPress}
        onLogout={handleLogout}
        isMobile={isMobile}
        sidebarVisible={sidebarVisible}
      />
    );

  // ── Action badge ───────────────────────────────────────────────────────────
  const renderActionBadge = (action) => {
    const cfg = ACTION_CONFIG[action] || ACTION_CONFIG['Create document'];
    return (
      <View style={[styles.actionBadge, { backgroundColor: cfg.bg, borderColor: cfg.border }]}>
        <Text style={[styles.actionBadgeText, { color: cfg.text }]}>{action}</Text>
      </View>
    );
  };

  // ── Avatar circle ──────────────────────────────────────────────────────────
  const renderAvatar = (name) => {
    const initials = name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
    return (
      <View style={styles.avatarCircle}>
        <Text style={styles.avatarText}>{initials}</Text>
      </View>
    );
  };

  return (
    <>
      <Head>
        <title>Logs · SK Monitoring</title>
      </Head>
      <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.navy} />
      {/* Dropdown overlays — rendered above everything, measured to anchor under their buttons */}
      <AnchoredDropdown
        visible={posDropVisible}
        anchor={posAnchor}
        options={POSITIONS}
        selected={positionFilter}
        onSelect={setPositionFilter}
        onClose={() => setPosDropVisible(false)}
        title="Filter by Position"
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
      <NotificationModal
        {...notif.modalProps}
        onOpenRoute={(route) => {
          notif.close();
          setTimeout(() => router.push(route), 120);
        }}
      />
      <View style={styles.layout}>
        {isMobile && sidebarVisible && (
          <TouchableOpacity
            style={styles.sidebarOverlay}
            activeOpacity={1}
            onPress={() => setSidebarVisible(false)}
          />
        )}
        {renderSidebar()}

        <View style={[styles.main, isMobile && styles.mainMobile]}>
          <MobileHeader
            title="Activity Logs"
            onMenuPress={() => setSidebarVisible(!sidebarVisible)}
            onBellPress={notif.open}
            bellCount={notifCount}
            BellIcon={BellIcon}
            colors={COLORS}
          />
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={styles.mainContent}
            showsVerticalScrollIndicator={false}
          >
          <MobileHeaderSpacer />

          {/* Page Header */}
          {!isMobile && (
            <View style={styles.pageHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.headerSub}>SANGGUNIANG KABATAAN</Text>
                <Text style={styles.headerTitle}>{barangayName.toUpperCase()}</Text>
              </View>
            <TouchableOpacity style={styles.bellBtn} onPress={notif.open} activeOpacity={0.7}>
              <BellIcon count={notifCount} />
            </TouchableOpacity>
            </View>
          )}

          {/* Section title */}
          <View style={styles.sectionTitleRow}>
            <PageLogsIcon />
            <Text style={styles.sectionTitle}>Activity logs</Text>
          </View>

          {/* Filter bar */}
          <View style={styles.filterRow}>
            {/* Position filter */}
            <TouchableOpacity
              ref={posButtonRef}
              style={styles.filterDropdown}
              onPress={() => {
                setDateDropVisible(false);
                if (!posDropVisible) measureButton(posButtonRef, setPosAnchor);
                setPosDropVisible(!posDropVisible);
              }}
              activeOpacity={0.8}
            >
              <Text style={styles.filterDropdownText}>
                {positionFilter === 'All' ? 'Position' : positionFilter}
              </Text>
              <View style={styles.filterDivider} />
              <ChevronIcon />
            </TouchableOpacity>

            {/* Date Range filter */}
            <TouchableOpacity
              ref={dateButtonRef}
              style={styles.filterDropdown}
              onPress={() => {
                setPosDropVisible(false);
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
              <Text style={styles.cardTitle}>Recent activity</Text>
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
                <View style={[styles.tableHeadCol, styles.colOfficer]}>
                  <Text style={styles.tableHeadCell}>OFFICER</Text>
                </View>
                <View style={[styles.tableHeadCol, styles.colAction]}>
                  <Text style={[styles.tableHeadCell, { textAlign: 'center' }]}>ACTION</Text>
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
                  {searchText || positionFilter !== 'All' || dateFilter !== 'All time'
                    ? 'Try adjusting your filters or search.'
                    : 'Activity will appear here once officers take action.'}
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
                        {renderAvatar(log.officerName)}
                        <View style={styles.officerInfo}>
                          <Text style={styles.officerName}>{log.officerName}</Text>
                          <Text style={styles.officerPosition}>{log.position}</Text>
                        </View>
                        <Text style={styles.dateText}>
                          {formatDate(log.createdAt)}
                        </Text>
                      </View>
                      <View style={styles.mobileRowBottom}>
                        {renderActionBadge(log.action)}
                        <Text style={styles.descText} numberOfLines={2}>{log.description}</Text>
                      </View>
                    </View>
                  ) : (
                    // Desktop: columns layout
                    <>
                      <View style={[styles.tableCell, styles.colOfficer]}>
                        <View style={styles.officerRow}>
                          {renderAvatar(log.officerName)}
                          <View style={styles.officerInfo}>
                            <Text style={styles.officerName}>{log.officerName}</Text>
                            <Text style={styles.officerPosition}>{log.position}</Text>
                          </View>
                        </View>
                      </View>
                      <View style={[styles.tableCell, styles.colAction]}>
                        {renderActionBadge(log.action)}
                      </View>
                      <View style={[styles.tableCell, styles.colDesc]}>
                        <Text style={styles.descText}>{log.description}</Text>
                      </View>
                      <View style={[styles.tableCell, styles.colDate]}>
                        <Text style={styles.dateText}>{formatDate(log.createdAt)}</Text>
                        <Text style={styles.timeText}>{formatTime(log.createdAt)}</Text>
                      </View>
                    </>
                  )}
                </View>
              ))
            )}
          </View>

        </ScrollView>
        </View>
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
    alignItems: 'center', paddingTop: 20, paddingBottom: 24, paddingHorizontal: 10, zIndex: 20,
    ...(isMobile ? { position: 'absolute', top: 0, left: 0, bottom: 0, zIndex: 20 } : {}),
  },
  sidebarHidden: { display: 'none' },
  sidebarOverlay: {
    position: 'absolute', left: 0, top: 0, bottom: 0, right: 0,
    backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 15,
  },

  // ── Sidebar elements
  logoPill: {
    marginTop: 20, width: 70, height: 70, borderRadius: 35,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 8, borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)',
  },
  logoImage: { width: 100, height: 100 },
  navItem: {
    width: '100%', paddingVertical: 12, paddingHorizontal: 12,
    borderRadius: 24, marginBottom: 8, alignItems: 'center',
    borderWidth: 1.5, borderColor: COLORS.white, backgroundColor: COLORS.navy,
  },
  navItemInner: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  navItemActive: { backgroundColor: COLORS.white, borderWidth: 1.5, borderColor: '#000000' },
  navLabel: { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.8)', letterSpacing: 0.3 },
  navLabelActive: { color: '#000000', fontWeight: '800' },
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

  // ── Page header
  pageHeader: {
    flexDirection: 'row', alignItems: 'flex-start',
    justifyContent: 'space-between', marginBottom: 12,
  },
  headerSub: {
    fontSize: 10, fontWeight: '600', color: COLORS.subText,
    letterSpacing: 2, marginBottom: 2, textTransform: 'uppercase',
  },
  headerTitle: {
    fontSize: 22, fontWeight: '900', color: COLORS.darkText, letterSpacing: 0.3,
    borderBottomWidth: 2, borderBottomColor: COLORS.lightGray, paddingBottom: 4, marginBottom: 6,
  },

  // ── Bell ──
  bellBtn: {
    position: 'relative',
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: COLORS.cardBg, alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08, shadowRadius: 6, elevation: 3,
  },
  bellBtnMobile: { position: 'relative' },
  notifBadge:  { position: 'absolute', top: -2, right: -2, width: 16, height: 16, borderRadius: 8, backgroundColor: COLORS.gold, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: COLORS.white },
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
  tableHeadCol: { paddingHorizontal: 6 },  tableHeadCell: {
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

  // ── Column widths — must be identical between header and data rows
  colOfficer: { flex: 2.2 },
  colAction:  { flex: 1.8, alignItems: 'center', justifyContent: 'center' },
  colDesc:    { flex: 2.5 },
  colDate:    { flex: 1.5, alignItems: 'flex-end' },

  // ── Officer info
  officerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  officerInfo: { flex: 1 },
  avatarCircle: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#E0E7F0', alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: '#C8D5E8', flexShrink: 0,
  },
  avatarText: { fontSize: 12, fontWeight: '700', color: COLORS.navy },
  officerName: { fontSize: isMobile ? 12 : 13, fontWeight: '700', color: COLORS.darkText },
  officerPosition: { fontSize: isMobile ? 10 : 11, color: COLORS.navy, fontWeight: '600', marginTop: 1 },

  // ── Action badge
  actionBadge: {
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 20, borderWidth: 1,
  },
  actionBadgeText: { fontSize: isMobile ? 10 : 11, fontWeight: '700', letterSpacing: 0.2 },

  // ── Description & date
  descText: { fontSize: isMobile ? 12 : 13, color: COLORS.darkText, lineHeight: 19 },
  dateText: { fontSize: isMobile ? 11 : 12, fontWeight: '600', color: COLORS.navy },
  timeText: { fontSize: 10, color: COLORS.subText, marginTop: 2 },

  // ── Mobile stacked row
  mobileRow: { flex: 1, gap: 10 },
  mobileRowTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  mobileRowBottom: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingLeft: 46 },

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