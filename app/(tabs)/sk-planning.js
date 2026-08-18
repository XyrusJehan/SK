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
import { NotificationModal, useNotificationCenter, BellIcon } from './notificationCenter';
import Sidebar from './../components/Sidebar';
import {
  Bars3Icon,
  MagnifyingGlassIcon,
  XMarkIcon,
  PencilSquareIcon,
  DocumentTextIcon,
  EyeIcon,
  ArrowDownTrayIcon,
  PlusCircleIcon,
  ArrowLeftIcon,
} from 'react-native-heroicons/outline';

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
  planning: { title: 'Planning Templates', color: '#EAF0FB', borderColor: '#B8CAE8', accent: '#3B6EC9' },
  budgeting: { title: 'Budgeting Templates', color: '#EAFBEA', borderColor: '#B8E4B8', accent: '#2E9E4F' },
  financial_records: { title: 'Financial Records and Evaluation Templates', color: '#FDF5E6', borderColor: '#E8D5A8', accent: '#C98A1E' },
  monitoring_evaluation: { title: 'Monitoring and Evaluation', color: '#F3EAFB', borderColor: '#C8B0E4', accent: '#8B4FC9' },
};

// ─── ALL TEMPLATES — (now fetched from Supabase based on barangay_id) ─────
// (Data fetched via useEffect)


const MenuIcon = () => (
  <Bars3Icon size={22} color={COLORS.navy} strokeWidth={2} />
);

// Edit icon (pencil box) — tinted per category
const EditIcon = ({ color }) => (
  <View style={[styles.editIconBox, { borderColor: color + '55', backgroundColor: color + '14' }]}>
    <PencilSquareIcon size={14} color={color} strokeWidth={2} />
  </View>
);

// Document icon — tinted per category
const DocFileIcon = ({ color }) => (
  <View style={[styles.docIconOuter, { backgroundColor: color + '17' }]}>
    <DocumentTextIcon size={20} color={color} strokeWidth={1.8} />
  </View>
);

