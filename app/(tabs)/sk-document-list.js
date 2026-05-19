import React, { useState, useMemo, useEffect } from 'react';
import {
  View, Text, TextInput, ScrollView, TouchableOpacity,
  StyleSheet, SafeAreaView, StatusBar, Dimensions, Image, Modal,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useNav } from './navContext';
import { useAuth } from './authContext';
import { supabase } from '../../utils/supabase';
import * as DocumentPicker from 'expo-document-picker';

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
  planning:   { header: '#7B9FD4', bg: '#EEF3FB', accent: '#2A4E8A' },
  financial:  { header: '#4CAF50', bg: '#EDF7EE', accent: '#1A6B38' },
  governance: { header: '#7C5CBF', bg: '#F2EEF9', accent: '#5A2EA0' },
  activities: { header: '#E87A30', bg: '#FDF2EA', accent: '#A04010' },
};

// ─── TABS ─────────────────────────────────────────────────────────────────────
const NAV_TABS      = ['Dashboard', 'Documents', 'Planning', 'Portal', 'Account'];
const DOCUMENT_TABS = ['Financial', 'Planning', 'Governance', 'Activities'];

// Document types per folder category (from database schema)
const DOCUMENT_TYPES = {
  planning: [
    'Comprehensive Barangay Youth Development Plan (CBYDP)',
    'Annual Barangay Youth Investment Program (ABYIP)',
    'SK PPK Template',
    'Program of Work',
    'Work Plans',
    'Project Proposals',
  ],
  financial: [
    'Approved Annual Budget',
    'SK Supplemental Budget',
    'Registry of Cash Receipts and Deposits',
    'Registry of Cash Disbursements',
    'Monthly Itemized List',
    'Quarterly Financial Reports',
    'Disbursement Vouchers',
    'Liquidation Reports',
  ],
  governance: [
    'Resolutions',
    'Ordinances',
  ],
  performance: [
    'Accomplishment Reports',
    'Documentation',
    'Event Reports',
    'Minutes of Meetings',
    'Barangay Youth Investment Monitoring Form',
    'Monthly/Quarterly Accomplishment Report',
  ],
};

const FOLDER_CATEGORIES = [
  { label: 'Planning', value: 'planning' },
  { label: 'Financial', value: 'financial' },
  { label: 'Governance', value: 'governance' },
  { label: 'Performance', value: 'performance' },
];

// ─── DOCUMENT DATA ────────────────────────────────────────────────────────────
// (Data now fetched from Supabase based on barangay_id)
const DOCUMENTS_DATA = {};

// ─── ICONS ────────────────────────────────────────────────────────────────────
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

// ─── FILE ICON ────────────────────────────────────────────────────────────────
const FileIcon = ({ name }) => {
  const ext = name?.split('.').pop()?.toLowerCase();
  const map = { pdf: '#E53935', xlsx: '#43A047', docx: '#1E88E5', pptx: '#FB8C00' };
  const color = map[ext] || COLORS.midGray;
  return (
    <View style={[styles.fileIcon, { backgroundColor: color }]}>
      <Text style={styles.fileIconText}>{(ext || 'FILE').toUpperCase()}</Text>
    </View>
  );
};

