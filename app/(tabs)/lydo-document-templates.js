
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Linking,
  Modal,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { useRouter } from 'expo-router';
import { useNav } from './navContext';
import Sidebar, { LYDO_NAV_ITEMS } from './../components/Sidebar';
import { useAuth } from './authContext';
import { supabase } from '../../utils/supabase';
import * as DocumentPicker from 'expo-document-picker';
import { useLydoNotificationCenter, LydoNotificationModal, LydoBellIcon } from './notificationCenter';

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
const DOCUMENT_TABS = ['Barangay Folders', 'Reports', 'Templates'];

// ─── TEMPLATE STATUS ──────────────────────────────────────────────────────────
const STATUS_COLORS = {
  Active:      { text: '#2E7D32', bg: '#E8F5E9' },
  Draft:       { text: '#1565C0', bg: '#E3F2FD' },
  'Old Version': { text: '#B71C1C', bg: '#FFEBEE' },
  Archived:    { text: '#6D4C41', bg: '#EFEBE9' },
};

const FILTER_OPTIONS = ['All', 'Currently in use'];

// Category options for Add modal dropdown - will be fetched from database
// (Now uses state inside component - see LYDODocumentTemplatesScreen component)

// Document types grouped by category — will be fetched from database
// (Now uses state inside component - see LYDODocumentTemplatesScreen component)


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
  const { logout, user: authUser } = useAuth();

  const [searchText, setSearchText]             = useState('');
  const [activeFilter, setActiveFilter]         = useState('All');
  const [categoryFilter, setCategoryFilter]     = useState('All Categories');
  const notif = useLydoNotificationCenter();
  const [sidebarVisible, setSidebarVisible]     = useState(false);
  const [activeDocumentTab, setActiveDocumentTab] = useState('Templates');
  const [loading, setLoading]                   = useState(true);
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [dropdownPos, setDropdownPos]                   = useState({ top: 0, left: 0 });
  const dropdownBtnRef                                  = useRef(null);
  const [showAddModal, setShowAddModal]         = useState(false);
  const [addDocType, setAddDocType]             = useState('');
  const [addCategory, setAddCategory]           = useState('');
  const [addDocTypeOpen, setAddDocTypeOpen]     = useState(false);
  const [addEntries, setAddEntries]             = useState([{ id: 1, name: '', file: null, docType: '', docCategory: '', docTypeOpen: false }]);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [showReplaceModal, setShowReplaceModal] = useState(false);
  const [selectedReplaceTemplate, setSelectedReplaceTemplate] = useState(null);
  const [uploadedFiles, setUploadedFiles]       = useState({});
  const [showForwardModal, setShowForwardModal] = useState(false);
  const [forwardChecked, setForwardChecked]     = useState({});
  const [uploading, setUploading]               = useState(false);
  const [loadingMessage, setLoadingMessage]     = useState('');
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successDetails, setSuccessDetails]     = useState({ replacedName: '', newVersion: 0, forwardedTo: '' });

  // ── Dynamic template + archive state ──
  const [templates, setTemplates]           = useState([]);
  const [archiveRecords, setArchiveRecords] = useState([]);
  const [distributions, setDistributions]   = useState([]);
  const [showArchiveView, setShowArchiveView] = useState(false);
  const [expandedArchiveId, setExpandedArchiveId] = useState(null);

  // Category and document type state
  const [categoryOptions, setCategoryOptions] = useState([
    { id: 1, name: 'Planning' },
    { id: 2, name: 'Financial' },
    { id: 3, name: 'Governance' },
    { id: 4, name: 'Performance' },
  ]);
  const [documentTypes, setDocumentTypes] = useState([]);
  const [categoryFilters, setCategoryFilters] = useState(['All Categories']);

  // Barangay state for forward modal
  const [barangays, setBarangays] = useState([]);
  const [selectedBarangays, setSelectedBarangays] = useState([]);
  const [showBarangayDropdown, setShowBarangayDropdown] = useState(false);
  const [forwardToAll, setForwardToAll] = useState(true);

  // Helper function to log LYDO activity
  const logActivity = async (action, description) => {
    try {
      await supabase.from('lydo_activity_logs').insert({
        action,
        description,
        user_id: authUser?.userId || null,
      });
    } catch (err) {
      console.error('Failed to log activity:', err);
    }
  };

  const [currentTime, setCurrentTime] = useState('');

  const today = new Date().toLocaleDateString('en-PH', {
    timeZone: 'Asia/Manila', month: 'long', day: 'numeric', year: 'numeric',
  });

  useEffect(() => { setActiveTab('Documents'); }, []);

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

  // Fetch categories and document types from database
  useEffect(() => {
    const fetchDocTypes = async () => {
      const [catRes, typeRes, brgyRes] = await Promise.all([
        supabase.from('document_category').select('id, document_category').order('id'),
        supabase.from('document_types').select('id, document_type, category').order('document_type'),
        supabase.from('barangays').select('barangay_id, barangay_name').order('barangay_name'),
      ]);

      if (catRes.data) {
        setCategoryOptions(catRes.data.map(c => ({ id: c.id, name: c.document_category })));
        // Build category filters from database (use id as filter value)
        setCategoryFilters(['All Categories', ...catRes.data.map(c => c.id.toString())]);
      }

      if (typeRes.data) {
        // Group document types by category
        const grouped = {};
        typeRes.data.forEach(dt => {
          const catId = dt.category;
          if (!grouped[catId]) {
            grouped[catId] = { categoryId: catId, types: [] };
          }
          grouped[catId].types.push(dt.document_type.trim());
        });
        setDocumentTypes(Object.values(grouped));
      }

      if (brgyRes.data) {
        setBarangays(brgyRes.data);
      }
    };
    fetchDocTypes();
  }, []);

  // Fetch templates and distributions from database
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);

        // Fetch templates
        const { data: templateData, error: templateError } = await supabase
          .from('templates')
          .select(`
            template_id,
            title,
            description,
            file_url,
            version,
            status,
            template_category,
            document_type,
            created_at,
            replaces_id,
            uploaded_by
          `)
          .order('created_at', { ascending: false });

        if (!templateError && templateData) {
          const activeTemplates = templateData
            .filter(t => t.status !== 'archived')
            .map(t => ({
              id: t.template_id.toString(),
              name: t.title,
              status: t.status === 'active' ? 'Active' : t.status === 'draft' ? 'Draft' : 'Archived',
              category: t.template_category,
              documentType: t.document_type,
              version: t.version || 1,
              updatedAt: t.created_at ? new Date(t.created_at).toISOString().slice(0, 10) : '',
              replacesId: t.replaces_id,
              fileUrl: t.file_url,
            }));
          setTemplates(activeTemplates);

          const archivedTemplates = templateData
            .filter(t => t.status === 'archived')
            .map(t => ({
              id: `arch-${t.template_id}`,
              templateId: t.template_id.toString(),
              name: t.title,
              version: t.version || 1,
              archivedAt: t.created_at ? new Date(t.created_at).toISOString().slice(0, 10) : '',
              archivedReason: 'Replaced by newer version',
              category: t.template_category,
            }));
          setArchiveRecords(archivedTemplates);
        }

        // Fetch template distributions
        const { data: distData, error: distError } = await supabase
          .from('template_distributions')
          .select(`
            distribution_id,
            template_id,
            barangay_id,
            distributed_by,
            is_acknowledged,
            distributed_at,
            acknowledged_at
          `);

        if (!distError && distData) {
          setDistributions(distData);
        }
      } catch (error) {
        console.error('Error fetching templates:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

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
    // Category matching - check if filter ID matches template's category name or ID
    const matchesCategory = categoryFilter === 'All Categories' || (() => {
      if (!t.category) return false;
      const selectedCategory = categoryOptions.find(c => c.id.toString() === categoryFilter);
      return selectedCategory && t.category.toLowerCase() === selectedCategory.name.toLowerCase();
    })();
    return matchesSearch && matchesFilter && matchesCategory;
  });

  // ── Helper to get display category ──
  const getDisplayCategory = (cat) => {
    // If it's already a string name, return it
    if (typeof cat === 'string' && !cat.match(/^\d+$/)) {
      return cat;
    }
    // Otherwise, try to find by id
    return categoryOptions.find(c => c.id.toString() === cat?.toString())?.name || cat;
  };

  // ── Navigation helpers ──
  const handleNav = (tab) => {
    setActiveTab(tab);
    setSidebarVisible(false);
    if (tab === 'Dashboard') router.push('/(tabs)/lydo-dashboard');
    else if (tab === 'Documents') router.push('/(tabs)/lydo-document');
    else if (tab === 'Monitor') router.push('/(tabs)/lydo-monitor');
    else if (tab === 'Barangay') router.push('/(tabs)/lydo-accounts');
    else if (tab === 'Logs') router.push('/(tabs)/lydo-logs');
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
        {categoryFilters.map(cat => (
          <TouchableOpacity
            key={cat}
            style={[styles.dropdownItem, categoryFilter === cat && styles.dropdownItemActive]}
            onPress={() => { setCategoryFilter(cat); setShowCategoryDropdown(false); }}
          >
            <Text style={[styles.dropdownItemText, categoryFilter === cat && styles.dropdownItemTextActive]}>
              {cat === 'All Categories' ? cat : categoryOptions.find(c => c.id.toString() === cat)?.name || cat}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </Modal>
  );

  // ── Add Template Modal ──

  const resetAddModal = () => {
    setAddDocType('');
    setAddCategory('');
    setAddDocTypeOpen(false);
    setAddEntries([{ id: Date.now(), name: '', file: null, docType: '', docCategory: '', docTypeOpen: false }]);
    setUploading(false);
  };

  // File picker function
  const pickDocument = async (entryId) => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
        copyToCacheDirectory: true,
      });

      if (result.canceled) {
        return;
      }

      const file = result.assets[0];
      console.log('File picked:', file.name, file.uri, file.mimeType);
      setAddEntries(prev => prev.map(e =>
        e.id === entryId ? { ...e, file: { uri: file.uri, name: file.name, type: file.mimeType || 'application/octet-stream' } } : e
      ));
    } catch (error) {
      console.error('Error picking document:', error);
      Alert.alert('Error', 'Failed to pick document');
    }
  };

  // Upload file to Supabase storage
  const uploadFileToStorage = async (file, templateTitle) => {
    if (!file || !file.uri) {
      console.log('No file to upload');
      return '';
    }

    try {
      const sanitizedName = file.name.replace(/[^\w\s.-]/g, '').replace(/\s+/g, '_');
      const fileName = `${Date.now()}_${sanitizedName}`;

      console.log('Uploading file:', file.name);
      console.log('File URI:', file.uri);

      const response = await fetch(file.uri);
      const blob = await response.blob();

      console.log('Uploading to bucket: templates, size:', blob.size);

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('templates')
        .upload(fileName, blob, {
          contentType: file.type || 'application/octet-stream',
        });

      if (uploadError) {
        console.error('Upload error:', uploadError);
        Alert.alert('Upload Error', uploadError.message);
        return '';
      }

      console.log('Upload success:', uploadData);

      const { data: urlData } = supabase.storage
        .from('templates')
        .getPublicUrl(fileName);

      console.log('File URL:', urlData.publicUrl);
      return urlData.publicUrl;
    } catch (error) {
      console.error('Error uploading file:', error);
      Alert.alert('Error', 'Failed to upload file');
      return '';
    }
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

            {/* Entries */}
            {addEntries.map((entry, idx) => (
              <View key={entry.id} style={idx > 0 ? { marginTop: 16 } : { marginTop: 4 }}>

                {/* Divider for additional entries */}
                {idx > 0 && (
                  <View style={{ height: 1, backgroundColor: COLORS.lightGray, marginBottom: 14 }} />
                )}

                {/* Document Type per entry */}
                <Text style={styles.replaceLabel}>Document Type</Text>
                <TouchableOpacity
                  style={[styles.dropdownTrigger, entry.docTypeOpen && styles.dropdownTriggerOpen]}
                  onPress={() =>
                    setAddEntries(prev => prev.map(e =>
                      e.id === entry.id
                        ? { ...e, docTypeOpen: !e.docTypeOpen }
                        : { ...e, docTypeOpen: false }
                    ))
                  }
                  activeOpacity={0.8}
                >
                  <Text style={[styles.dropdownTriggerText, !entry.docType && { color: COLORS.midGray }]} numberOfLines={1}>
                    {entry.docType || 'Select document type…'}
                  </Text>
                  <Text style={styles.dropdownCaret}>{entry.docTypeOpen ? '▲' : '▼'}</Text>
                </TouchableOpacity>

                {/* Auto-filled category badge */}
                {entry.docCategory !== '' && !entry.docTypeOpen && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6, marginBottom: 2 }}>
                    <Text style={{ fontSize: 11, color: COLORS.subText }}>Category:</Text>
                    <View style={{
                      backgroundColor: '#EEF2FB', borderRadius: 6,
                      paddingHorizontal: 8, paddingVertical: 3,
                      borderWidth: 1, borderColor: '#BBC8E6',
                    }}>
                      <Text style={{ fontSize: 11, fontWeight: '700', color: COLORS.navy }}>
                        {categoryOptions.find(c => c.id.toString() === entry.docCategory?.toString())?.name || entry.docCategory}
                      </Text>
                    </View>
                  </View>
                )}

                {entry.docTypeOpen && (
                  <View style={[styles.checklistPanel, { maxHeight: 220 }]}>
                    <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" nestedScrollEnabled={true}>
                      {(() => {
                        // Exclude document types already picked by another row in this modal,
                        // AND exclude document types that already have an existing (non-archived)
                        // template in the system — those must go through "Replace" instead.
                        const takenByOtherEntries = new Set(
                          addEntries.filter(e => e.id !== entry.id && e.docType).map(e => e.docType)
                        );
                        const existingDocTypes = new Set(
                          templates.filter(t => t.status !== 'Archived').map(t => t.documentType)
                        );
                        const available = documentTypes.flatMap(g =>
                          g.types.map(t => ({ docType: t, categoryId: g.categoryId }))
                        ).filter(item => !takenByOtherEntries.has(item.docType) && !existingDocTypes.has(item.docType));

                        if (available.length === 0) {
                          return (
                            <View style={{ padding: 16, alignItems: 'center' }}>
                              <Text style={{ fontSize: 13, color: COLORS.midGray }}>No document types available</Text>
                            </View>
                          );
                        }
                        return available.map((item, i) => (
                          <View key={item.docType}>
                            <TouchableOpacity
                              style={styles.checklistRow}
                              onPress={() =>
                                setAddEntries(prev => prev.map(e =>
                                  e.id === entry.id
                                    ? { ...e, docType: item.docType, docCategory: item.categoryId, docTypeOpen: false }
                                    : e
                                ))
                              }
                              activeOpacity={0.7}
                            >
                              <View style={[styles.checkbox, entry.docType === item.docType && styles.checkboxChecked]}>
                                {entry.docType === item.docType && <Text style={styles.checkmark}>✓</Text>}
                              </View>
                              <Text style={styles.checklistText} numberOfLines={2}>{item.docType}</Text>
                            </TouchableOpacity>
                            {i < available.length - 1 && <View style={styles.checklistDivider} />}
                          </View>
                        ));
                      })()}
                    </ScrollView>
                  </View>
                )}

                {/* Template Name */}
                <Text style={[styles.replaceLabel, { marginTop: 10 }]}>Template Name</Text>
                <TextInput
                  style={styles.addNameInput}
                  placeholder="Template name…"
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
                  onPress={() => pickDocument(entry.id)}
                >
                  {entry.file ? (
                    <>
                      <Text style={styles.uploadDoneIcon}>✓</Text>
                      <Text style={styles.uploadDoneText} numberOfLines={1}>{entry.file.name}</Text>
                      <TouchableOpacity onPress={() =>
                        setAddEntries(prev => prev.map(e => e.id === entry.id ? { ...e, file: null } : e))
                      }>
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

            {/* + Add another entry button */}
            <View style={{ alignItems: 'flex-end', marginTop: 12 }}>
              <TouchableOpacity
                style={styles.addEntryBtn}
                onPress={() => setAddEntries(prev => [...prev, { id: Date.now(), name: '', file: null, docType: '', docCategory: '', docTypeOpen: false }])}
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
              style={[styles.modalBtn, { backgroundColor: (addEntries[0]?.docType && addEntries[0]?.name && !uploading) ? COLORS.navy : COLORS.midGray, flex: 1.4 }]}
              disabled={!addEntries[0]?.docType || !addEntries[0]?.name || uploading}
              onPress={async () => {
                let resultMsg = null;
                let isSuccess = false;
                try {
                  setLoadingMessage('Uploading template…');
                  setUploading(true);
                  setShowAddModal(false);

                  if (!authUser?.userId) {
                    throw new Error('You must be logged in to create a template');
                  }

                  const lydoUserId = authUser.userId;
                  const allowedCategories = ['planning', 'financial', 'governance', 'performance'];

                  // Allow all document types - duplicates are allowed for versioning
                  const insertRows = [];
                  for (const entry of addEntries) {
                    if (!entry.name || !entry.docType) continue;
                    let fileUrl = '';
                    if (entry.file?.uri) {
                      fileUrl = await uploadFileToStorage(entry.file, entry.name);
                    }
                    // Convert category ID to category name
                    const catId = entry.docCategory;
                    const catObj = categoryOptions.find(c => c.id === catId);
                    const categoryValue = catObj?.name?.toLowerCase() || 'planning';
                    if (!allowedCategories.includes(categoryValue)) {
                      throw new Error('Invalid category for "' + entry.name + '"');
                    }
                    insertRows.push({
                      title: entry.name.trim(),
                      description: '',
                      file_url: fileUrl || 'no_file_attached',
                      status: 'active',
                      template_category: categoryValue,
                      document_type: entry.docType,
                      uploaded_by: lydoUserId,
                      version: 1,
                    });
                  }

                  const { error: insertError, data: insertedData } = await supabase
                    .from('templates')
                    .insert(insertRows)
                    .select();

                  if (insertError) throw new Error('Failed to create template: ' + insertError.message);

                  const { data: newData } = await supabase
                    .from('templates')
                    .select('*')
                    .order('created_at', { ascending: false });

                  if (newData) {
                    setTemplates(newData
                      .filter(t => t.status !== 'archived')
                      .map(t => ({
                        id: t.template_id.toString(),
                        name: t.title,
                        status: t.status === 'active' ? 'Active' : t.status === 'draft' ? 'Draft' : 'Archived',
                        category: t.template_category,
                        documentType: t.document_type,
                        version: t.version || 1,
                        updatedAt: t.created_at ? new Date(t.created_at).toISOString().slice(0, 10) : '',
                        fileUrl: t.file_url,
                      })));
                  }

                  isSuccess = true;
                  // Log the add template activity
                  const templateNames = insertRows.map(r => r.title).join(', ');
                  await logActivity('Add template', `Added template(s): ${templateNames}`);
                  resultMsg = `${insertRows.length} template${insertRows.length > 1 ? 's' : ''} created successfully!`;
                } catch (err) {
                  console.error('Error creating template:', err);
                  isSuccess = false;
                  resultMsg = err.message || 'Failed to create template';
                } finally {
                  resetAddModal();
                  setUploading(false);
                  setTimeout(() => {
                    Alert.alert(isSuccess ? 'Success' : 'Error', resultMsg);
                  }, 500);
                }
              }}
            >
              <Text style={{ color: COLORS.white, fontWeight: '700' }}>{uploading ? 'Uploading...' : 'Upload'}</Text>
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
          <View style={styles.replaceModalHeader}>
            <View style={styles.replaceHeaderLeft}>
              <View style={styles.replaceHeaderIconCircle}>
                <Text style={styles.replaceHeaderIconText}>📄</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.modalTitle, { marginBottom: 2 }]} numberOfLines={2}>{selectedTemplate?.name}</Text>
                <Text style={styles.replaceHeaderSubtitle}>{getDisplayCategory(selectedTemplate?.category)}</Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.replaceCloseBtn}
              onPress={() => setSelectedTemplate(null)}
            >
              <Text style={styles.replaceCloseX}>✕</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.replaceLabelRow}>
            <Text style={styles.replaceLabel}>Status</Text>
          </View>
          <View style={{ marginBottom: 4 }}>
            <StatusBadge status={selectedTemplate?.status} />
          </View>

          <View style={styles.actionRow}>
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: '#EAF0FB' }]}
              onPress={() => {
                // Pre-select this template for replacement
                if (selectedTemplate) {
                  setSelectedReplaceTemplate(selectedTemplate.id);
                }
                setShowReplaceModal(true);
                setSelectedTemplate(null);
              }}
            >
              <Text style={[styles.actionBtnText, { color: '#5B8DD9' }]}>↔ Replace</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: '#E8F7EE' }]}
              onPress={() => {
                setShowForwardModal(true);
                // Pre-select this template
                if (selectedTemplate) {
                  setForwardChecked(prev => ({ ...prev, [selectedTemplate.id]: true }));
                }
                setSelectedTemplate(null);
              }}
            >
              <Text style={[styles.actionBtnText, { color: '#3AAA5C' }]}>→ Forward</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: '#FDF0E6' }]}
              onPress={async () => {
                const url = selectedTemplate?.fileUrl;
                if (!url || url === 'no_file_attached') {
                  Alert.alert('No File', 'This template has no file attached.');
                  return;
                }
                try {
                  const supported = await Linking.canOpenURL(url);
                  if (supported) {
                    await Linking.openURL(url);
                  } else {
                    Alert.alert('Error', 'Unable to open this file URL.');
                  }
                } catch (err) {
                  Alert.alert('Error', 'Failed to open file: ' + err.message);
                }
              }}
            >
              <Text style={[styles.actionBtnText, { color: '#E87A30' }]}>⬇ Download</Text>
            </TouchableOpacity>
          </View>

          <View style={[styles.modalRow, styles.replaceFooter]}>
            <TouchableOpacity
              style={[styles.modalBtn, styles.replaceCancelBtn, { flex: 1 }]}
              onPress={() => setSelectedTemplate(null)}
            >
              <Text style={{ color: COLORS.darkText, fontWeight: '700' }}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    </Modal>
  );

  // ── Replace Template Modal ──

  const renderReplaceModal = () => {
    const activeTemplates = templates.filter(t => t.status !== 'Archived');
    const selectedTemplate = activeTemplates.find(t => t.id === selectedReplaceTemplate);

    return (
      <Modal
        visible={showReplaceModal}
        transparent
        animationType="fade"
        onRequestClose={() => { setShowReplaceModal(false); setSelectedReplaceTemplate(null); setUploadedFiles({}); }}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => { setShowReplaceModal(false); setSelectedReplaceTemplate(null); setUploadedFiles({}); }}
        >
          <View style={[styles.modalCard, { maxHeight: '90%' }]} onStartShouldSetResponder={() => true}>
            {/* Header */}
            <View style={styles.replaceModalHeader}>
              <View style={styles.replaceHeaderLeft}>
                <View style={styles.replaceHeaderIconCircle}>
                  <Text style={styles.replaceHeaderIconText}>↔</Text>
                </View>
                <View>
                  <Text style={[styles.modalTitle, { marginBottom: 2 }]}>Replace Template</Text>
                  <Text style={styles.replaceHeaderSubtitle}>Swap in a newer version of an existing template</Text>
                </View>
              </View>
              <TouchableOpacity
                style={styles.replaceCloseBtn}
                onPress={() => { setShowReplaceModal(false); setSelectedReplaceTemplate(null); setUploadedFiles({}); }}
              >
                <Text style={styles.replaceCloseX}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <View style={styles.replaceLabelRow}>
                <Text style={styles.replaceLabel}>Select Template to Replace</Text>
                <Text style={styles.replaceCountBadge}>{activeTemplates.length} available</Text>
              </View>

              {/* Single selection list */}
              <View style={styles.replaceTemplateList}>
                {activeTemplates.map((t) => {
                  const selected = selectedReplaceTemplate === t.id;
                  return (
                    <TouchableOpacity
                      key={t.id}
                      style={[styles.replaceTemplateItem, selected && styles.replaceTemplateItemSelected]}
                      onPress={() => { setSelectedReplaceTemplate(t.id); setUploadedFiles({}); }}
                      activeOpacity={0.7}
                    >
                      <View style={[styles.radioCircle, selected && styles.radioCircleChecked]}>
                        {selected && <View style={styles.radioInner} />}
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text
                          style={[styles.replaceTemplateName, selected && styles.replaceTemplateNameSelected]}
                          numberOfLines={2}
                        >
                          {t.name}
                        </Text>
                        <View style={styles.replaceTemplateMetaRow}>
                          <View style={[styles.replaceVersionBadge, selected && styles.replaceVersionBadgeSelected]}>
                            <Text style={[styles.replaceVersionBadgeText, selected && styles.replaceVersionBadgeTextSelected]}>
                              v{t.version || 1}
                            </Text>
                          </View>
                          <Text style={styles.replaceTemplateCategory} numberOfLines={1}>
                            {t.category || 'Uncategorized'}
                          </Text>
                        </View>
                      </View>
                      {selected && (
                        <View style={styles.replaceSelectedCheck}>
                          <Text style={styles.replaceSelectedCheckText}>✓</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Upload slot for selected template */}
              {selectedTemplate && (
                <View style={styles.replaceUploadSection}>
                  <Text style={styles.replaceLabel}>Replace: {selectedTemplate.name}</Text>
                  <TouchableOpacity
                    style={[styles.uploadBox, uploadedFiles[selectedTemplate.id] && styles.uploadBoxDone]}
                    activeOpacity={0.75}
                    onPress={async () => {
                      try {
                        const result = await DocumentPicker.getDocumentAsync({
                          type: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
                          copyToCacheDirectory: true,
                        });
                        if (!result.canceled) {
                          const file = result.assets[0];
                          setUploadedFiles({
                            [selectedTemplate.id]: { uri: file.uri, name: file.name, type: file.mimeType || 'application/octet-stream' },
                          });
                        }
                      } catch (err) {
                        Alert.alert('Error', 'Failed to pick file');
                      }
                    }}
                  >
                    {uploadedFiles[selectedTemplate.id] ? (
                      <>
                        <Text style={styles.uploadDoneIcon}>✓</Text>
                        <Text style={styles.uploadDoneText} numberOfLines={1}>{uploadedFiles[selectedTemplate.id].name}</Text>
                        <TouchableOpacity onPress={() => setUploadedFiles({})}>
                          <Text style={styles.uploadRemove}>✕</Text>
                        </TouchableOpacity>
                      </>
                    ) : (
                      <>
                        <Text style={styles.uploadIcon}>⬆</Text>
                        <Text style={styles.uploadText}>Upload New Version</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              )}

              {!selectedTemplate && (
                <View style={styles.replaceHintBox}>
                  <Text style={styles.replaceHintIcon}>ⓘ</Text>
                  <Text style={styles.replaceHint}>Select a template above to replace.</Text>
                </View>
              )}
            </ScrollView>

            {/* Footer */}
            <View style={[styles.modalRow, styles.replaceFooter]}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.replaceCancelBtn, { flex: 1 }]}
                onPress={() => { setShowReplaceModal(false); setSelectedReplaceTemplate(null); setUploadedFiles({}); }}
                activeOpacity={0.8}
              >
                <Text style={{ color: COLORS.darkText, fontWeight: '600' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modalBtn,
                  styles.replaceConfirmBtn,
                  { backgroundColor: (selectedReplaceTemplate && uploadedFiles[selectedReplaceTemplate] && !uploading) ? COLORS.navy : COLORS.midGray, flex: 1 },
                ]}
                activeOpacity={0.85}
                disabled={!selectedReplaceTemplate || !uploadedFiles[selectedReplaceTemplate] || uploading}
                onPress={async () => {
                  let resultMsg = null;
                  let isSuccess = false;
                  try {
                    if (!authUser?.userId) {
                      throw new Error('You must be logged in to replace templates');
                    }
                    const lydoUserId = authUser.userId;
                    setLoadingMessage('Replacing template…');
                    setUploading(true);
                    setShowReplaceModal(false);

                    const templateId = selectedReplaceTemplate;
                    const currentTemplate = templates.find(t => t.id === templateId);
                    if (!currentTemplate) {
                      throw new Error('Template not found');
                    }

                    let fileUrl = currentTemplate.fileUrl || 'no_file_attached';
                    if (uploadedFiles[templateId]?.uri) {
                      const uploaded = await uploadFileToStorage(uploadedFiles[templateId], currentTemplate.name);
                      if (uploaded) fileUrl = uploaded;
                    }

                    // Archive the old template
                    await supabase
                      .from('templates')
                      .update({ status: 'archived' })
                      .eq('template_id', parseInt(templateId));

                    // Insert new version
                    await supabase.from('templates').insert({
                      title: currentTemplate.name,
                      description: '',
                      file_url: fileUrl,
                      status: 'active',
                      template_category: currentTemplate.category,
                      document_type: currentTemplate.documentType,
                      uploaded_by: lydoUserId,
                      version: (currentTemplate.version || 1) + 1,
                      replaces_id: parseInt(templateId),
                    });

                    const { data: newData } = await supabase
                      .from('templates')
                      .select('*')
                      .order('created_at', { ascending: false });

                    if (newData) {
                      setTemplates(newData
                        .filter(t => t.status !== 'archived')
                        .map(t => ({
                          id: t.template_id.toString(),
                          name: t.title,
                          status: t.status === 'active' ? 'Active' : t.status === 'draft' ? 'Draft' : 'Archived',
                          category: t.template_category,
                          documentType: t.document_type,
                          version: t.version || 1,
                          updatedAt: t.created_at ? new Date(t.created_at).toISOString().slice(0, 10) : '',
                          fileUrl: t.file_url,
                        })));

                      setArchiveRecords(newData
                        .filter(t => t.status === 'archived')
                        .map(t => ({
                          id: `arch-${t.template_id}`,
                          templateId: t.template_id.toString(),
                          name: t.title,
                          version: t.version || 1,
                          archivedAt: t.created_at ? new Date(t.created_at).toISOString().slice(0, 10) : '',
                          archivedReason: 'Replaced by newer version',
                          category: t.template_category,
                        })));
                    }

                    isSuccess = true;
                    // Log the replace template activity
                    const replacedName = currentTemplate?.name || 'Unknown';
                    const newVersion = (currentTemplate?.version || 1) + 1;
                    await logActivity('Replace template', `Replaced template: ${replacedName}`);

                    // Set success details and show modal
                    setSuccessDetails({
                      replacedName: replacedName,
                      newVersion: newVersion,
                      forwardedTo: '', // Forwarding is a separate action
                    });
                    setShowReplaceModal(false);
                    setShowSuccessModal(true);
                    return;
                  } catch (err) {
                    console.error('Error replacing templates:', err);
                    isSuccess = false;
                    Alert.alert('Error', err.message || 'Failed to replace template');
                  } finally {
                    setSelectedReplaceTemplate(null);
                    setUploadedFiles({});
                    setUploading(false);
                  }
                }}
              >
                <Text style={{ color: COLORS.white, fontWeight: '700' }}>{uploading ? 'Replacing…' : 'Replace'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
    );
  };

  // ── Success Confirmation Modal ──
  const renderSuccessModal = () => {
    const { replacedName, newVersion, forwardedTo } = successDetails;
    const isReplace = replacedName && newVersion > 0;
    const isForward = forwardedTo;

    return (
      <Modal
        visible={showSuccessModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowSuccessModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowSuccessModal(false)}
        >
          <View style={[styles.modalCard, { alignItems: 'center', paddingVertical: 30 }]} onStartShouldSetResponder={() => true}>
            {/* Success Icon */}
            <View style={[styles.successIconCircle, { backgroundColor: '#D4EDDA', width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center', marginBottom: 20 }]}>
              <Text style={{ fontSize: 40, color: '#28A745' }}>✓</Text>
            </View>

            <Text style={[styles.modalTitle, { marginBottom: 20, fontSize: 20 }]}>Success!</Text>

            {/* Replace: Replaced Successfully */}
            {isReplace && (
              <View style={styles.successDetailRow}>
                <Text style={styles.successDetailLabel}>✓ Replaced:</Text>
                <Text style={styles.successDetailValue}>{replacedName}</Text>
              </View>
            )}

            {/* Replace: New Template Added */}
            {isReplace && (
              <View style={styles.successDetailRow}>
                <Text style={styles.successDetailLabel}>✓ New Version:</Text>
                <Text style={styles.successDetailValue}>v{newVersion}</Text>
              </View>
            )}

            {/* Forward: Forwarded To */}
            {isForward && (
              <View style={styles.successDetailRow}>
                <Text style={styles.successDetailLabel}>✓ Forwarded to:</Text>
                <Text style={styles.successDetailValue}>{forwardedTo}</Text>
              </View>
            )}

            {/* Fallback for empty cases */}
            {!isReplace && !isForward && (
              <Text style={{ color: COLORS.subText, fontSize: 14, marginTop: 10 }}>Operation completed successfully!</Text>
            )}

            <TouchableOpacity
              style={[styles.modalBtn, { backgroundColor: COLORS.navy, marginTop: 25, width: '80%' }]}
              onPress={() => setShowSuccessModal(false)}
            >
              <Text style={{ color: COLORS.white, fontWeight: '700' }}>Done</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    );
  };

  // ── Forward Template Modal ──
  const toggleForwardCheck = (id) => {
    setForwardChecked(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleBarangayCheck = (id) => {
    setSelectedBarangays(prev => {
      if (prev.includes(id)) {
        return prev.filter(b => b !== id);
      } else {
        return [...prev, id];
      }
    });
  };

  const forwardCheckedCount = Object.values(forwardChecked).filter(Boolean).length;

  const renderForwardModal = () => {
    // A template is only offered for forwarding if there's at least one currently-
    // targeted barangay that doesn't already have that exact template version
    // distributed to it. Once every target barangay already has it, it drops out
    // of the selection. A newer version (a different, not-yet-distributed
    // template_id) is unaffected and will still show up normally — forwarding it
    // will replace the old version's distribution record at that barangay.
    const forwardTargetIds = forwardToAll
      ? barangays.map(b => b.barangay_id)
      : selectedBarangays;

    const forwardableTemplates = templates.filter(t => t.status !== 'Archived').filter(t => {
      if (forwardTargetIds.length === 0) return true; // no target chosen yet
      const distributedSet = new Set(
        distributions
          .filter(d => d.template_id?.toString() === t.id.toString())
          .map(d => d.barangay_id)
      );
      return forwardTargetIds.some(bid => !distributedSet.has(bid));
    });

    return (
    <Modal
      visible={showForwardModal}
      transparent
      animationType="fade"
      onRequestClose={() => { setShowForwardModal(false); setForwardChecked({}); setSelectedBarangays([]); setForwardToAll(true); }}
    >
      <TouchableOpacity
        style={styles.modalOverlay}
        activeOpacity={1}
        onPress={() => { setShowForwardModal(false); setForwardChecked({}); setSelectedBarangays([]); setForwardToAll(true); }}
      >
        <View style={[styles.modalCard, { maxHeight: '90%' }]} onStartShouldSetResponder={() => true}>

          {/* Header */}
          <View style={styles.replaceModalHeader}>
            <View style={styles.replaceHeaderLeft}>
              <View style={styles.replaceHeaderIconCircle}>
                <Text style={styles.replaceHeaderIconText}>→</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.modalTitle, { marginBottom: 2 }]}>Forward Templates</Text>
                <Text style={styles.replaceHeaderSubtitle}>Distribute a template to one or more barangays</Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.replaceCloseBtn}
              onPress={() => { setShowForwardModal(false); setForwardChecked({}); setSelectedBarangays([]); setForwardToAll(true); }}
            >
              <Text style={styles.replaceCloseX}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Select Template label */}
          <Text style={[styles.replaceLabel, { marginBottom: 10 }]}>Select Template</Text>

          {/* Checklist box */}
          <ScrollView showsVerticalScrollIndicator={false} style={{ marginBottom: 8 }}>
            <View style={styles.forwardChecklistBox}>
              {forwardableTemplates.length === 0 ? (
                <View style={{ padding: 16, alignItems: 'center' }}>
                  <Text style={{ fontSize: 13, color: COLORS.midGray }}>
                    All templates are already distributed to the selected barangay(s)
                  </Text>
                </View>
              ) : forwardableTemplates.map((t, idx, arr) => (
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

          {/* Forward to All / Select Barangay */}
          <Text style={[styles.replaceLabel, { marginBottom: 10, marginTop: 8 }]}>Distribute To</Text>

          {/* Forward to All checkbox */}
          <TouchableOpacity
            style={styles.checklistRow}
            onPress={() => { setForwardToAll(true); setSelectedBarangays([]); }}
            activeOpacity={0.7}
          >
            <View style={[styles.forwardCheckbox, forwardToAll && styles.forwardCheckboxChecked]}>
              {forwardToAll && <Text style={styles.checkmark}>✓</Text>}
            </View>
            <Text style={styles.checklistText}>All Barangays</Text>
          </TouchableOpacity>

          {/* Select Specific Barangay */}
          <TouchableOpacity
            style={[styles.checklistRow, { borderTopWidth: 0 }]}
            onPress={() => setForwardToAll(false)}
            activeOpacity={0.7}
          >
            <View style={[styles.forwardCheckbox, !forwardToAll && styles.forwardCheckboxChecked]}>
              {!forwardToAll && <Text style={styles.checkmark}>✓</Text>}
            </View>
            <Text style={styles.checklistText}>Select Specific Barangay</Text>
          </TouchableOpacity>

          {/* Barangay dropdown */}
          {!forwardToAll && (
            <View style={{ marginTop: 8 }}>
              <TouchableOpacity
                style={[styles.dropdownTrigger, showBarangayDropdown && styles.dropdownTriggerOpen]}
                onPress={() => setShowBarangayDropdown(v => !v)}
                activeOpacity={0.8}
              >
                <Text style={[styles.dropdownTriggerText, selectedBarangays.length === 0 && { color: COLORS.midGray }]}>
                  {selectedBarangays.length === 0
                    ? 'Select barangays...'
                    : `${selectedBarangays.length} barangay${selectedBarangays.length > 1 ? 's' : ''} selected`}
                </Text>
                <Text style={styles.dropdownCaret}>{showBarangayDropdown ? '▲' : '▼'}</Text>
              </TouchableOpacity>

              {showBarangayDropdown && (
                <View style={[styles.checklistPanel, { maxHeight: 180 }]}>
                  <ScrollView showsVerticalScrollIndicator={false} nestedScrollEnabled={true}>
                    {barangays.map((brgy, idx) => (
                      <View key={brgy.barangay_id}>
                        <TouchableOpacity
                          style={styles.checklistRow}
                          onPress={() => toggleBarangayCheck(brgy.barangay_id)}
                          activeOpacity={0.7}
                        >
                          <View style={[styles.checkbox, selectedBarangays.includes(brgy.barangay_id) && styles.checkboxChecked]}>
                            {selectedBarangays.includes(brgy.barangay_id) && <Text style={styles.checkmark}>✓</Text>}
                          </View>
                          <Text style={styles.checklistText}>{brgy.barangay_name}</Text>
                        </TouchableOpacity>
                        {idx < barangays.length - 1 && <View style={styles.checklistDivider} />}
                      </View>
                    ))}
                  </ScrollView>
                </View>
              )}
            </View>
          )}

          {/* Footer */}
          <View style={[styles.modalRow, styles.replaceFooter]}>
            <TouchableOpacity
              style={[styles.modalBtn, styles.replaceCancelBtn, { flex: 1 }]}
              onPress={() => { setShowForwardModal(false); setForwardChecked({}); setSelectedBarangays([]); setForwardToAll(true); }}
            >
              <Text style={{ color: COLORS.darkText, fontWeight: '700' }}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalBtn, styles.replaceConfirmBtn, {
                backgroundColor: (forwardCheckedCount > 0 && (forwardToAll || selectedBarangays.length > 0)) ? COLORS.navy : COLORS.midGray,
                flex: 1,
              }]}
              disabled={forwardCheckedCount === 0 || (!forwardToAll && selectedBarangays.length === 0)}
              onPress={async () => {
                let resultMsg = null;
                let isSuccess = false;
                try {
                  if (!authUser?.userId) {
                    throw new Error('You must be logged in to forward templates');
                  }

                  const lydoUserId = authUser.userId;
                  setLoadingMessage('Forwarding templates…');
                  setUploading(true);
                  setShowForwardModal(false);

                  // Get target barangays
                  let targetBarangays = [];
                  if (forwardToAll) {
                    const { data: allBarangays } = await supabase
                      .from('barangays')
                      .select('barangay_id');
                    targetBarangays = allBarangays || [];
                  } else {
                    targetBarangays = barangays.filter(b => selectedBarangays.includes(b.barangay_id));
                  }

                  for (const templateId of Object.keys(forwardChecked)) {
                    if (!forwardChecked[templateId]) continue;

                    // Find every template_id (including older/archived versions) that
                    // shares this template's document type, so a newer version being
                    // forwarded can replace an older version already sitting on a
                    // barangay's copy, rather than piling up as a duplicate entry.
                    const currentTemplateForForward = templates.find(t => t.id === templateId);
                    const docTypeForForward = currentTemplateForForward?.documentType;
                    let sameDocTypeIds = [templateId];
                    if (docTypeForForward) {
                      const { data: sameTypeRows } = await supabase
                        .from('templates')
                        .select('template_id')
                        .eq('document_type', docTypeForForward);
                      if (sameTypeRows) {
                        sameDocTypeIds = sameTypeRows.map(r => r.template_id.toString());
                      }
                    }
                    const olderVersionIds = sameDocTypeIds
                      .filter(id => id !== templateId)
                      .map(id => parseInt(id));

                    for (const brgy of targetBarangays) {
                      // Replace: drop any older version of this document type already
                      // distributed to this barangay before adding the new version.
                      if (olderVersionIds.length > 0) {
                        await supabase
                          .from('template_distributions')
                          .delete()
                          .eq('barangay_id', brgy.barangay_id)
                          .in('template_id', olderVersionIds);
                      }

                      await supabase.from('template_distributions').insert({
                        template_id: parseInt(templateId),
                        barangay_id: brgy.barangay_id,
                        distributed_by: lydoUserId,
                        is_acknowledged: false,
                      });
                    }
                  }

                  const { data: newDist } = await supabase
                    .from('template_distributions')
                    .select('*');

                  if (newDist) setDistributions(newDist);

                  const count = Object.values(forwardChecked).filter(Boolean).length;
                  isSuccess = true;
                  // Log the forward template activity
                  const forwardedNames = templates.filter(t => forwardChecked[t.id]).map(t => t.name).join(', ');
                  const targetText = forwardToAll ? 'all barangays' : `${selectedBarangays.length} specific barangay(s)`;
                  await logActivity('Forward template', `Forwarded template(s) to ${targetText}: ${forwardedNames}`);

                  // Set success details and show modal
                  setSuccessDetails({
                    replacedName: '',
                    newVersion: 0,
                    forwardedTo: forwardToAll ? 'All Barangays' : `${selectedBarangays.length} Barangay(s)`,
                  });
                  setShowForwardModal(false);
                  setShowSuccessModal(true);
                  return;
                } catch (err) {
                  console.error('Error forwarding templates:', err);
                  Alert.alert('Error', err.message || 'Failed to forward templates');
                } finally {
                  setForwardChecked({});
                  setSelectedBarangays([]);
                  setForwardToAll(true);
                  setUploading(false);
                }
              }}
            >
              <Text style={{ color: COLORS.white, fontWeight: '700' }}>Forward</Text>
            </TouchableOpacity>
          </View>

        </View>
      </TouchableOpacity>
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
          <Text style={styles.mobileTitle}>Templates</Text>
              <TouchableOpacity style={styles.bellBtn} activeOpacity={0.7} onPress={notif.open}>
                <LydoBellIcon count={notif.count} />
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
               <TouchableOpacity style={styles.bellBtn} activeOpacity={0.7} onPress={notif.open}>
                 <LydoBellIcon count={notif.count} />
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
                {categoryFilter === 'All Categories' ? 'Template ▾' : `${categoryOptions.find(c => c.id.toString() === categoryFilter)?.name || categoryFilter} ▾`}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionButtonsContainer}>
          <TouchableOpacity style={styles.addBtn} onPress={() => { resetAddModal(); setShowAddModal(true); }} activeOpacity={0.8}>
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

          {loading ? (
            <View style={styles.emptyState}>
              <ActivityIndicator size="large" color={COLORS.navy} />
              <Text style={styles.emptyText}>Loading templates...</Text>
            </View>
          ) : filteredTemplates.length > 0 ? (
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

  const renderLoadingOverlay = () => (
    <Modal visible={uploading} transparent animationType="fade">
      <View style={{
        flex: 1, backgroundColor: 'rgba(0,0,0,0.45)',
        justifyContent: 'center', alignItems: 'center',
      }}>
        <View style={{
          backgroundColor: COLORS.white, borderRadius: 18,
          paddingVertical: 32, paddingHorizontal: 40,
          alignItems: 'center', minWidth: 220,
          shadowColor: '#000', shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.18, shadowRadius: 20, elevation: 10,
        }}>
          <ActivityIndicator size="large" color={COLORS.navy} />
          <Text style={{
            marginTop: 18, fontSize: 15, fontWeight: '700',
            color: COLORS.darkText, textAlign: 'center',
          }}>{loadingMessage}</Text>
        </View>
      </View>
    </Modal>
  );

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.navy} />

      {renderCategoryDropdown()}
      {renderAddModal()}
      {renderDetailModal()}
      {renderReplaceModal()}
      {renderSuccessModal()}
      {renderForwardModal()}
      {renderLoadingOverlay()}

      {/* Notification Modal — lists documents sent by SK officials */}
      <LydoNotificationModal
        {...notif.modalProps}
        onReview={(doc) => {
          notif.close();
          router.push({
            pathname: '/(tabs)/lydo-monitor',
            params: { viewFilter: 'submitted' },
          });
        }}
      />

      <View style={styles.layout}>
        {/* Mobile Sidebar Overlay */}
        {isMobile && sidebarVisible && (
          <TouchableOpacity
            style={styles.sidebarOverlay}
            activeOpacity={1}
            onPress={() => setSidebarVisible(false)}
          />
        )}

        <Sidebar
          activeTab={activeTab}
          onNavPress={handleNav}
          onLogout={handleLogout}
          isMobile={isMobile}
          sidebarVisible={sidebarVisible}
          navItems={LYDO_NAV_ITEMS}
          logoSource={require('./../../assets/images/lydo-logo.png')}
        />

        {renderContent()}
      </View>
    </SafeAreaView>
  );
}

// ─── STYLES ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: '#133E75' },
  layout: { flex: 1, flexDirection: 'row' },

  sidebarOverlay: {
    position: 'absolute',
    left: 0, top: 0, bottom: 0, right: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    zIndex: 5,
  },

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
    alignItems: 'flex-start', marginBottom: 18,
  },
  replaceHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1, paddingRight: 8 },
  replaceHeaderIconCircle: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: '#EAF0FB', alignItems: 'center', justifyContent: 'center',
  },
  replaceHeaderIconText: { fontSize: 18, fontWeight: '800', color: '#5B8DD9' },
  replaceHeaderSubtitle: { fontSize: 12, color: COLORS.subText, lineHeight: 16 },
  replaceCloseBtn: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: COLORS.offWhite, alignItems: 'center', justifyContent: 'center',
  },
  replaceCloseX: { fontSize: 14, color: COLORS.subText },
  replaceLabelRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 10,
  },
  replaceLabel: {
    fontSize: 12, fontWeight: '700', color: COLORS.subText,
    textTransform: 'uppercase', letterSpacing: 0.5,
  },
  replaceCountBadge: {
    fontSize: 11, fontWeight: '600', color: COLORS.subText,
    backgroundColor: COLORS.offWhite, borderRadius: 10,
    paddingHorizontal: 8, paddingVertical: 3,
    borderWidth: 1, borderColor: COLORS.lightGray,
  },

  // Replace: selectable template list (card style)
  replaceTemplateList: {
    borderRadius: 12,
    backgroundColor: COLORS.offWhite,
    padding: 6,
    borderWidth: 1,
    borderColor: COLORS.lightGray,
    maxHeight: 260,
  },
  replaceTemplateItem: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: COLORS.white,
    borderRadius: 10,
    borderWidth: 1.5, borderColor: 'transparent',
    paddingHorizontal: 12, paddingVertical: 12,
    marginBottom: 6,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 3, elevation: 1,
  },
  replaceTemplateItemSelected: {
    borderColor: COLORS.navy,
    backgroundColor: '#EAF0FB',
    shadowOpacity: 0.08,
  },
  replaceTemplateName: { fontSize: 13, fontWeight: '500', color: COLORS.darkText, lineHeight: 18 },
  replaceTemplateNameSelected: { fontWeight: '700', color: COLORS.navy },
  replaceTemplateMetaRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 5,
  },
  replaceVersionBadge: {
    backgroundColor: COLORS.lightGray, borderRadius: 6,
    paddingHorizontal: 6, paddingVertical: 2,
  },
  replaceVersionBadgeSelected: { backgroundColor: '#D6E2F7' },
  replaceVersionBadgeText: { fontSize: 10, fontWeight: '800', color: COLORS.subText },
  replaceVersionBadgeTextSelected: { color: COLORS.navy },
  replaceTemplateCategory: { fontSize: 11, color: COLORS.subText, textTransform: 'capitalize', flexShrink: 1 },
  replaceSelectedCheck: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: COLORS.navy, alignItems: 'center', justifyContent: 'center',
  },
  replaceSelectedCheckText: { fontSize: 11, color: COLORS.white, fontWeight: '900' },

  replaceUploadSection: { marginTop: 18 },
  replaceHintBox: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    marginTop: 14, paddingVertical: 10,
  },
  replaceHintIcon: { fontSize: 13, color: COLORS.midGray },
  replaceHint: {
    fontSize: 13, color: COLORS.midGray, textAlign: 'center',
  },
  replaceFooter: {
    marginTop: 18, paddingTop: 16,
    borderTopWidth: 1, borderTopColor: COLORS.lightGray,
  },
  replaceCancelBtn: {
    backgroundColor: COLORS.white,
    borderWidth: 1.5, borderColor: COLORS.lightGray,
  },
  replaceConfirmBtn: {
    shadowColor: COLORS.navy, shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25, shadowRadius: 6, elevation: 3,
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
  categoryHeader: {
    paddingHorizontal: 14, paddingVertical: 8,
    backgroundColor: COLORS.offWhite, borderBottomWidth: 1,
    borderBottomColor: COLORS.lightGray,
  },
  categoryHeaderText: { fontSize: 11, fontWeight: '800', color: COLORS.navy, textTransform: 'uppercase', letterSpacing: 0.5 },
  checklistText: { flex: 1, fontSize: 13, color: COLORS.darkText, lineHeight: 18 },
  checkbox: {
    width: 20, height: 20, borderRadius: 5,
    borderWidth: 2, borderColor: COLORS.midGray,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: COLORS.white,
  },
  checkboxChecked: { backgroundColor: COLORS.navy, borderColor: COLORS.navy },
  checkmark: { fontSize: 12, color: COLORS.white, fontWeight: '900' },

  // Radio button for single selection
  radioCircle: {
    width: 20, height: 20, borderRadius: 10,
    borderWidth: 2, borderColor: COLORS.midGray,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: COLORS.white,
  },
  radioCircleChecked: {
    borderColor: COLORS.navy,
    backgroundColor: COLORS.navy,
  },
  radioInner: {
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: COLORS.white,
  },

  // Checklist row for selected state
  checklistRowSelected: {
    backgroundColor: '#EAF4FF',
    borderRadius: 8,
    borderWidth: 2,
    borderColor: COLORS.navy,
    marginHorizontal: 2,
    marginVertical: 2,
  },

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

  // Success Modal styles
  successIconCircle: {},
  successDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 6,
    width: '90%',
  },
  successDetailLabel: {
    fontSize: 14,
    color: COLORS.subText,
    fontWeight: '600',
    marginRight: 8,
  },
  successDetailValue: {
    fontSize: 14,
    color: COLORS.darkText,
    fontWeight: '500',
    flex: 1,
  },

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