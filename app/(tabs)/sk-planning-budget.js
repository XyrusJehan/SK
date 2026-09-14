import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Linking,
  Modal,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text, TextInput,
  TouchableOpacity,
  View
} from 'react-native';
// SafeAreaView from core 'react-native' is a no-op on Android. Use the
// context-aware version so insets work on both platforms.
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Head from 'expo-router/head';
import { ArrowTopRightOnSquareIcon, CalendarDaysIcon, CheckIcon, ChevronDownIcon, MagnifyingGlassIcon } from 'react-native-heroicons/outline';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../utils/supabase';
import Sidebar from './../components/Sidebar';
import { useAuth } from './authContext';
import MobileHeader, { MobileHeaderSpacer } from './mobileHeader';
import { useNav } from './navContext';
import { BellIcon, NotificationModal, useNotificationCenter } from './notificationCenter';
// WebView: use react-native-webview on native, iframe on web (same pattern as sk-portal)
let WebView = null;
if (Platform.OS !== 'web') {
  WebView = require('react-native-webview').WebView;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const isMobile = SCREEN_WIDTH < 768;

// ─── COLORS ───────────────────────────────────────────────────────────────────
const COLORS = {
  navy: '#133E75',
  navyLight: '#1E4D8C',
  gold: '#E8C547',
  white: '#FFFFFF',
  offWhite: '#F7F5F2',
  lightGray: '#ECECEC',
  midGray: '#B0B0B0',
  darkText: '#1A1A1A',
  subText: '#666666',
  cardBg: '#FFFFFF',
  success: '#1B8A5A',
  successBg: '#E4F6ED',
  border: '#E5E7EB',
};

// ─── TABS ─────────────────────────────────────────────────────────────────────
const NAV_TABS = ['Dashboard', 'Documents', 'Planning', 'Portal', 'Logs', 'Account'];
const PLANNING_TABS = ['Templates', 'Budget'];

// ─── BUDGET DATA ──────────────────────────────────────────────────────────────
// (Data now fetched from Supabase based on barangay_id)
const BUDGET_DATA = [];

const EMPTY_ROWS = 4; // filler rows at bottom



// ─── MAIN SCREEN ──────────────────────────────────────────────────────────────
export default function SKPlanningBudgetScreen() {
  const router = useRouter();
  const { activeTab, setActiveTab } = useNav();
  const { logout, user } = useAuth();

  // Get user's barangay from auth context
  const barangayName = user?.barangay?.barangay_name || 'Unknown Barangay';
  const barangayId = user?.barangayId;

  const [searchText, setSearchText] = useState('');
  const [sidebarVisible, setSidebarVisible] = useState(false);
  const [budgetData, setBudgetData] = useState([]);
  const [loading, setLoading] = useState(false);

  // ── Year selector ──
  const currentYear = new Date().getFullYear();
  const [availableYears, setAvailableYears] = useState([currentYear]);
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [yearMenuVisible, setYearMenuVisible] = useState(false);
  const [yearMenuAnchor, setYearMenuAnchor] = useState({ top: 60, right: 20 });
  const yearPillRef = useRef(null);

  // ── In-app document viewer (same pattern as sk-portal) ──
  const [viewerModal, setViewerModal] = useState({ visible: false, fileUrl: null, title: '', isOwn: false });
  const [webViewLoading, setWebViewLoading] = useState(false);
  const [downloadModalVisible, setDownloadModalVisible] = useState(false);
  const [documentToDownload, setDocumentToDownload] = useState(null);

  const handleView = (item) => {
    if (!item.fileUrl) {
      Alert.alert('No File', 'This document has no file attached.');
      return;
    }
    setViewerModal({
      visible: true,
      fileUrl: item.fileUrl,
      title: item.barangay || 'Document',
      isOwn: item.barangayId === barangayId,
    });
    setWebViewLoading(true);
  };

  const handleDownload = (item) => {
    if (!item?.fileUrl) {
      Alert.alert('No File', 'This document has no file attached.');
      return;
    }
    setDocumentToDownload({ fileUrl: item.fileUrl, title: item.title || item.barangay || 'Document' });
    setDownloadModalVisible(true);
  };

  const handleDownloadConfirm = async () => {
    if (!documentToDownload?.fileUrl) {
      Alert.alert('No File', 'This document does not have an attached file.');
      return;
    }
    setDownloadModalVisible(false);
    const { fileUrl, title } = documentToDownload;
    setDocumentToDownload(null);

    if (Platform.OS === 'web') {
      try {
        const response = await fetch(fileUrl);
        const blob = await response.blob();
        const objectUrl = URL.createObjectURL(blob);
        const ext = fileUrl.split('.').pop().split('?')[0] || 'pdf';
        const safeName = (title || 'document').replace(/[^\w]/g, '_') + '.' + ext;
        const a = document.createElement('a');
        a.href = objectUrl;
        a.download = safeName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(objectUrl);
      } catch (e) {
        window.open(fileUrl, '_blank');
      }
      return;
    }

    try {
      await Linking.openURL(fileUrl);
    } catch (e) {
      Alert.alert('Download Failed', 'Could not open the file.');
    }
  };

  const openYearMenu = () => {
    if (yearPillRef.current) {
      yearPillRef.current.measureInWindow((x, y, width, height) => {
        setYearMenuAnchor({ top: y + height + 6, right: Math.max(12, SCREEN_WIDTH - (x + width)) });
        setYearMenuVisible(true);
      });
    } else {
      setYearMenuVisible(true);
    }
  };

  // ── Shared notification bell (returned/approved docs, templates, deadlines) ──
  const notif = useNotificationCenter(barangayId);
  const notifCount = notif.count;

  // Fetch the list of fiscal years available to filter by (folder_year table)
  useEffect(() => {
    const fetchYears = async () => {
      try {
        const { data, error } = await supabase
          .from('folder_year')
          .select('fiscal_year')
          .order('fiscal_year', { ascending: true });

        if (error) {
          console.error('Error fetching years:', error);
          return;
        }

        const years = (data || []).map(y => y.fiscal_year).filter(Boolean);
        if (years.length) {
          setAvailableYears(years);
          // Default to current year if present, otherwise the most recent year
          setSelectedYear(years.includes(currentYear) ? currentYear : years[years.length - 1]);
        }
      } catch (error) {
        console.error('Error:', error);
      }
    };

    fetchYears();
  }, []);

  // Fetch the APPROVED annual budget document for every barangay for the selected year.
  // "Approved Annual Budget" is document_type '5' in document_types; there's no separate
  // numeric budget table — each barangay uploads the actual budget document, and we
  // show/link to whichever one is currently marked 'approved'. Year isn't tracked in its
  // own column on `documents` (the `year` field is a term index, not a fiscal year), so we
  // filter by the calendar year of created_at instead.
  useEffect(() => {
    const fetchBudget = async () => {
      setLoading(true);
      try {
        const { data: docs, error } = await supabase
          .from('documents')
          .select('document_id, barangay_id, status, file_url, created_at, submitted_at, reviewed_at, barangays ( barangay_name )')
          .eq('document_type', '5')
          .eq('status', 'approved')
          .order('barangay_id', { ascending: true });

        if (error) {
          console.error('Error fetching approved budget documents:', error);
          setBudgetData([]);
          return;
        }

        const formattedBudget = (docs || [])
          .filter(d => {
            const ref = d.reviewed_at || d.submitted_at || d.created_at;
            return ref && new Date(ref).getFullYear() === selectedYear;
          })
          .map(d => ({
            id: d.document_id.toString(),
            barangay: d.barangays?.barangay_name || 'Unknown Barangay',
            barangayId: d.barangay_id,
            fileUrl: d.file_url,
            status: d.status,
          }));

        setBudgetData(formattedBudget);
      } catch (error) {
        console.error('Error:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchBudget();
  }, [selectedYear]);

  const handleNavPress = (tab) => {
    setActiveTab(tab);
    setSidebarVisible(false);
    if (tab === 'Dashboard') router.push('/(tabs)/sk-dashboard');
    if (tab === 'Documents') router.push('/(tabs)/sk-document');
    if (tab === 'Planning') router.push('/(tabs)/sk-planning');
    if (tab === 'Portal') router.push('/(tabs)/sk-portal');
    if (tab === 'Logs') router.push('/(tabs)/sk-logs');
    if (tab === 'Account') router.push('/(tabs)/sk-account');
  };

  const handleLogout = () => { logout(); router.replace('/'); };

  const filteredRows = budgetData.filter(r =>
    r.barangay.toLowerCase().includes(searchText.toLowerCase())
  );

  // ── Main Content ──
  const renderContent = () => (
    <View style={[styles.main, isMobile && styles.mainMobile]}>
      <MobileHeader
        title="Planning"
        onMenuPress={() => setSidebarVisible(true)}
        onBellPress={notif.open}
        bellCount={notifCount}
        BellIcon={BellIcon}
        colors={COLORS}
        hidden={isMobile && sidebarVisible}
      />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.mainContent}
        showsVerticalScrollIndicator={false}
      >
        <MobileHeaderSpacer />

        {/* Desktop Header */}
        {!isMobile && (
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={styles.headerSub}>SANGGUNIANG KABATAAN</Text>
              <Text style={styles.headerTitle}>{barangayName.toUpperCase()}</Text>
              <Text style={styles.headerDocLabel}>Template and Budget Reference Documents</Text>
            </View>
            <View style={styles.headerRight}>
              <TouchableOpacity style={styles.bellBtn} onPress={notif.open} activeOpacity={0.7}>
                <BellIcon count={notifCount} />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ── PLANNING TAB BAR (same style as MONITOR_TABS) ── */}
        <View style={styles.planningTabBar}>
          <TouchableOpacity
            style={styles.planningTab}
            onPress={() => router.push('/(tabs)/sk-planning')}
            activeOpacity={0.8}
          >
            <Text style={styles.planningTabText}>Templates</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.planningTab, styles.planningTabActive]}
            activeOpacity={0.8}
          >
            <Text style={[styles.planningTabText, styles.planningTabTextActive]}>Budget</Text>
          </TouchableOpacity>
        </View>

        {/* Search row */}
        <View style={styles.searchRow}>
          <View style={styles.searchBox}>
            <MagnifyingGlassIcon size={14} color={COLORS.midGray} strokeWidth={2} style={{ marginRight: 4 }} />
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

        {/* Section title + barangay count + year selector */}
        <View style={styles.sectionTitleRow}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 }}>
            <Text style={styles.sectionTitle}>Approved Annual Budget — All Barangays</Text>
            <View style={styles.countChip}>
              <Text style={styles.countChipText}>{filteredRows.length} Barangay{filteredRows.length === 1 ? '' : 's'}</Text>
            </View>
          </View>

          <TouchableOpacity
            ref={yearPillRef}
            style={styles.yearPill}
            activeOpacity={0.8}
            onPress={openYearMenu}
          >
            <CalendarDaysIcon size={14} color={COLORS.navy} strokeWidth={2} />
            <Text style={styles.yearPillText}>{selectedYear}</Text>
            <ChevronDownIcon size={14} color={COLORS.navy} strokeWidth={2} />
          </TouchableOpacity>
        </View>

        {/* Budget Table */}
        <View style={styles.tableContainer}>
          {/* Header */}
          <View style={styles.tableHeader}>
            <Text style={[styles.thText, styles.colBarangay]}>Barangay</Text>
            <Text style={[styles.thText, styles.colStatus]}>Status</Text>
            <Text style={[styles.thText, styles.colAction]}>Document</Text>
          </View>

          {/* Data rows */}
          {loading ? (
            <View style={styles.stateRow}>
              <Text style={styles.stateText}>Loading budget documents…</Text>
            </View>
          ) : filteredRows.length === 0 ? (
            <View style={styles.stateRow}>
              <Text style={styles.stateText}>No approved annual budget documents found for {selectedYear}.</Text>
            </View>
          ) : (
            filteredRows.map((item, idx) => (
              <View
                key={item.id}
                style={[styles.tableRow, idx % 2 !== 0 && styles.tableRowEven]}
              >
                <Text style={[styles.tdBarangay, styles.colBarangay]}>{item.barangay}</Text>

                <View style={[styles.colStatus, { alignItems: 'flex-start' }]}>
                  <View style={styles.statusChip}>
                    <CheckIcon size={11} color={COLORS.success} strokeWidth={3} />
                    <Text style={styles.statusChipText}>Approved</Text>
                  </View>
                </View>

                <View style={[styles.colAction, { alignItems: 'flex-end' }]}>
                  {item.fileUrl ? (
                    <TouchableOpacity
                      style={styles.viewDocBtn}
                      activeOpacity={0.75}
                      onPress={() => handleView(item)}
                    >
                      <Text style={styles.viewDocText}>View</Text>
                      <ArrowTopRightOnSquareIcon size={12} color={COLORS.navy} strokeWidth={2.2} />
                    </TouchableOpacity>
                  ) : (
                    <Text style={styles.readOnlyText}>—</Text>
                  )}
                </View>
              </View>
            ))
          )}

          {/* Filler empty rows */}
          {!loading && Array(Math.max(0, EMPTY_ROWS - Math.max(0, EMPTY_ROWS - filteredRows.length))).fill(null).map((_, i) => (
            <View key={`empty-${i}`} style={[styles.tableRow, styles.tableRowEmpty]} />
          ))}
        </View>
      </ScrollView>

      {/* Year selector dropdown — anchored under the pill, not a centered dialog */}
      <Modal
        visible={yearMenuVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setYearMenuVisible(false)}
      >
        <TouchableOpacity
          style={styles.yearModalOverlay}
          activeOpacity={1}
          onPress={() => setYearMenuVisible(false)}
        >
          <View
            style={[styles.yearModalCard, { position: 'absolute', top: yearMenuAnchor.top, right: yearMenuAnchor.right }]}
            onStartShouldSetResponder={() => true}
          >
            <Text style={styles.yearModalTitle}>Select Fiscal Year</Text>
            {availableYears.map((y) => (
              <TouchableOpacity
                key={y}
                style={[styles.yearOption, y === selectedYear && styles.yearOptionActive]}
                activeOpacity={0.75}
                onPress={() => { setSelectedYear(y); setYearMenuVisible(false); }}
              >
                <Text style={[styles.yearOptionText, y === selectedYear && styles.yearOptionTextActive]}>
                  {y}
                </Text>
                {y === selectedYear && <CheckIcon size={16} color={COLORS.navy} strokeWidth={3} />}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ── Document Viewer Modal (same pattern as sk-portal) ── */}
      <Modal
        visible={viewerModal.visible}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setViewerModal({ visible: false, fileUrl: null, title: '', isOwn: false })}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.navy }}>
          <View style={styles.viewerHeader}>
            <TouchableOpacity
              style={styles.viewerBackBtn}
              onPress={() => setViewerModal({ visible: false, fileUrl: null, title: '', isOwn: false })}
              activeOpacity={0.8}
            >
              <Feather name="arrow-left" size={20} color={COLORS.white} />
            </TouchableOpacity>
            <Text style={styles.viewerTitle} numberOfLines={1}>{viewerModal.title}</Text>
            {/* Download only available for the logged-in user's own barangay */}
            {viewerModal.fileUrl && viewerModal.isOwn && (
              <TouchableOpacity
                style={styles.viewerOpenBtn}
                onPress={() => {
                  const { fileUrl, title } = viewerModal;
                  setViewerModal({ visible: false, fileUrl: null, title: '', isOwn: false });
                  setDocumentToDownload({ fileUrl, title });
                  setDownloadModalVisible(true);
                }}
                activeOpacity={0.8}
              >
                <Feather name="download" size={18} color={COLORS.gold} />
              </TouchableOpacity>
            )}
          </View>

          <View style={{ flex: 1, backgroundColor: COLORS.offWhite, overflow: 'hidden' }}>
            {viewerModal.fileUrl && (
              Platform.OS === 'web' ? (
                <iframe
                  src={`https://docs.google.com/gview?embedded=true&url=${encodeURIComponent(viewerModal.fileUrl)}`}
                  style={{ flex: 1, width: '100%', height: '100%', border: 'none' }}
                  title={viewerModal.title}
                />
              ) : (
                WebView ? (
                  <View style={{ flex: 1 }}>
                    <WebView
                      source={{ uri: `https://docs.google.com/gview?embedded=true&url=${encodeURIComponent(viewerModal.fileUrl)}` }}
                      style={{ flex: 1 }}
                      onLoadStart={() => setWebViewLoading(true)}
                      onLoadEnd={() => setWebViewLoading(false)}
                      onError={() => {
                        setWebViewLoading(false);
                        Alert.alert('Load Failed', 'Could not load the document.');
                        setViewerModal({ visible: false, fileUrl: null, title: '', isOwn: false });
                      }}
                      startInLoadingState={true}
                      renderLoading={() => (
                        <View style={styles.viewerLoading}>
                          <ActivityIndicator size="large" color={COLORS.navy} />
                          <Text style={styles.viewerLoadingText}>Loading document…</Text>
                        </View>
                      )}
                    />
                    {webViewLoading && (
                      <View style={styles.viewerLoading}>
                        <ActivityIndicator size="large" color={COLORS.navy} />
                        <Text style={styles.viewerLoadingText}>Loading document…</Text>
                      </View>
                    )}
                  </View>
                ) : null
              )
            )}
          </View>
        </SafeAreaView>
      </Modal>

      {/* ── Download Confirmation Modal ── */}
      <Modal
        visible={downloadModalVisible}
        animationType="fade"
        transparent={true}
        onRequestClose={() => { setDownloadModalVisible(false); setDocumentToDownload(null); }}
      >
        <View style={styles.dlOverlay}>
          <View style={styles.dlModalCard}>
            <View style={styles.dlModalIconWrap}>
              <Feather name="download" size={28} color={COLORS.navy} />
            </View>
            <Text style={styles.dlModalTitle}>Download Document</Text>
            <Text style={styles.dlModalBody}>
              Do you want to download{' '}
              <Text style={{ fontWeight: '700', color: COLORS.navy }}>"{documentToDownload?.title}"</Text>?
            </Text>
            <View style={styles.dlModalFooter}>
              <TouchableOpacity
                style={styles.dlCancelBtn}
                onPress={() => { setDownloadModalVisible(false); setDocumentToDownload(null); }}
                activeOpacity={0.8}
              >
                <Text style={styles.dlCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.dlConfirmBtn}
                onPress={handleDownloadConfirm}
                activeOpacity={0.8}
              >
                <Text style={styles.dlConfirmText}>Download</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );

  return (
    <>
      <Head>
        <title>SK Budget Planning · SK Monitoring</title>
      </Head>
      <SafeAreaView style={styles.safe} edges={isMobile ? ['left', 'right', 'bottom'] : ['top', 'left', 'right', 'bottom']}>
        <StatusBar barStyle="light-content" backgroundColor={COLORS.navy} />

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
          <Sidebar
            activeTab={activeTab}
            onNavPress={handleNavPress}
            onLogout={handleLogout}
            isMobile={isMobile}
            sidebarVisible={sidebarVisible}
          />
          {renderContent()}
        </View>
      </SafeAreaView>
    </>
  );
}

