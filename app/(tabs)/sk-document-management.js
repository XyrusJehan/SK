import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, ScrollView, TouchableOpacity,
  StyleSheet, SafeAreaView, StatusBar, Dimensions, Image, Modal,
  Linking,
} from 'react-native';
import { useRouter, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useNav } from './navContext';
import { useAuth } from './authContext';
import { supabase } from '../../utils/supabase';

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
const NAV_TABS       = ['Dashboard', 'Documents', 'Planning', 'Portal', 'Account'];
const DOCUMENT_TABS  = ['Folder', 'Document Management'];
const STATUS_TABS    = ['All', 'Drafts', 'Saved', 'Submitted', 'Approved', 'Returned'];
const DRAFT_TYPES    = ['All Types', 'Planning', 'Financial', 'Governance', 'Performance'];
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

const BellIcon = ({ hasNotif }) => (
  <View style={styles.bellWrapper}>
    <View style={styles.bellBody} />
    <View style={styles.bellBottom} />
    {hasNotif && <View style={styles.bellDot} />}
  </View>
);

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

// ─── MAIN SCREEN ──────────────────────────────────────────────────────────────
export default function SKDocumentManagementScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { setActiveTab } = useNav();
  const { logout, user } = useAuth();

  // Get user's barangay from auth context
  const barangayName = user?.barangay?.barangay_name || 'Unknown Barangay';
  const barangayId = user?.barangayId;

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
  const [notifCount]                          = useState(2);
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

  const showAlert = (type, title, message) => {
    setAlertModal({ visible: true, type, title, message });
  };
  const hideAlert = () => setAlertModal(a => ({ ...a, visible: false }));

  const handleViewPress = async (doc) => {
    if (!doc.fileUrl) {
      showAlert('error', 'No File', 'This document does not have an attached file.');
      return;
    }

    // Open the file URL in browser/app
    try {
      await Linking.openURL(doc.fileUrl);
    } catch (err) {
      console.error('View error:', err);
      showAlert('error', 'View Failed', 'Could not open the file.');
    }
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

        return {
          id: doc.document_id,
          title: doc.title || 'Untitled',
          type: doc.document_type || 'Unknown',
          category: doc.folder_category || 'planning',
          status: doc.status || 'draft',
          year: doc.year,
          createdBy: usersMap[doc.submitted_by] || 'Unknown',
          lastModified: doc.saved_at || doc.created_at || new Date().toISOString(),
          fileUrl: resolvedFileUrl,
        };
      }));

      setDocuments(formattedDocs);
    } catch (error) {
      console.error('Error:', error);
    }
  }, [barangayId, supabase, user]);

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
        const active = tab === 'Documents';
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
      <TouchableOpacity
        style={styles.logoutBtn}
        onPress={() => { logout(); router.replace('/'); }}
        activeOpacity={0.8}
      >
        <Text style={styles.logoutText}>Logout</Text>
      </TouchableOpacity>
    </View>
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

      {/* Category label */}
      <View style={styles.categoryRow}>
        <Text style={styles.categoryLabel}>Category:</Text>
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
                    <TouchableOpacity activeOpacity={0.7} onPress={() => {}}>
                      <EditIcon />
                    </TouchableOpacity>
                    <TouchableOpacity activeOpacity={0.7} onPress={() => handleViewPress(doc)}>
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
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.navy} />
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
  logoImage:     { width: 100, height: 100 },
  navItem: {
    width: '100%', paddingVertical: 12, paddingHorizontal: 12,
    borderRadius: 24, marginBottom: 8, alignItems: 'center',
    borderWidth: 1.5, borderColor: COLORS.white, backgroundColor: COLORS.navy,
    flexDirection: 'row', justifyContent: 'center',
  },
  navItemActive:  { backgroundColor: COLORS.white, borderColor: COLORS.white },
  navLabel:       { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.85)', letterSpacing: 0.3 },
  navLabelActive: { color: '#000', fontWeight: '800' },
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
  menuBtn:           { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.cardBg, alignItems: 'center', justifyContent: 'center' },
  menuIconContainer: { width: 20, height: 16, justifyContent: 'space-between' },
  menuLine:          { width: 20, height: 2, backgroundColor: COLORS.navy, borderRadius: 1 },
  mobileTitle:       { fontSize: 18, fontWeight: '800', color: COLORS.darkText },

  // Desktop header
  header: {
    flexDirection: 'row', alignItems: 'flex-start',
    justifyContent: 'space-between', marginBottom: 16,
  },
  headerSub:   { fontSize: 10, fontWeight: '600', color: COLORS.subText, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 2 },
  headerTitle: { fontSize: 22, fontWeight: '900', color: COLORS.darkText },

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
    backgroundColor: COLORS.gold, borderRadius: 4, borderColor: COLORS.gold,
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

});