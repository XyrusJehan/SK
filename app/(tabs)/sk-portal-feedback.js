import React, { useState } from 'react';
import {
  View, Text, TextInput, ScrollView, TouchableOpacity,
  StyleSheet, SafeAreaView, StatusBar, Dimensions,
  Modal, Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useNav } from './navContext';
import { useAuth } from './authContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const isMobile = SCREEN_WIDTH < 768;

// ─── COLORS ───────────────────────────────────────────────────────────────────
const COLORS = {
  navy:      '#133E75',
  navyLight: '#1E4D8C',
  gold:      '#E8C547',
  white:     '#FFFFFF',
  offWhite:  '#F7F5F2',
  lightGray: '#ECECEC',
  midGray:   '#B0B0B0',
  darkText:  '#1A1A1A',
  subText:   '#666666',
  cardBg:    '#FFFFFF',
};

// ─── NAV & PORTAL TABS ───────────────────────────────────────────────────────
const NAV_TABS    = ['Dashboard', 'Documents', 'Planning', 'Portal'];
const PORTAL_TABS = ['Published', 'Feedback'];
const YEAR_FILTERS = ['All Years', '2026', '2025', '2024'];
const FEEDBACK_FILTERS = ['All', 'Recent', 'Unread'];

// ─── FEEDBACK DATA ────────────────────────────────────────────────────────────
const FEEDBACK_DATA = [
  {
    id: 'f1',
    name: 'Patrick Dela Rosa',
    document: 'Annual Barangay Youth Investment Program',
    comment: 'Concerns about the over budget for sports instead of  education being priority',
    date: 'April 22, 2026',
    status: 'Unread',
    reply: '',
  },
  {
    id: 'f2',
    name: 'Harvey Daella',
    document: 'Annual Barangay Youth Investment Program',
    comment: 'Concerns about the over budget for sports instead of  education being priority',
    date: 'April 20, 2026',
    status: 'Read',
    reply: '',
  },
  {
    id: 'f3',
    name: 'Maria Santos',
    document: 'Approved Annual Budget 2026',
    comment: 'Can we see the breakdown for barangay health programs?',
    date: 'April 18, 2026',
    status: 'Unread',
    reply: '',
  },
  {
    id: 'f4',
    name: 'Jose Reyes',
    document: 'Comprehensive Barangay Youth Development Plan (CBYDP) 2026',
    comment: 'The CBYDP looks comprehensive. When is the implementation date?',
    date: 'April 15, 2026',
    status: 'Read',
    reply: 'Implementation starts June 2026. Thank you for your interest!',
  },
];

// ─── ICONS ───────────────────────────────────────────────────────────────────
const BellIcon = ({ hasNotif }) => (
  <View style={styles.bellWrapper}>
    <View style={styles.bellBody} />
    <View style={styles.bellBottom} />
    {hasNotif && <View style={styles.bellDot} />}
  </View>
);

const MenuIcon = () => (
  <View style={styles.menuIconContainer}>
    {[0, 1, 2].map(i => <View key={i} style={styles.menuLine} />)}
  </View>
);

