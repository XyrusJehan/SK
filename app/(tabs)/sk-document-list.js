import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
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
// SafeAreaView from core 'react-native' is a no-op on Android. Use the
// context-aware version so insets work on both platforms.
import { Feather } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import Head from 'expo-router/head';
import { supabase } from '../../utils/supabase';
import Sidebar from './../components/Sidebar';
import { useAuth } from './authContext';
import { useNav } from './navContext';
import { BellIcon, NotificationModal, useNotificationCenter } from './notificationCenter';
import { DocumentScannerButton } from './scanner/DocumentScannerButton';
import { useDocumentScanner } from './scanner/useDocumentScanner';
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
  planning:   { header: '#7B9FD4', bg: '#EEF3FB', accent: '#2A4E8A' },
  financial:  { header: '#4CAF50', bg: '#EDF7EE', accent: '#1A6B38' },
  governance: { header: '#7C5CBF', bg: '#F2EEF9', accent: '#5A2EA0' },
  activities: { header: '#E87A30', bg: '#FDF2EA', accent: '#A04010' },
};

// ─── TABS ─────────────────────────────────────────────────────────────────────
const NAV_TABS      = ['Dashboard', 'Documents', 'Planning', 'Portal', 'Logs','Account'];
// DOCUMENT_TABS is built dynamically from document_category table; default fallback
const DEFAULT_DOCUMENT_TABS = ['Financial', 'Planning', 'Governance', 'Activities'];

// ─── DOCUMENT DATA ────────────────────────────────────────────────────────────
// (Data now fetched from Supabase based on barangay_id)
const DOCUMENTS_DATA = {};

// ─── ICONS ────────────────────────────────────────────────────────────────────
// MenuIcon now lives in the shared mobileHeader module (see import above) so the
// sticky mobile bar is identical on every SK + LYDO screen.


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

// View icon — matches sk-document-management
const ViewIcon = () => (
  <View style={styles.actionIconWrap}>
    <Feather name="eye" size={isMobile ? 13 : 15} color={COLORS.teal} />
  </View>
);

// Save / download icon — matches sk-document-management
const SaveIcon = () => (
  <View style={styles.actionIconWrap}>
    <Feather name="download" size={isMobile ? 13 : 15} color={COLORS.navy} />
  </View>
);


