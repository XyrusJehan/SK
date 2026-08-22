import React, { useState, useEffect } from 'react';
import Head from 'expo-router/head';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  Dimensions,
  Image,
  Alert,
  Linking,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useNav } from './navContext';
import Sidebar, { LYDO_NAV_ITEMS } from './../components/Sidebar';
import { useAuth } from './authContext';
import { fetchSavedReports, fetchArchivedReports, restoreComplianceDocument } from './reportsApi';
import { useLydoNotificationCenter, LydoNotificationModal, LydoBellIcon } from './notificationCenter';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const isMobile = SCREEN_WIDTH < 768;

// ─── COLORS (identical to lydo-document-templates) ────────────────────────────
const COLORS = {
  maroon:    '#8B0000',
  navy:      '#133E75',
  navyDark:  '#0D2E5A',
  gold:      '#E8C547',
  white:     '#FFFFFF',
  offWhite:  '#F7F5F2',
  lightGray: '#ECECEC',
  midGray:   '#B0B0B0',
  darkText:  '#1A1A1A',
  subText:   '#666666',
  cardBg:    '#FFFFFF',
  shadow:    'rgba(0,0,0,0.08)',
};

// ─── NAV / TAB CONSTANTS ──────────────────────────────────────────────────────
const DOCUMENT_TABS  = ['Barangay Folders', 'Reports', 'Templates'];

// ─── REPORT TYPE LABELS ───────────────────────────────────────────────────────
// Map compliance_documents.document_type -> human-readable label and a tag
// color for the row badge. Two values come from reportsApi.REPORT_TYPE_META.
const REPORT_TYPE_META = {
  FDP_Monitoring_Report: {
    label: 'FDP Monitoring',
    color: '#133E75',
    bg:    '#E3ECF7',
  },
  Submission_Compliance_Report: {
    label: 'Submission Compliance',
    color: '#1B5E20',
    bg:    '#E8F5E9',
  },
};

// ─── ICON COMPONENTS ──────────────────────────────────────────────────────────
const MenuIcon = () => (
  <View style={styles.menuIconContainer}>
    <View style={styles.menuLine} />
    <View style={styles.menuLine} />
    <View style={styles.menuLine} />
  </View>
);

// ─── DATE FORMATTERS ──────────────────────────────────────────────────────────
function fmtShortDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-PH', {
    timeZone: 'Asia/Manila', month: '2-digit', day: '2-digit', year: 'numeric',
  });
}
function fmtTime(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString('en-PH', {
    timeZone: 'Asia/Manila', hour: 'numeric', minute: '2-digit',
  });
}

// Fallback: react-native Alert.alert only logs on web. Use this so failure
// / "no file" messages actually reach the user in the browser.
function notify(title, message) {
  if (Platform.OS === 'web') {
    window.alert(message ? `${title}\n\n${message}` : title);
    return;
  }
  Alert.alert(title, message);
}

// ─── REPORT ROW (active list) ──────────────────────────────────────────────
const ReportRow = ({ item, onPress }) => {
  const meta = REPORT_TYPE_META[item.document_type] || {
    label: item.document_type || 'Report',
    color: COLORS.navy,
    bg: '#E3ECF7',
  };
  return (
    <TouchableOpacity
      style={styles.reportRow}
      onPress={() => onPress && onPress(item)}
      activeOpacity={0.7}
    >
      <View style={styles.reportNameWrap}>
        <View style={[styles.reportBadge, { backgroundColor: meta.bg }]}>
          <Text style={[styles.reportBadgeText, { color: meta.color }]}>{meta.label}</Text>
        </View>
        <Text style={styles.reportName} numberOfLines={1}>{item.title}</Text>
        {item.barangay_name ? (
          <Text style={styles.reportSubtext}>{item.barangay_name}</Text>
        ) : null}
      </View>
      <View style={styles.reportDateCell}>
        <Text style={styles.reportTime}>{fmtTime(item.upload_date)}</Text>
        <Text style={styles.reportDate}>  {fmtShortDate(item.upload_date)}</Text>
      </View>
    </TouchableOpacity>
  );
};

