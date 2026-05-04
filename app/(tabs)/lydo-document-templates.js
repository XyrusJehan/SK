import React, { useState, useEffect, useRef } from 'react';
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
  Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useNav } from './navContext';
import { useAuth } from './authContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const isMobile = SCREEN_WIDTH < 768;

// ─── COLORS (identical to lydo-document) ──────────────────────────────────────
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
};

// ─── NAV TABS ─────────────────────────────────────────────────────────────────
const NAV_TABS = ['Home', 'Documents', 'Monitor'];
const DOCUMENT_TABS = ['Barangay Folders', 'Reports', 'Templates'];

// ─── TEMPLATE STATUS ──────────────────────────────────────────────────────────
const STATUS_COLORS = {
  Active:      { text: '#2E7D32', bg: '#E8F5E9' },
  Draft:       { text: '#1565C0', bg: '#E3F2FD' },
  'Old Version': { text: '#B71C1C', bg: '#FFEBEE' },
  Archived:    { text: '#6D4C41', bg: '#EFEBE9' },
};

// ─── INITIAL TEMPLATE DATA ────────────────────────────────────────────────────
const INITIAL_TEMPLATES = [
  { id: '1', name: 'Comprehensive Barangay Youth Development Plan',      status: 'Active',  category: 'Planning',  version: 1, updatedAt: '2026-01-02' },
  { id: '2', name: 'Annual Barangay Youth Investment Program (ABYIP) 2026', status: 'Draft', category: 'Planning', version: 1, updatedAt: '2026-01-02' },
  { id: '3', name: 'Annual Budget 2026',                                  status: 'Active',  category: 'Financial', version: 2, updatedAt: '2026-01-15' },
  { id: '4', name: 'Quarterly Register of Cash in Bank',                  status: 'Active',  category: 'Financial', version: 1, updatedAt: '2026-01-02' },
  { id: '5', name: 'Monthly Itemized List',                               status: 'Active',  category: 'Financial', version: 1, updatedAt: '2026-01-02' },
  { id: '6', name: 'Accomplishment Report',                               status: 'Active',  category: 'Performance', version: 1, updatedAt: '2026-01-02' },
];

// Pre-seeded archive records (version history)
const INITIAL_ARCHIVE = [
  { id: 'arch-3-v1', templateId: '3', name: 'Annual Budget 2026',       version: 1, archivedAt: '2026-01-15', archivedReason: 'Replaced by newer version', category: 'Financial' },
];

const FILTER_OPTIONS = ['All', 'Currently in use',];
const CATEGORY_FILTERS = ['All Categories', 'Planning', 'Financial', 'Performance'];

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

const DocumentIcon = ({ color = '#133E75' }) => (
  <View style={{ width: 16, height: 20, position: 'relative' }}>
    <View style={{
      width: 16, height: 20,
      backgroundColor: color,
      borderRadius: 2,
      opacity: 0.15,
      position: 'absolute',
    }} />
    <View style={{
      position: 'absolute', top: 3, left: 2,
      width: 12, height: 2, backgroundColor: color, borderRadius: 1, opacity: 0.7,
    }} />
    <View style={{
      position: 'absolute', top: 7, left: 2,
      width: 9, height: 2, backgroundColor: color, borderRadius: 1, opacity: 0.7,
    }} />
    <View style={{
      position: 'absolute', top: 11, left: 2,
      width: 10, height: 2, backgroundColor: color, borderRadius: 1, opacity: 0.7,
    }} />
    <View style={{
      position: 'absolute', top: 15, left: 2,
      width: 7, height: 2, backgroundColor: color, borderRadius: 1, opacity: 0.7,
    }} />
  </View>
);

// ─── STATUS BADGE ─────────────────────────────────────────────────────────────
const StatusBadge = ({ status }) => {
  const colors = STATUS_COLORS[status] || { text: COLORS.subText, bg: COLORS.lightGray };
  return (
    <View style={[styles.statusBadge, { backgroundColor: colors.bg }]}>
      <Text style={[styles.statusText, { color: colors.text }]}>{status}</Text>
    </View>
  );
};

// ─── TEMPLATE ROW ─────────────────────────────────────────────────────────────
const TemplateRow = ({ item, onPress }) => (
  <TouchableOpacity
    style={styles.templateRow}
    onPress={() => onPress && onPress(item)}
    activeOpacity={0.7}
  >
    <View style={styles.templateRowLeft}>
      <DocumentIcon color={COLORS.navy} />
      <Text style={styles.templateName} numberOfLines={2}>{item.name}</Text>
    </View>
    <StatusBadge status={item.status} />
  </TouchableOpacity>
);

