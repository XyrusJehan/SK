import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, ScrollView, TouchableOpacity,
  StyleSheet, SafeAreaView, StatusBar, Dimensions,
  Modal, Alert, Image, Linking,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useNav } from './navContext';
import { useAuth } from './authContext';
import { supabase } from '../../utils/supabase';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const isMobile = SCREEN_WIDTH < 768;

// ─── COLORS (same as lydo-monitor) ───────────────────────────────────────────
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

// ─── NAV & PLANNING TABS ─────────────────────────────────────────────────────
const NAV_TABS      = ['Dashboard', 'Documents', 'Planning', 'Portal', 'Logs', 'Account'];
const PLANNING_TABS = ['Templates', 'Budget'];

// ─── TEMPLATE CATEGORY CONFIG ─────────────────────────────────────────────────
const CATEGORY_CONFIG = {
  planning: { title: 'Planning Templates', color: '#EAF0FB', borderColor: '#B8CAE8' },
  budgeting: { title: 'Budgeting Templates', color: '#EAFBEA', borderColor: '#B8E4B8' },
  financial_records: { title: 'Financial Records and Evaluation Templates', color: '#FDF5E6', borderColor: '#E8D5A8' },
  monitoring_evaluation: { title: 'Monitoring and Evaluation', color: '#F3EAFB', borderColor: '#C8B0E4' },
};

// ─── ALL TEMPLATES — (now fetched from Supabase based on barangay_id) ─────
// (Data fetched via useEffect)

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

// Edit icon (pencil box) — matches screenshot
const EditIcon = () => (
  <View style={styles.editIconBox}>
    <Text style={styles.editIconText}>✎</Text>
  </View>
);

// ─── TEMPLATE ITEM ────────────────────────────────────────────────────────────
const TemplateItem = ({ item, onEdit }) => (
  <TouchableOpacity style={styles.templateItem} onPress={() => onEdit(item)} activeOpacity={0.75}>
    <Text style={styles.templateItemName} numberOfLines={2}>{item.name}</Text>
    <EditIcon />
  </TouchableOpacity>
);

// ─── TEMPLATE SECTION ─────────────────────────────────────────────────────────
const TemplateSection = ({ section, onEdit }) => {
  // Pair items into rows of 2
  const pairs = [];
  for (let i = 0; i < section.items.length; i += 2) {
    pairs.push(section.items.slice(i, i + 2));
  }

  return (
    <View style={styles.section}>
      {/* Section Header */}
      <View style={[styles.sectionHeader, { backgroundColor: section.color, borderLeftColor: section.borderColor }]}>
        <Text style={styles.sectionHeaderText}>{section.title}</Text>
      </View>

      {/* Items grid — 2 per row */}
      <View style={styles.sectionBody}>
        {pairs.map((pair, pIdx) => (
          <View key={pIdx} style={styles.itemRow}>
            {pair.map(item => (
              <View key={item.id} style={styles.itemCol}>
                <TemplateItem item={item} onEdit={onEdit} />
              </View>
            ))}
            {/* If odd item in last row, fill empty col */}
            {pair.length === 1 && <View style={styles.itemCol} />}
          </View>
        ))}
      </View>
    </View>
  );
};



