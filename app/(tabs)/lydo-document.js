import * as FileSystem from 'expo-file-system';
import { useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useState } from 'react';
import {
  Dimensions,
  Image,
  Linking,
  Modal,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { supabase } from '../../utils/supabase';
import { useAuth } from './authContext';
import { useNav } from './navContext';
import Sidebar, { LYDO_NAV_ITEMS } from './../components/Sidebar';

// WebView: use react-native-webview on native, iframe on web
let WebView = null;
if (Platform.OS !== 'web') {
  WebView = require('react-native-webview').WebView;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const isMobile = SCREEN_WIDTH < 768;

// ─── COLORS ───────────────────────────────────────────────────────────────────
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

  planning: {
    header:  '#5B8DD9',
    bg:      '#EAF0FB',
    btn:     '#5B8DD9',
    text:    '#FFFFFF',
    subText: '#2A4E8A',
  },
  financial: {
    header:  '#3AAA5C',
    bg:      '#E8F7EE',
    btn:     '#3AAA5C',
    text:    '#FFFFFF',
    subText: '#1A6B38',
  },
  governance: {
    header:  '#8B5BD9',
    bg:      '#F0EAFB',
    btn:     '#8B5BD9',
    text:    '#FFFFFF',
    subText: '#5A2EA0',
  },
  performance: {
    header:  '#E87A30',
    bg:      '#FDF0E6',
    btn:     '#E87A30',
    text:    '#FFFFFF',
    subText: '#A04010',
  },
};

// ─── BARANGAY DATA ─────────────────────────────────────────────────────────────
// (Now fetched from Supabase - see useEffect below)

// ─── YEAR FOLDERS per barangay ────────────────────────────────────────────────
// ─── DOCUMENT GROUPS (shown after selecting a year) ───────────────────────────
const DOCUMENT_GROUPS = [
  {
    id: 'planning',
    title: 'PLANNING DOCUMENTS',
    category: 'Planning',
    icon: '📋',
    colors: COLORS.planning,
    items: ['LYDP', 'Work Plans', 'Project Proposals'],
  },
  {
    id: 'financial',
    title: 'FINANCIAL DOCUMENTS',
    category: 'Financial',
    icon: '💰',
    colors: COLORS.financial,
    items: [
      'Financial Report Summary',
      'Register of Cash Receipts',
      'Disbursement Vouchers',
      'Disbursement Vouchers',
      'Liquidation Reports',
    ],
  },
  {
    id: 'governance',
    title: 'GOVERNANCE DOCUMENTS',
    category: 'Governance',
    icon: '⚖️',
    colors: COLORS.governance,
    items: ['Resolutions', 'Ordinances'],
  },
  {
    id: 'performance',
    title: 'PERFORMANCE DOCUMENTS',
    category: 'Activities',
    icon: '📊',
    colors: COLORS.performance,
    items: [
      'Accomplishment Reports',
      'Activity Documentation',
      'Event Reports',
      'Minutes of the meetings',
    ],
  },
];

// ─── NAV TABS ─────────────────────────────────────────────────────────────────
const NAV_TABS = ['Dashboard', 'Documents', 'Monitor', 'Barangay', 'Logs'];
const DOCUMENT_TABS = ['Barangay Folders', 'Reports', 'Templates'];

// ─── ICON COMPONENTS ──────────────────────────────────────────────────────────
const BellIcon = ({ hasNotif }) => (
  <View style={styles.bellWrapper}>
    <View style={styles.bellBody} />
    <View style={styles.bellBottom} />
    {hasNotif && <View style={styles.bellDot} />}
  </View>
);

const MenuIcon = () => (
  <View style={styles.menuIconContainer}>
    <View style={styles.menuLine} />
    <View style={styles.menuLine} />
    <View style={styles.menuLine} />
  </View>
);

// ─── macOS-STYLE FOLDER ICON ──────────────────────────────────────────────────
const FolderIcon = ({ size = 68 }) => {
  const w = size;
  const h = size * 0.82;
  const tabH = h * 0.11;
  const bodyTop = tabH * 0.7;
  const bodyH = h - bodyTop;

  return (
    <View style={{ width: w, height: h }}>
      {/* Tab */}
      <View style={{
        position: 'absolute', top: 0, left: 0,
        width: w * 0.36, height: tabH + 4,
        backgroundColor: '#0F68D0',
        borderTopLeftRadius: 4, borderTopRightRadius: 8,
      }} />
      {/* Body */}
      <View style={{
        position: 'absolute', top: bodyTop, left: 0,
        width: w, height: bodyH,
        backgroundColor: '#1A8CFF',
        borderRadius: 6, borderTopRightRadius: 6, borderTopLeftRadius: 2,
      }}>
        {/* Highlight */}
        <View style={{
          position: 'absolute', top: 5, left: 8, right: 8, height: bodyH * 0.28,
          backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 4,
        }} />
      </View>
    </View>
  );
};

// ─── YEAR FOLDER ICON (smaller, slightly different shade) ────────────────────
const YearFolderIcon = ({ size = 56 }) => {
  const w = size;
  const h = size * 0.82;
  const tabH = h * 0.11;
  const bodyTop = tabH * 0.7;
  const bodyH = h - bodyTop;

  return (
    <View style={{ width: w, height: h }}>
      <View style={{
        position: 'absolute', top: 0, left: 0,
        width: w * 0.36, height: tabH + 4,
        backgroundColor: '#2878D8',
        borderTopLeftRadius: 4, borderTopRightRadius: 7,
      }} />
      <View style={{
        position: 'absolute', top: bodyTop, left: 0,
        width: w, height: bodyH,
        backgroundColor: '#3A9EFF',
        borderRadius: 5, borderTopRightRadius: 5, borderTopLeftRadius: 2,
      }}>
        <View style={{
          position: 'absolute', top: 4, left: 6, right: 6, height: bodyH * 0.25,
          backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 3,
        }} />
      </View>
    </View>
  );
};

// ─── BREADCRUMB ───────────────────────────────────────────────────────────────
const Breadcrumb = ({ year, barangay, onPressDocuments, onPressYear }) => (
  <View style={styles.breadcrumb}>
    <TouchableOpacity onPress={onPressDocuments}>
      <Text style={styles.breadcrumbLink}>Documents</Text>
    </TouchableOpacity>
    {year && (
      <>
        <Text style={styles.breadcrumbSep}> › </Text>
        <TouchableOpacity onPress={onPressYear}>
          <Text style={[styles.breadcrumbLink, !barangay && styles.breadcrumbCurrent]}>
            {year}
          </Text>
        </TouchableOpacity>
      </>
    )}
    {barangay && (
      <>
        <Text style={styles.breadcrumbSep}> › </Text>
        <Text style={styles.breadcrumbCurrent}>{barangay.barangay_name}</Text>
      </>
    )}
  </View>
);

// ─── DOCUMENT CARD ────────────────────────────────────────────────────────────
const DocumentCard = ({ group, onItemPress }) => {
  const { colors, title, icon, items } = group;
  return (
    <View style={[styles.card, { backgroundColor: colors.bg }]}>
      <View style={[styles.cardHeader, { backgroundColor: colors.header }]}>
        <Text style={styles.cardHeaderIcon}>{icon}</Text>
        <Text style={styles.cardHeaderTitle}>{title}</Text>
      </View>
      <View style={styles.cardBody}>
        {items.map((item, idx) => (
          <TouchableOpacity
            key={idx}
            style={styles.docItem}
            onPress={() => onItemPress && onItemPress(item, group)}
            activeOpacity={0.7}
          >
            <View style={[styles.docBullet, { backgroundColor: colors.header }]} />
            <Text style={[styles.docItemText, { color: colors.subText }]}>{item}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
};

// ─── VIEW STATES ──────────────────────────────────────────────────────────────
// 'folders'  → year folder grid (root)
// 'years'    → barangay folders inside a year
// 'docs'     → document category cards for a barangay

// ─── MAIN SCREEN ──────────────────────────────────────────────────────────────
export default function LYDODocumentsScreen({ navigation }) {
  const router = useRouter();
  const { activeTab, setActiveTab } = useNav();
  const { logout, user } = useAuth();

  const [view, setView]                           = useState('folders'); // 'folders' | 'years' | 'doctypes'
  const [selectedBarangay, setSelectedBarangay]   = useState(null);
  const [selectedYear, setSelectedYear]           = useState(null);
  const [selectedDocType, setSelectedDocType]     = useState(null);
  const [searchText, setSearchText]               = useState('');
  const [notifCount]                              = useState(2);
  const [currentTime, setCurrentTime]             = useState('');
  const [sidebarVisible, setSidebarVisible]       = useState(false);
  const [activeDocumentTab, setActiveDocumentTab] = useState('Barangay Folders');
  const [barangays, setBarangays]                 = useState([]);
  const [documentYears, setDocumentYears]         = useState([]);
  const [docTypesForYear, setDocTypesForYear]     = useState([]); // {document_type, count}
  const [docsForType, setDocsForType]             = useState([]); // documents by barangay for selected type

  // Viewer state
  const [viewerModal, setViewerModal] = useState({ visible: false, fileUrl: null, title: '' });
  const [webViewLoading, setWebViewLoading] = useState(false);

  // Add Folder modal state
  const [addFolderVisible, setAddFolderVisible] = useState(false);
  const [newFolderYear, setNewFolderYear] = useState('');
  const [addFolderError, setAddFolderError] = useState('');

  // Add Document Type modal state
  const [addDocTypeVisible, setAddDocTypeVisible] = useState(false);
  const [newDocTypeName, setNewDocTypeName] = useState('');
  const [newDocTypeCategory, setNewDocTypeCategory] = useState('');
  const [newDocTypeYear, setNewDocTypeYear] = useState('');
  const [addDocTypeError, setAddDocTypeError] = useState('');

  // Document categories (from document_category table)
  const [docCategories, setDocCategories] = useState([]);

  // Handle view press - open document viewer
  const handleViewPress = (doc) => {
    if (!doc.file_url) {
      return;
    }
    setViewerModal({ visible: true, fileUrl: doc.file_url, title: doc.title });
    setWebViewLoading(true);
  };

  useEffect(() => { setActiveTab('Documents'); }, []);

  const today = new Date().toLocaleDateString('en-PH', {
    timeZone: 'Asia/Manila', month: 'long', day: 'numeric', year: 'numeric',
  });

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

  // Fetch all barangays and all years from database
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch all barangays
        const { data: barangayData, error: barangayError } = await supabase
          .from('barangays')
          .select('barangay_id, barangay_name, municipality, province')
          .order('barangay_name');

        if (barangayError) {
          console.error('Error fetching barangays:', barangayError);
        } else {
          setBarangays(barangayData || []);
        }

        // Fetch fiscal years from folder_year table
        const { data: yearData, error: yearError } = await supabase
          .from('folder_year')
          .select('id, fiscal_year')
          .order('fiscal_year', { ascending: true });

        if (yearError) {
          console.error('Error fetching years:', yearError);
        } else {
          const years = yearData?.map(d => d.fiscal_year).filter(Boolean).sort((a, b) => a - b) || [];
          setDocumentYears(years);
        }

        // Fetch document categories
        const { data: catData, error: catError } = await supabase
          .from('document_category')
          .select('id, document_category')
          .order('document_category');

        if (catError) {
          console.error('Error fetching categories:', catError);
        } else {
          setDocCategories(catData || []);
        }
      } catch (error) {
        console.error('Error:', error);
      }
    };

    fetchData();
  }, []);

  // ── Navigation helpers ──
  const goToFolders = () => {
    setView('folders');
    setSelectedBarangay(null);
    setSelectedYear(null);
    setSelectedDocType(null);
    setSearchText('');
  };

  // Year clicked → show document types for that year
  const goToYears = (year) => {
    setSelectedYear(year);
    setSelectedBarangay(null);
    setSelectedDocType(null);
    setView('years');
    setSearchText('');

    const fetchDocTypesForYear = async () => {
      try {
        // First, get the folder_year ID for this fiscal year
        const { data: yearData, error: yearDataError } = await supabase
          .from('folder_year')
          .select('id')
          .eq('fiscal_year', year)
          .single();

        if (yearDataError) {
          console.error('Error fetching folder year:', yearDataError);
          return;
        }

        const folderYearId = yearData?.id;
        if (!folderYearId) {
          console.error('No folder year found for:', year);
          return;
        }

        // Fetch all document types - we'll filter locally by year
        const { data: allDocTypes, error: typesError } = await supabase
          .from('document_types')
          .select('id, document_type, category, year')
          .order('document_type');

        if (typesError) { console.error('Error fetching doc types:', typesError); return; }

        // Filter: include types that are either (specific to this year) or (no specific year / null)
        const allTypes = (allDocTypes || []).filter(dt => {
          const dtYear = dt.year?.toString();
          return dtYear === year.toString() || dtYear === null || dtYear === undefined;
        });

        // Get counts from actual documents for this year using folder_year id
        const { data: docsData } = await supabase
          .from('documents')
          .select('document_type')
          .eq('year', folderYearId)
          .eq('status', 'approved');

        const countMap = new Map();

        // First, add document types from document_types table
        allTypes.forEach(docType => {
          if (docType.document_type) {
            // Count how many documents exist for this type
            const count = docsData?.filter(d => d.document_type === docType.id.toString()).length || 0;
            countMap.set(docType.document_type, count);
          }
        });

        // If countMap is empty (no documents yet), still show all document types with count 0
        if (countMap.size === 0 && allTypes.length > 0) {
          allTypes.forEach(docType => {
            if (docType.document_type && !countMap.has(docType.document_type)) {
              countMap.set(docType.document_type, 0);
            }
          });
        }

        const types = Array.from(countMap.entries()).map(([document_type, count]) => ({ document_type, count }));
        types.sort((a, b) => a.document_type.localeCompare(b.document_type));
        setDocTypesForYear(types);
      } catch (error) {
        console.error('Error:', error);
      }
    };

    fetchDocTypesForYear();
  };

  // Document type clicked → show documents grouped by barangay
  const goToDocTypes = (docType) => {
    setSelectedDocType(docType);
    setView('doctypes');
    setSearchText('');

    const fetchDocsForType = async () => {
      try {
        // First, get the folder_year ID for the selected fiscal year
        const { data: yearData, error: yearError } = await supabase
          .from('folder_year')
          .select('id')
          .eq('fiscal_year', selectedYear)
          .single();

        if (yearError) {
          console.error('Error fetching folder year:', yearError);
          return;
        }

        const folderYearId = yearData?.id;
        if (!folderYearId) {
          console.error('No folder year found for:', selectedYear);
          return;
        }

        // Then, find the document type ID from document_types table
        const { data: typeData, error: typeError } = await supabase
          .from('document_types')
          .select('id')
          .eq('document_type', docType)
          .single();

        if (typeError) {
          console.error('Error finding document type:', typeError);
          // Fallback: try querying directly with the docType string
          const { data, error } = await supabase
            .from('documents')
            .select('document_id, title, document_type, status, submitted_at, file_url, barangay_id, barangays(barangay_id, barangay_name)')
            .eq('year', folderYearId)
            .eq('document_type', docType)
            .eq('status', 'approved');

          if (error) { console.error('Error fetching docs:', error); return; }
          setDocsForType(data || []);
          return;
        }

        // Query documents using the found type ID and folder_year id
        const typeId = typeData?.id?.toString();
        const { data, error } = await supabase
          .from('documents')
          .select('document_id, title, document_type, status, submitted_at, file_url, barangay_id, barangays(barangay_id, barangay_name)')
          .eq('year', folderYearId)
          .eq('document_type', typeId)
          .eq('status', 'approved');

        if (error) { console.error('Error fetching docs:', error); return; }
        setDocsForType(data || []);
      } catch (error) {
        console.error('Error:', error);
      }
    };

    fetchDocsForType();
  };

  const goToDocs = (barangay) => {
    setSelectedBarangay(barangay);
    setView('docs');
    setSearchText('');
  };

  const handleNavPress = (tab) => {
    setActiveTab(tab);
    setSidebarVisible(false);
    if (tab === 'Dashboard') router.push('/(tabs)/lydo-dashboard')
    else if (tab === 'Documents') router.push('/(tabs)/lydo-document');
    else if (tab === 'Monitor') router.push('/(tabs)/lydo-monitor');
        if (tab === 'Barangay') router.push('/(tabs)/lydo-accounts');
          if (tab === 'Logs') router.push('/(tabs)/lydo-logs');
  };

  const handleLogout = () => {
    logout();
    router.replace('/');
  };

  const handleDocumentTabPress = (tab) => {
    if (tab === 'Barangay Folders') { return; /* already here */ }
    if (tab === 'Templates') { router.push('/(tabs)/lydo-document-templates'); return; }
    if (tab === 'Reports') { router.push('/(tabs)/lydo-document-reports'); return; }
    setActiveDocumentTab(tab);
  };

  const handleAddFolder = async () => {
    const trimmed = newFolderYear.trim();

    // Validate: 4-digit year, reasonable range
    if (!/^\d{4}$/.test(trimmed)) {
      setAddFolderError('Please enter a valid 4-digit year (e.g. 2026).');
      return;
    }
    const yearNum = parseInt(trimmed, 10);
    if (yearNum < 2000 || yearNum > 2100) {
      setAddFolderError('Year must be between 2000 and 2100.');
      return;
    }
    if (documentYears.includes(yearNum) || documentYears.includes(trimmed)) {
      setAddFolderError(`Folder for ${trimmed} already exists.`);
      return;
    }

    try {
      // Insert new fiscal year into folder_year table
      const { data: inserted, error } = await supabase
        .from('folder_year')
        .insert({
          fiscal_year: yearNum,
          created_at: new Date().toISOString(),
        })
        .select('fiscal_year')
        .single();

      if (error) {
        setAddFolderError(`Error: ${error.message}`);
        console.error('Insert year folder error:', error);
        return;
      }

      // Update local state sorted ascending
      const updated = [yearNum, ...documentYears].sort((a, b) => a - b);
      setDocumentYears(updated);

      setAddFolderVisible(false);
      setNewFolderYear('');
      setAddFolderError('');
    } catch (err) {
      setAddFolderError(`Unexpected error: ${err.message}`);
      console.error(err);
    }
  };

  const handleAddDocType = async () => {
    const trimmed = newDocTypeName.trim();

    // Validate: name is required
    if (!trimmed) {
      setAddDocTypeError('Document type name is required.');
      return;
    }

    if (!newDocTypeCategory) {
      setAddDocTypeError('Please select a category.');
      return;
    }

    try {
      // Prepare the insert payload
      const insertPayload = {
        document_type: trimmed,
        category: newDocTypeCategory,
        created_at: new Date().toISOString(),
      };

      // Add year if specified (null means applies to all years)
      if (newDocTypeYear && newDocTypeYear !== 'all') {
        insertPayload.year = newDocTypeYear;
      }

      const { data: inserted, error } = await supabase
        .from('document_types')
        .insert(insertPayload)
        .select('id, document_type')
        .single();

      if (error) {
        setAddDocTypeError(`Error: ${error.message}`);
        console.error('Insert document type error:', error);
        return;
      }

      // Close modal and reset
      setAddDocTypeVisible(false);
      setNewDocTypeName('');
      setNewDocTypeCategory('');
      setNewDocTypeYear('');
      setAddDocTypeError('');

      // Refresh the document types for the current year
      if (selectedYear) {
        goToYears(selectedYear);
      }
    } catch (err) {
      setAddDocTypeError(`Unexpected error: ${err.message}`);
      console.error(err);
    }
  };

  // ── Filtered data ──
  const filteredYears = documentYears.filter(y =>
    y.toString().includes(searchText)
  );

  const filteredDocTypes = docTypesForYear.filter(d =>
    d.document_type.toLowerCase().includes(searchText.toLowerCase())
  );

  const filteredDocsForType = docsForType.filter(d =>
    (d.barangays?.barangay_name || '').toLowerCase().includes(searchText.toLowerCase()) ||
    (d.title || '').toLowerCase().includes(searchText.toLowerCase())
  );

  const filteredGroups = DOCUMENT_GROUPS.filter(g =>
    searchText === '' ||
    g.title.toLowerCase().includes(searchText.toLowerCase()) ||
    g.items.some(i => i.toLowerCase().includes(searchText.toLowerCase()))
  );

  // ── Content body (shared between mobile/desktop) ──
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

      {/* Page title */}
      <Text style={styles.sectionTitle}>Document Management</Text>

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
              <Text style={[styles.documentTabText, active && styles.documentTabTextActive]}>{tab}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* ── VIEW: ROOT FOLDERS (years) ── */}
      {view === 'folders' && (
        <>
          {/* Search + Add Folder button row */}
          <View style={[styles.searchRow, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }]}>
            <View style={styles.searchBox}>
              <Text style={{ fontSize: 13, marginRight: 6 }}>🔍</Text>
              <TextInput
                style={styles.searchInput}
                placeholder="Search year…"
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
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <TouchableOpacity
                style={styles.addFolderBtn}
                onPress={() => {
                  setNewFolderYear('');
                  setAddFolderError('');
                  setAddFolderVisible(true);
                }}
                activeOpacity={0.8}
              >
                {/* Mini folder icon */}
                <View style={styles.addFolderBtnIconWrap}>
                  <View style={styles.addFolderBtnFolderTab} />
                  <View style={styles.addFolderBtnFolderBody}>
                    <Text style={styles.addFolderBtnPlus}>+</Text>
                  </View>
                </View>
                <Text style={styles.addFolderBtnText}>Add Folder</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.addFolderBtn}
                onPress={() => {
                  setNewDocTypeName('');
                  setNewDocTypeCategory('');
                  setNewDocTypeYear('all');
                  setAddDocTypeError('');
                  setAddDocTypeVisible(true);
                }}
                activeOpacity={0.8}
              >
                <Text style={styles.addFolderBtnText}>➕ Document Type</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Container box for year folders */}
          <View style={styles.folderContainer}>
            <Text style={styles.allDocsLabel}>All Documents</Text>

            {filteredYears.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={{ fontSize: 32, marginBottom: 8 }}>📁</Text>
                <Text style={styles.emptyText}>No year folders yet.</Text>
                <Text style={{ fontSize: 12, color: COLORS.midGray, marginTop: 4 }}>
                  Tap "+ Add Folder" to create one.
                </Text>
              </View>
            ) : (
              <View style={isMobile ? styles.folderGridMobile : styles.folderGrid}>
                {filteredYears.map((year, idx) => (
                  <TouchableOpacity
                    key={idx}
                    style={styles.folderCard}
                    onPress={() => goToYears(year)}
                    activeOpacity={0.75}
                  >
                    <YearFolderIcon size={isMobile ? 60 : 68} />
                    <Text style={styles.folderName}>{year}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          {/* ── ADD FOLDER MODAL ── */}
          <Modal
            visible={addFolderVisible}
            transparent
            animationType="fade"
            onRequestClose={() => setAddFolderVisible(false)}
          >
            <TouchableOpacity
              style={styles.addFolderOverlay}
              activeOpacity={1}
              onPress={() => setAddFolderVisible(false)}
            />
            <View style={styles.addFolderModalWrap} pointerEvents="box-none">
              <View style={styles.addFolderModal}>
                {/* Header */}
                <View style={styles.addFolderModalHeader}>
                  <View style={styles.addFolderModalHeaderLeft}>
                    <View style={styles.addFolderModalIconWrap}>
                      <Text style={{ fontSize: 20 }}>📁</Text>
                    </View>
                    <Text style={styles.addFolderModalTitle}>New Year Folder</Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => setAddFolderVisible(false)}
                    style={styles.addFolderCloseBtn}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.addFolderCloseBtnText}>✕</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.addFolderModalDivider} />

                {/* Body */}
                <View style={styles.addFolderModalBody}>
                  <Text style={styles.addFolderModalLabel}>Year</Text>
                  <TextInput
                    style={[styles.addFolderInput, addFolderError ? styles.addFolderInputError : null]}
                    placeholder={`e.g. ${new Date().getFullYear()}`}
                    placeholderTextColor={COLORS.midGray}
                    value={newFolderYear}
                    onChangeText={t => { setNewFolderYear(t.replace(/[^0-9]/g, '')); setAddFolderError(''); }}
                    keyboardType="number-pad"
                    maxLength={4}
                    autoFocus
                  />
                  {addFolderError ? (
                    <Text style={styles.addFolderErrorText}>{addFolderError}</Text>
                  ) : (
                    <Text style={styles.addFolderHint}>
                      A new folder will be created for this fiscal year.
                    </Text>
                  )}
                </View>

                {/* Footer buttons */}
                <View style={styles.addFolderModalFooter}>
                  <TouchableOpacity
                    style={styles.addFolderCancelBtn}
                    onPress={() => setAddFolderVisible(false)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.addFolderCancelText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.addFolderConfirmBtn, !newFolderYear.trim() && styles.addFolderConfirmBtnDisabled]}
                    onPress={handleAddFolder}
                    activeOpacity={0.8}
                    disabled={!newFolderYear.trim()}
                  >
                    <Text style={styles.addFolderConfirmText}>Create Folder</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>

          {/* ── ADD DOCUMENT TYPE MODAL ── */}
          <Modal
            visible={addDocTypeVisible}
            transparent
            animationType="fade"
            onRequestClose={() => setAddDocTypeVisible(false)}
          >
            <TouchableOpacity
              style={styles.addFolderOverlay}
              activeOpacity={1}
              onPress={() => setAddDocTypeVisible(false)}
            />
            <View style={styles.addFolderModalWrap} pointerEvents="box-none">
              <View style={styles.addFolderModal}>
                {/* Header */}
                <View style={styles.addFolderModalHeader}>
                  <View style={styles.addFolderModalHeaderLeft}>
                    <View style={styles.addFolderModalIconWrap}>
                      <Text style={{ fontSize: 20 }}>📄</Text>
                    </View>
                    <Text style={styles.addFolderModalTitle}>New Document Type</Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => setAddDocTypeVisible(false)}
                    style={styles.addFolderCloseBtn}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.addFolderCloseBtnText}>✕</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.addFolderModalDivider} />

                {/* Body */}
                <View style={styles.addFolderModalBody}>
                  <Text style={styles.addFolderModalLabel}>Document Type Name</Text>
                  <TextInput
                    style={[styles.addFolderInput, addDocTypeError && !newDocTypeName.trim() ? styles.addFolderInputError : null]}
                    placeholder="e.g. Annual Report"
                    placeholderTextColor={COLORS.midGray}
                    value={newDocTypeName}
                    onChangeText={t => { setNewDocTypeName(t); setAddDocTypeError(''); }}
                    autoFocus
                  />

                  <Text style={[styles.addFolderModalLabel, { marginTop: 12 }]}>Category</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
                    {docCategories.map(cat => (
                      <TouchableOpacity
                        key={cat.id}
                        style={[
                          styles.categoryChip,
                          newDocTypeCategory === cat.id.toString() && styles.categoryChipActive
                        ]}
                        onPress={() => { setNewDocTypeCategory(cat.id.toString()); setAddDocTypeError(''); }}
                      >
                        <Text style={[
                          styles.categoryChipText,
                          newDocTypeCategory === cat.id.toString() && styles.categoryChipTextActive
                        ]}>
                          {cat.document_category}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <Text style={[styles.addFolderModalLabel, { marginTop: 12 }]}>Year Specific (Optional)</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
                    <TouchableOpacity
                      style={[
                        styles.categoryChip,
                        (newDocTypeYear === '' || newDocTypeYear === 'all') && styles.categoryChipActive
                      ]}
                      onPress={() => { setNewDocTypeYear('all'); setAddDocTypeError(''); }}
                    >
                      <Text style={[
                        styles.categoryChipText,
                        (newDocTypeYear === '' || newDocTypeYear === 'all') && styles.categoryChipTextActive
                      ]}>
                        All Years
                      </Text>
                    </TouchableOpacity>
                    {documentYears.map(y => (
                      <TouchableOpacity
                        key={y}
                        style={[
                          styles.categoryChip,
                          newDocTypeYear === y.toString() && styles.categoryChipActive
                        ]}
                        onPress={() => { setNewDocTypeYear(y.toString()); setAddDocTypeError(''); }}
                      >
                        <Text style={[
                          styles.categoryChipText,
                          newDocTypeYear === y.toString() && styles.categoryChipTextActive
                        ]}>
                          {y}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  {addDocTypeError ? (
                    <Text style={styles.addFolderErrorText}>{addDocTypeError}</Text>
                  ) : (
                    <Text style={styles.addFolderHint}>
                      This document type will be available for the selected category and year(s).
                    </Text>
                  )}
                </View>

                {/* Footer buttons */}
                <View style={styles.addFolderModalFooter}>
                  <TouchableOpacity
                    style={styles.addFolderCancelBtn}
                    onPress={() => setAddDocTypeVisible(false)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.addFolderCancelText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.addFolderConfirmBtn,
                      (!newDocTypeName.trim() || !newDocTypeCategory) && styles.addFolderConfirmBtnDisabled
                    ]}
                    onPress={handleAddDocType}
                    activeOpacity={0.8}
                    disabled={!newDocTypeName.trim() || !newDocTypeCategory}
                  >
                    <Text style={styles.addFolderConfirmText}>Add Type</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>
        </>
      )}

      {/* ── VIEW: DOCUMENT TYPE FOLDERS inside a year (table layout) ── */}
      {view === 'years' && (
        <>
          {/* Back Button */}
          <TouchableOpacity
            style={styles.backBtn}
            onPress={goToFolders}
            activeOpacity={0.75}
          >
            <Feather name="arrow-left" size={16} color={COLORS.navy} />
            <Text style={styles.backBtnText}>Back</Text>
          </TouchableOpacity>

          {/* Breadcrumb: Folders > 2026 Documents */}
          <View style={styles.breadcrumb}>
            <TouchableOpacity onPress={goToFolders}>
              <Text style={styles.breadcrumbLink}>Folders</Text>
            </TouchableOpacity>
            <Text style={styles.breadcrumbSep}> › </Text>
            <Text style={styles.breadcrumbCurrent}>{selectedYear} Documents</Text>
          </View>

          {/* Search row + label + Add Doc Type button */}
          <View style={styles.tableTopRow}>
            <Text style={styles.allDocsLabel}>All Documents</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
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
          </View>

          {/* Table */}
          <View style={styles.docTable}>
            {/* Table Header */}
            <View style={styles.docTableHeader}>
              <Text style={[styles.docTableHeaderCell, { flex: 3 }]}>Document</Text>
            </View>

            {/* Table Rows — document types */}
            {filteredDocTypes.length === 0 ? (
              <View style={styles.docTableEmptyRow}>
                <Text style={styles.emptyText}>No documents found.</Text>
              </View>
            ) : (
              filteredDocTypes.map((item, idx) => (
                <View
                  key={item.document_type}
                  style={[
                    styles.docTableRow,
                    idx % 2 === 0 && styles.docTableRowAlt,
                  ]}
                >
                  {/* Document column: folder icon + name */}
                  <TouchableOpacity
                    style={[styles.docTableCell, { flex: 3, flexDirection: 'row',  justifyContent: 'flex-start', gap: 8 }]}
                    onPress={() => goToDocTypes(item.document_type)}
                    activeOpacity={0.75}
                  >
                    <View style={{ width: 28, height: 23 }}>
                      <View style={{
                        position: 'absolute', top: 0, left: 0,
                        width: 11, height: 4,
                        backgroundColor: '#0F68D0',
                        borderTopLeftRadius: 2, borderTopRightRadius: 4,
                      }} />
                      <View style={{
                        position: 'absolute', top: 3, left: 0,
                        width: 28, height: 20,
                        backgroundColor: '#1A8CFF',
                        borderRadius: 3,
                      }}>
                        <View style={{
                          position: 'absolute', top: 3, left: 4, right: 4, height: 4,
                          backgroundColor: 'rgba(255,255,255,0.22)', borderRadius: 2,
                        }} />
                      </View>
                    </View>
                    <Text style={styles.docTableCellText} numberOfLines={2}>
                      {item.document_type}
                    </Text>
                  </TouchableOpacity>

                  

                  
                </View>
              ))
            )}

            {/* Empty filler rows */}
            {filteredDocTypes.length > 0 && filteredDocTypes.length < 6 &&
              [...Array(Math.max(0, 4 - filteredDocTypes.length))].map((_, i) => (
                <View key={`empty-${i}`} style={[styles.docTableRow, (filteredDocTypes.length + i) % 2 === 0 && styles.docTableRowAlt]}>
                  <View style={[styles.docTableCell, { flex: 3 }]} />
                  <View style={[styles.docTableCell, { flex: 2 }]} />
                  <View style={[styles.docTableCell, { flex: 1 }]} />
                </View>
              ))
            }
          </View>
        </>
      )}

      {/* ── VIEW: DOCUMENTS BY BARANGAY for a selected document type ── */}
      {view === 'doctypes' && (
        <>
          {/* Back Button */}
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => goToYears(selectedYear)}
            activeOpacity={0.75}
          >
            <Feather name="arrow-left" size={16} color={COLORS.navy} />
            <Text style={styles.backBtnText}>Back</Text>
          </TouchableOpacity>

          {/* Breadcrumb: Folders > 2026 Documents > Annual Budget... */}
          <View style={styles.breadcrumb}>
            <TouchableOpacity onPress={goToFolders}>
              <Text style={styles.breadcrumbLink}>Folders</Text>
            </TouchableOpacity>
            <Text style={styles.breadcrumbSep}> › </Text>
            <TouchableOpacity onPress={() => goToYears(selectedYear)}>
              <Text style={styles.breadcrumbLink}>{selectedYear} Documents</Text>
            </TouchableOpacity>
            <Text style={styles.breadcrumbSep}> › </Text>
            <Text style={styles.breadcrumbCurrent} numberOfLines={1}>{selectedDocType}</Text>
          </View>

          {/* Section title */}
          <View style={styles.tableTopRow}>
            <Text style={[styles.allDocsLabel, { fontSize: 14, color: '#133E75', fontWeight: '800' }]}>{selectedDocType}</Text>
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

          {/* Table */}
          <View style={styles.docTable}>
            {/* Table Header — Barangay | Document | Date Submitted | Action */}
            <View style={styles.docTableHeader}>
              <Text style={[styles.docTableHeaderCell, { flex: 2 }]}>Barangay</Text>
              <Text style={[styles.docTableHeaderCell, { flex: 3 }]}>Document</Text>
              <Text style={[styles.docTableHeaderCell, { flex: 2, textAlign: 'center' }]}>Date Submitted</Text>
              <Text style={[styles.docTableHeaderCell, { flex: 1, textAlign: 'center' }]}>Action</Text>
            </View>

            {filteredDocsForType.length === 0 ? (
              <View style={styles.docTableEmptyRow}>
                <Text style={styles.emptyText}>No documents found.</Text>
              </View>
            ) : (
              filteredDocsForType.map((doc, idx) => (
                <View
                  key={doc.document_id}
                  style={[styles.docTableRow, idx % 2 === 0 && styles.docTableRowAlt]}
                >
                  {/* Barangay */}
                  <View style={[styles.docTableCell, { flex: 2 }]}>
                    <Text style={styles.docTableCellText} numberOfLines={2}>
                      {doc.barangays?.barangay_name || '—'}
                    </Text>
                  </View>

                  {/* Document title */}
                  <View style={[styles.docTableCell, { flex: 3 }]}>
                    <Text style={styles.docTableCellText} numberOfLines={2}>
                      {doc.title}
                    </Text>
                  </View>

                  {/* Date Submitted */}
                  <View style={[styles.docTableCell, { flex: 2, alignItems: 'center' }]}>
                    <Text style={styles.docTableCellSub}>
                      {doc.submitted_at ? new Date(doc.submitted_at).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' }) : '—'}
                    </Text>
                  </View>

                  {/* Actions: download + view */}
                  <View style={[styles.docTableCell, { flex: 1, flexDirection: 'row', justifyContent: 'center', gap: 10 }]}>
                    {doc.file_url ? (
                      <TouchableOpacity
                        style={styles.actionIconBtn}
                        activeOpacity={0.7}
                        onPress={async () => {
                          if (doc.file_url) {
                            try {
                              // Download the file to cache directory
                              const filename = doc.file_url.split('/').pop() || 'document.pdf';
                              const fileUri = FileSystem.cacheDirectory + filename;

                              const downloadResult = await FileSystem.downloadAsync(doc.file_url, fileUri);

                              // Share the downloaded file
                              if (downloadResult.status === 200) {
                                await Sharing.shareAsync(downloadResult.uri, {
                                  mimeType: 'application/pdf',
                                  dialogTitle: 'Save Document',
                                  UTI: 'com.adobe.pdf'
                                });
                              }
                            } catch (err) {
                              console.error('Error downloading file:', err);
                              // Fallback to opening URL if download fails
                              Linking.openURL(doc.file_url).catch(e =>
                                console.error('Error opening URL:', e)
                              );
                            }
                          }
                        }}
                      >
                        {/* Download icon */}
                        <Feather name="download" size={isMobile ? 13 : 15} color={COLORS.navy} />
                      </TouchableOpacity>
                    ) : null}
                    {doc.file_url && (
                      <TouchableOpacity
                        style={styles.actionIconBtn}
                        activeOpacity={0.7}
                        onPress={() => handleViewPress(doc)}
                      >
                        {/* Eye icon */}
                        <Feather name="eye" size={isMobile ? 13 : 15} color="#00796B" />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              ))
            )}

            {/* Empty filler rows */}
            {filteredDocsForType.length > 0 && filteredDocsForType.length < 5 &&
              [...Array(Math.max(0, 4 - filteredDocsForType.length))].map((_, i) => (
                <View key={`empty-${i}`} style={[styles.docTableRow, (filteredDocsForType.length + i) % 2 === 0 && styles.docTableRowAlt]}>
                  <View style={[styles.docTableCell, { flex: 2 }]} />
                  <View style={[styles.docTableCell, { flex: 3 }]} />
                  <View style={[styles.docTableCell, { flex: 2 }]} />
                  <View style={[styles.docTableCell, { flex: 1 }]} />
                </View>
              ))
            }
          </View>
        </>
      )}
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

        <Sidebar
          activeTab={activeTab}
          onNavPress={handleNavPress}
          onLogout={handleLogout}
          isMobile={isMobile}
          sidebarVisible={sidebarVisible}
          navItems={LYDO_NAV_ITEMS}
          logoSource={require('./../../assets/images/lydo-logo.png')}
        />

        {renderContent()}

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
                  onPress={async () => {
                    if (viewerModal.fileUrl) {
                      try {
                        const filename = viewerModal.fileUrl.split('/').pop() || 'document.pdf';
                        const fileUri = FileSystem.cacheDirectory + filename;
                        const downloadResult = await FileSystem.downloadAsync(viewerModal.fileUrl, fileUri);
                        if (downloadResult.status === 200) {
                          await Sharing.shareAsync(downloadResult.uri, {
                            mimeType: 'application/pdf',
                            dialogTitle: 'Save Document',
                            UTI: 'com.adobe.pdf'
                          });
                        }
                      } catch (err) {
                        console.error('Error downloading file:', err);
                        Linking.openURL(viewerModal.fileUrl).catch(e =>
                          console.error('Error opening URL:', e)
                        );
                      }
                    }
                    setViewerModal({ visible: false, fileUrl: null, title: '' });
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
      </View>
    </SafeAreaView>
  );
}

// ─── STYLES ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: '#133E75' },
  layout: { flex: 1, flexDirection: 'row' },

  // ── Sidebar ──
  sidebarOverlay: {
    position: 'absolute',
    left: 0, top: 0, bottom: 0, right: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    zIndex: 5,
  },

  // ── Main ──
  main: { flex: 1, backgroundColor: COLORS.offWhite, borderTopLeftRadius: 20 },
  mainMobile: { borderTopLeftRadius: 0 },
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
  menuLine: { width: 20, height: 2, backgroundColor: '#133E75', borderRadius: 1 },
  mobileTitle: { fontSize: 18, fontWeight: '800', color: COLORS.darkText },

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
  bellWrapper: { width: 20, height: 22, alignItems: 'center' },
  bellBody: {
    width: 14, height: 12, borderRadius: 7,
    borderWidth: 2, borderColor: COLORS.maroon, marginTop: 4,
  },
  bellBottom: {
    width: 8, height: 4,
    borderBottomLeftRadius: 4, borderBottomRightRadius: 4,
    backgroundColor: '#8B0000', marginTop: -1,
  },
  bellDot: {
    position: 'absolute', top: 0, right: 1,
    width: 7, height: 7, borderRadius: 4,
    backgroundColor: COLORS.gold, borderWidth: 1.5, borderColor: COLORS.cardBg,
  },
  notifBadge: {
    position: 'absolute', top: -2, right: -2,
    width: 16, height: 16, borderRadius: 8,
    backgroundColor: COLORS.gold, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: COLORS.white,
  },
  notifBadgeText: { fontSize: 8, fontWeight: '900', color: '#133E75' },

  // Section Title
  sectionTitle: {
    fontSize: 22, fontWeight: '800', color: COLORS.darkText,
    marginBottom: 6, letterSpacing: 0.3,
  },

  // Document Tab Bar
  documentTabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightGray,
    marginBottom: 14,
    overflowX: 'hidden',
    overflow:'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.30,
    shadowRadius: 3,
    elevation: 6,
  },
  documentTab: {
    flex: 1,
    paddingHorizontal: isMobile ? 8 : 40,
    backgroundColor: COLORS.navy,
    paddingVertical: 10,
    borderBottomWidth: 0,
    borderBottomColor: 'transparent',
    marginBottom: -1,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
  },
  documentTabActive: {
    backgroundColor: COLORS.gold,
    borderRadius: 4,
    borderBottomColor: COLORS.gold,
    borderColor: COLORS.gold,
    shadowColor: COLORS.gold,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
    elevation: 3,
  },
  documentTabText: {
    fontSize: isMobile ? 10 : 13,
    fontWeight: '600',
    color: COLORS.white,
  },
  documentTabTextActive: {
    color: COLORS.darkText,
    fontWeight: '800',
  },
  barangaySubtitle: {
    fontSize: 14, fontWeight: '700', color: COLORS.darkText, marginBottom: 8,
  },

  // Search
  searchRow: { marginBottom: 14 },
  searchBox: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.white, borderRadius: 20,
    borderWidth: 1, borderColor: COLORS.lightGray,
    paddingHorizontal: 12, paddingVertical: 8,
    width: isMobile ? '100%' : 240,
  },
  searchInput: { flex: 1, fontSize: 13, color: COLORS.darkText },

  allDocsLabel: {
    fontSize: 13, fontWeight: '700', color: COLORS.darkText,
    marginBottom: 12,
  },

  // Folder Container Box
  folderContainer: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.lightGray,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },

  // Breadcrumb
  breadcrumb: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: 20, borderWidth: 1, borderColor: COLORS.lightGray,
    paddingHorizontal: 14, paddingVertical: 7,
    alignSelf: 'flex-start',
  },
  breadcrumbLink: { fontSize: 12, color: '#133E75', fontWeight: '600' },
  breadcrumbSep:  { fontSize: 12, color: COLORS.midGray, marginHorizontal: 2 },
  breadcrumbCurrent: { fontSize: 12, color: COLORS.darkText, fontWeight: '700' },

  // ── Folder grids ──
  folderGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 4,
  },
  folderGridMobile: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 12,
  },
  folderCard: {
    width: isMobile ? '28%' : 110,
    alignItems: 'center', paddingVertical: 10, paddingHorizontal: 6,
    borderRadius: 10, marginBottom: 4,
  },
  folderName: {
    marginTop: 6, fontSize: 11, fontWeight: '500',
    color: COLORS.darkText, textAlign: 'center', lineHeight: 14,
  },

  // ── Document category card grid ──
  gridInner: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, paddingBottom: 24 },
  gridMobile: { flexDirection: 'column', gap: 12, paddingBottom: 24 },
  cardWrapper: { width: '47%', minWidth: 150 },
  cardWrapperMobile: { width: '100%' },

  // Card
  card: {
    borderRadius: 16, overflow: 'hidden', elevation: 3,
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1, shadowRadius: 8,
  },
  cardHeader: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 12, gap: 8,
  },
  cardHeaderIcon: { fontSize: isMobile ? 16 : 18 },
  cardHeaderTitle: {
    fontSize: isMobile ? 8 : 10, fontWeight: '900', color: COLORS.white,
    letterSpacing: 0.8, flex: 1, flexWrap: 'wrap',
  },
  cardBody: { padding: isMobile ? 10 : 14 },
  docItem: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 6 },
  docBullet: { width: 5, height: 5, borderRadius: 3, marginTop: 5, flexShrink: 0 },
  docItemText: { fontSize: isMobile ? 11 : 12, lineHeight: 18, flex: 1 },

  emptyState: { flex: 1, alignItems: 'center', marginTop: 60 },
  emptyText: { fontSize: 14, color: COLORS.midGray },

  // ── Add Folder Button ──
  addFolderBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: COLORS.navy,
    paddingVertical: 8, paddingHorizontal: 14,
    borderRadius: 20,
    shadowColor: COLORS.navy,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3, shadowRadius: 6, elevation: 4,
  },
  addFolderBtnIconWrap: {
    width: 22, height: 18,
    justifyContent: 'flex-end',
  },
  addFolderBtnFolderTab: {
    position: 'absolute', top: 0, left: 0,
    width: 9, height: 5,
    backgroundColor: 'rgba(255,255,255,0.5)',
    borderTopLeftRadius: 2, borderTopRightRadius: 3,
  },
  addFolderBtnFolderBody: {
    position: 'absolute', top: 3, left: 0,
    width: 22, height: 15,
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderRadius: 3, borderTopRightRadius: 3, borderTopLeftRadius: 1,
    alignItems: 'center', justifyContent: 'center',
  },
  addFolderBtnPlus: {
    fontSize: 12, fontWeight: '900', color: COLORS.white, lineHeight: 14,
  },
  addFolderBtnText: { fontSize: 13, fontWeight: '700', color: COLORS.white, letterSpacing: 0.2 },

  // ── Add Folder Modal ──
  addFolderOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  addFolderModalWrap: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center', alignItems: 'center',
  },
  addFolderModal: {
    width: isMobile ? '88%' : 400,
    backgroundColor: COLORS.white,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18, shadowRadius: 24, elevation: 12,
  },
  addFolderModalHeader: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 16,
  },
  addFolderModalHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  addFolderModalIconWrap: {
    width: 38, height: 38, borderRadius: 10,
    backgroundColor: '#EFF6FF',
    alignItems: 'center', justifyContent: 'center',
  },
  addFolderModalTitle: { fontSize: 16, fontWeight: '800', color: COLORS.darkText },
  addFolderCloseBtn: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: COLORS.lightGray,
    alignItems: 'center', justifyContent: 'center',
  },
  addFolderCloseBtnText: { fontSize: 13, color: COLORS.subText, fontWeight: '700' },
  addFolderModalDivider: { height: 1, backgroundColor: COLORS.lightGray },
  addFolderModalBody: { paddingHorizontal: 20, paddingVertical: 20, gap: 6 },
  addFolderModalLabel: { fontSize: 13, fontWeight: '700', color: COLORS.darkText, marginBottom: 4 },
  addFolderInput: {
    borderWidth: 1.5, borderColor: COLORS.lightGray,
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 11,
    fontSize: 15, fontWeight: '700', color: COLORS.darkText,
    backgroundColor: COLORS.offWhite,
    letterSpacing: 2,
  },
  addFolderInputError: { borderColor: '#EF4444' },
  addFolderErrorText: { fontSize: 12, color: '#EF4444', fontWeight: '500', marginTop: 4 },
  addFolderHint: { fontSize: 12, color: COLORS.subText, marginTop: 4, lineHeight: 17 },
  addFolderModalFooter: {
    flexDirection: 'row', gap: 10,
    paddingHorizontal: 20, paddingBottom: 20, paddingTop: 4,
  },
  addFolderCancelBtn: {
    flex: 1, paddingVertical: 12, borderRadius: 10,
    borderWidth: 1.5, borderColor: COLORS.lightGray,
    alignItems: 'center',
  },
  addFolderCancelText: { fontSize: 14, fontWeight: '700', color: COLORS.subText },
  addFolderConfirmBtn: {
    flex: 2, paddingVertical: 12, borderRadius: 10,
    backgroundColor: COLORS.navy, alignItems: 'center',
  },
  addFolderConfirmBtnDisabled: { backgroundColor: COLORS.midGray },
  addFolderConfirmText: { fontSize: 14, fontWeight: '700', color: COLORS.white },

  // Category chips
  categoryChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: COLORS.lightGray,
    backgroundColor: COLORS.white,
  },
  categoryChipActive: {
    backgroundColor: COLORS.navy,
    borderColor: COLORS.navy,
  },
  categoryChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.subText,
  },
  categoryChipTextActive: {
    color: COLORS.white,
  },

  // ── Barangay-by-year table ──
  tableTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 14,
    marginBottom: 10,
  },
  docTable: {
    borderWidth: 1,
    borderColor: COLORS.lightGray,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: COLORS.white,
  },
  docTableHeader: {
    flexDirection: 'row',
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightGray,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  docTableHeaderCell: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1A8CFF',
    letterSpacing: 0.2,
  },
  docTableRow: {
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightGray,
    minHeight: 48,
    alignItems: 'center',
  },
  docTableRowAlt: {
    backgroundColor: COLORS.offWhite,
  },
  docTableEmptyRow: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  docTableCell: {
    justifyContent: 'center',
  },
  docTableCellText: {
    fontSize: 13,
    color: COLORS.darkText,
    fontWeight: '500',
  },
  docTableCellSub: {
    fontSize: 13,
    color: COLORS.midGray,
  },
  actionIconBtn: {
    padding: 4,
  },

  // ── Back Button ──
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: COLORS.white,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.lightGray,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 1,
  },
  backBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.navy,
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