// ─── TEMPLATE ITEM ────────────────────────────────────────────────────────────
const TemplateItem = ({ item, accent, onEdit }) => (
  <TouchableOpacity style={styles.templateItem} onPress={() => onEdit(item)} activeOpacity={0.7}>
    <DocFileIcon color={accent} />
    <View style={styles.templateItemBody}>
      <Text style={styles.templateItemName} numberOfLines={2}>{item.name}</Text>
      <Text style={styles.templateItemMeta} numberOfLines={1}>
        v{item.version || 1} · Received {item.dateReceived}
      </Text>
    </View>
    <EditIcon color={accent} />
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
    <View style={[styles.section, { borderTopColor: section.accent }]}>
      {/* Section Header */}
      <View style={styles.sectionHeader}>
        <View style={styles.sectionHeaderLeft}>
          <View style={[styles.sectionDot, { backgroundColor: section.accent }]} />
          <Text style={styles.sectionHeaderText}>{section.title}</Text>
        </View>
        <View style={[styles.sectionCountPill, { backgroundColor: section.color, borderColor: section.borderColor }]}>
          <Text style={[styles.sectionCountText, { color: section.accent }]}>
            {section.items.length} {section.items.length === 1 ? 'file' : 'files'}
          </Text>
        </View>
      </View>

      {/* Items grid — 2 per row */}
      {section.items.length > 0 ? (
        <View style={styles.sectionBody}>
          {pairs.map((pair, pIdx) => (
            <View key={pIdx} style={styles.itemRow}>
              {pair.map(item => (
                <View key={item.id} style={styles.itemCol}>
                  <TemplateItem item={item} accent={section.accent} onEdit={onEdit} />
                </View>
              ))}
              {/* If odd item in last row, fill empty col */}
              {pair.length === 1 && <View style={styles.itemCol} />}
            </View>
          ))}
        </View>
      ) : (
        <View style={styles.sectionEmpty}>
          <Text style={styles.sectionEmptyText}>No templates in this category yet.</Text>
        </View>
      )}
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
  const [sidebarVisible, setSidebarVisible]       = useState(false);

  // ── Shared notification bell (returned/approved docs, templates, deadlines) ──
  const notif = useNotificationCenter(barangayId);
  const notifCount = notif.count;
  const [selectedItem, setSelectedItem]           = useState(null);
  const [showEditModal, setShowEditModal]         = useState(false);
  const [templates, setTemplates]                = useState([]);
  const [budgetData, setBudgetData]               = useState(null);
  const [viewerModal, setViewerModal]             = useState({ visible: false, fileUrl: null, title: '' });

  // Fetch templates for this barangay from template_distributions based on barangay_id
  useEffect(() => {
    const fetchTemplates = async () => {
      if (!barangayId) return;

      try {
        // Get templates distributed to this barangay from template_distributions
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
          return;
        }

        // Build templates list from distributions only
        const templateList = [];

        if (distributions) {
          distributions.forEach(d => {
            if (d.templates && d.templates.template_id) {
              templateList.push({
                id: d.templates.template_id,
                name: d.templates.title || 'Untitled Template',
                type: d.templates.template_category || 'Unknown',
                source: 'LYDO',
                dateReceived: new Date(d.distributed_at).toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' }),
                fileUrl: d.templates.file_url || '',
                version: d.templates.version || 1,
              });
            }
          });
        }

        setTemplates(templateList);
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

  const renderEditModal = () => {
    const cat = CATEGORY_CONFIG[selectedItem?.type] || {};
    const accent = cat.accent || COLORS.navy;

    return (
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
            <View style={[styles.modalAccentBar, { backgroundColor: accent }]} />
            <View style={styles.modalContent}>
              <TouchableOpacity
                style={styles.modalCloseX}
                onPress={() => setShowEditModal(false)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <XMarkIcon size={14} color={COLORS.subText} strokeWidth={2} />
              </TouchableOpacity>

              <View style={styles.modalHeaderRow}>
                <DocFileIcon color={accent} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.modalEyebrow}>EDIT TEMPLATE</Text>
                  <Text style={styles.modalTitle} numberOfLines={2}>{selectedItem?.name}</Text>
                </View>
              </View>

              <View style={styles.modalPillRow}>
                {cat.title && (
                  <View style={[styles.modalPill, { backgroundColor: cat.color, borderColor: cat.borderColor }]}>
                    <Text style={[styles.modalPillText, { color: accent }]}>{cat.title.replace(' Templates', '')}</Text>
                  </View>
                )}
                <View style={styles.modalPillNeutral}>
                  <Text style={styles.modalPillNeutralText}>Version {selectedItem?.version || 1}</Text>
                </View>
              </View>

              <View style={styles.modalDivider} />

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={[styles.modalActionBtn, { backgroundColor: '#EAF0FB' }]}
                  onPress={handleViewTemplate}
                >
                  <EyeIcon size={15} color={COLORS.navy} strokeWidth={2} />
                  <Text style={[styles.modalActionText, { color: COLORS.navy }]}>View</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalActionBtn, { backgroundColor: '#EAFBEA' }]}
                  onPress={handleDownloadTemplate}
                >
                  <ArrowDownTrayIcon size={15} color="#2E7D32" strokeWidth={2} />
                  <Text style={[styles.modalActionText, { color: '#2E7D32' }]}>Download</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalActionBtn, { backgroundColor: '#FDF5E6' }]}
                  onPress={() => { Alert.alert('Info', 'Template creation is handled by LYDO.'); setShowEditModal(false); }}
                >
                  <PlusCircleIcon size={15} color="#B45309" strokeWidth={2} />
                  <Text style={[styles.modalActionText, { color: '#B45309' }]}>Create</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => setShowEditModal(false)}
              >
                <Text style={styles.modalCloseBtnText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
    );
  };

  // ── Viewer Modal (PDF/Image viewer) ──────────────────────────────────────────────
  const renderViewerModal = () => {
    if (!viewerModal.visible) return null;

    const googleViewerUrl = `https://docs.google.com/gview?embedded=true&url=${encodeURIComponent(viewerModal.fileUrl)}`;

    return (
      <Modal visible={viewerModal.visible} animationType="slide" onRequestClose={() => setViewerModal({ ...viewerModal, visible: false })}>
        <SafeAreaView style={styles.safe}>
          <View style={styles.viewerHeader}>
            <TouchableOpacity style={styles.viewerBackBtn} onPress={() => setViewerModal({ ...viewerModal, visible: false })}>
              <ArrowLeftIcon size={16} color={COLORS.white} strokeWidth={2.2} />
              <Text style={styles.viewerCloseText}>Back</Text>
            </TouchableOpacity>
            <Text style={styles.viewerTitle} numberOfLines={1}>{viewerModal.title}</Text>
            <TouchableOpacity onPress={async () => {
              try {
                await Linking.openURL(viewerModal.fileUrl);
              } catch (error) {
                Alert.alert('Download Failed', `Could not open the file: ${error.message}`);
              }
            }}>
              <ArrowDownTrayIcon size={19} color={COLORS.white} strokeWidth={2} />
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
          <TouchableOpacity style={styles.bellBtn} onPress={notif.open} activeOpacity={0.7}>
            <BellIcon hasNotif={notif.hasUnviewed} />
            {notifCount > 0 && (
              <View style={styles.notifBadge}>
                <Text style={styles.notifBadgeText}>{notifCount > 99 ? '99+' : notifCount}</Text>
              </View>
            )}
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
   
            <TouchableOpacity style={styles.bellBtn} onPress={notif.open} activeOpacity={0.7}>
              <BellIcon hasNotif={notif.hasUnviewed} />
              {notifCount > 0 && (
                <View style={styles.notifBadge}>
                  <Text style={styles.notifBadgeText}>{notifCount > 99 ? '99+' : notifCount}</Text>
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
          {/* Section title + search */}
          <View style={styles.templatesTopRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.templatesTitle}>
                {showAll ? 'All Templates' : 'Active Templates'}
              </Text>
              <Text style={styles.templatesSubtitle}>
                {showAll
                  ? 'Every template distributed to your barangay by LYDO.'
                  : 'Templates currently distributed to your barangay by LYDO.'}
              </Text>
            </View>
            <View style={styles.searchBox}>
              <MagnifyingGlassIcon size={14} color={COLORS.midGray} strokeWidth={2} style={{ marginRight: 4 }} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search"
                placeholderTextColor={COLORS.midGray}
                value={searchText}
                onChangeText={setSearchText}
              />
              {searchText.length > 0 && (
                <TouchableOpacity onPress={() => setSearchText('')}>
                  <XMarkIcon size={13} color={COLORS.midGray} strokeWidth={2} />
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* All / Active Templates segmented toggle */}
          <View style={styles.segmentTrack}>
            <TouchableOpacity
              style={[styles.segmentBtn, !showAll && styles.segmentBtnActive]}
              onPress={() => setShowAll(false)}
              activeOpacity={0.85}
            >
              <Text style={[styles.segmentText, !showAll && styles.segmentTextActive]}>Active Templates</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.segmentBtn, showAll && styles.segmentBtnActive]}
              onPress={() => setShowAll(true)}
              activeOpacity={0.85}
            >
              <Text style={[styles.segmentText, showAll && styles.segmentTextActive]}>All</Text>
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
          {!showAll &&
            templateSections.map(sec => (
              <TemplateSection key={sec.id} section={sec} onEdit={handleEdit} />
            ))}
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
      </View>
    </SafeAreaView>
  );
}

// ─── STYLES ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: COLORS.navy },
  layout: { flex: 1, flexDirection: 'row' },

  // ── Sidebar ──
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
  menuBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: COLORS.cardBg, alignItems: 'center', justifyContent: 'center',
  },
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

  // Section title + search row
  templatesTopRow: {
    flexDirection: isMobile ? 'column' : 'row',
    alignItems: isMobile ? 'flex-start' : 'flex-end',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 14,
  },
  templatesTitle: {
    fontSize: isMobile ? 17 : 19, fontWeight: '900', color: COLORS.darkText,
    letterSpacing: 0.2,
  },
  templatesSubtitle: {
    fontSize: 12, color: COLORS.subText, marginTop: 3,
  },

  // All / Active Templates segmented toggle
  segmentTrack: {
    flexDirection: 'row',
    backgroundColor: '#EDEBE6',
    borderRadius: 10,
    padding: 3,
    marginBottom: 16,
    alignSelf: 'flex-start',
  },
  segmentBtn: {
    paddingHorizontal: 16, paddingVertical: 8,
    borderRadius: 8,
  },
  segmentBtnActive: {
    backgroundColor: COLORS.white,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1, shadowRadius: 3, elevation: 2,
  },
  segmentText: { fontSize: 12, fontWeight: '600', color: COLORS.subText },
  segmentTextActive: { color: COLORS.navy, fontWeight: '800' },

  // Archive icon (unused, kept for compatibility)
  archiveIconBtn: {
    width: 34, height: 34, borderRadius: 8,
    backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.lightGray,
    alignItems: 'center', justifyContent: 'center',
  },
  archiveIconText: { fontSize: 16 },

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
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.lightGray,
    borderTopWidth: 3,
    marginBottom: 16,
    overflow: 'hidden',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightGray,
  },
  sectionHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1, paddingRight: 8 },
  sectionDot: { width: 7, height: 7, borderRadius: 4 },
  sectionHeaderText: {
    fontSize: 13, fontWeight: '800', color: COLORS.darkText, flexShrink: 1,
  },
  sectionCountPill: {
    borderRadius: 20, borderWidth: 1,
    paddingHorizontal: 9, paddingVertical: 3,
  },
  sectionCountText: { fontSize: 10, fontWeight: '800' },
  sectionBody: {
    paddingHorizontal: 12, paddingVertical: 12,
  },
  sectionEmpty: { paddingHorizontal: 16, paddingVertical: 20 },
  sectionEmptyText: { fontSize: 12, color: COLORS.midGray, fontStyle: 'italic' },
  itemRow: {
    flexDirection: 'row', gap: 10, marginBottom: 10,
  },
  itemCol: { flex: 1 },

  // Template item card (icon + name + meta + edit)
  templateItem: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.offWhite,
    borderRadius: 10, borderWidth: 1, borderColor: COLORS.lightGray,
    paddingHorizontal: 10, paddingVertical: 10,
    gap: 10,
  },
  templateItemBody: { flex: 1 },
  templateItemName: {
    fontSize: isMobile ? 11 : 12, fontWeight: '700',
    color: COLORS.darkText, lineHeight: 16,
  },
  templateItemMeta: {
    fontSize: 10, color: COLORS.subText, marginTop: 3,
  },

  // Document file icon
  docIconOuter: {
    width: 38, height: 38, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },

  // Edit icon
  editIconBox: {
    width: 28, height: 28, borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },

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
    width: '100%', maxWidth: 380, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18, shadowRadius: 20, elevation: 12,
  },
  modalAccentBar: { height: 4, width: '100%' },
  modalContent: { padding: 22 },
  modalCloseX: {
    position: 'absolute', top: 16, right: 16, zIndex: 1,
    width: 26, height: 26, borderRadius: 13,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: COLORS.offWhite,
  },
  modalCloseXText: { fontSize: 12, color: COLORS.subText },
  modalHeaderRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    marginBottom: 14, paddingRight: 26,
  },
  modalEyebrow: {
    fontSize: 10, fontWeight: '800', color: COLORS.midGray,
    letterSpacing: 1, marginBottom: 3,
  },
  modalTitle: { fontSize: 16, fontWeight: '800', color: COLORS.darkText, lineHeight: 21 },
  modalPillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 16 },
  modalPill: {
    borderRadius: 20, borderWidth: 1,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  modalPillText: { fontSize: 10, fontWeight: '800' },
  modalPillNeutral: {
    borderRadius: 20, borderWidth: 1, borderColor: COLORS.lightGray,
    backgroundColor: COLORS.offWhite,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  modalPillNeutralText: { fontSize: 10, fontWeight: '700', color: COLORS.subText },
  modalDivider:  { height: 1, backgroundColor: COLORS.lightGray, marginBottom: 14 },
  modalActions:  { flexDirection: 'row', gap: 8, marginBottom: 16 },
  modalActionBtn: {
    flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center', gap: 4,
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
  viewerBackBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  viewerCloseText: { fontSize: 14, fontWeight: '600', color: COLORS.white },
  viewerTitle: { flex: 1, fontSize: 14, fontWeight: '700', color: COLORS.white, textAlign: 'center', marginHorizontal: 10 },
  viewerLoading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.offWhite },
  viewerLoadingText: { marginTop: 12, fontSize: 14, color: COLORS.subText },
  viewerWebContainer: { flex: 1, backgroundColor: COLORS.white },
  viewerFallback: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.offWhite, padding: 20 },
  viewerFallbackText: { fontSize: 14, color: COLORS.subText, marginBottom: 16 },
  viewerFallbackBtn: { backgroundColor: COLORS.navy, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 8 },
  viewerFallbackBtnText: { fontSize: 14, fontWeight: '700', color: COLORS.white },
});