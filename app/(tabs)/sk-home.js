import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  Image,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useNav } from './navContext';

// ─── MOCK DATA ────────────────────────────────────────────────────────────────
const TASKS = [
  {
    id: '1',
    description: 'The ABYIP for 2026 should be published within this month.',
    action: 'Upload',
    urgent: true,
  },
  {
    id: '2',
    description: 'The ABYIB proposal for 2026 should be completed before January 7, 2027.',
    action: 'Create',
    urgent: false,
  },
];

const ACTIVITIES = [
  {
    id: '1',
    label: 'Uploaded Quarterly Registers of Cash in Bank',
    time: '3:00 PM',
    date: '1/02/2026',
    type: 'upload',
  },
  {
    id: '2',
    label: 'Created Comprehensive Barangay Youth Development Plan',
    time: '9:00 AM',
    date: '1/02/2026',
    type: 'create',
  },
];

// ─── ICON COMPONENTS (SVG-free, emoji-free pure RN shapes) ───────────────────
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
  <View
    style={[
      styles.activityDot,
      { backgroundColor: type === 'upload' ? COLORS.accent : COLORS.teal },
    ]}
  />
);

// ─── COLOR PALETTE ────────────────────────────────────────────────────────────
const COLORS = {
  maroon: '#8B0000',
  maroonDark: '#6B0000',
  maroonLight: '#A50000',
  gold: '#E8C547',
  accent: '#D4A017',
  white: '#FFFFFF',
  offWhite: '#F7F5F2',
  lightGray: '#ECECEC',
  midGray: '#B0B0B0',
  darkText: '#1A1A1A',
  subText: '#666666',
  teal: '#2A7B7B',
  cardBg: '#FFFFFF',
  shadow: 'rgba(0,0,0,0.08)',
};

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
export default function HomeScreen({ navigation }) {
  const router = useRouter();
  const { activeTab, setActiveTab } = useNav();
  const [searchText, setSearchText] = useState('');
  const [sortBy, setSortBy] = useState('Newest');
  const [notifCount] = useState(2);

  const handleNavPress = (tab) => {
    if (tab === 'Home') {
      router.push('/(tabs)/sk-home');
    } else if (tab === 'Documents') {
      router.push('/(tabs)/sk-document');
    }
    setActiveTab(tab);
  };

  const sortedActivities =
    sortBy === 'Name'
      ? [...ACTIVITIES].sort((a, b) => a.label.localeCompare(b.label))
      : ACTIVITIES;

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.maroon} />

      {/* ── SIDEBAR + CONTENT LAYOUT ── */}
      <View style={styles.layout}>

        {/* ── SIDEBAR ── */}
        <View style={styles.sidebar}>
          {/* Logo Pill */}
          <View style={styles.logoPill}>
            {/* SK Logo placeholder — replace with your actual <Image> */}
            <View style={styles.logoCircle}>
              <Text style={styles.logoText}>SK</Text>
            </View>
          </View>

          <View style={styles.sidebarSpacer} />

          {/* Nav Items */}
          {['Home', 'Documents'].map((tab) => {
            const active = activeTab === tab;
            return (
              <TouchableOpacity
                key={tab}
                style={[styles.navItem, active && styles.navItemActive]}
                onPress={() => handleNavPress(tab)}
                activeOpacity={0.8}
              >
                <Text style={[styles.navLabel, active && styles.navLabelActive]}>
                  {tab}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* ── MAIN CONTENT ── */}
        <ScrollView
          style={styles.main}
          contentContainerStyle={styles.mainContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.headerSub}>SANGGUNIANG KABATAAN</Text>
              <Text style={styles.headerTitle}>BARANGAY SAN JOSE</Text>
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
              <Text style={[styles.tableHeadCell, { flex: 1 }]}>Task</Text>
              <Text style={styles.tableHeadCell}>Action</Text>
            </View>

            {TASKS.map((task, idx) => (
              <View
                key={task.id}
                style={[
                  styles.tableRow,
                  idx % 2 === 0 && styles.tableRowAlt,
                ]}
              >
                <View style={styles.taskDescRow}>
                  {task.urgent && <View style={styles.urgentDot} />}
                  <Text style={styles.taskDesc}>{task.description}</Text>
                </View>
                <TouchableOpacity
                  style={[
                    styles.actionBtn,
                    task.action === 'Upload'
                      ? styles.actionBtnUpload
                      : styles.actionBtnCreate,
                  ]}
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
                    <Text
                      style={[
                        styles.sortBtnText,
                        sortBy === s && styles.sortBtnTextActive,
                      ]}
                    >
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
                    {act.type === 'upload' ? '↑ Uploaded' : '✎ Created'}
                  </Text>
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

// ─── STYLES ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#133E75',
  },
  layout: {
    flex: 1,
    flexDirection: 'row',
  },

  // ── Sidebar
  sidebar: {
    width: 250,
    backgroundColor: '#133E75',
    alignItems: 'center',
    paddingTop: 20,
    paddingBottom: 24,
    paddingHorizontal: 10,
  },
  logoPill: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  logoCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: COLORS.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: {
    fontSize: 18,
    fontWeight: '900',
    color: COLORS.maroon,
    letterSpacing: 1,
  },
  sidebarSpacer: { height: 28 },
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
    color: 'rgba(0, 0, 0, 0.7)',
  },
  navItemActive: {
    backgroundColor: '#133E75',
    borderWidth: 1.5,
    borderColor: COLORS.black,
  },
  navLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(0, 0, 0, 0.7)',
    letterSpacing: 0.3,
  },
  navLabelActive: {
    color: COLORS.white,
    fontWeight: '800',
    
  },

  // ── Main
  main: {
    flex: 1,
    backgroundColor: COLORS.offWhite,
    borderTopLeftRadius: 20,
    borderBottomLeftRadius: 0,
  },
  mainContent: {
    padding: 20,
  },

  // ── Header
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  headerSub: {
    fontSize: 10,
    fontWeight: '600',
    color: COLORS.subText,
    letterSpacing: 2,
    marginBottom: 2,
    textTransform: 'uppercase',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: COLORS.darkText,
    letterSpacing: 0.5,
  },
  bellBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.cardBg,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 6,
    elevation: 3,
  },
  bellWrapper: { width: 20, height: 22, alignItems: 'center' },
  bellBody: {
    width: 14,
    height: 12,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: COLORS.white,
    marginTop: 4,
  },
  bellBottom: {
    width: 8,
    height: 4,
    borderBottomLeftRadius: 4,
    borderBottomRightRadius: 4,
    backgroundColor: '#133E75',
    marginTop: -1,
  },
  bellDot: {
    position: 'absolute',
    top: 0,
    right: 1,
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: COLORS.gold,
    borderWidth: 1.5,
    borderColor: COLORS.cardBg,
  },
  notifBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: COLORS.gold,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: COLORS.white,
  },
  notifBadgeText: { fontSize: 8, fontWeight: '900', color: COLORS.maroon },

  // ── Search
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.cardBg,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 20,
    borderWidth: 1.5,
    borderColor: COLORS.maroon + '33',
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 6,
    elevation: 2,
  },
  searchIcon: {
    width: 18,
    height: 18,
    marginRight: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchCircle: {
    width: 11,
    height: 11,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: COLORS.midGray,
    position: 'absolute',
    top: 0,
    left: 0,
  },
  searchHandle: {
    width: 2,
    height: 6,
    backgroundColor: COLORS.midGray,
    borderRadius: 1,
    position: 'absolute',
    bottom: 0,
    right: 1,
    transform: [{ rotate: '-45deg' }],
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: COLORS.darkText,
    padding: 0,
  },

  // ── Cards
  card: {
    backgroundColor: COLORS.cardBg,
    borderRadius: 18,
    marginBottom: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightGray,
    gap: 8,
  },
  cardHeaderAccent: {
    width: 4,
    height: 18,
    borderRadius: 2,
    backgroundColor: COLORS.maroon,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.darkText,
    flex: 1,
    letterSpacing: 0.2,
  },
  taskBadge: {
    backgroundColor: COLORS.maroon,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  taskBadgeText: { fontSize: 11, fontWeight: '700', color: COLORS.white },

  // ── Table
  tableHead: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: COLORS.maroon + '10',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightGray,
  },
  tableHeadCell: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.maroon,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    width: 70,
    textAlign: 'center',
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightGray,
  },
  tableRowAlt: {
    backgroundColor: COLORS.offWhite,
  },
  taskDescRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingRight: 8,
  },
  urgentDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: COLORS.maroon,
    marginTop: 5,
  },
  taskDesc: {
    flex: 1,
    fontSize: 13,
    color: COLORS.darkText,
    lineHeight: 19,
  },
  actionBtn: {
    width: 70,
    paddingVertical: 7,
    borderRadius: 20,
    alignItems: 'center',
  },
  actionBtnUpload: {
    backgroundColor: COLORS.maroon,
  },
  actionBtnCreate: {
    backgroundColor: COLORS.teal,
  },
  actionBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.white,
    letterSpacing: 0.3,
  },

  // ── Sort
  sortRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  sortLabel: {
    fontSize: 11,
    color: COLORS.subText,
    fontWeight: '500',
  },
  sortBtn: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  sortBtnActive: {
    backgroundColor: COLORS.teal + '20',
  },
  sortBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.midGray,
  },
  sortBtnTextActive: {
    color: COLORS.teal,
  },

  // ── Activity
  activityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  activityRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightGray,
  },
  activityDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  activityInfo: {
    flex: 1,
  },
  activityLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.darkText,
    lineHeight: 18,
  },
  activityMeta: {
    fontSize: 11,
    color: COLORS.subText,
    marginTop: 2,
  },
  activityTime: {
    alignItems: 'flex-end',
  },
  activityTimeText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.maroon,
  },
  activityDateText: {
    fontSize: 11,
    color: COLORS.subText,
    marginTop: 1,
  },
});