// ─── MAIN SCREEN ──────────────────────────────────────────────────────────────
export default function LYDODocumentTemplatesScreen() {
  const router = useRouter();
  const { activeTab, setActiveTab } = useNav();
  const { logout } = useAuth();

  const [searchText, setSearchText]             = useState('');
  const [activeFilter, setActiveFilter]         = useState('All');
  const [categoryFilter, setCategoryFilter]     = useState('All Categories');
  const [notifCount]                            = useState(2);
  const [sidebarVisible, setSidebarVisible]     = useState(false);
  const [activeDocumentTab, setActiveDocumentTab] = useState('Templates');
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [dropdownPos, setDropdownPos]                   = useState({ top: 0, left: 0 });
  const dropdownBtnRef                                  = useRef(null);
  const [showAddModal, setShowAddModal]         = useState(false);
  const [addDocType, setAddDocType]             = useState('');
  const [addDocTypeOpen, setAddDocTypeOpen]     = useState(false);
  const [addEntries, setAddEntries]             = useState([{ id: 1, name: '', file: null }]);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [showReplaceModal, setShowReplaceModal] = useState(false);
  const [checkedTemplates, setCheckedTemplates] = useState({});
  const [dropdownOpen, setDropdownOpen]         = useState(false);
  const [uploadedFiles, setUploadedFiles]       = useState({});
  const [showForwardModal, setShowForwardModal] = useState(false);
  const [forwardChecked, setForwardChecked]     = useState({});

  // ── Dynamic template + archive state ──
  const [templates, setTemplates]           = useState(INITIAL_TEMPLATES);
  const [archiveRecords, setArchiveRecords] = useState(INITIAL_ARCHIVE);
  const [showArchiveView, setShowArchiveView] = useState(false);
  const [expandedArchiveId, setExpandedArchiveId] = useState(null);

  useEffect(() => { setActiveTab('Documents'); }, []);

  // ── Auto-archive: whenever a template is marked 'Old Version', move it to Archived ──
  useEffect(() => {
    const oldOnes = templates.filter(t => t.status === 'Old Version');
    if (oldOnes.length === 0) return;
    const today = new Date().toISOString().slice(0, 10);
    setTemplates(prev =>
      prev.map(t => t.status === 'Old Version' ? { ...t, status: 'Archived' } : t)
    );
    setArchiveRecords(prev => {
      const existing = new Set(prev.map(r => `${r.templateId}-v${r.version}`));
      const toAdd = oldOnes
        .filter(t => !existing.has(`${t.id}-v${t.version}`))
        .map(t => ({
          id:             `arch-${t.id}-v${t.version}-${Date.now()}`,
          templateId:     t.id,
          name:           t.name,
          version:        t.version,
          archivedAt:     today,
          archivedReason: 'Automatically archived — outdated version',
          category:       t.category,
        }));
      return [...prev, ...toAdd];
    });
  }, [templates]);

  // ── Filtered templates (Archived ones never appear in the main list) ──
  const filteredTemplates = templates.filter(t => {
    if (t.status === 'Archived') return false;
    const matchesSearch   = t.name.toLowerCase().includes(searchText.toLowerCase());
    const matchesFilter   =
      activeFilter === 'All' ||
      (activeFilter === 'Currently in use' && t.status === 'Active');
    const matchesCategory =
      categoryFilter === 'All Categories' || t.category === categoryFilter;
    return matchesSearch && matchesFilter && matchesCategory;
  });

  // ── Navigation helpers ──
  const handleNavPress = (tab) => {
    setActiveTab(tab);
    setSidebarVisible(false);
    if (tab === 'Home') router.push('/(tabs)/lydo-home');
    else if (tab === 'Documents') router.push('/(tabs)/lydo-document');
    else if (tab === 'Monitor') router.push('/(tabs)/lydo-monitor');
  };

  const handleLogout = () => {
    logout();
    router.replace('/');
  };

  const handleDocumentTabPress = (tab) => {
    if (tab === 'Barangay Folders') { router.push('/(tabs)/lydo-document'); return; }
    if (tab === 'Reports') { router.push('/(tabs)/lydo-document-reports'); return; }
    if (tab === 'Templates') { setActiveDocumentTab('Templates'); return; }
  };

  // ── Sidebar ──
  const renderSidebar = () => (
    <View style={styles.sidebar}>
      <View style={styles.logoPill}>
        <View style={styles.logoCircle}>
          <Text style={styles.logoText}>LYDO</Text>
        </View>
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
      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.8}>
        <Text style={styles.logoutText}>Logout</Text>
      </TouchableOpacity>
    </View>
  );

  // ── Category Dropdown Modal ──
  const renderCategoryDropdown = () => (
    <Modal
      visible={showCategoryDropdown}
      transparent
      animationType="none"
      onRequestClose={() => setShowCategoryDropdown(false)}
    >
      <TouchableOpacity
        style={StyleSheet.absoluteFillObject}
        activeOpacity={1}
        onPress={() => setShowCategoryDropdown(false)}
      />
      <View style={[styles.dropdown, { top: dropdownPos.top, left: dropdownPos.left }]}>
        {CATEGORY_FILTERS.map(cat => (
          <TouchableOpacity
            key={cat}
            style={[styles.dropdownItem, categoryFilter === cat && styles.dropdownItemActive]}
            onPress={() => { setCategoryFilter(cat); setShowCategoryDropdown(false); }}
          >
            <Text style={[styles.dropdownItemText, categoryFilter === cat && styles.dropdownItemTextActive]}>
              {cat}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </Modal>
  );

  // ── Add Template Modal ──
  const DOC_TYPE_OPTIONS = templates.filter(t => t.status !== 'Archived').map(t => t.name);

  const resetAddModal = () => {
    setAddDocType('');
    setAddDocTypeOpen(false);
    setAddEntries([{ id: Date.now(), name: '', file: null }]);
  };

  const renderAddModal = () => (
    <Modal
      visible={showAddModal}
      transparent
      animationType="fade"
      onRequestClose={() => { setShowAddModal(false); resetAddModal(); }}
    >
      <View style={styles.modalOverlay}>
        <View
          style={[styles.modalCard, { maxHeight: '92%' }]}
          onStartShouldSetResponder={() => true}
          onTouchStart={(e) => e.stopPropagation()}
        >

          {/* Header */}
          <View style={styles.replaceModalHeader}>
            <Text style={styles.modalTitle}>Add New Template to System</Text>
            <TouchableOpacity onPress={() => { setShowAddModal(false); resetAddModal(); }}>
              <Text style={styles.replaceCloseX}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            onStartShouldSetResponder={() => true}
          >

            {/* Document Type Dropdown */}
            <Text style={styles.replaceLabel}>Document Type</Text>
            <TouchableOpacity
              style={[styles.dropdownTrigger, addDocTypeOpen && styles.dropdownTriggerOpen]}
              onPress={() => setAddDocTypeOpen(v => !v)}
              activeOpacity={0.8}
            >
              <Text style={[styles.dropdownTriggerText, !addDocType && { color: COLORS.midGray }]} numberOfLines={1}>
                {addDocType || 'Select document type…'}
              </Text>
              <Text style={styles.dropdownCaret}>{addDocTypeOpen ? '▲' : '▼'}</Text>
            </TouchableOpacity>

            {addDocTypeOpen && (
              <View style={styles.checklistPanel}>
                {DOC_TYPE_OPTIONS.map((opt, idx) => (
                  <View key={opt}>
                    <TouchableOpacity
                      style={styles.checklistRow}
                      onPress={() => {
                        setAddDocType(opt);
                        setAddDocTypeOpen(false);
                        // auto-fill the first entry name if empty
                        setAddEntries(prev => prev.map((e, i) =>
                          i === 0 && !e.name ? { ...e, name: opt } : e
                        ));
                      }}
                      activeOpacity={0.7}
                    >
                      <View style={[styles.checkbox, addDocType === opt && styles.checkboxChecked]}>
                        {addDocType === opt && <Text style={styles.checkmark}>✓</Text>}
                      </View>
                      <Text style={styles.checklistText} numberOfLines={2}>{opt}</Text>
                    </TouchableOpacity>
                    {idx < DOC_TYPE_OPTIONS.length - 1 && <View style={styles.checklistDivider} />}
                  </View>
                ))}
              </View>
            )}

            {/* Entries */}
            {addEntries.map((entry, idx) => (
              <View key={entry.id} style={idx > 0 ? { marginTop: 16 } : { marginTop: 14 }}>
                {/* Template Name */}
                <Text style={styles.replaceLabel}>Template Name</Text>
                <TextInput
                  style={styles.addNameInput}
                  placeholder={addDocType || 'Template name…'}
                  placeholderTextColor={COLORS.midGray}
                  value={entry.name}
                  onChangeText={text =>
                    setAddEntries(prev => prev.map(e => e.id === entry.id ? { ...e, name: text } : e))
                  }
                />

                {/* Upload Box */}
                <TouchableOpacity
                  style={[styles.uploadBox, entry.file && styles.uploadBoxDone, { marginTop: 8 }]}
                  activeOpacity={0.75}
                  onPress={() =>
                    setAddEntries(prev => prev.map(e =>
                      e.id === entry.id ? { ...e, file: `${entry.name || addDocType || 'template'}.docx` } : e
                    ))
                  }
                >
                  {entry.file ? (
                    <>
                      <Text style={styles.uploadDoneIcon}>✓</Text>
                      <Text style={styles.uploadDoneText} numberOfLines={1}>{entry.file}</Text>
                      <TouchableOpacity onPress={() =>
                        setAddEntries(prev => prev.map(e => e.id === entry.id ? { ...e, file: null } : e))
                      }>
                        <Text style={styles.uploadRemove}>✕</Text>
                      </TouchableOpacity>
                    </>
                  ) : (
                    <>
                      <Text style={styles.uploadIcon}>⬆</Text>
                      <Text style={styles.uploadText}>Upload  Here</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            ))}

            {/* + Add another entry button */}
            <View style={{ alignItems: 'flex-end', marginTop: 12 }}>
              <TouchableOpacity
                style={styles.addEntryBtn}
                onPress={() => setAddEntries(prev => [...prev, { id: Date.now(), name: addDocType, file: null }])}
                activeOpacity={0.8}
              >
                <Text style={styles.addEntryBtnText}>＋</Text>
              </TouchableOpacity>
            </View>

          </ScrollView>

          {/* Footer */}
          <View style={[styles.modalRow, { marginTop: 16 }]}>
            <TouchableOpacity
              style={[styles.modalBtn, { backgroundColor: COLORS.lightGray, flex: 1 }]}
              onPress={() => { setShowAddModal(false); resetAddModal(); }}
            >
              <Text style={{ color: COLORS.darkText, fontWeight: '600' }}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalBtn, { backgroundColor: addDocType ? COLORS.navy : COLORS.midGray, flex: 1.4 }]}
              disabled={!addDocType}
              onPress={() => { setShowAddModal(false); resetAddModal(); }}
            >
              <Text style={{ color: COLORS.white, fontWeight: '700' }}>Upload as Draft</Text>
            </TouchableOpacity>
          </View>

        </View>
      </View>
    </Modal>
  );

  // ── Detail Modal ──
  const renderDetailModal = () => (
    <Modal
      visible={!!selectedTemplate}
      transparent
      animationType="fade"
      onRequestClose={() => setSelectedTemplate(null)}
    >
      <TouchableOpacity
        style={styles.modalOverlay}
        activeOpacity={1}
        onPress={() => setSelectedTemplate(null)}
      >
        <View style={styles.modalCard} onStartShouldSetResponder={() => true}>
          <Text style={styles.modalTitle}>{selectedTemplate?.name}</Text>
          <View style={{ marginBottom: 12 }}>
            <StatusBadge status={selectedTemplate?.status} />
          </View>
          <Text style={styles.modalLabel}>Category: <Text style={styles.modalValue}>{selectedTemplate?.category}</Text></Text>

          <View style={styles.actionRow}>
            <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#EAF0FB' }]}>
              <Text style={[styles.actionBtnText, { color: '#5B8DD9' }]}>↔ Replace</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#E8F7EE' }]}>
              <Text style={[styles.actionBtnText, { color: '#3AAA5C' }]}>→ Forward</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#FDF0E6' }]}>
              <Text style={[styles.actionBtnText, { color: '#E87A30' }]}>⬇ Download</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[styles.modalBtn, { backgroundColor: COLORS.lightGray, alignSelf: 'flex-end', marginTop: 8 }]}
            onPress={() => setSelectedTemplate(null)}
          >
            <Text style={{ color: COLORS.darkText, fontWeight: '600' }}>Close</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );

  // ── Replace Template Modal ──
  const toggleTemplateCheck = (id) => {
    setCheckedTemplates(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const checkedCount = Object.values(checkedTemplates).filter(Boolean).length;

  const renderReplaceModal = () => {
    const activeTemplates = templates.filter(t => t.status !== 'Archived');
    const checkedItems    = activeTemplates.filter(t => checkedTemplates[t.id]);
    const dropdownLabel   = checkedCount === 0
      ? 'Select templates…'
      : checkedItems.map(t => t.name).join(', ');

    return (
      <Modal
        visible={showReplaceModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowReplaceModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => { setShowReplaceModal(false); setDropdownOpen(false); }}
        >
          <View style={[styles.modalCard, { maxHeight: '90%' }]} onStartShouldSetResponder={() => true}>
            {/* Header */}
            <View style={styles.replaceModalHeader}>
              <Text style={styles.modalTitle}>Replace Template</Text>
              <TouchableOpacity onPress={() => { setShowReplaceModal(false); setDropdownOpen(false); }}>
                <Text style={styles.replaceCloseX}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <Text style={styles.replaceLabel}>Document Type</Text>

              {/* Trigger */}
              <TouchableOpacity
                style={[styles.dropdownTrigger, dropdownOpen && styles.dropdownTriggerOpen]}
                onPress={() => setDropdownOpen(v => !v)}
                activeOpacity={0.8}
              >
                <Text style={[styles.dropdownTriggerText, checkedCount === 0 && { color: COLORS.midGray }]} numberOfLines={1}>
                  {dropdownLabel}
                </Text>
                <Text style={styles.dropdownCaret}>{dropdownOpen ? '▲' : '▼'}</Text>
              </TouchableOpacity>

              {/* Checklist panel */}
              {dropdownOpen && (
                <View style={styles.checklistPanel}>
                  {activeTemplates.map((t, idx) => (
                    <View key={t.id}>
                      <TouchableOpacity
                        style={styles.checklistRow}
                        onPress={() => toggleTemplateCheck(t.id)}
                        activeOpacity={0.7}
                      >
                        <View style={[styles.checkbox, checkedTemplates[t.id] && styles.checkboxChecked]}>
                          {checkedTemplates[t.id] && <Text style={styles.checkmark}>✓</Text>}
                        </View>
                        <Text style={styles.checklistText} numberOfLines={2}>{t.name}</Text>
                      </TouchableOpacity>
                      {idx < activeTemplates.length - 1 && <View style={styles.checklistDivider} />}
                    </View>
                  ))}
                </View>
              )}

              {checkedCount > 0 && !dropdownOpen && (
                <Text style={styles.selectedCountText}>{checkedCount} template{checkedCount > 1 ? 's' : ''} selected</Text>
              )}

              {/* Upload slots */}
              {checkedItems.length > 0 && (
                <View style={{ marginTop: 16 }}>
                  {checkedItems.map(t => (
                    <View key={t.id} style={{ marginBottom: 14 }}>
                      <Text style={styles.replaceLabel}>{t.name}</Text>
                      <TouchableOpacity
                        style={[styles.uploadBox, uploadedFiles[t.id] && styles.uploadBoxDone]}
                        activeOpacity={0.75}
                        onPress={() => setUploadedFiles(prev => ({ ...prev, [t.id]: `${t.name}.docx` }))}
                      >
                        {uploadedFiles[t.id] ? (
                          <>
                            <Text style={styles.uploadDoneIcon}>✓</Text>
                            <Text style={styles.uploadDoneText} numberOfLines={1}>{uploadedFiles[t.id]}</Text>
                            <TouchableOpacity onPress={() => setUploadedFiles(prev => { const n = {...prev}; delete n[t.id]; return n; })}>
                              <Text style={styles.uploadRemove}>✕</Text>
                            </TouchableOpacity>
                          </>
                        ) : (
                          <>
                            <Text style={styles.uploadIcon}>⬆</Text>
                            <Text style={styles.uploadText}>Upload Here</Text>
                          </>
                        )}
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}

              {checkedItems.length === 0 && (
                <Text style={styles.replaceHint}>Select templates above to upload replacements.</Text>
              )}
            </ScrollView>

            {/* Footer */}
            <View style={[styles.modalRow, { marginTop: 16 }]}>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: COLORS.lightGray, flex: 1 }]}
                onPress={() => { setShowReplaceModal(false); setCheckedTemplates({}); setUploadedFiles({}); setDropdownOpen(false); }}
              >
                <Text style={{ color: COLORS.darkText, fontWeight: '600' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: checkedCount > 0 ? COLORS.navy : COLORS.midGray, flex: 1 }]}
                disabled={checkedCount === 0}
                onPress={() => {
                  const today = new Date().toISOString().slice(0, 10);
                  // Mark each replaced template as Old Version → auto-archive effect fires
                  // Then insert a new Active v+1 entry
                  setTemplates(prev => {
                    let next = [...prev];
                    Object.keys(checkedTemplates).forEach(id => {
                      if (!checkedTemplates[id]) return;
                      const idx = next.findIndex(t => t.id === id);
                      if (idx === -1) return;
                      const old = next[idx];
                      next[idx] = { ...old, status: 'Old Version' }; // triggers auto-archive
                      next.splice(idx + 1, 0, {
                        ...old,
                        id:        `${id}-v${old.version + 1}`,
                        version:   old.version + 1,
                        status:    'Active',
                        updatedAt: today,
                      });
                    });
                    return next;
                  });
                  setShowReplaceModal(false);
                  setCheckedTemplates({});
                  setUploadedFiles({});
                  setDropdownOpen(false);
                }}
              >
                <Text style={{ color: COLORS.white, fontWeight: '700' }}>Replace</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
    );
  };

  // ── Forward Template Modal ──
  const toggleForwardCheck = (id) => {
    setForwardChecked(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const forwardCheckedCount = Object.values(forwardChecked).filter(Boolean).length;

  const renderForwardModal = () => (
    <Modal
      visible={showForwardModal}
      transparent
      animationType="fade"
      onRequestClose={() => { setShowForwardModal(false); setForwardChecked({}); }}
    >
      <TouchableOpacity
        style={styles.modalOverlay}
        activeOpacity={1}
        onPress={() => { setShowForwardModal(false); setForwardChecked({}); }}
      >
        <View style={[styles.modalCard, { maxHeight: '90%' }]} onStartShouldSetResponder={() => true}>

          {/* Header */}
          <View style={styles.replaceModalHeader}>
            <Text style={styles.modalTitle}>Forward Templates</Text>
            <TouchableOpacity onPress={() => { setShowForwardModal(false); setForwardChecked({}); }}>
              <Text style={styles.replaceCloseX}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Select Template label */}
          <Text style={[styles.replaceLabel, { marginBottom: 10 }]}>Select Template</Text>

          {/* Checklist box */}
          <ScrollView showsVerticalScrollIndicator={false} style={{ marginBottom: 8 }}>
            <View style={styles.forwardChecklistBox}>
              {templates.filter(t => t.status !== 'Archived').map((t, idx, arr) => (
                <View key={t.id}>
                  <TouchableOpacity
                    style={styles.checklistRow}
                    onPress={() => toggleForwardCheck(t.id)}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.forwardCheckbox, forwardChecked[t.id] && styles.forwardCheckboxChecked]}>
                      {forwardChecked[t.id] && <Text style={styles.checkmark}>✓</Text>}
                    </View>
                    <Text style={styles.checklistText} numberOfLines={2}>{t.name}</Text>
                  </TouchableOpacity>
                  {idx < arr.length - 1 && <View style={styles.checklistDivider} />}
                </View>
              ))}
            </View>
          </ScrollView>

          {/* Footer */}
          <View style={[styles.modalRow, { marginTop: 12 }]}>
            <TouchableOpacity
              style={[styles.modalBtn, { backgroundColor: COLORS.lightGray, flex: 1 }]}
              onPress={() => { setShowForwardModal(false); setForwardChecked({}); }}
            >
              <Text style={{ color: COLORS.darkText, fontWeight: '600' }}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalBtn, {
                backgroundColor: forwardCheckedCount > 0 ? COLORS.navy : COLORS.midGray,
                flex: 1,
              }]}
              disabled={forwardCheckedCount === 0}
              onPress={() => { setShowForwardModal(false); setForwardChecked({}); }}
            >
              <Text style={{ color: COLORS.white, fontWeight: '700' }}>Forward</Text>
            </TouchableOpacity>
          </View>

        </View>
      </TouchableOpacity>
    </Modal>
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
          <Text style={styles.mobileTitle}>Templates</Text>
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

      {/* ── TEMPLATE CONTENT ── */}
      {/* Search + Filter Row + Action Buttons */}
      <View style={styles.searchFilterRow}>
        <View style={styles.searchBox}>
          <Text style={{ fontSize: 13, marginRight: 6 }}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Search templates…"
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

        {/* Status filter pills */}
        <View style={styles.filterPills}>
          {FILTER_OPTIONS.map(f => (
            <TouchableOpacity
              key={f}
              style={[styles.filterPill, activeFilter === f && styles.filterPillActive]}
              onPress={() => setActiveFilter(f)}
              activeOpacity={0.75}
            >
              <Text style={[styles.filterPillText, activeFilter === f && styles.filterPillTextActive]}>
                {f}
              </Text>
            </TouchableOpacity>
          ))}


          {/* Category Dropdown — uses Modal so it always renders above table */}
          <View style={{ position: 'relative', zIndex: 1000 }}>
            <TouchableOpacity
              ref={dropdownBtnRef}
              style={[styles.filterPill, styles.dropdownPill]}
              onPress={() => {
                dropdownBtnRef.current?.measure((fx, fy, w, h, px, py) => {
                  setDropdownPos({ top: py + h + 4, left: px });
                });
                setShowCategoryDropdown(v => !v);
              }}
              activeOpacity={0.75}
            >
              <Text style={styles.filterPillText}>
                {categoryFilter === 'All Categories' ? 'Template ▾' : `${categoryFilter} ▾`}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionButtonsContainer}>
          <TouchableOpacity style={styles.addBtn} onPress={() => setShowAddModal(true)} activeOpacity={0.8}>
            <Text style={styles.addBtnText}>+ Add</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.replaceBtn} activeOpacity={0.8} onPress={() => setShowReplaceModal(true)}>
            <Text style={styles.replaceBtnText}>↔ Replace</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.forwardBtn} activeOpacity={0.8} onPress={() => setShowForwardModal(true)}>
            <Text style={styles.forwardBtnText}>→ Forward</Text>
          </TouchableOpacity>
          {!isMobile && (
            <TouchableOpacity style={styles.archiveBtn} activeOpacity={0.8} onPress={() => setShowArchiveView(v => !v)}>
              <Text style={styles.archiveBtnText}>
                🗂 {showArchiveView ? 'Hide Archive' : `View Archive${archiveRecords.length > 0 ? ` (${archiveRecords.length})` : ''}`}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Mobile Archive toggle */}
      {isMobile && (
        <TouchableOpacity style={styles.mobileArchiveBtn} activeOpacity={0.75} onPress={() => setShowArchiveView(v => !v)}>
          <Text style={styles.mobileArchiveBtnText}>
            🗂 {showArchiveView ? 'Hide Archive' : `View Archive${archiveRecords.length > 0 ? ` (${archiveRecords.length})` : ''}`}
          </Text>
        </TouchableOpacity>
      )}

      {/* ── ARCHIVE VIEW ── */}
      {showArchiveView ? (
        <View style={styles.tableContainer}>
          {/* Archive header */}
          <View style={styles.archiveSectionHeader}>
            <Text style={styles.archiveSectionTitle}>Archives</Text>
            <View style={styles.archiveLockBadge}>
              <Text style={styles.archiveLockText}>🔒 Read-only • Cannot be used for new plans</Text>
            </View>
          </View>

          {archiveRecords.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No archived templates yet</Text>
            </View>
          ) : (
            archiveRecords.map((record, idx) => (
              <View key={record.id}>
                <TouchableOpacity
                  style={styles.archiveRow}
                  onPress={() => setExpandedArchiveId(prev => prev === record.id ? null : record.id)}
                  activeOpacity={0.75}
                >
                  <View style={styles.archiveRowMain}>
                    <Text style={styles.archiveRowName} numberOfLines={2}>{record.name}</Text>
                    <Text style={styles.archiveOldVersionText}>Old Version</Text>
                  </View>

                  {/* Expanded detail */}
                  {expandedArchiveId === record.id && (
                    <View style={styles.archiveExpandedDetail}>
                      <View style={styles.archiveDetailRow}>
                        <Text style={styles.archiveDetailLabel}>Version</Text>
                        <View style={styles.archiveVersionBadge}>
                          <Text style={styles.archiveVersionText}>v{record.version}</Text>
                        </View>
                      </View>
                      <View style={styles.archiveDetailRow}>
                        <Text style={styles.archiveDetailLabel}>Category</Text>
                        <Text style={styles.archiveDetailValue}>{record.category}</Text>
                      </View>
                      <View style={styles.archiveDetailRow}>
                        <Text style={styles.archiveDetailLabel}>Archived On</Text>
                        <Text style={styles.archiveDetailValue}>{record.archivedAt}</Text>
                      </View>
                      <View style={styles.archiveDetailRow}>
                        <Text style={styles.archiveDetailLabel}>Reason</Text>
                        <Text style={[styles.archiveDetailValue, { flex: 1, textAlign: 'right' }]}>{record.archivedReason}</Text>
                      </View>
                      <View style={[styles.archiveDetailRow, { gap: 8, marginTop: 8 }]}>
                        <TouchableOpacity style={styles.archiveActionBtn}>
                          <Text style={styles.archiveActionBtnText}>⬇ Download</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.archiveActionBtn, { backgroundColor: '#FDF0E6' }]}>
                          <Text style={[styles.archiveActionBtnText, { color: '#E87A30' }]}>👁 Preview</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}
                </TouchableOpacity>
                {idx < archiveRecords.length - 1 && <View style={styles.divider} />}
              </View>
            ))
          )}
        </View>
      ) : (
        /* ── TEMPLATE LIST ── */
        <View style={styles.tableContainer}>
          {/* Table Header */}
          <View style={styles.tableHeader}>
            <Text style={[styles.tableHeaderText, { flex: 1 }]}>List of Templates</Text>
            <Text style={[styles.tableHeaderText, { width: 100, textAlign: 'right' }]}>Status</Text>
          </View>

          {filteredTemplates.length > 0 ? (
            filteredTemplates.map((item, idx) => (
              <React.Fragment key={item.id}>
                <TemplateRow item={item} onPress={setSelectedTemplate} />
                {idx < filteredTemplates.length - 1 && <View style={styles.divider} />}
              </React.Fragment>
            ))
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No templates found</Text>
            </View>
          )}
        </View>
      )}
    </ScrollView>
  );

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.navy} />

      {renderCategoryDropdown()}
      {renderAddModal()}
      {renderDetailModal()}
      {renderReplaceModal()}
      {renderForwardModal()}

      <View style={styles.layout}>
        {/* Mobile Sidebar Overlay */}
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
    </SafeAreaView>
  );
}

