import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, ScrollView, TouchableOpacity,
  StyleSheet, SafeAreaView, StatusBar, Dimensions,
  Modal, Alert, Image, Platform, Linking, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';

// WebView: use react-native-webview on native, iframe on web
let WebView = null;
if (Platform.OS !== 'web') {
  WebView = require('react-native-webview').WebView;
}
import { Feather } from '@expo/vector-icons';
import { useNav } from './navContext';
import { useAuth } from './authContext';
import { supabase } from '../../utils/supabase';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const isMobile = SCREEN_WIDTH < 768;

// Supabase timestamps have no 'Z' suffix — JS mis-parses them as local time.
// toUtcDate forces correct UTC parsing before PHT display.
const toUtcDate = (dateStr) => {
  if (!dateStr) return new Date();
  const iso = String(dateStr).replace(' ', 'T').replace(/Z?$/, 'Z');
  return new Date(iso);
};

const toPhilippineDate = (dateStr, options) => {
  if (!dateStr) return '';
  return toUtcDate(dateStr).toLocaleDateString('en-PH', { timeZone: 'Asia/Manila', ...options });
};

const toPhilippineTime = (dateStr, options) => {
  if (!dateStr) return '';
  return toUtcDate(dateStr).toLocaleTimeString('en-PH', { timeZone: 'Asia/Manila', ...options });
};

// ─── COLORS (identical to sk-planning) ───────────────────────────────────────
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
const NAV_TABS    = ['Dashboard', 'Documents', 'Planning', 'Portal', 'Logs', 'Account'];
const PORTAL_TABS = ['Published', 'Feedback'];

// ─── FILTER OPTIONS ──────────────────────────────────────────────────────────
const DOCUMENT_FILTERS = [
  'All Documents',
  'Comprehensive Barangay Youth Development Plan',
  'Annual Barangay Youth Investment Program',
  'Approved Annual Budget',
  'Quarterly Register of Cash in Bank',
];

const YEAR_FILTERS = ['All Years', '2026', '2025', '2024'];

// ─── PUBLISHED DOCUMENTS ─────────────────────────────────────────────────────
// (Data now fetched from Supabase based on barangay_id)

// ─── FEEDBACK DATA ────────────────────────────────────────────────────────────
// (Data now fetched from Supabase based on barangay_id)

// ─── ICONS ────────────────────────────────────────────────────────────────────
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

// Logs: clipboard with checkmark lines
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

const UploadIcon = () => (
  <Text style={{ fontSize: 14, color: COLORS.navy }}>⬆</Text>
);

// ─── DOCUMENT CARD ────────────────────────────────────────────────────────────
const DocumentCard = ({ item, onPress }) => (
  <TouchableOpacity
    style={styles.docCard}
    onPress={() => onPress && onPress(item)}
    activeOpacity={0.75}
  >
    <Text style={styles.docCardTitle} numberOfLines={2}>{item.title}</Text>
  </TouchableOpacity>
);

// ─── FEEDBACK ROW ─────────────────────────────────────────────────────────────
const FeedbackRow = ({ item, idx }) => (
  <View style={[styles.feedbackRow, idx % 2 !== 0 && { backgroundColor: '#FAFAFA' }]}>
    <View style={styles.feedbackLeft}>
      <View style={styles.feedbackAvatar}>
        <Text style={styles.feedbackAvatarText}>{item.name.charAt(0)}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <View style={styles.feedbackNameRow}>
          <Text style={styles.feedbackName}>{item.name}</Text>
          {item.status === 'New' && (
            <View style={styles.feedbackNewBadge}>
              <Text style={styles.feedbackNewBadgeText}>New</Text>
            </View>
          )}
        </View>
        <Text style={styles.feedbackComment} numberOfLines={2}>{item.comment}</Text>
        <Text style={styles.feedbackDate}>{item.date}</Text>
      </View>
    </View>
  </View>
);