// ─── MAIN SCREEN ──────────────────────────────────────────────────────────────
export default function LYDODocumentReportsScreen() {
  const router = useRouter();
  const { activeTab, setActiveTab } = useNav();
  const { logout } = useAuth();

  const [searchText, setSearchText]         = useState('');
  const notif = useLydoNotificationCenter();
  const [sidebarVisible, setSidebarVisible] = useState(false);
  const [activeDocumentTab]                 = useState('Reports');
  const [currentTime, setCurrentTime]       = useState('');
  const [reports, setReports]               = useState([]);
  const [loading, setLoading]               = useState(false);
  const [loadError, setLoadError]           = useState(null);

  // ── Archive (superseded versions) ──
  const [showArchiveView, setShowArchiveView] = useState(false);
  const [archiveRecords, setArchiveRecords]   = useState([]);
  const [archiveLoading, setArchiveLoading]   = useState(false);
  const [archiveError, setArchiveError]       = useState(null);
  const [expandedArchiveId, setExpandedArchiveId] = useState(null);
  const [restoringId, setRestoringId]         = useState(null);

  const today = new Date().toLocaleDateString('en-PH', {
    timeZone: 'Asia/Manila', month: 'long', day: 'numeric', year: 'numeric',
  });

  useEffect(() => { setActiveTab('Documents'); }, []);

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

  // ── Live fetch of saved reports from compliance_documents ──
  // Lists FDP Monitoring and Submission Compliance report snapshots
  // generated by the Monitor > Report screen. Newest first. Only ACTIVE
  // (current) versions show here — saving a report of the same type/doc/
  // year again archives the old row instead of piling up duplicates.
  const loadReports = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const rows = await fetchSavedReports({ status: 'active' });
      setReports(rows);
    } catch (err) {
      console.error('Failed to load saved reports:', err);
      setLoadError(err.message || 'Failed to load saved reports.');
      setReports([]);
    } finally {
      setLoading(false);
    }
  };

  // ── Fetch superseded versions for the Archive view ──
  const loadArchive = async () => {
    setArchiveLoading(true);
    setArchiveError(null);
    try {
      const rows = await fetchArchivedReports({});
      setArchiveRecords(rows);
    } catch (err) {
      console.error('Failed to load archived reports:', err);
      setArchiveError(err.message || 'Failed to load archived reports.');
      setArchiveRecords([]);
    } finally {
      setArchiveLoading(false);
    }
  };

  const refreshAll = () => { loadReports(); loadArchive(); };

  useEffect(() => { refreshAll(); }, []);

  // ── Restore an archived version back to active ──
  // Whatever is currently active for that same report gets archived in
  // its place (handled server-side), so there's still only one active
  // row per report at a time. Refresh both lists afterward since a
  // restore moves a row between them.
  const handleRestore = async (item) => {
    setRestoringId(item.compliance_id);
    try {
      await restoreComplianceDocument(item.compliance_id);
      notify('Restored', `"${item.title}" is now the active version.`);
      setExpandedArchiveId(null);
      refreshAll();
    } catch (err) {
      console.error('Failed to restore report:', err);
      notify('Restore Failed', err.message || 'Could not restore this report. Please try again.');
    } finally {
      setRestoringId(null);
    }
  };

  // ── Filtered reports (search applies to whichever view is showing) ──
  const matchesSearch = (r) =>
    (r.title || '').toLowerCase().includes(searchText.toLowerCase()) ||
    (r.document_type || '').toLowerCase().includes(searchText.toLowerCase()) ||
    (r.barangay_name || '').toLowerCase().includes(searchText.toLowerCase());

  const filteredReports = reports.filter(matchesSearch);
  const filteredArchive = archiveRecords.filter(matchesSearch);

  // ── Open / download the saved PDF ──
  // The scanned_file_url is a public URL in the 'documents' bucket. On web
  // we open it in a new tab; on native, Linking hands the URL off to the
  // device's default PDF viewer / browser.
  const handleReportPress = async (item) => {
    const url = item.scanned_file_url;
    if (!url) {
      notify('File Unavailable', 'This report does not have a file URL.');
      return;
    }
    try {
      const supported = await Linking.canOpenURL(url);
      if (!supported) {
        notify('Cannot Open', 'No app is available to open this file.');
        return;
      }
      await Linking.openURL(url);
    } catch (err) {
      console.error('Failed to open report URL:', err);
      notify('Open Failed', err.message || 'Could not open the report.');
    }
  };

  // ── Navigation ──
  const handleNav = (tab) => {
    setActiveTab(tab);
    setSidebarVisible(false);
    if (tab === 'Dashboard') router.push('/(tabs)/lydo-dashboard');
    else if (tab === 'Documents') router.push('/(tabs)/lydo-document');
    else if (tab === 'Monitor') router.push('/(tabs)/lydo-monitor');
    else if (tab === 'Barangay') router.push('/(tabs)/lydo-accounts');
    else if (tab === 'Logs') router.push('/(tabs)/lydo-logs');
  };

  const handleLogout = () => {
    logout();
    router.replace('/');
  };

  const handleDocumentTabPress = (tab) => {
    if (tab === 'Barangay Folders') { router.push('/(tabs)/lydo-document'); return; }
    if (tab === 'Reports')           { return; /* already here */ }
    if (tab === 'Templates')         { router.push('/(tabs)/lydo-document-templates'); return; }
  };

  // ── Main Content ──
  const renderContent = () => (
    <ScrollView
      style={[styles.main, isMobile && styles.mainMobile]}
      contentContainerStyle={styles.mainContent}
      showsVerticalScrollIndicator={false}
    >
      {/* Mobile Header */}
      {isMobile && (
        <View style={styles.mobileHeader}>
          <TouchableOpacity style={styles.menuBtn} onPress={() => setSidebarVisible(true)}>
            <MenuIcon />
          </TouchableOpacity>
          <Text style={styles.mobileTitle}>Reports</Text>
              <TouchableOpacity style={styles.bellBtn} activeOpacity={0.7} onPress={notif.open}>
                <LydoBellIcon count={notif.count} />
              </TouchableOpacity>
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
              <TouchableOpacity style={styles.bellBtn} activeOpacity={0.7} onPress={notif.open}>
                <LydoBellIcon count={notif.count} />
              </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Document Tab Bar */}
      <View style={styles.documentTabBar}>
        {DOCUMENT_TABS.map(tab => {
          const active = activeDocumentTab === tab;
          return (
            <TouchableOpacity
              key={tab}
              style={[styles.documentTab, active && styles.documentTabActive]}
              onPress={() => handleDocumentTabPress(tab)}
              activeOpacity={0.8}
            >
              <Text style={[styles.documentTabText, active && styles.documentTabTextActive]}>
                {tab}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Search Row */}
      <View style={styles.searchStatsRow}>
        {/* Search box */}
        <View style={styles.searchBox}>
          <Text style={{ fontSize: 13, marginRight: 6 }}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Search"
            placeholderTextColor={COLORS.midGray}
            value={searchText}
            onChangeText={setSearchText}
          />
          {searchText.length > 0 && (
            <TouchableOpacity onPress={() => setSearchText('')}>
              <Text style={{ color: COLORS.midGray, fontSize: 13 }}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Section label + Refresh + Archive toggle (shown for both views) */}
      <View style={styles.sectionLabelRow}>
        <Text style={styles.sectionLabel}>
          {showArchiveView ? 'Archived Report Versions' : 'Saved FDP & Submission Reports'}
        </Text>
        <View style={styles.sectionLabelActions}>
          <TouchableOpacity
            style={styles.refreshBtn}
            onPress={refreshAll}
            activeOpacity={0.7}
            disabled={loading}
          >
            {loading
              ? <ActivityIndicator size="small" color={COLORS.navy} />
              : <Text style={styles.refreshBtnText}>↻ Refresh</Text>}
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.archiveBtn}
            activeOpacity={0.8}
            onPress={() => setShowArchiveView(v => !v)}
          >
            <Text style={styles.archiveBtnText}>
              🗂 {showArchiveView ? 'Hide Archive' : `View Archive${archiveRecords.length > 0 ? ` (${archiveRecords.length})` : ''}`}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {!showArchiveView ? (
        <>
          {/* Report Table */}
          <View style={styles.tableContainer}>
            {/* Table Header */}
            <View style={styles.tableHeader}>
              <Text style={[styles.tableHeaderText, { flex: 1 }]}>Report</Text>
              <Text style={[styles.tableHeaderText, { width: 160, textAlign: 'right' }]}>Created Date</Text>
            </View>

            {/* Loading / error states */}
            {loading && reports.length === 0 && (
              <View style={styles.emptyState}>
                <ActivityIndicator size="small" color={COLORS.navy} />
                <Text style={styles.emptyText}>Loading saved reports…</Text>
              </View>
            )}

            {!loading && loadError && (
              <View style={styles.emptyState}>
                <Text style={[styles.emptyText, { color: '#8B0000' }]}>
                  Couldn't load saved reports: {loadError}
                </Text>
              </View>
            )}

            {/* Rows */}
            {!loading && !loadError && filteredReports.length > 0 ? (
              filteredReports.map((item, idx) => (
                <React.Fragment key={item.compliance_id}>
                  <ReportRow item={item} onPress={handleReportPress} />
                  {idx < filteredReports.length - 1 && <View style={styles.divider} />}
                </React.Fragment>
              ))
            ) : null}

            {!loading && !loadError && filteredReports.length === 0 && (
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>
                  {reports.length === 0
                    ? 'No saved reports yet. Generate one from Monitor > Report.'
                    : 'No reports match your search.'}
                </Text>
              </View>
            )}
          </View>
        </>
      ) : (
        /* ── ARCHIVE VIEW (same pattern as Document Templates > View Archive) ── */
        <View style={styles.tableContainer}>
          {/* Archive header */}
          <View style={styles.archiveSectionHeader}>
            <Text style={styles.archiveSectionTitle}>Archives</Text>
            <View style={styles.archiveLockBadge}>
              <Text style={styles.archiveLockText}>🔒 Superseded versions • Restore to reactivate</Text>
            </View>
          </View>

          {archiveLoading && archiveRecords.length === 0 && (
            <View style={styles.emptyState}>
              <ActivityIndicator size="small" color={COLORS.navy} />
              <Text style={styles.emptyText}>Loading archived reports…</Text>
            </View>
          )}

          {!archiveLoading && archiveError && (
            <View style={styles.emptyState}>
              <Text style={[styles.emptyText, { color: '#8B0000' }]}>
                Couldn't load archived reports: {archiveError}
              </Text>
            </View>
          )}

          {!archiveLoading && !archiveError && filteredArchive.length === 0 && (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>
                {archiveRecords.length === 0
                  ? 'No archived report versions yet. Older versions show up here after you re-save a report.'
                  : 'No archived reports match your search.'}
              </Text>
            </View>
          )}

          {!archiveLoading && !archiveError && filteredArchive.map((record, idx) => {
            const meta = REPORT_TYPE_META[record.document_type] || {
              label: record.document_type || 'Report',
              color: COLORS.navy,
              bg: '#E3ECF7',
            };
            const expanded = expandedArchiveId === record.compliance_id;
            const isRestoring = restoringId === record.compliance_id;
            return (
              <View key={record.compliance_id}>
                <TouchableOpacity
                  style={styles.archiveRow}
                  onPress={() => setExpandedArchiveId(prev => (prev === record.compliance_id ? null : record.compliance_id))}
                  activeOpacity={0.75}
                >
                  <View style={styles.archiveRowMain}>
                    <Text style={styles.archiveRowName} numberOfLines={2}>{record.title}</Text>
                    <Text style={styles.archiveOldVersionText}>Superseded</Text>
                  </View>

                  {/* Expanded detail */}
                  {expanded && (
                    <View style={styles.archiveExpandedDetail}>
                      <View style={styles.archiveDetailRow}>
                        <Text style={styles.archiveDetailLabel}>Version</Text>
                        <View style={styles.archiveVersionBadge}>
                          <Text style={styles.archiveVersionText}>v{record.version}</Text>
                        </View>
                      </View>
                      <View style={styles.archiveDetailRow}>
                        <Text style={styles.archiveDetailLabel}>Type</Text>
                        <View style={[styles.reportBadge, { backgroundColor: meta.bg }]}>
                          <Text style={[styles.reportBadgeText, { color: meta.color }]}>{meta.label}</Text>
                        </View>
                      </View>
                      {record.barangay_name ? (
                        <View style={styles.archiveDetailRow}>
                          <Text style={styles.archiveDetailLabel}>Barangay</Text>
                          <Text style={styles.archiveDetailValue}>{record.barangay_name}</Text>
                        </View>
                      ) : null}
                      <View style={styles.archiveDetailRow}>
                        <Text style={styles.archiveDetailLabel}>Archived On</Text>
                        <Text style={styles.archiveDetailValue}>
                          {fmtShortDate(record.upload_date)}  {fmtTime(record.upload_date)}
                        </Text>
                      </View>
                      <View style={styles.archiveDetailRow}>
                        <Text style={styles.archiveDetailLabel}>Reason</Text>
                        <Text style={[styles.archiveDetailValue, { flex: 1, textAlign: 'right' }]}>
                          Replaced by newer version
                        </Text>
                      </View>
                      <View style={[styles.archiveDetailRow, { gap: 8, marginTop: 8 }]}>
                        <TouchableOpacity
                          style={styles.archiveActionBtn}
                          onPress={() => handleReportPress(record)}
                          activeOpacity={0.8}
                        >
                          <Text style={styles.archiveActionBtnText}>⬇ Download</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.archiveActionBtn, { backgroundColor: '#E8F5E9' }]}
                          onPress={() => handleRestore(record)}
                          activeOpacity={0.8}
                          disabled={isRestoring}
                        >
                          {isRestoring
                            ? <ActivityIndicator size="small" color="#1B5E20" />
                            : <Text style={[styles.archiveActionBtnText, { color: '#1B5E20' }]}>↩ Restore</Text>}
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}
                </TouchableOpacity>
                {idx < filteredArchive.length - 1 && <View style={styles.divider} />}
              </View>
            );
          })}
        </View>
      )}

    </ScrollView>
  );

  return (
    <>
      <Head>
        <title>LYDO Document Reports · SK Monitoring</title>
      </Head>
      <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.navy} />

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

      <View style={styles.layout}>
        {/* Mobile Sidebar Overlay */}
        {isMobile && sidebarVisible && (
          <TouchableOpacity
            style={styles.sidebarOverlay}
            activeOpacity={1}
            onPress={() => setSidebarVisible(false)}
          />
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

        {renderContent()}
      </View>
    </SafeAreaView>
    </>
  );
}

// ─── STYLES ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: '#133E75' },
  layout: { flex: 1, flexDirection: 'row' },

  sidebarOverlay: {
    position: 'absolute',
    left: 0, top: 0, bottom: 0, right: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    zIndex: 5,
  },

  // ── Main ──
  main:        { flex: 1, backgroundColor: COLORS.offWhite, borderTopLeftRadius: 20 },
  mainMobile:  { borderTopLeftRadius: 0 },
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
  menuIconContainer: { width: 20, height: 16, justifyContent: 'space-between' },
  menuLine:          { width: 20, height: 2, backgroundColor: '#133E75', borderRadius: 1 },
  mobileTitle:       { fontSize: 18, fontWeight: '800', color: COLORS.darkText },

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

  // Datetime card
  datetimeCard: {
    backgroundColor: '#F7F5F2',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#E0DDD9',
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
    backgroundColor: '#133E75',
  },
  datetimeBlock: {
    flexDirection: 'column',
  },
  datetimeLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#666666',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 1,
  },
  datetimeValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1A1A1A',
    letterSpacing: 0.2,
  },
  datetimeTime: {
    fontVariant: ['tabular-nums'],
    color: '#133E75',
    fontSize: 14,
    fontWeight: '800',
  },

  // Bell
  bellBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: COLORS.cardBg, alignItems: 'center', justifyContent: 'center',
    shadowColor: COLORS.shadow, shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1, shadowRadius: 6, elevation: 3,
  },
  notifBadge: {
    position: 'absolute', top: -2, right: -2,
    width: 16, height: 16, borderRadius: 8,
    backgroundColor: COLORS.gold, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: COLORS.white,
  },
  notifBadgeText: { fontSize: 8, fontWeight: '900', color: '#133E75' },

  // Document Tab Bar
  documentTabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1, borderBottomColor: COLORS.lightGray,
    marginBottom: 16, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.30, shadowRadius: 3, elevation: 6,
  },
  documentTab: {
    flex: 1,
    paddingHorizontal: isMobile ? 8 : 40,
    backgroundColor: COLORS.navy,
    paddingVertical: 10,
    borderBottomWidth: 0, borderBottomColor: 'transparent',
    marginBottom: -1,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
  },
  documentTabActive: {
    backgroundColor: COLORS.gold,
    borderRadius: 4,
    borderBottomColor: COLORS.gold, borderColor: COLORS.gold,
    shadowColor: COLORS.gold, shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4, shadowRadius: 4, elevation: 3,
  },
  documentTabText: {
    fontSize: isMobile ? 10 : 13, fontWeight: '600', color: COLORS.white,
  },
  documentTabTextActive: { color: COLORS.darkText, fontWeight: '800' },

  // Search + Stats Row
  searchStatsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 14,
    gap: 16,
  },
  searchBox: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.white, borderRadius: 20,
    borderWidth: 1, borderColor: COLORS.lightGray,
    paddingHorizontal: 12, paddingVertical: 8,
    width: isMobile ? '100%' : 220,
  },
  searchInput: { flex: 1, fontSize: 13, color: COLORS.darkText },

  // Archive toggle button
  archiveBtn: {
    paddingHorizontal: 14, paddingVertical: 7,
    backgroundColor: COLORS.white, borderRadius: 6,
    borderWidth: 1, borderColor: COLORS.lightGray,
  },
  archiveBtnText: { color: COLORS.subText, fontSize: 12, fontWeight: '700' },

  // Section label
  sectionLabelRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 10,
  },
  sectionLabel: {
    fontSize: 13, fontWeight: '700', color: COLORS.darkText,
  },
  sectionLabelActions: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
  },
  refreshBtn: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6,
    borderWidth: 1, borderColor: COLORS.lightGray, backgroundColor: COLORS.white,
  },
  refreshBtnText: {
    fontSize: 12, fontWeight: '700', color: COLORS.navy,
  },

  // Report row layout
  reportNameWrap: { flex: 1, paddingRight: 8 },
  reportBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8, paddingVertical: 2,
    borderRadius: 10, marginBottom: 4,
  },
  reportBadgeText: {
    fontSize: 10, fontWeight: '700', letterSpacing: 0.4, textTransform: 'uppercase',
  },
  reportSubtext: {
    fontSize: 11, color: COLORS.subText, marginTop: 2,
  },

  // Table
  tableContainer: {
    backgroundColor: COLORS.white,
    borderRadius: 10,
    borderWidth: 1, borderColor: COLORS.lightGray,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07, shadowRadius: 8, elevation: 1,
    overflow: 'hidden',
  },
  tableHeader: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 18, paddingVertical: 12,
    backgroundColor: COLORS.offWhite,
    borderBottomWidth: 1, borderBottomColor: COLORS.lightGray,
  },
  tableHeaderText: {
    fontSize: 13, fontWeight: '800', color: COLORS.darkText, letterSpacing: 0.2,
  },
  reportRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 18, paddingVertical: 15,
  },
  reportRowEmpty: {
    height: 48,
  },
  reportName: {
    flex: 1, fontSize: 13, color: COLORS.darkText,
    fontWeight: '400', lineHeight: 18,
  },
  reportDateCell: {
    width: 160, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'flex-end',
  },
  reportTime: {
    fontSize: 13, color: '#133E75', fontWeight: '500',
  },
  reportDate: {
    fontSize: 13, color: COLORS.darkText, fontWeight: '400',
  },
  divider: { height: 1, backgroundColor: COLORS.lightGray, marginHorizontal: 18 },

  // Empty state
  emptyState: { padding: 40, alignItems: 'center' },
  emptyText:  { fontSize: 14, color: COLORS.midGray },

  // ── Archive View (mirrors lydo-document-templates) ──
  archiveSectionHeader: {
    paddingHorizontal: 18, paddingTop: 16, paddingBottom: 10,
    borderBottomWidth: 1, borderBottomColor: COLORS.lightGray,
    backgroundColor: COLORS.offWhite,
    borderTopLeftRadius: 10, borderTopRightRadius: 10,
  },
  archiveSectionTitle: {
    fontSize: 15, fontWeight: '800', color: COLORS.darkText, marginBottom: 6,
  },
  archiveLockBadge: {
    backgroundColor: '#FFF8E1', borderRadius: 6, borderWidth: 1,
    borderColor: '#F9C74F', paddingHorizontal: 10, paddingVertical: 5,
    alignSelf: 'flex-start',
  },
  archiveLockText: { fontSize: 11, color: '#7A5800', fontWeight: '600' },
  archiveRow: {
    paddingHorizontal: 18, paddingVertical: 16,
  },
  archiveRowMain: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12,
  },
  archiveRowName: {
    flex: 1, fontSize: 13, color: COLORS.darkText, fontWeight: '500', lineHeight: 18,
  },
  archiveOldVersionText: {
    fontSize: 12, fontWeight: '700', color: '#B71C1C',
  },
  archiveExpandedDetail: {
    marginTop: 12, paddingTop: 12,
    borderTopWidth: 1, borderTopColor: COLORS.lightGray,
  },
  archiveDetailRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: 8,
  },
  archiveDetailLabel: { fontSize: 12, color: COLORS.subText, fontWeight: '600' },
  archiveDetailValue: { fontSize: 12, color: COLORS.darkText, fontWeight: '500' },
  archiveVersionBadge: {
    backgroundColor: '#EFEBE9', borderRadius: 6,
    paddingHorizontal: 8, paddingVertical: 3,
    borderWidth: 1, borderColor: '#BCAAA4',
  },
  archiveVersionText: { fontSize: 11, fontWeight: '800', color: '#6D4C41' },
  archiveActionBtn: {
    flex: 1, paddingVertical: 8, borderRadius: 8,
    backgroundColor: '#EEF2FB', alignItems: 'center',
  },
  archiveActionBtnText: { fontSize: 12, fontWeight: '700', color: '#5B8DD9' },
});