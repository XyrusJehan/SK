import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  View, Text, TextInput, ScrollView, TouchableOpacity,
  StyleSheet, SafeAreaView, StatusBar, Dimensions, Image,
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
  const currentUserId = user?.id;

  useEffect(() => {
    if (user && user.role !== 'sk') router.replace('/');
  }, [user]);

  // ── Fetch logs from Supabase ───────────────────────────────────────────────
  useEffect(() => {
    const fetchLogs = async () => {
      if (!barangayId || !currentUserId) return;
      setLoading(true);

      try {
        const { data, error } = await supabase
          .from('activity_logs')
          .select(`
            id,
            action,
            description,
            created_at,
            user_id,
            officer:profiles (
              full_name,
              position,
              avatar_url
            )
          `)
          .eq('barangay_id', barangayId)
          .neq('user_id', currentUserId)
          .order('created_at', { ascending: false })
          .limit(50);

        if (error) {
          console.error('Error fetching logs:', error);
          setLogs([]);
          return;
        }

        if (!data || data.length === 0) {
          setLogs([]);
          return;
        }

        const mapped = data.map((row) => ({
          id: row.id,
          officerName: row.officer?.full_name || 'Unknown',
          position: row.officer?.position || 'Officer',
          avatarUrl: row.officer?.avatar_url || null,
          action: row.action || 'Create document',
          description: row.description || '',
          createdAt: new Date(row.created_at),
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
  }, [barangayId, currentUserId]);

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
    new Date(date).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });

  const formatTime = (date) =>
    new Date(date).toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit', hour12: true });

  // ── Sidebar ────────────────────────────────────────────────────────────────
  const renderSidebar = () => (
    <View style={[styles.sidebar, isMobile && !sidebarVisible && styles.sidebarHidden]}>
      <View style={styles.logoPill}>
        <Image
          source={require('./../../assets/images/sk-logo.png')}
          style={styles.logoImage}
          resizeMode="contain"
        />
      </View>
      <View style={{ height: 28 }} />
      {['Dashboard', 'Documents', 'Planning', 'Portal', 'Logs', 'Account'].map((tab) => {
        const active = activeTab === tab;
        return (
          <TouchableOpacity
            key={tab}
            style={[styles.navItem, active && styles.navItemActive]}
            onPress={() => handleNavPress(tab)}
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
      <StatusBar barStyle="light-content" backgroundColor={COLORS.navy} />

      <SafeAreaView ref={safeAreaRef} style={styles.safe}>
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
      <View style={styles.layout}>
        {isMobile && sidebarVisible && (
          <TouchableOpacity
            style={styles.sidebarOverlay}
            activeOpacity={1}
            onPress={() => setSidebarVisible(false)}
          />
        )}
        {renderSidebar()}

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

          {/* Page Header */}
          <View style={styles.pageHeader}>
            <View>
              <Text style={styles.headerSub}>SANGGUNIANG KABATAAN</Text>
              <Text style={styles.headerTitle}>{barangayName.toUpperCase()}</Text>
            </View>
          </View>

          <View style={styles.divider} />

          {/* Section title */}
          <View style={styles.sectionTitleRow}>
            <LogsIcon />
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
  mainContent: { padding: isMobile ? 12 : 24, paddingBottom: isMobile ? 24 : 48 },

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
  pageHeader: {
    flexDirection: 'row', alignItems: 'flex-start',
    justifyContent: 'space-between', marginBottom: 12,
  },
  headerSub: {
    fontSize: isMobile ? 9 : 11, fontWeight: '600', color: COLORS.subText,
    letterSpacing: 2, marginBottom: 2, textTransform: 'uppercase',
  },
  headerTitle: {
    fontSize: isMobile ? 18 : 22, fontWeight: '900', color: COLORS.darkText, letterSpacing: 0.4,
  },
  divider: { height: 1.5, backgroundColor: COLORS.navy + '25', marginBottom: 20 },

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