// ─── MAIN SCREEN ──────────────────────────────────────────────────────────────
export default function SKPlanningScreen() {
  const router = useRouter();
  const { activeTab, setActiveTab } = useNav();
  const { logout, user } = useAuth();

  // Get user's barangay from auth context
  const barangayName = user?.barangay?.barangay_name || 'Unknown Barangay';
  const barangayId = user?.barangayId;

  const [activePlanningTab, setActivePlanningTab] = useState('Templates');
  const [searchText, setSearchText]               = useState('');
  const [showAll, setShowAll]                     = useState(false); // false = Active Templates filter
  const [notifCount]                              = useState(2);
  const [sidebarVisible, setSidebarVisible]       = useState(false);
  const [selectedItem, setSelectedItem]           = useState(null);
  const [showEditModal, setShowEditModal]         = useState(false);
  const [templates, setTemplates]                = useState([]);
  const [budgetData, setBudgetData]               = useState(null);
  const [viewerModal, setViewerModal]             = useState({ visible: false, fileUrl: null, title: '' });

  // Fetch templates for this barangay (from distributions + direct from templates table)
  useEffect(() => {
    const fetchTemplates = async () => {
      if (!barangayId) return;

      try {
        // First, get templates distributed to this barangay
        const { data: distributions, error: distError } = await supabase
          .from('template_distributions')
          .select(`
            distribution_id,
            distributed_at,
            is_acknowledged,
            template_id,
            templates (
              template_id,
              title,
              description,
              template_category,
              document_type,
              status,
              created_at,
              file_url,
              version
            )
          `)
          .eq('barangay_id', barangayId);

        if (distError) {
          console.error('Error fetching template distributions:', distError);
        }

        // Then, also fetch all active templates directly (for planning category)
        const { data: allTemplates, error: templateError } = await supabase
          .from('templates')
          .select(`
            template_id,
            title,
            description,
            template_category,
            document_type,
            status,
            created_at,
            file_url,
            version
          `)
          .eq('status', 'active')
          .eq('template_category', 'planning');

        if (templateError) {
          console.error('Error fetching templates:', templateError);
        }

        // Combine and deduplicate templates
        const templateMap = new Map();

        // Add distributed templates
        if (distributions) {
          distributions.forEach(d => {
            if (d.templates && d.templates.template_id) {
              templateMap.set(d.templates.template_id, {
                id: d.templates.template_id,
                name: d.templates.title || 'Untitled Template',
                type: d.templates.template_category || 'Unknown',
                source: 'LYDO',
                dateReceived: new Date(d.templates.created_at || d.distributed_at).toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' }),
                fileUrl: d.templates.file_url || '',
                version: d.templates.version || 1,
              });
            }
          });
        }

        // Add direct templates (if not already in map)
        if (allTemplates) {
          allTemplates.forEach(t => {
            if (!templateMap.has(t.template_id) && t.file_url) {
              templateMap.set(t.template_id, {
                id: t.template_id,
                name: t.title || 'Untitled Template',
                type: t.template_category || 'Unknown',
                source: 'LYDO',
                dateReceived: new Date(t.created_at).toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' }),
                fileUrl: t.file_url || '',
                version: t.version || 1,
              });
            }
          });
        }

        setTemplates(Array.from(templateMap.values()));
      } catch (error) {
        console.error('Error:', error);
      }
    };

    fetchTemplates();
  }, [barangayId]);

  // Fetch budget allocation for this barangay
  useEffect(() => {
    const fetchBudget = async () => {
      if (!barangayId) return;

      try {
        const { data: budget, error } = await supabase
          .from('budget_allocations')
          .select('*')
          .eq('barangay_id', barangayId)
          .order('fiscal_year', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (error) {
          console.error('Error fetching budget:', error);
          return;
        }

        setBudgetData(budget);
      } catch (error) {
        console.error('Error:', error);
      }
    };

    fetchBudget();
  }, [barangayId]);

  const handleNavPress = (tab) => {
    setActiveTab(tab);
    setSidebarVisible(false);
    if (tab === 'Dashboard') router.push('/(tabs)/sk-dashboard');
    if (tab === 'Documents') router.push('/(tabs)/sk-document');
    if (tab === 'Portal')    router.push('/(tabs)/sk-portal');
      if (tab === 'Logs')      router.push('/(tabs)/sk-logs');
    if (tab === 'Account')   router.push('/(tabs)/sk-account');
  };

  const handleLogout = () => { logout(); router.replace('/'); };

  
  const handleMoTabPress = (tab) => {
    if (tab === 'Templates') { router.push('/(tabs)/sk-planning'); return; }
    if (tab === 'Budget')       { router.push('/(tabs)/sk-planning-budget'); return; }
    setActiveMonitorTab(tab);
  };

  const handleEdit = (item) => { setSelectedItem(item); setShowEditModal(true); };

  // Get all categories as sections, then filter items by search
  const templateSections = Object.entries(CATEGORY_CONFIG).map(([id, config]) => ({
    id,
    ...config,
    items: templates
      .filter(t => (t.type || 'planning') === id)
      .filter(t => t.name.toLowerCase().includes(searchText.toLowerCase())),
  }));

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
            onPress={() => handleNavPress(tab)}
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

  // ── Edit Modal ──
  const handleViewTemplate = () => {
    if (!selectedItem?.fileUrl) {
      Alert.alert('No File', 'This template has no file attached.');
      return;
    }
    setViewerModal({ visible: true, fileUrl: selectedItem.fileUrl, title: selectedItem.name });
    setShowEditModal(false);
  };

  const handleDownloadTemplate = async () => {
    if (!selectedItem?.fileUrl) {
      Alert.alert('No File', 'This template has no file to download.');
      return;
    }
    setShowEditModal(false);
    try {
      await Linking.openURL(selectedItem.fileUrl);
    } catch (error) {
      console.error('Download error:', error);
      Alert.alert('Download Failed', `Could not open the file: ${error.message}`);
    }
  };

  const renderEditModal = () => (
    <Modal
      visible={showEditModal}
      transparent
      animationType="fade"
      onRequestClose={() => setShowEditModal(false)}
    >
      <TouchableOpacity
        style={styles.modalOverlay}
        activeOpacity={1}
        onPress={() => setShowEditModal(false)}
      >
        <View style={styles.modalCard} onStartShouldSetResponder={() => true}>
          <Text style={styles.modalTitle}>Edit Template</Text>
          <Text style={styles.modalSubtitle}>{selectedItem?.name}</Text>
          <Text style={styles.modalVersion}>Version {selectedItem?.version || 1}</Text>
          <View style={styles.modalDivider} />
          <View style={styles.modalActions}>
            <TouchableOpacity
              style={[styles.modalActionBtn, { backgroundColor: '#EAF0FB' }]}
              onPress={handleViewTemplate}
            >
              <Text style={[styles.modalActionText, { color: COLORS.navy }]}>👁  View</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalActionBtn, { backgroundColor: '#EAFBEA' }]}
              onPress={handleDownloadTemplate}
            >
              <Text style={[styles.modalActionText, { color: '#2E7D32' }]}>⬇  Download</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalActionBtn, { backgroundColor: '#FDF5E6' }]}
              onPress={() => { Alert.alert('Info', 'Template creation is handled by LYDO.'); setShowEditModal(false); }}
            >
              <Text style={[styles.modalActionText, { color: '#B45309' }]}>↔  Create</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            style={styles.modalCloseBtn}
            onPress={() => setShowEditModal(false)}
          >
            <Text style={styles.modalCloseBtnText}>Close</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );

  // ── Viewer Modal (PDF/Image viewer) ──────────────────────────────────────────────
  const renderViewerModal = () => {
    if (!viewerModal.visible) return null;

    const googleViewerUrl = `https://docs.google.com/gview?embedded=true&url=${encodeURIComponent(viewerModal.fileUrl)}`;

    return (
      <Modal visible={viewerModal.visible} animationType="slide" onRequestClose={() => setViewerModal({ ...viewerModal, visible: false })}>
        <SafeAreaView style={styles.safe}>
          <View style={styles.viewerHeader}>
            <TouchableOpacity onPress={() => setViewerModal({ ...viewerModal, visible: false })}>
              <Text style={styles.viewerCloseText}>← Back</Text>
            </TouchableOpacity>
            <Text style={styles.viewerTitle} numberOfLines={1}>{viewerModal.title}</Text>
            <TouchableOpacity onPress={async () => {
              try {
                await Linking.openURL(viewerModal.fileUrl);
              } catch (error) {
                Alert.alert('Download Failed', `Could not open the file: ${error.message}`);
              }
            }}>
              <Text style={styles.viewerDownloadText}>⬇</Text>
            </TouchableOpacity>
          </View>
          {viewerModal.fileUrl && (
            <View style={styles.viewerWebContainer}>
              <iframe
                src={googleViewerUrl}
                style={{ flex: 1, border: 'none' }}
                title={viewerModal.title}
              />
            </View>
          )}
        </SafeAreaView>
      </Modal>
    );
  };

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
          <Text style={styles.mobileTitle}>Planning</Text>
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
            <Text style={styles.headerDocLabel}>Template and Budget Reference Documents</Text>
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

      {/* ── PLANNING TAB BAR (styled exactly like MONITOR_TABS) ── */}
      <View style={styles.planningTabBar}>
        {PLANNING_TABS.map(tab => {
          const active = activePlanningTab === tab;
          return (
            <TouchableOpacity
              key={tab}
              style={[styles.planningTab, active && styles.planningTabActive]}
              onPress={() => tab === 'Templates' ? router.push('/(tabs)/sk-planning') : tab === 'Budget' ? router.push('/(tabs)/sk-planning-budget') : setActivePlanningTab(tab)} activeOpacity={0.8}>
             
            
              <Text style={[styles.planningTabText, active && styles.planningTabTextActive]}>
                {tab}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* ── TEMPLATES TAB ── */}
      {activePlanningTab === 'Templates' && (
        <>
          {/* Search row */}
          <View style={styles.searchRow}>
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
            {/* Archive icon — top right */}
            <View style={{ flex: 1 }} />

          </View>

          {/* All / Active Templates filter pills */}
          <View style={styles.filterRow}>
            <TouchableOpacity
              style={!showAll ? styles.filterLinkActive : styles.filterLink}
              onPress={() => setShowAll(false)}
              activeOpacity={0.8}
            >
              <Text style={[styles.filterLinkText, !showAll && styles.filterLinkTextActive]}>
                Active Templates
              </Text>
            </TouchableOpacity>
          </View>

          {/* ── ALL view: flat table ── */}
          {showAll && (
            <View style={styles.tableContainer}>
              {/* Table Header */}
              <View style={styles.tableHeader}>
                <Text style={[styles.thText, styles.colName]}>Template Name</Text>
                <Text style={[styles.thText, styles.colType]}>Type</Text>
                <Text style={[styles.thText, styles.colSource]}>Source</Text>
                <Text style={[styles.thText, styles.colDate]}>Date Received</Text>
              </View>
              {/* Table Rows */}
              {templates
                .filter(t => t.name.toLowerCase().includes(searchText.toLowerCase()))
                .map((t, idx) => (
                  <TouchableOpacity
                    key={t.id}
                    style={[styles.tableRow, idx % 2 !== 0 && styles.tableRowEven]}
                    onPress={() => handleEdit(t)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.tdName, styles.colName]} numberOfLines={2}>{t.name}</Text>
                    <Text style={[styles.tdType, styles.colType]}>{t.type}</Text>
                    <Text style={[styles.tdCell, styles.colSource]}>{t.source}</Text>
                    <Text style={[styles.tdCell, styles.colDate]}>{t.dateReceived}</Text>
                  </TouchableOpacity>
                ))}
              {/* Empty filler rows */}
              {Array(Math.max(0, 4 - templates.filter(t =>
                t.name.toLowerCase().includes(searchText.toLowerCase())).length
              )).fill(null).map((_, i) => (
                <View key={`empty-${i}`} style={[styles.tableRow, styles.tableRowEmpty]} />
              ))}
            </View>
          )}

          {/* ── ACTIVE TEMPLATES view: category grid ── */}
          {!showAll && (
            templateSections.length > 0 ? (
              templateSections.map(sec => (
                <TemplateSection key={sec.id} section={sec} onEdit={handleEdit} />
              ))
            ) : (
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>No templates found.</Text>
              </View>
            )
          )}
        </>
      )}

      {/* ── BUDGET TAB ── */}
      {activePlanningTab === 'Budget' && (
        <View style={styles.budgetPlaceholder}>
          <Text style={styles.budgetPlaceholderText}>Budget content coming soon.</Text>
        </View>
      )}
    </ScrollView>
  );

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.navy} />

      {renderEditModal()}
      {renderViewerModal()}

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

  // ── Sidebar ──
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
  navLabel: { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.85)', letterSpacing: 0.3 },
  navLabelActive: { color: '#000', fontWeight: '800' },
  navBadge: {
    width: 18, height: 18, borderRadius: 9,
    backgroundColor: COLORS.gold, alignItems: 'center', justifyContent: 'center',
  },
  navBadgeText: { fontSize: 9, fontWeight: '900', color: COLORS.navy },
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
  menuLine: { width: 20, height: 2, backgroundColor: COLORS.navy, borderRadius: 1 },
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
  headerRight: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },


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

  // ── Planning Tab Bar — same style as MONITOR_TABS ──
  planningTabBar: {
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
  planningTab: {
    flex: 1,
    paddingHorizontal: isMobile ? 8 : 40,
    paddingVertical: 10,
    backgroundColor: COLORS.navy,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
  },
  planningTabActive: {
    backgroundColor: COLORS.gold,
    borderRadius: 4,
    borderColor: COLORS.gold,
    shadowColor: COLORS.gold,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
    elevation: 3,
  },
  planningTabText: {
    fontSize: isMobile ? 10 : 13,
    fontWeight: '600',
    color: COLORS.white,
  },
  planningTabTextActive: {
    color: COLORS.darkText,
    fontWeight: '800',
  },

  // Search row (with archive icon)
  searchRow: {
    flexDirection: 'row', alignItems: 'center',
    gap: 8, marginBottom: 8,
  },
  archiveIconBtn: {
    width: 34, height: 34, borderRadius: 8,
    backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.lightGray,
    alignItems: 'center', justifyContent: 'center',
  },
  archiveIconText: { fontSize: 16 },

  // Filter links (All / Active Templates) — plain text style like screenshot
  filterRow: {
    flexDirection: 'row', alignItems: 'center',
    gap: 16, marginBottom: 14,
  },
  filterLink: { paddingVertical: 2 },
  filterLinkActive: { paddingVertical: 2, borderBottomWidth: 2, borderBottomColor: COLORS.navy },
  filterLinkText: { fontSize: 13, fontWeight: '500', color: COLORS.subText },
  filterLinkTextActive: { color: COLORS.navy, fontWeight: '800' },

  // ── All-view flat table ──
  tableContainer: {
    backgroundColor: COLORS.white,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.lightGray,
    overflow: 'hidden',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    marginBottom: 14,
  },
  tableHeader: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.offWhite,
    paddingVertical: 10, paddingHorizontal: 14,
    borderBottomWidth: 1, borderBottomColor: COLORS.lightGray,
  },
  thText: { fontSize: 12, fontWeight: '800', color: COLORS.darkText },
  tableRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 12, paddingHorizontal: 14,
    borderBottomWidth: 1, borderBottomColor: COLORS.lightGray,
    backgroundColor: COLORS.white, minHeight: 46,
  },
  tableRowEven: { backgroundColor: '#FAFAFA' },
  tableRowEmpty: { minHeight: 46 },

  // Column widths
  colName:   { flex: 2.4, paddingRight: 8 },
  colType:   { flex: 1,   paddingRight: 8 },
  colSource: { flex: 0.7, paddingRight: 8 },
  colDate:   { flex: 1.2 },

  tdName: { fontSize: isMobile ? 10 : 12, color: COLORS.darkText, lineHeight: 17 },
  tdType: { fontSize: isMobile ? 10 : 12, color: COLORS.subText, fontStyle: 'italic' },
  tdCell: { fontSize: isMobile ? 10 : 12, color: COLORS.darkText },

  // Search box
  searchBox: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.white, borderRadius: 20,
    borderWidth: 1, borderColor: COLORS.lightGray,
    paddingHorizontal: 12, paddingVertical: 7,
    minWidth: 120, maxWidth: isMobile ? 160 : 220,
  },
  searchInput: { flex: 1, fontSize: 12, color: COLORS.darkText },

  // ── Template Sections ──
  section: {
    backgroundColor: COLORS.white,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.lightGray,
    marginBottom: 14,
    overflow: 'hidden',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  sectionHeader: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderLeftWidth: 4,
  },
  sectionHeaderText: {
    fontSize: 13, fontWeight: '800', color: COLORS.darkText,
  },
  sectionBody: {
    paddingHorizontal: 12, paddingVertical: 8,
  },
  itemRow: {
    flexDirection: 'row', gap: 10, marginBottom: 4,
  },
  itemCol: { flex: 1 },

  // Template item row (name + edit icon)
  templateItem: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 10, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: COLORS.lightGray,
    gap: 8,
  },
  templateItemName: {
    flex: 1, fontSize: isMobile ? 11 : 12,
    color: COLORS.darkText, lineHeight: 17,
  },

  // Edit icon
  editIconBox: {
    width: 28, height: 28, borderRadius: 6,
    borderWidth: 1, borderColor: COLORS.lightGray,
    backgroundColor: COLORS.offWhite,
    alignItems: 'center', justifyContent: 'center',
  },
  editIconText: { fontSize: 14, color: COLORS.navy },

  // Empty / Budget placeholder
  emptyState: { alignItems: 'center', paddingVertical: 40 },
  emptyText: { fontSize: 14, color: COLORS.midGray },
  budgetPlaceholder: {
    flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 60,
  },
  budgetPlaceholderText: { fontSize: 14, color: COLORS.midGray },

  // ── Edit Modal ──
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
  modalSubtitle: { fontSize: 13, color: COLORS.subText, lineHeight: 18, marginBottom: 4 },
  modalVersion:  { fontSize: 11, color: COLORS.midGray, marginBottom: 14 },
  modalDivider:  { height: 1, backgroundColor: COLORS.lightGray, marginBottom: 14 },
  modalActions:  { flexDirection: 'row', gap: 8, marginBottom: 16 },
  modalActionBtn: {
    flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center',
  },
  modalActionText: { fontSize: 12, fontWeight: '700' },
  modalCloseBtn: {
    paddingVertical: 10, borderRadius: 10,
    backgroundColor: COLORS.lightGray, alignItems: 'center',
  },
  modalCloseBtnText: { fontSize: 13, fontWeight: '600', color: COLORS.darkText },

  // ── Viewer Modal ──
  viewerHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: COLORS.navy, borderBottomWidth: 1, borderBottomColor: COLORS.lightGray,
  },
  viewerCloseText: { fontSize: 14, fontWeight: '600', color: COLORS.white },
  viewerTitle: { flex: 1, fontSize: 14, fontWeight: '700', color: COLORS.white, textAlign: 'center', marginHorizontal: 10 },
  viewerDownloadText: { fontSize: 18, color: COLORS.white },
  viewerLoading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.offWhite },
  viewerLoadingText: { marginTop: 12, fontSize: 14, color: COLORS.subText },
  viewerWebContainer: { flex: 1, backgroundColor: COLORS.white },
  viewerFallback: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.offWhite, padding: 20 },
  viewerFallbackText: { fontSize: 14, color: COLORS.subText, marginBottom: 16 },
  viewerFallbackBtn: { backgroundColor: COLORS.navy, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 8 },
  viewerFallbackBtnText: { fontSize: 14, fontWeight: '700', color: COLORS.white },
});