// ─── MAIN SCREEN ──────────────────────────────────────────────────────────────
export default function SKDocumentListScreen() {
  const router = useRouter();
  const { activeTab, setActiveTab } = useNav();
  const { logout, user } = useAuth();
  const params = useLocalSearchParams();

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

  // Reference table data — fetched from database; start empty so the UI doesn't
  // show stale hardcoded values before the fetch completes.
  const [documentCategories, setDocumentCategories] = useState([]);
  const [documentTypes, setDocumentTypes] = useState([]);
  const [folderYears, setFolderYears] = useState([]);

  // Build DOCUMENT_TABS from fetched documentCategories.
  // Use fallback list while categories are loading so the tab bar renders.
  const DOCUMENT_TABS = documentCategories.length > 0
    ? documentCategories.map(c => c.document_category)
    : DEFAULT_DOCUMENT_TABS;

  // Determine initial tab from params (category passed from sk-document).
  // Lookup is done against fetched categories by id or by name.
  const getInitialTab = () => {
    const catParam = params?.category;
    if (!catParam) return DOCUMENT_TABS[0] || 'Financial';
    const found = documentCategories.find(
      c => c.document_category === catParam || String(c.id) === String(catParam)
    );
    if (found && DOCUMENT_TABS.includes(found.document_category)) {
      return found.document_category;
    }
    return DOCUMENT_TABS[0] || 'Financial';
  };
  const initSubType = params?.subType || null;

  const [activeDocTab, setActiveDocTab] = useState(getInitialTab);
  const [activeSubType, setActiveSubType]   = useState(initSubType);

  // Sync the active tab when params change (e.g., when navigating from sk-document with a new category)
  useEffect(() => {
    const newTab = getInitialTab();
    if (newTab !== activeDocTab) {
      setActiveDocTab(newTab);
      setActiveSubType(initSubType);
    }
  }, [params?.category, params?.subType, documentCategories]);
  const [searchText, setSearchText]         = useState('');
  const [sortMode, setSortMode]             = useState('Newest'); // 'Newest' | 'Name'
  const [sidebarVisible, setSidebarVisible] = useState(false);
  const [dropdownOpen, setDropdownOpen]     = useState(false);
  const [documents, setDocuments]           = useState([]);

  // Upload modal state
  const [uploadModalVisible, setUploadModalVisible] = useState(false);
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadCategory, setUploadCategory] = useState(null); // Will store category_id
  const [uploadDocType, setUploadDocType] = useState(null);   // Will store document_type_id
  const [uploadYear, setUploadYear] = useState(null);        // Will store folder_year_id


  // Fetch reference tables data on mount
  useEffect(() => {
    const fetchReferenceData = async () => {
      try {
        // Fetch document categories
        console.log('Fetching document_category...');
        const { data: categories, error: catError } = await supabase
          .from('document_category')
          .select('id, document_category, year')
          .order('document_category');

        console.log('document_category result:', { categories, catError });
        if (!catError && categories) {
          setDocumentCategories(categories);
        } else if (catError) {
          console.error('Error fetching categories:', catError);
        }

        // Fetch document types
        console.log('Fetching document_types...');
        const { data: types, error: typeError } = await supabase
          .from('document_types')
          .select('id, document_type, category, year')
          .order('document_type');

        console.log('document_types result:', { types, typeError });
        if (!typeError && types) {
          setDocumentTypes(types);
        } else if (typeError) {
          console.error('Error fetching document types:', typeError);
        }

        // Fetch folder years
        console.log('Fetching folder_year...');
        const { data: years, error: yearError } = await supabase
          .from('folder_year')
          .select('id, fiscal_year')
          .order('fiscal_year', { ascending: false });

        console.log('folder_year result:', { years, yearError });
        if (!yearError && years) {
          setFolderYears(years);
        } else if (yearError) {
          console.error('Error fetching folder years:', yearError);
        }
      } catch (error) {
        console.error('Error fetching reference data:', error);
      }
    };

    fetchReferenceData();
  }, []);

  // Scanner hook for auto-trigger
  const scanner = useDocumentScanner();
  const scannerTriggered = useRef(false);

  // Handle auto-trigger scanner from dashboard using useFocusEffect
  useFocusEffect(
    React.useCallback(() => {
      if (params?.openScanner === 'true' && !scannerTriggered.current) {
        scannerTriggered.current = true;
        // Open scanner modal directly
        scanner.openScanModal();
        // Clear the URL param after triggering to prevent re-triggering
        setTimeout(() => {
          router.setParams({ openScanner: undefined });
        }, 500);
      }
    }, [params?.openScanner, scanner])
  );

  // Handle openUpload param from dashboard compliance tasks
  useEffect(() => {
    if (params?.openUpload === 'true') {
      // Resolve category id by name from fetched categories
      if (params?.category && documentCategories.length > 0) {
        const found = documentCategories.find(c => c.document_category === params.category);
        if (found) {
          setUploadCategory(found.id);
        }
      }
      if (params?.subType) {
        // Resolve docType by name (params may pass either an id or a name)
        if (documentTypes.length > 0) {
          const matchedType = documentTypes.find(
            t => t.document_type === params.subType || String(t.id) === String(params.subType)
          );
          if (matchedType) {
            setUploadDocType(matchedType.id);
            setUploadTitle(params.docTitle || matchedType.document_type);
          } else {
            setUploadDocType(params.subType);
            setUploadTitle(params.docTitle || params.subType);
          }
        } else {
          setUploadDocType(params.subType);
          setUploadTitle(params.docTitle || params.subType);
        }
      }
      // Open the upload modal
      setUploadModalVisible(true);
      // Clear the URL param after triggering
      setTimeout(() => {
        router.setParams({ openUpload: undefined });
      }, 500);
    }
  }, [params?.openUpload, params?.category, params?.subType, documentCategories, documentTypes]);

  const [categoryDropdownOpen, setCategoryDropdownOpen] = useState(false);
  const [docTypeDropdownOpen, setDocTypeDropdownOpen] = useState(false);
  const [yearDropdownOpen, setYearDropdownOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);

  // Track document types already uploaded for the selected category
  const [existingDocTypes, setExistingDocTypes] = useState([]);

  // Fetch existing document types whenever the upload modal opens or category changes
  useEffect(() => {
    const fetchExistingDocTypes = async () => {
      if (!barangayId || !uploadModalVisible || !uploadCategory) return;
      try {
        const { data, error } = await supabase
          .from('documents')
          .select('document_type')
          .eq('barangay_id', barangayId)
          .eq('folder_category', String(uploadCategory));

        if (!error && data) {
          setExistingDocTypes(data.map(d => Number(d.document_type)).filter(Boolean));
        }
      } catch (err) {
        console.error('Error fetching existing doc types:', err);
      }
    };

    fetchExistingDocTypes();
  }, [barangayId, uploadCategory, uploadModalVisible]);

  // Get document types for selected category, excluding already-uploaded ones
  // Now using the database reference table
  const currentDocTypes = documentTypes.filter(
    type => type.category === uploadCategory && !existingDocTypes.includes(type.id)
  );

  // Fetch documents for this barangay filtered by category — re-fetch every time screen is focused
  const fetchDocuments = useCallback(async () => {
    if (!barangayId) return;

    try {
      // Resolve the active tab name → category id from the fetched categories
      const activeCategory = documentCategories.find(
        c => c.document_category === activeDocTab
      );
      const categoryId = activeCategory?.id;

      const query = supabase
        .from('documents')
        .select('document_id, title, folder_category, document_type, status, year, created_at, file_url')
        .eq('barangay_id', barangayId);

      // Filter by category ID (stored as string in folder_category)
      if (categoryId) {
        query.eq('folder_category', String(categoryId));
      }

      const { data: docs, error } = await query.order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching documents:', error);
        return;
      }

      // For docs without a file_url on the parent row, fall back to the latest
      // version's file_url from document_versions.
      const docsNeedingVersion = (docs || []).filter(d => !d.file_url);
      let latestVersionByDoc = {};
      if (docsNeedingVersion.length > 0) {
        const ids = docsNeedingVersion.map(d => d.document_id);
        const { data: versions, error: verErr } = await supabase
          .from('document_versions')
          .select('document_id, file_url, version_number')
          .in('document_id', ids)
          .order('version_number', { ascending: false });
        if (!verErr && versions) {
          versions.forEach(v => {
            if (!latestVersionByDoc[v.document_id]) {
              latestVersionByDoc[v.document_id] = v.file_url;
            }
          });
        }
      }

      // Transform the data to include readable category and document type names
      const formattedDocs = docs?.map(doc => ({
        id: doc.document_id,
        name: doc.title || 'Untitled',
        date: doc.created_at ? new Date(doc.created_at).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
        category_name: documentCategories.find(c => c.id === Number(doc.folder_category))?.document_category || doc.folder_category || '',
        doc_type_name: documentTypes.find(t => t.id === Number(doc.document_type))?.document_type || doc.document_type || '',
        year_value: folderYears.find(y => y.id === Number(doc.year))?.fiscal_year || doc.year,
        file_url: doc.file_url || latestVersionByDoc[doc.document_id] || null,
      })) || [];

      setDocuments(formattedDocs);
    } catch (error) {
      console.error('Error:', error);
    }
  }, [barangayId, activeDocTab, documentCategories, documentTypes, folderYears]);

  // Re-fetch whenever the screen comes into focus
  useFocusEffect(
    useCallback(() => {
      fetchDocuments();
    }, [barangayId, activeDocTab, documentCategories])
  );

  // Also re-fetch immediately when the active tab changes
  useEffect(() => {
    fetchDocuments();
  }, [activeDocTab]);

  // Always refresh on mount
  useEffect(() => {
    fetchDocuments();
  }, []);

  // Accent color based on active tab
  const tabColor = COLORS[activeDocTab.toLowerCase()] || COLORS.planning;

  // When tab changes, reset subType
  const handleTabChange = (tab) => {
    setActiveDocTab(tab);
    setActiveSubType(null);
    setDropdownOpen(false);
    setSearchText('');
  };

  // Build subTypes from the document types that belong to the active category.
  // Each entry carries both id and name so filtering can match by id (exact)
  // while still rendering the human-readable label.
  const subTypes = useMemo(() => {
    const activeCategory = documentCategories.find(c => c.document_category === activeDocTab);
    if (!activeCategory) return [];
    return documentTypes
      .filter(t => t.category === activeCategory.id)
      .map(t => ({ id: t.id, name: t.document_type }));
  }, [documentCategories, documentTypes, activeDocTab]);

  // All docs for current tab (or filtered by subType)
  const allDocs = useMemo(() => {
    if (activeSubType) {
      // If params passed docTypeId, prefer an exact id match; otherwise substring on title.
      if (params?.docTypeId) {
        return documents.filter(d => String(d.document_type) === String(params.docTypeId));
      }
      return documents.filter(d => d.name.includes(activeSubType));
    }
    return documents;
  }, [activeDocTab, activeSubType, documents, params?.docTypeId]);

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
    return toPhilippineDate(dateStr, { year: 'numeric', month: 'short', day: 'numeric' });
  };

  // In-app viewer (matches sk-document-management): full-screen modal with
  // a WebView/iframe rendering the file through the Google Docs viewer.
  const [viewerModal, setViewerModal] = useState({ visible: false, fileUrl: null, title: '' });
  const [webViewLoading, setWebViewLoading] = useState(false);
  const [downloadModalVisible, setDownloadModalVisible] = useState(false);
  const [documentToDownload, setDocumentToDownload] = useState(null);

  const handleViewDocument = (doc) => {
    if (!doc?.file_url) {
      Alert.alert('No File', 'This document does not have a file attached.');
      return;
    }
    setViewerModal({ visible: true, fileUrl: doc.file_url, title: doc.name });
    setWebViewLoading(true);
  };

  const handleDownloadDocument = (doc) => {
    if (!doc?.file_url) {
      Alert.alert('No File', 'This document does not have a file attached.');
      return;
    }
    setDocumentToDownload({ fileUrl: doc.file_url, title: doc.name });
    setDownloadModalVisible(true);
  };

  const handleDownloadConfirm = async () => {
    if (!documentToDownload?.fileUrl) return;
    setDownloadModalVisible(false);
    setDocumentToDownload(null);
    try {
      await Linking.openURL(documentToDownload.fileUrl);
    } catch (err) {
      console.error('Download error:', err);
      Alert.alert('Download Failed', `Could not open the file: ${err.message}`);
    }
  };

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
    if (!uploadTitle.trim() || !uploadCategory || !uploadDocType || !uploadYear) {
      alert('Please fill in all fields');
      return;
    }
    if (!barangayId || !user?.userId) {
      alert('User information missing');
      return;
    }

    setUploading(true);
    try {
      let fileUrl = null;

      // Get the year value from the selected folder_year
      const selectedYear = folderYears.find(y => y.id === uploadYear);
      const yearValue = selectedYear?.fiscal_year || new Date().getFullYear();

      // Upload file to Supabase storage if selected
      if (selectedFile) {
        // Sanitize filename - remove special chars and replace spaces
        const sanitizedName = selectedFile.name
          .replace(/[^\w\s.-]/g, '')
          .replace(/\s+/g, '_');
        const fileName = `${barangayId}_${yearValue}_${Date.now()}_${sanitizedName}`;

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

      // Create document record with foreign key references
      const { data: docData, error } = await supabase
        .from('documents')
        .insert({
          barangay_id: barangayId,
          submitted_by: user.userId,
          title: uploadTitle.trim(),
          folder_category: String(uploadCategory),
          document_type: String(uploadDocType),
          year: uploadYear,
          status: 'saved',
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

      // Get category name for activity log
      const categoryName = documentCategories.find(c => c.id === uploadCategory)?.document_category || 'Unknown';

      // Log the activity
      await logActivity('Create document', `Created document "${uploadTitle.trim()}" in ${categoryName}`);

      // Reset form and close modal
      setUploadTitle('');
      setUploadCategory(null);
      setUploadDocType(null);
      setUploadYear(null);
      setSelectedFile(null);
      setUploadModalVisible(false);
      setUploading(false);

      // Navigate to document management - Saved tab to see the new document
      router.push({ pathname: '/(tabs)/sk-document-management', params: { initialTab: 'Saved' } });
    } catch (error) {
      console.error('Error:', error);
      alert('An error occurred while uploading');
      setUploading(false);
    }
  };

  // Reset upload form
  const resetUploadForm = () => {
    setUploadTitle('');
    setUploadCategory(null);
    setUploadDocType(null);
    setUploadYear(null);
    setCategoryDropdownOpen(false);
    setDocTypeDropdownOpen(false);
    setYearDropdownOpen(false);
    setSelectedFile(null);
    setExistingDocTypes([]);
  };


  
  // ── Main Content ──
  const renderContent = () => (
    <View style={[styles.main, isMobile && styles.mainMobile]}>
      <MobileHeader
        title="Documents"
        onMenuPress={() => setSidebarVisible(true)}
        onBellPress={notif.open}
        bellCount={notifCount}
        BellIcon={BellIcon}
        colors={COLORS}
        hidden={isMobile && sidebarVisible}
      />
      <ScrollView
        style={styles.mainScroll}
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
          </View>
          <View style={styles.headerRight}>
            <TouchableOpacity style={styles.bellBtn} onPress={notif.open} activeOpacity={0.7}>
              <BellIcon count={notifCount} />
            </TouchableOpacity>
          </View>
        </View>
      )}

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
            const tabTint = COLORS[tab.toLowerCase()] || COLORS.planning;
            return (
              <TouchableOpacity
                key={tab}
                style={[
                  styles.docTab,
                  active && [styles.docTabActive, { backgroundColor: tabTint.header, borderColor: tabTint.header, shadowColor: tabTint.header }],
                ]}
                onPress={() => handleTabChange(tab)}
                activeOpacity={0.8}
              >
                <Text style={[styles.docTabText, active && styles.docTabTextActive]}>{tab}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Search Bar + Scan Button */}
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
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
<DocumentScannerButton
  style={styles.scanBtn}
  scanner={scanner}
  onPdfReady={(file) => {
    setSelectedFile(file);
    setUploadModalVisible(true);
  }}/>
          <TouchableOpacity style={styles.scanBtn} onPress={() => setUploadModalVisible(true)} activeOpacity={0.8}>
            <Text style={styles.scanIcon}>↑</Text>
            <Text style={styles.scanText}>Upload</Text>
          </TouchableOpacity>
        </View>
      </View>

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
          <Text style={[styles.tableHeaderText, { width: 90, textAlign: 'center' }]}>Action</Text>
        </View>

        {/* Table Rows */}
        {visibleDocs.length > 0 ? (
          visibleDocs.map((doc, idx) => (
            <View
              key={doc.id}
              style={[styles.tableRow, idx % 2 === 1 && { backgroundColor: tabColor.bg + '55' }]}
            >
              <View style={styles.tableRowLeft}>
                <Text style={styles.docName} numberOfLines={1}>{doc.name}</Text>
              </View>
              <Text style={styles.docDate}>{formatDate(doc.date)}</Text>
              <View style={styles.rowActions}>
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => handleDownloadDocument(doc)}
                >
                  <SaveIcon />
                </TouchableOpacity>
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => handleViewDocument(doc)}
                >
                  <ViewIcon />
                </TouchableOpacity>
              </View>
            </View>
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
    </View>
  );

  return (
    <>
      <Head>
        <title>Document List · SK Monitoring</title>
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
                  style={[styles.modalDropdown, !uploadCategory && styles.modalDropdownPlaceholder]}
                  onPress={() => { setCategoryDropdownOpen(!categoryDropdownOpen); setDocTypeDropdownOpen(false); setYearDropdownOpen(false); }}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.modalDropdownText, !uploadCategory && styles.modalDropdownPlaceholderText]}>
                    {documentCategories.find(c => c.id === uploadCategory)?.document_category || 'Select Category'}
                  </Text>
                  <Text style={styles.modalDropdownArrow}>{categoryDropdownOpen ? '▲' : '▼'}</Text>
                </TouchableOpacity>
                {categoryDropdownOpen && (
                  <View style={styles.modalDropdownMenu}>
                    {documentCategories.length > 0 ? documentCategories.map(cat => (
                      <TouchableOpacity
                        key={cat.id}
                        style={[styles.modalDropdownItem, uploadCategory === cat.id && styles.modalDropdownItemActive]}
                        onPress={() => { setUploadCategory(cat.id); setUploadDocType(null); setCategoryDropdownOpen(false); }}
                        activeOpacity={0.8}
                      >
                        <Text style={[styles.modalDropdownItemText, uploadCategory === cat.id && styles.modalDropdownItemTextActive]}>
                          {cat.document_category}
                        </Text>
                        {uploadCategory === cat.id && <Text style={styles.modalDropdownCheck}>✓</Text>}
                      </TouchableOpacity>
                    )) : (
                      <View style={{ paddingVertical: 16, paddingHorizontal: 14 }}>
                        <Text style={{ fontSize: 13, color: COLORS.subText, textAlign: 'center' }}>
                          No categories available. Please contact admin to add document categories.
                        </Text>
                      </View>
                    )}
                  </View>
                )}
              </View>

              {/* Document Type Dropdown */}
              <Text style={styles.modalLabel}>Document Type</Text>
              <View style={styles.modalDocTypeDropdownWrapper}>
                <TouchableOpacity
                  style={[styles.modalDropdown, !uploadDocType && styles.modalDropdownPlaceholder]}
                  onPress={() => { if (uploadCategory) { setDocTypeDropdownOpen(!docTypeDropdownOpen); setCategoryDropdownOpen(false); setYearDropdownOpen(false); } }}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.modalDropdownText, !uploadDocType && styles.modalDropdownPlaceholderText]}>
                    {documentTypes.find(t => t.id === uploadDocType)?.document_type || 'Select Document Type'}
                  </Text>
                  <Text style={styles.modalDropdownArrow}>{docTypeDropdownOpen ? '▲' : '▼'}</Text>
                </TouchableOpacity>
                {docTypeDropdownOpen && (
                  <ScrollView style={styles.modalDropdownMenu} showsVerticalScrollIndicator={false}>
                    {currentDocTypes.length > 0 ? currentDocTypes.map(type => (
                      <TouchableOpacity
                        key={type.id}
                        style={[styles.modalDropdownItem, uploadDocType === type.id && styles.modalDropdownItemActive]}
                        onPress={() => { setUploadDocType(type.id); setUploadTitle(type.document_type); setDocTypeDropdownOpen(false); }}
                        activeOpacity={0.8}
                      >
                        <Text style={[styles.modalDropdownItemText, uploadDocType === type.id && styles.modalDropdownItemTextActive]}>
                          {type.document_type}
                        </Text>
                        {uploadDocType === type.id && <Text style={styles.modalDropdownCheck}>✓</Text>}
                      </TouchableOpacity>
                    )) : (
                      <View style={{ paddingVertical: 16, paddingHorizontal: 14 }}>
                        <Text style={{ fontSize: 13, color: COLORS.subText, textAlign: 'center' }}>
                          {documentTypes.some(t => t.category === uploadCategory)
                            ? 'All document types for this category have already been uploaded.'
                            : 'No document types available for this category.'}
                        </Text>
                      </View>
                    )}
                  </ScrollView>
                )}
              </View>

              {/* Year Dropdown */}
              <Text style={styles.modalLabel}>Year</Text>
              <View style={styles.modalDropdownWrapper}>
                <TouchableOpacity
                  style={[styles.modalDropdown, !uploadYear && styles.modalDropdownPlaceholder]}
                  onPress={() => { setYearDropdownOpen(!yearDropdownOpen); setCategoryDropdownOpen(false); setDocTypeDropdownOpen(false); }}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.modalDropdownText, !uploadYear && styles.modalDropdownPlaceholderText]}>
                    {folderYears.find(y => y.id === uploadYear)?.fiscal_year || 'Select Year'}
                  </Text>
                  <Text style={styles.modalDropdownArrow}>{yearDropdownOpen ? '▲' : '▼'}</Text>
                </TouchableOpacity>
                {yearDropdownOpen && (
                  <View style={styles.modalDropdownMenu}>
                    {folderYears.length > 0 ? folderYears.map(year => (
                      <TouchableOpacity
                        key={year.id}
                        style={[styles.modalDropdownItem, uploadYear === year.id && styles.modalDropdownItemActive]}
                        onPress={() => { setUploadYear(year.id); setYearDropdownOpen(false); }}
                        activeOpacity={0.8}
                      >
                        <Text style={[styles.modalDropdownItemText, uploadYear === year.id && styles.modalDropdownItemTextActive]}>
                          {year.fiscal_year}
                        </Text>
                        {uploadYear === year.id && <Text style={styles.modalDropdownCheck}>✓</Text>}
                      </TouchableOpacity>
                    )) : (
                      <View style={{ paddingVertical: 16, paddingHorizontal: 14 }}>
                        <Text style={{ fontSize: 13, color: COLORS.subText, textAlign: 'center' }}>
                          No years available. Please contact admin to add folder years.
                        </Text>
                      </View>
                    )}
                  </View>
                )}
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

      {/* ── Document Viewer (matches sk-document-management) ── */}
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
                    Alert.alert('Load Failed', 'Could not load the document. Try opening it externally.');
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

      {/* ── Download Confirmation Modal (matches sk-document-management) ── */}
      <Modal
        visible={downloadModalVisible}
        animationType="fade"
        transparent={true}
        onRequestClose={() => { setDownloadModalVisible(false); setDocumentToDownload(null); }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.dlModalContent}>
            <View style={styles.modalIconStrip}>
              <View style={[styles.modalIconCircle, { backgroundColor: '#DBEAFE' }]}>
                <Feather name="download" size={26} color={COLORS.blue} />
              </View>
            </View>
            <View style={styles.dlModalBody}>
              <Text style={styles.dlModalTitle}>Download Document</Text>
              <Text style={styles.dlModalBodyText}>
                Do you want to download{' '}
                <Text style={styles.modalHighlight}>"{documentToDownload?.title}"</Text>?
              </Text>
            </View>
            <View style={styles.modalDivider} />
            <View style={styles.dlModalFooter}>
              <TouchableOpacity
                style={styles.dlModalCancelBtn}
                onPress={() => { setDownloadModalVisible(false); setDocumentToDownload(null); }}
                activeOpacity={0.8}
              >
                <Text style={styles.dlModalCancelBtnText}>Cancel</Text>
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
    </View>
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
  mainScroll:  { flex: 1 },
  mainContent: { padding: 20, paddingBottom: 40 },

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
  // only the button container is styled here. (Removed a leftover
  // hand-rolled bell + gold badge that predated the shared component.)
  bellBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: COLORS.cardBg, alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08, shadowRadius: 6, elevation: 3,
  },

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
  searchRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: 16,
  },
  scanBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: '#133E75', borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 9,
  },
  scanIcon: { fontSize: 16, color: '#FFFFFF' },
  scanText: { fontSize: 13, fontWeight: '700', color: '#FFFFFF' },
  searchBox: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.white, borderRadius: 20,
    borderWidth: 1, borderColor: COLORS.lightGray,
    paddingHorizontal: 12, paddingVertical: 7,
    width: isMobile ? '55%' : 280,
  },
  searchIcon:  { fontSize: 12, color: COLORS.midGray, marginRight: 4 },
  searchInput: { flex: 1, fontSize: 12, color: COLORS.darkText },

  // Category
  categoryRow:   { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  categoryLabel: { fontSize: 12, fontWeight: '700', color: COLORS.darkText },

  // Filter row
  filterRow: {
    flexDirection: 'row', alignItems: 'flex-start', marginBottom: 16, gap: 6,
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
    backgroundColor: COLORS.gold, borderColor: COLORS.gold,
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
  rowActions: {
    width: 90, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', gap: isMobile ? 2 : 4,
  },
  actionIconWrap: { padding: 4 },
  actionIconText: { fontSize: isMobile ? 14 : 16 },

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
  modalDocTypeDropdownWrapper: { position: 'relative', marginBottom: 12, zIndex: 150 },
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

  // ── Download / Viewer Modals (matches sk-document-management) ──
  dlModalContent: {
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
  dlModalBody: {
    paddingHorizontal: 24, paddingTop: 14, paddingBottom: 20, alignItems: 'center',
  },
  dlModalTitle: {
    fontSize: 17, fontWeight: '800', color: COLORS.darkText,
    textAlign: 'center', marginBottom: 10, letterSpacing: 0.2,
  },
  dlModalBodyText: {
    fontSize: 13.5, color: COLORS.subText, lineHeight: 20,
    textAlign: 'center',
  },
  dlModalFooter: {
    flexDirection: 'row', gap: 10,
    paddingHorizontal: 20, paddingVertical: 16,
    backgroundColor: COLORS.offWhite,
  },
  dlModalCancelBtn: {
    flex: 1, paddingVertical: 13, borderRadius: 10,
    borderWidth: 1.5, borderColor: COLORS.lightGray,
    alignItems: 'center', backgroundColor: COLORS.white,
  },
  dlModalCancelBtnText: {
    fontSize: 14, fontWeight: '700', color: COLORS.subText,
  },
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
  modalDivider: {
    height: 1, backgroundColor: COLORS.lightGray,
  },
  modalHighlight: {
    fontWeight: '700', color: COLORS.darkText,
  },
  modalActionBtn: {
    flex: 1, flexDirection: 'row', paddingVertical: 13, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  modalActionBtnText: {
    fontSize: 14, fontWeight: '700', color: COLORS.white,
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
});