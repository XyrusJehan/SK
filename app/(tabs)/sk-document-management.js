import { Feather } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import Head from 'expo-router/head';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert,
  Animated,
  Dimensions, Image,
  Linking,
  Modal,
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text, TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { supabase } from '../../utils/supabase';
import { useAuth } from './authContext';
import { useNav } from './navContext';
import { NotificationModal, useNotificationCenter, BellIcon } from './notificationCenter';
import Sidebar from './../components/Sidebar';
// WebView: use react-native-webview on native, iframe on web
let WebView = null;
if (Platform.OS !== 'web') {
  WebView = require('react-native-webview').WebView;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const isMobile = SCREEN_WIDTH < 768;

// ─── COLORS ───────────────────────────────────────────────────────────────────
const COLORS = {
  navy:      '#133E75',
  gold:      '#E8C547',
  white:     '#FFFFFF',
  offWhite:  '#F7F5F2',
  lightGray: '#ECECEC',
  midGray:   '#B0B0B0',
  darkText:  '#1A1A1A',
  subText:   '#666666',
  cardBg:    '#FFFFFF',
  red:       '#D32F2F',
  blue:      '#1565C0',
  teal:      '#00796B',
};

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const NAV_TABS       = ['Dashboard', 'Documents', 'Planning', 'Portal', 'Logs', 'Account'];
const DOCUMENT_TABS  = ['Folder', 'Document Management'];
const STATUS_TABS    = ['All', 'Drafts', 'Saved', 'Submitted', 'Approved', 'Returned'];
// DRAFT_TYPES is built dynamically from the fetched document_category table.
// "All Types" remains a fixed sentinel for the unfiltered view.
const DRAFT_ALL_LABEL = 'All Types';
const SORT_OPTIONS   = ['Newest', 'Oldest', 'Title A-Z', 'Title Z-A'];

// ─── MOCK DATA ────────────────────────────────────────────────────────────────
// (Data now fetched from Supabase based on barangay_id)
const MOCK_DOCUMENTS = {
};

// ─── ICON COMPONENTS ──────────────────────────────────────────────────────────
const MenuIcon = () => (
  <View style={styles.menuIconContainer}>
    {[0, 1, 2].map(i => <View key={i} style={styles.menuLine} />)}
  </View>
);

// Nav icons + NAV_ITEMS now live in the shared Sidebar module (see import above).

// Edit icon
const EditIcon = () => (
  <View style={styles.actionIconWrap}>
    <Feather name="edit-2" size={isMobile ? 13 : 15} color={COLORS.navy} />
  </View>
);

// Delete icon
const DeleteIcon = () => (
  <View style={styles.actionIconWrap}>
    <Feather name="trash-2" size={isMobile ? 13 : 15} color={COLORS.red} />
  </View>
);

// View icon
const ViewIcon = () => (
  <View style={styles.actionIconWrap}>
    <Feather name="eye" size={isMobile ? 13 : 15} color={COLORS.teal} />
  </View>
);

// Forward icon (send / paper plane)
const ForwardIcon = () => (
  <View style={styles.actionIconWrap}>
    <Feather name="send" size={isMobile ? 13 : 15} color={COLORS.blue} />
  </View>
);

// Save icon (download)
const SaveIcon = () => (
  <View style={styles.actionIconWrap}>
    <Feather name="download" size={isMobile ? 13 : 15} color={COLORS.navy} />
  </View>
);

// ─── TYPE BADGE ───────────────────────────────────────────────────────────────
const TypeBadge = ({ type }) => {
  const colorMap = {
    Financial:   { bg: '#E8F5E9', text: '#1A6B38' },
    Planning:    { bg: '#E3EDF9', text: '#2A4E8A' },
    Governance:  { bg: '#F2EEF9', text: '#5A2EA0' },
    Performance: { bg: '#FDF2EA', text: '#A04010' },
  };
  const c = colorMap[type] || { bg: COLORS.lightGray, text: COLORS.subText };
  return (
    <View style={[styles.typeBadge, { backgroundColor: c.bg }]}>
      <Text style={[styles.typeBadgeText, { color: c.text }]}>{type}</Text>
    </View>
  );
};

// ─── RETURNED DOCUMENT VIEWER ─────────────────────────────────────────────────
const COMMENT_PANEL_WIDTH = isMobile ? SCREEN_WIDTH : 320;

const ReturnedDocumentViewer = ({ doc, onClose }) => {
  const { user } = useAuth();
  const [fileUrl, setFileUrl]       = useState(doc.fileUrl || null);
  const [loading, setLoading]       = useState(!doc.fileUrl);
  const [webLoading, setWebLoading] = useState(true);

  // Comment panel
  const [commentPanelOpen, setCommentPanelOpen] = useState(false);
  const slideAnim = useRef(new Animated.Value(COMMENT_PANEL_WIDTH)).current;

  const openCommentPanel = () => {
    setCommentPanelOpen(true);
    Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 65, friction: 11 }).start();
    fetchComments();
  };
  const closeCommentPanel = () => {
    Animated.timing(slideAnim, { toValue: COMMENT_PANEL_WIDTH, useNativeDriver: true, duration: 220 }).start(() => setCommentPanelOpen(false));
  };

  // Comments
  const [comments, setComments]           = useState([]);
  const [commentsLoading, setCommentsLoading] = useState(false);

  const fetchComments = useCallback(async () => {
    setCommentsLoading(true);
    try {
      const { data: lydo, error } = await supabase
        .from('lydo_comments')
        .select(`comment_id, content, is_resolved, created_at,
          commenter:users!lydo_comments_commented_by_fkey (user_id, first_name, last_name)`)
        .eq('document_id', doc.id)
        .order('created_at', { ascending: true });
      if (error) { setComments([]); return; }
      setComments(lydo || []);
    } catch (e) { setComments([]); }
    finally { setCommentsLoading(false); }
  }, [doc.id]);

  const formatTime = (iso) => {
    if (!iso) return '';
    return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };
  const getInitials = (u) => u ? `${u.first_name?.[0] || ''}${u.last_name?.[0] || ''}`.toUpperCase() : '??';
  const getFullName = (u) => u ? `${u.first_name || ''} ${u.last_name || ''}`.trim() || 'LYDO Officer' : 'LYDO Officer';

  const resolvedCount   = comments.filter(c => c.is_resolved).length;
  const unresolvedCount = comments.length - resolvedCount;

  useEffect(() => {
    if (doc.fileUrl) { setFileUrl(doc.fileUrl); setLoading(false); return; }
    const fetchFile = async () => {
      setLoading(true);
      try {
        const { data: versions } = await supabase
          .from('document_versions').select('file_url')
          .eq('document_id', doc.id).order('version_number', { ascending: false }).limit(1);
        const versionUrl = versions?.[0]?.file_url;
        if (versionUrl) { setFileUrl(versionUrl); } else {
          const { data: d } = await supabase.from('documents').select('file_url').eq('document_id', doc.id).single();
          setFileUrl(d?.file_url || null);
        }
      } catch (e) { setFileUrl(null); }
      finally { setLoading(false); }
    };
    fetchFile();
  }, [doc.id]);

  const googleViewerUrl = fileUrl
    ? `https://docs.google.com/gview?embedded=true&url=${encodeURIComponent(fileUrl)}`
    : null;

  return (
    <Modal visible animationType="slide" statusBarTranslucent>
      <SafeAreaView style={rvStyles.safe}>
        {/* Top Bar */}
        <View style={rvStyles.topBar}>
          <TouchableOpacity style={rvStyles.backBtn} onPress={onClose} activeOpacity={0.8}>
            <Feather name="arrow-left" size={20} color={COLORS.white} />
          </TouchableOpacity>
          <View style={rvStyles.topMid}>
            <Text style={rvStyles.topTitle} numberOfLines={1}>{doc.title}</Text>
            <View style={rvStyles.returnedBadge}>
              <Feather name="corner-up-left" size={10} color="#E87A30" />
              <Text style={rvStyles.returnedBadgeText}>Returned for revision</Text>
            </View>
          </View>
          {fileUrl && (
            <TouchableOpacity style={rvStyles.downloadBtn}
              onPress={() => Linking.openURL(fileUrl).catch(() => Alert.alert('Error', 'Could not open file.'))}
              activeOpacity={0.8}>
              <Feather name="download" size={18} color={COLORS.gold} />
            </TouchableOpacity>
          )}
        </View>

        {/* Document area */}
        <View style={{ flex: 1, backgroundColor: COLORS.offWhite }}>
          {loading ? (
            <View style={rvStyles.centerState}>
              <ActivityIndicator size="large" color={COLORS.navy} />
              <Text style={rvStyles.loadingTxt}>Loading document…</Text>
            </View>
          ) : !fileUrl ? (
            <View style={rvStyles.centerState}>
              <Feather name="file-text" size={40} color={COLORS.midGray} />
              <Text style={rvStyles.loadingTxt}>No file attached</Text>
            </View>
          ) : Platform.OS === 'web' ? (
            <iframe src={googleViewerUrl} style={{ flex: 1, width: '100%', height: '100%', border: 'none' }} title={doc.title} />
          ) : (
            <View style={{ flex: 1 }}>
              <WebView source={{ uri: googleViewerUrl }} style={{ flex: 1 }}
                onLoadStart={() => setWebLoading(true)} onLoadEnd={() => setWebLoading(false)}
                startInLoadingState={true}
                renderLoading={() => (
                  <View style={rvStyles.centerState}>
                    <ActivityIndicator size="large" color={COLORS.navy} />
                    <Text style={rvStyles.loadingTxt}>Loading document…</Text>
                  </View>
                )}
              />
              {webLoading && (
                <View style={rvStyles.webLoadingOverlay}>
                  <ActivityIndicator size="large" color={COLORS.navy} />
                  <Text style={rvStyles.loadingTxt}>Loading document…</Text>
                </View>
              )}
            </View>
          )}

          {/* Scrim */}
          {commentPanelOpen && (
            <TouchableOpacity style={rvStyles.panelScrim} activeOpacity={1} onPress={closeCommentPanel} />
          )}

          {/* Slide-in Comment Panel */}
          <Animated.View
            style={[rvStyles.commentPanel, { width: COMMENT_PANEL_WIDTH, transform: [{ translateX: slideAnim }] }]}
            pointerEvents={commentPanelOpen ? 'auto' : 'none'}
          >
            {/* Panel top bar */}
            <View style={rvStyles.panelTopBar}>
              <View>
                <Text style={rvStyles.panelTitle}>LYDO Comments</Text>
                <Text style={rvStyles.panelSub} numberOfLines={1}>{doc.title}</Text>
              </View>
              <TouchableOpacity style={rvStyles.panelCloseBtn} onPress={closeCommentPanel} activeOpacity={0.8}>
                <Feather name="x" size={18} color={COLORS.darkText} />
              </TouchableOpacity>
            </View>

            {/* Badge row */}
            {comments.length > 0 && (
              <View style={rvStyles.panelBadgeRow}>
                {unresolvedCount > 0 && (
                  <View style={[rvStyles.badge, rvStyles.badgeOpen]}>
                    <Text style={rvStyles.badgeTxt}>{unresolvedCount} open</Text>
                  </View>
                )}
                {resolvedCount > 0 && (
                  <View style={[rvStyles.badge, rvStyles.badgeResolved]}>
                    <Text style={[rvStyles.badgeTxt, { color: '#166534' }]}>{resolvedCount} resolved</Text>
                  </View>
                )}
              </View>
            )}

            {/* Comment list */}
            <ScrollView style={rvStyles.commentList} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {commentsLoading ? (
                <ActivityIndicator color={COLORS.navy} style={{ marginTop: 30 }} />
              ) : comments.length === 0 ? (
                <View style={rvStyles.emptyState}>
                  <Feather name="message-circle" size={32} color={COLORS.midGray} />
                  <Text style={rvStyles.emptyTxt}>No comments yet</Text>
                  <Text style={rvStyles.emptySub}>LYDO has not added any comments.</Text>
                </View>
              ) : (
                comments.map((c) => (
                  <View key={c.comment_id} style={[rvStyles.commentCard, c.is_resolved && rvStyles.commentCardResolved]}>
                    <View style={rvStyles.commentHeader}>
                      <View style={[rvStyles.avatar, c.is_resolved && rvStyles.avatarResolved]}>
                        <Text style={rvStyles.avatarTxt}>{getInitials(c.commenter)}</Text>
                      </View>
                      <View style={rvStyles.commentMeta}>
                        <Text style={rvStyles.commentAuthor}>{getFullName(c.commenter)}</Text>
                        <Text style={rvStyles.commentTime}>{formatTime(c.created_at)}</Text>
                      </View>
                      {c.is_resolved && (
                        <View style={rvStyles.resolvedTag}>
                          <Feather name="check-circle" size={11} color="#166534" />
                          <Text style={rvStyles.resolvedTagTxt}>Resolved</Text>
                        </View>
                      )}
                    </View>
                    <Text style={[rvStyles.commentBody, c.is_resolved && rvStyles.commentBodyResolved]}>{c.content}</Text>
                  </View>
                ))
              )}
              <View style={{ height: 16 }} />
            </ScrollView>
          </Animated.View>
        </View>

        {/* Bottom Bar */}
        <View style={rvStyles.bottomBar}>
          <TouchableOpacity style={rvStyles.commentBtn} onPress={openCommentPanel} activeOpacity={0.85}>
            <Feather name="message-square" size={15} color={COLORS.darkText} style={{ marginRight: 6 }} />
            <Text style={rvStyles.commentTxt}>View Comments</Text>
            {unresolvedCount > 0 && (
              <View style={rvStyles.commentBadge}>
                <Text style={rvStyles.commentBadgeTxt}>{unresolvedCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
};

const rvStyles = StyleSheet.create({
  safe:            { flex: 1, backgroundColor: COLORS.navy },
  topBar:          { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.navy, paddingHorizontal: 12, paddingVertical: 12, gap: 10 },
  backBtn:         { padding: 6, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.12)' },
  topMid:          { flex: 1 },
  topTitle:        { fontSize: 14, fontWeight: '700', color: COLORS.white },
  returnedBadge:   { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  returnedBadgeText: { fontSize: 10, color: '#E87A30', fontWeight: '600' },
  downloadBtn:     { padding: 6, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.12)' },
  centerState:     { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.offWhite, gap: 12 },
  loadingTxt:      { fontSize: 13, color: COLORS.subText },
  webLoadingOverlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.offWhite, gap: 12 },
  bottomBar:       { flexDirection: 'row', justifyContent: 'center', gap: 12, padding: 16, backgroundColor: COLORS.white, borderTopWidth: 1, borderTopColor: COLORS.lightGray },
  commentBtn:      { flexDirection: 'row', alignItems: 'center', backgroundColor: '#E0E0E0', borderRadius: 24, paddingHorizontal: 28, paddingVertical: 12, borderWidth: 1.5, borderColor: COLORS.midGray },
  commentTxt:      { fontSize: 14, fontWeight: '700', color: COLORS.darkText },
  commentBadge:    { marginLeft: 8, backgroundColor: '#E87A30', borderRadius: 10, paddingHorizontal: 6, paddingVertical: 1 },
  commentBadgeTxt: { fontSize: 10, fontWeight: '800', color: COLORS.white },
  panelScrim:      { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.25)', zIndex: 10 },
  commentPanel:    { position: 'absolute', top: 0, bottom: 0, right: 0, zIndex: 20, backgroundColor: COLORS.white, borderLeftWidth: 1, borderLeftColor: COLORS.lightGray, shadowColor: '#000', shadowOffset: { width: -4, height: 0 }, shadowOpacity: 0.15, shadowRadius: 12, elevation: 16, flexDirection: 'column' },
  panelTopBar:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingTop: 14, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: COLORS.lightGray, backgroundColor: COLORS.white },
  panelTitle:      { fontSize: 15, fontWeight: '800', color: COLORS.darkText },
  panelSub:        { fontSize: 10, color: COLORS.subText, marginTop: 1 },
  panelCloseBtn:   { width: 32, height: 32, borderRadius: 16, backgroundColor: COLORS.lightGray, alignItems: 'center', justifyContent: 'center' },
  panelBadgeRow:   { flexDirection: 'row', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: COLORS.lightGray },
  badge:           { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  badgeOpen:       { backgroundColor: '#FEF3C7' },
  badgeResolved:   { backgroundColor: '#DCFCE7' },
  badgeTxt:        { fontSize: 10, fontWeight: '700', color: '#92400E' },
  commentList:     { flex: 1, paddingHorizontal: 10, paddingTop: 10 },
  emptyState:      { alignItems: 'center', paddingTop: 32, gap: 8, paddingHorizontal: 16 },
  emptyTxt:        { fontSize: 13, fontWeight: '700', color: COLORS.midGray },
  emptySub:        { fontSize: 11, color: COLORS.midGray, textAlign: 'center', lineHeight: 16 },
  commentCard:         { backgroundColor: COLORS.white, borderRadius: 10, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: COLORS.lightGray, elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3 },
  commentCardResolved: { backgroundColor: '#F9FAFB', borderColor: '#E5E7EB', opacity: 0.8 },
  commentHeader:   { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8, gap: 8 },
  avatar:          { width: 32, height: 32, borderRadius: 16, backgroundColor: COLORS.navy, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  avatarResolved:  { backgroundColor: COLORS.midGray },
  avatarTxt:       { fontSize: 11, fontWeight: '800', color: COLORS.white },
  commentMeta:     { flex: 1 },
  commentAuthor:   { fontSize: 12, fontWeight: '700', color: COLORS.darkText },
  commentTime:     { fontSize: 10, color: COLORS.midGray, marginTop: 1 },
  resolvedTag:     { flexDirection: 'row', alignItems: 'center', gap: 3 },
  resolvedTagTxt:  { fontSize: 10, fontWeight: '700', color: '#166534' },
  commentBody:         { fontSize: 12, color: COLORS.darkText, lineHeight: 18 },
  commentBodyResolved: { color: COLORS.subText },
});

// ─── MAIN SCREEN ──────────────────────────────────────────────────────────────
export default function SKDocumentManagementScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { activeTab, setActiveTab } = useNav();
  const { logout, user } = useAuth();

  // Get user's barangay from auth context
  const barangayName = user?.barangay?.barangay_name || 'Unknown Barangay';
  const barangayId = user?.barangayId;

  // ── Shared notification bell (returned/approved docs, templates, deadlines) ──
  const notif = useNotificationCenter(barangayId);
  const notifCount = notif.count;

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

  const [activeDocTab, setActiveDocTab] = useState('Document Management');
  const [activeStatusTab, setActiveStatusTab] = useState(
    STATUS_TABS.includes(params?.initialTab) ? params.initialTab : 'All'
  );
  const [searchText, setSearchText]           = useState('');
  const [draftType, setDraftType]             = useState('All Types');
  const [sortBy, setSortBy]                   = useState('Newest');
  const [sidebarVisible, setSidebarVisible]   = useState(false);
  const [typeDropdownOpen, setTypeDropdownOpen] = useState(false);
  const [yearDropdownOpen, setYearDropdownOpen] = useState(false);
  const [sortDropdownOpen, setSortDropdownOpen] = useState(false);
  const [selectedYear, setSelectedYear] = useState('All Years');
  const [documents, setDocuments]             = useState([]);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [documentToDelete, setDocumentToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [forwardModalVisible, setForwardModalVisible] = useState(false);
  const [documentToForward, setDocumentToForward] = useState(null);
  const [forwarding, setForwarding] = useState(false);
  const [downloadModalVisible, setDownloadModalVisible] = useState(false);
  const [documentToDownload, setDocumentToDownload] = useState(null);
  const [alertModal, setAlertModal] = useState({ visible: false, type: 'success', title: '', message: '' });
  const [viewerModal, setViewerModal] = useState({ visible: false, fileUrl: null, title: '' });
  const [webViewLoading, setWebViewLoading] = useState(false);
  const [returnedViewerDoc, setReturnedViewerDoc] = useState(null);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [documentToEdit, setDocumentToEdit] = useState(null);
  const [editTitle, setEditTitle] = useState('');
  const [editLoading, setEditLoading] = useState(false);
  const [selectedEditFile, setSelectedEditFile] = useState(null);
  const [uploadingEditFile, setUploadingEditFile] = useState(false);

  const showAlert = (type, title, message) => {
    setAlertModal({ visible: true, type, title, message });
  };
  const hideAlert = () => setAlertModal(a => ({ ...a, visible: false }));

  // Reference tables for mapping IDs to names — fetched from database.
  const [documentCategories, setDocumentCategories] = useState([]);
  const [documentTypes, setDocumentTypes] = useState([]);
  const [folderYears, setFolderYears] = useState([]);

  // Build the DRAFT_TYPES list from fetched categories (with "All Types" sentinel first).
  const DRAFT_TYPES = useMemo(
    () => [DRAFT_ALL_LABEL, ...documentCategories.map(c => c.document_category)],
    [documentCategories]
  );

  // Fetch reference tables on mount
  useEffect(() => {
    const fetchReferenceData = async () => {
      try {
        // Fetch document categories
        const { data: categories, error: catError } = await supabase
          .from('document_category')
          .select('id, document_category, year')
          .order('document_category');

        if (!catError && categories) {
          setDocumentCategories(categories);
        }

        // Fetch document types
        const { data: types, error: typeError } = await supabase
          .from('document_types')
          .select('id, document_type, category, year')
          .order('document_type');

        if (!typeError && types) {
          setDocumentTypes(types);
        }

        // Fetch folder years
        const { data: years, error: yearError } = await supabase
          .from('folder_year')
          .select('id, fiscal_year')
          .order('fiscal_year', { ascending: false });

        if (!yearError && years) {
          setFolderYears(years);
        }
      } catch (error) {
        console.error('Error fetching reference data:', error);
      }
    };

    fetchReferenceData();
  }, []);

  const handleViewPress = (doc) => {
    if (!doc.fileUrl) {
      showAlert('error', 'No File', 'This document does not have an attached file.');
      return;
    }
    setViewerModal({ visible: true, fileUrl: doc.fileUrl, title: doc.title });
    setWebViewLoading(true);
  };

  // Fetch documents for this barangay - reusable function
  const fetchDocuments = useCallback(async () => {
    if (!barangayId) {
      console.log('No barangayId found, user:', user);
      return;
    }

    try {
      // Fetch documents with submitted_by
      const { data: docs, error } = await supabase
        .from('documents')
        .select('document_id, title, folder_category, document_type, status, year, created_at, submitted_by, file_url, saved_at')
        .eq('barangay_id', barangayId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching documents:', error);
        return;
      }

      // Get all user IDs to fetch
      const userIds = [...new Set((docs || []).map(d => d.submitted_by).filter(Boolean))];

      // Fetch users in one call
      let usersMap = {};
      if (userIds.length > 0) {
        const { data: users } = await supabase
          .from('users')
          .select('user_id, first_name, last_name')
          .in('user_id', userIds);

        usersMap = (users || []).reduce((acc, u) => {
          acc[u.user_id] = `${u.first_name} ${u.last_name}`;
          return acc;
        }, {});
      }

      // Fetch document versions for each document
      const formattedDocs = await Promise.all((docs || []).map(async doc => {
        // Get latest version
        const { data: versions } = await supabase
          .from('document_versions')
          .select('version_id, version_number, file_url, created_at')
          .eq('document_id', doc.document_id)
          .order('version_number', { ascending: false })
          .limit(1);

        // Prefer the latest version's file_url, fall back to the documents table file_url
        const resolvedFileUrl = versions?.[0]?.file_url || doc.file_url || null;

        // Get category and document type names from joined data
        const categoryName = documentCategories.find(c => String(c.id) === doc.folder_category)?.document_category || doc.folder_category || 'planning';
        const docTypeName = documentTypes.find(t => String(t.id) === doc.document_type)?.document_type || doc.document_type || 'Unknown';
        const yearValue = folderYears.find(y => String(y.id) === String(doc.year))?.fiscal_year || doc.year;

        return {
          id: doc.document_id,
          title: doc.title || 'Untitled',
          type: docTypeName,
          category: categoryName,
          status: doc.status || 'draft',
          year: yearValue,
          createdBy: usersMap[doc.submitted_by] || 'Unknown',
          lastModified: doc.saved_at || doc.created_at || new Date().toISOString(),
          fileUrl: resolvedFileUrl,
        };
      }));

      setDocuments(formattedDocs);
    } catch (error) {
      console.error('Error:', error);
    }
  }, [barangayId, supabase, user, documentCategories, documentTypes, folderYears]);

  // Auto-fetch on screen focus - always fetch fresh data
  useFocusEffect(
    useCallback(() => {
      fetchDocuments();
    }, [fetchDocuments])
  );

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

  const formatDate = (dateStr) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  // Handle delete confirmation
  const handleDeletePress = (doc) => {
    setDocumentToDelete(doc);
    setDeleteModalVisible(true);
  };

  const handleConfirmDelete = async () => {
    if (!documentToDelete) return;

    setDeleting(true);
    try {
      // Delete document versions first
      await supabase
        .from('document_versions')
        .delete()
        .eq('document_id', documentToDelete.id);

      // Delete the document
      const { error } = await supabase
        .from('documents')
        .delete()
        .eq('document_id', documentToDelete.id);

      if (error) {
        console.error('Error deleting document:', error);
        showAlert('error', 'Delete Failed', 'Failed to delete the document. Please try again.');
        setDeleting(false);
        return;
      }

      setDeleteModalVisible(false);
      setDocumentToDelete(null);

      // Refresh document list
      await fetchDocuments();
    } catch (error) {
      console.error('Error:', error);
      showAlert('error', 'Unexpected Error', 'An error occurred while deleting the document.');
    }
    setDeleting(false);
  };

  // Handle download button press - show modal
  const handleDownloadPress = (doc) => {
    setDocumentToDownload(doc);
    setDownloadModalVisible(true);
  };

  // Handle download confirm
  const handleDownloadConfirm = async () => {
    if (!documentToDownload?.fileUrl) {
      showAlert('error', 'No File', 'This document does not have an attached file.');
      return;
    }

    setDownloadModalVisible(false);
    setDocumentToDownload(null);
    try {
      await Linking.openURL(documentToDownload.fileUrl);
    } catch (error) {
      console.error('Download error:', error);
      showAlert('error', 'Download Failed', `Could not open the file: ${error.message}`);
    }
  };

  // Handle edit button press for returned documents
  const handleEditPress = (doc) => {
    setDocumentToEdit(doc);
    setEditTitle(doc.title);
    setSelectedEditFile(null);
    setEditModalVisible(true);
  };

  // Pick file for editing
  const pickEditFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
        copyToCacheDirectory: true,
      });

      if (result.canceled) {
        return;
      }

      setSelectedEditFile(result.assets[0]);
    } catch (error) {
      console.error('Error picking file:', error);
      showAlert('error', 'Error', 'Failed to select file. Please try again.');
    }
  };

  // Upload file to Supabase storage
  const uploadEditFile = async (file) => {
    if (!file) return null;

    try {
      const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const fileName = `${Date.now()}_${sanitizedName}`;

      const response = await fetch(file.uri);
      const blob = await response.blob();

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('documents')
        .upload(fileName, blob, {
          contentType: file.type || 'application/octet-stream',
        });

      if (uploadError) {
        console.error('Upload error:', uploadError);
        return null;
      }

      const { data: urlData } = supabase.storage
        .from('documents')
        .getPublicUrl(fileName);

      return urlData.publicUrl;
    } catch (error) {
      console.error('Error uploading file:', error);
      return null;
    }
  };

  // Handle confirm edit - update the document with new file and forward to LYDO
  const handleConfirmEdit = async () => {
    if (!documentToEdit) {
      showAlert('error', 'Error', 'No document selected.');
      return;
    }

    // Check if a new file is selected
    if (!selectedEditFile) {
      showAlert('error', 'Error', 'Please select a file to replace the current document.');
      return;
    }

    setEditLoading(true);
    try {
      // First, get the current file URL from the document to save as the returned version
      const { data: currentDoc } = await supabase
        .from('documents')
        .select('file_url, current_version')
        .eq('document_id', documentToEdit.id)
        .single();

      const currentFileUrl = currentDoc?.file_url;
      const currentVersion = currentDoc?.current_version || 1;

      // Upload the new file
      setUploadingEditFile(true);
      const newFileUrl = await uploadEditFile(selectedEditFile);

      if (!newFileUrl) {
        showAlert('error', 'Upload Failed', 'Failed to upload the file. Please try again.');
        setEditLoading(false);
        setUploadingEditFile(false);
        return;
      }
      setUploadingEditFile(false);

      // Get current max version number
      const { data: existingVersions } = await supabase
        .from('document_versions')
        .select('version_number')
        .eq('document_id', documentToEdit.id)
        .order('version_number', { ascending: false })
        .limit(1);

      const newVersionNumber = (existingVersions?.[0]?.version_number || 0) + 1;

      // If there's a current file URL, save it as a 'returned' version before replacing
      if (currentFileUrl) {
        const { error: returnedVersionError } = await supabase
          .from('document_versions')
          .insert({
            document_id: documentToEdit.id,
            version_number: currentVersion,
            file_url: currentFileUrl,
            action: 'returned',
            actioned_by: user.userId,
          });

        if (returnedVersionError) {
          console.error('Error saving returned version:', returnedVersionError);
          // Continue anyway - this is not critical
        }
      }

      // Create version record with action 'submitted' for the new file
      const { error: versionError } = await supabase
        .from('document_versions')
        .insert({
          document_id: documentToEdit.id,
          version_number: newVersionNumber,
          file_url: newFileUrl,
          action: 'submitted',
          actioned_by: user.userId,
        });

      if (versionError) {
        console.error('Error creating version:', versionError);
        showAlert('error', 'Edit Failed', 'Failed to save document version. Please try again.');
        setEditLoading(false);
        return;
      }

      // Update document with new file URL, increment version, and set status to submitted (forward to LYDO)
      const { error: updateError } = await supabase
        .from('documents')
        .update({
          file_url: newFileUrl,
          current_version: newVersionNumber,
          status: 'submitted',
          saved_at: new Date().toISOString(),
          submitted_at: new Date().toISOString(),
        })
        .eq('document_id', documentToEdit.id);

      if (updateError) {
        console.error('Error updating document:', updateError);
        showAlert('error', 'Edit Failed', 'Failed to update the document. Please try again.');
        setEditLoading(false);
        return;
      }

      setEditModalVisible(false);
      setDocumentToEdit(null);
      setEditTitle('');
      setSelectedEditFile(null);

      // Refresh documents
      await fetchDocuments();

      // Log the activity
      await logActivity('Save & Forward', `Saved and forwarded "${documentToEdit?.title}" to LYDO`);

      showAlert('success', 'Saved & Forwarded', 'The document has been saved and forwarded to LYDO.');
    } catch (error) {
      console.error('Error:', error);
      showAlert('error', 'Unexpected Error', 'An error occurred while editing the document.');
    }
    setEditLoading(false);
  };

  // Handle forward button press
  const handleForwardPress = (doc) => {
    console.log('Forward pressed for doc:', doc);
    setDocumentToForward(doc);
    setForwardModalVisible(true);
  };

  // Handle confirm forward to LYDO for consultation
  const handleConfirmForward = async () => {
    console.log('Forward confirm - user:', user);
    console.log('Document to forward:', documentToForward);

    if (!documentToForward || !user?.userId) {
      showAlert('error', 'Authentication Error', 'User not found. Please log in again.');
      return;
    }

    setForwarding(true);
    try {
      // Get current max version number
      const { data: existingVersions } = await supabase
        .from('document_versions')
        .select('version_number')
        .eq('document_id', documentToForward.id)
        .order('version_number', { ascending: false })
        .limit(1);

      const newVersionNumber = (existingVersions?.[0]?.version_number || 0) + 1;

      // Create version record with action 'submitted'
      const { error: versionError } = await supabase
        .from('document_versions')
        .insert({
          document_id: documentToForward.id,
          version_number: newVersionNumber,
          file_url: documentToForward.fileUrl || '',
          action: 'submitted',
          actioned_by: user.userId,
        });

      if (versionError) {
        console.error('Error creating version:', versionError);
        showAlert('error', 'Forward Failed', 'Failed to forward the document. Please try again.');
        setForwarding(false);
        return;
      }

      // Update document status to 'submitted' and set submitted_at
      const { error: updateError } = await supabase
        .from('documents')
        .update({
          status: 'submitted',
          submitted_at: new Date().toISOString(),
        })
        .eq('document_id', documentToForward.id);

      if (updateError) {
        console.error('Error updating document:', updateError);
        showAlert('error', 'Forward Failed', 'Failed to update the document status. Please try again.');
        setForwarding(false);
        return;
      }

      setForwardModalVisible(false);
      setDocumentToForward(null);

      // Refresh all documents to reflect the latest status
      await fetchDocuments();

      // Log the activity
      await logActivity('Submit to LYDO', `Submitted "${documentToForward?.title}" to LYDO for consultation`);

      showAlert('success', 'Document Forwarded', 'The document has been successfully forwarded to LYDO for consultation.');
    } catch (error) {
      console.error('Error:', error);
      showAlert('error', 'Unexpected Error', 'An error occurred while forwarding the document.');
    }
    setForwarding(false);
  };

  // Filtered + sorted documents
  const visibleDocs = useMemo(() => {
    // Filter by status tab (draft, saved, submitted, approved)
    const statusMap = { 'All': null, 'Drafts': 'draft', 'Saved': 'saved', 'Submitted': 'submitted', 'Approved': 'approved', 'Returned': 'returned' };
    const statusFilter = statusMap[activeStatusTab];
    let docs = statusFilter !== null && statusFilter ? documents.filter(d => d.status === statusFilter) : documents;

    // Filter by folder category
    if (draftType !== 'All Types') {
      const categoryMap = {
        'Planning': 'planning',
        'Financial': 'financial',
        'Governance': 'governance',
        'Performance': 'performance',
      };
      docs = docs.filter(d => d.category === categoryMap[draftType]);
    }

    // Filter by year
    if (selectedYear !== 'All Years') {
      docs = docs.filter(d => String(d.year) === String(selectedYear));
    }

    // Filter by search
    if (searchText) {
      const q = searchText.toLowerCase();
      docs = docs.filter(d =>
        d.title.toLowerCase().includes(q) ||
        d.type?.toLowerCase().includes(q) ||
        d.createdBy?.toLowerCase().includes(q)
      );
    }

    // Sort
    switch (sortBy) {
      case 'Newest':    return [...docs].sort((a, b) => new Date(b.lastModified) - new Date(a.lastModified));
      case 'Oldest':    return [...docs].sort((a, b) => new Date(a.lastModified) - new Date(b.lastModified));
      case 'Title A-Z': return [...docs].sort((a, b) => a.title.localeCompare(b.title));
      case 'Title Z-A': return [...docs].sort((a, b) => b.title.localeCompare(a.title));
      default:          return docs;
    }
  }, [activeStatusTab, draftType, selectedYear, searchText, sortBy, documents]);

  // ── Sidebar ──
  const handleLogout = () => { logout(); router.replace('/'); };

  const renderSidebar = () => (
    <Sidebar
      activeTab={activeTab}
      onNavPress={handleNavPress}
      onLogout={handleLogout}
      isMobile={isMobile}
      sidebarVisible={sidebarVisible}
    />
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
          <Text style={styles.mobileTitle}>Document Management</Text>
          <TouchableOpacity style={styles.bellBtn} onPress={notif.open} activeOpacity={0.7}>
            <BellIcon count={notifCount} />
          </TouchableOpacity>
        </View>
      )}

      {/* Desktop Header */}
      {!isMobile && (
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerSub}>SANGGUNIANG KABATAAN</Text>
            <Text style={styles.headerTitle}>{barangayName.toUpperCase()}</Text>
          </View>
          <View style={styles.headerRight}>
            <TouchableOpacity style={styles.bellBtn} onPress={notif.open} activeOpacity={0.7}>
              <BellIcon count={notifCount} />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Search Bar */}
      <View style={styles.searchRow}>
        <View style={styles.searchBox}>
          <Text style={styles.searchIcon}>🔍</Text>
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

      {/* Folder / Document Management Tab Bar */}
      <View style={styles.filterRow}>
        {/* Folder / Document Management tab bar */}
        <View style={styles.docTabBar}>
          {DOCUMENT_TABS.map(tab => {
            const active = activeDocTab === tab;
            return (
              <TouchableOpacity
                key={tab}
                style={[styles.docTab, active && styles.docTabActive]}
                onPress={() => {
                  if (tab === 'Folder') {
                    router.push({ pathname: '/(tabs)/sk-document' });
                  }
                }}
                activeOpacity={0.8}
              >
                <Text style={[styles.docTabText, active && styles.docTabTextActive]}>
                  {tab}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Draft Type + Sorted By Row */}
      <View style={styles.controlsRow}>
        {/* Draft Type Dropdown */}
        <View style={styles.dropdownWrap}>
          <TouchableOpacity
            style={styles.dropdownBtn}
            onPress={() => { setTypeDropdownOpen(v => !v); setSortDropdownOpen(false); setYearDropdownOpen(false); }}
            activeOpacity={0.8}
          >
            <Text style={styles.dropdownBtnText}>{draftType}</Text>
            <Text style={styles.dropdownArrow}>{typeDropdownOpen ? '▲' : '▼'}</Text>
          </TouchableOpacity>
          {typeDropdownOpen && (
            <View style={styles.dropdownMenu}>
              {DRAFT_TYPES.map(opt => (
                <TouchableOpacity
                  key={opt}
                  style={[styles.dropdownItem, draftType === opt && styles.dropdownItemActive]}
                  onPress={() => { setDraftType(opt); setTypeDropdownOpen(false); }}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.dropdownItemText, draftType === opt && styles.dropdownItemTextActive]}>
                    {opt}
                  </Text>
                  {draftType === opt && <Text style={styles.dropdownCheck}>✓</Text>}
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* Year Dropdown */}
        <View style={styles.dropdownWrap}>
          <TouchableOpacity
            style={styles.dropdownBtn}
            onPress={() => { setYearDropdownOpen(v => !v); setTypeDropdownOpen(false); setSortDropdownOpen(false); }}
            activeOpacity={0.8}
          >
            <Text style={styles.dropdownBtnText}>{selectedYear}</Text>
            <Text style={styles.dropdownArrow}>{yearDropdownOpen ? '▲' : '▼'}</Text>
          </TouchableOpacity>
          {yearDropdownOpen && (
            <View style={styles.dropdownMenu}>
              {['All Years', ...Array.from({ length: 6 }, (_, i) => String(new Date().getFullYear() - i))].map(opt => (
                <TouchableOpacity
                  key={opt}
                  style={[styles.dropdownItem, selectedYear === opt && styles.dropdownItemActive]}
                  onPress={() => { setSelectedYear(opt); setYearDropdownOpen(false); }}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.dropdownItemText, selectedYear === opt && styles.dropdownItemTextActive]}>
                    {opt}
                  </Text>
                  {selectedYear === opt && <Text style={styles.dropdownCheck}>✓</Text>}
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* Sorted By Dropdown */}
        <View style={styles.dropdownWrap}>
          <TouchableOpacity
            style={styles.dropdownBtn}
            onPress={() => { setSortDropdownOpen(v => !v); setTypeDropdownOpen(false); setYearDropdownOpen(false); }}
            activeOpacity={0.8}
          >
            <Text style={styles.dropdownBtnLabel}>Sorted By  </Text>
            <Text style={styles.dropdownBtnText}>{sortBy}</Text>
            <Text style={styles.dropdownArrow}>{sortDropdownOpen ? '▲' : '▼'}</Text>
          </TouchableOpacity>
          {sortDropdownOpen && (
            <View style={[styles.dropdownMenu, { right: 0, left: 'auto' }]}>
              {SORT_OPTIONS.map(opt => (
                <TouchableOpacity
                  key={opt}
                  style={[styles.dropdownItem, sortBy === opt && styles.dropdownItemActive]}
                  onPress={() => { setSortBy(opt); setSortDropdownOpen(false); }}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.dropdownItemText, sortBy === opt && styles.dropdownItemTextActive]}>
                    {opt}
                  </Text>
                  {sortBy === opt && <Text style={styles.dropdownCheck}>✓</Text>}
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      </View>

      {/* Status Sub-Tabs (Drafts / Saved / Submitted / Approved) */}
      <View style={styles.statusTabsRow}>
        {STATUS_TABS.map(tab => {
          const active = activeStatusTab === tab;
          const statusMap = { 'Drafts': 'draft', 'Saved': 'saved', 'Submitted': 'submitted', 'Approved': 'approved', 'Returned': 'returned' };
          const statusFilter = statusMap[tab];
          const count = statusFilter ? documents.filter(d => d.status === statusFilter).length : documents.length;
          return (
            <TouchableOpacity
              key={tab}
              style={[styles.statusTab, active && styles.statusTabActive]}
              onPress={() => setActiveStatusTab(tab)}
              activeOpacity={0.8}
            >
              <Text style={[styles.statusTabText, active && styles.statusTabTextActive]}>
                {tab}
              </Text>
              {active && (
                <View style={styles.statusTabBadge}>
                  <Text style={styles.statusTabBadgeText}>{count}</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Document Table */}
      <View style={styles.tableContainer}>
        {/* Table Header */}
        <View style={styles.tableHeader}>
          <Text style={[styles.tableHeaderText, { flex: isMobile ? 2 : 3 }]}>Document Title</Text>
          {!isMobile && <Text style={[styles.tableHeaderText, { flex: 1.2, textAlign: 'center' }]}>Type</Text>}
          {!isMobile && <Text style={[styles.tableHeaderText, { flex: 1.5, textAlign: 'center' }]}>Created By</Text>}
          <Text style={[styles.tableHeaderText, { flex: isMobile ? 1 : 1.5, textAlign: 'center' }]}>Last Modified</Text>
          <Text style={[styles.tableHeaderText, { flex: 1, textAlign: 'center' }]}>Action</Text>
        </View>

        {/* Table Rows */}
        {visibleDocs.length > 0 ? (
          visibleDocs.map((doc, idx) => (
            <View
              key={doc.id}
              style={[styles.tableRow, idx % 2 === 1 && styles.tableRowAlt]}
            >
              {/* Title */}
              <View style={{ flex: isMobile ? 2 : 3, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                {doc.fileUrl && doc.status === 'draft' && (
                  <Text style={{ fontSize: 12 }}>📎</Text>
                )}
                <Text
                  style={styles.docTitle}
                  numberOfLines={isMobile ? 2 : 1}
                >
                  {doc.title}
                </Text>
              </View>

              {/* Type badge (desktop only) */}
              {!isMobile && (
                <View style={{ flex: 1.2, alignItems: 'center' }}>
                  <TypeBadge type={doc.type} />
                </View>
              )}

              {/* Created By (desktop only) */}
              {!isMobile && (
                <Text style={[styles.docMeta, { flex: 1.5, textAlign: 'center' }]}>
                  {doc.createdBy}
                </Text>
              )}

              {/* Last Modified */}
              <Text style={[styles.docMeta, { flex: isMobile ? 1 : 1.5, textAlign: 'center' }]}>
                {formatDate(doc.lastModified)}
              </Text>

              {/* Actions */}
              <View style={[styles.actionRow, { flex: 1 }]}>
                {doc.status === 'saved' || doc.status === 'draft' ? (
                  <>
                    <TouchableOpacity activeOpacity={0.7} onPress={() => handleForwardPress(doc)}>
                      <ForwardIcon />
                    </TouchableOpacity>
                    <TouchableOpacity activeOpacity={0.7} onPress={() => handleDownloadPress(doc)}>
                      <SaveIcon />
                    </TouchableOpacity>
                    <TouchableOpacity activeOpacity={0.7} onPress={() => handleViewPress(doc)}>
                      <ViewIcon />
                    </TouchableOpacity>
                  </>
                ) : doc.status === 'submitted' ? (
                  <TouchableOpacity activeOpacity={0.7} onPress={() => handleViewPress(doc)}>
                    <ViewIcon />
                  </TouchableOpacity>
                ) : doc.status === 'returned' ? (
                  <>
                    <TouchableOpacity activeOpacity={0.7} onPress={() => handleEditPress(doc)}>
                      <EditIcon />
                    </TouchableOpacity>
                    <TouchableOpacity activeOpacity={0.7} onPress={() => setReturnedViewerDoc(doc)}>
                      <ViewIcon />
                    </TouchableOpacity>
                  </>
                ) : doc.status === 'approved' ? (
                  <>
                    <TouchableOpacity activeOpacity={0.7} onPress={() => handleDownloadPress(doc)}>
                      <SaveIcon />
                    </TouchableOpacity>
                    <TouchableOpacity activeOpacity={0.7} onPress={() => handleViewPress(doc)}>
                      <ViewIcon />
                    </TouchableOpacity>
                  </>
                ) : (
                  <>
                    <TouchableOpacity activeOpacity={0.7} onPress={() => {}}>
                      <EditIcon />
                    </TouchableOpacity>
                    <TouchableOpacity activeOpacity={0.7} onPress={() => handleDeletePress(doc)}>
                      <DeleteIcon />
                    </TouchableOpacity>
                    <TouchableOpacity activeOpacity={0.7} onPress={() => handleViewPress(doc)}>
                      <ViewIcon />
                    </TouchableOpacity>
                  </>
                )}
              </View>
            </View>
          ))
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>📄</Text>
            <Text style={styles.emptyText}>No documents found.</Text>
            <Text style={styles.emptySubText}>Try adjusting your filters or search term.</Text>
          </View>
        )}
      </View>
    </ScrollView>
  );

  return (
    <>
      <Head>
        <title>Document Management · SK Monitoring</title>
      </Head>
      <SafeAreaView style={styles.safe}>
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
        {renderSidebar()}
        {renderContent()}

        {/* ── Delete Confirmation Modal ── */}
        <Modal
          visible={deleteModalVisible}
          animationType="fade"
          transparent={true}
          onRequestClose={() => setDeleteModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              {/* Icon accent strip */}
              <View style={styles.modalIconStrip}>
                <View style={[styles.modalIconCircle, { backgroundColor: '#FEE2E2' }]}>
                  <Feather name="trash-2" size={28} color={COLORS.red} />
                </View>
              </View>
              <View style={styles.modalBody}>
                <Text style={styles.modalTitle}>Delete Document</Text>
                <Text style={styles.modalBodyText}>
                  You are about to permanently delete{' '}
                  <Text style={styles.modalHighlight}>"{documentToDelete?.title}"</Text>.
                  {'\n\n'}This action cannot be undone.
                </Text>
              </View>
              <View style={styles.modalDivider} />
              <View style={styles.modalFooter}>
                <TouchableOpacity
                  style={styles.modalCancelBtn}
                  onPress={() => setDeleteModalVisible(false)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.modalCancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalActionBtn, styles.modalDeleteBtn, deleting && styles.modalBtnDisabled]}
                  onPress={handleConfirmDelete}
                  disabled={deleting}
                  activeOpacity={0.8}
                >
                  {deleting ? (
                    <Text style={styles.modalActionBtnText}>Deleting…</Text>
                  ) : (
                    <>
                      <Feather name="trash-2" size={14} color={COLORS.white} style={{ marginRight: 6 }} />
                      <Text style={styles.modalActionBtnText}>Delete</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* ── Forward Confirmation Modal ── */}
        <Modal
          visible={forwardModalVisible}
          animationType="fade"
          transparent={true}
          onRequestClose={() => setForwardModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalIconStrip}>
                <View style={[styles.modalIconCircle, { backgroundColor: '#DBEAFE' }]}>
                  <Feather name="send" size={26} color={COLORS.blue} />
                </View>
              </View>
              <View style={styles.modalBody}>
                <Text style={styles.modalTitle}>Forward to LYDO</Text>
                <Text style={styles.modalBodyText}>
                  You are about to submit{' '}
                  <Text style={styles.modalHighlight}>"{documentToForward?.title}"</Text>
                  {' '}to LYDO for consultation.
                  {'\n\n'}The document status will change to{' '}
                  <Text style={[styles.modalHighlight, { color: COLORS.blue }]}>Submitted</Text>.
                </Text>
              </View>
              <View style={styles.modalDivider} />
              <View style={styles.modalFooter}>
                <TouchableOpacity
                  style={styles.modalCancelBtn}
                  onPress={() => setForwardModalVisible(false)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.modalCancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalActionBtn, styles.modalForwardBtn, forwarding && styles.modalBtnDisabled]}
                  onPress={handleConfirmForward}
                  disabled={forwarding}
                  activeOpacity={0.8}
                >
                  {forwarding ? (
                    <Text style={styles.modalActionBtnText}>Forwarding…</Text>
                  ) : (
                    <>
                      <Feather name="send" size={14} color={COLORS.white} style={{ marginRight: 6 }} />
                      <Text style={styles.modalActionBtnText}>Forward</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* ── Download Confirmation Modal ── */}
        <Modal
          visible={downloadModalVisible}
          animationType="fade"
          transparent={true}
          onRequestClose={() => { setDownloadModalVisible(false); setDocumentToDownload(null); }}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalIconStrip}>
                <View style={[styles.modalIconCircle, { backgroundColor: '#DBEAFE' }]}>
                  <Feather name="download" size={26} color={COLORS.blue} />
                </View>
              </View>
              <View style={styles.modalBody}>
                <Text style={styles.modalTitle}>Download Document</Text>
                <Text style={styles.modalBodyText}>
                  Do you want to download{' '}
                  <Text style={styles.modalHighlight}>"{documentToDownload?.title}"</Text>?
   
                </Text>
              </View>
              <View style={styles.modalDivider} />
              <View style={styles.modalFooter}>
                <TouchableOpacity
                  style={styles.modalCancelBtn}
                  onPress={() => { setDownloadModalVisible(false); setDocumentToDownload(null); }}
                  activeOpacity={0.8}
                >
                  <Text style={styles.modalCancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalActionBtn, { backgroundColor: COLORS.blue }]}
                  onPress={handleDownloadConfirm}
                  activeOpacity={0.8}
                >
                  <Feather name="download" size={14} color={COLORS.white} style={{ marginRight: 6 }} />
                  <Text style={styles.modalActionBtnText}>Download</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* ── Alert / Feedback Modal ── */}
        {/* ── Document Viewer Modal ── */}
        <Modal
          visible={viewerModal.visible}
          animationType="slide"
          transparent={false}
          onRequestClose={() => setViewerModal({ visible: false, fileUrl: null, title: '' })}
        >
          <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.navy }}>
            {/* Viewer Header */}
            <View style={styles.viewerHeader}>
              <TouchableOpacity
                style={styles.viewerBackBtn}
                onPress={() => setViewerModal({ visible: false, fileUrl: null, title: '' })}
                activeOpacity={0.8}
              >
                <Feather name="arrow-left" size={20} color={COLORS.white} />
              </TouchableOpacity>
              <Text style={styles.viewerTitle} numberOfLines={1}>
                {viewerModal.title}
              </Text>
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

            {/* WebView / iframe */}
            <View style={{ flex: 1, backgroundColor: COLORS.offWhite, overflow: 'hidden' }}>
              {viewerModal.fileUrl && (
                Platform.OS === 'web' ? (
                  <iframe
                    src={`https://docs.google.com/gview?embedded=true&url=${encodeURIComponent(viewerModal.fileUrl)}`}
                    style={{ flex: 1, width: '100%', height: '100%', border: 'none' }}
                    title={viewerModal.title}
                  />
                ) : (
                  <WebView
                    source={{
                      uri: `https://docs.google.com/gview?embedded=true&url=${encodeURIComponent(viewerModal.fileUrl)}`,
                    }}
                    style={{ flex: 1 }}
                    onLoadStart={() => setWebViewLoading(true)}
                    onLoadEnd={() => setWebViewLoading(false)}
                    onError={() => {
                      setWebViewLoading(false);
                      showAlert('error', 'Load Failed', 'Could not load the document. Try opening it externally.');
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
                )
              )}
            </View>
          </SafeAreaView>
        </Modal>

        {/* ── Alert / Feedback Modal ── */}
        <Modal
          visible={alertModal.visible}
          animationType="fade"
          transparent={true}
          onRequestClose={hideAlert}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, styles.alertModalContent]}>
              <View style={styles.modalIconStrip}>
                <View style={[styles.modalIconCircle, {
                  backgroundColor:
                    alertModal.type === 'success' ? '#D1FAE5' :
                    alertModal.type === 'error'   ? '#FEE2E2' :
                    alertModal.type === 'info'    ? '#DBEAFE' : '#FEF9C3',
                }]}>
                  <Feather
                    name={
                      alertModal.type === 'success' ? 'check-circle' :
                      alertModal.type === 'error'   ? 'alert-circle' :
                      alertModal.type === 'info'    ? 'download' : 'info'
                    }
                    size={28}
                    color={
                      alertModal.type === 'success' ? '#059669' :
                      alertModal.type === 'error'   ? COLORS.red :
                      alertModal.type === 'info'    ? COLORS.blue : '#B45309'
                    }
                  />
                </View>
              </View>
              <View style={styles.modalBody}>
                <Text style={styles.modalTitle}>{alertModal.title}</Text>
                <Text style={styles.modalBodyText}>{alertModal.message}</Text>
              </View>
              <View style={styles.modalDivider} />
              <View style={[styles.modalFooter, { justifyContent: 'center' }]}>
                <TouchableOpacity
                  style={[styles.modalActionBtn, {
                    backgroundColor:
                      alertModal.type === 'success' ? '#059669' :
                      alertModal.type === 'error'   ? COLORS.red :
                      alertModal.type === 'info'    ? COLORS.blue : '#B45309',
                    flex: 0, paddingHorizontal: 36,
                  }]}
                  onPress={hideAlert}
                  activeOpacity={0.8}
                >
                  <Text style={styles.modalActionBtnText}>OK</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </View>

      {/* ── Edit Returned Document Modal ── */}
      <Modal
        visible={editModalVisible}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setEditModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalIconStrip}>
              <View style={[styles.modalIconCircle, { backgroundColor: '#DBEAFE' }]}>
                <Feather name="send" size={28} color={COLORS.blue} />
              </View>
            </View>
            <View style={styles.modalBody}>
              <Text style={styles.modalTitle}>Save & Forward to LYDO</Text>
              <Text style={styles.modalBodyText}>
                Replace the returned file and forward to LYDO.{'\n'}Select a new file to replace the current one.
              </Text>

              {/* Document Title (Read-only) */}
              <View style={styles.editInputContainer}>
                <Text style={styles.editInputLabel}>Document Title:</Text>
                <View style={styles.editTitleDisplay}>
                  <Text style={styles.editTitleText}>{documentToEdit?.title}</Text>
                </View>
              </View>

              {/* Current File */}
              <View style={styles.editInputContainer}>
                <Text style={styles.editInputLabel}>Current File:</Text>
                <View style={styles.editFileDisplay}>
                  <Feather name="file-text" size={16} color={COLORS.subText} />
                  <Text style={styles.editFileName} numberOfLines={1}>
                    {documentToEdit?.fileUrl ? documentToEdit.fileUrl.split('/').pop() : 'No file'}
                  </Text>
                </View>
              </View>

              {/* New File Selection */}
              <View style={styles.editInputContainer}>
                <Text style={styles.editInputLabel}>Replace with new file:</Text>
                <TouchableOpacity
                  style={styles.editFilePickerBtn}
                  onPress={pickEditFile}
                  activeOpacity={0.8}
                >
                  <Feather name="upload-cloud" size={18} color={COLORS.navy} />
                  <Text style={styles.editFilePickerText}>
                    {selectedEditFile ? selectedEditFile.name : 'Choose File (PDF, Word)'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
            <View style={styles.modalDivider} />
            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => { setEditModalVisible(false); setDocumentToEdit(null); setSelectedEditFile(null); }}
                activeOpacity={0.8}
              >
                <Text style={styles.modalCancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modalActionBtn,
                  { backgroundColor: COLORS.blue },
                  (editLoading || !selectedEditFile) && styles.modalBtnDisabled
                ]}
                onPress={handleConfirmEdit}
                disabled={editLoading || !selectedEditFile}
                activeOpacity={0.8}
              >
                {editLoading ? (
                  <Text style={styles.modalActionBtnText}>
                    {uploadingEditFile ? 'Uploading...' : 'Saving...'}
                  </Text>
                ) : (
                  <>
                    <Feather name="send" size={14} color={COLORS.white} style={{ marginRight: 6 }} />
                    <Text style={styles.modalActionBtnText}>Save & Forward</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Returned Document Viewer (with LYDO comment panel) ── */}
      {returnedViewerDoc && (
        <ReturnedDocumentViewer
          doc={returnedViewerDoc}
          onClose={() => setReturnedViewerDoc(null)}
        />
      )}

    </SafeAreaView>
    </>
  );
}

// ─── STYLES ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: COLORS.navy },
  layout: { flex: 1, flexDirection: 'row' },

  // ── Sidebar now rendered by the shared Sidebar module ──
  sidebarOverlay: {
    position: 'absolute', left: 0, top: 0, bottom: 0, right: 0,
    backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 15,
  },

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
  menuBtn:           { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.cardBg, alignItems: 'center', justifyContent: 'center' },
  menuIconContainer: { width: 20, height: 16, justifyContent: 'space-between' },
  menuLine:          { width: 20, height: 2, backgroundColor: COLORS.navy, borderRadius: 1 },
  mobileTitle:       { fontSize: 18, fontWeight: '800', color: COLORS.darkText },

  // Desktop header
  header: {
    flexDirection: 'row', alignItems: 'flex-start',
    justifyContent: 'space-between', marginBottom: 12,
  },
  headerSub:   { fontSize: 10, fontWeight: '600', color: COLORS.subText, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 2 },
  headerTitle: {
    fontSize: 22, fontWeight: '900', color: COLORS.darkText, letterSpacing: 0.3,
    borderBottomWidth: 2, borderBottomColor: COLORS.lightGray, paddingBottom: 4, marginBottom: 6,
  },
  headerRight: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },

  // Bell — unread-count badge lives in BellIcon (notificationCenter.js);
  // only the button container is styled here.
  bellBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: COLORS.cardBg, alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08, shadowRadius: 6, elevation: 3,
  },


  // ── DOCUMENT TAB BAR (4 tabs only) ──
  docTabBar: {
    flex: 1, flexDirection: 'row', borderRadius: 4, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.28, shadowRadius: 3, elevation: 6,
    height: 38,
  },
  docTab: {
    flex: 1, paddingHorizontal: isMobile ? 4 : 10,
    backgroundColor: COLORS.navy, borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center',
  },
  docTabActive: {
    backgroundColor: COLORS.gold, borderColor: COLORS.gold,
    shadowColor: COLORS.gold, shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4, shadowRadius: 4, elevation: 3,
  },
  docTabText: {
    fontSize: isMobile ? 9 : 12, fontWeight: '600',
    color: COLORS.white, textAlign: 'center',
  },
  docTabTextActive: { color: COLORS.darkText, fontWeight: '800' },

  // Search
  searchRow: { marginBottom: 10 },

  // Category label
  categoryRow:   { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  categoryLabel: { fontSize: 12, fontWeight: '700', color: COLORS.darkText },

  // Filter Row
  filterRow: {
    flexDirection: 'row', alignItems: 'flex-start', marginBottom: 16, gap: 6,
    zIndex: 10,
  },
  searchBox: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.white, borderRadius: 20,
    borderWidth: 1, borderColor: COLORS.lightGray,
    paddingHorizontal: 12, paddingVertical: 7,
    maxWidth: isMobile ? '100%' : 320,
  },
  searchIcon:  { fontSize: 12, color: COLORS.midGray, marginRight: 4 },
  searchInput: { flex: 1, fontSize: 12, color: COLORS.darkText },

  // ── Controls Row (Draft Type + Sorted By) ──
  controlsRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    marginBottom: 14, zIndex: 20,
  },
  dropdownWrap: { position: 'relative' },
  dropdownBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: COLORS.white, borderRadius: 6,
    borderWidth: 1, borderColor: COLORS.lightGray,
    paddingHorizontal: 12, paddingVertical: 8,
    minWidth: isMobile ? 120 : 150,
  },
  dropdownBtnLabel: { fontSize: 11, color: COLORS.subText },
  dropdownBtnText:  { flex: 1, fontSize: 12, fontWeight: '600', color: COLORS.darkText },
  dropdownArrow:    { fontSize: 8, color: COLORS.subText },
  dropdownMenu: {
    position: 'absolute', top: 42, left: 0, zIndex: 99,
    backgroundColor: COLORS.white, borderRadius: 8, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15, shadowRadius: 8, elevation: 10,
    minWidth: 160, borderWidth: 1, borderColor: COLORS.lightGray,
  },
  dropdownItem: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 10, paddingHorizontal: 14,
    borderBottomWidth: 1, borderBottomColor: COLORS.lightGray,
  },
  dropdownItemActive:     { backgroundColor: '#EEF3FB' },
  dropdownItemText:       { fontSize: 12, fontWeight: '600', color: COLORS.darkText },
  dropdownItemTextActive: { color: COLORS.navy, fontWeight: '800' },
  dropdownCheck:          { fontSize: 12, color: COLORS.navy, fontWeight: '800' },

  // ── Status Sub-Tabs ──
  statusTabsRow: {
    flexDirection: 'row', marginBottom: 12,
    borderBottomWidth: 1.5, borderBottomColor: COLORS.lightGray,
  },
  statusTab: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingVertical: 10, paddingHorizontal: isMobile ? 10 : 16,
    marginBottom: -1.5,
  },
  statusTabActive: {
    borderBottomWidth: 2.5, borderBottomColor: COLORS.navy,
  },
  statusTabText:       { fontSize: isMobile ? 11 : 13, fontWeight: '600', color: COLORS.midGray },
  statusTabTextActive: { color: COLORS.navy, fontWeight: '800' },
  statusTabBadge: {
    backgroundColor: COLORS.navy, borderRadius: 10,
    paddingHorizontal: 6, paddingVertical: 1,
    minWidth: 18, alignItems: 'center',
  },
  statusTabBadgeText: { fontSize: 9, fontWeight: '900', color: COLORS.white },

  // ── Table ──
  tableContainer: {
    backgroundColor: COLORS.white, borderRadius: 12,
    borderWidth: 1.5, borderColor: COLORS.navy + '33',
    overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07, shadowRadius: 8, elevation: 3,
  },
  tableHeader: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 12, paddingHorizontal: 14,
    backgroundColor: COLORS.offWhite,
    borderBottomWidth: 1.5, borderBottomColor: COLORS.lightGray,
  },
  tableHeaderText: { fontSize: isMobile ? 10 : 12, fontWeight: '800', color: COLORS.darkText },
  tableRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 11, paddingHorizontal: 14,
    borderBottomWidth: 1, borderBottomColor: COLORS.lightGray,
  },
  tableRowAlt: { backgroundColor: '#F5F8FC' },

  docTitle: {
    fontSize: isMobile ? 11 : 12, fontWeight: '600', color: COLORS.darkText,
    paddingRight: 6,
  },
  docMeta: { fontSize: isMobile ? 10 : 11, color: COLORS.subText },

  // Type badge
  typeBadge: {
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12,
  },
  typeBadgeText: { fontSize: 10, fontWeight: '700' },

  // Actions
  actionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: isMobile ? 2 : 4 },
  actionIconWrap: { padding: 4 },
  actionIconText: { fontSize: isMobile ? 14 : 16 },

  // Empty state
  emptyState:   { alignItems: 'center', paddingVertical: 60 },
  emptyIcon:    { fontSize: 36, marginBottom: 10 },
  emptyText:    { fontSize: 14, fontWeight: '700', color: COLORS.darkText, marginBottom: 4 },
  emptySubText: { fontSize: 12, color: COLORS.midGray },

  // ── Modals ──
  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(10,20,40,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '88%', maxWidth: 380,
    backgroundColor: COLORS.white,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 20,
  },
  alertModalContent: {
    maxWidth: 340,
  },
  // Icon strip at top of modal
  modalIconStrip: {
    alignItems: 'center',
    paddingTop: 28,
    paddingBottom: 4,
    backgroundColor: COLORS.white,
  },
  modalIconCircle: {
    width: 64, height: 64, borderRadius: 32,
    alignItems: 'center', justifyContent: 'center',
  },
  // Body
  modalBody: {
    paddingHorizontal: 24, paddingTop: 14, paddingBottom: 20, alignItems: 'center',
  },
  modalTitle: {
    fontSize: 17, fontWeight: '800', color: COLORS.darkText,
    textAlign: 'center', marginBottom: 10, letterSpacing: 0.2,
  },
  modalBodyText: {
    fontSize: 13.5, color: COLORS.subText, lineHeight: 20,
    textAlign: 'center',
  },
  modalHighlight: {
    fontWeight: '700', color: COLORS.darkText,
  },
  modalDivider: {
    height: 1, backgroundColor: COLORS.lightGray, marginHorizontal: 0,
  },
  // Footer
  modalFooter: {
    flexDirection: 'row', gap: 10,
    paddingHorizontal: 20, paddingVertical: 16,
    backgroundColor: COLORS.offWhite,
  },
  modalCancelBtn: {
    flex: 1, paddingVertical: 13, borderRadius: 10,
    borderWidth: 1.5, borderColor: COLORS.lightGray,
    alignItems: 'center', backgroundColor: COLORS.white,
  },
  modalCancelBtnText: {
    fontSize: 14, fontWeight: '700', color: COLORS.subText,
  },
  // Generic action button
  modalActionBtn: {
    flex: 1, flexDirection: 'row', paddingVertical: 13, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  modalActionBtnText: {
    fontSize: 14, fontWeight: '700', color: COLORS.white,
  },
  modalDeleteBtn: {
    backgroundColor: COLORS.red,
  },
  modalForwardBtn: {
    backgroundColor: COLORS.blue,
  },
  modalBtnDisabled: {
    opacity: 0.55,
  },

  // ── Document Viewer ──
  viewerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.navy,
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 10,
  },
  viewerBackBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  viewerTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.white,
  },
  viewerOpenBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  viewerLoading: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.offWhite,
    gap: 12,
  },
  viewerLoadingText: {
    fontSize: 13,
    color: COLORS.subText,
  },

  // Edit Input
  editInputContainer: {
    width: '100%',
    marginTop: 16,
  },
  editInputLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.darkText,
    marginBottom: 6,
  },
  editInput: {
    width: '100%',
    backgroundColor: COLORS.offWhite,
    borderWidth: 1,
    borderColor: COLORS.lightGray,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: COLORS.darkText,
    minHeight: 48,
  },
  editTitleDisplay: {
    width: '100%',
    backgroundColor: COLORS.lightGray,
    borderWidth: 1,
    borderColor: COLORS.lightGray,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 48,
    justifyContent: 'center',
  },
  editTitleText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.darkText,
  },
  editFileDisplay: {
    width: '100%',
    backgroundColor: COLORS.lightGray,
    borderWidth: 1,
    borderColor: COLORS.lightGray,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  editFileName: {
    flex: 1,
    fontSize: 13,
    color: COLORS.subText,
  },
  editFilePickerBtn: {
    width: '100%',
    backgroundColor: COLORS.white,
    borderWidth: 1.5,
    borderColor: COLORS.navy,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  editFilePickerText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.navy,
  },

});