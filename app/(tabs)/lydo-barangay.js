import React, { useState, useEffect, useContext, useRef } from 'react';
import {
  View, Text, TextInput, ScrollView, TouchableOpacity,
  StyleSheet, SafeAreaView, StatusBar, Dimensions,
  Alert, Image, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useNav } from './navContext';
import { useAuth } from './authContext';
import { supabase } from '../../utils/supabase';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const isMobile = SCREEN_WIDTH < 768;

// ─── COLORS ───────────────────────────────────────────────────────────────────
const COLORS = {
  navy:       '#133E75',
  navyLight:  '#1E4D8C',
  gold:       '#E8C547',
  white:      '#FFFFFF',
  offWhite:   '#F7F5F2',
  lightGray:  '#ECECEC',
  midGray:    '#B0B0B0',
  darkText:   '#1A1A1A',
  subText:    '#666666',
  cardBg:     '#FFFFFF',
  approve:    '#2E7D32',
  approveBg:  '#43A047',
  reject:     '#7B0000',
  rejectBg:   '#C62828',
  pending:    '#B8860B',
  pendingBg:  '#FFF3CD',
  pendingBdr: '#E8C547',
  checkBlue:  '#1565C0',
};

const NAV_TABS     = ['Dashboard', 'Documents', 'Monitor', 'Barangay', 'Logs'];
const BARANGAY_TABS = ['List of Accounts', 'Barangay'];
const NOTIF_TABS   = new Set(['List of Accounts', 'Barangay']);

// ─── SIDEBAR NAV ICONS (pure React Native Views — no react-native-svg) ────────

// Dashboard: 2×2 grid of rounded squares
const DashboardIcon = ({ color = '#fff', size = 16 }) => {
  const s = size * 0.38, gap = size * 0.12, r = size * 0.12;
  const box = { width: s, height: s, borderRadius: r, backgroundColor: color };
  return (
    <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
      <View style={{ flexDirection: 'row', gap }}><View style={box} /><View style={box} /></View>
      <View style={{ height: gap }} />
      <View style={{ flexDirection: 'row', gap }}><View style={box} /><View style={box} /></View>
    </View>
  );
};