// ─── MAIN SCREEN ──────────────────────────────────────────────────────────────
export default function SKDocumentListScreen() {
  const router = useRouter();
  const { activeTab, setActiveTab } = useNav();
  const { logout, user } = useAuth();
  const params = useLocalSearchParams();

  // Get user's barangay from auth context
  const barangayName = user?.barangay?.barangay_name || 'Unknown Barangay';
  const barangayId = user?.barangayId;

  // Determine initial tab from params (category passed from sk-document)
  const initTab = DOCUMENT_TABS.includes(params?.category) ? params.category : 'Financial';
  const initSubType = params?.subType || null;

  const [activeDocTab, setActiveDocTab] = useState(initTab);
  const [activeSubType, setActiveSubType]   = useState(initSubType);
  const [searchText, setSearchText]         = useState('');
  const [sortMode, setSortMode]             = useState('Newest'); // 'Newest' | 'Name'
  const [sidebarVisible, setSidebarVisible] = useState(false);
  const [dropdownOpen, setDropdownOpen]     = useState(false);
  const [notifCount]                        = useState(2);
  const [documents, setDocuments]           = useState([]);

  // Upload modal state
  const [uploadModalVisible, setUploadModalVisible] = useState(false);
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadCategory, setUploadCategory] = useState('planning');
  const [uploadDocType, setUploadDocType] = useState('');
  const [categoryDropdownOpen, setCategoryDropdownOpen] = useState(false);
  const [docTypeDropdownOpen, setDocTypeDropdownOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);

  // Get document types for selected category
  const currentDocTypes = DOCUMENT_TYPES[uploadCategory] || [];

  // Fetch documents for this barangay filtered by category
  useEffect(() => {
    const fetchDocuments = async () => {
      if (!barangayId) return;

      try {
        // Map tab categories to folder_category values
        const categoryMap = {
          'Financial': 'financial',
          'Planning': 'planning',
          'Governance': 'governance',
          'Activities': 'performance'
        };
        const folderCategory = categoryMap[activeDocTab];

        const query = supabase
          .from('documents')
          .select('document_id, title, folder_category, document_type, status, year, created_at')
          .eq('barangay_id', barangayId);

        if (folderCategory) {
          query.eq('folder_category', folderCategory);
        }

        const { data: docs, error } = await query.order('created_at', { ascending: false });

        if (error) {
          console.error('Error fetching documents:', error);
          return;
        }

        const formattedDocs = docs?.map(doc => ({
          id: doc.document_id,
          name: doc.title || 'Untitled',
          date: doc.created_at ? new Date(doc.created_at).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
        })) || [];

        setDocuments(formattedDocs);
      } catch (error) {
        console.error('Error:', error);
      }
    };

    fetchDocuments();
  }, [barangayId, activeDocTab]);

  // Accent color based on active tab
  const tabColor = COLORS[activeDocTab.toLowerCase()] || COLORS.planning;

  // SubTypes for active tab (from fetched documents)
  const subTypes = [];

  // When tab changes, reset subType
  const handleTabChange = (tab) => {
    setActiveDocTab(tab);
    setActiveSubType(null);
    setDropdownOpen(false);
    setSearchText('');
  };

  // All docs for current tab (or filtered by subType)
  const allDocs = useMemo(() => {
    if (activeSubType) {
      return documents.filter(d => d.name.includes(activeSubType));
    }
    return documents;
  }, [activeDocTab, activeSubType, documents]);

  // Apply search + sort
  const visibleDocs = useMemo(() => {
    let docs = allDocs.filter(d =>
      d.name.toLowerCase().includes(searchText.toLowerCase())
    );
    if (sortMode === 'Newest') {
      docs = [...docs].sort((a, b) => new Date(b.date) - new Date(a.date));
    } else {
      docs = [...docs].sort((a, b) => a.name.localeCompare(b.name));
    }
    return docs;
  }, [allDocs, searchText, sortMode]);

  const formatDate = (dateStr) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  const handleNavPress = (tab) => {
    setActiveTab(tab);
    setSidebarVisible(false);
    if (tab === 'Dashboard') router.push('/(tabs)/sk-dashboard');
    if (tab === 'Documents') router.push('/(tabs)/sk-document');
    if (tab === 'Planning')  router.push('/(tabs)/sk-planning');
    if (tab === 'Portal')    router.push('/(tabs)/sk-portal');
    if (tab === 'Account')   router.push('/(tabs)/sk-account');
  };

  // Handle upload form submission
  // File picker function
  const pickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
        copyToCacheDirectory: true,
      });

      if (result.canceled) {
        return;
      }

      const file = result.assets[0];
      setSelectedFile({
        uri: file.uri,
        name: file.name,
        type: file.mimeType,
        size: file.size,
      });
    } catch (error) {
      console.error('Error picking document:', error);
    }
  };

  const handleUpload = async () => {
    if (!uploadTitle.trim() || !uploadDocType) {
      alert('Please fill in all fields');
      return;
    }
    if (!barangayId || !user?.userId) {
      alert('User information missing');
      return;
    }

    setUploading(true);
    try {
      const currentYear = new Date().getFullYear();

      let fileUrl = null;

      // Upload file to Supabase storage if selected
      if (selectedFile) {
        // Sanitize filename - remove special chars and replace spaces
        const sanitizedName = selectedFile.name
          .replace(/[^\w\s.-]/g, '')
          .replace(/\s+/g, '_');
        const fileName = `${barangayId}_${currentYear}_${Date.now()}_${sanitizedName}`;

        // Fetch the file and convert to blob
        const response = await fetch(selectedFile.uri);
        const blob = await response.blob();

        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('documents')
          .upload(fileName, blob, {
            contentType: selectedFile.type || 'application/octet-stream',
          });

        if (uploadError) {
          console.error('Error uploading file:', uploadError);
          alert('Failed to upload file: ' + uploadError.message);
          setUploading(false);
          return;
        }

        // Get public URL
        const { data: urlData } = supabase.storage
          .from('documents')
          .getPublicUrl(fileName);

        fileUrl = urlData.publicUrl;
      }

      // Create document record
      const { data: docData, error } = await supabase
        .from('documents')
        .insert({
          barangay_id: barangayId,
          submitted_by: user.userId,
          title: uploadTitle.trim(),
          folder_category: uploadCategory,
          document_type: uploadDocType,
          status: 'saved',
          year: currentYear,
          file_url: fileUrl,
          created_at: new Date().toISOString(),
          saved_at: new Date().toISOString(),
        })
        .select();

      if (error) {
        console.error('Error uploading document:', error);
        alert('Failed to upload document: ' + error.message);
        setUploading(false);
        return;
      }

      const documentId = docData[0]?.document_id;

      // Create document version if file was uploaded
      if (documentId && fileUrl) {
        await supabase
          .from('document_versions')
          .insert({
            document_id: documentId,
            version_number: 1,
            file_url: fileUrl,
            action: 'submitted',
            actioned_by: user.userId,
          });
      }

      // Reset form and close modal
      setUploadTitle('');
      setUploadCategory('planning');
      setUploadDocType('');
      setSelectedFile(null);
      setUploadModalVisible(false);
      setUploading(false);

      // Navigate to document management to see the new draft
      router.push('/(tabs)/sk-document-management');
    } catch (error) {
      console.error('Error:', error);
      alert('An error occurred while uploading');
      setUploading(false);
    }
  };

  // Reset upload form
  const resetUploadForm = () => {
    setUploadTitle('');
    setUploadCategory('planning');
    setUploadDocType('');
    setCategoryDropdownOpen(false);
    setDocTypeDropdownOpen(false);
    setSelectedFile(null);
  };

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
      <TouchableOpacity style={styles.logoutBtn} onPress={() => { logout(); router.replace('/'); }} activeOpacity={0.8}>
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
    >
      {/* Mobile Header */}
      {isMobile && (
        <View style={styles.mobileHeader}>
          <TouchableOpacity style={styles.menuBtn} onPress={() => setSidebarVisible(true)}>
            <MenuIcon />
          </TouchableOpacity>
          <Text style={styles.mobileTitle}>Documents</Text>
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
          {/* Upload Button */}
          <TouchableOpacity style={styles.uploadBtn} onPress={() => setUploadModalVisible(true)} activeOpacity={0.8}>
            <Text style={styles.uploadBtnText}>Upload</Text>
            <Text style={styles.uploadIcon}>↑</Text>
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
        {isMobile && (
          <TouchableOpacity style={styles.uploadBtnMobile} onPress={() => setUploadModalVisible(true)} activeOpacity={0.8}>
            <Text style={styles.uploadBtnText}>Upload ↑</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Category label + All dropdown + Tab bar */}
      <View style={styles.categoryRow}>
        <Text style={styles.categoryLabel}>Category:</Text>
      </View>

      <View style={styles.filterRow}>
        {/* "All" dropdown */}
        <View style={styles.dropdownContainer}>
          <TouchableOpacity
            style={[styles.allDropdownBtn, activeDocTab === 'All' && styles.allDropdownBtnActive]}
            onPress={() => setDropdownOpen(v => !v)}
            activeOpacity={0.8}
          >
            <Text style={styles.allDropdownText}>All</Text>
            <Text style={styles.allDropdownArrow}>{dropdownOpen ? '▲' : '▼'}</Text>
          </TouchableOpacity>
          {dropdownOpen && (
            <View style={styles.dropdownMenu}>
              {['All', ...DOCUMENT_TABS].map(tab => {
                const active = (tab === 'All' && !DOCUMENT_TABS.includes(activeDocTab)) || activeDocTab === tab;
                return (
                  <TouchableOpacity
                    key={tab}
                    style={[styles.dropdownItem, active && styles.dropdownItemActive]}
                    onPress={() => {
                      if (tab !== 'All') handleTabChange(tab);
                      else { setActiveDocTab('Financial'); setActiveSubType(null); }
                      setDropdownOpen(false);
                    }}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.dropdownItemText, active && styles.dropdownItemTextActive]}>{tab}</Text>
                    {active && <Text style={styles.dropdownCheck}>✓</Text>}
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>

        {/* Navy tab bar */}
        <View style={styles.docTabBar}>
          {DOCUMENT_TABS.map(tab => {
            const active = activeDocTab === tab;
            return (
              <TouchableOpacity
                key={tab}
                style={[styles.docTab, active && styles.docTabActive]}
                onPress={() => handleTabChange(tab)}
                activeOpacity={0.8}
              >
                <Text style={[styles.docTabText, active && styles.docTabTextActive]}>{tab}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* SubType filter pills */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.pillsScroll}
        contentContainerStyle={styles.pillsRow}
      >
        <TouchableOpacity
          style={[styles.pill, !activeSubType && { backgroundColor: tabColor.header }]}
          onPress={() => setActiveSubType(null)}
          activeOpacity={0.8}
        >
          <Text style={[styles.pillText, !activeSubType && styles.pillTextActive]}>All</Text>
        </TouchableOpacity>
        {subTypes.map(sub => {
          const active = activeSubType === sub;
          return (
            <TouchableOpacity
              key={sub}
              style={[styles.pill, active && { backgroundColor: tabColor.header }]}
              onPress={() => setActiveSubType(active ? null : sub)}
              activeOpacity={0.8}
            >
              <Text style={[styles.pillText, active && styles.pillTextActive]}>{sub}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Document List Table */}
      <View style={[styles.tableContainer, { borderColor: tabColor.header + '55' }]}>
        {/* Sort row */}
        <View style={styles.sortRow}>
          <Text style={styles.sortLabel}>Sort by: </Text>
          <TouchableOpacity onPress={() => setSortMode('Newest')}>
            <Text style={[styles.sortOption, sortMode === 'Newest' && { color: COLORS.navy, fontWeight: '800' }]}>
              Newest
            </Text>
          </TouchableOpacity>
          <Text style={styles.sortDivider}> | </Text>
          <TouchableOpacity onPress={() => setSortMode('Name')}>
            <Text style={[styles.sortOption, sortMode === 'Name' && { color: COLORS.navy, fontWeight: '800' }]}>
              Name
            </Text>
          </TouchableOpacity>
        </View>

        {/* Table Header */}
        <View style={[styles.tableHeader, { backgroundColor: tabColor.bg }]}>
          <Text style={[styles.tableHeaderText, { flex: 3 }]}>Document Name</Text>
          <Text style={[styles.tableHeaderText, { flex: 1, textAlign: 'right' }]}>Date</Text>
        </View>

        {/* Table Rows */}
        {visibleDocs.length > 0 ? (
          visibleDocs.map((doc, idx) => (
            <TouchableOpacity
              key={doc.id}
              style={[styles.tableRow, idx % 2 === 1 && { backgroundColor: tabColor.bg + '55' }]}
              activeOpacity={0.7}
            >
              <View style={styles.tableRowLeft}>
                <FileIcon name={doc.name} />
                <Text style={styles.docName} numberOfLines={1}>{doc.name}</Text>
              </View>
              <Text style={styles.docDate}>{formatDate(doc.date)}</Text>
            </TouchableOpacity>
          ))
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>📄</Text>
            <Text style={styles.emptyText}>No documents found.</Text>
            <Text style={styles.emptySubText}>Try a different filter or search term.</Text>
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

      {/* Upload Modal */}
      <Modal
        visible={uploadModalVisible}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setUploadModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Upload Document</Text>
              <TouchableOpacity onPress={() => { setUploadModalVisible(false); resetUploadForm(); }} activeOpacity={0.7}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              {/* Document Title */}
              <Text style={styles.modalLabel}>Document Title</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="Enter document title"
                placeholderTextColor={COLORS.midGray}
                value={uploadTitle}
                onChangeText={setUploadTitle}
              />

              {/* Folder Category Dropdown */}
              <Text style={styles.modalLabel}>Folder Category</Text>
              <View style={styles.modalCategoryDropdownWrapper}>
                <TouchableOpacity
                  style={styles.modalDropdown}
                  onPress={() => { setCategoryDropdownOpen(!categoryDropdownOpen); setDocTypeDropdownOpen(false); }}
                  activeOpacity={0.8}
                >
                  <Text style={styles.modalDropdownText}>
                    {FOLDER_CATEGORIES.find(c => c.value === uploadCategory)?.label || 'Select Category'}
                  </Text>
                  <Text style={styles.modalDropdownArrow}>{categoryDropdownOpen ? '▲' : '▼'}</Text>
                </TouchableOpacity>
                {categoryDropdownOpen && (
                  <View style={styles.modalDropdownMenu}>
                    {FOLDER_CATEGORIES.map(cat => (
                      <TouchableOpacity
                        key={cat.value}
                        style={[styles.modalDropdownItem, uploadCategory === cat.value && styles.modalDropdownItemActive]}
                        onPress={() => { setUploadCategory(cat.value); setUploadDocType(''); setCategoryDropdownOpen(false); }}
                        activeOpacity={0.8}
                      >
                        <Text style={[styles.modalDropdownItemText, uploadCategory === cat.value && styles.modalDropdownItemTextActive]}>
                          {cat.label}
                        </Text>
                        {uploadCategory === cat.value && <Text style={styles.modalDropdownCheck}>✓</Text>}
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>

              {/* Document Type Dropdown */}
              <Text style={styles.modalLabel}>Document Type</Text>
              <View style={styles.modalDropdownWrapper}>
                <TouchableOpacity
                  style={[styles.modalDropdown, !uploadDocType && styles.modalDropdownPlaceholder]}
                  onPress={() => { if (uploadCategory) { setDocTypeDropdownOpen(!docTypeDropdownOpen); setCategoryDropdownOpen(false); } }}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.modalDropdownText, !uploadDocType && styles.modalDropdownPlaceholderText]}>
                    {uploadDocType || 'Select Document Type'}
                  </Text>
                  <Text style={styles.modalDropdownArrow}>{docTypeDropdownOpen ? '▲' : '▼'}</Text>
                </TouchableOpacity>
                {docTypeDropdownOpen && (
                  <ScrollView style={styles.modalDropdownMenu} showsVerticalScrollIndicator={false}>
                    {currentDocTypes.map(type => (
                      <TouchableOpacity
                        key={type}
                        style={[styles.modalDropdownItem, uploadDocType === type && styles.modalDropdownItemActive]}
                        onPress={() => { setUploadDocType(type); setDocTypeDropdownOpen(false); }}
                        activeOpacity={0.8}
                      >
                        <Text style={[styles.modalDropdownItemText, uploadDocType === type && styles.modalDropdownItemTextActive]}>
                          {type}
                        </Text>
                        {uploadDocType === type && <Text style={styles.modalDropdownCheck}>✓</Text>}
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                )}
              </View>

              {/* Year Display */}
              <Text style={styles.modalLabel}>Year</Text>
              <View style={styles.modalYearDisplay}>
                <Text style={styles.modalYearText}>{new Date().getFullYear()}</Text>
              </View>

              {/* File Picker */}
              <Text style={styles.modalLabel}>Attach File</Text>
              <TouchableOpacity
                style={styles.filePickerBtn}
                onPress={pickDocument}
                activeOpacity={0.8}
              >
                {selectedFile ? (
                  <View style={styles.selectedFileContainer}>
                    <Text style={styles.filePickerIcon}>📄</Text>
                    <Text style={styles.selectedFileName} numberOfLines={1}>
                      {selectedFile.name}
                    </Text>
                    <TouchableOpacity
                      onPress={(e) => { e.stopPropagation(); setSelectedFile(null); }}
                      style={styles.removeFileBtn}
                    >
                      <Text style={styles.removeFileText}>✕</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={styles.filePickerContent}>
                    <Text style={styles.filePickerIcon}>📎</Text>
                    <Text style={styles.filePickerText}>Select Document</Text>
                  </View>
                )}
              </TouchableOpacity>
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => { setUploadModalVisible(false); resetUploadForm(); }}
                activeOpacity={0.8}
              >
                <Text style={styles.modalCancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalUploadBtn, uploading && styles.modalUploadBtnDisabled]}
                onPress={handleUpload}
                disabled={uploading}
                activeOpacity={0.8}
              >
                <Text style={styles.modalUploadBtnText}>{uploading ? 'Uploading...' : 'Upload'}</Text>
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
  logoImage:      { width: 100, height: 100 },
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
  menuBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: COLORS.cardBg, alignItems: 'center', justifyContent: 'center',
  },
  menuIconContainer: { width: 20, height: 16, justifyContent: 'space-between' },
  menuLine:          { width: 20, height: 2, backgroundColor: COLORS.navy, borderRadius: 1 },
  mobileTitle:       { fontSize: 18, fontWeight: '800', color: COLORS.darkText },

  // Desktop header
  header: {
    flexDirection: 'row', alignItems: 'flex-start',
    justifyContent: 'space-between', marginBottom: 12,
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

  // Upload button
  uploadBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: COLORS.navy, paddingVertical: 9, paddingHorizontal: 18,
    borderRadius: 8,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15, shadowRadius: 4, elevation: 4,
  },
  uploadBtnMobile: {
    backgroundColor: COLORS.navy, paddingVertical: 8, paddingHorizontal: 14,
    borderRadius: 8, marginLeft: 8,
  },
  uploadBtnText: { fontSize: 13, fontWeight: '700', color: COLORS.white },
  uploadIcon:    { fontSize: 14, color: COLORS.white },

  // Search
  searchRow: { marginBottom: 10, flexDirection: 'row', alignItems: 'center' },
  searchBox: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.white, borderRadius: 20,
    borderWidth: 1, borderColor: COLORS.lightGray,
    paddingHorizontal: 12, paddingVertical: 7,
    maxWidth: isMobile ? '100%' : 280,
  },
  searchIcon:  { fontSize: 12, color: COLORS.midGray, marginRight: 4 },
  searchInput: { flex: 1, fontSize: 12, color: COLORS.darkText },

  // Category
  categoryRow:   { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  categoryLabel: { fontSize: 12, fontWeight: '700', color: COLORS.darkText },

  // Filter row
  filterRow: {
    flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12, gap: 6,
    zIndex: 10,
  },
  dropdownContainer: {
    zIndex: 100,
  },
  allDropdownBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingHorizontal: 10, backgroundColor: COLORS.white,
    borderRadius: 4, borderWidth: 1, borderColor: COLORS.midGray,
    height: 38, justifyContent: 'center',
  },
  allDropdownBtnActive: { backgroundColor: COLORS.gold, borderColor: COLORS.gold },
  allDropdownText:      { fontSize: isMobile ? 10 : 12, fontWeight: '700', color: COLORS.darkText },
  allDropdownArrow:     { fontSize: 7, color: COLORS.subText },
  dropdownMenu: {
    position: 'absolute', top: 42, left: 0, zIndex: 99,
    backgroundColor: COLORS.white, borderRadius: 8, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15, shadowRadius: 8, elevation: 10,
    minWidth: 150, borderWidth: 1, borderColor: COLORS.lightGray,
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

  // Tab bar
  docTabBar: {
    flex: 1, flexDirection: 'row', borderRadius: 4, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.28, shadowRadius: 3, elevation: 6, height: 38,
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
  docTabText:       { fontSize: isMobile ? 9 : 12, fontWeight: '600', color: COLORS.white, textAlign: 'center' },
  docTabTextActive: { color: COLORS.darkText, fontWeight: '800' },

  // SubType pills
  pillsScroll:  { marginBottom: 10 },
  pillsRow:     { flexDirection: 'row', gap: 8, paddingVertical: 4 },
  pill: {
    paddingVertical: 5, paddingHorizontal: 12, borderRadius: 20,
    backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.lightGray,
  },
  pillText:       { fontSize: 11, fontWeight: '600', color: COLORS.subText },
  pillTextActive: { color: COLORS.white },

  // Table
  tableContainer: {
    backgroundColor: COLORS.white, borderRadius: 12,
    borderWidth: 1.5, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07, shadowRadius: 8, elevation: 3,
  },
  sortRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'flex-end', paddingVertical: 8, paddingHorizontal: 14,
    borderBottomWidth: 1, borderBottomColor: COLORS.lightGray,
  },
  sortLabel:   { fontSize: 11, color: COLORS.subText },
  sortOption:  { fontSize: 11, color: COLORS.subText, fontWeight: '600' },
  sortDivider: { fontSize: 11, color: COLORS.midGray },
  tableHeader: {
    flexDirection: 'row', paddingVertical: 10, paddingHorizontal: 14,
    borderBottomWidth: 1, borderBottomColor: COLORS.lightGray,
  },
  tableHeaderText: { fontSize: 12, fontWeight: '800', color: COLORS.darkText },
  tableRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 10, paddingHorizontal: 14,
    borderBottomWidth: 1, borderBottomColor: COLORS.lightGray,
  },
  tableRowLeft: { flex: 3, flexDirection: 'row', alignItems: 'center', gap: 10, marginRight: 8 },
  fileIcon: {
    width: 34, height: 38, borderRadius: 4,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  fileIconText: { fontSize: 7, fontWeight: '900', color: COLORS.white, letterSpacing: 0.5 },
  docName:      { flex: 1, fontSize: 12, color: COLORS.darkText, fontWeight: '500' },
  docDate:      { flex: 1, fontSize: 11, color: COLORS.subText, textAlign: 'right' },

  // Empty state
  emptyState:   { alignItems: 'center', paddingVertical: 60 },
  emptyIcon:    { fontSize: 36, marginBottom: 10 },
  emptyText:    { fontSize: 14, fontWeight: '700', color: COLORS.darkText, marginBottom: 4 },
  emptySubText: { fontSize: 12, color: COLORS.midGray },

  // ── Upload Modal ──
  modalOverlay: {
    ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center',
  },
  modalContent: {
    width: '90%', maxWidth: 500, maxHeight: '85%', backgroundColor: COLORS.white,
    borderRadius: 16, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25, shadowRadius: 10, elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: COLORS.lightGray,
    backgroundColor: COLORS.navy,
  },
  modalTitle: { fontSize: 18, fontWeight: '800', color: COLORS.white },
  modalClose: { fontSize: 18, color: COLORS.white, padding: 4 },
  modalBody: { padding: 20 },
  modalLabel: { fontSize: 13, fontWeight: '700', color: COLORS.darkText, marginBottom: 8, marginTop: 12 },
  modalInput: {
    backgroundColor: COLORS.offWhite, borderRadius: 8, borderWidth: 1, borderColor: COLORS.lightGray,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: COLORS.darkText,
  },
  modalDropdownWrapper: { position: 'relative', marginBottom: 12, zIndex: 100 },
  modalCategoryDropdownWrapper: { position: 'relative', marginBottom: 12, zIndex: 200 },
  modalDropdown: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: COLORS.offWhite, borderRadius: 8, borderWidth: 1, borderColor: COLORS.lightGray,
    paddingHorizontal: 14, paddingVertical: 12,
  },
  modalDropdownPlaceholder: {},
  modalDropdownPlaceholderText: { color: COLORS.midGray },
  modalDropdownText: { fontSize: 14, color: COLORS.darkText, flex: 1 },
  modalDropdownArrow: { fontSize: 10, color: COLORS.subText },
  // Dropdown menus positioned absolutely below their trigger in the wrapper
  modalDropdownMenu: {
    position: 'absolute', top: 46, left: 0, right: 0, zIndex: 101,
    backgroundColor: COLORS.white, borderRadius: 8, borderWidth: 1, borderColor: COLORS.lightGray,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 8, elevation: 5,
    maxHeight: 200,
  },
  modalDropdownItem: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 12, paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: COLORS.lightGray,
  },
  modalDropdownItemActive: { backgroundColor: '#EEF3FB' },
  modalDropdownItemText: { fontSize: 13, color: COLORS.darkText },
  modalDropdownItemTextActive: { color: COLORS.navy, fontWeight: '700' },
  modalDropdownCheck: { fontSize: 14, color: COLORS.navy, fontWeight: '800' },
  modalYearDisplay: {
    backgroundColor: COLORS.offWhite, borderRadius: 8, borderWidth: 1, borderColor: COLORS.lightGray,
    paddingHorizontal: 14, paddingVertical: 12,
  },
  modalYearText: { fontSize: 14, color: COLORS.darkText },
  // File picker styles
  filePickerBtn: {
    backgroundColor: COLORS.offWhite, borderRadius: 8, borderWidth: 1, borderColor: COLORS.lightGray,
    borderStyle: 'dashed', paddingHorizontal: 14, paddingVertical: 16,
    marginBottom: 12,
  },
  filePickerContent: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  filePickerIcon: { fontSize: 18 },
  filePickerText: { fontSize: 14, color: COLORS.subText, fontWeight: '500' },
  selectedFileContainer: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
  },
  selectedFileName: {
    flex: 1, fontSize: 14, color: COLORS.darkText, fontWeight: '500',
  },
  removeFileBtn: {
    padding: 4,
  },
  removeFileText: { fontSize: 14, color: COLORS.midGray },
  modalFooter: {
    flexDirection: 'row', gap: 12, paddingHorizontal: 20, paddingVertical: 16,
    borderTopWidth: 1, borderTopColor: COLORS.lightGray, backgroundColor: COLORS.offWhite,
  },
  modalCancelBtn: {
    flex: 1, paddingVertical: 14, borderRadius: 8, borderWidth: 1, borderColor: COLORS.midGray,
    alignItems: 'center', backgroundColor: COLORS.white,
  },
  modalCancelBtnText: { fontSize: 14, fontWeight: '700', color: COLORS.subText },
  modalUploadBtn: {
    flex: 1, paddingVertical: 14, borderRadius: 8, alignItems: 'center', backgroundColor: COLORS.navy,
  },
  modalUploadBtnDisabled: { backgroundColor: COLORS.midGray },
  modalUploadBtnText: { fontSize: 14, fontWeight: '700', color: COLORS.white },
});