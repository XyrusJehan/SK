import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
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

// ─── MOCK DATA ────────────────────────────────────────────────────────────────
const TASKS = [
  {
    id: '1',
    description: 'Remind barangays that do not submit required documents on time',
    action: 'Send Reminder',
    urgent: true,
  },
];

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

const ActivityDot = ({ type }) => {
  const colors = { upload: COLORS.accent, create: COLORS.teal, share: COLORS.gold };
  return <View style={[styles.activityDot, { backgroundColor: colors[type] ?? COLORS.midGray }]} />;
};

const MenuIcon = () => (
  <View style={styles.menuIconContainer}>
    <View style={styles.menuLine} />
    <View style={styles.menuLine} />
    <View style={styles.menuLine} />
  </View>
);

// ─── COLORS ───────────────────────────────────────────────────────────────────
const COLORS = {
  maroon:     '#8B0000',
  maroonDark: '#6B0000',
  gold:       '#E8C547',
  accent:     '#D4A017',
  white:      '#FFFFFF',
  offWhite:   '#F7F5F2',
  lightGray:  '#ECECEC',
  midGray:    '#B0B0B0',
  darkText:   '#1A1A1A',
  subText:    '#666666',
  teal:       '#2A7B7B',
  cardBg:     '#FFFFFF',
};

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
export default function LYDOHomeScreen({ navigation }) {
  const router = useRouter();
  const { activeTab, setActiveTab } = useNav();
  const { logout, user } = useAuth();
  const [searchText, setSearchText]   = useState('');

  // Redirect if not LYDO
  useEffect(() => {
    if (user && user.role !== 'lydo') {
      router.replace('/');
    }
  }, [user]);

  useEffect(() => {
    setActiveTab('Dashboard');
  }, []);
  const [sortBy, setSortBy]           = useState('Newest');
  const [notifCount]                  = useState(3);
  const [pendingCount, setPendingCount] = useState(0);
  const [sidebarVisible, setSidebarVisible] = useState(false);
  const [activities, setActivities]   = useState([]);
  const [totalBarangays, setTotalBarangays] = useState(0);

  // Fetch statistics and recent activities
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Get total barangays
        const { data: brgyData, error: brgyError } = await supabase
          .from('barangays')
          .select('barangay_id', { count: 'exact' });

        if (brgyError) {
          console.error('Error fetching barangays:', brgyError);
        } else {
          setTotalBarangays(brgyData?.length || 0);
        }

        // Get pending documents count (draft or saved status)
        const { data: pendingData, error: pendingError } = await supabase
          .from('documents')
          .select('document_id', { count: 'exact' })
          .in('status', ['draft', 'saved']);

        if (pendingError) {
          console.error('Error fetching pending:', pendingError);
        } else {
          setPendingCount(pendingData?.length || 0);
        }

        // Get recent activities from documents table
        const { data: docsData, error: docsError } = await supabase
          .from('documents')
          .select(`
            document_id,
            title,
            status,
            created_at,
            saved_at,
            submitted_at,
            barangay:barangays(barangay_name)
          `)
          .order('created_at', { ascending: false })
          .limit(20);

        if (docsError) {
          console.error('Error fetching activities:', docsError);
        } else {
          // Transform into activities
          const formattedActivities = docsData?.map(doc => {
            // Determine action type based on status
            let actionType = 'create';
            let actionLabel = 'Created document';

            if (doc.status === 'submitted' || doc.status === 'approved') {
              actionType = 'upload';
              actionLabel = 'Submitted document';
            } else if (doc.status === 'draft') {
              actionType = 'create';
              actionLabel = 'Draft document';
            } else if (doc.status === 'saved') {
              actionType = 'save';
              actionLabel = 'Saved document';
            }

            const date = doc.submitted_at || doc.saved_at || doc.created_at;
            const dateObj = date ? new Date(date) : new Date();

            return {
              id: doc.document_id,
              label: actionLabel,
              barangay: doc.barangay?.barangay_name || 'Unknown',
              time: dateObj.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
              date: dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
              type: actionType,
              title: doc.title
            };
          }) || [];

          setActivities(formattedActivities);
        }
      } catch (error) {
        console.error('Error:', error);
      }
    };

    fetchData();
  }, []);

  const today = new Date().toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric',
  });

  const sortedActivities =
    sortBy === 'Name'
      ? [...activities].sort((a, b) => a.label.localeCompare(b.label))
      : activities;

  const handleNav = (tab) => {
    setActiveTab(tab);
    setSidebarVisible(false);
    if (tab === 'Documents') {
      router.push('/(tabs)/lydo-document');
    }
    else if (tab === 'Monitor') {
      router.push('/(tabs)/lydo-monitor');
    }
  };

  const handleSendReminder = () => {
    Alert.alert('Reminder Sent', 'All non-compliant barangays have been notified.');
    if (pendingCount > 0) setPendingCount((p) => p - 1);
  };

  const handleLogout = () => {
    logout();
    router.replace('/');
  };

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
      {['Dashboard', 'Documents', 'Monitor'].map((tab) => {
        const active = activeTab === tab;
        return (
          <TouchableOpacity
            key={tab}
            style={[styles.navItem, active && styles.navItemActive]}
            onPress={() => handleNav(tab)}
            activeOpacity={0.8}
          >
            <Text style={[styles.navLabel, active && styles.navLabelActive]}>
              {tab}
            </Text>
          </TouchableOpacity>
        );
      })}
      <View style={ { flex: 1 } } />
      <TouchableOpacity
        style={styles.logoutBtn}
        onPress={handleLogout}
        activeOpacity={0.8}
      >
        <Text style={styles.logoutText}>Logout</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.maroon} />

      <View style={styles.layout}>
        {/* Mobile: Sidebar as overlay */}
        {isMobile && sidebarVisible && (
          <TouchableOpacity
            style={styles.sidebarOverlay}
            activeOpacity={1}
            onPress={() => setSidebarVisible(false)}
          />
        )}

        {isMobile ? (
          sidebarVisible && renderSidebar()
        ) : (
          renderSidebar()
        )}

        {/* ── MAIN CONTENT ── */}
        <ScrollView
          style={[styles.main, isMobile && styles.mainMobile]}
          contentContainerStyle={styles.mainContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Mobile Header */}
          {isMobile && (
            <View style={styles.mobileHeader}>
              <TouchableOpacity
                style={styles.menuBtn}
                onPress={() => setSidebarVisible(!sidebarVisible)}
              >
                <MenuIcon />
              </TouchableOpacity>
              <Text style={styles.mobileTitle}>LYDO Home</Text>
              <View style={{ width: 40 }} />
            </View>
          )}

          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.headerSub}>SANGGUNIANG KABATAAN FEDERATION</Text>
              <Text style={styles.headerTitle}>RIZAL, LAGUNA</Text>
            </View>
            {!isMobile && (
              <TouchableOpacity style={styles.bellBtn} activeOpacity={0.7}>
                <BellIcon hasNotif={notifCount > 0} />
                {notifCount > 0 && (
                  <View style={styles.notifBadge}>
                    <Text style={styles.notifBadgeText}>{notifCount}</Text>
                  </View>
                )}
              </TouchableOpacity>
            )}
          </View>

          {/* ── STAT CARDS ── */}
          <View style={isMobile ? styles.statsColumn : styles.statsRow}>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>TOTAL BARANGAYS</Text>
              <Text style={styles.statValue}>{totalBarangays}</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>PENDING DOCUMENTS</Text>
              <Text style={styles.statValue}>{pendingCount}</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>APPROVED DOCUMENTS</Text>
              <Text style={styles.statValue}>0</Text>
            </View>
          </View>

          {/* Today */}
          <Text style={styles.todayText}>Today: {today}</Text>

          {/* Search Bar */}
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

          {/* ── TASKS CARD ── */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.cardHeaderAccent} />
              <Text style={styles.cardTitle}>Tasks</Text>
              <View style={styles.taskBadge}>
                <Text style={styles.taskBadgeText}>{TASKS.length}</Text>
              </View>
            </View>

            <View style={styles.tableHead}>
              <Text style={[styles.tableHeadCell, { flex: 1, textAlign: 'left' }]}>Task</Text>
              <Text style={styles.tableHeadCell}>Action</Text>
            </View>

            {TASKS.map((task, idx) => (
              <View
                key={task.id}
                style={[styles.tableRow, idx % 2 === 0 && styles.tableRowAlt]}
              >
                <View style={styles.taskDescRow}>
                  {task.urgent && <View style={styles.urgentDot} />}
                  <Text style={styles.taskDesc}>{task.description}</Text>
                </View>
                <TouchableOpacity
                  style={styles.reminderBtn}
                  onPress={handleSendReminder}
                  activeOpacity={0.8}
                >
                  <Text style={styles.actionBtnText}>{task.action}</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>

          {/* ── RECENT ACTIVITY CARD ── */}
          <View style={[styles.card, { marginBottom: 32 }]}>
            <View style={styles.cardHeader}>
              <View style={[styles.cardHeaderAccent, { backgroundColor: COLORS.teal }]} />
              <Text style={styles.cardTitle}>Recent Activity</Text>
              <View style={styles.sortRow}>
                <Text style={styles.sortLabel}>Sort by: </Text>
                {['Newest', 'Name'].map((s) => (
                  <TouchableOpacity
                    key={s}
                    onPress={() => setSortBy(s)}
                    style={[styles.sortBtn, sortBy === s && styles.sortBtnActive]}
                  >
                    <Text style={[styles.sortBtnText, sortBy === s && styles.sortBtnTextActive]}>
                      {s}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {sortedActivities.map((act, idx) => (
              <View
                key={act.id}
                style={[
                  styles.activityRow,
                  idx < sortedActivities.length - 1 && styles.activityRowBorder,
                ]}
              >
                <ActivityDot type={act.type} />
                <View style={styles.activityInfo}>
                  <Text style={styles.activityLabel}>{act.label}</Text>
                  <Text style={styles.activityMeta}>
                    {act.type === 'upload' ? '↑ Uploaded'
                      : act.type === 'create' ? '✎ Created'
                      : '⬆ Shared'}
                  </Text>
                </View>
                {act.time ? (
                  <View style={styles.activityTime}>
                    <Text style={styles.activityTimeText}>{act.barangay}</Text>
                    <Text style={styles.activityDateText}>{act.date} • {act.time}</Text>
                  </View>
                ) : null}
              </View>
            ))}
          </View>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

// ─── STYLES ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#133E75' },
  layout: { flex: 1, flexDirection: 'row' },

  sidebar: {
    width: 250, backgroundColor: '#133E75',
    alignItems: 'center', paddingTop: 20, paddingBottom: 24, paddingHorizontal: 10,
    zIndex: 10,
  },
  sidebarOverlay: {
    position: 'absolute',
    left: 0, top: 0, bottom: 0, right: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    zIndex: 5,
  },
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
  sidebarSpacer: { height: 28 },
  logoutBtn: {
    width: '100%',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 24,
    marginTop: 8,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: COLORS.white,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  logoutText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#ffffff',
    letterSpacing: 0.3,
  },
  navItem: {
    width: '100%',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 24,
    marginBottom: 8,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: COLORS.white,
    backgroundColor: '#133E75',
  },
  navItemActive: {
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: '#000000',
  },
  navLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#ffffff',
    letterSpacing: 0.3,
  },
  navLabelActive: {
    color: '#000000',
    fontWeight: '800',
  },

  main: { flex: 1, backgroundColor: COLORS.offWhite, borderTopLeftRadius: 20 },
  mainMobile: { borderTopLeftRadius: 0 },
  mainContent: { padding: 20 },

  // Mobile Header
  mobileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightGray,
  },
  menuBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.cardBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuIconContainer: { width: 20, height: 16, justifyContent: 'space-between' },
  menuLine: { width: 20, height: 2, backgroundColor: COLORS.maroon, borderRadius: 1 },
  mobileTitle: { fontSize: 18, fontWeight: '800', color: COLORS.darkText },

  header: {
    flexDirection: 'row', alignItems: 'flex-start',
    justifyContent: 'space-between', marginBottom: 16,
  },
  headerSub: {
    fontSize: 10, fontWeight: '600', color: COLORS.subText,
    letterSpacing: 2, marginBottom: 2, textTransform: 'uppercase',
  },
  headerTitle: { fontSize: 20, fontWeight: '900', color: COLORS.darkText, letterSpacing: 0.5 },
  bellWrapper: { width: 20, height: 22, alignItems: 'center' },
  bellBody: { width: 14, height: 12, borderRadius: 7, borderWidth: 2, borderColor: COLORS.maroon, marginTop: 4 },
  bellBottom: { width: 8, height: 4, borderBottomLeftRadius: 4, borderBottomRightRadius: 4, backgroundColor: COLORS.maroon, marginTop: -1 },
  bellDot: { position: 'absolute', top: 0, right: 1, width: 7, height: 7, borderRadius: 4, backgroundColor: COLORS.gold, borderWidth: 1.5, borderColor: COLORS.cardBg },
  notifBadge: { position: 'absolute', top: -2, right: -2, width: 16, height: 16, borderRadius: 8, backgroundColor: COLORS.gold, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: COLORS.white },
  notifBadgeText: { fontSize: 8, fontWeight: '900', color: COLORS.maroon },

  // Stat Cards
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 8 },
  statsColumn: { flexDirection: 'column', gap: 10, marginBottom: 8 },
  statCard: {
    flex: 1, backgroundColor: '#133E75',
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15, shadowRadius: 6, elevation: 4,
  },
  statLabel: { fontSize: 11, fontWeight: '600', color: 'rgba(255,255,255,0.75)', marginBottom: 4 },
  statValue: { fontSize: 28, fontWeight: '900', color: COLORS.white },
  todayText: {
    fontSize: 11, fontWeight: '600', color: '#133E75',
    textAlign: 'right', marginBottom: 14,
  },

  searchBar: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.cardBg,
    borderRadius: 14, paddingHorizontal: isMobile ? 10 : 14, paddingVertical: 10, marginBottom: 20,
    borderWidth: 1.5, borderColor: COLORS.maroon + '33',
    shadowColor: 'rgba(0,0,0,0.08)', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1, shadowRadius: 6, elevation: 2,
  },
  searchIcon: { width: 18, height: 18, marginRight: 10, justifyContent: 'center', alignItems: 'center' },
  searchCircle: {
    width: 11, height: 11, borderRadius: 6,
    borderWidth: 2, borderColor: COLORS.midGray,
    position: 'absolute', top: 0, left: 0,
  },
  searchHandle: {
    width: 2, height: 6, backgroundColor: COLORS.midGray,
    borderRadius: 1, position: 'absolute', bottom: 0, right: 1,
    transform: [{ rotate: '-45deg' }],
  },
  searchInput: { flex: 1, fontSize: 14, color: COLORS.darkText, padding: 0 },

  // Cards
  card: {
    backgroundColor: COLORS.cardBg, borderRadius: 18, marginBottom: 18,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08, shadowRadius: 12, elevation: 4, overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: COLORS.lightGray, gap: 8,
  },
  cardHeaderAccent: { width: 4, height: 18, borderRadius: 2, backgroundColor: COLORS.maroon },
  cardTitle: { fontSize: 15, fontWeight: '800', color: COLORS.darkText, flex: 1, letterSpacing: 0.2 },
  taskBadge: { backgroundColor: COLORS.maroon, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  taskBadgeText: { fontSize: 11, fontWeight: '700', color: COLORS.white },

  // Table
  tableHead: {
    flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 8,
    backgroundColor: COLORS.maroon + '10',
    borderBottomWidth: 1, borderBottomColor: COLORS.lightGray,
  },
  tableHeadCell: {
    fontSize: 11, fontWeight: '700', color: COLORS.maroon,
    letterSpacing: 0.8, textTransform: 'uppercase', width: 100, textAlign: 'center',
  },
  tableRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: COLORS.lightGray,
  },
  tableRowAlt: { backgroundColor: COLORS.offWhite },
  taskDescRow: { flex: 1, flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingRight: 8 },
  urgentDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: COLORS.maroon, marginTop: 5 },
  taskDesc: { flex: 1, fontSize: 13, color: COLORS.darkText, lineHeight: 19 },
  reminderBtn: { width: isMobile ? 90 : 100, paddingVertical: 7, borderRadius: 20, alignItems: 'center', backgroundColor: COLORS.maroon },
  actionBtnText: { fontSize: 11, fontWeight: '700', color: COLORS.white, letterSpacing: 0.3 },

  // Sort
  sortRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  sortLabel: { fontSize: 11, color: COLORS.subText, fontWeight: '500' },
  sortBtn: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  sortBtnActive: { backgroundColor: COLORS.teal + '20' },
  sortBtnText: { fontSize: 11, fontWeight: '600', color: COLORS.midGray },
  sortBtnTextActive: { color: COLORS.teal },

  // Activity
  activityRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, gap: 12 },
  activityRowBorder: { borderBottomWidth: 1, borderBottomColor: COLORS.lightGray },
  activityDot: { width: 10, height: 10, borderRadius: 5 },
  activityInfo: { flex: 1 },
  activityLabel: { fontSize: 13, fontWeight: '600', color: COLORS.darkText, lineHeight: 18 },
  activityMeta: { fontSize: 11, color: COLORS.subText, marginTop: 2 },
  activityTime: { alignItems: 'flex-end' },
  activityTimeText: { fontSize: 12, fontWeight: '700', color: '#133E75' },
  activityDateText: { fontSize: 11, color: '#133E75', marginTop: 1 },
});