// Documents: file shape with fold + two lines
const DocumentsIcon = ({ color = '#fff', size = 16 }) => {
  const w = size * 0.6, h = size * 0.78, fold = size * 0.22;
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

// Monitor: simple globe — circle + horizontal line + vertical oval hint
const MonitorIcon = ({ color = '#fff', size = 16 }) => (
  <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
    <View style={{ width: size * 0.82, height: size * 0.82, borderRadius: size * 0.41, borderWidth: 1.5, borderColor: color, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' }}>
      <View style={{ position: 'absolute', height: 1.5, width: '100%', backgroundColor: color }} />
      <View style={{ width: size * 0.38, height: size * 0.78, borderRadius: size * 0.19, borderWidth: 1.5, borderColor: color, backgroundColor: 'transparent' }} />
    </View>
  </View>
);

// Barangay: building/institution icon — base + columns hint
const BarangayIcon = ({ color = '#fff', size = 16 }) => {
  const bw = 1.5;
  return (
    <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
      {/* roof / triangle top */}
      <View style={{ width: size * 0.82, height: size * 0.22, borderLeftWidth: bw, borderRightWidth: bw, borderTopWidth: bw, borderColor: color, borderTopLeftRadius: size * 0.06, borderTopRightRadius: size * 0.06 }} />
      {/* body */}
      <View style={{ width: size * 0.82, height: size * 0.52, borderLeftWidth: bw, borderRightWidth: bw, borderBottomWidth: bw, borderColor: color, flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', paddingHorizontal: size * 0.08, paddingBottom: size * 0.06 }}>
        {[0, 1, 2].map(i => (
          <View key={i} style={{ width: size * 0.1, height: size * 0.36, backgroundColor: color, borderRadius: size * 0.03 }} />
        ))}
      </View>
    </View>
  );
};

// Logs: clipboard with lines
const LogsIcon = ({ color = '#fff', size = 16 }) => (
  <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
    <View style={{ width: size * 0.75, height: size * 0.85, borderWidth: 1.5, borderColor: color, borderRadius: size * 0.1, paddingHorizontal: size * 0.1, paddingVertical: size * 0.1, justifyContent: 'space-around' }}>
      <View style={{ position: 'absolute', top: -size * 0.08, alignSelf: 'center', width: size * 0.3, height: size * 0.14, backgroundColor: color, borderRadius: size * 0.04 }} />
      {[0, 1, 2].map(i => (
        <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: size * 0.08, marginTop: i === 0 ? size * 0.1 : 0 }}>
          <View style={{ width: size * 0.1, height: size * 0.1, borderRadius: size * 0.05, backgroundColor: color }} />
          <View style={{ flex: 1, height: 1.5, backgroundColor: color, borderRadius: 1 }} />
        </View>
      ))}
    </View>
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

// ─── GLOBAL DROPDOWN CONTEXT ─────────────────────────────────────────────────
const DropdownContext = React.createContext();

const GlobalDropdownProvider = ({ children }) => {
  const [dropdowns, setDropdowns] = useState({});

  const openDropdown = (id, ref, options, onSelect, width) => {
    if (ref && ref.current) {
      ref.current.measureInWindow((x, y, width, height) => {
        setDropdowns(prev => ({
          ...prev,
          [id]: { x, y: y + height, width: width || 140, options, onSelect, isOpen: true }
        }));
      });
    }
  };

  const closeDropdown = (id) => {
    setDropdowns(prev => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const selectOption = (id, option) => {
    if (option === null || option === undefined) {
      closeDropdown(id);
      return;
    }
    const dropdown = dropdowns[id];
    if (dropdown && dropdown.onSelect) {
      dropdown.onSelect(option);
    }
    closeDropdown(id);
  };

  return (
    <DropdownContext.Provider value={{ openDropdown, closeDropdown, dropdowns, selectOption }}>
      {children}
      <RenderedDropdowns dropdowns={dropdowns} onSelect={selectOption} />
    </DropdownContext.Provider>
  );
};

const RenderedDropdowns = ({ dropdowns, onSelect }) => {
  const ids = Object.keys(dropdowns);
  if (ids.length === 0) return null;

  return (
    <>
      {ids.map(id => {
        const dd = dropdowns[id];
        if (!dd.isOpen) return null;
        return (
          <View key={id} style={[GD.overlay, { top: dd.y, left: dd.x }]}>
            <View style={[GD.menu, { width: dd.width }]}>
              {dd.options.map(opt => (
                <TouchableOpacity
                  key={opt}
                  style={GD.item}
                  onPress={() => onSelect(id, opt)}
                  activeOpacity={0.75}
                >
                  <Text style={GD.itemText}>{opt}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        );
      })}
      {ids.length > 0 && (
        <TouchableOpacity
          style={GD.backdrop}
          activeOpacity={1}
          onPress={() => ids.forEach(id => onSelect(id, null))}
        />
      )}
    </>
  );
};

const GD = StyleSheet.create({
  overlay:  { position: 'absolute', zIndex: 99999 },
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 99998 },
  menu:     { backgroundColor: COLORS.white, borderRadius: 8, borderWidth: 1, borderColor: COLORS.lightGray, elevation: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.25, shadowRadius: 12 },
  item:     { paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.lightGray },
  itemText: { fontSize: 12, color: COLORS.darkText },
});

// ─── MODAL FIELD HELPERS ─────────────────────────────────────────────────────
const MField = ({ label, value, onChange, placeholder, error, editable = true }) => (
  <View style={M.fieldWrap}>
    <Text style={M.fieldLabel}>{label}</Text>
    <View style={[M.inputContainer, !editable && M.inputDisabled, error && M.inputError]}>
      <TextInput
        style={[M.input, !editable && M.inputNoEdit]}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor="rgba(0,0,0,0.3)"
        editable={editable}
      />
    </View>
    {error ? <Text style={M.errorText}>{error}</Text> : null}
  </View>
);

// ─── CREATE BARANGAY MODAL ────────────────────────────────────────────────────
const CreateBarangayModal = ({ visible, onClose, onSave }) => {
  const [form, setForm] = useState({ barangayName: '' });
  const [errors, setErrors] = useState({});
  const [confirmed, setConfirmed] = useState(false);

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));

  const validateForm = () => {
    const newErrors = {};
    if (!form.barangayName.trim()) newErrors.barangayName = 'Barangay name is required';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = () => {
    if (validateForm() && confirmed) {
      onSave(form);
      onClose();
    }
  };

  const handleClose = () => {
    setForm({ barangayName: '' });
    setErrors({});
    setConfirmed(false);
    onClose();
  };

  if (!visible) return null;

  return (
    <View style={M.overlay}>
      <View style={M.modal}>

        {/* ── Header band ── */}
        <View style={M.modalHeader}>
          <TouchableOpacity style={M.closeBtn} onPress={handleClose} activeOpacity={0.8}>
            <Text style={M.closeX}>✕</Text>
          </TouchableOpacity>
          <Text style={M.title}>ADD BARANGAY</Text>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 4 }}>
          <View style={M.modalBody}>

            {/* ── Single-column form ── */}
            <View style={M.formCols}>
              <View style={M.col}>
                <Text style={M.colHeading}>Barangay Details</Text>
                <View style={M.colDivider} />
                <MField
                  label="Barangay Name"
                  value={form.barangayName}
                  onChange={v => { set('barangayName', v); setErrors(e => ({ ...e, barangayName: null })); }}
                  placeholder="Enter barangay name"
                  error={errors.barangayName}
                />
              </View>
            </View>

            {/* ── Preview summary card ── */}
            <View style={M.previewCard}>
              <View style={M.previewCols}>
                <View style={M.previewColFull}>
                  <Text style={M.previewHeading}>Barangay Details</Text>
                  <View style={M.previewRow}>
                    <Text style={M.previewLabel}>Barangay Name</Text>
                    <Text style={M.previewVal}>{form.barangayName || '—'}</Text>
                  </View>
                </View>
              </View>

              {/* Confirm Details checkbox */}
              <View style={M.confirmRow}>
                <Text style={M.confirmLabel}>Confirm Details</Text>
                <TouchableOpacity
                  style={[M.confirmBox, confirmed && M.confirmBoxChecked]}
                  onPress={() => setConfirmed(c => !c)}
                  activeOpacity={0.8}
                >
                  {confirmed && <Text style={M.confirmCheck}>✓</Text>}
                </TouchableOpacity>
              </View>
            </View>

          </View>
        </ScrollView>

        {/* ── Footer buttons ── */}
        <View style={M.actions}>
          <TouchableOpacity style={M.cancelBtn} onPress={handleClose} activeOpacity={0.8}>
            <Text style={M.cancelText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[M.saveBtn, !confirmed && M.saveBtnDisabled]}
            onPress={handleSave}
            activeOpacity={confirmed ? 0.85 : 1}
          >
            <Text style={M.saveText}>Add Barangay</Text>
          </TouchableOpacity>
        </View>

      </View>
    </View>
  );
};

const M = StyleSheet.create({
  overlay:           { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', zIndex: 99999 },
  modal:             { backgroundColor: COLORS.offWhite, borderRadius: 16, width: isMobile ? '96%' : 480, maxHeight: '88%', flexShrink: 1, shadowColor: '#000', shadowOffset: {width:0,height:12}, shadowOpacity: 0.4, shadowRadius: 28, elevation: 28, overflow: 'hidden' },
  modalHeader:       { backgroundColor: COLORS.navy, paddingHorizontal: 20, paddingTop: 18, paddingBottom: 16 },
  closeBtn:          { position: 'absolute', top: 12, right: 14, zIndex: 10, width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
  closeX:            { fontSize: 14, color: COLORS.white, fontWeight: '700', lineHeight: 16 },
  title:             { fontSize: isMobile ? 11 : 13, fontWeight: '800', color: COLORS.white, letterSpacing: 0.5, paddingRight: 36, lineHeight: 18 },
  modalBody:         { padding: 18, paddingBottom: 0 },
  formCols:          { flexDirection: 'column', gap: 14, marginBottom: 14 },
  col:               { flex: 1, backgroundColor: COLORS.white, borderRadius: 10, padding: 14, borderWidth: 1, borderColor: COLORS.lightGray },
  colHeading:        { fontSize: 12, fontWeight: '800', color: COLORS.navy, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  colDivider:        { height: 1, backgroundColor: COLORS.lightGray, marginBottom: 12 },
  fieldWrap:         { marginBottom: 10, position: 'relative' },
  fieldLabel:        { fontSize: 11, color: COLORS.subText, fontWeight: '600', marginBottom: 4 },
  inputContainer:    { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.white, borderRadius: 7, borderWidth: 1, borderColor: '#D0D0D0' },
  input:             { flex: 1, borderRadius: 7, paddingHorizontal: 10, paddingVertical: 7, fontSize: 12, color: COLORS.darkText, height: 36 },
  inputDisabled:     { backgroundColor: '#F0F0F0' },
  inputNoEdit:       { backgroundColor: '#F0F0F0', color: COLORS.subText },
  inputError:        { borderColor: '#C62828', borderWidth: 1.5 },
  errorText:         { fontSize: 10, color: '#C62828', marginTop: 3 },
  previewCard:       { backgroundColor: COLORS.white, borderRadius: 10, padding: 14, marginBottom: 14, borderWidth: 1, borderColor: COLORS.lightGray },
  previewCols:       { flexDirection: 'row', gap: 0 },
  previewColFull:    { flex: 1 },
  previewHeading:    { fontSize: 11, fontWeight: '700', color: COLORS.navy, marginBottom: 8, textAlign: 'center', backgroundColor: '#EEF3FB', paddingVertical: 4, borderRadius: 5 },
  previewRow:        { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 6, alignItems: 'flex-start' },
  previewLabel:      { fontSize: 10, color: COLORS.subText, fontWeight: '600', minWidth: 100 },
  previewVal:        { fontSize: 10, color: COLORS.darkText, flex: 1, marginLeft: 4 },
  confirmRow:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: COLORS.lightGray, gap: 8 },
  confirmLabel:      { fontSize: 12, fontWeight: '600', color: COLORS.subText },
  confirmBox:        { width: 22, height: 22, borderRadius: 5, borderWidth: 1.5, borderColor: COLORS.midGray, backgroundColor: COLORS.white, alignItems: 'center', justifyContent: 'center' },
  confirmBoxChecked: { backgroundColor: COLORS.navy, borderColor: COLORS.navy },
  confirmCheck:      { fontSize: 13, color: COLORS.white, fontWeight: '900' },
  actions:           { flexDirection: 'row', gap: 10, paddingHorizontal: 18, paddingVertical: 14, backgroundColor: COLORS.white, borderTopWidth: 1, borderTopColor: COLORS.lightGray },
  cancelBtn:         { flex: 1, backgroundColor: COLORS.offWhite, borderRadius: 8, paddingVertical: 12, alignItems: 'center', borderWidth: 1, borderColor: COLORS.lightGray },
  cancelText:        { fontSize: 13, fontWeight: '600', color: COLORS.subText },
  saveBtn:           { flex: 2, backgroundColor: COLORS.navy, borderRadius: 8, paddingVertical: 12, alignItems: 'center' },
  saveBtnDisabled:   { opacity: 0.4 },
  saveText:          { fontSize: 13, fontWeight: '700', color: COLORS.white },
});

// ─── BARANGAY LIST ROW ────────────────────────────────────────────────────────
const BarangayListRow = ({ barangay, isEven }) => (
  <View style={[styles.tableRow, isEven && styles.tableRowEven]}>
    <View style={styles.colBrgyName}>
      <Text style={styles.cellText} numberOfLines={1}>{barangay.barangay_name || '—'}</Text>
    </View>
    <View style={styles.colDateCreated}>
      <Text style={styles.cellText} numberOfLines={1}>
        {barangay.created_at
          ? new Date(barangay.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
          : '—'}
      </Text>
    </View>
  </View>
);

// ─── MAIN SCREEN ──────────────────────────────────────────────────────────────
export default function LYDOBarangayScreen() {
  const router = useRouter();
  const { activeTab, setActiveTab } = useNav();
  const { logout } = useAuth();

  const [activeBarangayTab, setActiveBarangayTab] = useState('Barangay');
  const [barangays, setBarangays]   = useState([]);
  const [searchText, setSearchText] = useState('');
  const [notifCount]                = useState(2);
  const [sidebarVisible, setSidebarVisible] = useState(false);
  const [loading, setLoading]       = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [currentTime, setCurrentTime] = useState('');

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

  // ── Fetch data from Supabase ─────────────────────────────────────────────────
  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('barangays')
        .select('barangay_id, barangay_name, created_at')
        .order('barangay_name');

      if (error) {
        Alert.alert('Error', 'Failed to load barangays');
        console.error(error);
      } else {
        setBarangays(data || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateBarangay = async (form) => {
    const name = form.barangayName.trim();

    const duplicate = barangays.find(
      b => b.barangay_name?.toLowerCase() === name.toLowerCase()
    );
    if (duplicate) {
      Alert.alert('Duplicate', `"${name}" already exists in the list.`);
      return;
    }

    try {
      const { error } = await supabase
        .from('barangays')
        .insert({
          barangay_name: name,
          municipality: 'Rizal',
          province: 'Laguna'
        });

      if (error) {
        if (error.code === '23505') {
          Alert.alert('Duplicate', `"${name}" already exists in the database.`);
        } else {
          Alert.alert('Error', `Failed to add barangay.\n${error.message}`);
          console.error(error);
        }
      } else {
        Alert.alert('Success', `"${name}" has been added successfully.`);
        fetchData();
      }
    } catch (err) {
      Alert.alert('Error', 'An unexpected error occurred.');
      console.error(err);
    }
  };

  // ── Filtering ────────────────────────────────────────────────────────────────
  const filtered = barangays.filter(b => {
    const q = searchText.toLowerCase();
    return !q || b.barangay_name?.toLowerCase().includes(q);
  });

  // ── Navigation ──────────────────────────────────────────────────────────────
  const handleNavPress = (tab) => {
    setActiveTab(tab);
    setSidebarVisible(false);
    if (tab === 'Dashboard') router.push('/(tabs)/lydo-dashboard');
    if (tab === 'Documents') router.push('/(tabs)/lydo-document');
    if (tab === 'Monitor')   router.push('/(tabs)/lydo-monitor');
    if (tab === 'Barangay')  router.push('/(tabs)/lydo-accounts');
      if (tab === 'Logs')      router.push('/(tabs)/lydo-logs');
  };

  const handleLogout = () => { logout(); router.replace('/'); };

  const handleBarangayTabPress = (tab) => {
    if (tab === 'List of Accounts') { router.push('/(tabs)/lydo-accounts'); return; }
    if (tab === 'Barangay')         { router.push('/(tabs)/lydo-barangay'); return; }
    setActiveBarangayTab(tab);
  };

  // ── Sidebar ─────────────────────────────────────────────────────────────────
  const NAV_ITEMS = [
    { tab: 'Dashboard', IconComponent: DashboardIcon },
    { tab: 'Documents', IconComponent: DocumentsIcon },
    { tab: 'Monitor',   IconComponent: MonitorIcon   },
    { tab: 'Barangay',  IconComponent: BarangayIcon  },
    { tab: 'Logs',      IconComponent: LogsIcon      },
  ];

  const renderSidebar = () => (
    <View style={styles.sidebar}>
      <View style={styles.logoPill}>
        <Image
          source={require('./../../assets/images/lydo-logo.png')}
          style={styles.logoImage}
          resizeMode="contain"
        />
      </View>
      <View style={styles.sidebarSpacer} />
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

  // ── Main Content ─────────────────────────────────────────────────────────────
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
          <Text style={styles.mobileTitle}>Barangay Management</Text>
          <TouchableOpacity style={styles.bellBtn}>
            <BellIcon hasNotif={notifCount > 0} />
          </TouchableOpacity>
        </View>
      )}

      {/* Desktop Header */}
      {!isMobile && (
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
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

      {/* ── Monitor Tabs ── */}
      <View style={styles.monitorTabBar}>
        {BARANGAY_TABS.map(tab => {
          const active = activeBarangayTab === tab;
          const hasNotif = NOTIF_TABS.has(tab);
          return (
            <TouchableOpacity
              key={tab}
              style={[styles.monitorTab, active && styles.monitorTabActive]}
              onPress={() => handleBarangayTabPress(tab)}
              activeOpacity={0.8}
            >
              <Text style={[styles.monitorTabText, active && styles.monitorTabTextActive]}>
                {tab}
              </Text>
              {hasNotif && !active && <View style={styles.tabNotifDot} />}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* ── Toolbar: Search | + Barangay ── */}
      <View style={styles.toolbar}>
        <View style={styles.searchWrap}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Search"
            placeholderTextColor={COLORS.midGray}
            value={searchText}
            onChangeText={setSearchText}
          />
          {searchText.length > 0 && (
            <TouchableOpacity onPress={() => setSearchText('')} activeOpacity={0.7}>
              <Text style={styles.searchClear}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity style={styles.createBtn} onPress={() => setShowCreate(true)} activeOpacity={0.85}>
          <Text style={styles.createBtnPlus}>＋</Text>
          <Text style={styles.createBtnText}>Barangay</Text>
        </TouchableOpacity>
      </View>

      {/* ── List of Accounts heading ── */}
      <View style={styles.listHeadingRow}>
        <Text style={styles.listHeading}>List of Accounts</Text>
      </View>

      {/* ── Table ── */}
      <View style={styles.tableContainer}>
        {/* Header */}
        <View style={styles.tableHeader}>
          {[
            ['Barangay Name', styles.colBrgyName],
            ['Date Created',  styles.colDateCreated],
          ].map(([col, colStyle]) => (
            <View key={col} style={colStyle}>
              <Text style={styles.tableHeaderText}>{col}</Text>
            </View>
          ))}
        </View>

        {/* Rows */}
        {loading ? (
          <View style={styles.emptyState}>
            <ActivityIndicator size="large" color={COLORS.navy} />
            <Text style={styles.emptyText}>Loading barangays...</Text>
          </View>
        ) : filtered.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No barangays found.</Text>
          </View>
        ) : (
          filtered.map((brgy, idx) => (
            <BarangayListRow
              key={brgy.barangay_id}
              barangay={brgy}
              isEven={idx % 2 !== 0}
            />
          ))
        )}
      </View>

    </ScrollView>
  );

  return (
    <GlobalDropdownProvider>
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
          {isMobile ? (sidebarVisible && renderSidebar()) : renderSidebar()}
          {renderContent()}
        </View>

        {showCreate && (
          <CreateBarangayModal
            visible={showCreate}
            onClose={() => setShowCreate(false)}
            onSave={handleCreateBarangay}
          />
        )}
      </SafeAreaView>
    </GlobalDropdownProvider>
  );
}

// ─── STYLES ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: COLORS.navy },
  layout: { flex: 1, flexDirection: 'row' },

  // ── Sidebar ──────────────────────────────────────────────────────────────────
  sidebar: {
    width: 250, backgroundColor: COLORS.navy,
    alignItems: 'center', paddingTop: 20, paddingBottom: 24,
    paddingHorizontal: 10, zIndex: 10,
  },
  sidebarOverlay: { position: 'absolute', left: 0, top: 0, bottom: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 5 },

  logoPill:      { marginTop: 20, width: 70, height: 70, borderRadius: 35, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center', marginBottom: 8, borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)' },
  logoImage:     { width: 110, height: 110 },
  sidebarSpacer: { height: 28 },
  navItemInner:  { flexDirection: 'row', alignItems: 'center', gap: 10 },
  navItem:       { width: '100%', paddingVertical: 12, paddingHorizontal: 12, borderRadius: 24, marginBottom: 8, alignItems: 'center', borderWidth: 1.5, borderColor: COLORS.white, backgroundColor: COLORS.navy },
  navItemActive: { backgroundColor: COLORS.white, borderColor: COLORS.white },
  navLabel:      { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.8)', letterSpacing: 0.3 },
  navLabelActive:{ color: '#000', fontWeight: '800' },
  logoutBtn:     { width: '100%', paddingVertical: 12, paddingHorizontal: 12, borderRadius: 24, marginTop: 8, alignItems: 'center', borderWidth: 1.5, borderColor: COLORS.white, backgroundColor: 'rgba(255,255,255,0.1)' },
  logoutText:    { fontSize: 13, fontWeight: '600', color: COLORS.white, letterSpacing: 0.3 },

  // ── Main ─────────────────────────────────────────────────────────────────────
  main:        { flex: 1, backgroundColor: COLORS.offWhite, borderTopLeftRadius: 20 },
  mainMobile:  { borderTopLeftRadius: 0 },
  mainContent: { padding: 20, paddingBottom: 40 },

  // ── Mobile header ────────────────────────────────────────────────────────────
  mobileHeader:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: COLORS.lightGray },
  menuBtn:           { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.cardBg, alignItems: 'center', justifyContent: 'center' },
  menuIconContainer: { width: 20, height: 16, justifyContent: 'space-between' },
  menuLine:          { width: 20, height: 2, backgroundColor: COLORS.navy, borderRadius: 1 },
  mobileTitle:       { fontSize: 16, fontWeight: '800', color: COLORS.darkText },

  // ── Desktop header ───────────────────────────────────────────────────────────
  header:      { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 18 },
  headerSub:   { fontSize: 10, fontWeight: '600', color: COLORS.subText, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 2 },
  headerTitle: { fontSize: 20, fontWeight: '900', color: COLORS.darkText, letterSpacing: 0.5, borderBottomWidth: 2, borderBottomColor: COLORS.lightGray },

  // Datetime card
  datetimeCard: { backgroundColor: '#F7F5F2', borderRadius: 12, paddingVertical: 10, paddingHorizontal: 16, borderWidth: 1, borderColor: '#E0DDD9', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  datetimeRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  datetimeSeparator: { width: 1, height: 36, backgroundColor: '#D0CCC8', marginHorizontal: 4 },
  datetimeDivider: { width: 3, height: 28, borderRadius: 2, backgroundColor: '#133E75' },
  datetimeBlock: { flexDirection: 'column' },
  datetimeLabel: { fontSize: 9, fontWeight: '700', color: '#666666', letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 1 },
  datetimeValue: { fontSize: 13, fontWeight: '700', color: '#1A1A1A', letterSpacing: 0.2 },
  datetimeTime: { fontVariant: ['tabular-nums'], color: '#133E75', fontSize: 14, fontWeight: '800' },

  // Bell
  bellBtn:        { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.cardBg, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 6, elevation: 3 },
  bellWrapper:    { width: 20, height: 22, alignItems: 'center' },
  bellBody:       { width: 14, height: 12, borderRadius: 7, borderWidth: 2, borderColor: '#8B0000', marginTop: 4 },
  bellBottom:     { width: 8, height: 4, borderBottomLeftRadius: 4, borderBottomRightRadius: 4, backgroundColor: '#8B0000', marginTop: -1 },
  bellDot:        { position: 'absolute', top: 0, right: 1, width: 7, height: 7, borderRadius: 4, backgroundColor: COLORS.gold, borderWidth: 1.5, borderColor: COLORS.cardBg },
  notifBadge:     { position: 'absolute', top: -2, right: -2, width: 16, height: 16, borderRadius: 8, backgroundColor: COLORS.gold, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: COLORS.white },
  notifBadgeText: { fontSize: 8, fontWeight: '900', color: COLORS.navy },

  // ── Monitor tabs ─────────────────────────────────────────────────────────────
  monitorTabBar:        { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: COLORS.lightGray, marginBottom: 14, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.30, shadowRadius: 3, elevation: 6 },
  monitorTab:           { flex: 1, paddingHorizontal: isMobile ? 8 : 40, backgroundColor: COLORS.navy, paddingVertical: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', alignItems: 'center', position: 'relative' },
  monitorTabActive:     { backgroundColor: COLORS.gold, borderRadius: 4, borderColor: COLORS.gold, shadowColor: COLORS.gold, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.4, shadowRadius: 4, elevation: 3 },
  monitorTabText:       { fontSize: isMobile ? 10 : 13, fontWeight: '600', color: COLORS.white },
  monitorTabTextActive: { color: COLORS.darkText, fontWeight: '800' },
  tabNotifDot:          { position: 'absolute', top: 6, right: 8, width: 8, height: 8, borderRadius: 4, backgroundColor: '#E53935' },

  // ── Toolbar ──────────────────────────────────────────────────────────────────
  toolbar:       { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
  createBtn:     { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#7BAFD4', borderRadius: 20, paddingHorizontal: 18, paddingVertical: 6, shadowColor: '#7BAFD4', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.35, shadowRadius: 6, elevation: 3 },
  createBtnPlus: { fontSize: 18, fontWeight: '300', color: COLORS.white, lineHeight: 20 },
  createBtnText: { fontSize: 14, fontWeight: '500', color: COLORS.white },
  searchWrap:    { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.white, borderRadius: 20, borderWidth: 1, borderColor: COLORS.lightGray, paddingHorizontal: 10, paddingVertical: 6, width: isMobile ? 160 : 220 },
  searchIcon:    { fontSize: 12, marginRight: 4 },
  searchInput:   { flex: 1, fontSize: 11, color: COLORS.darkText, padding: 0 },
  searchClear:   { color: COLORS.midGray, fontSize: 12 },

  // ── List heading ─────────────────────────────────────────────────────────────
  listHeadingRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  listHeading:    { fontSize: isMobile ? 13 : 15, fontWeight: '800', color: COLORS.navy },

  // ── Table ─────────────────────────────────────────────────────────────────────
  tableContainer:  { backgroundColor: COLORS.white, borderRadius: 10, overflow: 'hidden', borderWidth: 1, borderColor: COLORS.lightGray, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6 },
  tableHeader:     { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.white, paddingVertical: 10, paddingHorizontal: 10, borderBottomWidth: 1, borderBottomColor: COLORS.lightGray },
  tableHeaderText: { fontSize: isMobile ? 9 : 11, fontWeight: '700', color: COLORS.darkText, letterSpacing: 0.1 },
  tableRow:        { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 10, borderBottomWidth: 1, borderBottomColor: COLORS.lightGray, backgroundColor: COLORS.white, minHeight: 44 },
  tableRowEven:    { backgroundColor: '#FAFAFA' },
  cellText:        { fontSize: isMobile ? 9 : 11, color: COLORS.darkText },

  // Columns matching the screenshot (Barangay Name | Date Created)
  colBrgyName:    { flex: 1.5, paddingRight: 6 },
  colDateCreated: { flex: 1.2 },

  emptyState: { alignItems: 'center', paddingVertical: 40 },
  emptyText:  { fontSize: 14, color: COLORS.midGray },
});