// ─── MAIN SCREEN ──────────────────────────────────────────────────────────────
export default function SKPortalScreen() {
  const router = useRouter();
  const { activeTab, setActiveTab } = useNav();
  const { logout, user } = useAuth();

  // Get user's barangay from auth context
  const barangayName = user?.barangay?.barangay_name || 'Unknown Barangay';
  const barangayId = user?.barangayId;

  // Helper function to log SK activity
  const logActivity = async (action, description) => {
    try {
      await supabase.from('sk_activity_logs').insert({
        action,
        description,
        user_id: user?.userId || null,
      });
    } catch (err) {
      console.error('Failed to log activity:', err);
    }
  };

  const [activePortalTab, setActivePortalTab] = useState('Published');
  const [docFilter, setDocFilter]             = useState('All Documents');
  const [yearFilter, setYearFilter]           = useState('All Years');
  const [searchText, setSearchText]           = useState('');
  const [notifCount]                          = useState(2);
  const [sidebarVisible, setSidebarVisible]   = useState(false);
  const [selectedDoc, setSelectedDoc]         = useState(null);
  const [showDocModal, setShowDocModal]       = useState(false);
  const [showDocDropdown, setShowDocDropdown] = useState(false);
  const [showYearDropdown, setShowYearDropdown] = useState(false);
  const [showUploadModal, setShowUploadModal]   = useState(false);
  const [uploadFile, setUploadFile]             = useState(null);
  const [uploadTitle, setUploadTitle]           = useState('');
  const [uploadCategory, setUploadCategory]     = useState('');
  const [uploadYear, setUploadYear]             = useState('');
  const [showUploadCatDropdown, setShowUploadCatDropdown] = useState(false);
  const [showUploadDocTypeDropdown, setShowUploadDocTypeDropdown] = useState(false);
  const [uploadDocType, setUploadDocType] = useState(null);
  const [showUploadYearDropdown, setShowUploadYearDropdown] = useState(false);
  const [publishedDocs, setPublishedDocs] = useState([]);
  const [feedbackItems, setFeedbackItems] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [alertModal, setAlertModal] = useState({ visible: false, type: 'publish', docTitle: '', onConfirm: null });
  const [successModal, setSuccessModal] = useState({ visible: false, type: 'publish', docTitle: '' });
  const [viewerModal, setViewerModal] = useState({ visible: false, fileUrl: null, title: '' });
  const [webViewLoading, setWebViewLoading] = useState(false);
  const [downloadModalVisible, setDownloadModalVisible] = useState(false);
  const [documentToDownload, setDocumentToDownload] = useState(null);

  const openAlert = (type, docTitle, onConfirm) =>
    setAlertModal({ visible: true, type, docTitle, onConfirm });
  const closeAlert = () =>
    setAlertModal(prev => ({ ...prev, visible: false, onConfirm: null }));
  const openSuccess = (type, docTitle) =>
    setSuccessModal({ visible: true, type, docTitle });
  const closeSuccess = () =>
    setSuccessModal(prev => ({ ...prev, visible: false }));

  // Refs + layout state for dropdown anchoring (float above everything via Modal)
  const docFilterRef  = useRef(null);
  const yearFilterRef = useRef(null);
  const uploadCatRef     = useRef(null);
  const uploadDocTypeRef = useRef(null);
  const uploadYearRef    = useRef(null);
  const [docDropdownPos,           setDocDropdownPos]           = useState(null);
  const [yearDropdownPos,          setYearDropdownPos]          = useState(null);
  const [uploadCatDropdownPos,     setUploadCatDropdownPos]     = useState(null);
  const [uploadDocTypeDropdownPos, setUploadDocTypeDropdownPos] = useState(null);
  const [uploadYearDropdownPos,    setUploadYearDropdownPos]    = useState(null);

  const measureAndOpen = (ref, setPos, setVisible) => {
    if (ref.current) {
      ref.current.measureInWindow((x, y, width, height) => {
        setPos({ x, y: y + height + 2, width });
        setVisible(true);
      });
    }
  };

  // Fetch published documents for this barangay
  useEffect(() => {
    const fetchPublishedDocs = async () => {
      if (!barangayId) return;

      try {
        const { data: docs, error } = await supabase
          .from('website_posts')
          .select('*')
          .eq('barangay_id', barangayId)
          .eq('portal_status', 'published')
          .order('published_at', { ascending: false });

        if (error) {
          console.error('Error fetching published docs:', error);
          return;
        }

        const formattedDocs = docs?.map(doc => ({
          id: doc.website_post_id,
          title: doc.title || 'Untitled',
          category: doc.document_category || 'Unknown',
          year: doc.year?.toString() || toUtcDate(doc.published_at).toLocaleDateString('en-PH', { timeZone: 'Asia/Manila', year: 'numeric' }),
          uploadedAt: toPhilippineDate(doc.published_at, { month: 'long', day: 'numeric', year: 'numeric' }),
          fileUrl: doc.file_url,
        })) || [];

        setPublishedDocs(formattedDocs);
      } catch (error) {
        console.error('Error:', error);
      }
    };

    fetchPublishedDocs();
  }, [barangayId]);

  // Fetch feedback for this barangay's posts
  useEffect(() => {
    const fetchFeedback = async () => {
      if (!barangayId) return;

      try {
        // First get website posts for this barangay
        const { data: posts } = await supabase
          .from('website_posts')
          .select('website_post_id')
          .eq('barangay_id', barangayId);

        if (!posts || posts.length === 0) return;

        const postIds = posts.map(p => p.website_post_id);

        // Then get comments for these posts
        const { data: comments, error } = await supabase
          .from('resident_comments')
          .select(`
            comment_id,
            content,
            created_at,
            is_read,
            resident_id,
            users (
              first_name,
              last_name
            )
          `)
          .in('website_post_id', postIds)
          .order('created_at', { ascending: false });

        if (error) {
          console.error('Error fetching feedback:', error);
          return;
        }

        const formattedFeedback = comments?.map(c => ({
          id: c.comment_id,
          name: `${c.users?.first_name || 'Unknown'} ${c.users?.last_name || 'User'}`,
          comment: c.content,
          date: toPhilippineDate(c.created_at, { month: 'long', day: 'numeric', year: 'numeric' }),
          status: c.is_read ? 'Read' : 'New',
        })) || [];

        setFeedbackItems(formattedFeedback);
      } catch (error) {
        console.error('Error:', error);
      }
    };

    fetchFeedback();
  }, [barangayId]);

  const handleNavPress = (tab) => {
    setActiveTab(tab);
    setSidebarVisible(false);
    if (tab === 'Dashboard') router.push('/(tabs)/sk-dashboard');
    if (tab === 'Documents') router.push('/(tabs)/sk-document');
    if (tab === 'Planning')  router.push('/(tabs)/sk-planning');
      if (tab === 'Portal')    router.push('/(tabs)/sk-portal');
      if (tab === 'Logs')      router.push('/(tabs)/sk-logs');
    if (tab === 'Account')   router.push('/(tabs)/sk-account');
  };

  const handleLogout = () => { logout(); router.replace('/'); };

  const handleDocPress = (doc) => { setSelectedDoc(doc); setShowDocModal(true); };

  // Filter published docs - use fetched data if available, fallback to mock data
  const activeDocs = publishedDocs;
  const filteredDocs = activeDocs.filter(d => {
    const matchesDoc  = docFilter === 'All Documents' || d.title.includes(docFilter.replace(' 2026','').trim());
    const matchesYear = yearFilter === 'All Years' || d.year === yearFilter;
    const matchesSearch = d.title.toLowerCase().includes(searchText.toLowerCase());
    return matchesDoc && matchesYear && matchesSearch;
  });

  // ── Sidebar ──
  const NAV_ITEMS = [
    { tab: 'Dashboard', IconComponent: DashboardIcon },
    { tab: 'Documents', IconComponent: DocumentsIcon },
    { tab: 'Planning',  IconComponent: PlanningIcon  },
    { tab: 'Portal',    IconComponent: PortalIcon    },
    { tab: 'Logs',      IconComponent: LogsIcon      },
    { tab: 'Account',   IconComponent: AccountIcon   },
  ];

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
      {NAV_ITEMS.map(({ tab, IconComponent }) => {
        const active = activeTab === tab;
        const iconColor = active ? '#133E75' : 'rgba(255,255,255,0.85)';
        return (
          <TouchableOpacity
            key={tab}
            style={[styles.navItem, active && styles.navItemActive]}
            onPress={() => tab === 'Portal' ? setActiveTab('Portal') : handleNavPress(tab)}
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

  // -- View handler: opens full-screen Google Docs viewer modal --
  const handleView = (fileUrl, title) => {
    if (!fileUrl) {
      Alert.alert('No File', 'This document has no file attached.');
      return;
    }
    setViewerModal({ visible: true, fileUrl, title: title || 'Document' });
    setWebViewLoading(true);
  };

  // -- Download handler: shows confirmation modal then opens URL --
  const handleDownload = (fileUrl, title) => {
    if (!fileUrl) {
      Alert.alert('No File', 'This document has no file attached.');
      return;
    }
    setDocumentToDownload({ fileUrl, title: title || 'Document' });
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

  // -- Unpublish handler --
  const handleUnpublish = () => {
    // Snapshot values now - selectedDoc may be cleared before the async callback runs
    const docId = selectedDoc?.id;
    const docTitle = selectedDoc?.title || 'Document';
    if (!docId) return;

    const doUnpublish = async () => {
      const { error } = await supabase
        .from('website_posts')
        .update({ portal_status: 'unpublished', unpublished_at: new Date().toISOString() })
        .eq('website_post_id', docId);
      if (error) { Alert.alert('Error', error.message); return; }
      await logActivity('Unpublish document', `Unpublished "${docTitle}" from the transparency portal`);
      setPublishedDocs(prev => prev.filter(d => d.id !== docId));
      setShowDocModal(false);
      openSuccess('unpublish', docTitle);
    };

    openAlert('unpublish', docTitle, () => { closeAlert(); doUnpublish(); });
  };

  // ── Doc Detail Modal ──
  const renderDocModal = () => (
    <Modal
      visible={showDocModal}
      transparent
      animationType="fade"
      onRequestClose={() => setShowDocModal(false)}
    >
      <TouchableOpacity
        style={styles.modalOverlay}
        activeOpacity={1}
        onPress={() => setShowDocModal(false)}
      >
        <View style={styles.modalCard} onStartShouldSetResponder={() => true}>
          <Text style={styles.modalTitle}>Document</Text>
          <Text style={styles.modalSubtitle} numberOfLines={3}>{selectedDoc?.title}</Text>
          <View style={styles.modalDivider} />
          <View style={styles.modalMeta}>
            <Text style={styles.modalMetaLabel}>Category</Text>
            <Text style={styles.modalMetaValue}>{selectedDoc?.category}</Text>
          </View>
          <View style={styles.modalMeta}>
            <Text style={styles.modalMetaLabel}>Uploaded</Text>
            <Text style={styles.modalMetaValue}>{selectedDoc?.uploadedAt}</Text>
          </View>
          <View style={styles.modalDivider} />
          <View style={styles.modalActions}>
            <TouchableOpacity
              style={[styles.modalActionBtn, { backgroundColor: '#EAF0FB' }]}
              onPress={() => handleView(selectedDoc?.fileUrl, selectedDoc?.title)}
            >
              <Text style={[styles.modalActionText, { color: COLORS.navy }]}>👁  View</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalActionBtn, { backgroundColor: '#EAFBEA' }]}
              onPress={() => handleDownload(selectedDoc?.fileUrl, selectedDoc?.title)}
            >
              <Text style={[styles.modalActionText, { color: '#2E7D32' }]}>⬇  Download</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalActionBtn, { backgroundColor: '#FFEBEE' }]}
              onPress={handleUnpublish}
            >
              <Text style={[styles.modalActionText, { color: '#B71C1C' }]}>✕  Unpublish</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setShowDocModal(false)}>
            <Text style={styles.modalCloseBtnText}>Close</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );

  // ── Upload Modal ──
  const UPLOAD_FOLDER_CATEGORIES = ['Planning', 'Financial', 'Governance', 'Performance'];

  const CATEGORY_DOC_TYPES = {
    Planning: [
      { label: 'ABYIP',             value: 'Annual Barangay Youth Investment Program (ABYIP)' },
      { label: 'CBYDP',             value: 'Comprehensive Barangay Youth Development Plan (CBYDP)' },
      { label: 'Work Plans',        value: 'Work Plans' },
      { label: 'Project Proposals', value: 'Project Proposals' },
    ],
    Financial: [
      { label: 'Monthly Itemized List',     value: 'Monthly Itemized List' },
      { label: 'Quarterly Register of Bank', value: 'Quarterly Register of Bank' },
      { label: 'Annual Budget',             value: 'Annual Budget' },
      { label: 'Disbursement Vouchers',     value: 'Disbursement Vouchers' },
      { label: 'Liquidation Reports',       value: 'Liquidation Reports' },
    ],
    Governance: [
      { label: 'Resolutions', value: 'Resolutions' },
      { label: 'Ordinances',  value: 'Ordinances' },
    ],
    Performance: [
      { label: 'Accomplishment Reports',  value: 'Accomplishment Reports' },
      { label: 'Activity Documentation', value: 'Activity Documentation' },
      { label: 'Event Reports',          value: 'Event Reports' },
      { label: 'Minutes of the meetings', value: 'Minutes of the meetings' },
    ],
  };

  const UPLOAD_YEARS = ['2026', '2025', '2024', '2023'];

  const pickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'application/msword',
               'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
        copyToCacheDirectory: true,
      });
      if (!result.canceled && result.assets?.length > 0) {
        setUploadFile(result.assets[0]);
      }
    } catch (e) {
      Alert.alert('Error', 'Could not open file picker');
    }
  };

  const getFileExt = (name = '') => (name.split('.').pop() || 'FILE').toUpperCase().slice(0, 4);
  const formatFileSize = (bytes) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const renderUploadModal = () => (
    <Modal
      visible={showUploadModal}
      transparent
      animationType="fade"
      onRequestClose={() => setShowUploadModal(false)}
    >
      <TouchableOpacity
        style={styles.modalOverlay}
        activeOpacity={1}
        onPress={() => { setShowUploadModal(false); setShowUploadCatDropdown(false); setShowUploadYearDropdown(false); }}
      >
        <TouchableOpacity
          style={styles.uploadModalCard}
          activeOpacity={1}
          onPress={() => {}}
        >
          {/* ── Header ── */}
          <View style={styles.uploadModalHeader}>
            <View>
              <Text style={styles.uploadModalHeaderEyebrow}>TRANSPARENCY PORTAL</Text>
              <Text style={styles.uploadModalHeaderText}>Upload New Document</Text>
            </View>
            <TouchableOpacity onPress={() => setShowUploadModal(false)} style={styles.uploadModalClose}>
              <Text style={styles.uploadModalCloseText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* ── Divider ── */}
          <View style={styles.uploadModalDivider} />

          <View style={styles.uploadModalBody}>

            {/* ── LEFT — File Selection ── */}
            <View style={styles.uploadModalLeft}>
              {/* Step badge */}
              <View style={styles.stepBadgeRow}>
                <View style={styles.stepBadge}><Text style={styles.stepBadgeText}>1</Text></View>
                <Text style={styles.stepBadgeLabel}>Choose Document</Text>
              </View>

              {uploadFile ? (
                /* ── Attached file card ── */
                <View style={styles.fileCard}>
                  {/* File type badge */}
                  <View style={styles.fileExtBadge}>
                    <Text style={styles.fileExtText}>{getFileExt(uploadFile.name)}</Text>
                  </View>
                  {/* File info */}
                  <View style={styles.fileCardInfo}>
                    <Text style={styles.fileCardName} numberOfLines={2}>{uploadFile.name}</Text>
                    {uploadFile.size ? (
                      <Text style={styles.fileCardSize}>{formatFileSize(uploadFile.size)}</Text>
                    ) : null}
                  </View>
                  {/* Remove button */}
                  <TouchableOpacity
                    style={styles.removeFileBtn}
                    onPress={() => setUploadFile(null)}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Text style={styles.removeFileBtnText}>✕</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                /* ── Drop zone ── */
                <TouchableOpacity style={styles.dropZone} activeOpacity={0.8} onPress={pickDocument}>
                  {/* Cloud upload icon */}
                  <View style={styles.dropZoneIconWrap}>
                    <View style={styles.cloudBase} />
                    <View style={styles.cloudTop} />
                    <View style={styles.cloudArrowShaft} />
                    <View style={styles.cloudArrowHead} />
                  </View>
                  <Text style={styles.dropZoneMainLabel}>Tap to browse files</Text>
                  <Text style={styles.dropZoneSubLabel}>PDF or Word document</Text>
                </TouchableOpacity>
              )}

              {/* Replace / change link shown when file is attached */}
              {uploadFile && (
                <TouchableOpacity onPress={pickDocument} style={styles.replaceFileLink}>
                  <Text style={styles.replaceFileLinkText}>↺  Replace file</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* ── Vertical separator ── */}
            <View style={styles.uploadModalSeparator} />

            {/* ── RIGHT — Details & Actions ── */}
            <View style={styles.uploadModalRight}>
              {/* Step 2 */}
              <View style={styles.stepBadgeRow}>
                <View style={styles.stepBadge}><Text style={styles.stepBadgeText}>2</Text></View>
                <Text style={styles.stepBadgeLabel}>Document Details</Text>
              </View>

              {/* Document Title */}
              <Text style={styles.uploadFieldLabel}>Document Title <Text style={{ color: '#C0392B' }}>*</Text></Text>
              <TextInput
                style={styles.uploadTextInput}
                value={uploadTitle}
                onChangeText={setUploadTitle}
                placeholder="Enter document title"
                placeholderTextColor={COLORS.midGray}
              />

              {/* Category & Document Type */}
              <View style={styles.uploadRowFields}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.uploadFieldLabel}>Category <Text style={{ color: '#C0392B' }}>*</Text></Text>
                  <TouchableOpacity
                    ref={uploadCatRef}
                    style={styles.uploadDropdownBtn}
                    onPress={() => {
                      setShowUploadDocTypeDropdown(false);
                      setShowUploadYearDropdown(false);
                      if (showUploadCatDropdown) { setShowUploadCatDropdown(false); }
                      else { measureAndOpen(uploadCatRef, setUploadCatDropdownPos, setShowUploadCatDropdown); }
                    }}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.uploadDropdownText, !uploadCategory && { color: COLORS.midGray }]} numberOfLines={1}>
                      {uploadCategory || 'Select category…'}
                    </Text>
                    <Text style={styles.uploadDropdownCaret}>▾</Text>
                  </TouchableOpacity>
                </View>

                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={styles.uploadFieldLabel}>Document Type <Text style={{ color: '#C0392B' }}>*</Text></Text>
                  <TouchableOpacity
                    ref={uploadDocTypeRef}
                    style={[styles.uploadDropdownBtn, !uploadCategory && { opacity: 0.5 }]}
                    disabled={!uploadCategory}
                    onPress={() => {
                      setShowUploadCatDropdown(false);
                      setShowUploadYearDropdown(false);
                      if (showUploadDocTypeDropdown) { setShowUploadDocTypeDropdown(false); }
                      else { measureAndOpen(uploadDocTypeRef, setUploadDocTypeDropdownPos, setShowUploadDocTypeDropdown); }
                    }}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.uploadDropdownText, !uploadDocType && { color: COLORS.midGray }]} numberOfLines={1}>
                      {uploadDocType?.label || 'Select type…'}
                    </Text>
                    <Text style={styles.uploadDropdownCaret}>▾</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Year */}
              <View style={{ marginTop: 10 }}>
                <Text style={styles.uploadFieldLabel}>Year <Text style={{ color: '#C0392B' }}>*</Text></Text>
                <TouchableOpacity
                  ref={uploadYearRef}
                  style={styles.uploadDropdownBtn}
                  onPress={() => {
                    setShowUploadCatDropdown(false);
                    setShowUploadDocTypeDropdown(false);
                    if (showUploadYearDropdown) { setShowUploadYearDropdown(false); }
                    else { measureAndOpen(uploadYearRef, setUploadYearDropdownPos, setShowUploadYearDropdown); }
                  }}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.uploadDropdownText, !uploadYear && { color: COLORS.midGray }]}>
                    {uploadYear || 'Select year…'}
                  </Text>
                  <Text style={styles.uploadDropdownCaret}>▾</Text>
                </TouchableOpacity>
              </View>

              {/* Step 3 */}
              <View style={[styles.stepBadgeRow, { marginTop: 16 }]}>
                <View style={styles.stepBadge}><Text style={styles.stepBadgeText}>3</Text></View>
                <Text style={styles.stepBadgeLabel}>Review &amp; Publish</Text>
              </View>

              <TouchableOpacity
                style={[styles.publishBtn, isUploading && { opacity: 0.6 }]}
                activeOpacity={0.85}
                disabled={isUploading}
                onPress={() => {
                  if (!uploadFile || !uploadTitle || !uploadCategory || !uploadDocType || !uploadYear) {
                    Alert.alert('Missing Info', 'Please complete all fields before publishing.');
                    return;
                  }
                  if (!barangayId || !user?.userId) {
                    Alert.alert('Error', 'User information missing');
                    return;
                  }

                  // Show confirm modal first; actual upload runs on confirm
                  openAlert('publish', uploadTitle, async () => {
                    closeAlert();
                    setIsUploading(true);
                    try {
                      let fileUrl = null;

                      const sanitizedName = uploadFile.name
                        .replace(/[^\w\s.-]/g, '')
                        .replace(/\s+/g, '_');
                      const fileName = `${barangayId}_portal_${Date.now()}_${sanitizedName}`;

                      const response = await fetch(uploadFile.uri);
                      const blob = await response.blob();

                      const { data: uploadData, error: uploadError } = await supabase.storage
                        .from('portal_documents')
                        .upload(fileName, blob, {
                          contentType: uploadFile.mimeType || 'application/octet-stream',
                        });

                      if (uploadError) {
                        Alert.alert('Upload Error', 'Failed to upload file: ' + uploadError.message);
                        setIsUploading(false);
                        return;
                      }

                      const { data: urlData } = supabase.storage
                        .from('portal_documents')
                        .getPublicUrl(fileName);

                      fileUrl = urlData.publicUrl;

                      const now = new Date().toISOString();
                      const { error: insertError } = await supabase
                        .from('website_posts')
                        .insert({
                          barangay_id: barangayId,
                          published_by: user.userId,
                          title: uploadTitle.trim(),
                          document_category: uploadCategory,
                          document_type: uploadDocType.value,
                          year: parseInt(uploadYear) || new Date().getFullYear(),
                          file_url: fileUrl,
                          portal_status: 'published',
                          published_at: now,
                        });

                      if (insertError) {
                        Alert.alert('Error', 'Failed to publish: ' + insertError.message);
                        setIsUploading(false);
                        return;
                      }

                      await logActivity('Upload to website', `Published "${uploadTitle}" to the transparency portal`);

                      const { data: freshDocs } = await supabase
                        .from('website_posts')
                        .select('*')
                        .eq('barangay_id', barangayId)
                        .eq('portal_status', 'published')
                        .order('published_at', { ascending: false });

                      if (freshDocs) {
                        setPublishedDocs(freshDocs.map(doc => ({
                          id: doc.website_post_id,
                          title: doc.title || 'Untitled',
                          category: doc.document_category || 'Unknown',
                          year: doc.year?.toString() || toUtcDate(doc.published_at).toLocaleDateString('en-PH', { timeZone: 'Asia/Manila', year: 'numeric' }),
                          uploadedAt: toPhilippineDate(doc.published_at, { month: 'long', day: 'numeric', year: 'numeric' }),
                          fileUrl: doc.file_url,
                        })));
                      }

                      const _title = uploadTitle;
                      setUploadFile(null);
                      setUploadTitle('');
                      setUploadCategory('');
                      setUploadDocType(null);
                      setUploadYear('');
                      setShowUploadModal(false);
                      openSuccess('publish', _title);
                    } catch (error) {
                      console.error('Publish error:', error);
                      Alert.alert('Error', 'An error occurred while publishing');
                    } finally {
                      setIsUploading(false);
                    }
                  });
                }}
              >
                <Text style={styles.publishBtnText}>{isUploading ? 'Publishing…' : 'Publish to Transparency Portal'}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.draftBtn}
                activeOpacity={0.85}
                onPress={async () => {
                  if (!uploadTitle || !barangayId || !user?.userId) {
                    Alert.alert('Missing Info', 'Please add at least a title before saving as draft.');
                    return;
                  }
                  try {
                    const { error: insertError } = await supabase
                      .from('website_posts')
                      .insert({
                        barangay_id: barangayId,
                        published_by: user.userId,
                        title: uploadTitle.trim(),
                        document_category: uploadCategory || null,
                        year: parseInt(uploadYear) || new Date().getFullYear(),
                        file_url: null,
                        portal_status: 'draft',
                      });
                    if (insertError) {
                      Alert.alert('Error', 'Failed to save draft: ' + insertError.message);
                      return;
                    }
                    openAlert('draft', uploadTitle, () => {
                      closeAlert();
                      setUploadFile(null); setUploadTitle(''); setUploadCategory(''); setUploadDocType(null); setUploadYear('');
                      setShowUploadModal(false);
                    });
                  } catch (e) {
                    Alert.alert('Error', 'An error occurred while saving');
                  }
                }}
              >
                <Text style={styles.draftBtnText}>Save as Draft</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.cancelUploadInlineBtn}
                onPress={() => setShowUploadModal(false)}
                activeOpacity={0.8}
              >
                <Text style={styles.cancelUploadInlineText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
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
            <Text style={styles.headerTitle}>{barangayName.toUpperCase()}</Text>
            <Text style={styles.headerDocLabel}>Portal and Post Managemnet</Text>
          </View>
          <View style={styles.headerRight}>
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

      {/* ── PORTAL TAB BAR — same style as PLANNING_TABS ── */}
      <View style={styles.portalTabBar}>
        {PORTAL_TABS.map(tab => {
          const active = activePortalTab === tab;
          return (
            <TouchableOpacity
              key={tab}
              style={[styles.portalTab, active && styles.portalTabActive]}
              onPress={() => tab === 'Published' ? router.push('/(tabs)/sk-portal') : tab === 'Feedback' ? router.push('/(tabs)/sk-portal-feedback') : setActivePlanningTab(tab)} activeOpacity={0.8}>
            
              <Text style={[styles.portalTabText, active && styles.portalTabTextActive]}>
                {tab}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* ── PUBLISHED TAB ── */}
      {activePortalTab === 'Published' && (
        <>
          {/* Filter row: Document | Year | Search | Upload */}
          <View style={styles.filterBarRow}>
            {/* Document filter dropdown */}
            <TouchableOpacity
              ref={docFilterRef}
              style={styles.filterDropdownBtn}
              onPress={() => {
                setShowYearDropdown(false);
                if (showDocDropdown) { setShowDocDropdown(false); }
                else { measureAndOpen(docFilterRef, setDocDropdownPos, setShowDocDropdown); }
              }}
              activeOpacity={0.8}
            >
              <Text style={styles.filterDropdownText} numberOfLines={1}>
                {docFilter === 'All Documents' ? 'Document' : docFilter.length > 20 ? docFilter.slice(0, 20) + '…' : docFilter}
              </Text>
              <Text style={styles.filterDropdownCaret}>▾</Text>
            </TouchableOpacity>

            {/* Year filter dropdown */}
            <TouchableOpacity
              ref={yearFilterRef}
              style={styles.filterDropdownBtn}
              onPress={() => {
                setShowDocDropdown(false);
                if (showYearDropdown) { setShowYearDropdown(false); }
                else { measureAndOpen(yearFilterRef, setYearDropdownPos, setShowYearDropdown); }
              }}
              activeOpacity={0.8}
            >
              <Text style={styles.filterDropdownText}>
                {yearFilter === 'All Years' ? 'Year' : yearFilter}
              </Text>
              <Text style={styles.filterDropdownCaret}>▾</Text>
            </TouchableOpacity>

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

            <View style={{ flex: 1 }} />

            {/* Upload button */}
            <TouchableOpacity
              style={styles.uploadBtn}
              onPress={() => { setUploadFile(null); setUploadTitle(''); setUploadCategory(''); setUploadDocType(null); setUploadYear(''); setShowUploadModal(true); }}
              activeOpacity={0.8}
            >
              <UploadIcon />
              <Text style={styles.uploadBtnText}>Upload</Text>
            </TouchableOpacity>
          </View>

          {/* Posted in Public Portal label */}
          <Text style={styles.postedLabel}>Posted in Public Portal</Text>

          {/* Full Disclosure Policy Board section */}
          <View style={styles.disclosureCard}>
            <View style={styles.disclosureHeader}>
              <Text style={styles.disclosureHeaderText}>Full Disclosure Policy Board</Text>
            </View>

            {filteredDocs.length > 0 ? (
              filteredDocs.map((doc, idx) => (
                <React.Fragment key={doc.id}>
                  <DocumentCard item={doc} onPress={handleDocPress} />
                  {idx < filteredDocs.length - 1 && <View style={styles.cardDivider} />}
                </React.Fragment>
              ))
            ) : (
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>No documents found</Text>
              </View>
            )}
          </View>
        </>
      )}

      {/* ── FEEDBACK TAB ── */}
      {activePortalTab === 'Feedback' && (
        <>
          {/* Header row */}
          <View style={styles.feedbackHeaderRow}>
            <Text style={styles.feedbackCount}>{feedbackItems.length} feedback received</Text>
            <View style={styles.searchBox}>
              <Text style={{ fontSize: 12, color: COLORS.midGray, marginRight: 4 }}>🔍</Text>
              <TextInput
                style={styles.searchInput}
                placeholder="Search feedback"
                placeholderTextColor={COLORS.midGray}
              />
            </View>
          </View>

          {/* Feedback list */}
          <View style={styles.feedbackCard}>
            {feedbackItems.map((item, idx) => (
              <React.Fragment key={item.id}>
                <FeedbackRow item={item} idx={idx} />
                {idx < feedbackItems.length - 1 && <View style={styles.cardDivider} />}
              </React.Fragment>
            ))}
          </View>

          {/* Empty filler box matches screenshot height */}
          <View style={{ height: 24 }} />
        </>
      )}
    </ScrollView>
  );

    // -- Success Modal --
  const renderSuccessModal = () => {
    const { visible, type, docTitle } = successModal;
    const isPublish = type === 'publish';
    const accentColor = isPublish ? '#1B6B32' : '#B71C1C';
    const iconBg      = isPublish ? '#D4EDDA'  : '#FFCDD2';
    const iconColor   = isPublish ? '#1B6B32'  : '#B71C1C';
    const accentLight = isPublish ? '#EAFBEA'  : '#FFEBEE';
    const heading     = isPublish ? 'Published Successfully!' : 'Unpublished Successfully';
    const message     = isPublish
      ? 'The document is now live on the Transparency Portal and visible to the public.'
      : 'The document has been removed from the Transparency Portal.';

    const renderIcon = () => (
      <View style={[successStyles.iconRing, { borderColor: accentColor }]}>
        <View style={[successStyles.iconCircle, { backgroundColor: iconBg }]}>
          {isPublish ? (
            <>
              <View style={[successStyles.checkLong,  { backgroundColor: iconColor }]} />
              <View style={[successStyles.checkShort, { backgroundColor: iconColor }]} />
            </>
          ) : (
            <>
              <View style={[successStyles.xBar1, { backgroundColor: iconColor }]} />
              <View style={[successStyles.xBar2, { backgroundColor: iconColor }]} />
            </>
          )}
        </View>
      </View>
    );

    return (
      <Modal visible={visible} transparent animationType="fade" onRequestClose={closeSuccess}>
        <TouchableOpacity style={successStyles.overlay} activeOpacity={1} onPress={closeSuccess}>
          <TouchableOpacity style={successStyles.card} activeOpacity={1} onPress={() => {}}>
            <View style={[successStyles.topBar, { backgroundColor: accentColor }]} />
            <View style={successStyles.body}>
              <View style={{ marginBottom: 16 }}>{renderIcon()}</View>
              <Text style={successStyles.eyebrow}>TRANSPARENCY PORTAL</Text>
              <Text style={[successStyles.heading, { color: accentColor }]}>{heading}</Text>
              <View style={[successStyles.divider, { backgroundColor: accentColor + '33' }]} />
              <Text style={successStyles.message}>{message}</Text>
              {!!docTitle && (
                <View style={[successStyles.docChip, { backgroundColor: accentLight }]}>
                  <View style={[successStyles.docChipDot, { backgroundColor: accentColor }]} />
                  <Text style={[successStyles.docChipText, { color: accentColor }]} numberOfLines={2}>
                    {docTitle}
                  </Text>
                </View>
              )}
              <TouchableOpacity
                style={[successStyles.doneBtn, { backgroundColor: accentColor }]}
                activeOpacity={0.85}
                onPress={closeSuccess}
              >
                <Text style={successStyles.doneBtnText}>Done</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    );
  };

// ── Alert Modal ──
  const ALERT_VARIANTS = {
    publish:   { accentColor: '#1B6B32', accentLight: '#EAFBEA', iconBg: '#D4EDDA', iconColor: '#1B6B32', eyebrow: 'TRANSPARENCY PORTAL', confirmLabel: 'Publish Now',    confirmStyle: 'primary' },
    draft:     { accentColor: COLORS.navy, accentLight: '#EAF0FB', iconBg: '#D6E4F7', iconColor: COLORS.navy, eyebrow: 'TRANSPARENCY PORTAL', confirmLabel: 'Save as Draft', confirmStyle: 'outline' },
    unpublish: { accentColor: '#B71C1C', accentLight: '#FFEBEE', iconBg: '#FFCDD2', iconColor: '#B71C1C', eyebrow: 'TRANSPARENCY PORTAL', confirmLabel: 'Unpublish',      confirmStyle: 'danger'  },
  };
  const ALERT_DEFAULT_COPY = {
    publish:   { title: 'Publish Document',   message: 'This document will be visible to the public on the Transparency Portal.' },
    draft:     { title: 'Save as Draft',      message: 'Your document will be saved privately. You can publish it anytime.' },
    unpublish: { title: 'Unpublish Document', message: 'This will remove the document from the Transparency Portal. Residents will no longer be able to view it.' },
  };

  const renderAlertModal = () => {
    const { visible, type, docTitle, onConfirm } = alertModal;
    const cfg  = ALERT_VARIANTS[type]      || ALERT_VARIANTS.publish;
    const copy = ALERT_DEFAULT_COPY[type]  || ALERT_DEFAULT_COPY.publish;

    const confirmBtnStyle = cfg.confirmStyle === 'outline'
      ? { backgroundColor: COLORS.white, borderWidth: 1.5, borderColor: cfg.accentColor }
      : { backgroundColor: cfg.accentColor };
    const confirmTextColor = cfg.confirmStyle === 'outline' ? cfg.accentColor : COLORS.white;

    const renderAlertIcon = () => {
      if (type === 'publish') return (
        <View style={[alertStyles.iconCircle, { backgroundColor: cfg.iconBg }]}>
          <View style={[alertStyles.checkLong,  { backgroundColor: cfg.iconColor }]} />
          <View style={[alertStyles.checkShort, { backgroundColor: cfg.iconColor }]} />
        </View>
      );
      if (type === 'draft') return (
        <View style={[alertStyles.iconCircle, { backgroundColor: cfg.iconBg }]}>
          {[0,1,2].map(i => (
            <View key={i} style={[alertStyles.draftLine, { backgroundColor: cfg.iconColor, marginTop: i === 0 ? 0 : 5 }]} />
          ))}
        </View>
      );
      if (type === 'unpublish') return (
        <View style={[alertStyles.iconCircle, { backgroundColor: cfg.iconBg }]}>
          <View style={[alertStyles.xBar1, { backgroundColor: cfg.iconColor }]} />
          <View style={[alertStyles.xBar2, { backgroundColor: cfg.iconColor }]} />
        </View>
      );
      return null;
    };

    return (
      <Modal visible={visible} transparent animationType="fade" onRequestClose={closeAlert}>
        <TouchableOpacity style={alertStyles.overlay} activeOpacity={1} onPress={closeAlert}>
          <TouchableOpacity style={alertStyles.card} activeOpacity={1} onPress={() => {}}>
            {/* Colored top stripe */}
            <View style={[alertStyles.topBar, { backgroundColor: cfg.accentColor }]} />

            <View style={alertStyles.body}>
              {/* Icon */}
              <View style={{ marginBottom: 16 }}>{renderAlertIcon()}</View>

              {/* Eyebrow */}
              <Text style={alertStyles.eyebrow}>{cfg.eyebrow}</Text>

              {/* Title */}
              <Text style={alertStyles.title}>{copy.title}</Text>

              {/* Divider */}
              <View style={alertStyles.divider} />

              {/* Message */}
              <Text style={alertStyles.message}>{copy.message}</Text>

              {/* Doc name chip */}
              {!!docTitle && (
                <View style={[alertStyles.docChip, { backgroundColor: cfg.accentLight }]}>
                  <View style={[alertStyles.docChipDot, { backgroundColor: cfg.accentColor }]} />
                  <Text style={[alertStyles.docChipText, { color: cfg.accentColor }]} numberOfLines={2}>
                    {docTitle}
                  </Text>
                </View>
              )}

              {/* Confirm */}
              <TouchableOpacity
                style={[alertStyles.confirmBtn, confirmBtnStyle]}
                activeOpacity={0.85}
                onPress={onConfirm}
              >
                <Text style={[alertStyles.confirmBtnText, { color: confirmTextColor }]}>
                  {cfg.confirmLabel}
                </Text>
              </TouchableOpacity>

              {/* Cancel */}
              <TouchableOpacity style={alertStyles.cancelBtn} activeOpacity={0.7} onPress={closeAlert}>
                <Text style={alertStyles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    );
  };

  // ── Floating Dropdown Modals (render above everything incl. other Modals) ──
  const renderFloatingDropdown = (visible, setVisible, pos, options, selectedValue, onSelect, minWidth = 200) => (
    <Modal visible={visible} transparent animationType="none" onRequestClose={() => setVisible(false)}>
      <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setVisible(false)}>
        <View style={[styles.floatingDropdown, pos && { top: pos.y, left: pos.x, minWidth: Math.max(pos.width || 0, minWidth) }]}>
          {options.map(opt => (
            <TouchableOpacity
              key={opt}
              style={[styles.filterDropdownItem, selectedValue === opt && styles.filterDropdownItemActive]}
              onPress={() => { onSelect(opt); setVisible(false); }}
            >
              <Text style={[styles.filterDropdownItemText, selectedValue === opt && { color: COLORS.navy, fontWeight: '700' }]} numberOfLines={2}>
                {opt}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </TouchableOpacity>
    </Modal>
  );

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.navy} />

      {renderDocModal()}
      {renderUploadModal()}
      {renderAlertModal()}
      {renderSuccessModal()}

      {/* ── Document Viewer Modal ── */}
      <Modal
        visible={viewerModal.visible}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setViewerModal({ visible: false, fileUrl: null, title: '' })}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.navy }}>
          <View style={styles.viewerHeader}>
            <TouchableOpacity
              style={styles.viewerBackBtn}
              onPress={() => setViewerModal({ visible: false, fileUrl: null, title: '' })}
              activeOpacity={0.8}
            >
              <Feather name="arrow-left" size={20} color={COLORS.white} />
            </TouchableOpacity>
            <Text style={styles.viewerTitle} numberOfLines={1}>{viewerModal.title}</Text>
            {viewerModal.fileUrl && (
              <TouchableOpacity
                style={styles.viewerOpenBtn}
                onPress={() => {
                  setViewerModal({ visible: false, fileUrl: null, title: '' });
                  setDocumentToDownload({ fileUrl: viewerModal.fileUrl, title: viewerModal.title });
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
                        setViewerModal({ visible: false, fileUrl: null, title: '' });
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
        <View style={styles.modalOverlay}>
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

      {/* Floating dropdowns — always on top */}
      {renderFloatingDropdown(showDocDropdown, setShowDocDropdown, docDropdownPos, DOCUMENT_FILTERS, docFilter, setDocFilter, 220)}
      {renderFloatingDropdown(showYearDropdown, setShowYearDropdown, yearDropdownPos, YEAR_FILTERS, yearFilter, setYearFilter, 100)}
      {renderFloatingDropdown(showUploadCatDropdown, setShowUploadCatDropdown, uploadCatDropdownPos, UPLOAD_FOLDER_CATEGORIES, uploadCategory, (val) => { setUploadCategory(val); setUploadDocType(null); }, 200)}
      {renderFloatingDropdown(showUploadDocTypeDropdown, setShowUploadDocTypeDropdown, uploadDocTypeDropdownPos, (CATEGORY_DOC_TYPES[uploadCategory] || []).map(d => d.label), uploadDocType?.label, (val) => { const found = (CATEGORY_DOC_TYPES[uploadCategory] || []).find(d => d.label === val); setUploadDocType(found || null); }, 260)}
      {renderFloatingDropdown(showUploadYearDropdown, setShowUploadYearDropdown, uploadYearDropdownPos, UPLOAD_YEARS, uploadYear, setUploadYear, 90)}

      <View style={styles.layout}>
        {isMobile && sidebarVisible && (
          <TouchableOpacity
            style={styles.sidebarOverlay}
            activeOpacity={1}
            onPress={() => setSidebarVisible(false)}
          />
        )}
        {renderSidebar()}
        {renderContent()}
      </View>
    </SafeAreaView>
  );
}

// ─── STYLES ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: COLORS.navy },
  layout: { flex: 1, flexDirection: 'row' },

  // ── Sidebar (identical to sk-planning) ──
  sidebar: {
    width: 250, backgroundColor: COLORS.navy,
    alignItems: 'center', paddingTop: 20, paddingBottom: 24,
    paddingHorizontal: 10, zIndex: 20,
    ...(isMobile ? {
      position: 'absolute', top: 0, left: 0, bottom: 0, zIndex: 20,
    } : {}),
  },
  sidebarHidden: {
    display: 'none',
  },
  sidebarOverlay: {
    position: 'absolute', left: 0, top: 0, bottom: 0, right: 0,
    backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 15,
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
  },
  navItemInner: { flexDirection: 'row', alignItems: 'center', gap: 8 },
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
    borderBottomWidth: 2, borderBottomColor: COLORS.lightGray, paddingBottom: 4, marginBottom: 6,
  },
  headerDocLabel: { fontSize: 14, fontWeight: '700', color: COLORS.darkText, marginTop: 4 },
  headerRight:    { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },

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

  // ── Portal Tab Bar — identical structure to PLANNING_TABS ──
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

  // ── Filter bar row ──
  filterBarRow: {
    flexDirection: 'row', alignItems: 'center',
    gap: 8, marginBottom: 12, flexWrap: isMobile ? 'wrap' : 'nowrap',
    zIndex: 100,
  },
  filterDropdownBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: COLORS.white,
    borderWidth: 1, borderColor: COLORS.lightGray,
    borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8,
    minWidth: 90,
  },
  filterDropdownText: { fontSize: 13, color: COLORS.darkText, flex: 1 },
  filterDropdownCaret:{ fontSize: 10, color: COLORS.subText },
  filterDropdownPanel: {
    position: 'absolute', top: 40, left: 0, zIndex: 999,
    backgroundColor: COLORS.white,
    borderRadius: 10, borderWidth: 1, borderColor: COLORS.lightGray,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12, shadowRadius: 8, elevation: 20,
    minWidth: 200,
  },
  filterDropdownItem: { paddingHorizontal: 14, paddingVertical: 10 },
  filterDropdownItemActive: { backgroundColor: COLORS.offWhite },
  filterDropdownItemText: { fontSize: 13, color: COLORS.darkText },

  // Floating dropdown overlay (always on top)
  floatingDropdown: {
    position: 'absolute',
    backgroundColor: COLORS.white,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.lightGray,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 30,
    zIndex: 9999,
  },

  searchBox: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.white, borderRadius: 20,
    borderWidth: 1, borderColor: COLORS.lightGray,
    paddingHorizontal: 12, paddingVertical: 7,
    minWidth: 120, maxWidth: isMobile ? 160 : 200,
  },
  searchInput: { flex: 1, fontSize: 12, color: COLORS.darkText },

  uploadBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 8,
    backgroundColor: COLORS.white,
    borderWidth: 1, borderColor: COLORS.lightGray,
    borderRadius: 8,
  },
  uploadBtnText: { fontSize: 13, fontWeight: '600', color: COLORS.navy },

  // Posted label
  postedLabel: {
    fontSize: 13, fontWeight: '700', color: COLORS.navy,
    marginBottom: 10,
  },

  // Full Disclosure Card
  disclosureCard: {
    backgroundColor: COLORS.white,
    borderRadius: 10,
    borderWidth: 1, borderColor: COLORS.lightGray,
    overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 4, elevation: 1,
    marginBottom: 16,
  },
  disclosureHeader: {
    paddingHorizontal: 18, paddingVertical: 13,
    alignItems: 'center',
    borderBottomWidth: 1, borderBottomColor: COLORS.lightGray,
    backgroundColor: COLORS.white,
  },
  disclosureHeaderText: {
    fontSize: 14, fontWeight: '800', color: COLORS.navy, textAlign: 'center',
  },
  docCard: {
    paddingHorizontal: 18, paddingVertical: 16,
  },
  docCardTitle: {
    fontSize: 13, color: COLORS.darkText, fontWeight: '400', lineHeight: 19,
  },
  cardDivider: {
    height: 1, backgroundColor: COLORS.lightGray, marginHorizontal: 18,
  },

  // Empty state
  emptyState: { alignItems: 'center', paddingVertical: 40 },
  emptyText:  { fontSize: 14, color: COLORS.midGray },

  // ── Feedback Tab ──
  feedbackHeaderRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: 12,
  },
  feedbackCount: { fontSize: 13, fontWeight: '700', color: COLORS.darkText },
  feedbackCard: {
    backgroundColor: COLORS.white,
    borderRadius: 10,
    borderWidth: 1, borderColor: COLORS.lightGray,
    overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 4, elevation: 1,
  },
  feedbackRow: {
    paddingHorizontal: 16, paddingVertical: 14,
    backgroundColor: COLORS.white,
  },
  feedbackLeft: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
  },
  feedbackAvatar: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: COLORS.navy, alignItems: 'center', justifyContent: 'center',
  },
  feedbackAvatarText: { fontSize: 14, fontWeight: '800', color: COLORS.white },
  feedbackNameRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 3,
  },
  feedbackName: { fontSize: 13, fontWeight: '700', color: COLORS.darkText },
  feedbackNewBadge: {
    backgroundColor: COLORS.gold, borderRadius: 6,
    paddingHorizontal: 7, paddingVertical: 2,
  },
  feedbackNewBadgeText: { fontSize: 10, fontWeight: '800', color: COLORS.navy },
  feedbackComment: { fontSize: 12, color: COLORS.subText, lineHeight: 17, marginBottom: 4 },
  feedbackDate:    { fontSize: 11, color: COLORS.midGray },

  // ── Doc Detail Modal ──
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center', alignItems: 'center', padding: 24,
  },
  modalCard: {
    backgroundColor: COLORS.white, borderRadius: 16,
    padding: 24, width: '100%', maxWidth: 380,
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18, shadowRadius: 20, elevation: 12,
  },
  modalTitle:    { fontSize: 16, fontWeight: '800', color: COLORS.darkText, marginBottom: 6 },
  modalSubtitle: { fontSize: 13, color: COLORS.subText, lineHeight: 18, marginBottom: 14 },
  modalDivider:  { height: 1, backgroundColor: COLORS.lightGray, marginBottom: 12 },
  modalMeta: {
    flexDirection: 'row', justifyContent: 'space-between',
    marginBottom: 8,
  },
  modalMetaLabel: { fontSize: 12, color: COLORS.subText, fontWeight: '600' },
  modalMetaValue: { fontSize: 12, color: COLORS.darkText, fontWeight: '700' },
  modalActions:  { flexDirection: 'row', gap: 8, marginBottom: 16 },
  modalActionBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
  modalActionText:{ fontSize: 12, fontWeight: '700' },
  modalCloseBtn: {
    paddingVertical: 10, borderRadius: 10,
    backgroundColor: COLORS.lightGray, alignItems: 'center',
  },
  modalCloseBtnText: { fontSize: 13, fontWeight: '600', color: COLORS.darkText },

  // ── Upload Modal ──
  uploadModalCard: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    width: '95%',
    maxWidth: 640,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.2,
    shadowRadius: 28,
    elevation: 20,
    overflow: 'hidden',
  },
  uploadModalHeader: {
    backgroundColor: COLORS.navy,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 22,
    paddingVertical: 16,
  },
  uploadModalHeaderEyebrow: {
    fontSize: 10,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.55)',
    letterSpacing: 1.2,
    marginBottom: 2,
  },
  uploadModalHeaderText: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.white,
    letterSpacing: 0.2,
  },
  uploadModalClose: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
    marginLeft: 10,
  },
  uploadModalCloseText: { fontSize: 13, fontWeight: '800', color: COLORS.white },
  uploadModalDivider: { height: 1, backgroundColor: COLORS.lightGray },
  uploadModalBody: {
    flexDirection: 'row',
    padding: 22,
    gap: 0,
  },
  uploadModalLeft: {
    flex: 1,
    paddingRight: 20,
  },
  uploadModalSeparator: {
    width: 1,
    backgroundColor: COLORS.lightGray,
    marginVertical: 4,
  },
  uploadModalRight: {
    flex: 1.5,
    paddingLeft: 20,
  },

  // Step indicator
  stepBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },
  stepBadge: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: COLORS.navy,
    alignItems: 'center', justifyContent: 'center',
  },
  stepBadgeText: { fontSize: 11, fontWeight: '800', color: COLORS.white },
  stepBadgeLabel: { fontSize: 12, fontWeight: '700', color: COLORS.darkText, letterSpacing: 0.2 },

  // Drop zone
  dropZone: {
    width: '100%',
    borderWidth: 1.5,
    borderColor: '#C5D3E8',
    borderRadius: 10,
    borderStyle: 'dashed',
    alignItems: 'center',
    paddingVertical: 28,
    paddingHorizontal: 12,
    backgroundColor: '#F5F8FF',
    marginBottom: 12,
  },
  dropZoneIconWrap: {
    alignItems: 'center',
    marginBottom: 12,
    position: 'relative',
  },
  cloudBase: {
    width: 34, height: 18,
    backgroundColor: '#C5D3E8',
    borderRadius: 9,
    marginTop: 10,
  },
  cloudTop: {
    width: 18, height: 18,
    backgroundColor: '#C5D3E8',
    borderRadius: 9,
    position: 'absolute',
    top: 0, left: 8,
  },
  cloudArrowShaft: {
    width: 2, height: 14,
    backgroundColor: COLORS.navy,
    borderRadius: 1,
    marginTop: 4,
  },
  cloudArrowHead: {
    width: 0, height: 0,
    borderLeftWidth: 6, borderRightWidth: 6, borderTopWidth: 8,
    borderLeftColor: 'transparent', borderRightColor: 'transparent',
    borderTopColor: COLORS.navy,
    marginTop: 1,
  },
  dropZoneMainLabel: {
    fontSize: 13, fontWeight: '700', color: COLORS.navy, marginBottom: 4,
  },
  dropZoneSubLabel: {
    fontSize: 11, color: COLORS.subText, textAlign: 'center',
  },

  // Attached file card
  fileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#C5D3E8',
    borderRadius: 10,
    padding: 12,
    backgroundColor: '#F5F8FF',
    gap: 10,
    marginBottom: 10,
  },
  fileExtBadge: {
    width: 40, height: 44,
    backgroundColor: COLORS.navy,
    borderRadius: 6,
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  fileExtText: {
    fontSize: 9, fontWeight: '800', color: COLORS.white, letterSpacing: 0.5,
  },
  fileCardInfo: { flex: 1 },
  fileCardName: {
    fontSize: 12, fontWeight: '600', color: COLORS.darkText, lineHeight: 17,
  },
  fileCardSize: {
    fontSize: 11, color: COLORS.subText, marginTop: 2,
  },
  removeFileBtn: {
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: '#FFECEC',
    borderWidth: 1, borderColor: '#F5C6C6',
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  removeFileBtnText: {
    fontSize: 10, color: '#C0392B', fontWeight: '800',
  },
  replaceFileLink: {
    alignSelf: 'center',
    paddingVertical: 4,
  },
  replaceFileLinkText: {
    fontSize: 11, color: COLORS.navy, fontWeight: '600',
  },

  uploadFieldLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.subText,
    marginBottom: 5,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  uploadTextInput: {
    borderWidth: 1,
    borderColor: COLORS.lightGray,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 13,
    color: COLORS.darkText,
    backgroundColor: COLORS.white,
    marginBottom: 12,
  },
  uploadRowFields: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  uploadDropdownBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.lightGray,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    backgroundColor: COLORS.white,
  },
  uploadDropdownText: {
    flex: 1,
    fontSize: 12,
    color: COLORS.darkText,
  },
  uploadDropdownCaret: {
    fontSize: 10,
    color: COLORS.subText,
    marginLeft: 4,
  },

  publishBtn: {
    backgroundColor: '#1B6B32',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 8,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  publishBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.white,
    letterSpacing: 0.3,
  },
  draftBtn: {
    backgroundColor: COLORS.white,
    borderWidth: 1.5,
    borderColor: COLORS.navy,
    borderRadius: 8,
    paddingVertical: 11,
    alignItems: 'center',
    marginBottom: 8,
  },
  draftBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.navy,
    letterSpacing: 0.2,
  },
  cancelUploadInlineBtn: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  cancelUploadInlineText: {
    fontSize: 12,
    color: COLORS.subText,
    fontWeight: '500',
  },

  // ── Document Viewer ──
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

  // ── Download Confirmation Modal ──
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