// ─── STYLES ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.navy },
  layout: { flex: 1, flexDirection: 'row' },

  // ── Sidebar ──
  sidebarOverlay: {
    position: 'absolute', left: 0, top: 0, bottom: 0, right: 0,
    backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 15,
  },

  // ── Main ──
  main: { flex: 1, backgroundColor: COLORS.offWhite, borderTopLeftRadius: 20 },
  mainMobile: { borderTopLeftRadius: 0 },
  mainContent: { padding: 20, paddingBottom: 40 },

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

  // Bell
  bellBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: COLORS.cardBg, alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08, shadowRadius: 6, elevation: 3,
  },
  bellWrapper: { width: 22, height: 22, alignItems: 'center', justifyContent: 'center' },
  bellDot: { position: 'absolute', top: 0, right: 1, width: 7, height: 7, borderRadius: 4, backgroundColor: COLORS.gold, borderWidth: 1.5, borderColor: COLORS.cardBg },
  notifBadge: { position: 'absolute', top: -2, right: -2, width: 16, height: 16, borderRadius: 8, backgroundColor: COLORS.gold, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: COLORS.white },
  notifBadgeText: { fontSize: 8, fontWeight: '900', color: COLORS.navy },

  // ── Planning Tab Bar — identical to MONITOR_TABS ──
  planningTabBar: {
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
  planningTab: {
    flex: 1,
    paddingHorizontal: isMobile ? 8 : 40,
    paddingVertical: 10,
    backgroundColor: COLORS.navy,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
  },
  planningTabActive: {
    backgroundColor: COLORS.gold,
    borderRadius: 4,
    borderColor: COLORS.gold,
    shadowColor: COLORS.gold,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
    elevation: 3,
  },
  planningTabText: { fontSize: isMobile ? 10 : 13, fontWeight: '600', color: COLORS.white },
  planningTabTextActive: { color: COLORS.darkText, fontWeight: '800' },

  // Search row
  searchRow: {
    flexDirection: 'row', alignItems: 'center',
    marginBottom: 12,
  },
  searchBox: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.white, borderRadius: 20,
    borderWidth: 1, borderColor: COLORS.lightGray,
    paddingHorizontal: 12, paddingVertical: 7,
    minWidth: 120, maxWidth: isMobile ? 160 : 220,
  },
  searchInput: { flex: 1, fontSize: 12, color: COLORS.darkText },

  // Section title row
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    flexWrap: 'wrap',
    gap: 4,
  },
  sectionTitle: {
    fontSize: isMobile ? 12 : 14, fontWeight: '800', color: COLORS.navy,
  },
  dateReceived: {
    fontSize: isMobile ? 10 : 12, fontWeight: '600', color: COLORS.subText,
  },

  // ── Year Selector Pill (HeroUI-inspired) ──
  yearPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: COLORS.white,
    borderWidth: 1, borderColor: COLORS.border,
    borderRadius: 999,
    paddingHorizontal: 12, paddingVertical: 7,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 3, elevation: 1,
  },
  yearPillText: { fontSize: 12, fontWeight: '700', color: COLORS.navy },

  yearModalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.08)',
  },
  yearModalCard: {
    width: 200, backgroundColor: COLORS.white, borderRadius: 14,
    paddingVertical: 8, paddingHorizontal: 6,
    shadowColor: '#000', shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.16, shadowRadius: 14, elevation: 8,
    borderWidth: 1, borderColor: COLORS.border,
  },
  yearModalTitle: {
    fontSize: 11, fontWeight: '800', color: COLORS.subText,
    letterSpacing: 1, textTransform: 'uppercase',
    paddingHorizontal: 10, paddingVertical: 8,
  },
  yearOption: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 12, paddingVertical: 11,
    borderRadius: 10,
  },
  yearOptionActive: { backgroundColor: COLORS.offWhite },
  yearOptionText: { fontSize: 14, fontWeight: '600', color: COLORS.darkText },
  yearOptionTextActive: { color: COLORS.navy, fontWeight: '800' },

  // Small barangay-count chip beside the section title
  countChip: {
    backgroundColor: COLORS.gold, borderRadius: 999,
    paddingHorizontal: 9, paddingVertical: 3,
  },
  countChipText: { fontSize: isMobile ? 9 : 11, fontWeight: '800', color: COLORS.darkText },

  // Status chip (replaces Read-Only / Formulate action)
  statusChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: COLORS.successBg, borderRadius: 999,
    paddingHorizontal: 9, paddingVertical: 4,
  },
  statusChipText: { fontSize: isMobile ? 9 : 11, fontWeight: '700', color: COLORS.success },

  // Loading / empty state
  stateRow: { paddingVertical: 28, alignItems: 'center', justifyContent: 'center' },
  stateText: { fontSize: 12, fontWeight: '600', color: COLORS.subText },

  // ── Budget Table ──
  tableContainer: {
    backgroundColor: COLORS.white,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
  },

  // Table header
  tableHeader: {

    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.navy,
    paddingVertical: 11, paddingHorizontal: isMobile ? 10 : 16,
  },
  thText: {
    fontSize: isMobile ? 9 : 12, fontWeight: '800', color: COLORS.white,
  },

  // Table rows
  tableRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: isMobile ? 8 : 13, paddingHorizontal: isMobile ? 10 : 16,
    borderBottomWidth: 1, borderBottomColor: COLORS.lightGray,
    backgroundColor: COLORS.white, minHeight: isMobile ? 42 : 50,
  },
  tableRowEven: { backgroundColor: '#F5F7FA' },
  tableRowEmpty: { minHeight: isMobile ? 42 : 50 },

  // Columns
  colBarangay: { flex: 2, paddingRight: 4 },
  colStatus: { flex: 1, paddingRight: 4 },
  colAction: { width: isMobile ? 78 : 110, alignItems: 'flex-end' },

  tdBarangay: { fontSize: isMobile ? 10 : 13, color: COLORS.darkText, fontWeight: '500' },

  // View Document action button
  viewDocBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: COLORS.white, borderRadius: 999,
    borderWidth: 1, borderColor: COLORS.border,
    paddingHorizontal: 10, paddingVertical: 5,
  },
  viewDocText: { fontSize: isMobile ? 9 : 11, fontWeight: '700', color: COLORS.navy },

  readOnlyText: {
    fontSize: isMobile ? 10 : 12, color: COLORS.midGray, fontWeight: '600',
  },

  // ── Document Viewer (ported from sk-portal) ──
  viewerHeader: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.navy,
    paddingHorizontal: 12, paddingVertical: 12, gap: 10,
  },
  viewerBackBtn: {
    padding: 6, borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  viewerTitle: {
    flex: 1, fontSize: 14, fontWeight: '700', color: COLORS.white,
  },
  viewerOpenBtn: {
    padding: 6, borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  viewerLoading: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: COLORS.offWhite, gap: 12,
  },
  viewerLoadingText: { fontSize: 13, color: COLORS.subText },

  // ── Download Confirmation Modal (ported from sk-portal) ──
  dlOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center', alignItems: 'center', padding: 24,
  },
  dlModalCard: {
    backgroundColor: COLORS.white, borderRadius: 16,
    padding: 24, width: '85%', maxWidth: 340,
    alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.18, shadowRadius: 24, elevation: 16,
  },
  dlModalIconWrap: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: '#DBEAFE',
    alignItems: 'center', justifyContent: 'center', marginBottom: 14,
  },
  dlModalTitle: {
    fontSize: 17, fontWeight: '800', color: COLORS.darkText,
    marginBottom: 8, textAlign: 'center',
  },
  dlModalBody: {
    fontSize: 13, color: COLORS.subText, textAlign: 'center',
    lineHeight: 20, marginBottom: 20,
  },
  dlModalFooter: { flexDirection: 'row', gap: 10, width: '100%' },
  dlCancelBtn: {
    flex: 1, paddingVertical: 12, borderRadius: 10,
    backgroundColor: COLORS.lightGray, alignItems: 'center',
  },
  dlCancelText: { fontSize: 14, fontWeight: '600', color: COLORS.subText },
  dlConfirmBtn: {
    flex: 1, paddingVertical: 12, borderRadius: 10,
    backgroundColor: COLORS.navy, alignItems: 'center',
  },
  dlConfirmText: { fontSize: 14, fontWeight: '700', color: COLORS.white },

});