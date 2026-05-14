import React, { useState, useEffect, useContext, useRef } from 'react';
import {
  View, Text, TextInput, ScrollView, TouchableOpacity,
  StyleSheet, SafeAreaView, StatusBar, Dimensions,
  Alert, Image, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useNav } from './navContext';
import { useAuth, encryptPassword, decryptPassword } from './authContext';
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

const NAV_TABS     = ['Dashboard', 'Documents', 'Monitor'];
const MONITOR_TABS = ['Consultation', 'Budget', 'Report', 'Account'];
// Tabs that show a red notification badge
const NOTIF_TABS   = new Set(['Consultation', 'Budget']);

// ─── DROPDOWN OPTIONS ─────────────────────────────────────────────────────────
let BARANGAY_OPTIONS = ['Select Barangay'];
const FILTER_BARANGAY_OPTIONS = ['All Barangays'];

const POSITION_DISPLAY = {
  'chairman': 'SK Chairperson',
  'secretary': 'SK Secretary',
  'treasurer': 'SK Treasurer',
  'sk_federation': 'SK Federation',
};

const POSITION_CODES = {
  'Chairman': 'CHR',
  'Secretary': 'SEC',
  'Treasurer': 'TRS',
  'SK Federation': 'SF',
};

const ROLE_DISPLAY = {
  'lydo': 'LYDO',
  'sk_official': 'SK Official',
  'resident': 'Resident',
};

const ROLE_OPTIONS = Object.values(ROLE_DISPLAY);
const POSITION_OPTIONS = Object.values(POSITION_DISPLAY);

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

// ─── CHECKBOX ─────────────────────────────────────────────────────────────────
const Checkbox = ({ checked, onToggle }) => (
  <TouchableOpacity
    style={[CB.box, checked && CB.boxChecked]}
    onPress={onToggle}
    activeOpacity={0.75}
  >
    {checked && <Text style={CB.check}>✓</Text>}
  </TouchableOpacity>
);

const CB = StyleSheet.create({
  box:        { width: 18, height: 18, borderRadius: 3, borderWidth: 1.5, borderColor: COLORS.midGray, backgroundColor: COLORS.white, alignItems: 'center', justifyContent: 'center' },
  boxChecked: { backgroundColor: COLORS.checkBlue, borderColor: COLORS.checkBlue },
  check:      { fontSize: 11, color: COLORS.white, fontWeight: '900', lineHeight: 14 },
});

// ─── GLOBAL DROPDOWN CONTEXT ────────────────────────────────────────────────────
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
    // Skip if no option selected (clicked backdrop)
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
  overlay:    { position: 'absolute', zIndex: 99999 },
  backdrop:   { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 99998 },
  menu:       { backgroundColor: COLORS.white, borderRadius: 8, borderWidth: 1, borderColor: COLORS.lightGray, elevation: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.25, shadowRadius: 12 },
  item:       { paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.lightGray },
  itemText:   { fontSize: 12, color: COLORS.darkText },
});

// ─── INLINE DROPDOWN ──────────────────────────────────────────────────────────
const InlineDropdown = ({ value, options, onSelect, width = 120, id }) => {
  const { openDropdown, closeDropdown } = useContext(DropdownContext) || {};
  const ref = useRef(null);

  const handlePress = () => {
    if (openDropdown && id) {
      openDropdown(id, ref, options, onSelect, width);
    }
  };

  return (
    <View ref={ref} style={[IDD.wrap, { width }]}>
      <TouchableOpacity
        style={IDD.btn}
        onPress={handlePress}
        activeOpacity={0.8}
      >
        <Text style={IDD.value} numberOfLines={1}>{value}</Text>
        <Text style={IDD.arrow}>▾</Text>
      </TouchableOpacity>
    </View>
  );
};

const IDD = StyleSheet.create({
  wrap:          { position: 'relative', zIndex: 1000 },
  btn:           { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: COLORS.white, borderRadius: 6, borderWidth: 1, borderColor: '#C8C8C8', paddingHorizontal: 8, paddingVertical: 5 },
  value:         { fontSize: 11, color: COLORS.darkText, flex: 1 },
  arrow:         { fontSize: 9, color: COLORS.subText, marginLeft: 4 },
  menu:          { position: 'absolute', top: 30, left: 0, backgroundColor: COLORS.white, borderRadius: 8, borderWidth: 1, borderColor: COLORS.lightGray, elevation: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.25, shadowRadius: 12, zIndex: 1001 },
  item:          { paddingHorizontal: 12, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: COLORS.lightGray },
  itemActive:    { backgroundColor: '#EEF3FB' },
  itemText:      { fontSize: 11, color: COLORS.darkText },
  itemTextActive:{ fontWeight: '700', color: COLORS.navy },
});

