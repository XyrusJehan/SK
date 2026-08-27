import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, ScrollView, TouchableOpacity,
  StyleSheet, SafeAreaView, StatusBar, Dimensions,
  Modal, Alert, Image, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import Head from 'expo-router/head';
import { useNav } from './navContext';
import Sidebar, { LYDO_NAV_ITEMS } from './../components/Sidebar';
import { useAuth } from './authContext';
import { supabase } from '../../utils/supabase';
import { useLydoNotificationCenter, LydoNotificationModal, LydoBellIcon } from './notificationCenter';
import MobileHeader, { MobileHeaderSpacer } from './mobileHeader';
const { width: SCREEN_WIDTH } = Dimensions.get('window');
const isMobile = SCREEN_WIDTH < 768;

// ─── COLORS ───────────────────────────────────────────────────────────────────
// Kept identical to lydo-monitor-report.js so both screens stay visually consistent.
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
  onTime:    '#2E7D32',
  onTimeBg:  '#E8F5E9',
  late:      '#E65100',
  lateBg:    '#FFF3E0',
  noPub:     '#8B0000',
  noPubBg:   '#FFEBEE',
};

const MONITOR_TABS = ['Consultation', 'Budget', 'Report', 'Deadlines'];

// ─── DOCUMENT TYPE OPTIONS ─────────────────────────────────────────────────────
// These map to submission_deadlines.document_type (short code).
const DOCUMENT_OPTIONS = ['ABYIP', 'CBYDP', 'SK Budget', 'Accomplishment'];

// Friendly long-form label used to prefill submission_deadlines.description.
const DOC_FULL_NAMES = {
  CBYDP:          'CBYDP',
  ABYIP:          'Annual Budget Youth Investment Program',
  'SK Budget':    'Annual Budget 2026',
  Accomplishment: 'Monthly Itemized List',
};

// ─── DATE HELPERS ───────────────────────────────────────────────────────────────
// submission_deadlines.deadline_date is a Postgres `date` (YYYY-MM-DD).
// submission_deadlines.created_at is a Postgres `timestamp`.
const formatDateLong = (isoDateString) => {
  if (!isoDateString) return '—';
  // Avoid timezone drift: split & construct manually instead of `new Date(iso)`.
  const [y, m, d] = isoDateString.slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return isoDateString;
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' });
};

const isValidIsoDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(value);

// ─── ICONS ────────────────────────────────────────────────────────────────────


const PlusIcon = ({ color = COLORS.navy, size = 16 }) => (
  <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
    <View style={{ position: 'absolute', width: size, height: 2, backgroundColor: color, borderRadius: 1 }} />
    <View style={{ position: 'absolute', width: 2, height: size, backgroundColor: color, borderRadius: 1 }} />
  </View>
);

// Pure View-based calendar glyph — used on the "Set Deadline" date trigger.
const CalendarIcon = ({ color = COLORS.navy, size = 16 }) => (
  <View style={{ width: size, height: size, justifyContent: 'flex-end', alignItems: 'center' }}>
    <View style={{ width: size * 0.85, height: size * 0.72, borderWidth: 1.5, borderColor: color, borderRadius: size * 0.12, overflow: 'hidden' }}>
      <View style={{ height: size * 0.2, backgroundColor: color }} />
    </View>
    <View style={{ position: 'absolute', top: 0, left: size * 0.2, width: 2, height: size * 0.18, backgroundColor: color, borderRadius: 1 }} />
    <View style={{ position: 'absolute', top: 0, right: size * 0.2, width: 2, height: size * 0.18, backgroundColor: color, borderRadius: 1 }} />
  </View>
);

