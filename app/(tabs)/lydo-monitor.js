import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, ScrollView, TouchableOpacity,
  StyleSheet, SafeAreaView, StatusBar, Dimensions,
  Modal, Alert, KeyboardAvoidingView, Platform, Image,
  ActivityIndicator, Linking, Animated,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useNav } from './navContext';
import { useAuth } from './authContext';
import { supabase } from '../../utils/supabase';
import { Feather } from '@expo/vector-icons';

// WebView: use react-native-webview on native, iframe on web
let WebView = null;
if (Platform.OS !== 'web') {
  WebView = require('react-native-webview').WebView;
}

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
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
  highlight: 'rgba(255, 214, 0, 0.45)',
  highlightBorder: '#E8C547',
  commentDot: '#E87A30',
  approve:   '#1E4D8C',
  comment:   '#E0E0E0',
};

const NAV_TABS     = ['Dashboard', 'Documents', 'Monitor', 'Barangay', 'Logs'];
const MONITOR_TABS = ['Consultation', 'Budget', 'Report'];

const TABLE_DATA = {
  Budget: [
    { id: '1', barangay: 'Barangay Antipolo',   document: 'Annual Budget Proposal 2026',    time: '9:00 AM',  feedbackDate: '1/05/2026', approvedDate: '1/08/2026' },
    { id: '2', barangay: 'Barangay San Isidro', document: 'Supplemental Budget Request Q1', time: '10:30 AM', feedbackDate: '1/06/2026', approvedDate: null },
    { id: '3', barangay: 'Barangay Banot',      document: 'SK Fund Utilization Report',     time: '2:00 PM',  feedbackDate: '1/07/2026', approvedDate: null },
    { id: '4', barangay: 'Barangay Mamala',     document: 'Capital Outlay Budget 2026',     time: '4:00 PM',  feedbackDate: '1/08/2026', approvedDate: '1/10/2026' },
  ],
  Report: [
    { id: '1', barangay: 'Barangay Taquico',  document: 'Q4 2025 Accomplishment Report',                 time: '8:00 AM',  feedbackDate: '1/10/2026', approvedDate: null },
    { id: '2', barangay: 'Barangay Bayongon', document: 'Activity Documentation — Linggo ng Kabataan',  time: '11:00 AM', feedbackDate: '1/11/2026', approvedDate: '1/14/2026' },
    { id: '3', barangay: 'Barangay Apasan',   document: 'Minutes of the Meeting — January Session',     time: '1:00 PM',  feedbackDate: '1/12/2026', approvedDate: null },
  ],
};

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