// ─── ALERT MODAL STYLES ───────────────────────────────────────────────────────
const alertStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 18,
    width: '100%',
    maxWidth: 360,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.22,
    shadowRadius: 24,
    elevation: 18,
  },
  topBar: {
    height: 5,
    width: '100%',
  },
  body: {
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 24,
    alignItems: 'center',
  },
  // ── Icon circle ──
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Publish checkmark
  checkLong: {
    position: 'absolute',
    width: 20,
    height: 2.5,
    borderRadius: 2,
    transform: [{ rotate: '-45deg' }, { translateX: 2 }, { translateY: -2 }],
  },
  checkShort: {
    position: 'absolute',
    width: 10,
    height: 2.5,
    borderRadius: 2,
    transform: [{ rotate: '45deg' }, { translateX: -5 }, { translateY: 3 }],
  },
  // Draft lines
  draftLine: {
    width: 22,
    height: 2.5,
    borderRadius: 2,
  },
  // Unpublish X
  xBar1: {
    position: 'absolute',
    width: 22,
    height: 2.5,
    borderRadius: 2,
    transform: [{ rotate: '45deg' }],
  },
  xBar2: {
    position: 'absolute',
    width: 22,
    height: 2.5,
    borderRadius: 2,
    transform: [{ rotate: '-45deg' }],
  },
  // ── Text ──
  eyebrow: {
    fontSize: 9,
    fontWeight: '700',
    color: COLORS.midGray,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  title: {
    fontSize: 17,
    fontWeight: '800',
    color: COLORS.darkText,
    textAlign: 'center',
    letterSpacing: 0.2,
    marginBottom: 14,
  },
  divider: {
    width: 40,
    height: 2,
    backgroundColor: COLORS.lightGray,
    borderRadius: 2,
    marginBottom: 14,
  },
  message: {
    fontSize: 13,
    color: COLORS.subText,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 16,
  },
  // Doc name chip
  docChip: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    width: '100%',
    marginBottom: 20,
  },
  docChipDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 4,
    flexShrink: 0,
  },
  docChipText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 18,
  },
  // Confirm button
  confirmBtn: {
    width: '100%',
    paddingVertical: 13,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 10,
  },
  confirmBtnText: {
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  // Cancel button
  cancelBtn: {
    width: '100%',
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    backgroundColor: COLORS.offWhite,
  },
  cancelBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.subText,
  },
});

