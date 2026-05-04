import React, { useState, useEffect } from 'react';
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
  Alert,
  Image,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useNav } from './navContext';
import { useAuth } from './authContext';

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
    header:     '#5B8DD9',
    headerDark: '#3A6BBB',
    bg:         '#EAF0FB',
    text:       '#FFFFFF',
    subText:    '#2A4E8A',
  },
  financial: {
    header:     '#3AAA5C',
    headerDark: '#228844',
    bg:         '#E8F7EE',
    text:       '#FFFFFF',
    subText:    '#1A6B38',
  },
  governance: {
    header:     '#8B5BD9',
    headerDark: '#6A3BB5',
    bg:         '#F0EAFB',
    text:       '#FFFFFF',
    subText:    '#5A2EA0',
  },
  performance: {
    header:     '#E87A30',
    headerDark: '#C05A10',
    bg:         '#FDF0E6',
    text:       '#FFFFFF',
    subText:    '#A04010',
  },
};

// ─── CATEGORY META ────────────────────────────────────────────────────────────
const CATEGORY_META = {
  All:        { color: COLORS.navy,                  label: 'All Documents' },

  Planning:   { color: COLORS.planning.header,       label: 'Planning Documents' },
  Financial:  { color: COLORS.financial.header,      label: 'Financial Documents' },
  Governance: { color: COLORS.governance.header,     label: 'Governance Documents' },
  Activities: { color: COLORS.performance.header,    label: 'Performance Documents' },
};

// ─── DOCUMENT GROUPS (cards) ──────────────────────────────────────────────────
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

// ─── ALL DOCUMENTS (shown in list view) ───────────────────────────────────────
const ALL_DOCUMENTS = [
  // Planning
  { id: 'p1',  name: 'Comprehensive Barangay Youth Development Plan 2026', category: 'Planning',    subType: 'LYDP',              date: '1/07/2026',  status: 'Authorized', hasFile: true },
  { id: 'p2',  name: 'Comprehensive Barangay Youth Development Plan 2025', category: 'Planning',    subType: 'LYDP',              date: '1/05/2025',  status: null,         hasFile: true },
  { id: 'p3',  name: 'Annual Investment Plan 2026',                        category: 'Planning',    subType: 'Work Plans',        date: '12/10/2025', status: 'Authorized', hasFile: true },
  { id: 'p4',  name: 'SK Work Plan Q1 2026',                               category: 'Planning',    subType: 'Work Plans',        date: '1/02/2026',  status: null,         hasFile: true },
  { id: 'p5',  name: 'Youth Center Proposal 2026',                         category: 'Planning',    subType: 'Project Proposals', date: '2/01/2026',  status: null,         hasFile: false },
  // Financial
  { id: 'f1',  name: 'Financial Report Summary Q4 2025',                   category: 'Financial',   subType: 'Financial Report Summary',  date: '1/10/2026',  status: 'Authorized', hasFile: true },
  { id: 'f2',  name: 'Financial Report Summary Q3 2025',                   category: 'Financial',   subType: 'Financial Report Summary',  date: '10/05/2025', status: null,         hasFile: true },
  { id: 'f3',  name: 'Monthly Itemized List — January 2026',               category: 'Financial',   subType: 'Register of Cash Receipts', date: '1/31/2026',  status: 'Authorized', hasFile: true },
  { id: 'f4',  name: 'Quarterly Register of Bank Q4 2025',                 category: 'Financial',   subType: 'Register of Cash Receipts', date: '1/10/2026',  status: null,         hasFile: true },
  { id: 'f5',  name: 'Disbursement Voucher #047',                          category: 'Financial',   subType: 'Disbursement Vouchers',     date: '1/15/2026',  status: null,         hasFile: true },
  { id: 'f6',  name: 'Disbursement Voucher #046',                          category: 'Financial',   subType: 'Disbursement Vouchers',     date: '1/10/2026',  status: 'Authorized', hasFile: true },
  { id: 'f7',  name: 'Liquidation Report Jan 2026',                        category: 'Financial',   subType: 'Liquidation Reports',       date: '1/28/2026',  status: null,         hasFile: true },
  // Governance
  { id: 'g1',  name: 'Resolution No. 2026-01',                             category: 'Governance',  subType: 'Resolutions', date: '1/03/2026',  status: 'Authorized', hasFile: true },
  { id: 'g2',  name: 'Resolution No. 2025-10',                             category: 'Governance',  subType: 'Resolutions', date: '10/20/2025', status: null,         hasFile: true },
  { id: 'g3',  name: 'Ordinance No. 2025-12',                              category: 'Governance',  subType: 'Ordinances',  date: '12/15/2025', status: 'Authorized', hasFile: true },
  { id: 'g4',  name: 'Ordinance No. 2025-08',                              category: 'Governance',  subType: 'Ordinances',  date: '8/05/2025',  status: null,         hasFile: true },
  // Activities
  { id: 'a1',  name: 'Q4 2025 Accomplishment Report',                      category: 'Performance',  subType: 'Accomplishment Reports',   date: '1/08/2026',  status: 'Authorized', hasFile: true },
  { id: 'a2',  name: 'Q3 2025 Accomplishment Report',                      category: 'Performance',  subType: 'Accomplishment Reports',   date: '10/10/2025', status: null,         hasFile: true },
  { id: 'a3',  name: 'Youth Leadership Summit Documentation',               category: 'Performance',  subType: 'Activity Documentation',   date: '12/22/2025', status: null,         hasFile: true },
  { id: 'a4',  name: 'Barangay Clean-Up Event Report',                     category: 'Performance',  subType: 'Event Reports',            date: '12/05/2025', status: null,         hasFile: false },
  { id: 'a5',  name: 'Minutes — General Assembly Dec 2025',                category: 'Performance',  subType: 'Minutes of the meetings',  date: '12/18/2025', status: 'Authorized', hasFile: true },
  { id: 'a6',  name: 'Minutes — Special Session Jan 2026',                 category: 'Performance',  subType: 'Minutes of the meetings',  date: '1/14/2026',  status: null,         hasFile: true },
];

