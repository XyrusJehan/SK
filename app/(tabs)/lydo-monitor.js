import React, { useState, useRef } from 'react';
import {
  View, Text, TextInput, ScrollView, TouchableOpacity,
  StyleSheet, SafeAreaView, StatusBar, Dimensions,
  Modal, Alert, KeyboardAvoidingView, Platform, Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useNav } from './navContext';
import { useAuth } from './authContext';

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

const NAV_TABS     = ['Home', 'Documents', 'Monitor'];
const MONITOR_TABS = ['Consultation', 'Budget', 'Report', 'Submitted'];

// ─── CBYDP DOCUMENT SECTIONS (tappable for highlight) ────────────────────────
const DOC_SECTIONS = [
  { id: 's1',  text: 'Barangay ___________________' },
  { id: 's2',  text: 'Sangguniang Kabataan' },
  { id: 's3',  text: 'COMPREHENSIVE BARANGAY YOUTH DEVELOPMENT PLAN (CBYDP)' },
  { id: 's4',  text: 'Region: ___    Province: ___________    Municipality: ___________' },
  { id: 's5',  text: 'COMPREHENSIVE BARANGAY YOUTH DEVELOPMENT PLAN (CBYDP)' },
  { id: 's6',  text: 'CENTER OF PARTICIPATION _______________' },
  { id: 's7',  text: 'Agenda Statement:' },
  { id: 's8',  text: '____________________________________________________________' },
  { id: 's9',  text: '____________________________________________________________' },
];