// ─── DROPDOWN ─────────────────────────────────────────────────────────────────
const Dropdown = ({ label, value, options, onSelect, placeholder = 'Select...', getLabel }) => {
  const [open, setOpen] = useState(false);
  const displayLabel = getLabel ? getLabel(value) : value;
  return (
    <View style={DD.wrap}>
      <TouchableOpacity
        style={DD.btn}
        onPress={() => setOpen(o => !o)}
        activeOpacity={0.8}
      >
        <Text style={DD.label}>{label}</Text>
        <Text style={DD.value} numberOfLines={1}>{displayLabel || placeholder}</Text>
        <Text style={DD.arrow}>▾</Text>
      </TouchableOpacity>
      {open && (
        <View style={DD.menu}>
          <ScrollView style={{ maxHeight: 220 }}>
            {options.map(opt => {
              const optValue = typeof opt === 'object' ? opt.value : opt;
              const optLabel = typeof opt === 'object' ? opt.label : opt;
              const active = optValue === value;
              return (
                <TouchableOpacity
                  key={String(optValue)}
                  style={[DD.item, active && DD.itemActive]}
                  onPress={() => { onSelect(optValue); setOpen(false); }}
                  activeOpacity={0.75}
                >
                  <Text style={[DD.itemText, active && DD.itemTextActive]}>{optLabel}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}
    </View>
  );
};

const DD = StyleSheet.create({
  wrap:           { position: 'relative', zIndex: 100 },
  btn:            { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: COLORS.white, borderRadius: 8, borderWidth: 1, borderColor: COLORS.lightGray, paddingHorizontal: 10, paddingVertical: 9 },
  label:          { fontSize: 10, color: COLORS.subText, fontWeight: '600' },
  value:          { fontSize: 11, fontWeight: '700', color: COLORS.darkText, flexShrink: 1 },
  arrow:          { fontSize: 9, color: COLORS.subText, marginLeft: 2 },
  menu:           { position: 'absolute', top: 40, left: 0, right: 0, backgroundColor: COLORS.white, borderRadius: 8, borderWidth: 1, borderColor: COLORS.lightGray, minWidth: 110, elevation: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 8, zIndex: 200 },
  item:           { paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.lightGray },
  itemActive:     { backgroundColor: COLORS.offWhite },
  itemText:       { fontSize: 12, color: COLORS.darkText },
  itemTextActive: { fontWeight: '700', color: COLORS.navy },
});

// ─── CALENDAR DATE PICKER (pure Views — no external date-picker lib) ──────────
const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const WEEKDAY_LABELS = ['S','M','T','W','T','F','S'];

const CalendarPicker = ({ value, onSelect }) => {
  const initialMonth = (() => {
    if (value && isValidIsoDate(value)) {
      const [y, m] = value.split('-').map(Number);
      return new Date(y, m - 1, 1);
    }
    return new Date();
  })();
  const [viewDate, setViewDate] = useState(initialMonth);

  const year  = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const firstWeekday  = new Date(year, month, 1).getDay();
  const daysInMonth   = new Date(year, month + 1, 0).getDate();
  const toIso = (d) => `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

  const cells = [
    ...Array(firstWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  return (
    <View style={CP.wrap}>
      <View style={CP.header}>
        <TouchableOpacity style={CP.navBtn} onPress={() => setViewDate(new Date(year, month - 1, 1))} activeOpacity={0.7}>
          <Text style={CP.navArrow}>‹</Text>
        </TouchableOpacity>
        <Text style={CP.headerText}>{MONTH_NAMES[month]} {year}</Text>
        <TouchableOpacity style={CP.navBtn} onPress={() => setViewDate(new Date(year, month + 1, 1))} activeOpacity={0.7}>
          <Text style={CP.navArrow}>›</Text>
        </TouchableOpacity>
      </View>
      <View style={CP.weekRow}>
        {WEEKDAY_LABELS.map((lbl, i) => (
          <Text key={i} style={CP.weekLabel}>{lbl}</Text>
        ))}
      </View>
      <View style={CP.grid}>
        {cells.map((d, i) => {
          if (d === null) return <View key={`b${i}`} style={CP.cell} />;
          const iso = toIso(d);
          const isSelected = iso === value;
          return (
            <TouchableOpacity
              key={iso}
              style={[CP.cell, CP.dayCell, isSelected && CP.dayCellActive]}
              onPress={() => onSelect(iso)}
              activeOpacity={0.75}
            >
              <Text style={[CP.dayText, isSelected && CP.dayTextActive]}>{d}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

const CP = StyleSheet.create({
  wrap:        { backgroundColor: COLORS.white, borderRadius: 10, borderWidth: 1, borderColor: COLORS.lightGray, padding: 10, marginTop: 6, elevation: 6, shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.12, shadowRadius: 8 },
  header:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, paddingHorizontal: 2 },
  navBtn:      { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.offWhite },
  navArrow:    { fontSize: 15, fontWeight: '800', color: COLORS.navy, marginTop: -1 },
  headerText:  { fontSize: 12, fontWeight: '800', color: COLORS.darkText },
  weekRow:     { flexDirection: 'row' },
  weekLabel:   { flex: 1, textAlign: 'center', fontSize: 9, fontWeight: '700', color: COLORS.subText, marginBottom: 4 },
  grid:        { flexDirection: 'row', flexWrap: 'wrap' },
  cell:        { width: `${100 / 7}%`, aspectRatio: 1, alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
  dayCell:     { borderRadius: 8 },
  dayCellActive: { backgroundColor: COLORS.navy },
  dayText:     { fontSize: 11, color: COLORS.darkText, fontWeight: '600' },
  dayTextActive: { color: COLORS.white, fontWeight: '800' },
});

// ─── ADD DEADLINE MODAL ────────────────────────────────────────────────────────
const ALL_BARANGAYS_VALUE = '__ALL__';

const AddDeadlineModal = ({ visible, onClose, onSave, barangays, deadlines, saving }) => {
  const [documentType, setDocumentType] = useState('');
  const [description, setDescription]   = useState('');
  const [deadlineDate, setDeadlineDate] = useState('');
  const [barangayId, setBarangayId]     = useState('');
  const [calendarOpen, setCalendarOpen] = useState(false);

  useEffect(() => {
    if (visible) {
      setDocumentType('');
      setDescription('');
      setDeadlineDate('');
      setBarangayId('');
      setCalendarOpen(false);
    }
  }, [visible]);

  if (!visible) return null;

  const documentOptions = DOCUMENT_OPTIONS.map(opt => ({ value: opt, label: DOC_FULL_NAMES[opt] ?? opt }));
  const documentLabel = (val) => documentOptions.find(o => o.value === val)?.label;

  // Barangays with an existing UNMET deadline for the currently selected
  // document type should not be selectable again — a barangay can only have
  // one open deadline per compliance document. Once a deadline is marked met,
  // that barangay frees back up for a new one.
  const takenBarangayIds = new Set(
    (deadlines || [])
      .filter(d => d.document_type === documentType && !d.is_met)
      .map(d => d.barangay_id)
  );
  const availableBarangays = barangays.filter(b => !takenBarangayIds.has(b.barangay_id));

  const barangayOptions = documentType
    ? [
        // Only offer "All Barangays" as a bulk option when every barangay is
        // still available; otherwise it would silently skip the ones already
        // covered, which is confusing — force an explicit per-barangay pick.
        ...(availableBarangays.length === barangays.length
          ? [{ value: ALL_BARANGAYS_VALUE, label: 'All Barangays' }]
          : []),
        ...availableBarangays.map(b => ({ value: b.barangay_id, label: b.barangay_name })),
      ]
    : [
        { value: ALL_BARANGAYS_VALUE, label: 'All Barangays' },
        ...barangays.map(b => ({ value: b.barangay_id, label: b.barangay_name })),
      ];
  const barangayLabel = (val) => barangayOptions.find(o => o.value === val)?.label;

  const handleDocSelect = (opt) => {
    setDocumentType(opt);
    setDescription(DOC_FULL_NAMES[opt] ?? opt);
    // The previously chosen barangay may no longer be valid for this document
    // type (it might already have a deadline), so make the user re-pick.
    setBarangayId('');
  };

  const handleDateSelect = (iso) => {
    setDeadlineDate(iso);
    setCalendarOpen(false);
  };

  const isValid = !!documentType && isValidIsoDate(deadlineDate) && !!barangayId;

  const handleConfirm = () => {
    if (!documentType) {
      Alert.alert('Missing Document Type', 'Please select a compliance document type.');
      return;
    }
    if (!isValidIsoDate(deadlineDate)) {
      Alert.alert('Missing Deadline', 'Please pick a deadline date from the calendar.');
      return;
    }
    if (!barangayId) {
      Alert.alert('Missing Barangay', 'Please select a barangay, or choose "All Barangays".');
      return;
    }
    onSave({
      documentType,
      description: description.trim(),
      deadlineDate,
      barangayId,
    });
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={AM.overlay}>
        <View style={AM.sheet}>
          {/* Header */}
          <View style={AM.header}>
            <Text style={AM.title}>Create Submission Deadline</Text>
            <TouchableOpacity style={AM.closeBtn} onPress={onClose} activeOpacity={0.8}>
              <Text style={AM.closeX}>✕</Text>
            </TouchableOpacity>
          </View>
          <View style={AM.divider} />

          {/* Body */}
          <ScrollView style={AM.body} contentContainerStyle={AM.bodyContent} showsVerticalScrollIndicator={false}>
            <Text style={AM.fieldLabel}>Compliance Document</Text>
            <Dropdown
              label="Document"
              value={documentType}
              options={documentOptions}
              onSelect={handleDocSelect}
              placeholder="Select a document type"
              getLabel={documentLabel}
            />

            <Text style={[AM.fieldLabel, { marginTop: 14 }]}>Description</Text>
            <TextInput
              style={AM.input}
              placeholder="e.g. Annual Budget Youth Investment Program"
              placeholderTextColor={COLORS.midGray}
              value={description}
              onChangeText={setDescription}
            />

            <Text style={[AM.fieldLabel, { marginTop: 14 }]}>Set Deadline</Text>
            <TouchableOpacity style={AM.dateBtn} onPress={() => setCalendarOpen(o => !o)} activeOpacity={0.8}>
              <CalendarIcon color={COLORS.navy} size={16} />
              <Text style={AM.dateBtnText}>
                {isValidIsoDate(deadlineDate) ? formatDateLong(deadlineDate) : 'Select a date'}
              </Text>
            </TouchableOpacity>
            {calendarOpen && (
              <CalendarPicker value={deadlineDate} onSelect={handleDateSelect} />
            )}

            <Text style={[AM.fieldLabel, { marginTop: 14 }]}>Barangay</Text>
            <Dropdown
              label="Scope"
              value={barangayId}
              options={barangayOptions}
              onSelect={setBarangayId}
              placeholder="Select barangay"
              getLabel={barangayLabel}
            />

            <Text style={[AM.fieldLabel, { marginTop: 16 }]}>Confirmation</Text>
            <View style={AM.confirmBox}>
              <Text style={AM.confirmTitle}>Confirmed Details:</Text>
              <Text style={AM.confirmLine}>
                Document : <Text style={AM.confirmValue}>{documentLabel(documentType) || '—'}</Text>
              </Text>
              <Text style={AM.confirmLine}>
                Description : <Text style={AM.confirmValue}>{description || '—'}</Text>
              </Text>
              <Text style={AM.confirmLine}>
                Barangay : <Text style={AM.confirmValue}>{barangayLabel(barangayId) || '—'}</Text>
              </Text>
              <Text style={AM.confirmLine}>
                Deadline: <Text style={AM.confirmValue}>{isValidIsoDate(deadlineDate) ? formatDateLong(deadlineDate) : '—'}</Text>
              </Text>
            </View>
          </ScrollView>

          {/* Actions */}
          <View style={AM.btnRow}>
            <TouchableOpacity style={AM.cancelBtn} onPress={onClose} activeOpacity={0.8} disabled={saving}>
              <Text style={AM.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[AM.saveBtn, (!isValid || saving) && { opacity: 0.5 }]}
              onPress={handleConfirm}
              activeOpacity={0.85}
              disabled={!isValid || saving}
            >
              {saving ? (
                <ActivityIndicator color={COLORS.white} size="small" />
              ) : (
                <Text style={AM.saveText}>Confirm</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const AM = StyleSheet.create({
  overlay:     { flex: 1, backgroundColor: 'rgba(0,0,0,0.50)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  sheet:       { backgroundColor: COLORS.white, borderRadius: 14, width: '100%', maxWidth: 420, maxHeight: '88%', overflow: 'hidden', elevation: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.25, shadowRadius: 20 },
  header:      { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12 },
  title:       { flex: 1, fontSize: 15, fontWeight: '800', color: COLORS.darkText },
  closeBtn:    { width: 28, height: 28, borderRadius: 14, backgroundColor: COLORS.lightGray, alignItems: 'center', justifyContent: 'center' },
  closeX:      { fontSize: 11, color: COLORS.subText, fontWeight: '700' },
  divider:     { height: 1, backgroundColor: COLORS.lightGray },
  body:        { paddingHorizontal: 16 },
  bodyContent: { paddingTop: 16, paddingBottom: 6 },
  fieldLabel:  { fontSize: 11, fontWeight: '700', color: COLORS.darkText, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.4 },
  input:       { borderWidth: 1, borderColor: COLORS.lightGray, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 12, color: COLORS.darkText, backgroundColor: COLORS.offWhite },

  dateBtn:     { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: COLORS.lightGray, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12 },
  dateBtnText: { fontSize: 13, fontWeight: '700', color: COLORS.darkText },

  confirmBox:   { backgroundColor: '#CDEDE7', borderRadius: 10, borderWidth: 1, borderColor: '#A9DED3', paddingHorizontal: 14, paddingVertical: 12, gap: 3 },
  confirmTitle: { fontSize: 12, fontWeight: '800', color: COLORS.navy, marginBottom: 4 },
  confirmLine:  { fontSize: 12, color: COLORS.darkText, lineHeight: 17 },
  confirmValue: { fontWeight: '700', color: COLORS.darkText },

  btnRow:      { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingBottom: 16, paddingTop: 14 },
  saveBtn:     { flex: 1.2, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.navy, borderRadius: 8, paddingVertical: 11 },
  saveText:    { fontSize: 12, fontWeight: '700', color: COLORS.white },
  cancelBtn:   { flex: 1, paddingHorizontal: 16, paddingVertical: 11, borderRadius: 8, borderWidth: 1.5, borderColor: COLORS.midGray, alignItems: 'center', justifyContent: 'center' },
  cancelText:  { fontSize: 12, fontWeight: '600', color: COLORS.subText },
});

// ─── DEADLINE TABLE ROW ────────────────────────────────────────────────────────
const DeadlineRow = ({ item, isEven }) => (
  <View style={[dtStyles.row, isEven && dtStyles.rowEven]}>
    <View style={dtStyles.colDocument}>
      <Text style={dtStyles.cellDocument} numberOfLines={isMobile ? 3 : 2}>
        {item.description || item.document_type}
      </Text>
    </View>
    <View style={dtStyles.colBarangay}>
      <Text style={dtStyles.cellText} numberOfLines={2}>{item.barangayName}</Text>
    </View>
    <View style={dtStyles.colDeadline}>
      <Text style={dtStyles.cellText}>{formatDateLong(item.deadline_date)}</Text>
    </View>
    <View style={dtStyles.colCreatedBy}>
      <Text style={dtStyles.cellText} numberOfLines={2}>{item.createdByName}</Text>
    </View>
    <View style={dtStyles.colDateCreated}>
      <Text style={dtStyles.cellText}>{formatDateLong(item.created_at)}</Text>
    </View>
  </View>
);

const EmptyRow = ({ isEven }) => (
  <View style={[dtStyles.row, dtStyles.emptyRow, isEven && dtStyles.rowEven]}>
    <View style={dtStyles.colDocument} />
    <View style={dtStyles.colBarangay} />
    <View style={dtStyles.colDeadline} />
    <View style={dtStyles.colCreatedBy} />
    <View style={dtStyles.colDateCreated} />
  </View>
);

// ─── MAIN SCREEN ──────────────────────────────────────────────────────────────
export default function LYDOMonitorDeadlinesScreen() {
  const router = useRouter();
  const { activeTab, setActiveTab } = useNav();
  const { logout, user } = useAuth();

  const [activeMonitorTab, setActiveMonitorTab] = useState('Deadlines');
  const [deadlines, setDeadlines]       = useState([]);
  const [barangays, setBarangays]       = useState([]);
  const [loading, setLoading]           = useState(true);
  const [saving, setSaving]             = useState(false);
  const [loadError, setLoadError]       = useState(null);
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [sidebarVisible, setSidebarVisible]   = useState(false);
  const notif = useLydoNotificationCenter();
  const [currentTime, setCurrentTime]   = useState('');

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

  // ── Fetch barangays (for the picker + name lookups) ────────────────────────
  const fetchBarangays = useCallback(async () => {
    const { data, error } = await supabase
      .from('barangays')
      .select('barangay_id, barangay_name')
      .order('barangay_name', { ascending: true });

    if (error) {
      console.error('Error fetching barangays:', error);
      return [];
    }
    return data || [];
  }, []);

  // ── Fetch submission_deadlines, joined with barangays + users ──────────────
  // `users` has first_name/last_name, not a single full_name column — same
  // pattern used for the "creator" join in lydo-monitor.js.
  const fetchDeadlines = useCallback(async () => {
    const { data, error } = await supabase
      .from('submission_deadlines')
      .select(`
        deadline_id,
        barangay_id,
        created_by,
        document_type,
        description,
        deadline_date,
        is_met,
        met_at,
        created_at,
        barangays ( barangay_name ),
        creator:users!submission_deadlines_created_by_fkey ( first_name, last_name )
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Get all document types to map short codes to IDs
    const { data: docTypes } = await supabase
      .from('document_types')
      .select('id, document_type');

    // Build a map of document_type names/shortcodes to IDs
    const docTypeToId = {};
    (docTypes || []).forEach(dt => {
      const name = (dt.document_type || '').trim().toLowerCase();
      docTypeToId[name] = String(dt.id);
      // Also try to extract short code from name (e.g., "Annual Budget Youth Investment Program" -> "ABYIP")
      const shortMatch = name.match(/\b\w/g);
      if (shortMatch) {
        docTypeToId[shortMatch.join('')] = String(dt.id);
      }
    });

    // Get all documents with approved status
    const { data: docs } = await supabase
      .from('documents')
      .select('document_id, barangay_id, document_type, status, title')
      .eq('status', 'approved');

    // Build a map: barangay_id + document_type_id -> exists
    const approvedDocsMap = {};
    (docs || []).forEach(d => {
      const key = `${d.barangay_id}_${d.document_type}`;
      approvedDocsMap[key] = d;
    });

    // Process each deadline and check if there's an approved document
    const now = new Date().toISOString();
    const updatedDeadlines = [];

    for (const row of (data || [])) {
      // Determine the document_type ID to look for
      // The deadline stores either a short code (ABYIP) or description
      const docTypeFromDeadline = row.document_type || '';
      const descFromDeadline = (row.description || '').toLowerCase().trim();

      // Try to find the matching document type ID
      let docTypeId = docTypeToId[docTypeFromDeadline.toUpperCase()] ||
                      docTypeToId[docTypeFromDeadline.toLowerCase()] ||
                      docTypeToId[descFromDeadline];

      // Fallback: try to match by description in document_types table
      if (!docTypeId) {
        const matched = (docTypes || []).find(dt =>
          (dt.document_type || '').toLowerCase().includes(descFromDeadline) ||
          descFromDeadline.includes((dt.document_type || '').toLowerCase().trim())
        );
        if (matched) {
          docTypeId = String(matched.id);
        }
      }

      // Check if there's an approved document for this deadline
      const docKey = `${row.barangay_id}_${docTypeId}`;
      const hasApprovedDoc = !!approvedDocsMap[docKey];

      // If the deadline says not met but there's an approved doc, update it
      if (!row.is_met && hasApprovedDoc) {
        await supabase
          .from('submission_deadlines')
          .update({ is_met: true, met_at: now })
          .eq('deadline_id', row.deadline_id);
        row.is_met = true;
        row.met_at = now;
      }

      updatedDeadlines.push({
        ...row,
        barangayName:  row.barangays?.barangay_name ?? '—',
        createdByName: getFullName(row.creator),
      });
    }

    return updatedDeadlines;
  }, []);

  const getFullName = (u) => {
    if (!u) return 'LYDO';
    return `${u.first_name || ''} ${u.last_name || ''}`.trim() || 'LYDO';
  };

  const loadAll = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [bgys, rows] = await Promise.all([fetchBarangays(), fetchDeadlines()]);
      setBarangays(bgys);
      setDeadlines(rows);
    } catch (err) {
      console.error('Error loading submission deadlines:', err);
      setLoadError('Could not load submission deadlines. Pull to refresh or try again.');
    } finally {
      setLoading(false);
    }
  }, [fetchBarangays, fetchDeadlines]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // ── Navigation ──────────────────────────────────────────────────────────────
  const handleNav = (tab) => {
    setActiveTab(tab);
    setSidebarVisible(false);
    if (tab === 'Dashboard') router.push('/(tabs)/lydo-dashboard');
    else if (tab === 'Documents') router.push('/(tabs)/lydo-document');
    else if (tab === 'Monitor') router.push('/(tabs)/lydo-monitor');
    else if (tab === 'Logs') router.push('/(tabs)/lydo-logs');
    else if (tab === 'Barangay') router.push('/(tabs)/lydo-accounts');
  };

  const handleLogout = () => {
    logout();
    router.replace('/');
  };

  const handleMonitorTabPress = (tab) => {
    if (tab === 'Consultation') { router.push('/(tabs)/lydo-monitor'); return; }
    if (tab === 'Budget')       { router.push('/(tabs)/lydo-monitor-budget'); return; }
    if (tab === 'Report')       { router.push('/(tabs)/lydo-monitor-report'); return; }
    if (tab === 'Deadlines')    { setActiveMonitorTab('Deadlines'); return; }
    setActiveMonitorTab(tab);
  };

  // ── Add deadline (insert into Supabase) ─────────────────────────────────────
  const handleSaveDeadline = async ({ documentType, description, deadlineDate, barangayId }) => {
    const createdBy = user?.userId;
    if (!createdBy) {
      Alert.alert('Not Signed In', 'Could not determine the current user. Please sign in again.');
      return;
    }

    setSaving(true);
    try {
      const barangaysWithExistingDeadline = new Set(
        deadlines
          .filter(d => d.document_type === documentType && !d.is_met)
          .map(d => d.barangay_id)
      );

      const targetBarangayIds = barangayId === ALL_BARANGAYS_VALUE
        ? barangays
            .map(b => b.barangay_id)
            .filter(id => !barangaysWithExistingDeadline.has(id))
        : [barangayId];

      if (targetBarangayIds.length === 0) {
        throw new Error('No barangays available to assign this deadline to.');
      }

      const rowsToInsert = targetBarangayIds.map(bId => ({
        barangay_id:    bId,
        created_by:     createdBy,
        document_type:  documentType,
        description:    description || null,
        deadline_date:  deadlineDate,
      }));

      const { error } = await supabase
        .from('submission_deadlines')
        .insert(rowsToInsert);

      if (error) throw error;

      // Log the activity
      const barangayLabel = barangayId === ALL_BARANGAYS_VALUE
        ? 'All Barangays'
        : barangays.find(b => b.barangay_id === barangayId)?.barangay_name || 'Unknown';

      const logDescription = `Added deadline for ${description || documentType} - ${barangayLabel} (Due: ${formatDateLong(deadlineDate)})`;

      await supabase.from('lydo_activity_logs').insert({
        user_id: createdBy,
        action: 'Add deadline',
        description: logDescription,
      });

      setAddModalVisible(false);
      await loadAll();
    } catch (err) {
      console.error('Error saving deadline:', err);
      Alert.alert('Save Failed', err.message || 'Could not save this deadline. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // Pad the table out with a few empty rows so it reads like the reference layout
  const PAD_ROWS = Math.max(0, 5 - deadlines.length);

  // ── Main Content ─────────────────────────────────────────────────────────────
  const renderContent = () => (
    <View style={[styles.main, isMobile && styles.mainMobile]}>
      <MobileHeader
        title="Monitor Deadlines"
        onMenuPress={() => setSidebarVisible(true)}
        onBellPress={notif.open}
        bellCount={notif.count}
        BellIcon={LydoBellIcon}
        colors={COLORS}
      />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.mainContent}
        showsVerticalScrollIndicator={false}
      >
      <MobileHeaderSpacer />

      {/* Desktop Header */}
      {!isMobile && (
        <View style={styles.header}>
          <View>
            <Text style={styles.headerSub}>SANGGUNIANG KABATAAN FEDERATION</Text>
            <Text style={styles.headerTitle}>RIZAL, LAGUNA</Text>
            <Text style={styles.headerDesc}>
              SK Full Disclosure Policy Compliance Portal for the Submission and Validation{'\n'}of Statutory Financial Reports and Developmental Plans
            </Text>
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

      {/* ── Monitor Tabs ── */}
      <View style={styles.monitorTabBar}>
        {MONITOR_TABS.map(tab => {
          const active = activeMonitorTab === tab;
          return (
            <TouchableOpacity
              key={tab}
              style={[styles.monitorTab, active && styles.monitorTabActive]}
              onPress={() => handleMonitorTabPress(tab)}
              activeOpacity={0.75}
            >
              <Text style={[styles.monitorTabText, active && styles.monitorTabTextActive]}>
                {tab}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* ── Submission Deadline panel ── */}
      <View style={dtStyles.panel}>
        <View style={dtStyles.panelHeader}>
          <Text style={dtStyles.panelTitle}>Submission Deadline</Text>
          <TouchableOpacity
            style={dtStyles.addBtn}
            onPress={() => setAddModalVisible(true)}
            activeOpacity={0.8}
          >
            <PlusIcon color={COLORS.navy} size={13} />
            <Text style={dtStyles.addBtnText}>Deadline</Text>
          </TouchableOpacity>
        </View>

        <View style={dtStyles.tableContainer}>
          <View style={dtStyles.headerRow}>
            <View style={dtStyles.colDocument}>
              <Text style={dtStyles.headerText}>Compliance Document</Text>
            </View>
            <View style={dtStyles.colBarangay}>
              <Text style={dtStyles.headerText}>Barangay</Text>
            </View>
            <View style={dtStyles.colDeadline}>
              <Text style={dtStyles.headerText}>Deadline</Text>
            </View>
            <View style={dtStyles.colCreatedBy}>
              <Text style={dtStyles.headerText}>Created By</Text>
            </View>
            <View style={dtStyles.colDateCreated}>
              <Text style={dtStyles.headerText}>Date Created</Text>
            </View>
          </View>

          {loading ? (
            <View style={dtStyles.emptyState}>
              <ActivityIndicator color={COLORS.navy} />
              <Text style={[dtStyles.emptyText, { marginTop: 8 }]}>Loading deadlines…</Text>
            </View>
          ) : loadError ? (
            <View style={dtStyles.emptyState}>
              <Text style={[dtStyles.emptyText, { color: COLORS.noPub }]}>{loadError}</Text>
              <TouchableOpacity onPress={loadAll} style={{ marginTop: 10 }}>
                <Text style={{ color: COLORS.navy, fontWeight: '700', fontSize: 12 }}>Retry</Text>
              </TouchableOpacity>
            </View>
          ) : deadlines.length === 0 ? (
            <View style={dtStyles.emptyState}>
              <Text style={dtStyles.emptyText}>No submission deadlines yet.</Text>
            </View>
          ) : (
            deadlines.map((item, idx) => (
              <DeadlineRow key={item.deadline_id} item={item} isEven={idx % 2 !== 0} />
            ))
          )}

          {!loading && !loadError && Array.from({ length: PAD_ROWS }).map((_, i) => (
            <EmptyRow key={`pad-${i}`} isEven={(deadlines.length + i) % 2 !== 0} />
          ))}
        </View>
      </View>
    </ScrollView>
    </View>
  );

  // ── Root ────────────────────────────────────────────────────────────────────
  return (
    <>
      <Head>
        <title>LYDO Deadlines · SK Monitoring</title>
      </Head>
      <SafeAreaView style={styles.safe}>
        <StatusBar barStyle="light-content" backgroundColor={COLORS.navy} />

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

        <AddDeadlineModal
          visible={addModalVisible}
          onClose={() => setAddModalVisible(false)}
          onSave={handleSaveDeadline}
          barangays={barangays}
          deadlines={deadlines}
          saving={saving}
        />
      </SafeAreaView>
    </>
  );
}

// ─── STYLES (shared shell — same as lydo-monitor-report.js) ───────────────────
const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: COLORS.navy },
  layout: { flex: 1, flexDirection: 'row' },

  sidebarOverlay: { position: 'absolute', left: 0, top: 0, bottom: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 5 },


  main:        { flex: 1, backgroundColor: COLORS.offWhite, borderTopLeftRadius: 20 },
  mainMobile:  { borderTopLeftRadius: 0 },
  mainContent: { padding: 20, paddingBottom: 40 },


  header:      { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 },
  headerSub:   { fontSize: 10, fontWeight: '600', color: COLORS.subText, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 2 },
  headerTitle: { fontSize: 20, fontWeight: '900', color: COLORS.darkText, letterSpacing: 0.5 },
  headerDesc: { fontSize: 15, fontWeight: '700', color: COLORS.darkText, marginTop: 6, lineHeight: 17 },

  datetimeCard: { backgroundColor: '#F7F5F2', borderRadius: 12, paddingVertical: 10, paddingHorizontal: 16, borderWidth: 1, borderColor: '#E0DDD9', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  datetimeRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  datetimeSeparator: { width: 1, height: 36, backgroundColor: '#D0CCC8', marginHorizontal: 4 },
  datetimeDivider: { width: 3, height: 28, borderRadius: 2, backgroundColor: '#133E75' },
  datetimeBlock: { flexDirection: 'column' },
  datetimeLabel: { fontSize: 9, fontWeight: '700', color: '#666666', letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 1 },
  datetimeValue: { fontSize: 13, fontWeight: '700', color: '#1A1A1A', letterSpacing: 0.2 },
  datetimeTime: { fontVariant: ['tabular-nums'], color: '#133E75', fontSize: 14, fontWeight: '800' },

  bellBtn:        { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.cardBg, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 6, elevation: 3 },
  notifBadge:     { position: 'absolute', top: -2, right: -2, width: 16, height: 16, borderRadius: 8, backgroundColor: COLORS.gold, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: COLORS.white },
  notifBadgeText: { fontSize: 8, fontWeight: '900', color: COLORS.navy },

  monitorTabBar: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: COLORS.lightGray, marginBottom: 14, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.30, shadowRadius: 3, elevation: 6 },
  monitorTab: { flex: 1, paddingHorizontal: isMobile ? 8 : 40, backgroundColor: COLORS.navy, paddingVertical: 10, borderBottomWidth: 0, borderBottomColor: 'transparent', marginBottom: -1, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', alignItems: 'center' },
  monitorTabActive: { backgroundColor: COLORS.gold, borderRadius: 4, borderBottomColor: COLORS.gold, borderColor: COLORS.gold, shadowColor: COLORS.gold, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.4, shadowRadius: 4, elevation: 3 },
  monitorTabText: { fontSize: isMobile ? 10 : 13, fontWeight: '600', color: COLORS.white },
  monitorTabTextActive: { color: COLORS.darkText, fontWeight: '800' },
});

// ─── DEADLINES TABLE STYLES ─────────────────────────────────────────────────────
const dtStyles = StyleSheet.create({
  panel: { marginTop: 4 },
  panelHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  panelTitle: { fontSize: isMobile ? 14 : 16, fontWeight: '800', color: COLORS.navy },
  addBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    height: 30, borderRadius: 8, paddingHorizontal: 12,
    borderWidth: 1.5, borderColor: COLORS.lightGray,
    backgroundColor: COLORS.white,
    elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 4,
  },
  addBtnText: { fontSize: isMobile ? 11 : 12, fontWeight: '700', color: COLORS.navy },

  tableContainer: { backgroundColor: COLORS.white, borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: COLORS.lightGray, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6 },

  headerRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.white, paddingVertical: 12, paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: COLORS.lightGray },
  headerText: { fontSize: isMobile ? 10 : 12, fontWeight: '700', color: COLORS.darkText, letterSpacing: 0.2 },

  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16, paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: COLORS.lightGray, backgroundColor: COLORS.white, minHeight: 56 },
  rowEven: { backgroundColor: '#FAFAFA' },
  emptyRow: { minHeight: 64 },

  colDocument:    { flex: 1.5, paddingRight: 10, borderRightWidth: 1, borderRightColor: COLORS.lightGray },
  colBarangay:    { flex: 1.1, alignItems: 'center', paddingHorizontal: 10, borderRightWidth: 1, borderRightColor: COLORS.lightGray },
  colDeadline:    { flex: 1, alignItems: 'center', paddingHorizontal: 10, borderRightWidth: 1, borderRightColor: COLORS.lightGray },
  colCreatedBy:   { flex: 1, alignItems: 'center', paddingHorizontal: 10, borderRightWidth: 1, borderRightColor: COLORS.lightGray },
  colDateCreated: { flex: 1, alignItems: 'center', paddingHorizontal: 10 },

  cellDocument: { fontSize: isMobile ? 10 : 12, color: COLORS.darkText, lineHeight: 16 },
  cellText:     { fontSize: isMobile ? 10 : 12, color: COLORS.darkText, textAlign: 'center' },

  emptyState: { alignItems: 'center', paddingVertical: 40 },
  emptyText:  { fontSize: 14, color: COLORS.midGray },
});