const CATEGORIES = ['All', 'Planning', 'Financial', 'Governance', 'Performance'];
const SORT_OPTIONS = ['Newest', 'Oldest', 'A–Z'];
const DOCUMENT_TABS = ['Barangay Document', 'Reports', 'Templates'];

const NAV_TABS = ['Home', 'Documents', 'Monitor'];

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
    {[0,1,2].map(i => <View key={i} style={styles.menuLine} />)}
  </View>
);
const SearchIcon = () => (
  <View style={styles.searchIconWrap}>
    <View style={styles.searchCircle} />
    <View style={styles.searchHandle} />
  </View>
);

// ─── DROPDOWN MENU ────────────────────────────────────────────────────────────
const DropdownMenu = ({ visible, options, onSelect, onClose, accentColor }) => {
  if (!visible) return null;
  return (
    <View style={styles.dropdownOverlay}>
      <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onClose} activeOpacity={1} />
      <View style={[styles.dropdownMenu, { borderTopColor: accentColor }]}>
        {options.map((opt, idx) => (
          <TouchableOpacity
            key={idx}
            style={[styles.dropdownItem, idx < options.length - 1 && { borderBottomWidth: 1, borderBottomColor: COLORS.lightGray }]}
            onPress={() => { onSelect(opt); onClose(); }}
          >
            <Text style={styles.dropdownItemText}>{opt}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
};

// ─── DOCUMENT CARD (card grid view) ──────────────────────────────────────────
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
            onPress={() => onItemPress(item, group)}
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

// ─── DOCUMENT ROW (list view — same as sk-document-list) ─────────────────────
const DocumentRow = ({ doc, accentColor, onMenu, isAlt }) => (
  <View style={[styles.docRow, isAlt && styles.rowAlt]}>
    <View style={styles.docNameCell}>
      <Text style={[styles.docName, isMobile && styles.docNameMobile]} numberOfLines={2}>
        {doc.name}
      </Text>
      {doc.status === 'Authorized' && (
        <View style={[styles.statusBadge, { backgroundColor: accentColor + '20', borderColor: accentColor + '60' }]}>
          <Text style={[styles.statusText, { color: accentColor }]}>Authorized</Text>
        </View>
      )}
      {doc.hasFile && !doc.status && (
        <View style={styles.fileIconWrap}>
          <Text style={{ fontSize: 13, color: COLORS.midGray }}>⬇</Text>
        </View>
      )}
    </View>
    {!isMobile && <Text style={styles.docDate}>{doc.date}</Text>}
    <TouchableOpacity onPress={() => onMenu(doc)} style={styles.menuDotBtn}>
      <Text style={styles.menuDots}>⋮</Text>
    </TouchableOpacity>
  </View>
);

// ─── MAIN SCREEN ──────────────────────────────────────────────────────────────
export default function LYDODocumentListScreen({ navigation }) {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { activeTab, setActiveTab } = useNav();
  const { logout } = useAuth();

  // ── view state ──
  // 'cards'  → shows the 4 document group cards
  // 'list'   → shows document list after tapping a card item
  const [view, setView]                         = useState('list');
  const [selectedGroup, setSelectedGroup]       = useState(null);   // which card was tapped
  const [selectedSubType, setSelectedSubType]   = useState(null);   // which bullet item

  // list-view state
  const [activeCategory, setActiveCategory]     = useState('All');
  const [sortBy, setSortBy]                     = useState('Newest');
  const [searchText, setSearchText]             = useState('');
  const [notifCount]                            = useState(2);
  const [sidebarVisible, setSidebarVisible]     = useState(false);
  const [dropdownVisible, setDropdownVisible]   = useState(false);
  const [dropdownOptions, setDropdownOptions]   = useState([]);
  const [dropdownAccent, setDropdownAccent]     = useState(COLORS.navy);
  const [activeDocumentTab, setActiveDocumentTab] = useState('Barangay Document');

  // Set initial view based on route params from lydo-document
  useEffect(() => {
    setActiveTab('Documents');
  }, []);

  useEffect(() => {
    if (params.category) {
      setActiveCategory(params.category);
      setSelectedSubType(params.subType || null);
      setView('list');
      // Find and set the selectedGroup for proper accent color
      const group = DOCUMENT_GROUPS.find(g => g.category === params.category);
      if (group) {
        setSelectedGroup(group);
      }
    }
  }, [params.category, params.subType]);

  const handleNavPress = (tab) => {
    setActiveTab(tab);
    setSidebarVisible(false);
    if (tab === 'Home')      router.push('/(tabs)/lydo-home');
    if (tab === 'Documents') router.push('/(tabs)/lydo-document');
    if (tab === 'Monitor')   router.push('/(tabs)/lydo-monitor');
  };

  const goBackToFolders = () => {
    router.replace('/(tabs)/lydo-document');
  };

  const handleLogout = () => {
    logout();
    router.replace('/');
  };

  const handleDocumentTabPress = (tab) => {
    if (tab === 'Barangay Documents') { router.push('/(tabs)/lydo-monitor'); return; }
    if (tab === 'Templates') { router.push('/(tabs)/lydo-document-templates'); return; }
    if (tab === 'Reports') { router.push('/(tabs)/lydo-document-reports'); return; }
    setActiveDocumentTab(tab);
  };

  // ── Tap a bullet item on a card → switch to list view filtered by subType ──
  const handleItemPress = (itemName, group) => {
    setSelectedGroup(group);
    setSelectedSubType(itemName);
    setActiveCategory(group.category);
    setSearchText('');
    setSortBy('Newest');
    setView('list');
  };

  // ── Back to cards ──
  const goBackToCards = () => {
    setView('cards');
    setSelectedGroup(null);
    setSelectedSubType(null);
  };

  // ── Filter + sort documents ──
  const getFilteredDocs = () => {
    let docs = ALL_DOCUMENTS;

    // Filter by category
    if (activeCategory !== 'All') {
      docs = docs.filter(d => d.category === activeCategory);
    }
    // Filter by subType if a bullet item was selected
    if (selectedSubType) {
      docs = docs.filter(d => d.subType === selectedSubType);
    }
    // Search
    if (searchText.trim()) {
      const q = searchText.toLowerCase();
      docs = docs.filter(d => d.name.toLowerCase().includes(q) || d.subType.toLowerCase().includes(q));
    }
    // Sort
    if (sortBy === 'Newest') {
      docs = [...docs].sort((a, b) => new Date(b.date) - new Date(a.date));
    } else if (sortBy === 'Oldest') {
      docs = [...docs].sort((a, b) => new Date(a.date) - new Date(b.date));
    } else if (sortBy === 'A–Z') {
      docs = [...docs].sort((a, b) => a.name.localeCompare(b.name));
    }
    return docs;
  };

  const filteredDocs = getFilteredDocs();
  const meta         = CATEGORY_META[activeCategory] ?? CATEGORY_META['All'];
  const accentColor  = selectedGroup ? selectedGroup.colors.header : meta.color;

  // ── Row menu ──
  const handleRowMenu = (doc) => {
    Alert.alert(doc.name, 'Choose an action:', [
      { text: 'View',   onPress: () => {} },
      { text: 'Upload', onPress: () => {} },
      { text: 'Delete', style: 'destructive', onPress: () => {} },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  // ── Upload menu ──
  const handleUpload = () => {
    setDropdownOptions(['Upload File', 'Take Photo', 'Choose from Library']);
    setDropdownAccent(accentColor);
    setDropdownVisible(true);
  };

  // ─── Sidebar ──────────────────────────────────────────────────────────────────
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
        onPress={handleLogout}
        activeOpacity={0.8}
      >
        <Text style={styles.logoutText}>Logout</Text>
      </TouchableOpacity>
    </View>
  );

  // ─── CARDS VIEW ───────────────────────────────────────────────────────────────
  const renderCardsView = () => (
    <ScrollView
      style={[styles.main, isMobile && styles.mainMobile]}
      contentContainerStyle={styles.mainContent}
      showsVerticalScrollIndicator={false}
    >
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
      {!isMobile && (
        <View style={styles.header}>
          <View>
            <Text style={styles.headerSub}>SANGGUNIANG KABATAAN FEDERATION</Text>
            <Text style={styles.headerTitle}>RIZAL, LAGUNA</Text>
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

      <View style={isMobile ? styles.gridMobile : styles.gridInner}>
        {DOCUMENT_GROUPS.map(group => (
          <View key={group.id} style={isMobile ? styles.cardWrapperMobile : styles.cardWrapper}>
            <DocumentCard group={group} onItemPress={handleItemPress} />
          </View>
        ))}
      </View>
    </ScrollView>
  );

  // ─── LIST VIEW ────────────────────────────────────────────────────────────────
  const renderListView = () => (
    <ScrollView
      style={[styles.main, isMobile && styles.mainMobile]}
      contentContainerStyle={styles.mainContent}
      showsVerticalScrollIndicator={false}
    >
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
      {!isMobile && (
        <View style={styles.header}>
          <View>
            <Text style={styles.headerSub}>SANGGUNIANG KABATAAN FEDERATION</Text>
            <Text style={styles.headerTitle}>RIZAL, LAGUNA</Text>
          </View>
          <View style={styles.headerRight}>
            {/* Upload button */}
            <TouchableOpacity
              style={[styles.uploadBtn, { backgroundColor: accentColor }]}
              onPress={handleUpload}
              activeOpacity={0.85}
            >
              <Text style={styles.uploadBtnText}>+ Upload</Text>
            </TouchableOpacity>
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

      {/* ── Back breadcrumb ── */}
      <View style={styles.breadcrumbRow}>
        <TouchableOpacity onPress={goBackToFolders} style={styles.backBtn}>
          <Text style={styles.backBtnText}>← All Documents</Text>
        </TouchableOpacity>
        {selectedGroup && (
          <>
            <Text style={styles.breadSep}>›</Text>
            <Text style={[styles.breadCrumbActive, { color: selectedGroup.colors.header }]}>
              {selectedSubType ?? selectedGroup.title}
            </Text>
          </>
        )}
      </View>

      {/* ── Section heading with colored top border ── */}
      <View style={[styles.listHeading, { borderTopColor: accentColor }]}>
        <Text style={styles.listHeadingIcon}>{selectedGroup?.icon ?? '📁'}</Text>
        <View style={{ flex: 1 }}>
          <Text style={[styles.listHeadingTitle, { color: accentColor }]}>
            {selectedSubType ?? selectedGroup?.title ?? 'All Documents'}
          </Text>
          <Text style={styles.listHeadingCount}>{filteredDocs.length} document{filteredDocs.length !== 1 ? 's' : ''}</Text>
        </View>
        {/* Mobile upload button */}
        {isMobile && (
          <TouchableOpacity
            style={[styles.uploadBtnMini, { backgroundColor: accentColor }]}
            onPress={handleUpload}
            activeOpacity={0.85}
          >
            <Text style={styles.uploadBtnText}>+ Upload</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* ── Search bar ── */}
      <View style={[styles.searchBar, { borderColor: accentColor + '44' }]}>
        <SearchIcon />
        <TextInput
          style={styles.searchInput}
          placeholder={`Search ${selectedSubType ?? 'documents'}…`}
          placeholderTextColor={COLORS.midGray}
          value={searchText}
          onChangeText={setSearchText}
        />
        {searchText.length > 0 && (
          <TouchableOpacity onPress={() => setSearchText('')}>
            <Text style={{ color: COLORS.midGray, fontSize: 14 }}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* ── Category filter chips ── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.categoryRow}
      >
        {CATEGORIES.map(cat => {
          const isActive = activeCategory === cat;
          return (
            <TouchableOpacity
              key={cat}
              style={[
                styles.catBtn,
                isActive
                  ? [styles.catBtnActive, { backgroundColor: accentColor, borderColor: accentColor }]
                  : [styles.catBtnInactive, { borderColor: accentColor + '40' }],
              ]}
              onPress={() => { setActiveCategory(cat); setSelectedSubType(null); }}
              activeOpacity={0.8}
            >
              <Text style={[styles.catBtnText, isActive ? styles.catBtnTextActive : { color: accentColor }]}>
                {cat}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* ── Document table card ── */}
      <View style={[styles.tableCard, { borderTopColor: accentColor }]}>
        {/* Sort row */}
        <View style={styles.sortRow}>
          <Text style={styles.sortLabel}>Sort:</Text>
          {SORT_OPTIONS.map(opt => (
            <TouchableOpacity key={opt} onPress={() => setSortBy(opt)}>
              <Text style={[styles.sortBtn, sortBy === opt && { color: accentColor, fontWeight: '800' }]}>
                {opt}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Table head */}
        <View style={[styles.tableHead, { backgroundColor: accentColor + '12' }]}>
          <Text style={[styles.tableHeadDoc, { color: accentColor }]}>Document Name</Text>
          {!isMobile && <Text style={[styles.tableHeadDate, { color: accentColor }]}>Date</Text>}
          <View style={{ width: 28 }} />
        </View>

        {/* Rows */}
        {filteredDocs.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No documents found.</Text>
          </View>
        ) : (
          filteredDocs.map((doc, idx) => (
            <DocumentRow
              key={doc.id}
              doc={doc}
              accentColor={accentColor}
              onMenu={handleRowMenu}
              isAlt={idx % 2 === 1}
            />
          ))
        )}
      </View>
    </ScrollView>
  );

  // ─── RENDER ───────────────────────────────────────────────────────────────────
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

        {/* View toggle */}
        {view === 'cards' ? renderCardsView() : renderListView()}
      </View>

      {/* Dropdown */}
      <DropdownMenu
        visible={dropdownVisible}
        options={dropdownOptions}
        accentColor={dropdownAccent}
        onSelect={(opt) => Alert.alert('Selected', opt)}
        onClose={() => setDropdownVisible(false)}
      />
    </SafeAreaView>
  );
}

// ─── STYLES ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: COLORS.navy },
  layout: { flex: 1, flexDirection: 'row' },
  sidebar: {
    width: 250, backgroundColor: COLORS.navy,
    alignItems: 'center', paddingTop: 20, paddingBottom: 24, paddingHorizontal: 10, zIndex: 10,
  },
  sidebarOverlay: {
    position: 'absolute',
    left: 0, top: 0, bottom: 0, right: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    zIndex: 5,
  },
  logoPill: { width: 70, height: 70, borderRadius: 35, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center', marginBottom: 8, borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)' },
  logoImage: {
    width: 73,
    height: 73,
  },
  navItem: { width: '100%', paddingVertical: 12, paddingHorizontal: 12, borderRadius: 24, marginBottom: 8, alignItems: 'center', borderWidth: 1.5, borderColor: COLORS.white, backgroundColor: COLORS.navy },
  navItemActive: { backgroundColor: '#ffffff', borderColor: '#000000' },
  navLabel: { fontSize: 13, fontWeight: '600', color: '#ffffff', letterSpacing: 0.3 },
  navLabelActive: { color: '#000000', fontWeight: '800' },
  logoutBtn: {
    width: '100%',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 24,
    marginTop: 8,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: COLORS.white,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  logoutText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#ffffff',
    letterSpacing: 0.3,
  },

  
  // Main
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
  menuLine: { width: 20, height: 2, backgroundColor: COLORS.navy, borderRadius: 1 },
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
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },

  // Bell
  bellBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: COLORS.cardBg, alignItems: 'center', justifyContent: 'center',
    shadowColor: COLORS.shadow, shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1, shadowRadius: 6, elevation: 3,
  },
  bellWrapper: { width: 20, height: 22, alignItems: 'center' },
  bellBody: { width: 14, height: 12, borderRadius: 7, borderWidth: 2, borderColor: COLORS.maroon, marginTop: 4 },
  bellBottom: { width: 8, height: 4, borderBottomLeftRadius: 4, borderBottomRightRadius: 4, backgroundColor: '#8B0000', marginTop: -1 },
  bellDot: { position: 'absolute', top: 0, right: 1, width: 7, height: 7, borderRadius: 4, backgroundColor: COLORS.gold, borderWidth: 1.5, borderColor: COLORS.cardBg },
  notifBadge: { position: 'absolute', top: -2, right: -2, width: 16, height: 16, borderRadius: 8, backgroundColor: COLORS.gold, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: COLORS.white },
  notifBadgeText: { fontSize: 8, fontWeight: '900', color: COLORS.navy },

  // ── Cards view ──
  sectionTitle: { fontSize: 22, fontWeight: '800', color: COLORS.darkText, marginBottom: 18, letterSpacing: 0.3 },

  // Document Tab Bar
  documentTabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightGray,
    marginBottom: 14,
    overflowX: 'hidden',
    overflow: 'hidden',
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
  gridInner: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, paddingBottom: 24 },
  gridMobile: { flexDirection: 'column', gap: 14, paddingBottom: 24 },
  cardWrapper: { width: '47%', minWidth: 150 },
  cardWrapperMobile: { width: '100%' },
  card: {
    borderRadius: 16, overflow: 'hidden', elevation: 3,
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.1, shadowRadius: 8,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 12, gap: 8 },
  cardHeaderIcon: { fontSize: 16 },
  cardHeaderTitle: { fontSize: 9, fontWeight: '900', color: COLORS.white, letterSpacing: 0.8, flex: 1, flexWrap: 'wrap' },
  cardBody: { padding: 12 },
  docItem: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 6 },
  docBullet: { width: 5, height: 5, borderRadius: 3, marginTop: 5, flexShrink: 0 },
  docItemText: { fontSize: 11, lineHeight: 16, flex: 1 },

  // ── List view ──
  breadcrumbRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 14,
  },
  backBtn: { paddingVertical: 4, paddingHorizontal: 2 },
  backBtnText: { fontSize: 13, fontWeight: '700', color: COLORS.navy },
  breadSep: { fontSize: 14, color: COLORS.midGray },
  breadCrumbActive: { fontSize: 13, fontWeight: '700' },

  listHeading: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: COLORS.white, borderRadius: 14, padding: 14,
    borderTopWidth: 4, marginBottom: 16,
    elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6,
  },
  listHeadingIcon: { fontSize: 22 },
  listHeadingTitle: { fontSize: 14, fontWeight: '800', letterSpacing: 0.3 },
  listHeadingCount: { fontSize: 11, color: COLORS.subText, marginTop: 2 },

  uploadBtn: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20 },
  uploadBtnMini: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16 },
  uploadBtnText: { fontSize: 12, fontWeight: '700', color: COLORS.white },

  searchBar: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.white, borderRadius: 14,
    paddingHorizontal: 14, paddingVertical: 10, marginBottom: 12,
    borderWidth: 1.5,
    shadowColor: COLORS.shadow, shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1, shadowRadius: 6, elevation: 2,
  },
  searchIconWrap: { width: 18, height: 18, marginRight: 10 },
  searchCircle: { width: 11, height: 11, borderRadius: 6, borderWidth: 2, borderColor: COLORS.midGray, position: 'absolute', top: 0, left: 0 },
  searchHandle: { width: 2, height: 6, backgroundColor: COLORS.midGray, borderRadius: 1, position: 'absolute', bottom: 0, right: 1, transform: [{ rotate: '-45deg' }] },
  searchInput: { flex: 1, fontSize: 14, color: COLORS.darkText, padding: 0 },

  categoryRow: { flexDirection: 'row', gap: 8, marginBottom: 14, paddingBottom: 2 },
  catBtn: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1.5 },
  catBtnActive: {},
  catBtnInactive: { backgroundColor: COLORS.white },
  catBtnText: { fontSize: 12, fontWeight: '700' },
  catBtnTextActive: { color: COLORS.white },

  tableCard: {
    backgroundColor: COLORS.white, borderRadius: 18, marginBottom: 18,
    overflow: 'hidden', borderTopWidth: 3,
    elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 12,
  },
  sortRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 10, gap: 6,
    borderBottomWidth: 1, borderBottomColor: COLORS.lightGray,
    backgroundColor: 'rgba(0,0,0,0.02)',
  },
  sortLabel: { fontSize: 11, color: COLORS.subText, fontWeight: '500', marginRight: 2 },
  sortBtn: { fontSize: 11, fontWeight: '600', color: COLORS.midGray, paddingHorizontal: 4 },

  tableHead: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 9,
    borderBottomWidth: 1.5, borderBottomColor: COLORS.lightGray,
  },
  tableHeadDoc: { flex: 1, fontSize: 11, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase' },
  tableHeadDate: { width: 68, fontSize: 11, fontWeight: '700', textAlign: 'right', letterSpacing: 0.8, textTransform: 'uppercase' },

  docRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: COLORS.lightGray,
  },
  rowAlt: { backgroundColor: '#FAFAF8' },
  docNameCell: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, paddingRight: 6, flexWrap: 'wrap' },
  docName: { fontSize: 12, color: COLORS.darkText, lineHeight: 17, flex: 1 },
  docNameMobile: { fontSize: 11 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, borderWidth: 1 },
  statusText: { fontSize: 10, fontWeight: '700' },
  fileIconWrap: { paddingHorizontal: 4 },
  docDate: { width: 68, fontSize: 11, color: COLORS.subText, textAlign: 'right', fontWeight: '600' },
  menuDotBtn: { width: 24, alignItems: 'center', paddingLeft: 4 },
  menuDots: { fontSize: 18, color: COLORS.midGray, fontWeight: '700' },

  emptyState: { alignItems: 'center', paddingVertical: 40 },
  emptyText: { fontSize: 13, color: COLORS.midGray },

  // Dropdown
  dropdownOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 100 },
  dropdownMenu: {
    position: 'absolute', left: 20, top: 120, right: 20,
    backgroundColor: COLORS.white, borderRadius: 12, borderTopWidth: 4,
    elevation: 5, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 8,
  },
  dropdownItem: { paddingHorizontal: 16, paddingVertical: 13 },
  dropdownItemText: { fontSize: 13, color: COLORS.darkText, fontWeight: '500' },
});