const TABLE_DATA = {
  Consultation: [
    { id: '1', barangay: 'Barangay San Jose',     document: 'Comprehensive Barangay Youth Development Program', time: '3:00 PM',  feedbackDate: '1/02/2026', submittedDate: '1/02/2026', approvedDate: null,        status: 'returned',    commentCount: 5 },
    { id: '2', barangay: 'Barangay San Roque',    document: 'Comprehensive Barangay Youth Development Program', time: '3:00 PM',  feedbackDate: '1/02/2026', submittedDate: '1/02/2026', approvedDate: '1/05/2026', status: 'awaiting',    commentCount: 5 },
    { id: '3', barangay: 'Barangay Santo Cristo', document: 'Comprehensive Barangay Youth Development Program', time: '3:00 PM',  feedbackDate: '1/02/2026', submittedDate: '1/02/2026', approvedDate: null,        status: 'resubmitted', commentCount: 5 },
  ],
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
  Submitted: [
    { id: '1', barangay: 'Barangay San Jose',   document: 'Comprehensive Barangay Youth Development Program', time: '3:00 PM',  feedbackDate: '12/15/2025', approvedDate: '12/20/2025' },
    { id: '2', barangay: 'Barangay San Bueno',  document: 'Financial Report Summary 2025',                    time: '2:30 PM',  feedbackDate: '12/18/2025', approvedDate: null },
    { id: '3', barangay: 'Barangay San Isidro', document: 'Resolutions & Ordinances Compilation',             time: '9:00 AM',  feedbackDate: '12/20/2025', approvedDate: '12/24/2025' },
    { id: '4', barangay: 'Barangay Antipolo',   document: 'Work Plan 2026',                                   time: '10:00 AM', feedbackDate: '12/22/2025', approvedDate: null },
    { id: '5', barangay: 'Barangay Mamala',     document: 'Event Reports — Year-End Activities',              time: '3:00 PM',  feedbackDate: '12/28/2025', approvedDate: '12/30/2025' },
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
const CBYDPTable = () => (
  <View style={docStyles.table}>
    {/* Header row */}
    <View style={docStyles.tableRow}>
      {['Youth Development Concern', 'Objective', 'Performance Indicator', 'Target', '', '', 'PPAs', 'Budget', 'Person Responsible'].map((h, i) => (
        <View key={i} style={[docStyles.th, i === 3 && { flex: 0, width: 60 }]}>
          <Text style={docStyles.thText}>{h}</Text>
        </View>
      ))}
    </View>
    {/* Sub-header for Target */}
    <View style={docStyles.tableRow}>
      {['', '', '', '[Year 1]', '[Year 2]', '[Year 3]', '', '', ''].map((h, i) => (
        <View key={i} style={docStyles.th}>
          <Text style={docStyles.thSubText}>{h}</Text>
        </View>
      ))}
    </View>
    {/* Empty data rows */}
    {[0, 1, 2, 3].map((r) => (
      <View key={r} style={docStyles.tableDataRow}>
        {Array(9).fill('').map((_, c) => (
          <View key={c} style={docStyles.td} />
        ))}
      </View>
    ))}
  </View>
);

// ─── DOCUMENT VIEWER (view-only) ──────────────────────────────────────────────
const DocumentViewer = ({ item, onClose, onCommentMode }) => {
  const [menuSaved, setMenuSaved] = useState(false);

  return (
    <Modal visible animationType="slide" statusBarTranslucent>
      <SafeAreaView style={dvStyles.safe}>
        {/* Top bar */}
        <View style={dvStyles.topBar}>
          <TouchableOpacity style={dvStyles.closeBtn} onPress={onClose} activeOpacity={0.8}>
            <Text style={dvStyles.closeTxt}>✕</Text>
          </TouchableOpacity>
          <View style={dvStyles.topMid}>
            <Text style={dvStyles.topTitle} numberOfLines={1}>{item.document}</Text>
            <Text style={dvStyles.topSub}>{item.barangay}</Text>
          </View>
          <ThreeDotMenu
            onSave={() => { setMenuSaved(true); Alert.alert('Saved', 'Document saved successfully.'); }}
            onEdit={() => Alert.alert('Edit', 'Edit mode coming soon.')}
            onReturn={onClose}
          />
        </View>

        {/* Document */}
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
                <View style={dvStyles.sigBlock}>
                  <View style={dvStyles.sigLine} />
                  <Text style={dvStyles.sigLabel}>SK Secretary</Text>
                </View>
                <View style={dvStyles.sigBlock}>
                  <View style={dvStyles.sigLine} />
                  <Text style={dvStyles.sigLabel}>SK Chairperson</Text>
                </View>
              </View>
            </View>
          </View>
        </ScrollView>

        {/* Bottom action buttons */}
        <View style={dvStyles.bottomBar}>
          <TouchableOpacity
            style={dvStyles.approveBtn}
            onPress={() => Alert.alert('Approved', 'Document has been approved.')}
            activeOpacity={0.85}
          >
            <Text style={dvStyles.approveTxt}>Approve</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={dvStyles.commentBtn}
            onPress={onCommentMode}
            activeOpacity={0.85}
          >
            <Text style={dvStyles.commentTxt}>Comment</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
};

const dvStyles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.offWhite },
  topBar: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 12,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1, borderBottomColor: COLORS.lightGray,
    gap: 10, zIndex: 10,
  },
  closeBtn: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: COLORS.lightGray, alignItems: 'center', justifyContent: 'center',
  },
  closeTxt: { fontSize: 14, fontWeight: '700', color: COLORS.darkText },
  topMid:   { flex: 1 },
  topTitle: { fontSize: 13, fontWeight: '800', color: COLORS.darkText },
  topSub:   { fontSize: 11, color: COLORS.subText },
  docWrap:  { padding: 16, alignItems: 'center' },
  docPage: {
    backgroundColor: COLORS.white, width: '100%', maxWidth: 480,
    borderRadius: 6, padding: 24,
    elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08, shadowRadius: 8,
  },
  docCenter: { textAlign: 'center', fontSize: 12, color: COLORS.darkText, lineHeight: 18 },
  docBold:   { fontWeight: '700' },
  docLine:   { fontSize: 12, color: COLORS.darkText, lineHeight: 20, marginTop: 4 },
  divider:   { height: 1, backgroundColor: COLORS.lightGray, marginVertical: 8 },
  sigRow:    { flexDirection: 'row', justifyContent: 'space-around', marginTop: 20 },
  sigBlock:  { alignItems: 'center', width: 140 },
  sigLine:   { width: '100%', height: 1, backgroundColor: COLORS.darkText, marginBottom: 4 },
  sigLabel:  { fontSize: 11, fontWeight: '600', color: COLORS.darkText },
  bottomBar: {
    flexDirection: 'row', justifyContent: 'center', gap: 12,
    padding: 16, backgroundColor: COLORS.white,
    borderTopWidth: 1, borderTopColor: COLORS.lightGray,
  },
  approveBtn: {
    backgroundColor: COLORS.approve, borderRadius: 24,
    paddingHorizontal: 36, paddingVertical: 12,
  },
  approveTxt: { fontSize: 14, fontWeight: '800', color: COLORS.white },
  commentBtn: {
    backgroundColor: COLORS.comment, borderRadius: 24,
    paddingHorizontal: 36, paddingVertical: 12,
    borderWidth: 1.5, borderColor: COLORS.midGray,
  },
  commentTxt: { fontSize: 14, fontWeight: '700', color: COLORS.darkText },
});