// --- SUCCESS MODAL STYLES ---
const successStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    width: '100%',
    maxWidth: 340,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.22,
    shadowRadius: 28,
    elevation: 20,
  },
  topBar: {
    height: 5,
    width: '100%',
  },
  body: {
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 28,
    alignItems: 'center',
  },
  // Icon with outer ring
  iconRing: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 2,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCircle: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkLong: {
    position: 'absolute',
    width: 22,
    height: 2.5,
    borderRadius: 2,
    transform: [{ rotate: '-45deg' }, { translateX: 2 }, { translateY: -2 }],
  },
  checkShort: {
    position: 'absolute',
    width: 11,
    height: 2.5,
    borderRadius: 2,
    transform: [{ rotate: '45deg' }, { translateX: -5 }, { translateY: 3 }],
  },
  xBar1: {
    position: 'absolute',
    width: 22,
    height: 2.5,
    borderRadius: 2,
    transform: [{ rotate: '45deg' }],
  },
  xBar2: {
    position: 'absolute',
    width: 22,
    height: 2.5,
    borderRadius: 2,
    transform: [{ rotate: '-45deg' }],
  },
  eyebrow: {
    fontSize: 9,
    fontWeight: '700',
    color: '#B0B0B0',
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  heading: {
    fontSize: 18,
    fontWeight: '900',
    textAlign: 'center',
    letterSpacing: 0.2,
    marginBottom: 12,
  },
  divider: {
    width: 48,
    height: 2,
    borderRadius: 2,
    marginBottom: 12,
  },
  message: {
    fontSize: 13,
    color: '#666666',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 16,
  },
  docChip: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    width: '100%',
    marginBottom: 22,
  },
  docChipDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 4,
    flexShrink: 0,
  },
  docChipText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 18,
  },
  doneBtn: {
    width: '100%',
    paddingVertical: 13,
    borderRadius: 10,
    alignItems: 'center',
  },
  doneBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
});