// ─── FEEDBACK CARD ────────────────────────────────────────────────────────────
const FeedbackCard = ({ item, onViewReply }) => (
  <View style={styles.feedbackCard}>
    {/* Commented by */}
    <Text style={styles.feedbackCommentedBy}>
      Commented by <Text style={styles.feedbackAuthorName}>{item.name}</Text>
    </Text>

    {/* On Document */}
    <Text style={styles.feedbackOnDocument}>
      On Document:{' '}
      <Text style={styles.feedbackDocumentLink}>{item.document}</Text>
    </Text>

    {/* Comment */}
    <Text style={styles.feedbackCommentLabel}>
      Comment :{' '}
      <Text style={styles.feedbackCommentText}>{item.comment}</Text>
    </Text>

    {/* Status row + View & Reply button */}
    <View style={styles.feedbackFooter}>
      <View style={styles.feedbackStatusRow}>
        <Text style={styles.feedbackStatusLabel}>Status :</Text>
        {item.status === 'Unread' && (
          <View style={styles.unreadBadge}>
            <Text style={styles.unreadBadgeText}>Unread</Text>
          </View>
        )}
        {item.status === 'Read' && item.reply ? (
          <View style={styles.repliedBadge}>
            <Text style={styles.repliedBadgeText}>Replied</Text>
          </View>
        ) : null}
      </View>
      <TouchableOpacity
        style={styles.viewReplyBtn}
        onPress={() => onViewReply(item)}
        activeOpacity={0.85}
      >
        <Text style={styles.viewReplyBtnText}>View & Reply</Text>
      </TouchableOpacity>
    </View>
  </View>
);