// ─── COMMENT MODE ─────────────────────────────────────────────────────────────
const CommentMode = ({ item, onClose }) => {
  const [highlighted, setHighlighted] = useState(null); // section id
  const [comments, setComments]       = useState([]);   // [{sectionId, text, time}]
  const [inputText, setInputText]     = useState('');
  const [panelOpen, setPanelOpen]     = useState(false);
  const [saved, setSaved]             = useState(false);

  const handleSectionTap = (sId) => {
    setHighlighted(sId);
    setPanelOpen(true);
    setInputText('');
  };

  const handleAddComment = () => {
    if (!inputText.trim() || !highlighted) return;
    const section = DOC_SECTIONS.find(s => s.id === highlighted);
    setComments(prev => [
      ...prev,
      { id: Date.now().toString(), sectionId: highlighted, sectionText: section?.text ?? '', text: inputText.trim(), time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) },
    ]);
    setInputText('');
    setPanelOpen(false);
    setHighlighted(null);
  };

  const handleSave = () => {
    setSaved(true);
    Alert.alert('Saved', `${comments.length} comment(s) saved successfully.`);
  };

  const handleEdit = () => {
    Alert.alert('Edit', 'Edit mode: tap any highlighted section to revise its comment.');
  };

  const panelWidth = isMobile ? SCREEN_WIDTH * 0.4 : 220;

  return (
    <Modal visible animationType="slide" statusBarTranslucent>
      <SafeAreaView style={cmStyles.safe}>
        {/* Top bar */}
        <View style={cmStyles.topBar}>
          <TouchableOpacity style={cmStyles.closeBtn} onPress={onClose} activeOpacity={0.8}>
            <Text style={cmStyles.closeTxt}>✕</Text>
          </TouchableOpacity>
          <View style={cmStyles.topMid}>
            <Text style={cmStyles.topTitle} numberOfLines={1}>{item.document}</Text>
            <Text style={cmStyles.topSub}>Tap any section to highlight & comment</Text>
          </View>
          <ThreeDotMenu
            onSave={handleSave}
            onEdit={handleEdit}
            onReturn={onClose}
          />
        </View>

        {/* Body — doc + side panel */}
        <View style={cmStyles.body}>

          {/* Document with tappable sections */}
          <ScrollView style={cmStyles.docScroll} contentContainerStyle={cmStyles.docWrap} showsVerticalScrollIndicator={false}>
            <View style={cmStyles.docPage}>
              {DOC_SECTIONS.map((sec) => {
                const isHighlighted = highlighted === sec.id;
                const hasComment    = comments.some(c => c.sectionId === sec.id);
                return (
                  <TouchableOpacity
                    key={sec.id}
                    onPress={() => handleSectionTap(sec.id)}
                    activeOpacity={0.8}
                    style={[
                      cmStyles.section,
                      isHighlighted && cmStyles.sectionHighlight,
                      hasComment    && cmStyles.sectionCommented,
                    ]}
                  >
                    <Text style={[
                      cmStyles.sectionText,
                      sec.id === 's3' || sec.id === 's5' ? cmStyles.boldText : null,
                      sec.id === 's1' || sec.id === 's2' || sec.id === 's3' || sec.id === 's5' ? cmStyles.centerText : null,
                    ]}>
                      {sec.text}
                    </Text>
                    {hasComment && (
                      <View style={cmStyles.commentIndicator}>
                        <Text style={cmStyles.commentIndicatorTxt}>
                          💬 {comments.filter(c => c.sectionId === sec.id).length}
                        </Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}

              {/* Table placeholder */}
              <View style={cmStyles.tablePlaceholder}>
                <CBYDPTable />
              </View>

              {/* Signatures */}
              <View style={{ marginTop: 16 }}>
                <Text style={[cmStyles.sectionText, cmStyles.centerText]}>Prepared by:</Text>
                <View style={dvStyles.sigRow}>
                  <View style={dvStyles.sigBlock}>
                    <View style={dvStyles.sigLine} />
                    <Text style={dvStyles.sigLabel}>SK Secretary</Text>
                  </View>
                  <View style={dvStyles.sigBlock}>
                    <View style={dvStyles.sigLine} />
                    <Text style={dvStyles.sigLabel}>SK Chairperson</Text>
                  </View>
                </View>
              </View>
            </View>
          </ScrollView>

          {/* Side Comments Panel */}
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={[cmStyles.panel, { width: panelWidth }]}
          >
            <View style={cmStyles.panelHeader}>
              <Text style={cmStyles.panelTitle}>Comments</Text>
              <Text style={cmStyles.panelSub}>Critique & Feedback</Text>
            </View>

            <ScrollView style={cmStyles.commentList} showsVerticalScrollIndicator={false}>
              {comments.length === 0 ? (
                <Text style={cmStyles.noComments}>Tap a section in the document to add a comment.</Text>
              ) : (
                comments.map((c) => (
                  <View key={c.id} style={cmStyles.commentCard}>
                    <View style={cmStyles.commentCardHeader}>
                      <View style={cmStyles.commentDot} />
                      <Text style={cmStyles.commentCardSection} numberOfLines={1}>{c.sectionText}</Text>
                      <Text style={cmStyles.commentCardTime}>{c.time}</Text>
                    </View>
                    <Text style={cmStyles.commentCardText}>{c.text}</Text>
                  </View>
                ))
              )}
            </ScrollView>

            {/* Inline comment input */}
            {panelOpen && highlighted && (
              <View style={cmStyles.inputArea}>
                <Text style={cmStyles.inputLabel}>
                  Commenting on: "{DOC_SECTIONS.find(s => s.id === highlighted)?.text?.slice(0, 30)}…"
                </Text>
                <TextInput
                  style={cmStyles.input}
                  placeholder="Add a comment…"
                  placeholderTextColor={COLORS.midGray}
                  value={inputText}
                  onChangeText={setInputText}
                  multiline
                  autoFocus
                />
                <View style={cmStyles.inputBtnRow}>
                  <TouchableOpacity style={cmStyles.cancelBtn} onPress={() => { setPanelOpen(false); setHighlighted(null); }}>
                    <Text style={cmStyles.cancelTxt}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={cmStyles.addBtn} onPress={handleAddComment}>
                    <Text style={cmStyles.addTxt}>Add</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </KeyboardAvoidingView>
        </View>
      </SafeAreaView>
    </Modal>
  );
};

const cmStyles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.offWhite },
  topBar: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 12,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1, borderBottomColor: COLORS.lightGray, gap: 10, zIndex: 10,
  },
  closeBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: COLORS.lightGray, alignItems: 'center', justifyContent: 'center' },
  closeTxt: { fontSize: 14, fontWeight: '700', color: COLORS.darkText },
  topMid:   { flex: 1 },
  topTitle: { fontSize: 13, fontWeight: '800', color: COLORS.darkText },
  topSub:   { fontSize: 10, color: COLORS.navy },
  body:     { flex: 1, flexDirection: isMobile ? 'column' : 'row' },

  // Doc scroll
  docScroll:  { flex: isMobile ? 1 : 1 },
  docWrap:    { padding: isMobile ? 8 : 12, alignItems: 'center' },
  docPage:    {
    backgroundColor: COLORS.white, width: '100%',
    borderRadius: 6, padding: isMobile ? 12 : 18,
    elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 6,
    marginBottom: 12,
  },

  // Tappable sections
  section: {
    paddingVertical: 5, paddingHorizontal: 4,
    borderRadius: 4, marginBottom: 2,
    borderWidth: 1, borderColor: 'transparent',
  },
  sectionHighlight:  { backgroundColor: COLORS.highlight, borderColor: COLORS.highlightBorder },
  sectionCommented:  { borderColor: COLORS.commentDot + '60', borderWidth: 1 },
  sectionText:       { fontSize: isMobile ? 11 : 12, color: COLORS.darkText, lineHeight: 18 },
  boldText:          { fontWeight: '700' },
  centerText:        { textAlign: 'center' },
  commentIndicator:  { position: 'absolute', top: 2, right: 4 },
  commentIndicatorTxt: { fontSize: 10, color: COLORS.commentDot },
  tablePlaceholder:  { marginTop: 12 },

  // Side Panel
  panel: {
    backgroundColor: COLORS.white,
    borderLeftWidth: isMobile ? 0 : 1, borderTopWidth: isMobile ? 1 : 0,
    borderLeftColor: COLORS.lightGray, borderTopColor: COLORS.lightGray,
    flexShrink: 0,
    maxHeight: isMobile ? 150 : undefined,
  },
  panelHeader: {
    paddingHorizontal: 12, paddingTop: 14, paddingBottom: 10,
    borderBottomWidth: 1, borderBottomColor: COLORS.lightGray,
  },
  panelTitle:  { fontSize: 13, fontWeight: '800', color: COLORS.darkText },
  panelSub:    { fontSize: 10, color: COLORS.subText, marginTop: 2 },
  commentList: { flex: 1, paddingHorizontal: 10, paddingTop: 8 },
  noComments:  { fontSize: 11, color: COLORS.midGray, textAlign: 'center', marginTop: 20, lineHeight: 16 },

  commentCard: {
    backgroundColor: '#FFFBEF', borderRadius: 8, padding: 10,
    marginBottom: 8, borderLeftWidth: 3, borderLeftColor: COLORS.gold,
    elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 3,
  },
  commentCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 4 },
  commentDot:        { width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.commentDot, flexShrink: 0 },
  commentCardSection:{ flex: 1, fontSize: 10, color: COLORS.subText, fontStyle: 'italic' },
  commentCardTime:   { fontSize: 9, color: COLORS.midGray },
  commentCardText:   { fontSize: 12, color: COLORS.darkText, lineHeight: 17 },

  // Input area
  inputArea: {
    borderTopWidth: 1, borderTopColor: COLORS.lightGray,
    padding: 10, backgroundColor: COLORS.white,
  },
  inputLabel: { fontSize: 10, color: COLORS.navy, fontWeight: '600', marginBottom: 6, lineHeight: 14 },
  input: {
    backgroundColor: COLORS.offWhite, borderRadius: 8,
    borderWidth: 1, borderColor: COLORS.lightGray,
    paddingHorizontal: 10, paddingVertical: 8,
    fontSize: 12, color: COLORS.darkText, minHeight: 60, textAlignVertical: 'top',
  },
  inputBtnRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 8 },
  cancelBtn:   { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8, backgroundColor: COLORS.lightGray },
  cancelTxt:   { fontSize: 12, fontWeight: '600', color: COLORS.subText },
  addBtn:      { paddingHorizontal: 16, paddingVertical: 7, borderRadius: 8, backgroundColor: COLORS.navy },
  addTxt:      { fontSize: 12, fontWeight: '700', color: COLORS.white },
});