// ─── 3-DOT MENU ───────────────────────────────────────────────────────────────
const ThreeDotMenu = ({ onSave, onEdit, onReturn }) => {
  const [open, setOpen] = useState(false);
  return (
    <View style={tdStyles.wrap}>
      <TouchableOpacity style={tdStyles.btn} onPress={() => setOpen(!open)} activeOpacity={0.7}>
        <Text style={tdStyles.dots}>•••</Text>
      </TouchableOpacity>
      {open && (
        <View style={tdStyles.menu}>
          {[
            { label: '💾  Save',   action: onSave },
            { label: '✏️  Edit',   action: onEdit },
            { label: '↩  Return', action: onReturn },
          ].map((item, i) => (
            <TouchableOpacity
              key={i}
              style={[tdStyles.item, i < 2 && tdStyles.itemBorder]}
              onPress={() => { setOpen(false); item.action?.(); }}
              activeOpacity={0.75}
            >
              <Text style={tdStyles.itemText}>{item.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
};
const tdStyles = StyleSheet.create({
  wrap: { position: 'relative', zIndex: 99 },
  btn:  { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.lightGray, alignItems: 'center', justifyContent: 'center' },
  dots: { fontSize: 14, fontWeight: '900', color: COLORS.darkText, letterSpacing: 2 },
  menu: {
    position: 'absolute', top: 42, right: 0,
    backgroundColor: COLORS.white, borderRadius: 10,
    width: 140, elevation: 8,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15, shadowRadius: 8,
    borderWidth: 1, borderColor: COLORS.lightGray,
  },
  item:       { paddingHorizontal: 16, paddingVertical: 13 },
  itemBorder: { borderBottomWidth: 1, borderBottomColor: COLORS.lightGray },
  itemText:   { fontSize: 13, fontWeight: '600', color: COLORS.darkText },
});

// ─── CBYDP TABLE ──────────────────────────────────────────────────────────────
const docStyles = StyleSheet.create({
  table:       { borderWidth: 1, borderColor: '#ccc', marginTop: 12 },
  tableRow:    { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#ccc' },
  tableDataRow:{ flexDirection: 'row', height: 28, borderBottomWidth: 1, borderBottomColor: '#eee' },
  th: { flex: 1, borderRightWidth: 1, borderRightColor: '#ccc', padding: 3, justifyContent: 'center', alignItems: 'center' },
  td: { flex: 1, borderRightWidth: 1, borderRightColor: '#eee' },
  thText:    { fontSize: 7, fontWeight: '700', color: '#333', textAlign: 'center', lineHeight: 10 },
  thSubText: { fontSize: 7, color: '#555', textAlign: 'center' },
});

const CBYDPTable = () => (
  <View style={docStyles.table}>
    <View style={docStyles.tableRow}>
      {['Youth Development Concern', 'Objective', 'Performance Indicator', 'Target', '', '', 'PPAs', 'Budget', 'Person Responsible'].map((h, i) => (
        <View key={i} style={[docStyles.th, i === 3 && { flex: 0, width: 60 }]}>
          <Text style={docStyles.thText}>{h}</Text>
        </View>
      ))}
    </View>
    <View style={docStyles.tableRow}>
      {['', '', '', '[Year 1]', '[Year 2]', '[Year 3]', '', '', ''].map((h, i) => (
        <View key={i} style={docStyles.th}>
          <Text style={docStyles.thSubText}>{h}</Text>
        </View>
      ))}
    </View>
    {[0, 1, 2, 3].map((r) => (
      <View key={r} style={docStyles.tableDataRow}>
        {Array(9).fill('').map((_, c) => (
          <View key={c} style={docStyles.td} />
        ))}
      </View>
    ))}
  </View>
);

// ─── DOCUMENT VIEWER ──────────────────────────────────────────────────────────
const COMMENT_PANEL_WIDTH = isMobile ? SCREEN_WIDTH : 320;

const DocumentViewer = ({ item, onClose, onApproved, onRefreshDocs }) => {
  const { user } = useAuth();
  const [fileUrl, setFileUrl]           = useState(null);
  const [loading, setLoading]           = useState(true);
  const [webLoading, setWebLoading]     = useState(true);
  const [approving, setApproving]       = useState(false);
  const [approveModalVisible, setApproveModalVisible] = useState(false);

  // ── Comment panel state ──
  const [commentPanelOpen, setCommentPanelOpen] = useState(false);
  const slideAnim = useRef(new Animated.Value(COMMENT_PANEL_WIDTH)).current;

  const openCommentPanel = () => {
    setCommentPanelOpen(true);
    Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 65, friction: 11 }).start();
    if (item?.id) fetchComments();
  };
  const closeCommentPanel = () => {
    Animated.timing(slideAnim, { toValue: COMMENT_PANEL_WIDTH, useNativeDriver: true, duration: 220 }).start(() => setCommentPanelOpen(false));
  };

  // ── Comment logic (from CommentMode) ──
  const [comments, setComments]               = useState([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentsSaving, setCommentsSaving]   = useState(false);
  const [newComment, setNewComment]           = useState('');
  const [replyingTo, setReplyingTo]           = useState(null);
  const [replyText, setReplyText]             = useState('');
  const [replySaving, setReplySaving]         = useState(false);
  const [returnModalVisible, setReturnModalVisible] = useState(false);
  const [returning, setReturning]             = useState(false);
  const [currentVersionId, setCurrentVersionId] = useState(null);

  const fetchComments = useCallback(async () => {
    setCommentsLoading(true);
    try {
      const { data: lydo, error } = await supabase
        .from('lydo_comments')
        .select(`comment_id, content, is_resolved, created_at, version_id, commented_by,
          commenter:users!lydo_comments_commented_by_fkey (user_id, first_name, last_name)`)
        .eq('document_id', item.id)
        .order('created_at', { ascending: true });
      if (error) { setComments([]); return; }
      const withReplies = await Promise.all((lydo || []).map(async (c) => {
        const { data: replies } = await supabase
          .from('sk_replies')
          .select(`reply_id, content, created_at, replied_by,
            replier:users!sk_replies_replied_by_fkey (user_id, first_name, last_name)`)
          .eq('comment_id', c.comment_id)
          .order('created_at', { ascending: true });
        return { ...c, sk_replies: replies || [] };
      }));
      setComments(withReplies);
    } catch (e) { setComments([]); }
    finally { setCommentsLoading(false); }
  }, [item?.id]);

  const handleAddComment = async () => {
    if (!newComment.trim()) return;
    setCommentsSaving(true);
    try {
      const { data, error } = await supabase.from('lydo_comments')
        .insert({ document_id: parseInt(item.id), version_id: currentVersionId, commented_by: user?.userId, content: newComment.trim() })
        .select(`comment_id, content, is_resolved, created_at, version_id, commented_by,
          commenter:users!lydo_comments_commented_by_fkey (user_id, first_name, last_name)`)
        .single();
      if (error) { Alert.alert('Error', 'Could not save comment.'); return; }
      setComments(prev => [...prev, { ...data, sk_replies: [] }]);
      setNewComment('');
    } catch (e) { Alert.alert('Error', 'An unexpected error occurred.'); }
    finally { setCommentsSaving(false); }
  };

  const handleAddReply = async (commentId) => {
    if (!replyText.trim()) return;
    setReplySaving(true);
    try {
      const { data, error } = await supabase.from('sk_replies')
        .insert({ comment_id: commentId, replied_by: user?.userId, content: replyText.trim() })
        .select(`reply_id, content, created_at, replied_by,
          replier:users!sk_replies_replied_by_fkey (user_id, first_name, last_name)`)
        .single();
      if (error) { Alert.alert('Error', 'Could not save reply.'); return; }
      setComments(prev => prev.map(c => c.comment_id === commentId ? { ...c, sk_replies: [...c.sk_replies, data] } : c));
      setReplyText(''); setReplyingTo(null);
    } catch (e) { Alert.alert('Error', 'An unexpected error occurred.'); }
    finally { setReplySaving(false); }
  };

  const handleResolve = async (commentId) => {
    try {
      const { error } = await supabase.from('lydo_comments').update({ is_resolved: true }).eq('comment_id', commentId);
      if (!error) setComments(prev => prev.map(c => c.comment_id === commentId ? { ...c, is_resolved: true } : c));
    } catch (e) {}
  };

  const handleReturn = async () => {
    if (comments.length === 0) { Alert.alert('No Comments', 'Add at least one comment before returning the document.'); return; }
    setReturnModalVisible(true);
  };

  const confirmReturn = async () => {
    setReturning(true);
    try {
      const { data: versions } = await supabase.from('document_versions').select('version_number')
        .eq('document_id', item.id).order('version_number', { ascending: false }).limit(1);
      const newVersionNumber = (versions?.[0]?.version_number || 0) + 1;
      const { error: versionError } = await supabase.from('document_versions')
        .insert({ document_id: parseInt(item.id), version_number: newVersionNumber, file_url: fileUrl || '', action: 'returned', actioned_by: user?.userId })
        .select('version_id').single();
      if (versionError) { Alert.alert('Error', 'Failed to create return version.'); setReturning(false); return; }
      const { error: docError } = await supabase.from('documents')
        .update({ status: 'returned', reviewed_at: new Date().toISOString(), reviewed_by: user?.userId })
        .eq('document_id', parseInt(item.id));
      if (docError) { Alert.alert('Error', 'Failed to return document.'); setReturning(false); return; }
      // Log the return activity
      await logActivity('Return proposal', `Returned "${item.document}" from ${item.barangay} with ${comments.length} comment(s)`);
      setReturnModalVisible(false);
      Alert.alert('Document Returned', `"${item.document}" has been returned to ${item.barangay} with ${comments.length} comment(s).`);
      onRefreshDocs?.();
      onClose();
    } catch (e) { Alert.alert('Error', 'An unexpected error occurred.'); }
    finally { setReturning(false); }
  };

  const formatTime = (iso) => { if (!iso) return ''; const d = new Date(iso); return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }); };
  const getInitials = (u) => { if (!u) return '??'; return `${u.first_name?.[0] || ''}${u.last_name?.[0] || ''}`.toUpperCase() || '??'; };
  const getFullName = (u) => { if (!u) return 'LYDO Officer'; return `${u.first_name || ''} ${u.last_name || ''}`.trim() || 'LYDO Officer'; };
  const resolvedCount   = comments.filter(c => c.is_resolved).length;
  const unresolvedCount = comments.length - resolvedCount;

  useEffect(() => {
    const fetchFileUrl = async () => {
      setLoading(true);
      try {
        const { data: versions } = await supabase
          .from('document_versions')
          .select('file_url')
          .eq('document_id', item.id)
          .order('version_number', { ascending: false })
          .limit(1);
        const versionUrl = versions?.[0]?.file_url;
        if (versionUrl) { setFileUrl(versionUrl); } else {
          const { data: doc } = await supabase
            .from('documents').select('file_url')
            .eq('document_id', item.id).single();
          setFileUrl(doc?.file_url || null);
        }
      } catch (e) { setFileUrl(null); }
      finally { setLoading(false); }
    };
    if (item?.id) fetchFileUrl(); else setLoading(false);
  }, [item?.id]);

  // Helper function to log LYDO activity
  const logActivity = async (action, description) => {
    try {
      await supabase.from('lydo_activity_logs').insert({
        action,
        description,
        user_id: user?.userId || null,
      });
    } catch (err) {
      console.error('Failed to log activity:', err);
    }
  };

  const handleApprove = async () => {
    setApproving(true);
    try {
      const { data: versions } = await supabase
        .from('document_versions').select('version_number')
        .eq('document_id', item.id).order('version_number', { ascending: false }).limit(1);
      const newVersionNumber = (versions?.[0]?.version_number || 0) + 1;
      const { error: versionError } = await supabase.from('document_versions').insert({
        document_id: item.id, version_number: newVersionNumber,
        file_url: fileUrl || '', action: 'approved', actioned_by: user?.userId || null,
      });
      if (versionError) { setApproveModalVisible(false); Alert.alert('Error', 'Failed to record approval.'); setApproving(false); return; }
      const { error: docError } = await supabase.from('documents').update({
        status: 'approved', reviewed_at: new Date().toISOString(), reviewed_by: user?.userId || null,
      }).eq('document_id', item.id);
      if (docError) { setApproveModalVisible(false); Alert.alert('Error', 'Failed to approve document.'); setApproving(false); return; }
      // Log the approval activity
      await logActivity('Approve proposal', `Approved "${item.document}" from ${item.barangay}`);
      setApproveModalVisible(false);
      onApproved?.();
      onClose();
    } catch (e) { setApproveModalVisible(false); Alert.alert('Error', 'An unexpected error occurred.'); }
    finally { setApproving(false); }
  };

  const googleViewerUrl = fileUrl
    ? `https://docs.google.com/gview?embedded=true&url=${encodeURIComponent(fileUrl)}`
    : null;

  return (
    <Modal visible animationType="slide" statusBarTranslucent>
      <SafeAreaView style={dvStyles.safe}>
        {/* ── Top Bar ── */}
        <View style={dvStyles.topBar}>
          <TouchableOpacity style={dvStyles.backBtn} onPress={onClose} activeOpacity={0.8}>
            <Feather name="arrow-left" size={20} color={COLORS.white} />
          </TouchableOpacity>
          <View style={dvStyles.topMid}>
            <Text style={dvStyles.topTitle} numberOfLines={1}>{item.document}</Text>
            <Text style={dvStyles.topSub}>{item.barangay}</Text>
          </View>
          {fileUrl && (
            <TouchableOpacity style={dvStyles.downloadBtn}
              onPress={() => Linking.openURL(fileUrl).catch(() => Alert.alert('Error', 'Could not open file.'))}
              activeOpacity={0.8}>
              <Feather name="download" size={18} color={COLORS.gold} />
            </TouchableOpacity>
          )}
        </View>

        {/* ── Document area ── */}
        <View style={{ flex: 1, backgroundColor: COLORS.offWhite }}>
          {loading ? (
            <View style={dvStyles.centerState}>
              <ActivityIndicator size="large" color={COLORS.navy} />
              <Text style={dvStyles.loadingTxt}>Loading document…</Text>
            </View>
          ) : !fileUrl ? (
            <ScrollView contentContainerStyle={dvStyles.docWrap} showsVerticalScrollIndicator={false}>
              <View style={dvStyles.docPage}>
                <Text style={dvStyles.docCenter}>Barangay ___________________</Text>
                <Text style={dvStyles.docCenter}>Sangguniang Kabataan</Text>
                <Text style={[dvStyles.docCenter, dvStyles.docBold, { marginTop: 10 }]}>
                  COMPREHENSIVE BARANGAY YOUTH DEVELOPMENT PLAN (CBYDP)
                </Text>
                <Text style={dvStyles.docLine}>Region: ___    Province: ___________    Municipality: ___________</Text>
                <Text style={[dvStyles.docCenter, dvStyles.docBold, { marginTop: 6 }]}>
                  COMPREHENSIVE BARANGAY YOUTH DEVELOPMENT PLAN (CBYDP)
                </Text>
                <Text style={[dvStyles.docLine, { marginTop: 10 }]}>CENTER OF PARTICIPATION _______________</Text>
                <Text style={dvStyles.docLine}>Agenda Statement:</Text>
                <View style={dvStyles.divider} />
                <View style={dvStyles.divider} />
                <CBYDPTable />
                <View style={{ marginTop: 16 }}>
                  <Text style={[dvStyles.docLine, dvStyles.docCenter]}>Prepared by:</Text>
                  <View style={dvStyles.sigRow}>
                    <View style={dvStyles.sigBlock}><View style={dvStyles.sigLine} /><Text style={dvStyles.sigLabel}>SK Secretary</Text></View>
                    <View style={dvStyles.sigBlock}><View style={dvStyles.sigLine} /><Text style={dvStyles.sigLabel}>SK Chairperson</Text></View>
                  </View>
                </View>
                <View style={dvStyles.noFileBanner}>
                  <Text style={dvStyles.noFileTxt}>⚠ No file attached — showing template preview</Text>
                </View>
              </View>
            </ScrollView>
          ) : Platform.OS === 'web' ? (
            <iframe src={googleViewerUrl} style={{ flex: 1, width: '100%', height: '100%', border: 'none' }} title={item.document} />
          ) : (
            <View style={{ flex: 1 }}>
              <WebView source={{ uri: googleViewerUrl }} style={{ flex: 1 }}
                onLoadStart={() => setWebLoading(true)} onLoadEnd={() => setWebLoading(false)}
                onError={() => { setWebLoading(false); Alert.alert('Load Failed', 'Could not load the document.'); }}
                startInLoadingState={true}
                renderLoading={() => (
                  <View style={dvStyles.centerState}>
                    <ActivityIndicator size="large" color={COLORS.navy} />
                    <Text style={dvStyles.loadingTxt}>Loading document…</Text>
                  </View>
                )}
              />
              {webLoading && (
                <View style={dvStyles.webLoadingOverlay}>
                  <ActivityIndicator size="large" color={COLORS.navy} />
                  <Text style={dvStyles.loadingTxt}>Loading document…</Text>
                </View>
              )}
            </View>
          )}

          {/* ── Slide-in Comment Panel ── */}
          {commentPanelOpen && (
            <TouchableOpacity
              style={dvStyles.panelScrim}
              activeOpacity={1}
              onPress={closeCommentPanel}
            />
          )}
          <Animated.View
            style={[
              dvStyles.commentPanel,
              { width: COMMENT_PANEL_WIDTH, transform: [{ translateX: slideAnim }] },
            ]}
            pointerEvents={commentPanelOpen ? 'auto' : 'none'}
          >
            {/* Panel top bar */}
            <View style={dvStyles.panelTopBar}>
              <View style={{ flex: 1 }}>
                <Text style={dvStyles.panelTitle}>Comments</Text>
                <Text style={dvStyles.panelSub} numberOfLines={1}>{item.document}</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                {item.status !== 'returned' && comments.length > 0 && (
                  <TouchableOpacity
                    style={dvStyles.returnBtn}
                    onPress={handleReturn}
                    activeOpacity={0.85}
                  >
                    <Feather name="corner-up-left" size={13} color={COLORS.white} style={{ marginRight: 4 }} />
                    <Text style={dvStyles.returnBtnTxt}>Return</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity style={dvStyles.panelCloseBtn} onPress={closeCommentPanel} activeOpacity={0.8}>
                  <Feather name="x" size={18} color={COLORS.darkText} />
                </TouchableOpacity>
              </View>
            </View>

            {/* Badge row */}
            {comments.length > 0 && (
              <View style={dvStyles.panelBadgeRow}>
                {unresolvedCount > 0 && (
                  <View style={[dvStyles.badge, dvStyles.badgeOpen]}>
                    <Text style={dvStyles.badgeTxt}>{unresolvedCount} open</Text>
                  </View>
                )}
                {resolvedCount > 0 && (
                  <View style={[dvStyles.badge, dvStyles.badgeResolved]}>
                    <Text style={[dvStyles.badgeTxt, { color: '#166534' }]}>{resolvedCount} resolved</Text>
                  </View>
                )}
              </View>
            )}

            {/* Comment list */}
            <ScrollView style={dvStyles.commentList} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {commentsLoading ? (
                <ActivityIndicator color={COLORS.navy} style={{ marginTop: 30 }} />
              ) : comments.length === 0 ? (
                <View style={dvStyles.emptyState}>
                  <Feather name="message-circle" size={32} color={COLORS.midGray} />
                  <Text style={dvStyles.emptyTxt}>No comments yet</Text>
                  <Text style={dvStyles.emptySub}>Add your first comment below.</Text>
                </View>
              ) : (
                comments.map((c) => (
                  <View key={c.comment_id} style={[dvStyles.commentCard, c.is_resolved && dvStyles.commentCardResolved]}>
                    <View style={dvStyles.commentHeader}>
                      <View style={[dvStyles.avatar, c.is_resolved && dvStyles.avatarResolved]}>
                        <Text style={dvStyles.avatarTxt}>{getInitials(c.commenter)}</Text>
                      </View>
                      <View style={dvStyles.commentMeta}>
                        <Text style={dvStyles.commentAuthor}>{getFullName(c.commenter)}</Text>
                        <Text style={dvStyles.commentTime}>{formatTime(c.created_at)}</Text>
                      </View>
                      {!c.is_resolved ? (
                        <TouchableOpacity style={dvStyles.resolveBtn} onPress={() => handleResolve(c.comment_id)} activeOpacity={0.7}>
                          <Feather name="check" size={12} color={COLORS.navy} />
                          <Text style={dvStyles.resolveTxt}>Resolve</Text>
                        </TouchableOpacity>
                      ) : (
                        <View style={dvStyles.resolvedTag}>
                          <Feather name="check-circle" size={11} color="#166534" />
                          <Text style={dvStyles.resolvedTagTxt}>Resolved</Text>
                        </View>
                      )}
                    </View>
                    <Text style={[dvStyles.commentBody, c.is_resolved && dvStyles.commentBodyResolved]}>{c.content}</Text>
                    {c.sk_replies.length > 0 && (
                      <View style={dvStyles.repliesWrap}>
                        {c.sk_replies.map((r) => (
                          <View key={r.reply_id} style={dvStyles.replyCard}>
                            <View style={dvStyles.replyHeader}>
                              <View style={dvStyles.replyAvatar}><Text style={dvStyles.replyAvatarTxt}>{getInitials(r.replier)}</Text></View>
                              <View style={{ flex: 1 }}>
                                <Text style={dvStyles.replyAuthor}>{getFullName(r.replier)}</Text>
                                <Text style={dvStyles.replyTime}>{formatTime(r.created_at)}</Text>
                              </View>
                            </View>
                            <Text style={dvStyles.replyBody}>{r.content}</Text>
                          </View>
                        ))}
                      </View>
                    )}
                    {!c.is_resolved && (
                      <TouchableOpacity style={dvStyles.replyToggle}
                        onPress={() => { if (replyingTo === c.comment_id) { setReplyingTo(null); setReplyText(''); } else { setReplyingTo(c.comment_id); setReplyText(''); } }}
                        activeOpacity={0.7}>
                        <Feather name="corner-down-right" size={12} color={COLORS.navyLight} />
                        <Text style={dvStyles.replyToggleTxt}>{replyingTo === c.comment_id ? 'Cancel reply' : `Reply${c.sk_replies.length > 0 ? ` (${c.sk_replies.length})` : ''}`}</Text>
                      </TouchableOpacity>
                    )}
                    {replyingTo === c.comment_id && (
                      <View style={dvStyles.replyInputWrap}>
                        <TextInput style={dvStyles.replyInput} placeholder="Write a reply…" placeholderTextColor={COLORS.midGray}
                          value={replyText} onChangeText={setReplyText} multiline autoFocus />
                        <View style={dvStyles.replyBtnRow}>
                          <TouchableOpacity style={dvStyles.cancelBtn} onPress={() => { setReplyingTo(null); setReplyText(''); }} disabled={replySaving}>
                            <Text style={dvStyles.cancelTxt}>Cancel</Text>
                          </TouchableOpacity>
                          <TouchableOpacity style={[dvStyles.sendBtn, (!replyText.trim() || replySaving) && dvStyles.sendBtnDisabled]}
                            onPress={() => handleAddReply(c.comment_id)} disabled={!replyText.trim() || replySaving}>
                            {replySaving ? <ActivityIndicator size="small" color={COLORS.white} /> : <Text style={dvStyles.sendTxt}>Reply</Text>}
                          </TouchableOpacity>
                        </View>
                      </View>
                    )}
                  </View>
                ))
              )}
              <View style={{ height: 16 }} />
            </ScrollView>

            {/* New comment input */}
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
              <View style={dvStyles.inputArea}>
                <View style={dvStyles.inputRow}>
                  <View style={dvStyles.inputAvatar}>
                    <Text style={dvStyles.inputAvatarTxt}>{(user?.first_name?.[0] || '') + (user?.last_name?.[0] || '') || 'LY'}</Text>
                  </View>
                  <TextInput style={dvStyles.input} placeholder="Add a comment…" placeholderTextColor={COLORS.midGray}
                    value={newComment} onChangeText={setNewComment} multiline />
                </View>
                <View style={dvStyles.inputBtnRow}>
                  <Text style={dvStyles.inputHint}>
                    {comments.length > 0 ? `${unresolvedCount} unresolved` : 'Visible to the SK barangay'}
                  </Text>
                  <TouchableOpacity style={[dvStyles.sendCommentBtn, (!newComment.trim() || commentsSaving) && dvStyles.sendBtnDisabled]}
                    onPress={handleAddComment} disabled={!newComment.trim() || commentsSaving}>
                    {commentsSaving ? <ActivityIndicator size="small" color={COLORS.white} /> : (
                      <><Feather name="send" size={13} color={COLORS.white} style={{ marginRight: 5 }} /><Text style={dvStyles.sendTxt}>Send</Text></>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </KeyboardAvoidingView>
          </Animated.View>
        </View>

        {/* ── Bottom Bar ── */}
        <View style={dvStyles.bottomBar}>
          {item.status !== 'returned' && item.status !== 'approved' && (
            <TouchableOpacity style={dvStyles.approveBtn} onPress={() => setApproveModalVisible(true)} activeOpacity={0.85}>
              <Text style={dvStyles.approveTxt}>Approve</Text>
            </TouchableOpacity>
          )}
          {item.status !== 'approved' && (
            <TouchableOpacity style={dvStyles.commentBtn} onPress={openCommentPanel} activeOpacity={0.85}>
              <Feather name="message-square" size={15} color={COLORS.darkText} style={{ marginRight: 6 }} />
              <Text style={dvStyles.commentTxt}>View Comments</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* ── Approve Modal ── */}
        <Modal visible={approveModalVisible} animationType="fade" transparent={true}
          onRequestClose={() => !approving && setApproveModalVisible(false)}>
          <View style={dvStyles.modalOverlay}>
            <View style={dvStyles.modalContent}>
              <View style={dvStyles.modalIconStrip}>
                <View style={[dvStyles.modalIconCircle, { backgroundColor: '#D1FAE5' }]}>
                  <Feather name="check-circle" size={26} color="#16A34A" />
                </View>
              </View>
              <View style={dvStyles.modalBody}>
                <Text style={dvStyles.modalTitle}>Approve Document</Text>
                <Text style={dvStyles.modalBodyText}>
                  You are about to approve{' '}
                  <Text style={dvStyles.modalHighlight}>"{item.document}"</Text>
                  {' '}from{' '}
                  <Text style={dvStyles.modalHighlight}>{item.barangay}</Text>.
                  {'\n\n'}The document status will change to{' '}
                  <Text style={[dvStyles.modalHighlight, { color: '#16A34A' }]}>Approved</Text>.
                </Text>
              </View>
              <View style={dvStyles.modalDivider} />
              <View style={dvStyles.modalFooter}>
                <TouchableOpacity style={dvStyles.modalCancelBtn} onPress={() => setApproveModalVisible(false)} disabled={approving} activeOpacity={0.8}>
                  <Text style={dvStyles.modalCancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[dvStyles.modalActionBtn, dvStyles.modalApproveBtn, approving && dvStyles.modalBtnDisabled]}
                  onPress={handleApprove} disabled={approving} activeOpacity={0.8}>
                  {approving ? <ActivityIndicator size="small" color={COLORS.white} /> : (
                    <><Feather name="check-circle" size={14} color={COLORS.white} style={{ marginRight: 6 }} /><Text style={dvStyles.modalActionBtnText}>Approve</Text></>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* ── Return Confirmation Modal ── */}
        <Modal visible={returnModalVisible} animationType="fade" transparent onRequestClose={() => !returning && setReturnModalVisible(false)}>
          <View style={dvStyles.returnModalOverlay}>
            <View style={dvStyles.returnModalBox}>
              <View style={[dvStyles.returnModalIconCircle, { backgroundColor: '#FEF3C7' }]}>
                <Feather name="corner-up-left" size={26} color="#D97706" />
              </View>
              <Text style={dvStyles.returnModalTitle}>Return for Revision</Text>
              <Text style={dvStyles.returnModalBody}>
                You are returning{' '}
                <Text style={{ fontWeight: '700', color: COLORS.darkText }}>"{item.document}"</Text>
                {' '}from{' '}
                <Text style={{ fontWeight: '700', color: COLORS.darkText }}>{item.barangay}</Text>
                {' '}with{' '}
                <Text style={{ fontWeight: '700', color: '#D97706' }}>{comments.length} comment{comments.length !== 1 ? 's' : ''}</Text>.
                {'\n\n'}The barangay will be notified to revise and resubmit.
              </Text>
              <View style={dvStyles.returnModalDivider} />
              <View style={dvStyles.returnModalFooter}>
                <TouchableOpacity style={dvStyles.returnModalCancelBtn} onPress={() => setReturnModalVisible(false)} disabled={returning}>
                  <Text style={dvStyles.returnModalCancelTxt}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[dvStyles.returnModalConfirmBtn, returning && dvStyles.sendBtnDisabled]} onPress={confirmReturn} disabled={returning}>
                  {returning ? <ActivityIndicator size="small" color={COLORS.white} /> : (
                    <><Feather name="corner-up-left" size={14} color={COLORS.white} style={{ marginRight: 6 }} /><Text style={dvStyles.returnModalConfirmTxt}>Return Document</Text></>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </Modal>
  );
};

const dvStyles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.navy },
  topBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.navy, paddingHorizontal: 12, paddingVertical: 12, gap: 10 },
  backBtn: { padding: 6, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.12)' },
  closeBtn: { padding: 6, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.12)' },
  closeTxt: { fontSize: 14, fontWeight: '700', color: COLORS.white },
  topMid: { flex: 1 },
  topTitle: { fontSize: 14, fontWeight: '700', color: COLORS.white },
  topSub:   { fontSize: 11, color: 'rgba(255,255,255,0.65)' },
  downloadBtn: { padding: 6, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.12)' },
  centerState: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.offWhite, gap: 12 },
  loadingTxt: { fontSize: 13, color: COLORS.subText },
  webLoadingOverlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.offWhite, gap: 12 },
  docWrap:  { padding: 16, alignItems: 'center' },
  docPage:  { backgroundColor: COLORS.white, width: '100%', maxWidth: 480, borderRadius: 6, padding: 24, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8 },
  docCenter: { textAlign: 'center', fontSize: 12, color: COLORS.darkText, lineHeight: 18 },
  docBold:   { fontWeight: '700' },
  docLine:   { fontSize: 12, color: COLORS.darkText, lineHeight: 20, marginTop: 4 },
  divider:   { height: 1, backgroundColor: COLORS.lightGray, marginVertical: 8 },
  sigRow:    { flexDirection: 'row', justifyContent: 'space-around', marginTop: 20 },
  sigBlock:  { alignItems: 'center', width: 140 },
  sigLine:   { width: '100%', height: 1, backgroundColor: COLORS.darkText, marginBottom: 4 },
  sigLabel:  { fontSize: 11, fontWeight: '600', color: COLORS.darkText },
  noFileBanner: { marginTop: 18, backgroundColor: '#FFF8E1', borderRadius: 8, padding: 10, borderLeftWidth: 3, borderLeftColor: COLORS.gold },
  noFileTxt: { fontSize: 11, color: '#7A6000', fontWeight: '600' },
  bottomBar: { flexDirection: 'row', justifyContent: 'center', gap: 12, padding: 16, backgroundColor: COLORS.white, borderTopWidth: 1, borderTopColor: COLORS.lightGray },
  approveBtn: { backgroundColor: COLORS.approve, borderRadius: 24, paddingHorizontal: 36, paddingVertical: 12 },
  approveTxt: { fontSize: 14, fontWeight: '800', color: COLORS.white },
  commentBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.comment, borderRadius: 24, paddingHorizontal: 28, paddingVertical: 12, borderWidth: 1.5, borderColor: COLORS.midGray },
  commentTxt: { fontSize: 14, fontWeight: '700', color: COLORS.darkText },
  modalOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(10,20,40,0.55)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { width: '88%', maxWidth: 380, backgroundColor: COLORS.white, borderRadius: 20, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.25, shadowRadius: 20, elevation: 20 },
  modalIconStrip: { alignItems: 'center', paddingTop: 28, paddingBottom: 4, backgroundColor: COLORS.white },
  modalIconCircle: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  modalBody: { paddingHorizontal: 24, paddingTop: 14, paddingBottom: 20, alignItems: 'center' },
  modalTitle: { fontSize: 17, fontWeight: '800', color: COLORS.darkText, textAlign: 'center', marginBottom: 10, letterSpacing: 0.2 },
  modalBodyText: { fontSize: 13.5, color: COLORS.subText, lineHeight: 20, textAlign: 'center' },
  modalHighlight: { fontWeight: '700', color: COLORS.darkText },
  modalDivider:   { height: 1, backgroundColor: COLORS.lightGray },
  modalFooter: { flexDirection: 'row', gap: 10, paddingHorizontal: 20, paddingVertical: 16, backgroundColor: COLORS.offWhite },
  modalCancelBtn: { flex: 1, paddingVertical: 13, borderRadius: 10, borderWidth: 1.5, borderColor: COLORS.lightGray, alignItems: 'center', backgroundColor: COLORS.white },
  modalCancelBtnText: { fontSize: 14, fontWeight: '700', color: COLORS.subText },
  modalActionBtn: { flex: 1, flexDirection: 'row', paddingVertical: 13, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  modalActionBtnText: { fontSize: 14, fontWeight: '700', color: COLORS.white },
  modalApproveBtn:    { backgroundColor: '#16A34A' },
  modalBtnDisabled:   { opacity: 0.55 },
  // Slide-in comment panel
  panelScrim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.25)', zIndex: 10 },
  commentPanel: {
    position: 'absolute', top: 0, bottom: 0, right: 0, zIndex: 20,
    backgroundColor: COLORS.white,
    borderLeftWidth: 1, borderLeftColor: COLORS.lightGray,
    shadowColor: '#000', shadowOffset: { width: -4, height: 0 }, shadowOpacity: 0.15, shadowRadius: 12, elevation: 16,
    flexDirection: 'column',
  },
  panelTopBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 14, paddingTop: 14, paddingBottom: 10,
    borderBottomWidth: 1, borderBottomColor: COLORS.lightGray,
    backgroundColor: COLORS.white,
  },
  panelTitle: { fontSize: 15, fontWeight: '800', color: COLORS.darkText },
  panelSub:   { fontSize: 10, color: COLORS.subText, marginTop: 1 },
  panelCloseBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: COLORS.lightGray, alignItems: 'center', justifyContent: 'center' },
  panelBadgeRow: { flexDirection: 'row', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: COLORS.lightGray },
  badge:         { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  badgeOpen:     { backgroundColor: '#FEF3C7' },
  badgeResolved: { backgroundColor: '#DCFCE7' },
  badgeTxt:      { fontSize: 10, fontWeight: '700', color: '#92400E' },
  returnBtn: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#D97706', borderRadius: 16,
    paddingHorizontal: 10, paddingVertical: 5,
  },
  returnBtnTxt: { fontSize: 11, fontWeight: '700', color: COLORS.white },
  commentList: { flex: 1, paddingHorizontal: 10, paddingTop: 10 },
  emptyState:  { alignItems: 'center', paddingTop: 32, gap: 8, paddingHorizontal: 16 },
  emptyTxt:    { fontSize: 13, fontWeight: '700', color: COLORS.midGray },
  emptySub:    { fontSize: 11, color: COLORS.midGray, textAlign: 'center', lineHeight: 16 },
  commentCard: { backgroundColor: COLORS.white, borderRadius: 10, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: COLORS.lightGray, elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3 },
  commentCardResolved: { backgroundColor: '#F9FAFB', borderColor: '#E5E7EB', opacity: 0.8 },
  commentHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8, gap: 8 },
  avatar:        { width: 32, height: 32, borderRadius: 16, backgroundColor: COLORS.navy, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  avatarResolved:{ backgroundColor: COLORS.midGray },
  avatarTxt:     { fontSize: 11, fontWeight: '800', color: COLORS.white },
  commentMeta:   { flex: 1 },
  commentAuthor: { fontSize: 12, fontWeight: '700', color: COLORS.darkText },
  commentTime:   { fontSize: 10, color: COLORS.midGray, marginTop: 1 },
  resolveBtn:    { flexDirection: 'row', alignItems: 'center', gap: 3, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 4, backgroundColor: '#EFF6FF', borderWidth: 1, borderColor: '#BFDBFE' },
  resolveTxt:    { fontSize: 10, fontWeight: '700', color: COLORS.navy },
  resolvedTag:   { flexDirection: 'row', alignItems: 'center', gap: 3 },
  resolvedTagTxt:{ fontSize: 10, fontWeight: '700', color: '#166534' },
  commentBody:         { fontSize: 12, color: COLORS.darkText, lineHeight: 18 },
  commentBodyResolved: { color: COLORS.subText },
  repliesWrap: { marginTop: 10, marginLeft: 12, borderLeftWidth: 2, borderLeftColor: COLORS.lightGray, paddingLeft: 10, gap: 8 },
  replyCard:   { backgroundColor: COLORS.offWhite, borderRadius: 8, padding: 8 },
  replyHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  replyAvatar: { width: 22, height: 22, borderRadius: 11, backgroundColor: COLORS.navyLight, alignItems: 'center', justifyContent: 'center' },
  replyAvatarTxt: { fontSize: 8, fontWeight: '800', color: COLORS.white },
  replyAuthor: { fontSize: 11, fontWeight: '700', color: COLORS.darkText },
  replyTime:   { fontSize: 9, color: COLORS.midGray },
  replyBody:   { fontSize: 11, color: COLORS.darkText, lineHeight: 16 },
  replyToggle:    { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8 },
  replyToggleTxt: { fontSize: 11, fontWeight: '600', color: COLORS.navyLight },
  replyInputWrap: { marginTop: 8, gap: 6 },
  replyInput: { backgroundColor: COLORS.offWhite, borderRadius: 8, borderWidth: 1, borderColor: COLORS.lightGray, paddingHorizontal: 10, paddingVertical: 7, fontSize: 12, color: COLORS.darkText, minHeight: 48, textAlignVertical: 'top' },
  replyBtnRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: 6 },
  cancelBtn:   { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: COLORS.lightGray },
  cancelTxt:   { fontSize: 11, fontWeight: '600', color: COLORS.subText },
  sendBtn:     { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 8, backgroundColor: COLORS.navy, alignItems: 'center', minWidth: 56 },
  sendBtnDisabled: { opacity: 0.4 },
  sendTxt:     { fontSize: 11, fontWeight: '700', color: COLORS.white },
  inputArea:   { borderTopWidth: 1, borderTopColor: COLORS.lightGray, padding: 12, backgroundColor: COLORS.white, gap: 8 },
  inputRow:    { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  inputAvatar: { width: 30, height: 30, borderRadius: 15, backgroundColor: COLORS.navy, alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 },
  inputAvatarTxt: { fontSize: 10, fontWeight: '800', color: COLORS.white },
  input: { flex: 1, backgroundColor: COLORS.offWhite, borderRadius: 10, borderWidth: 1, borderColor: COLORS.lightGray, paddingHorizontal: 12, paddingVertical: 9, fontSize: 12, color: COLORS.darkText, minHeight: 56, textAlignVertical: 'top' },
  inputBtnRow:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  inputHint:      { flex: 1, fontSize: 10, color: COLORS.midGray, lineHeight: 14, paddingRight: 8 },
  sendCommentBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.navy, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8 },
  // Return confirmation modal
  returnModalOverlay: { flex: 1, backgroundColor: 'rgba(10,20,40,0.55)', justifyContent: 'center', alignItems: 'center' },
  returnModalBox: { width: '88%', maxWidth: 380, backgroundColor: COLORS.white, borderRadius: 20, padding: 28, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.2, shadowRadius: 20, elevation: 20 },
  returnModalIconCircle: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  returnModalTitle: { fontSize: 17, fontWeight: '800', color: COLORS.darkText, marginBottom: 10, textAlign: 'center' },
  returnModalBody:  { fontSize: 13, color: COLORS.subText, lineHeight: 20, textAlign: 'center', marginBottom: 4 },
  returnModalDivider: { height: 1, backgroundColor: COLORS.lightGray, width: '100%', marginVertical: 16 },
  returnModalFooter:  { flexDirection: 'row', gap: 10, width: '100%' },
  returnModalCancelBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, borderWidth: 1.5, borderColor: COLORS.lightGray, alignItems: 'center', backgroundColor: COLORS.white },
  returnModalCancelTxt: { fontSize: 13, fontWeight: '700', color: COLORS.subText },
  returnModalConfirmBtn: { flex: 1.5, flexDirection: 'row', paddingVertical: 12, borderRadius: 10, backgroundColor: '#D97706', alignItems: 'center', justifyContent: 'center' },
  returnModalConfirmTxt: { fontSize: 13, fontWeight: '700', color: COLORS.white },
});

// ─── DROPDOWN ─────────────────────────────────────────────────────────────────
const Dropdown = ({ label, value, options, onSelect }) => {
  const [open, setOpen] = useState(false);
  return (
    <View style={DD.wrap}>
      <TouchableOpacity style={DD.btn} onPress={() => setOpen(o => !o)} activeOpacity={0.8}>
        <Text style={DD.label}>{label}</Text>
        <Text style={DD.value}>{value}</Text>
        <Text style={DD.arrow}>▾</Text>
      </TouchableOpacity>
      {open && (
        <View style={DD.menu}>
          {options.map(opt => (
            <TouchableOpacity key={opt} style={[DD.item, opt === value && DD.itemActive]}
              onPress={() => { onSelect(opt); setOpen(false); }} activeOpacity={0.75}>
              <Text style={[DD.itemText, opt === value && DD.itemTextActive]}>{opt}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
};
const DD = StyleSheet.create({
  wrap:           { position: 'relative', zIndex: 100 },
  btn:            { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: COLORS.white, borderRadius: 8, borderWidth: 1, borderColor: COLORS.lightGray, paddingHorizontal: 10, paddingVertical: 7 },
  label:          { fontSize: 10, color: COLORS.subText, fontWeight: '600' },
  value:          { fontSize: 11, fontWeight: '700', color: COLORS.darkText },
  arrow:          { fontSize: 9, color: COLORS.subText, marginLeft: 2 },
  menu:           { position: 'absolute', top: 36, left: 0, backgroundColor: COLORS.white, borderRadius: 8, borderWidth: 1, borderColor: COLORS.lightGray, minWidth: 110, elevation: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 8, zIndex: 200 },
  item:           { paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.lightGray },
  itemActive:     { backgroundColor: COLORS.offWhite },
  itemText:       { fontSize: 12, color: COLORS.darkText },
  itemTextActive: { fontWeight: '700', color: COLORS.navy },
});

const STATUS_CONFIG = {
  returned:    { dot: '#E53E3E', label: 'Returned for revision' },
  awaiting:    { dot: '#E8C547', label: 'Awaiting Resubmission' },
  resubmitted: { dot: '#38A169', label: 'Resubmitted' },
  approved:    { dot: '#1E4D8C', label: 'Approved' },
};

// ─── TABLE ROW ────────────────────────────────────────────────────────────────
const TableRow = ({ item, isEven, viewFilter, onView }) => {
  const statusCfg = STATUS_CONFIG[item.status] ?? { dot: COLORS.midGray, label: item.status ?? '—' };

  if (viewFilter === 'submitted') {
    return (
      <View style={[styles.tableRow, isEven && styles.tableRowEven]}>
        <View style={styles.colBarangaySubmitted}>
          <Text style={styles.cellBarangay}>{item.barangay}</Text>
        </View>
        <View style={styles.colDocumentSubmitted}>
          <Text style={styles.cellDocument} numberOfLines={isMobile ? 2 : 1}>{item.document}</Text>
        </View>
        <View style={styles.colDateTimeSubmitted}>
          <Text style={styles.cellTime}>{item.time}</Text>
          <Text style={styles.cellDate}>{item.submittedDate ?? item.feedbackDate ?? '—'}</Text>
        </View>
        <View style={styles.colActionSubmitted}>
          <TouchableOpacity style={styles.viewBtn} onPress={() => onView(item)} activeOpacity={0.75}>
            <Text style={styles.viewBtnText}>View</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (viewFilter === 'approved') {
    return (
      <View style={[styles.tableRow, isEven && styles.tableRowEven]}>
        <View style={styles.colBarangayApproved}>
          <Text style={styles.cellBarangay}>{item.barangay}</Text>
        </View>
        <View style={styles.colDocumentApproved}>
          <Text style={styles.cellDocument} numberOfLines={isMobile ? 2 : 1}>{item.document}</Text>
        </View>
        <View style={styles.colDateTimeApproved}>
          <Text style={styles.cellTime}>{item.time}</Text>
          <Text style={styles.cellDate}>{item.approvedDate ?? '—'}</Text>
        </View>
        <View style={styles.colActionApproved}>
          <View style={styles.approvedActionRow}>
            <TouchableOpacity
              style={[styles.actionIconWrap, { opacity: item.fileUrl ? 1 : 0.35 }]}
              onPress={() => item.fileUrl && Linking.openURL(item.fileUrl).catch(() => Alert.alert('Error', 'Could not open file.'))}
              activeOpacity={item.fileUrl ? 0.75 : 1}
              disabled={!item.fileUrl}
            >
              <Feather name="download" size={isMobile ? 13 : 15} color={COLORS.navy} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionIconWrap}
              onPress={() => onView(item)}
              activeOpacity={0.75}
            >
              <Feather name="eye" size={isMobile ? 13 : 15} color="#00796B" />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  // 'revision' view
  return (
    <View style={[styles.tableRow, isEven && styles.tableRowEven]}>
      <View style={styles.colBarangay}>
        <Text style={styles.cellBarangay}>{item.barangay}</Text>
      </View>
      <View style={styles.colDocument}>
        <Text style={styles.cellDocument} numberOfLines={isMobile ? 2 : 1}>{item.document}</Text>
      </View>
      <View style={styles.colStatus}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: statusCfg.dot }} />
          <Text style={styles.cellStatus} numberOfLines={2}>{statusCfg.label}</Text>
        </View>
      </View>
      <View style={styles.colDateTime}>
        <Text style={styles.cellTime}>{item.time}</Text>
        <Text style={styles.cellDate}>{item.feedbackDate ?? '—'}</Text>
      </View>
      <View style={styles.colAction}>
        <TouchableOpacity onPress={() => onView(item)} activeOpacity={0.75}>
          <Text style={styles.viewCommentsLink}>
            View Comments{item.commentCount != null ? ` (${item.commentCount})` : ''}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

// ─── MAIN SCREEN ──────────────────────────────────────────────────────────────
export default function LYDOMonitorScreen() {
  const router = useRouter();
  const { activeTab, setActiveTab } = useNav();
  const { logout } = useAuth();

  const [activeMonitorTab, setActiveMonitorTab] = useState('Consultation');
  const [viewFilter, setViewFilter]             = useState('submitted');
  const [searchText, setSearchText]             = useState('');
  const [barangayFilter, setBarangayFilter]     = useState('');
  const [documentFilter, setDocumentFilter]     = useState('');
  const [notifCount]                            = useState(2);
  const [sidebarVisible, setSidebarVisible]     = useState(false);
  const [consultationDocs, setConsultationDocs] = useState([]);
  const [approvedDocs, setApprovedDocs]         = useState([]);
  const [returnedDocs, setReturnedDocs]         = useState([]);

  const [viewingItem, setViewingItem] = useState(null);

  // ── Fetch consultation docs (status = submitted) ──
  const fetchConsultationDocs = useCallback(async () => {
    try {
      const { data: docs, error } = await supabase
        .from('documents')
        .select(`
          document_id, title, folder_category, document_type, status,
          year, created_at, saved_at, submitted_at, file_url,
          barangay:barangays(barangay_id, barangay_name),
          submitted_by_user:users!documents_submitted_by_fkey(user_id, first_name, last_name)
        `)
        .eq('status', 'submitted')
        .order('submitted_at', { ascending: false });

      if (error) { console.error('fetchConsultationDocs error:', error); return; }

      // Also fetch comment counts
      const formatted = await Promise.all((docs || []).map(async (doc) => {
        const { count } = await supabase
          .from('lydo_comments')
          .select('comment_id', { count: 'exact', head: true })
          .eq('document_id', doc.document_id);

        const date    = doc.submitted_at || doc.created_at;
        const dateObj = date ? new Date(date) : new Date();
        return {
          id:            doc.document_id.toString(),
          barangay:      doc.barangay?.barangay_name || 'Unknown Barangay',
          document:      doc.title || 'Untitled Document',
          time:          dateObj.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
          submittedDate: doc.submitted_at ? new Date(doc.submitted_at).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: '2-digit' }) : null,
          feedbackDate:  doc.submitted_at ? new Date(doc.submitted_at).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: '2-digit' }) : null,
          approvedDate:  null,
          status:        'submitted',
          commentCount:  count || 0,
          fileUrl:       doc.file_url || null,
        };
      }));

      setConsultationDocs(formatted);
    } catch (e) { console.error('fetchConsultationDocs unexpected:', e); }
  }, []);

  // ── Fetch approved docs ──
  const fetchApprovedDocs = useCallback(async () => {
    try {
      const { data: docs, error } = await supabase
        .from('documents')
        .select(`
          document_id, title, status, reviewed_at, created_at, file_url,
          barangay:barangays(barangay_id, barangay_name)
        `)
        .eq('status', 'approved')
        .order('reviewed_at', { ascending: false });

      if (error) { console.error('fetchApprovedDocs error:', error); return; }

      const formatted = await Promise.all((docs || []).map(async (doc) => {
        const { data: versions } = await supabase
          .from('document_versions')
          .select('file_url, version_number')
          .eq('document_id', doc.document_id)
          .order('version_number', { ascending: false })
          .limit(1);

        const latestFileUrl = versions?.[0]?.file_url || doc.file_url || null;
        const latestVersion = versions?.[0]?.version_number || 1;
        const dateObj = doc.reviewed_at ? new Date(doc.reviewed_at) : new Date(doc.created_at);
        return {
          id:           doc.document_id.toString(),
          barangay:     doc.barangay?.barangay_name || 'Unknown Barangay',
          document:     doc.title || 'Untitled Document',
          time:         dateObj.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
          approvedDate: doc.reviewed_at ? new Date(doc.reviewed_at).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: '2-digit' }) : null,
          status:       'approved',
          commentCount: 0,
          fileUrl:      latestFileUrl,
          version:      latestVersion,
        };
      }));

      setApprovedDocs(formatted);
    } catch (e) { console.error('fetchApprovedDocs unexpected:', e); }
  }, []);

  // ── Fetch returned docs ──
  const fetchReturnedDocs = useCallback(async () => {
    try {
      const { data: docs, error } = await supabase
        .from('documents')
        .select(`
          document_id, title, folder_category, document_type, status,
          year, created_at, reviewed_at, file_url,
          barangay:barangays(barangay_id, barangay_name)
        `)
        .eq('status', 'returned')
        .order('reviewed_at', { ascending: false });

      if (error) { console.error('fetchReturnedDocs error:', error); return; }

      const formatted = await Promise.all((docs || []).map(async (doc) => {
        const { count } = await supabase
          .from('lydo_comments')
          .select('comment_id', { count: 'exact', head: true })
          .eq('document_id', doc.document_id);

        const dateObj = doc.reviewed_at ? new Date(doc.reviewed_at) : new Date(doc.created_at);
        return {
          id:           doc.document_id.toString(),
          barangay:     doc.barangay?.barangay_name || 'Unknown Barangay',
          document:     doc.title || 'Untitled Document',
          time:         dateObj.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
          feedbackDate: doc.reviewed_at ? new Date(doc.reviewed_at).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: '2-digit' }) : null,
          approvedDate: null,
          status:       'returned',
          commentCount: count || 0,
          fileUrl:      doc.file_url || null,
        };
      }));

      setReturnedDocs(formatted);
    } catch (e) { console.error('fetchReturnedDocs unexpected:', e); }
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (activeMonitorTab === 'Consultation') {
        fetchConsultationDocs();
        fetchApprovedDocs();
        fetchReturnedDocs();
      }
    }, [activeMonitorTab, fetchConsultationDocs, fetchApprovedDocs, fetchReturnedDocs])
  );

  const handleNavPress = (tab) => {
    setActiveTab(tab);
    setSidebarVisible(false);
    if (tab === 'Dashboard') router.push('/(tabs)/lydo-dashboard');
    if (tab === 'Documents') router.push('/(tabs)/lydo-document');
    if (tab === 'Monitor')   router.push('/(tabs)/lydo-monitor');
    if (tab === 'Barangay')  router.push('/(tabs)/lydo-accounts');
    if (tab === 'Logs')      router.push('/(tabs)/lydo-logs');
  };

  const handleLogout = () => { logout(); router.replace('/'); };

  const getRows = () => {
    if (viewFilter === 'approved') {
      return approvedDocs
        .filter(r => r.barangay?.toLowerCase().includes(searchText.toLowerCase()) || r.document?.toLowerCase().includes(searchText.toLowerCase()))
        .filter(r => barangayFilter === '' || r.barangay?.toLowerCase().includes(barangayFilter.toLowerCase()))
        .filter(r => documentFilter === '' || r.document?.toLowerCase().includes(documentFilter.toLowerCase()));
    }
    if (viewFilter === 'revision') {
      return returnedDocs
        .filter(r => r.barangay?.toLowerCase().includes(searchText.toLowerCase()) || r.document?.toLowerCase().includes(searchText.toLowerCase()))
        .filter(r => barangayFilter === '' || r.barangay?.toLowerCase().includes(barangayFilter.toLowerCase()))
        .filter(r => documentFilter === '' || r.document?.toLowerCase().includes(documentFilter.toLowerCase()));
    }
    // 'submitted'
    let data = activeMonitorTab === 'Consultation' ? consultationDocs : (TABLE_DATA[activeMonitorTab] || []);
    return data
      .filter(r => r.barangay?.toLowerCase().includes(searchText.toLowerCase()) || r.document?.toLowerCase().includes(searchText.toLowerCase()))
      .filter(r => barangayFilter === '' || r.barangay?.toLowerCase().includes(barangayFilter.toLowerCase()))
      .filter(r => documentFilter === '' || r.document?.toLowerCase().includes(documentFilter.toLowerCase()));
  };

  const rows = getRows();

  const renderSidebar = () => (
    <View style={styles.sidebar}>
      <View style={styles.logoPill}>
        <Image source={require('./../../assets/images/lydo-logo.png')} style={styles.logoImage} resizeMode="contain" />
      </View>
      <View style={{ height: 28 }} />
      {NAV_TABS.map(tab => {
        const active = activeTab === tab;
        return (
          <TouchableOpacity key={tab} style={[styles.navItem, active && styles.navItemActive]}
            onPress={() => handleNavPress(tab)} activeOpacity={0.8}>
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

  const renderContent = () => (
    <ScrollView style={[styles.main, isMobile && styles.mainMobile]}
      contentContainerStyle={styles.mainContent} showsVerticalScrollIndicator={false}>

      {isMobile && (
        <View style={styles.mobileHeader}>
          <TouchableOpacity style={styles.menuBtn} onPress={() => setSidebarVisible(true)}>
            <MenuIcon />
          </TouchableOpacity>
          <Text style={styles.mobileTitle}>Monitor</Text>
          <TouchableOpacity style={styles.bellBtn}>
            <BellIcon hasNotif={notifCount > 0} />
          </TouchableOpacity>
        </View>
      )}

      {!isMobile && (
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerSub}>SANGGUNIANG KABATAAN FEDERATION</Text>
            <Text style={styles.headerTitle}>RIZAL, LAGUNA</Text>
            <Text style={styles.headerDesc}>
              SK Full Disclosure Policy Compliance Portal for the Submission and Validation{'\n'}of Statutory Financial Reports and Developmental Plans
            </Text>
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

      {/* Monitor Tab Bar */}
      <View style={styles.monitorTabBar}>
        {MONITOR_TABS.map(tab => {
          const active = activeMonitorTab === tab;
          return (
            <TouchableOpacity key={tab}
              style={[styles.monitorTab, active && styles.monitorTabActive]}
              onPress={() =>
                tab === 'Budget' ? router.push('/(tabs)/lydo-monitor-budget')
                : tab === 'Report' ? router.push('/(tabs)/lydo-monitor-report')
                : setActiveMonitorTab(tab)
              }
              activeOpacity={0.8}>
              <Text style={[styles.monitorTabText, active && styles.monitorTabTextActive]}>{tab}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Filter Row */}
      <View style={styles.filterRow}>
        <View style={styles.searchBox}>
          <TextInput style={styles.searchInput} placeholder="Search…"
            placeholderTextColor={COLORS.midGray} value={searchText} onChangeText={setSearchText} />
        </View>
        {['submitted', 'approved', 'revision'].map((f) => {
          const labels = { submitted: 'Submitted Proposal', approved: 'Approved', revision: 'Returned' };
          const styleMap = { submitted: styles.filterToggleSubmittedOn, approved: styles.filterToggleApprovedOn, revision: styles.filterToggleRevisionOn };
          return (
            <TouchableOpacity key={f}
              style={[styles.filterToggleBtn, viewFilter === f ? styleMap[f] : styles.filterToggleOff]}
              onPress={() => setViewFilter(f)} activeOpacity={0.8}>
              <Text style={[styles.filterToggleText, { color: viewFilter === f ? COLORS.darkText : COLORS.subText }]}>
                {labels[f]}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {viewFilter === 'submitted' && (
        <View style={styles.dropdownRow}>
          <Dropdown
            label="Barangay" value={barangayFilter || 'All'}
            options={['All', ...new Set((activeMonitorTab === 'Consultation' ? consultationDocs : TABLE_DATA[activeMonitorTab] || []).map(r => r.barangay).filter(Boolean))]}
            onSelect={v => setBarangayFilter(v === 'All' ? '' : v)}
          />
          <Dropdown
            label="Document" value={documentFilter || 'All'}
            options={['All', ...new Set((activeMonitorTab === 'Consultation' ? consultationDocs : TABLE_DATA[activeMonitorTab] || []).map(r => r.document).filter(Boolean))]}
            onSelect={v => setDocumentFilter(v === 'All' ? '' : v)}
          />
        </View>
      )}

      {viewFilter === 'approved' && (
        <Text style={styles.approvedPortfolioTitle}>Federation Portfolio of Approved Plans</Text>
      )}

      {/* Table */}
      <View style={styles.tableContainer}>
        {viewFilter === 'submitted' && (
          <View style={styles.tableHeader}>
            <View style={styles.colBarangaySubmitted}><Text style={styles.tableHeaderText}>Barangay</Text></View>
            <View style={styles.colDocumentSubmitted}><Text style={styles.tableHeaderText}>Document</Text></View>
            <View style={styles.colDateTimeSubmitted}><Text style={[styles.tableHeaderText, { textAlign: 'right' }]}>Date Submitted</Text></View>
            <View style={styles.colActionSubmitted}><Text style={[styles.tableHeaderText, { textAlign: 'center' }]}>Action</Text></View>
          </View>
        )}
        {viewFilter === 'approved' && (
          <View style={styles.tableHeader}>
            <View style={styles.colBarangayApproved}><Text style={styles.tableHeaderText}>Barangay</Text></View>
            <View style={styles.colDocumentApproved}><Text style={styles.tableHeaderText}>Document</Text></View>
            <View style={styles.colDateTimeApproved}><Text style={[styles.tableHeaderText, { textAlign: 'right' }]}>Approved Date</Text></View>
            <View style={styles.colActionApproved}><Text style={[styles.tableHeaderText, { textAlign: 'center' }]}>Action</Text></View>
          </View>
        )}
        {viewFilter === 'revision' && (
          <View style={styles.tableHeader}>
            <View style={styles.colBarangay}><Text style={styles.tableHeaderText}>Barangay</Text></View>
            <View style={styles.colDocument}><Text style={styles.tableHeaderText}>Document</Text></View>
            <View style={styles.colStatus}><Text style={styles.tableHeaderText}>Status</Text></View>
            <View style={styles.colDateTime}><Text style={[styles.tableHeaderText, { textAlign: 'right' }]}>Date of Feedback</Text></View>
            <View style={styles.colAction}><Text style={[styles.tableHeaderText, { textAlign: 'center' }]}>Action</Text></View>
          </View>
        )}
        {rows.length === 0 ? (
          <View style={styles.emptyState}><Text style={styles.emptyText}>No results found.</Text></View>
        ) : (
          rows.map((item, idx) => (
            <TableRow key={item.id} item={item} isEven={idx % 2 !== 0}
              viewFilter={viewFilter} onView={(it) => setViewingItem(it)} />
          ))
        )}
      </View>
    </ScrollView>
  );

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.navy} />
      <View style={styles.layout}>
        {isMobile && sidebarVisible && (
          <TouchableOpacity style={styles.sidebarOverlay} activeOpacity={1} onPress={() => setSidebarVisible(false)} />
        )}
        {isMobile ? (sidebarVisible && renderSidebar()) : renderSidebar()}
        {renderContent()}
      </View>

      {/* Document Viewer Modal */}
      {viewingItem && (
        <DocumentViewer
          item={viewingItem}
          onClose={() => setViewingItem(null)}
          onApproved={() => { setViewingItem(null); fetchConsultationDocs(); fetchApprovedDocs(); setViewFilter('approved'); }}
          onRefreshDocs={() => { fetchConsultationDocs(); fetchApprovedDocs(); fetchReturnedDocs(); setViewFilter('revision'); }}
        />
      )}
    </SafeAreaView>
  );
}

// ─── MAIN STYLES ──────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: COLORS.navy },
  layout: { flex: 1, flexDirection: 'row' },
  sidebar: { width: 250, backgroundColor: COLORS.navy, alignItems: 'center', paddingTop: 20, paddingBottom: 24, paddingHorizontal: 10, zIndex: 10 },
  sidebarOverlay: { position: 'absolute', left: 0, top: 0, bottom: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 5 },
  logoPill: { marginTop: 20, width: 70, height: 70, borderRadius: 35, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center', marginBottom: 8, borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)' },
  logoImage: { width: 110, height: 110 },
  navItem: { width: '100%', paddingVertical: 12, paddingHorizontal: 12, borderRadius: 24, marginBottom: 8, alignItems: 'center', borderWidth: 1.5, borderColor: COLORS.white, backgroundColor: COLORS.navy },
  navItemActive: { backgroundColor: COLORS.white, borderColor: COLORS.white },
  navLabel: { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.8)', letterSpacing: 0.3 },
  navLabelActive: { color: '#000', fontWeight: '800' },
  logoutBtn:  { width: '100%', paddingVertical: 12, paddingHorizontal: 12, borderRadius: 24, marginTop: 8, alignItems: 'center', borderWidth: 1.5, borderColor: COLORS.white, backgroundColor: 'rgba(255,255,255,0.1)' },
  logoutText: { fontSize: 13, fontWeight: '600', color: '#ffffff', letterSpacing: 0.3 },
  main: { flex: 1, backgroundColor: COLORS.offWhite, borderTopLeftRadius: 20 },
  mainMobile: { borderTopLeftRadius: 0 },
  mainContent: { padding: 20, paddingBottom: 40 },
  mobileHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: COLORS.lightGray },
  menuBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.cardBg, alignItems: 'center', justifyContent: 'center' },
  menuIconContainer: { width: 20, height: 16, justifyContent: 'space-between' },
  menuLine: { width: 20, height: 2, backgroundColor: COLORS.navy, borderRadius: 1 },
  mobileTitle: { fontSize: 18, fontWeight: '800', color: COLORS.darkText },
  header: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 },
  headerSub: { fontSize: 10, fontWeight: '600', color: COLORS.subText, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 2 },
  headerTitle: { fontSize: 20, fontWeight: '900', color: COLORS.darkText, letterSpacing: 0.5, borderBottomWidth: 2, borderBottomColor: COLORS.lightGray },
  headerDesc: { fontSize: 15, fontWeight: '700', color: COLORS.darkText, marginTop: 6, lineHeight: 17 },
  bellBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.cardBg, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 6, elevation: 3 },
  bellWrapper: { width: 20, height: 22, alignItems: 'center' },
  bellBody: { width: 14, height: 12, borderRadius: 7, borderWidth: 2, borderColor: '#8B0000', marginTop: 4 },
  bellBottom: { width: 8, height: 4, borderBottomLeftRadius: 4, borderBottomRightRadius: 4, backgroundColor: '#8B0000', marginTop: -1 },
  bellDot: { position: 'absolute', top: 0, right: 1, width: 7, height: 7, borderRadius: 4, backgroundColor: COLORS.gold, borderWidth: 1.5, borderColor: COLORS.cardBg },
  notifBadge: { position: 'absolute', top: -2, right: -2, width: 16, height: 16, borderRadius: 8, backgroundColor: COLORS.gold, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: COLORS.white },
  notifBadgeText: { fontSize: 8, fontWeight: '900', color: COLORS.navy },
  monitorTabBar: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: COLORS.lightGray, marginBottom: 14, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.30, shadowRadius: 3, elevation: 6 },
  monitorTab: { flex: 1, paddingHorizontal: isMobile ? 8 : 40, backgroundColor: COLORS.navy, paddingVertical: 10, borderBottomWidth: 0, borderBottomColor: 'transparent', marginBottom: -1, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', alignItems: 'center' },
  monitorTabActive: { backgroundColor: COLORS.gold, borderRadius: 4, borderBottomColor: COLORS.gold, borderColor: COLORS.gold, shadowColor: COLORS.gold, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.4, shadowRadius: 4, elevation: 3 },
  monitorTabText: { fontSize: isMobile ? 10 : 13, fontWeight: '600', color: COLORS.white },
  monitorTabTextActive: { color: COLORS.darkText, fontWeight: '800' },
  filterRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14, flexWrap: 'wrap' },
  searchBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.white, borderRadius: 20, borderWidth: 1, borderColor: COLORS.lightGray, paddingHorizontal: 12, paddingVertical: 7, minWidth: 120, maxWidth: isMobile ? 140 : 190 },
  searchInput: { flex: 1, fontSize: 12, color: COLORS.darkText },
  filterToggleBtn: { borderRadius: 20, paddingHorizontal: isMobile ? 10 : 14, paddingVertical: 8 },
  filterToggleSubmittedOn: { backgroundColor: COLORS.gold, borderWidth: 1, borderColor: COLORS.midGray },
  filterToggleRevisionOn:  { backgroundColor: COLORS.gold, borderWidth: 1, borderColor: COLORS.midGray },
  filterToggleApprovedOn:  { backgroundColor: COLORS.gold, borderWidth: 1, borderColor: COLORS.midGray },
  filterToggleOff: { backgroundColor: COLORS.lightGray, borderWidth: 1, borderColor: '#D0D0D0' },
  filterToggleText: { fontSize: isMobile ? 10 : 11, fontWeight: '700' },
  tableContainer: { backgroundColor: COLORS.white, borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: COLORS.lightGray, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6 },
  tableHeader: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.white, paddingVertical: 11, paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: COLORS.lightGray },
  tableHeaderText: { fontSize: isMobile ? 10 : 12, fontWeight: '700', color: COLORS.darkText, letterSpacing: 0.2 },
  tableRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: COLORS.lightGray, backgroundColor: COLORS.white },
  tableRowEven: { backgroundColor: '#FAFAFA' },
  colBarangay: { flex: 1, paddingRight: 8 },
  colDocument: { flex: 1, paddingRight: 8 },
  colStatus:   { flex: 1, paddingRight: 8 },
  colDateTime: { flex: 1, alignItems: 'flex-start', paddingRight: 8 },
  colAction:   { width: isMobile ? 80 : 120, alignItems: 'flex-start' },
  colBarangayApproved:  { width: isMobile ? 90 : 180, paddingRight: 8 },
  colDocumentApproved:  { flex: 1, paddingRight: 8 },
  colDateTimeApproved:  { width: isMobile ? 70 : 110, alignItems: 'flex-end', paddingRight: 8 },
  colActionApproved:    { width: isMobile ? 60 : 80, alignItems: 'center' },
  approvedActionRow:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: isMobile ? 2 : 4 },
  actionIconWrap:       { padding: 4 },
  colBarangaySubmitted: { width: isMobile ? 90 : 160, paddingRight: 8 },
  colDocumentSubmitted: { flex: 1, paddingRight: 8 },
  colDateTimeSubmitted: { width: isMobile ? 70 : 120, alignItems: 'flex-end', paddingRight: 8 },
  colActionSubmitted:   { width: isMobile ? 44 : 56, alignItems: 'center' },
  approvedPortfolioTitle: { fontSize: isMobile ? 13 : 15, fontWeight: '700', color: COLORS.darkText, marginBottom: 10 },
  dropdownRow: { flexDirection: 'row', gap: 10, marginBottom: 12, zIndex: 50 },
  cellBarangay: { fontSize: isMobile ? 10 : 12, fontWeight: '600', color: COLORS.darkText },
  cellDocument: { fontSize: isMobile ? 10 : 11, color: COLORS.subText, lineHeight: 16 },
  cellStatus:   { fontSize: isMobile ? 9 : 11, color: COLORS.darkText, lineHeight: 14, flexShrink: 1 },
  cellTime:     { fontSize: 10, color: COLORS.darkText, fontWeight: '600' },
  cellDate:     { fontSize: 9, color: COLORS.subText, textAlign: 'right' },
  viewCommentsLink: { fontSize: isMobile ? 9 : 11, color: COLORS.navyLight, fontWeight: '600', textDecorationLine: 'underline' },
  viewBtn: { backgroundColor: COLORS.navy, borderRadius: 6, paddingHorizontal: isMobile ? 6 : 10, paddingVertical: 5 },
  viewBtnText: { fontSize: 9, fontWeight: '700', color: COLORS.white },
  emptyState: { alignItems: 'center', paddingVertical: 40 },
  emptyText:  { fontSize: 14, color: COLORS.midGray },
});