// ─── FILTER DROPDOWN ──────────────────────────────────────────────────────────
const FilterDropdown = ({ value, options, onSelect }) => {
  const [open, setOpen] = useState(false);
  return (
    <View style={FD.wrap}>
      <TouchableOpacity style={FD.btn} onPress={() => setOpen(o => !o)} activeOpacity={0.8}>
        <Text style={FD.label} numberOfLines={1}>{value}</Text>
        <View style={FD.divider} />
        <Text style={FD.arrow}>▼</Text>
      </TouchableOpacity>
      {open && (
        <View style={FD.menu}>
          {options.map(opt => (
            <TouchableOpacity
              key={opt}
              style={[FD.item, opt === value && FD.itemActive]}
              onPress={() => { onSelect(opt); setOpen(false); }}
              activeOpacity={0.75}
            >
              <Text style={[FD.itemText, opt === value && FD.itemTextActive]} numberOfLines={1}>{opt}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
};

const FD = StyleSheet.create({
  wrap:          { position: 'relative', zIndex: 1000, alignSelf: 'flex-start' },
  btn:           { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.white, borderRadius: 6, borderWidth: 1, borderColor: '#B0B8C8', minWidth: 180, height: 36 },
  label:         { flex: 1, fontSize: 13, color: COLORS.darkText, fontWeight: '400', paddingHorizontal: 12 },
  divider:       { width: 1, height: '100%', backgroundColor: '#B0B8C8' },
  arrow:         { fontSize: 10, color: COLORS.darkText, paddingHorizontal: 10 },
  menu:          { position: 'absolute', top: 38, left: 0, minWidth: 200, backgroundColor: COLORS.white, borderRadius: 8, borderWidth: 1, borderColor: COLORS.lightGray, elevation: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.25, shadowRadius: 12, zIndex: 1001 },
  item:          { paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.lightGray },
  itemActive:    { backgroundColor: '#EEF3FB' },
  itemText:      { fontSize: 12, color: COLORS.darkText },
  itemTextActive:{ fontWeight: '700', color: COLORS.navy },
});

// ─── STATUS PILL ──────────────────────────────────────────────────────────────
const StatusPill = ({ status }) => {
  if (status === 'active') {
    return (
      <View style={STP.pill}>
        <Text style={STP.text}>Pending Verification</Text>
      </View>
    );
  }
  if (status === 'active') {
    return (
      <View style={[STP.pill, { backgroundColor: '#E8F5E9', borderColor: '#81C784' }]}>
        <Text style={[STP.text, { color: COLORS.approve }]}>Active</Text>
      </View>
    );
  }
  if (status === 'inactive') {
    return (
      <View style={[STP.pill, { backgroundColor: '#FFEBEE', borderColor: '#EF9A9A' }]}>
        <Text style={[STP.text, { color: '#C62828' }]}>Inactive</Text>
      </View>
    );
  }
  return null;
};

const STP = StyleSheet.create({
  pill: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5, backgroundColor: COLORS.pendingBg, borderWidth: 1, borderColor: COLORS.pendingBdr, alignSelf: 'flex-start' },
  text: { fontSize: isMobile ? 8 : 10, fontWeight: '700', color: COLORS.pending },
});

// ─── CREATE ACCOUNT MODAL ─────────────────────────────────────────────────────
const CreateAccountModal = ({ visible, onClose, onSave, barangays }) => {
  const [form, setForm] = useState({
    lastName: '', firstName: '', middleInitial: '',
    position: '', role: 'SK',
    barangay: '', email: '', password: '',
  });
  const [errors, setErrors] = useState({});
  const [confirmed, setConfirmed] = useState(false);
  const [showPosDd, setShowPosDd] = useState(false);
  const [showBrgyDd, setShowBrgyDd] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const positionOpts = ['Chairman', 'Secretary', 'Treasurer', 'SK Federation'];
  const barangayOpts = barangays.map(b => b.barangay_name);

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));

  // Validate form fields
  const validateForm = () => {
    const newErrors = {};
    if (!form.barangay) newErrors.barangay = 'Barangay is required';
    if (!form.lastName.trim()) newErrors.lastName = 'Last name is required';
    if (!form.firstName.trim()) newErrors.firstName = 'First name is required';
    if (!form.position) newErrors.position = 'Position is required';
    if (!form.email.trim()) newErrors.email = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(form.email)) newErrors.email = 'Invalid email format';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = () => {
    if (validateForm()) {
      if (confirmed) {
        onSave(form);
        onClose();
      }
    }
  };

  // Auto-generate password based on barangay, position, and year
  const generatePassword = (barangayName, position) => {
    if (!position) return '';
    const year = new Date().getFullYear();
    // Remove "Barangay " prefix and use full name, uppercase, no spaces
    const brgyCode = barangayName
      ? barangayName.replace(/^Barangay\s+/i, '').replace(/\s+/g, '').toUpperCase()
      : 'FEDR';
    const positionCode = POSITION_CODES[position] || '';
    const randomChars = Math.random().toString(36).substring(2, 5).toUpperCase();
    return `${brgyCode}${year}${positionCode}${randomChars}`;
  };

  // Update password when barangay or position changes
  useEffect(() => {
    if (form.barangay && form.position) {
      const generatedPassword = generatePassword(form.barangay, form.position);
      set('password', generatedPassword);
    }
  }, [form.barangay, form.position]);

  // ── Sub-components ──────────────────────────────────────────────────────────
  const MField = ({ label, value, onChange, secure, placeholder, isVisible, onToggle, editable = true, error }) => (
    <View style={M.fieldWrap}>
      <Text style={M.fieldLabel}>{label}</Text>
      <View style={[M.inputContainer, !editable && M.inputDisabled, error && M.inputError]}>
        <TextInput
          style={[M.input, secure && M.inputWithToggle, !editable && M.inputNoEdit]}
          value={value}
          onChangeText={onChange}
          placeholder={placeholder || ''}
          placeholderTextColor="rgba(0,0,0,0.3)"
          secureTextEntry={secure && !isVisible}
          editable={editable}
        />
        {secure && (
          <TouchableOpacity style={M.toggleBtn} onPress={onToggle} activeOpacity={0.7}>
            <Text style={M.toggleText}>{isVisible ? '👁' : '⌣'}</Text>
          </TouchableOpacity>
        )}
      </View>
      {error && <Text style={M.errorText}>{error}</Text>}
    </View>
  );

  const MDropdown = ({ label, value, options, open, setOpen, onSelect, placeholder, scrollable, error }) => (
    <View style={[M.fieldWrap, { zIndex: open ? 999 : 1 }]}>
      <Text style={M.fieldLabel}>{label}</Text>
      <TouchableOpacity style={[M.ddBtn, error && M.ddBtnError]} onPress={() => setOpen(o => !o)} activeOpacity={0.85}>
        <Text style={[M.ddVal, !value && M.ddPlaceholder]}>{value || placeholder}</Text>
        <Text style={M.ddArrow}>▼</Text>
      </TouchableOpacity>
      {open && (
        <View style={[M.ddMenu, scrollable && M.ddMenuScrollable]}>
          {scrollable ? (
            <ScrollView
              style={{ maxHeight: 5 * 37 }}
              showsVerticalScrollIndicator={false}
              nestedScrollEnabled={true}
            >
              {options.map(opt => (
                <TouchableOpacity key={opt} style={M.ddItem} onPress={() => { onSelect(opt); setOpen(false); }} activeOpacity={0.75}>
                  <Text style={M.ddItemText}>{opt}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          ) : (
            options.map(opt => (
              <TouchableOpacity key={opt} style={M.ddItem} onPress={() => { onSelect(opt); setOpen(false); }} activeOpacity={0.75}>
                <Text style={M.ddItemText}>{opt}</Text>
              </TouchableOpacity>
            ))
          )}
        </View>
      )}
      {error && <Text style={M.errorText}>{error}</Text>}
    </View>
  );

  const PreviewRow = ({ label, value, isPassword, showPassword }) => (
    <View style={M.previewRow}>
      <Text style={M.previewLabel}>{label} :</Text>
      {isPassword ? (
        <Text style={M.previewVal}>{showPassword ? value : '••••••••'}</Text>
      ) : (
        <Text style={M.previewVal}>{value || ''}</Text>
      )}
    </View>
  );

  // Reset form when modal closes
  const handleClose = () => {
    setForm({
      lastName: '', firstName: '', middleInitial: '',
      position: '', role: 'SK',
      barangay: '', email: '', password: '',
    });
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
          <Text style={M.title}>CREATE ACCOUNT FOR SANGGUNIANG KABATAAN OFFICIALS</Text>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 4 }}>
          <View style={M.modalBody}>

          {/* ── Two-column form ── */}
          <View style={M.formCols}>

            {/* Left — Personal Details */}
            <View style={M.col}>
              <Text style={M.colHeading}>Personal Details</Text>
              <View style={M.colDivider} />

              <MDropdown
                label="Barangay"
                value={form.barangay}
                options={barangayOpts}
                open={showBrgyDd}
                setOpen={setShowBrgyDd}
                onSelect={v => { set('barangay', v); setErrors(e => ({ ...e, barangay: null })); }}
                placeholder="Select Barangay"
                scrollable
                error={errors.barangay}
              />
              <MField label="Last Name"      value={form.lastName}      onChange={v => { set('lastName', v); setErrors(e => ({ ...e, lastName: null })); }}      placeholder="Enter last name" error={errors.lastName} />
              <MField label="First Name"     value={form.firstName}     onChange={v => { set('firstName', v); setErrors(e => ({ ...e, firstName: null })); }}     placeholder="Enter first name" error={errors.firstName} />
              <MField label="Middle Initial" value={form.middleInitial} onChange={v => set('middleInitial', v)} placeholder="e.g. A" />
            </View>

            {/* Right — Account & Role */}
            <View style={M.col}>
              <Text style={M.colHeading}>Account & Role</Text>
              <View style={M.colDivider} />

              <MDropdown
                label="Position"
                value={form.position}
                options={positionOpts}
                open={showPosDd}
                setOpen={setShowPosDd}
                onSelect={v => { set('position', v); setErrors(e => ({ ...e, position: null })); }}
                placeholder="Select Position"
                error={errors.position}
              />

              {/* Role — static display pill */}
              <View style={M.fieldWrap}>
                <Text style={M.fieldLabel}>Role</Text>
                <View style={M.rolePill}>
                  <Text style={M.rolePillText}>SK</Text>
                </View>
              </View>

              <MField label="Email"                  value={form.email}           onChange={v => { set('email', v); setErrors(e => ({ ...e, email: null })); }}           placeholder="e.g. juan@email.com" error={errors.email} />
              <MField label="Auto Generated Password" value={form.password}        onChange={() => {}}        placeholder="Auto-generated"       secure isVisible={showPassword} onToggle={() => setShowPassword(v => !v)} editable={false} />
            </View>
          </View>

          {/* ── Preview summary card ── */}
          <View style={M.previewCard}>
            <View style={M.previewCols}>
              {/* Left preview */}
              <View style={M.previewCol}>
                <Text style={M.previewHeading}>Personal Details</Text>
                <PreviewRow label="Barangay"       value={form.barangay} />
                <PreviewRow label="Last Name"      value={form.lastName} />
                <PreviewRow label="First Name"     value={form.firstName} />
                <PreviewRow label="Middle Initial" value={form.middleInitial} />
              </View>

              {/* Vertical divider */}
              <View style={M.previewDivider} />

              {/* Right preview */}
              <View style={M.previewCol}>
                <Text style={M.previewHeading}>Account & Role</Text>
                <PreviewRow label="Position" value={form.position} />
                <PreviewRow label="Role"     value={form.role} />
                <PreviewRow label="Email"    value={form.email} />
                <PreviewRow label="Password" value={form.password} isPassword={true} showPassword={showPassword} />
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

          </View>{/* end modalBody */}
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
            <Text style={M.saveText}>Create Account</Text>
          </TouchableOpacity>
        </View>

      </View>
    </View>
  );
};

const M = StyleSheet.create({
  // Overlay & modal shell
  overlay:        { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', zIndex: 99999 },
  modal:          { backgroundColor: COLORS.offWhite, borderRadius: 16, width: isMobile ? '96%' : 660, maxHeight: '88%', flexShrink: 1, shadowColor: '#000', shadowOffset: {width:0,height:12}, shadowOpacity: 0.4, shadowRadius: 28, elevation: 28, overflow: 'hidden' },

  // Modal header band
  modalHeader:    { backgroundColor: COLORS.navy, paddingHorizontal: 20, paddingTop: 18, paddingBottom: 16 },

  // Header
  closeBtn:       { position: 'absolute', top: 12, right: 14, zIndex: 10, width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
  closeX:         { fontSize: 14, color: COLORS.white, fontWeight: '700', lineHeight: 16 },
  title:          { fontSize: isMobile ? 11 : 13, fontWeight: '800', color: COLORS.white, letterSpacing: 0.5, marginBottom: 0, paddingRight: 36, lineHeight: 18 },
  titleDivider:   { height: 0, marginBottom: 0 },

  // Modal body
  modalBody:      { padding: 18, paddingBottom: 0 },

  // Two-column form
  formCols:       { flexDirection: isMobile ? 'column' : 'row', gap: 14, marginBottom: 14 },
  col:            { flex: 1, backgroundColor: COLORS.white, borderRadius: 10, padding: 14, borderWidth: 1, borderColor: COLORS.lightGray },
  colHeading:     { fontSize: 12, fontWeight: '800', color: COLORS.navy, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  colDivider:     { height: 1, backgroundColor: COLORS.lightGray, marginBottom: 12 },

  // Fields
  fieldWrap:      { marginBottom: 10, position: 'relative' },
  fieldLabel:     { fontSize: 11, color: COLORS.subText, fontWeight: '600', marginBottom: 4 },
  inputContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.white, borderRadius: 7, borderWidth: 1, borderColor: '#D0D0D0' },
  input:          { flex: 1, borderRadius: 7, paddingHorizontal: 10, paddingVertical: 7, fontSize: 12, color: COLORS.darkText, height: 36 },
  inputWithToggle: { borderWidth: 0, borderRadius: 0 },
  toggleBtn:      { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderLeftWidth: 1, borderLeftColor: '#D0D0D0' },
  toggleText:     { fontSize: 14 },

  // Disabled state
  inputDisabled:  { backgroundColor: '#F0F0F0' },
  inputNoEdit:    { backgroundColor: '#F0F0F0', color: COLORS.subText },
  inputError:     { borderColor: '#C62828', borderWidth: 1.5 },

  // Error text
  errorText:      { fontSize: 10, color: '#C62828', marginTop: 3 },

  // Dropdown error state
  ddBtnError:     { borderColor: '#C62828', borderWidth: 1.5 },

  // Dropdown
  ddBtn:          { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: COLORS.white, borderRadius: 7, borderWidth: 1, borderColor: '#D0D0D0', paddingHorizontal: 10, paddingVertical: 7, height: 36 },
  ddVal:          { fontSize: 12, color: COLORS.darkText, flex: 1 },
  ddPlaceholder:  { color: 'rgba(0,0,0,0.3)' },
  ddArrow:        { fontSize: 9, color: COLORS.subText },
  ddMenu:         { position: 'absolute', top: 60, left: 0, right: 0, backgroundColor: COLORS.white, borderRadius: 8, borderWidth: 1, borderColor: COLORS.lightGray, zIndex: 9999, elevation: 40, shadowColor: '#000', shadowOffset: {width:0,height:4}, shadowOpacity: 0.18, shadowRadius: 10 },
  ddMenuScrollable: { position: 'absolute', top: 60, left: 0, right: 0, backgroundColor: COLORS.white, borderRadius: 8, borderWidth: 1, borderColor: COLORS.lightGray, zIndex: 9999, elevation: 40, shadowColor: '#000', shadowOffset: {width:0,height:4}, shadowOpacity: 0.18, shadowRadius: 10, overflow: 'hidden' },
  ddItem:         { paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.lightGray },
  ddItemText:     { fontSize: 12, color: COLORS.darkText },

  // Role static pill
  rolePill:       { backgroundColor: '#EEF3FB', borderRadius: 7, borderWidth: 1, borderColor: '#C8D8EE', height: 36, alignItems: 'flex-start', justifyContent: 'center', paddingHorizontal: 10 },
  rolePillText:   { fontSize: 12, fontWeight: '700', color: COLORS.navy },

  // Preview card
  previewCard:    { backgroundColor: COLORS.white, borderRadius: 10, padding: 14, marginBottom: 14, borderWidth: 1, borderColor: COLORS.lightGray },
  previewTitle:   { fontSize: 11, fontWeight: '800', color: COLORS.navy, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 },
  previewCols:    { flexDirection: 'row', gap: 0 },
  previewCol:     { flex: 1, paddingRight: 10 },
  previewHeading: { fontSize: 11, fontWeight: '700', color: COLORS.navy, marginBottom: 8, textAlign: 'center', backgroundColor: '#EEF3FB', paddingVertical: 4, borderRadius: 5 },
  previewDivider: { width: 1, backgroundColor: COLORS.lightGray, marginHorizontal: 10 },
  previewRow:     { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 6, alignItems: 'flex-start' },
  previewLabel:   { fontSize: 10, color: COLORS.subText, fontWeight: '600', minWidth: 70 },
  previewVal:     { fontSize: 10, color: COLORS.darkText, flex: 1, marginLeft: 4 },

  // Confirm Details
  confirmRow:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: COLORS.lightGray, gap: 8 },
  confirmLabel:   { fontSize: 12, fontWeight: '600', color: COLORS.subText },
  confirmBox:     { width: 22, height: 22, borderRadius: 5, borderWidth: 1.5, borderColor: COLORS.midGray, backgroundColor: COLORS.white, alignItems: 'center', justifyContent: 'center' },
  confirmBoxChecked: { backgroundColor: COLORS.navy, borderColor: COLORS.navy },
  confirmCheck:   { fontSize: 13, color: COLORS.white, fontWeight: '900' },

  // Footer
  actions:        { flexDirection: 'row', gap: 10, paddingHorizontal: 18, paddingVertical: 14, backgroundColor: COLORS.white, borderTopWidth: 1, borderTopColor: COLORS.lightGray },
  cancelBtn:      { flex: 1, backgroundColor: COLORS.offWhite, borderRadius: 8, paddingVertical: 12, alignItems: 'center', borderWidth: 1, borderColor: COLORS.lightGray },
  cancelText:     { fontSize: 13, fontWeight: '600', color: COLORS.subText },
  saveBtn:        { flex: 2, backgroundColor: COLORS.navy, borderRadius: 8, paddingVertical: 12, alignItems: 'center' },
  saveBtnDisabled:{ opacity: 0.4 },
  saveText:       { fontSize: 13, fontWeight: '700', color: COLORS.white },
});

// ─── ACCOUNT LIST ROW ─────────────────────────────────────────────────────────
const AccountListRow = ({ account, isEven, isPasswordVisible, onTogglePassword }) => (
  <View style={[styles.tableRow, isEven && styles.tableRowEven]}>
    <View style={styles.colBrgy}>
      <Text style={styles.cellText} numberOfLines={1}>{account.barangay || '—'}</Text>
    </View>
    <View style={styles.colLastName}>
      <Text style={styles.cellText} numberOfLines={1}>{account.lastName || '—'}</Text>
    </View>
    <View style={styles.colFirstName}>
      <Text style={styles.cellText} numberOfLines={1}>{account.firstName || '—'}</Text>
    </View>
    <View style={styles.colMiddleInitial}>
      <Text style={styles.cellText} numberOfLines={1}>{account.middleInitial || '—'}</Text>
    </View>
    <View style={styles.colRole}>
      <Text style={styles.cellText} numberOfLines={1}>{account.roleDisplay || '—'}</Text>
    </View>
    <View style={styles.colPosition}>
      <Text style={styles.cellText} numberOfLines={1}>{account.displayPosition || '—'}</Text>
    </View>
    <View style={styles.colEmail}>
      <Text style={styles.cellText} numberOfLines={1}>{account.email || '—'}</Text>
    </View>
    <TouchableOpacity
      style={styles.colPassword}
      onPress={() => onTogglePassword(account.id)}
      activeOpacity={0.7}
    >
      <Text style={styles.cellText} numberOfLines={1}>
        {isPasswordVisible ? (account.password || '—') : '••••••••'}
      </Text>
    </TouchableOpacity>
  </View>
);

// ─── MAIN SCREEN ──────────────────────────────────────────────────────────────
export default function LYDOMonitorAccountScreen() {
  const router = useRouter();
  const { activeTab, setActiveTab } = useNav();
  const { logout } = useAuth();

  const [activeMonitorTab, setActiveMonitorTab] = useState('Account');
  const [accounts, setAccounts]         = useState([]);
  const [barangays, setBarangays]       = useState([]);
  const [selectedIds, setSelectedIds]   = useState(new Set());
  const [filterBrgy, setFilterBrgy]     = useState('All Barangays');
  const [searchText, setSearchText]     = useState('');
  const [notifCount]                    = useState(2);
  const [sidebarVisible, setSidebarVisible] = useState(false);
  const [loading, setLoading]           = useState(true);
  const [showCreate, setShowCreate]     = useState(false);
  const [visiblePasswords, setVisiblePasswords] = useState(new Set());

  // ── Fetch data from Supabase ─────────────────────────────────────────────────
  useEffect(() => {
    fetchData();
  }, []);

  const togglePasswordVisibility = (userId) => {
    setVisiblePasswords(prev => {
      const next = new Set(prev);
      if (next.has(userId)) {
        next.delete(userId);
      } else {
        next.add(userId);
      }
      return next;
    });
  };

  const fetchData = async () => {
    try {
      setLoading(true);

      const { data: barangayData, error: brgyError } = await supabase
        .from('barangays')
        .select('barangay_id, barangay_name')
        .order('barangay_name');

      if (!brgyError) {
        setBarangays(barangayData || []);
      }

      const { data: userData, error: userError } = await supabase
        .from('users')
        .select(`
          user_id,
          first_name,
          last_name,
          middle_initial,
          email,
          password,
          position,
          status,
          created_at,
          role_id,
          barangay_id,
          roles (role_name),
          barangays (barangay_name)
        `)
        .order('last_name', { ascending: true });

      if (!userError) {
        const validPositions = ['chairman', 'secretary', 'treasurer', 'sk_federation'];
        const transformedAccounts = (userData || []).map(user => {
          const roleName = user.roles?.role_name || 'resident';
          const cleanPosition = validPositions.includes(user.position) ? user.position : null;
          return {
            id: user.user_id.toString(),
            userId: user.user_id,
            firstName: user.first_name || '',
            lastName: user.last_name || '',
            middleInitial: user.middle_initial || '',
            name: `${user.first_name || ''} ${user.last_name || ''}`.trim(),
            email: user.email || '',
            password: decryptPassword(user.password), // Decrypt for display
            barangay: user.barangays?.barangay_name || '—',
            barangayId: user.barangay_id,
            roleName,
            roleDisplay: ROLE_DISPLAY[roleName] || roleName,
            roleId: user.role_id,
            position: cleanPosition,
            displayPosition: cleanPosition ? (POSITION_DISPLAY[cleanPosition] || cleanPosition) : '—',
            status: user.status,
          };
        });
        setAccounts(transformedAccounts);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  // ── Create account ───────────────────────────────────────────────────────────
  const handleCreateAccount = async (form) => {
    try {
      const barangay = barangays.find(b => b.barangay_name === form.barangay);

      // Map display position to DB key
      const posMap = { 'Chairman': 'chairman', 'Secretary': 'secretary', 'Treasurer': 'treasurer', 'SK Federation': 'sk_federation' };
      const dbPos  = posMap[form.position] || null;

      // SK Federation gets sk_federation role, others get sk_official role
      const dbRole = form.position === 'SK Federation' ? 'sk_federation' : 'sk_official';

      const { data: roleData } = await supabase
        .from('roles').select('role_id').eq('role_name', dbRole).single();

      const { error } = await supabase.from('users').insert({
        first_name:     form.firstName,
        last_name:      form.lastName,
        middle_initial: form.middleInitial,
        email:          form.email,
        password:       encryptPassword(form.password), // Encrypted for login
        position:       dbPos,
        barangay_id:    barangay?.barangay_id || null,
        role_id:        roleData?.role_id || null,
        status:         'active',
      });

      if (error) {
        Alert.alert('Error', 'Failed to create account');
        console.error(error);
      } else {
        fetchData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // ── Filtering ────────────────────────────────────────────────────────────────
  const filtered = accounts.filter(a => {
    const brgyMatch = filterBrgy === 'All Barangays' || a.barangay === filterBrgy;
    const q = searchText.toLowerCase();
    const textMatch = !q ||
      a.firstName.toLowerCase().includes(q) ||
      a.lastName.toLowerCase().includes(q) ||
      a.email.toLowerCase().includes(q) ||
      a.barangay.toLowerCase().includes(q);
    return brgyMatch && textMatch;
  });

  // ── Navigation ──────────────────────────────────────────────────────────────
  const handleNavPress = (tab) => {
    setActiveTab(tab);
    setSidebarVisible(false);
    if (tab === 'Dashboard') router.push('/(tabs)/lydo-dashboard');
    if (tab === 'Documents') router.push('/(tabs)/lydo-document');
    if (tab === 'Monitor')   router.push('/(tabs)/lydo-monitor');
  };

  const handleLogout = () => { logout(); router.replace('/'); };

  const handleMonitorTabPress = (tab) => {
    if (tab === 'Consultation') { router.push('/(tabs)/lydo-monitor');        return; }
    if (tab === 'Budget')       { router.push('/(tabs)/lydo-monitor-budget'); return; }
    if (tab === 'Report')       { router.push('/(tabs)/lydo-monitor-report'); return; }
    setActiveMonitorTab(tab);
  };

  // ── Sidebar ─────────────────────────────────────────────────────────────────
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
      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.8}>
        <Text style={styles.logoutText}>Logout</Text>
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
          <Text style={styles.mobileTitle}>Account Management</Text>
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

      {/* ── Monitor Tabs ── */}
      <View style={styles.monitorTabBar}>
        {MONITOR_TABS.map(tab => {
          const active = activeMonitorTab === tab;
          const hasNotif = NOTIF_TABS.has(tab);
          return (
            <TouchableOpacity
              key={tab}
              style={[styles.monitorTab, active && styles.monitorTabActive]}
              onPress={() => handleMonitorTabPress(tab)}
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

      {/* ── Toolbar: Search | + Account ── */}
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
          <Text style={styles.createBtnText}>Account</Text>
        </TouchableOpacity>
      </View>

      {/* ── List of Accounts heading + Barangay filter ── */}
      <View style={styles.listHeadingRow}>
        <Text style={styles.listHeading}>List of Accounts</Text>
      </View>
      <View style={{ marginBottom: 10, zIndex: 200 }}>
        <FilterDropdown
          value={filterBrgy}
          options={['All Barangays', ...barangays.map(b => b.barangay_name)]}
          onSelect={setFilterBrgy}
          label={filterBrgy}
        />
      </View>

      {/* ── Table ── */}
      <View style={styles.tableContainer}>
        {/* Header */}
        <View style={styles.tableHeader}>
          {[
            ['Barangay',      styles.colBrgy],
            ['Last Name',     styles.colLastName],
            ['First Name',    styles.colFirstName],
            ['Middle Initial',styles.colMiddleInitial],
            ['Role',          styles.colRole],
            ['Position',      styles.colPosition],
            ['Email',         styles.colEmail],
            ['Password', styles.colPassword],
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
            <Text style={styles.emptyText}>Loading accounts...</Text>
          </View>
        ) : filtered.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No accounts found.</Text>
          </View>
        ) : (
          filtered.map((acc, idx) => (
            <AccountListRow
              key={acc.id}
              account={acc}
              isEven={idx % 2 !== 0}
              isPasswordVisible={visiblePasswords.has(acc.id)}
              onTogglePassword={togglePasswordVisibility}
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

        {/* Create Account Modal — rendered at SafeAreaView level so it's independent of scroll content */}
        {showCreate && (
          <CreateAccountModal
            visible={showCreate}
            onClose={() => setShowCreate(false)}
            onSave={handleCreateAccount}
            barangays={barangays}
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
  emptyRow:        { minHeight: 44 },
  cellText:        { fontSize: isMobile ? 9 : 11, color: COLORS.darkText },

  // Columns matching the UI screenshot
  colBrgy:          { flex: 1.4, paddingRight: 6 },
  colLastName:      { flex: 1.2, paddingRight: 6 },
  colFirstName:     { flex: 1.2, paddingRight: 6 },
  colMiddleInitial: { flex: 0.6, paddingRight: 6 },
  colRole:          { flex: 1, paddingRight: 6 },
  colPosition:      { flex: 1.2, paddingRight: 6 },
  colEmail:         { flex: 1.6, paddingRight: 6 },
  colPassword:      { flex: 0.9 },
  colFlex:          { flex: 1, paddingRight: 6 },

  emptyState: { alignItems: 'center', paddingVertical: 40 },
  emptyText:  { fontSize: 14, color: COLORS.midGray },
});