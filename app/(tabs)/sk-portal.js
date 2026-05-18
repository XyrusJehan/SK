import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, ScrollView, TouchableOpacity,
  StyleSheet, SafeAreaView, StatusBar, Dimensions,
  Modal, Alert, Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useNav } from './navContext';
import { useAuth } from './authContext';
import { supabase } from '../../utils/supabase';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const isMobile = SCREEN_WIDTH < 768;

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
const NAV_TABS    = ['Dashboard', 'Documents', 'Planning', 'Portal', 'Account'];
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
  const [showUploadYearDropdown, setShowUploadYearDropdown] = useState(false);
  const [publishedDocs, setPublishedDocs] = useState([]);
  const [feedbackItems, setFeedbackItems] = useState([]);

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
          year: doc.year || new Date(doc.published_at).getFullYear().toString(),
          uploadedAt: new Date(doc.published_at).toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' }),
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
          date: new Date(c.created_at).toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' }),
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
        const active = activeTab === tab || (tab === 'Portal' && activeTab === 'Portal');
        return (
          <TouchableOpacity
            key={tab}
            style={[styles.navItem, active && styles.navItemActive]}
            onPress={() => tab === 'Portal' ? setActiveTab('Portal') : handleNavPress(tab)}
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
              onPress={() => { Alert.alert('View', 'Opening document…'); setShowDocModal(false); }}
            >
              <Text style={[styles.modalActionText, { color: COLORS.navy }]}>👁  View</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalActionBtn, { backgroundColor: '#EAFBEA' }]}
              onPress={() => { Alert.alert('Download', 'Downloading…'); setShowDocModal(false); }}
            >
              <Text style={[styles.modalActionText, { color: '#2E7D32' }]}>⬇  Download</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalActionBtn, { backgroundColor: '#FFEBEE' }]}
              onPress={() => { Alert.alert('Unpublish', 'Remove from portal?'); setShowDocModal(false); }}
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
  const UPLOAD_CATEGORIES = [
    'Comprehensive Barangay Youth Development Plan',
    'Annual Barangay Youth Investment Program',
    'Approved Annual Budget',
    'Quarterly Register of Cash in Bank',
  ];
  const UPLOAD_YEARS = ['2026', '2025', '2024', '2023'];

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
          {/* Header */}
          <View style={styles.uploadModalHeader}>
            <Text style={styles.uploadModalHeaderText}>UPLOAD NEW DOCUMENT TO PUBLIC PORTAL</Text>
            <TouchableOpacity onPress={() => setShowUploadModal(false)} style={styles.uploadModalClose}>
              <Text style={styles.uploadModalCloseText}>✕</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.uploadModalBody}>
            {/* LEFT — Step 1 */}
            <View style={styles.uploadModalLeft}>
              <Text style={styles.uploadStepLabel}>Step 1: Choose Document</Text>

              {/* Drag & drop zone */}
              <TouchableOpacity
                style={[styles.dropZone, uploadFile && styles.dropZoneActive]}
                activeOpacity={0.8}
                onPress={() => Alert.alert('Select File', 'File picker would open here.')}
              >
                <Text style={styles.dropZoneTopLabel}>Drag & Drop</Text>
                <View style={styles.dropZoneIconWrap}>
                  {/* Upload arrow icon */}
                  <View style={styles.uploadArrowBody} />
                  <View style={styles.uploadArrowHead} />
                </View>
                {uploadFile ? (
                  <Text style={styles.dropZoneFileName} numberOfLines={2}>{uploadFile}</Text>
                ) : (
                  <Text style={styles.dropZoneSubLabel}>DRAG & DROP{'\n'}DOCUMENT HERE</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.selectFileBtn}
                activeOpacity={0.8}
                onPress={() => { setUploadFile('document_sample.pdf'); Alert.alert('File Selected', 'document_sample.pdf'); }}
              >
                <Text style={styles.selectFileBtnText}>Select Document to Upload</Text>
              </TouchableOpacity>
            </View>

            {/* RIGHT — Step 2 & 3 */}
            <View style={styles.uploadModalRight}>
              <Text style={styles.uploadStepLabel}>Step 2 : Add Document Details</Text>

              {/* Document Title */}
              <Text style={styles.uploadFieldLabel}>Document Title</Text>
              <TextInput
                style={styles.uploadTextInput}
                value={uploadTitle}
                onChangeText={setUploadTitle}
                placeholder=""
                placeholderTextColor={COLORS.midGray}
              />

              {/* Category & Year */}
              <View style={styles.uploadRowFields}>
                {/* Category dropdown */}
                <View style={{ flex: 1.6 }}>
                  <Text style={styles.uploadFieldLabel}>Document Category</Text>
                  <View style={{ position: 'relative', zIndex: 100 }}>
                    <TouchableOpacity
                      style={styles.uploadDropdownBtn}
                      onPress={() => { setShowUploadCatDropdown(v => !v); setShowUploadYearDropdown(false); }}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.uploadDropdownText, !uploadCategory && { color: COLORS.midGray }]} numberOfLines={1}>
                        {uploadCategory || ''}
                      </Text>
                      <Text style={styles.uploadDropdownCaret}>▾</Text>
                    </TouchableOpacity>
                    {showUploadCatDropdown && ( 
                      <View style={[styles.filterDropdownPanel, { minWidth: 220, zIndex: 100 }]}>
                        {UPLOAD_CATEGORIES.map(opt => (
                          <TouchableOpacity
                            key={opt}
                            style={[styles.filterDropdownItem, uploadCategory === opt && styles.filterDropdownItemActive]}
                            onPress={() => { setUploadCategory(opt); setShowUploadCatDropdown(false); }}
                          >
                            <Text style={[styles.filterDropdownItemText, uploadCategory === opt && { color: COLORS.navy, fontWeight: '700' }]} numberOfLines={2}>
                              {opt}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}
                  </View>
                </View>

                {/* Year dropdown */}
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={styles.uploadFieldLabel}>Year</Text>
                  <View style={{ position: 'relative', zIndex: 1000 }}>
                    <TouchableOpacity
                      style={styles.uploadDropdownBtn}
                      onPress={() => { setShowUploadYearDropdown(v => !v); setShowUploadCatDropdown(false); }}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.uploadDropdownText, !uploadYear && { color: COLORS.midGray }]}>
                        {uploadYear || ''}
                      </Text>
                      <Text style={styles.uploadDropdownCaret}>▾</Text>
                    </TouchableOpacity>
                    {showUploadYearDropdown && (
                      <View style={[styles.filterDropdownPanel, { minWidth: 90, zIndex: 99999 }]}>
                        {UPLOAD_YEARS.map(opt => (
                          <TouchableOpacity
                            key={opt}
                            style={[styles.filterDropdownItem, uploadYear === opt && styles.filterDropdownItemActive]}
                            onPress={() => { setUploadYear(opt); setShowUploadYearDropdown(false); }}
                          >
                            <Text style={[styles.filterDropdownItemText, uploadYear === opt && { color: COLORS.navy, fontWeight: '700' }]}>
                              {opt}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}
                  </View>
                </View>
              </View>

              {/* Step 3 */}
              <Text style={[styles.uploadStepLabel, { marginTop: 18 }]}>Step 3 : Review and Post</Text>

              <TouchableOpacity
                style={styles.publishBtn}
                activeOpacity={0.85}
                onPress={() => {
                  if (!uploadFile || !uploadTitle || !uploadCategory || !uploadYear) {
                    Alert.alert('Missing Info', 'Please complete all fields before publishing.');
                    return;
                  }
                  Alert.alert('Published!', `"${uploadTitle}" has been published to the portal.`);
                  setShowUploadModal(false);
                }}
              >
                <Text style={styles.publishBtnText}>Publish to Transparency Portal</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.draftBtn}
                activeOpacity={0.85}
                onPress={() => {
                  Alert.alert('Saved as Draft', 'Document saved as draft.');
                  setShowUploadModal(false);
                }}
              >
                <Text style={styles.draftBtnText}>Save as Draft</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Footer */}
          <View style={styles.uploadModalFooter}>
            <TouchableOpacity
              style={styles.cancelUploadBtn}
              onPress={() => setShowUploadModal(false)}
              activeOpacity={0.8}
            >
              <Text style={styles.cancelUploadText}>Cancel Upload</Text>
            </TouchableOpacity>
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
            <View style={{ position: 'relative' }}>
              <TouchableOpacity
                style={styles.filterDropdownBtn}
                onPress={() => { setShowDocDropdown(v => !v); setShowYearDropdown(false); }}
                activeOpacity={0.8}
              >
                <Text style={styles.filterDropdownText} numberOfLines={1}>
                  {docFilter === 'All Documents' ? 'Document' : docFilter.length > 20 ? docFilter.slice(0, 20) + '…' : docFilter}
                </Text>
                <Text style={styles.filterDropdownCaret}>▾</Text>
              </TouchableOpacity>
              {showDocDropdown && (
                <View style={styles.filterDropdownPanel}>
                  {DOCUMENT_FILTERS.map(opt => (
                    <TouchableOpacity
                      key={opt}
                      style={[styles.filterDropdownItem, docFilter === opt && styles.filterDropdownItemActive]}
                      onPress={() => { setDocFilter(opt); setShowDocDropdown(false); }}
                    >
                      <Text style={[styles.filterDropdownItemText, docFilter === opt && { color: COLORS.navy, fontWeight: '700' }]}>
                        {opt}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>

            {/* Year filter dropdown */}
            <View style={{ position: 'relative' }}>
              <TouchableOpacity
                style={styles.filterDropdownBtn}
                onPress={() => { setShowYearDropdown(v => !v); setShowDocDropdown(false); }}
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

            <View style={{ flex: 1 }} />

            {/* Upload button */}
            <TouchableOpacity
              style={styles.uploadBtn}
              onPress={() => { setUploadFile(null); setUploadTitle(''); setUploadCategory(''); setUploadYear(''); setShowUploadModal(true); }}
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

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.navy} />

      {renderDocModal()}
      {renderUploadModal()}

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

  // ── Sidebar (identical to sk-planning) ──
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
    borderRadius: 14,
    width: '95%',
    maxWidth: 620,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.22,
    shadowRadius: 24,
    elevation: 16,
    overflow: 'hidden',
  },
  uploadModalHeader: {
    backgroundColor: COLORS.navy,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  uploadModalHeaderText: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.white,
    letterSpacing: 0.4,
    flex: 1,
  },
  uploadModalClose: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
    marginLeft: 10,
  },
  uploadModalCloseText: { fontSize: 13, fontWeight: '800', color: COLORS.white },

  uploadModalBody: {
    flexDirection: 'row',
    padding: 18,
    gap: 18,
  },
  uploadModalLeft: {
    flex: 1,
    alignItems: 'center',
  },
  uploadModalRight: {
    flex: 1.4,
  },

  uploadStepLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.darkText,
    marginBottom: 10,
    alignSelf: 'flex-start',
  },

  dropZone: {
    width: '100%',
    borderWidth: 1.5,
    borderColor: COLORS.navy,
    borderRadius: 8,
    alignItems: 'center',
    paddingVertical: 18,
    paddingHorizontal: 10,
    backgroundColor: '#F0F4FA',
    marginBottom: 10,
  },
  dropZoneActive: {
    borderColor: COLORS.gold,
    backgroundColor: '#FFFDF0',
  },
  dropZoneTopLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.navy,
    marginBottom: 10,
  },
  dropZoneIconWrap: {
    alignItems: 'center',
    marginBottom: 10,
  },
  uploadArrowBody: {
    width: 3,
    height: 22,
    backgroundColor: COLORS.navy,
    borderRadius: 2,
  },
  uploadArrowHead: {
    width: 0,
    height: 0,
    borderLeftWidth: 8,
    borderRightWidth: 8,
    borderBottomWidth: 12,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: COLORS.navy,
    marginBottom: -22,
    marginTop: -34,
  },
  dropZoneSubLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.navy,
    textAlign: 'center',
    marginTop: 10,
    lineHeight: 17,
    letterSpacing: 0.3,
  },
  dropZoneFileName: {
    fontSize: 11,
    color: COLORS.navy,
    textAlign: 'center',
    fontWeight: '600',
    marginTop: 6,
  },

  selectFileBtn: {
    borderWidth: 1,
    borderColor: COLORS.midGray,
    borderRadius: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: COLORS.white,
    alignSelf: 'center',
  },
  selectFileBtnText: {
    fontSize: 12,
    color: COLORS.darkText,
    fontWeight: '500',
  },

  uploadFieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.darkText,
    marginBottom: 5,
  },
  uploadTextInput: {
    borderWidth: 1,
    borderColor: COLORS.lightGray,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
    color: COLORS.darkText,
    backgroundColor: COLORS.white,
    marginBottom: 12,
  },
  uploadRowFields: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  uploadDropdownBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.lightGray,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
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
    backgroundColor: '#2E7D32',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 10,
  },
  publishBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.white,
    letterSpacing: 0.3,
  },
  draftBtn: {
    backgroundColor: COLORS.navy,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  draftBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.white,
    letterSpacing: 0.3,
  },

  uploadModalFooter: {
    borderTopWidth: 1,
    borderTopColor: COLORS.lightGray,
    paddingHorizontal: 18,
    paddingVertical: 12,
    alignItems: 'flex-end',
  },
  cancelUploadBtn: {
    borderWidth: 1,
    borderColor: COLORS.midGray,
    borderRadius: 6,
    paddingHorizontal: 16,
    paddingVertical: 7,
    backgroundColor: COLORS.white,
  },
  cancelUploadText: {
    fontSize: 12,
    color: COLORS.darkText,
    fontWeight: '500',
  },
});