// ─── STYLES ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: '#133E75' },
  layout: { flex: 1, flexDirection: 'row' },

  // ── Sidebar ──
  sidebar: {
    width: 250,
    backgroundColor: '#133E75',
    alignItems: 'center',
    paddingTop: 20, paddingBottom: 24, paddingHorizontal: 10,
    zIndex: 10,
  },
  sidebarOverlay: {
    position: 'absolute',
    left: 0, top: 0, bottom: 0, right: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    zIndex: 5,
  },
  logoPill: {
    width: 70, height: 70, borderRadius: 35,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 8, borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)',
  },
  logoCircle: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: COLORS.gold, alignItems: 'center', justifyContent: 'center',
  },
  logoText: { fontSize: 15, fontWeight: '900', color: '#133E75', letterSpacing: 0.5 },
  navItem: {
    width: '100%', paddingVertical: 12, paddingHorizontal: 12,
    borderRadius: 24, marginBottom: 8, alignItems: 'center',
    borderWidth: 1.5, borderColor: COLORS.white, backgroundColor: '#133E75',
  },
  navItemActive: { backgroundColor: '#ffffff', borderColor: '#000000' },
  navLabel: { fontSize: 13, fontWeight: '600', color: '#ffffff', letterSpacing: 0.3 },
  navLabelActive: { color: '#000000', fontWeight: '800' },
  logoutBtn: {
    width: '100%', paddingVertical: 12, paddingHorizontal: 12,
    borderRadius: 24, marginTop: 8, alignItems: 'center',
    borderWidth: 1.5, borderColor: COLORS.white,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  logoutText: { fontSize: 13, fontWeight: '600', color: '#ffffff', letterSpacing: 0.3 },

  // ── Main ──
  main: { flex: 1, backgroundColor: COLORS.offWhite, borderTopLeftRadius: 20 },
  mainMobile: { borderTopLeftRadius: 0 },
  mainContent: { padding: 20, paddingBottom: 40, overflow: 'visible' },

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

  // Search + Filter + Action Buttons
  searchFilterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 12,
    zIndex: 1000,
  },
  actionButtonsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginLeft: 'auto',
  },
  searchBox: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.white, borderRadius: 20,
    borderWidth: 1, borderColor: COLORS.lightGray,
    paddingHorizontal: 12, paddingVertical: 8,
    width: isMobile ? '100%' : 240,
  },
  searchInput: { flex: 1, fontSize: 13, color: COLORS.darkText },
  filterPills: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 6,
    alignItems: 'center', overflow: 'visible', zIndex: 1000,
  },
  filterPill: {
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 16, borderWidth: 1,
    borderColor: COLORS.lightGray, backgroundColor: COLORS.white,
  },
  filterPillActive: {
    backgroundColor: COLORS.navy, borderColor: COLORS.navy,
  },
  filterPillText: { fontSize: 12, fontWeight: '500', color: COLORS.darkText },
  filterPillTextActive: { color: COLORS.white, fontWeight: '700' },
  dropdownPill: { borderColor: COLORS.midGray },

  // Dropdown
  dropdown: {
    position: 'absolute',
    backgroundColor: COLORS.white, borderRadius: 10,
    borderWidth: 1, borderColor: COLORS.lightGray,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15, shadowRadius: 8, elevation: 20,
    zIndex: 9999, minWidth: 160,
  },
  dropdownItem: { paddingHorizontal: 14, paddingVertical: 10 },
  dropdownItemActive: { backgroundColor: COLORS.offWhite },
  dropdownItemText: { fontSize: 13, color: COLORS.darkText },
  dropdownItemTextActive: { fontWeight: '700', color: COLORS.navy },

  // Action Buttons
  addBtn: {
    paddingHorizontal: 14, paddingVertical: 7,
    backgroundColor: COLORS.navy, borderRadius: 8,
  },
  addBtnText: { color: COLORS.white, fontSize: 13, fontWeight: '700' },
  replaceBtn: {
    paddingHorizontal: 14, paddingVertical: 7,
    backgroundColor: COLORS.white, borderRadius: 8,
    borderWidth: 1, borderColor: COLORS.lightGray,
  },
  replaceBtnText: { color: COLORS.navy, fontSize: 13, fontWeight: '600' },
  forwardBtn: {
    paddingHorizontal: 14, paddingVertical: 7,
    backgroundColor: COLORS.white, borderRadius: 8,
    borderWidth: 1, borderColor: COLORS.lightGray,
  },
  forwardBtnText: { color: COLORS.navy, fontSize: 13, fontWeight: '600' },
  archiveBtn: {
    marginLeft: 'auto',
    paddingHorizontal: 14, paddingVertical: 7,
    backgroundColor: COLORS.white, borderRadius: 8,
    borderWidth: 1, borderColor: COLORS.lightGray,
  },
  archiveBtnText: { color: COLORS.subText, fontSize: 13, fontWeight: '600' },

  // Table
  tableContainer: {
    backgroundColor: COLORS.white,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.lightGray,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 1,
    zIndex: 1,
  },
  tableHeader: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 18, paddingVertical: 13,
    backgroundColor: COLORS.offWhite,
    borderBottomWidth: 1, borderBottomColor: COLORS.lightGray,
  },
  tableHeaderText: {
    fontSize: 13, fontWeight: '800', color: COLORS.darkText,
    letterSpacing: 0.2,
  },
  templateRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 18, paddingVertical: 16,
    gap: 12,
  },
  templateRowLeft: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12,
  },
  templateName: {
    flex: 1, fontSize: 13, color: COLORS.darkText,
    fontWeight: '500', lineHeight: 18,
  },
  divider: { height: 1, backgroundColor: COLORS.lightGray, marginHorizontal: 18 },

  // Status Badge
  statusBadge: {
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 12, width: 100, alignItems: 'center',
  },
  statusText: { fontSize: 12, fontWeight: '700' },

  // Empty state
  emptyState: { padding: 40, alignItems: 'center' },
  emptyText: { fontSize: 14, color: COLORS.midGray },

  // Mobile Archive button
  mobileArchiveBtn: {
    marginTop: 16, alignSelf: 'center',
    paddingHorizontal: 18, paddingVertical: 9,
    backgroundColor: COLORS.white, borderRadius: 10,
    borderWidth: 1, borderColor: COLORS.lightGray,
  },
  mobileArchiveBtnText: { color: COLORS.subText, fontSize: 13, fontWeight: '600' },

  // Modal
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center', alignItems: 'center', padding: 24,
  },
  modalCard: {
    backgroundColor: COLORS.white, borderRadius: 18,
    padding: 24, width: '100%', maxWidth: 420,
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18, shadowRadius: 20, elevation: 10,
  },
  modalTitle: {
    fontSize: 16, fontWeight: '800', color: COLORS.darkText,
    marginBottom: 16, lineHeight: 22,
  },
  modalInput: {
    borderWidth: 1, borderColor: COLORS.lightGray, borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 10,
    fontSize: 14, color: COLORS.darkText, marginBottom: 16,
    backgroundColor: COLORS.offWhite,
  },
  modalRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10 },
  modalBtn: {
    paddingHorizontal: 20, paddingVertical: 10,
    borderRadius: 10, alignItems: 'center',
  },
  modalLabel: { fontSize: 13, color: COLORS.subText, marginBottom: 16 },
  modalValue: { fontWeight: '700', color: COLORS.darkText },
  actionRow: { flexDirection: 'row', gap: 8, marginBottom: 8, flexWrap: 'wrap' },
  actionBtn: {
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 10, flex: 1, alignItems: 'center',
  },
  actionBtnText: { fontSize: 13, fontWeight: '700' },

  // Replace Modal
  replaceModalHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 16,
  },
  replaceCloseX: { fontSize: 18, color: COLORS.subText, padding: 4 },
  replaceLabel: {
    fontSize: 12, fontWeight: '700', color: COLORS.subText,
    textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6,
  },
  replaceHint: {
    fontSize: 13, color: COLORS.midGray, textAlign: 'center',
    marginTop: 12, fontStyle: 'italic',
  },
  // Dropdown trigger
  dropdownTrigger: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderWidth: 1.5, borderColor: COLORS.lightGray, borderRadius: 10,
    backgroundColor: COLORS.white, paddingHorizontal: 14, paddingVertical: 12,
  },
  dropdownTriggerOpen: {
    borderColor: COLORS.navy,
    borderBottomLeftRadius: 0, borderBottomRightRadius: 0,
    borderBottomWidth: 0,
  },
  dropdownTriggerText: { flex: 1, fontSize: 13, color: COLORS.darkText, marginRight: 8 },
  dropdownCaret: { fontSize: 11, color: COLORS.subText },
  selectedCountText: {
    fontSize: 12, color: COLORS.navy, fontWeight: '600',
    marginTop: 6, marginBottom: 2,
  },
  // Checklist panel (dropdown body)
  checklistPanel: {
    borderWidth: 1.5, borderTopWidth: 0, borderColor: COLORS.navy,
    borderBottomLeftRadius: 10, borderBottomRightRadius: 10,
    backgroundColor: COLORS.white, marginBottom: 4,
    overflow: 'hidden',
  },
  checklistRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 12, gap: 12,
  },
  checklistDivider: { height: 1, backgroundColor: COLORS.lightGray, marginHorizontal: 14 },
  checklistText: { flex: 1, fontSize: 13, color: COLORS.darkText, lineHeight: 18 },
  checkbox: {
    width: 20, height: 20, borderRadius: 5,
    borderWidth: 2, borderColor: COLORS.midGray,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: COLORS.white,
  },
  checkboxChecked: { backgroundColor: COLORS.navy, borderColor: COLORS.navy },
  checkmark: { fontSize: 12, color: COLORS.white, fontWeight: '900' },
  uploadBox: {
    borderWidth: 1.5, borderColor: '#BBC8E6', borderStyle: 'dashed',
    borderRadius: 10, backgroundColor: '#EEF2FB',
    paddingVertical: 18, paddingHorizontal: 14,
    alignItems: 'center', justifyContent: 'center',
    flexDirection: 'column', gap: 6,
  },
  uploadBoxDone: {
    borderStyle: 'solid', borderColor: '#3AAA5C',
    backgroundColor: '#E8F7EE', flexDirection: 'row',
    gap: 10, paddingVertical: 14,
  },
  uploadIcon: { fontSize: 22, color: COLORS.navy },
  uploadText: { fontSize: 14, color: COLORS.navy, fontWeight: '600' },
  uploadDoneIcon: { fontSize: 16, color: '#3AAA5C', fontWeight: '900' },
  uploadDoneText: { flex: 1, fontSize: 13, color: '#2E7D32', fontWeight: '600' },
  uploadRemove: { fontSize: 14, color: COLORS.subText, paddingHorizontal: 4 },

  // Add Modal specific
  addNameInput: {
    borderWidth: 1.5, borderColor: COLORS.lightGray, borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 11,
    fontSize: 13, color: COLORS.darkText,
    backgroundColor: COLORS.white,
  },
  addEntryBtn: {
    width: 36, height: 36, borderRadius: 8,
    backgroundColor: COLORS.navy, alignItems: 'center', justifyContent: 'center',
    shadowColor: COLORS.navy, shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3, shadowRadius: 4, elevation: 3,
  },
  addEntryBtnText: { fontSize: 20, color: COLORS.white, fontWeight: '700', lineHeight: 24 },

  // Forward Modal
  forwardChecklistBox: {
    borderWidth: 1, borderColor: COLORS.lightGray,
    borderRadius: 10, backgroundColor: COLORS.white,
    overflow: 'hidden',
  },
  forwardCheckbox: {
    width: 20, height: 20, borderRadius: 4,
    borderWidth: 2, borderColor: COLORS.midGray,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: COLORS.white,
  },
  forwardCheckboxChecked: {
    backgroundColor: COLORS.navy, borderColor: COLORS.navy,
  },

  // ── Archive View ──
  archiveSectionHeader: {
    paddingHorizontal: 18, paddingTop: 16, paddingBottom: 10,
    borderBottomWidth: 1, borderBottomColor: COLORS.lightGray,
    backgroundColor: COLORS.offWhite,
    borderTopLeftRadius: 14, borderTopRightRadius: 14,
  },
  archiveSectionTitle: {
    fontSize: 15, fontWeight: '800', color: COLORS.darkText, marginBottom: 6,
  },
  archiveLockBadge: {
    backgroundColor: '#FFF8E1', borderRadius: 6, borderWidth: 1,
    borderColor: '#F9C74F', paddingHorizontal: 10, paddingVertical: 5,
    alignSelf: 'flex-start',
  },
  archiveLockText: { fontSize: 11, color: '#7A5800', fontWeight: '600' },
  archiveRow: {
    paddingHorizontal: 18, paddingVertical: 16,
  },
  archiveRowMain: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12,
  },
  archiveRowName: {
    flex: 1, fontSize: 13, color: COLORS.darkText, fontWeight: '500', lineHeight: 18,
  },
  archiveOldVersionText: {
    fontSize: 12, fontWeight: '700', color: '#B71C1C',
  },
  archiveExpandedDetail: {
    marginTop: 12, paddingTop: 12,
    borderTopWidth: 1, borderTopColor: COLORS.lightGray,
  },
  archiveDetailRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: 8,
  },
  archiveDetailLabel: { fontSize: 12, color: COLORS.subText, fontWeight: '600' },
  archiveDetailValue: { fontSize: 12, color: COLORS.darkText, fontWeight: '500' },
  archiveVersionBadge: {
    backgroundColor: '#EFEBE9', borderRadius: 6,
    paddingHorizontal: 8, paddingVertical: 3,
    borderWidth: 1, borderColor: '#BCAAA4',
  },
  archiveVersionText: { fontSize: 11, fontWeight: '800', color: '#6D4C41' },
  archiveActionBtn: {
    flex: 1, paddingVertical: 8, borderRadius: 8,
    backgroundColor: '#EEF2FB', alignItems: 'center',
  },
  archiveActionBtnText: { fontSize: 12, fontWeight: '700', color: '#5B8DD9' },
});