// ─── DROPDOWN (ported from lydo-monitor-report) ───────────────────────────────
const Dropdown = ({ label, value, options, onSelect }) => {
  const [open, setOpen] = useState(false);
  return (
    <View style={DD.wrap}>
      <TouchableOpacity
        style={DD.btn}
        onPress={() => setOpen(o => !o)}
        activeOpacity={0.8}
      >
        <Text style={DD.label}>{label}</Text>
        <Text style={DD.value}>{value}</Text>
        <Text style={DD.arrow}>▾</Text>
      </TouchableOpacity>
      {open && (
        <View style={DD.menu}>
          {options.map(opt => (
            <TouchableOpacity
              key={opt}
              style={[DD.item, opt === value && DD.itemActive]}
              onPress={() => { onSelect(opt); setOpen(false); }}
              activeOpacity={0.75}
            >
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
  const [barangayFilter, setBarangayFilter]         = useState('');
  const [documentFilter, setDocumentFilter]         = useState('');
  const [notifCount]                            = useState(2);
  const [sidebarVisible, setSidebarVisible]     = useState(false);

  // Document modal states
  const [viewingItem, setViewingItem]   = useState(null); // open view modal
  const [commentItem, setCommentItem]   = useState(null); // open comment modal

  const handleNavPress = (tab) => {
    setActiveTab(tab);
    setSidebarVisible(false);
    if (tab === 'Home')      router.push('/(tabs)/lydo-home');
    if (tab === 'Documents') router.push('/(tabs)/lydo-document');
  };

  const handleLogout = () => {
    logout();
    router.replace('/');
  };

  const rows = (TABLE_DATA[activeMonitorTab] || [])
    .filter(r => {
      if (viewFilter === 'approved') return r.approvedDate !== null;
      if (viewFilter === 'revision') return r.status === 'returned' || r.status === 'awaiting';
      return true;
    })
    .filter(r =>
      r.barangay.toLowerCase().includes(searchText.toLowerCase()) ||
      r.document.toLowerCase().includes(searchText.toLowerCase())
    )
    .filter(r => barangayFilter === '' || r.barangay.toLowerCase().includes(barangayFilter.toLowerCase()))
    .filter(r => documentFilter === '' || r.document.toLowerCase().includes(documentFilter.toLowerCase()));

  const dateColLabel = viewFilter === 'approved' ? 'Approved Date' : 'Date of Feedback';

  const renderSidebar = () => (
    <View style={styles.sidebar}>
      <View style={styles.logoPill}>
        <Image
          source={require('./../../assets/images/lydo-logo.png')}
          style={styles.logoImage}
          resizeMode="contain"
        />
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
              onPress={() => tab === 'Budget' ? router.push('/(tabs)/lydo-monitor-budget') : tab === 'Report' ? router.push('/(tabs)/lydo-monitor-report') : setActiveMonitorTab(tab)} activeOpacity={0.8}>
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
        <TouchableOpacity
          style={[styles.filterToggleBtn, viewFilter === 'submitted' ? styles.filterToggleSubmittedOn : styles.filterToggleOff]}
          onPress={() => setViewFilter('submitted')} activeOpacity={0.8}>
          <Text style={[styles.filterToggleText, { color: viewFilter === 'submitted' ? COLORS.darkText : COLORS.subText }]}>
            Submitted Proposal
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterToggleBtn, viewFilter === 'approved' ? styles.filterToggleApprovedOn : styles.filterToggleOff]}
          onPress={() => setViewFilter('approved')} activeOpacity={0.8}>
          <Text style={[styles.filterToggleText, { color: viewFilter === 'approved' ? COLORS.black : COLORS.subText }]}>
            Approved
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterToggleBtn, viewFilter === 'revision' ? styles.filterToggleRevisionOn : styles.filterToggleOff]}
          onPress={() => setViewFilter('revision')} activeOpacity={0.8}>
          <Text style={[styles.filterToggleText, { color: viewFilter === 'revision' ? COLORS.darkText : COLORS.subText }]}>
            For Revision
          </Text>
        </TouchableOpacity>
      </View>

      {/* Dropdown filter row — Submitted Proposal only */}
      {viewFilter === 'submitted' && (
        <View style={styles.dropdownRow}>
          <Dropdown
            label="Barangay"
            value={barangayFilter || 'All'}
            options={['All', ...new Set((TABLE_DATA[activeMonitorTab] || []).map(r => r.barangay))]}
            onSelect={v => setBarangayFilter(v === 'All' ? '' : v)}
          />
          <Dropdown
            label="Document"
            value={documentFilter || 'All'}
            options={['All', ...new Set((TABLE_DATA[activeMonitorTab] || []).map(r => r.document))]}
            onSelect={v => setDocumentFilter(v === 'All' ? '' : v)}
          />
        </View>
      )}

      {/* Approved portfolio heading */}
      {viewFilter === 'approved' && (
        <Text style={styles.approvedPortfolioTitle}>Federation  Portfolio of Approved Plans</Text>
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

        {renderContent()}
      </View>

      {/* View Document Modal */}
      {viewingItem && (
        <DocumentViewer
          item={viewingItem}
          onClose={() => setViewingItem(null)}
          onCommentMode={() => { setCommentItem(viewingItem); setViewingItem(null); }}
        />
      )}

      {/* Comment Mode Modal */}
      {commentItem && (
        <CommentMode
          item={commentItem}
          onClose={() => setCommentItem(null)}
        />
      )}
    </SafeAreaView>
  );
}

// ─── CBYDP mini-table styles ───────────────────────────────────────────────────
const docStyles = StyleSheet.create({
  table:       { borderWidth: 1, borderColor: '#ccc', marginTop: 12 },
  tableRow:    { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#ccc' },
  tableDataRow:{ flexDirection: 'row', height: 28, borderBottomWidth: 1, borderBottomColor: '#eee' },
  th: { flex: 1, borderRightWidth: 1, borderRightColor: '#ccc', padding: 3, justifyContent: 'center', alignItems: 'center' },
  td: { flex: 1, borderRightWidth: 1, borderRightColor: '#eee' },
  thText:    { fontSize: 7, fontWeight: '700', color: '#333', textAlign: 'center', lineHeight: 10 },
  thSubText: { fontSize: 7, color: '#555', textAlign: 'center' },
});

// ─── MAIN STYLES ──────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: COLORS.navy },
  layout: { flex: 1, flexDirection: 'row' },
  sidebar: {
    width: 250, backgroundColor: COLORS.navy,
    alignItems: 'center', paddingTop: 20, paddingBottom: 24, paddingHorizontal: 10, zIndex: 10,
  },
  sidebarOverlay: { position: 'absolute', left: 0, top: 0, bottom: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 5 },
  logoPill: { width: 70, height: 70, borderRadius: 35, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center', marginBottom: 8, borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)' },
  logoImage: {
    width: 73,
    height: 73,
  },
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
  headerTitle: { fontSize: 20, fontWeight: '900', color: COLORS.darkText, letterSpacing: 0.5, borderBottomWidth: 2, borderBottomColor: COLORS.lightGray, },
  headerDesc: { fontSize: 15, fontWeight: '700', color: COLORS.darkText, marginTop: 6, lineHeight: 17 },
  bellBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.cardBg, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 6, elevation: 3 },
  bellWrapper: { width: 20, height: 22, alignItems: 'center' },
  bellBody: { width: 14, height: 12, borderRadius: 7, borderWidth: 2, borderColor: '#8B0000', marginTop: 4 },
  bellBottom: { width: 8, height: 4, borderBottomLeftRadius: 4, borderBottomRightRadius: 4, backgroundColor: '#8B0000', marginTop: -1 },
  bellDot: { position: 'absolute', top: 0, right: 1, width: 7, height: 7, borderRadius: 4, backgroundColor: COLORS.gold, borderWidth: 1.5, borderColor: COLORS.cardBg },
  notifBadge: { position: 'absolute', top: -2, right: -2, width: 16, height: 16, borderRadius: 8, backgroundColor: COLORS.gold, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: COLORS.white },
  notifBadgeText: { fontSize: 8, fontWeight: '900', color: COLORS.navy },
  monitorTabBar: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: COLORS.lightGray, marginBottom: 14, overflowX: 'hidden', overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.30, shadowRadius: 3, elevation: 6,},
  monitorTab: { flex: 1, paddingHorizontal: isMobile ? 8 : 40, backgroundColor: COLORS.navy, paddingVertical: 10, borderBottomWidth: 0, borderBottomColor: 'transparent', marginBottom: -1, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', alignItems: 'center' },
  monitorTabActive: { backgroundColor: COLORS.gold, borderRadius: 4, borderBottomColor: COLORS.gold, borderColor: COLORS.gold, shadowColor: COLORS.gold, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.4, shadowRadius: 4, elevation: 3 },
  monitorTabText: { fontSize: isMobile ? 10 : 13, fontWeight: '600', color: COLORS.white },
  monitorTabTextActive: { color: COLORS.darkText, fontWeight: '800' },
  filterRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14, flexWrap: 'wrap' },
  searchBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.white, borderRadius: 20, borderWidth: 1, borderColor: COLORS.lightGray, paddingHorizontal: 12, paddingVertical: 7, minWidth: 120, maxWidth: isMobile ? 140 : 190 },
  searchInput: { flex: 1, fontSize: 12, color: COLORS.darkText },
  filterToggleBtn: { borderRadius: 20, paddingHorizontal: isMobile ? 10 : 14, paddingVertical: 8 },
  filterToggleSubmittedOn: { backgroundColor: COLORS.gold, borderWidth: 1, borderColor: COLORS.midGray },
  filterToggleRevisionOn: { backgroundColor: COLORS.gold, borderWidth: 1, borderColor: COLORS.midGray },
  filterToggleApprovedOn: { backgroundColor: COLORS.gold, borderWidth: 1, borderColor: COLORS.midGray },
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
  // Approved view columns
  colBarangayApproved:  { width: isMobile ? 90 : 180, paddingRight: 8 },
  colDocumentApproved:  { flex: 1, paddingRight: 8 },
  colDateTimeApproved:  { width: isMobile ? 80 : 130, alignItems: 'flex-end' },
  // Submitted view columns
  colBarangaySubmitted: { width: isMobile ? 90 : 160, paddingRight: 8 },
  colDocumentSubmitted: { flex: 1, paddingRight: 8 },
  colDateTimeSubmitted: { width: isMobile ? 70 : 120, alignItems: 'flex-end', paddingRight: 8 },
  colActionSubmitted:   { width: isMobile ? 44 : 56, alignItems: 'center' },
  approvedPortfolioTitle: { fontSize: isMobile ? 13 : 15, fontWeight: '700', color: COLORS.darkText, marginBottom: 10 },
  dropdownRow: { flexDirection: 'row', gap: 10, marginBottom: 12, zIndex: 50 },
  cellBarangay: { fontSize: isMobile ? 10 : 12, fontWeight: '600', color: COLORS.darkText },
  cellDocument: { fontSize: isMobile ? 10 : 11, color: COLORS.subText, lineHeight: 16 },
  cellStatus:   { fontSize: isMobile ? 9 : 11, color: COLORS.darkText, lineHeight: 14, flexShrink: 1 },
  cellTime:     { fontSize: 9, color: COLORS.subText, textAlign: 'right' },
  cellDate:     { fontSize: 9, color: COLORS.subText, textAlign: 'right' },
  viewCommentsLink: { fontSize: isMobile ? 9 : 11, color: COLORS.navyLight, fontWeight: '600', textDecorationLine: 'underline' },
  viewBtn: { backgroundColor: COLORS.navy, borderRadius: 6, paddingHorizontal: isMobile ? 6 : 10, paddingVertical: 5 },
  viewBtnText: { fontSize: 9, fontWeight: '700', color: COLORS.white },
  emptyState: { alignItems: 'center', paddingVertical: 40 },
  emptyText:  { fontSize: 14, color: COLORS.midGray },
});