// ─── MAIN SCREEN ─────────────────────────────────────────────────────────────
export default function SKPortalFeedbackScreen() {
  const router = useRouter();
  const { activeTab, setActiveTab } = useNav();
  const { logout } = useAuth();

  const [feedbackFilter, setFeedbackFilter] = useState('All');
  const [yearFilter, setYearFilter]         = useState('All Years');
  const [searchText, setSearchText]         = useState('');
  const [notifCount]                        = useState(2);
  const [sidebarVisible, setSidebarVisible] = useState(false);
  const [showYearDropdown, setShowYearDropdown] = useState(false);

  // Reply modal
  const [selectedFeedback, setSelectedFeedback] = useState(null);
  const [replyText, setReplyText]               = useState('');
  const [feedbackList, setFeedbackList]         = useState(FEEDBACK_DATA);

  const handleNavPress = (tab) => {
    setActiveTab(tab);
    setSidebarVisible(false);
    if (tab === 'Dashboard') router.push('/(tabs)/sk-dashboard');
    if (tab === 'Documents') router.push('/(tabs)/sk-document');
    if (tab === 'Planning')  router.push('/(tabs)/sk-planning');
    if (tab === 'Portal')    router.push('/(tabs)/sk-portal');
  };

  const handleLogout = () => { logout(); router.replace('/'); };

  const handlePortalTab = (tab) => {
    if (tab === 'Published') router.push('/(tabs)/sk-portal');
  };

  const handleViewReply = (item) => {
    setSelectedFeedback(item);
    setReplyText(item.reply || '');
    // Mark as read
    setFeedbackList(prev => prev.map(f => f.id === item.id ? { ...f, status: 'Read' } : f));
  };

  const handleSendReply = () => {
    if (!replyText.trim()) return;
    setFeedbackList(prev => prev.map(f =>
      f.id === selectedFeedback.id ? { ...f, reply: replyText.trim(), status: 'Read' } : f
    ));
    setSelectedFeedback(null);
    setReplyText('');
  };

  // Filter logic
  const filteredFeedback = feedbackList.filter(f => {
    const matchesFilter =
      feedbackFilter === 'All' ||
      (feedbackFilter === 'Unread' && f.status === 'Unread') ||
      (feedbackFilter === 'Recent' && true); // could sort by date
    const matchesSearch =
      f.name.toLowerCase().includes(searchText.toLowerCase()) ||
      f.comment.toLowerCase().includes(searchText.toLowerCase()) ||
      f.document.toLowerCase().includes(searchText.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const unreadCount = feedbackList.filter(f => f.status === 'Unread').length;

  // ── Sidebar ──
  const renderSidebar = () => (
    <View style={styles.sidebar}>
      <View style={styles.logoPill}>
        <Image
          source={require('./../../assets/images/sk-logo.png')}
          style={styles.logoImage}
          resizeMode="contain"
        />
      </View>
      <View style={{ height: 28 }} />
      {NAV_TABS.map(tab => {
        const active = tab === 'Portal';
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

  // ── View & Reply Modal ──
  const renderReplyModal = () => (
    <Modal
      visible={!!selectedFeedback}
      transparent
      animationType="fade"
      onRequestClose={() => setSelectedFeedback(null)}
    >
      <TouchableOpacity
        style={styles.modalOverlay}
        activeOpacity={1}
        onPress={() => setSelectedFeedback(null)}
      >
        <View style={styles.modalCard} onStartShouldSetResponder={() => true}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Feedback</Text>
            <TouchableOpacity onPress={() => setSelectedFeedback(null)}>
              <Text style={styles.modalCloseX}>✕</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.modalDivider} />

          {/* Commenter */}
          <Text style={styles.modalCommentedBy}>
            Commented by <Text style={styles.modalAuthorName}>{selectedFeedback?.name}</Text>
          </Text>

          {/* Document */}
          <Text style={styles.modalOnDocument}>
            On Document:{' '}
            <Text style={styles.modalDocumentLink}>{selectedFeedback?.document}</Text>
          </Text>

          {/* Comment box */}
          <View style={styles.modalCommentBox}>
            <Text style={styles.modalCommentLabel}>Comment</Text>
            <Text style={styles.modalCommentText}>{selectedFeedback?.comment}</Text>
          </View>

          {/* Existing reply */}
          {selectedFeedback?.reply ? (
            <View style={styles.existingReplyBox}>
              <Text style={styles.existingReplyLabel}>Your Reply</Text>
              <Text style={styles.existingReplyText}>{selectedFeedback.reply}</Text>
            </View>
          ) : null}

          {/* Reply input */}
          <Text style={styles.replyInputLabel}>Write a Reply</Text>
          <TextInput
            style={styles.replyInput}
            placeholder="Type your reply here…"
            placeholderTextColor={COLORS.midGray}
            value={replyText}
            onChangeText={setReplyText}
            multiline
            numberOfLines={3}
          />

          {/* Footer */}
          <View style={styles.modalFooter}>
            <TouchableOpacity
              style={styles.modalCancelBtn}
              onPress={() => setSelectedFeedback(null)}
            >
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalSendBtn, !replyText.trim() && { opacity: 0.5 }]}
              onPress={handleSendReply}
              disabled={!replyText.trim()}
            >
              <Text style={styles.modalSendText}>Send Reply</Text>
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    </Modal>
  );

  // ── Main Content ──
  const renderContent = () => (
    <ScrollView
      style={[styles.main, isMobile && styles.mainMobile]}
      contentContainerStyle={styles.mainContent}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      {/* Mobile Header */}
      {isMobile && (
        <View style={styles.mobileHeader}>
          <TouchableOpacity style={styles.menuBtn} onPress={() => setSidebarVisible(true)}>
            <MenuIcon />
          </TouchableOpacity>
          <Text style={styles.mobileTitle}>Portal</Text>
          <TouchableOpacity style={styles.bellBtn}>
            <BellIcon hasNotif={notifCount > 0} />
          </TouchableOpacity>
        </View>
      )}

      {/* Desktop Header */}
      {!isMobile && (
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerSub}>SANGGUNIANG KABATAAN</Text>
            <Text style={styles.headerTitle}>BARANGAY SAN JOSE</Text>
            <Text style={styles.headerDocLabel}>Portal and Post Managemnet</Text>
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
      )}

      {/* ── PORTAL TAB BAR ── */}
      <View style={styles.portalTabBar}>
        {PORTAL_TABS.map(tab => {
          const active = tab === 'Feedback';
          return (
            <TouchableOpacity
              key={tab}
              style={[styles.portalTab, active && styles.portalTabActive]}
              onPress={() => handlePortalTab(tab)}
              activeOpacity={0.8}
            >
              <Text style={[styles.portalTabText, active && styles.portalTabTextActive]}>
                {tab}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* ── FILTER ROW: Year | Search ── */}
      <View style={styles.filterBarRow}>
        {/* Year dropdown */}
        <View style={{ position: 'relative', zIndex: 100 }}>
          <TouchableOpacity
            style={styles.filterDropdownBtn}
            onPress={() => setShowYearDropdown(v => !v)}
            activeOpacity={0.8}
          >
            <Text style={styles.filterDropdownText}>
              {yearFilter === 'All Years' ? 'Year' : yearFilter}
            </Text>
            <Text style={styles.filterDropdownCaret}>▾</Text>
          </TouchableOpacity>
          {showYearDropdown && (
            <View style={styles.filterDropdownPanel}>
              {YEAR_FILTERS.map(opt => (
                <TouchableOpacity
                  key={opt}
                  style={[styles.filterDropdownItem, yearFilter === opt && styles.filterDropdownItemActive]}
                  onPress={() => { setYearFilter(opt); setShowYearDropdown(false); }}
                >
                  <Text style={[styles.filterDropdownItemText, yearFilter === opt && { color: COLORS.navy, fontWeight: '700' }]}>
                    {opt}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* Search */}
        <View style={styles.searchBox}>
          <Text style={{ fontSize: 12, color: COLORS.midGray, marginRight: 4 }}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Search"
            placeholderTextColor={COLORS.midGray}
            value={searchText}
            onChangeText={setSearchText}
          />
          {searchText.length > 0 && (
            <TouchableOpacity onPress={() => setSearchText('')}>
              <Text style={{ color: COLORS.midGray, fontSize: 12 }}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* ── Feedback from the Portal label ── */}
      <Text style={styles.sectionLabel}>Feedback from the Portal</Text>

      {/* ── Feedback container card ── */}
      <View style={styles.feedbackContainer}>
        {/* Inner header: "Feedback" title + filter pills */}
        <View style={styles.feedbackInnerHeader}>
          <Text style={styles.feedbackInnerTitle}>
            Feedback{unreadCount > 0 ? ` (${unreadCount} unread)` : ''}
          </Text>
        </View>

        {/* All / Recent / Unread filter pills */}
        <View style={styles.feedbackFilterRow}>
          {FEEDBACK_FILTERS.map(f => (
            <TouchableOpacity
              key={f}
              onPress={() => setFeedbackFilter(f)}
              style={styles.feedbackFilterBtn}
              activeOpacity={0.75}
            >
              <Text style={[
                styles.feedbackFilterText,
                feedbackFilter === f && styles.feedbackFilterTextActive,
              ]}>
                {f}
              </Text>
              {feedbackFilter === f && <View style={styles.feedbackFilterUnderline} />}
            </TouchableOpacity>
          ))}
        </View>

        {/* Feedback cards list */}
        <View style={styles.feedbackList}>
          {filteredFeedback.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No feedback found</Text>
            </View>
          ) : (
            filteredFeedback.map((item, idx) => (
              <View key={item.id} style={idx < filteredFeedback.length - 1 ? { marginBottom: 14 } : {}}>
                <FeedbackCard item={item} onViewReply={handleViewReply} />
              </View>
            ))
          )}
        </View>
      </View>

    </ScrollView>
  );

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.navy} />

      {renderReplyModal()}

      <View style={styles.layout}>
        {isMobile && sidebarVisible && (
          <TouchableOpacity
            style={styles.sidebarOverlay}
            activeOpacity={1}
            onPress={() => setSidebarVisible(false)}
          />
        )}
        {isMobile ? sidebarVisible && renderSidebar() : renderSidebar()}
        {renderContent()}
      </View>
    </SafeAreaView>
  );
}

// ─── STYLES ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: COLORS.navy },
  layout: { flex: 1, flexDirection: 'row' },

  // ── Sidebar ──
  sidebar: {
    width: 250, backgroundColor: COLORS.navy,
    alignItems: 'center', paddingTop: 20, paddingBottom: 24,
    paddingHorizontal: 10, zIndex: 10,
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
  navItem: {
    width: '100%', paddingVertical: 12, paddingHorizontal: 12,
    borderRadius: 24, marginBottom: 8, alignItems: 'center',
    borderWidth: 1.5, borderColor: COLORS.white,
    backgroundColor: COLORS.navy,
    flexDirection: 'row', justifyContent: 'center', gap: 6,
  },
  navItemActive: { backgroundColor: COLORS.white, borderColor: COLORS.white },
  navLabel:      { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.85)', letterSpacing: 0.3 },
  navLabelActive:{ color: '#000', fontWeight: '800' },
  logoutBtn: {
    width: '100%', paddingVertical: 12, paddingHorizontal: 12, borderRadius: 24,
    marginTop: 8, alignItems: 'center', borderWidth: 1.5, borderColor: COLORS.white,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  logoutText: { fontSize: 13, fontWeight: '600', color: '#fff', letterSpacing: 0.3 },

  // ── Main ──
  main:        { flex: 1, backgroundColor: COLORS.offWhite, borderTopLeftRadius: 20 },
  mainMobile:  { borderTopLeftRadius: 0 },
  mainContent: { padding: 20, paddingBottom: 40 },

  // Mobile header
  mobileHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 16, paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: COLORS.lightGray,
  },
  menuBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: COLORS.cardBg, alignItems: 'center', justifyContent: 'center',
  },
  menuIconContainer: { width: 20, height: 16, justifyContent: 'space-between' },
  menuLine:    { width: 20, height: 2, backgroundColor: COLORS.navy, borderRadius: 1 },
  mobileTitle: { fontSize: 18, fontWeight: '800', color: COLORS.darkText },

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
    borderBottomWidth: 2, borderBottomColor: COLORS.lightGray,
    paddingBottom: 4, marginBottom: 6,
  },
  headerDocLabel: { fontSize: 14, fontWeight: '700', color: COLORS.darkText, marginTop: 4 },

  // Bell
  bellBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: COLORS.cardBg, alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08, shadowRadius: 6, elevation: 3,
  },
  bellWrapper: { width: 20, height: 22, alignItems: 'center' },
  bellBody:    { width: 14, height: 12, borderRadius: 7, borderWidth: 2, borderColor: '#8B0000', marginTop: 4 },
  bellBottom:  { width: 8, height: 4, borderBottomLeftRadius: 4, borderBottomRightRadius: 4, backgroundColor: '#8B0000', marginTop: -1 },
  bellDot:     { position: 'absolute', top: 0, right: 1, width: 7, height: 7, borderRadius: 4, backgroundColor: COLORS.gold, borderWidth: 1.5, borderColor: COLORS.cardBg },
  notifBadge:  { position: 'absolute', top: -2, right: -2, width: 16, height: 16, borderRadius: 8, backgroundColor: COLORS.gold, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: COLORS.white },
  notifBadgeText: { fontSize: 8, fontWeight: '900', color: COLORS.navy },

  // ── Portal Tab Bar ──
 portalTabBar: {
    flexDirection: 'row',
    marginBottom: 14,
    borderRadius: 4,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.30,
    shadowRadius: 3,
    elevation: 6,
  },
  portalTab: {
    flex: 1,
    paddingHorizontal: isMobile ? 8 : 40,
    paddingVertical: 10,
    backgroundColor: COLORS.navy,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
  },
  portalTabActive: {
    backgroundColor: COLORS.gold,
    borderRadius: 4,
    borderColor: COLORS.gold,
    shadowColor: COLORS.gold,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
    elevation: 3,
  },
  portalTabText: {
    fontSize: isMobile ? 10 : 13,
    fontWeight: '600',
    color: COLORS.white,
  },
  portalTabTextActive: {
    color: COLORS.darkText,
    fontWeight: '800',
  },

  // ── Filter bar ──
  filterBarRow: {
    flexDirection: 'row', alignItems: 'center',
    gap: 8, marginBottom: 12,
  },
  filterDropdownBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: COLORS.white,
    borderWidth: 1, borderColor: COLORS.lightGray,
    borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8,
    minWidth: 80,
  },
  filterDropdownText:  { fontSize: 13, color: COLORS.darkText },
  filterDropdownCaret: { fontSize: 10, color: COLORS.subText },
  filterDropdownPanel: {
    position: 'absolute', top: 42, left: 0, zIndex: 999,
    backgroundColor: COLORS.white,
    borderRadius: 10, borderWidth: 1, borderColor: COLORS.lightGray,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12, shadowRadius: 8, elevation: 20,
    minWidth: 140,
  },
  filterDropdownItem:       { paddingHorizontal: 14, paddingVertical: 10 },
  filterDropdownItemActive: { backgroundColor: COLORS.offWhite },
  filterDropdownItemText:   { fontSize: 13, color: COLORS.darkText },

  searchBox: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.white, borderRadius: 20,
    borderWidth: 1, borderColor: COLORS.lightGray,
    paddingHorizontal: 12, paddingVertical: 7,
    minWidth: 120, maxWidth: isMobile ? 160 : 220,
  },
  searchInput: { flex: 1, fontSize: 12, color: COLORS.darkText },

  // ── Section label ──
  sectionLabel: {
    fontSize: 13, fontWeight: '800', color: COLORS.navy,
    marginBottom: 12,
  },

  // ── Feedback container ──
  feedbackContainer: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    borderWidth: 1, borderColor: COLORS.lightGray,
    overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 4, elevation: 1,
    paddingBottom: 16,
  },
  feedbackInnerHeader: {
    paddingHorizontal: 18, paddingTop: 16, paddingBottom: 4,
  },
  feedbackInnerTitle: {
    fontSize: 15, fontWeight: '800', color: COLORS.darkText,
  },

  // All / Recent / Unread pills
  feedbackFilterRow: {
    flexDirection: 'row', alignItems: 'center',
    gap: 20, paddingHorizontal: 18, paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: COLORS.lightGray,
    marginBottom: 14,
  },
  feedbackFilterBtn:       { alignItems: 'center', paddingBottom: 4 },
  feedbackFilterText:      { fontSize: 13, fontWeight: '500', color: COLORS.subText },
  feedbackFilterTextActive:{ fontSize: 13, fontWeight: '800', color: COLORS.darkText },
  feedbackFilterUnderline: {
    height: 2, width: '100%', backgroundColor: COLORS.darkText,
    marginTop: 2, borderRadius: 1,
  },

  feedbackList: { paddingHorizontal: 16 },

  // ── Individual feedback card ──
  feedbackCard: {
    backgroundColor: '#F0F2F5',
    borderRadius: 10,
    borderWidth: 1, borderColor: COLORS.lightGray,
    padding: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 3, elevation: 1,
  },
  feedbackCommentedBy: {
    fontSize: 13, color: COLORS.subText, marginBottom: 4,
  },
  feedbackAuthorName: {
    fontWeight: '700', color: COLORS.darkText,
  },
  feedbackOnDocument: {
    fontSize: 12, color: COLORS.subText, marginBottom: 8,
  },
  feedbackDocumentLink: {
    color: COLORS.navy, fontWeight: '600',
  },
  feedbackCommentLabel: {
    fontSize: 13, fontWeight: '700', color: COLORS.darkText,
    marginBottom: 6, lineHeight: 20,
  },
  feedbackCommentText: {
    fontWeight: '400', color: COLORS.darkText,
  },
  feedbackFooter: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginTop: 12,
  },
  feedbackStatusRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
  },
  feedbackStatusLabel: {
    fontSize: 13, color: COLORS.subText, fontWeight: '600',
  },
  unreadBadge: {
    backgroundColor: '#FFF3CD', borderRadius: 6,
    paddingHorizontal: 8, paddingVertical: 2,
    borderWidth: 1, borderColor: '#F0D060',
  },
  unreadBadgeText: { fontSize: 11, fontWeight: '700', color: '#856404' },
  repliedBadge: {
    backgroundColor: '#E8F5E9', borderRadius: 6,
    paddingHorizontal: 8, paddingVertical: 2,
    borderWidth: 1, borderColor: '#A5D6A7',
  },
  repliedBadgeText: { fontSize: 11, fontWeight: '700', color: '#2E7D32' },

  // View & Reply button
  viewReplyBtn: {
    backgroundColor: COLORS.navy,
    borderRadius: 8,
    paddingHorizontal: 18, paddingVertical: 10,
  },
  viewReplyBtnText: {
    fontSize: 13, fontWeight: '700', color: COLORS.white,
  },

  // Empty
  emptyState: { alignItems: 'center', paddingVertical: 40 },
  emptyText:  { fontSize: 14, color: COLORS.midGray },

  // ── Reply Modal ──
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center', alignItems: 'center', padding: 24,
  },
  modalCard: {
    backgroundColor: COLORS.white, borderRadius: 16,
    padding: 24, width: '100%', maxWidth: 420,
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18, shadowRadius: 20, elevation: 12,
  },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 12,
  },
  modalTitle:    { fontSize: 16, fontWeight: '800', color: COLORS.darkText },
  modalCloseX:   { fontSize: 18, color: COLORS.subText, padding: 4 },
  modalDivider:  { height: 1, backgroundColor: COLORS.lightGray, marginBottom: 14 },
  modalCommentedBy: { fontSize: 13, color: COLORS.subText, marginBottom: 4 },
  modalAuthorName:  { fontWeight: '700', color: COLORS.darkText },
  modalOnDocument:  { fontSize: 12, color: COLORS.subText, marginBottom: 12 },
  modalDocumentLink:{ color: COLORS.navy, fontWeight: '600' },
  modalCommentBox: {
    backgroundColor: COLORS.offWhite, borderRadius: 8,
    padding: 12, marginBottom: 12,
    borderWidth: 1, borderColor: COLORS.lightGray,
  },
  modalCommentLabel: { fontSize: 11, fontWeight: '700', color: COLORS.subText, marginBottom: 4 },
  modalCommentText:  { fontSize: 13, color: COLORS.darkText, lineHeight: 18 },
  existingReplyBox: {
    backgroundColor: '#E8F5E9', borderRadius: 8,
    padding: 12, marginBottom: 12,
    borderWidth: 1, borderColor: '#A5D6A7',
  },
  existingReplyLabel: { fontSize: 11, fontWeight: '700', color: '#2E7D32', marginBottom: 4 },
  existingReplyText:  { fontSize: 13, color: COLORS.darkText, lineHeight: 18 },
  replyInputLabel: {
    fontSize: 12, fontWeight: '700', color: COLORS.subText, marginBottom: 6,
  },
  replyInput: {
    borderWidth: 1.5, borderColor: COLORS.lightGray, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 13, color: COLORS.darkText,
    backgroundColor: COLORS.white, minHeight: 80,
    textAlignVertical: 'top', marginBottom: 16,
  },
  modalFooter: {
    flexDirection: 'row', gap: 10,
  },
  modalCancelBtn: {
    flex: 1, paddingVertical: 11, borderRadius: 10,
    backgroundColor: COLORS.lightGray, alignItems: 'center',
  },
  modalCancelText: { fontSize: 13, fontWeight: '600', color: COLORS.darkText },
  modalSendBtn: {
    flex: 1, paddingVertical: 11, borderRadius: 10,
    backgroundColor: COLORS.navy, alignItems: 'center',
  },
  modalSendText: { fontSize: 13, fontWeight: '700', color: COLORS.white },
});