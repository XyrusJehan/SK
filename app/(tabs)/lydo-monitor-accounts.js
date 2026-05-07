import React, { useState, useEffect, useContext, useRef } from 'react';
import {
  View, Text, TextInput, ScrollView, TouchableOpacity,
  StyleSheet, SafeAreaView, StatusBar, Dimensions,
  Modal, Alert, Image, ActivityIndicator,
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

const NAV_TABS     = ['Home', 'Documents', 'Monitor'];
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
        <Text style={FD.label}>Filter by Barangay</Text>
        <Text style={FD.arrow}>▾</Text>
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
  wrap:          { position: 'relative', zIndex: 1000 },
  btn:           { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: COLORS.white, borderRadius: 6, borderWidth: 1, borderColor: '#C8C8C8', paddingHorizontal: 12, paddingVertical: 7 },
  label:         { fontSize: 12, color: COLORS.darkText, fontWeight: '500' },
  arrow:         { fontSize: 9, color: COLORS.subText },
  menu:          { position: 'absolute', top: 36, right: 0, minWidth: 200, backgroundColor: COLORS.white, borderRadius: 8, borderWidth: 1, borderColor: COLORS.lightGray, elevation: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.25, shadowRadius: 12, zIndex: 1001 },
  item:          { paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.lightGray },
  itemActive:    { backgroundColor: '#EEF3FB' },
  itemText:      { fontSize: 12, color: COLORS.darkText },
  itemTextActive:{ fontWeight: '700', color: COLORS.navy },
});

// ─── STATUS PILL ──────────────────────────────────────────────────────────────
const StatusPill = ({ status }) => {
  if (status === 'pending') {
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

// ─── ACCOUNT ROW ─────────────────────────────────────────────────────────────
const AccountRow = ({
  account, checked, onToggle,
  onBrgyChange, onRoleChange, onPositionChange,
  onApprove, onReject,
  isEven,
  barangayOptions,
  roleOptions,
  positionOptions,
  rowIndex,
}) => (
  <View style={[styles.tableRow, isEven && styles.tableRowEven, checked && styles.tableRowSelected]}>

    {/* Select */}
    <View style={styles.colSelect}>
      <Checkbox checked={checked} onToggle={onToggle} />
    </View>

    {/* User Name */}
    <View style={styles.colName}>
      <Text style={styles.cellName}>{account.name || 'Pending Name'}</Text>
      {account.email && <Text style={styles.cellEmail}>{account.email}</Text>}
    </View>

    {/* Barangay Dropdown */}
    <View style={styles.colBarangay}>
      <InlineDropdown
        value={account.barangay || 'Select Barangay'}
        options={barangayOptions}
        onSelect={onBrgyChange}
        width={isMobile ? 90 : 125}
        id={`brgy-${account.id}-${rowIndex}`}
      />
    </View>

    {/* Role Dropdown */}
    <View style={styles.colRole}>
      <InlineDropdown
        value={account.roleDisplay || 'Select Role'}
        options={roleOptions}
        onSelect={onRoleChange}
        width={isMobile ? 70 : 100}
        id={`role-${account.id}-${rowIndex}`}
      />
    </View>

    {/* Position Dropdown - only for SK Officials */}
    <View style={styles.colPosition}>
      {account.roleName === 'sk_official' ? (
        <InlineDropdown
          value={account.displayPosition || 'Select Position'}
          options={positionOptions}
          onSelect={onPositionChange}
          width={isMobile ? 70 : 110}
          id={`pos-${account.id}-${rowIndex}`}
        />
      ) : (
        <Text style={styles.cellRole}>-</Text>
      )}
    </View>

    {/* Sign-up Date */}
    <View style={styles.colDate}>
      <Text style={styles.cellDate}>{account.signUpDate}</Text>
    </View>

    {/* Status */}
    <View style={styles.colStatus}>
      <StatusPill status={account.status} />
    </View>

    {/* Action — Approve / Reject stacked */}
    <View style={styles.colAction}>
      {(account.status === 'pending' || account.status === 'inactive') && (
        <TouchableOpacity
          style={styles.approveBtn}
          onPress={onApprove}
          activeOpacity={0.85}
        >
          <Text style={styles.actionBtnText}>Approve</Text>
        </TouchableOpacity>
      )}
      {(account.status === 'pending' || account.status === 'active') && (
        <TouchableOpacity
          style={styles.rejectBtn}
          onPress={onReject}
          activeOpacity={0.85}
        >
          <Text style={styles.actionBtnText}>Reject</Text>
        </TouchableOpacity>
      )}
    </View>

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
  const [roles, setRoles]               = useState([]);
  const [selectedIds, setSelectedIds]   = useState(new Set());
  const [filterBrgy, setFilterBrgy]     = useState('All Barangays');
  const [notifCount]                    = useState(2);
  const [sidebarVisible, setSidebarVisible] = useState(false);
  const [loading, setLoading]           = useState(true);

  // ── Fetch data from Supabase ─────────────────────────────────────────────────
  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);

      // Fetch barangays
      const { data: barangayData, error: brgyError } = await supabase
        .from('barangays')
        .select('barangay_id, barangay_name')
        .order('barangay_name');

      if (brgyError) {
        console.error('Error fetching barangays:', brgyError);
      } else {
        setBarangays(barangayData || []);
        BARANGAY_OPTIONS = ['Select Barangay', ...(barangayData?.map(b => b.barangay_name) || [])];
        FILTER_BARANGAY_OPTIONS.splice(1); // Clear existing
        FILTER_BARANGAY_OPTIONS.push('All Barangays', ...(barangayData?.map(b => b.barangay_name) || []));
      }

      // Fetch roles
      const { data: roleData, error: roleError } = await supabase
        .from('roles')
        .select('role_id, role_name')
        .in('role_name', ['sk_official', 'resident']);

      if (roleError) {
        console.error('Error fetching roles:', roleError);
      } else {
        setRoles(roleData || []);
      }

      // Fetch all users (pending, active, inactive) with their roles and barangays
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select(`
          user_id,
          first_name,
          last_name,
          email,
          position,
          status,
          created_at,
          role_id,
          barangay_id,
          roles (role_name),
          barangays (barangay_name)
        `)
        .order('created_at', { ascending: false });

      if (userError) {
        console.error('Error fetching users:', userError);
      } else {
        // Transform user data to account format
        const transformedAccounts = (userData || []).map(user => {
          const roleName = user.roles?.role_name || 'resident';
          // Clean position value - only accept valid positions
          const validPositions = ['chairman', 'secretary', 'treasurer'];
          const cleanPosition = validPositions.includes(user.position) ? user.position : null;
          return {
            id: user.user_id.toString(),
            userId: user.user_id,
            name: `${user.first_name} ${user.last_name}`.trim() || '',
            email: user.email || '',
            barangay: user.barangays?.barangay_name || 'Select Barangay',
            barangayId: user.barangay_id,
            roleName: roleName,
            roleDisplay: ROLE_DISPLAY[roleName] || roleName,
            roleId: user.role_id,
            position: cleanPosition,
            displayPosition: cleanPosition ? (POSITION_DISPLAY[cleanPosition] || cleanPosition) : 'Select Position',
            signUpDate: user.created_at ? new Date(user.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '',
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

  // ── Update user status in database ───────────────────────────────────────────
  const updateUserStatus = async (userId, newStatus) => {
    try {
      const { error } = await supabase
        .from('users')
        .update({ status: newStatus })
        .eq('user_id', userId);

      if (error) {
        console.error('Error updating status:', error);
        Alert.alert('Error', 'Failed to update account status');
        return false;
      }

      // Update local state
      setAccounts(prev => prev.map(a =>
        a.userId === userId ? { ...a, status: newStatus } : a
      ));
      return true;
    } catch (error) {
      console.error('Error:', error);
      return false;
    }
  };

  // ── Update user barangay assignment ─────────────────────────────────────────
  const updateUserBarangay = async (userId, barangayId) => {
    try {
      const { error } = await supabase
        .from('users')
        .update({ barangay_id: barangayId })
        .eq('user_id', userId);

      if (error) {
        console.error('Error updating barangay:', error);
        return false;
      }

      // Update local state
      const brgyName = barangays.find(b => b.barangay_id === barangayId)?.barangay_name || 'Select Barangay';
      setAccounts(prev => prev.map(a =>
        a.userId === userId ? { ...a, barangay: brgyName, barangayId } : a
      ));
      return true;
    } catch (error) {
      console.error('Error:', error);
      return false;
    }
  };

  // ── Update user position (for SK officials) ─────────────────────────────────
  const updateUserPosition = async (userId, position) => {
    try {
      // Skip if position is "Select Position"
      if (position === 'Select Position' || !position) {
        return false;
      }

      const { error } = await supabase
        .from('users')
        .update({ position: position })
        .eq('user_id', userId);

      if (error) {
        console.error('Error updating position:', error);
        return false;
      }

      // Update local state
      const displayPosition = POSITION_DISPLAY[position] || position;
      setAccounts(prev => prev.map(a =>
        a.userId === userId ? { ...a, position, displayPosition } : a
      ));
      return true;
    } catch (error) {
      console.error('Error:', error);
      return false;
    }
  };

  // ── Navigation ──────────────────────────────────────────────────────────────
  const handleNavPress = (tab) => {
    setActiveTab(tab);
    setSidebarVisible(false);
    if (tab === 'Home')      router.push('/(tabs)/lydo-home');
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

  // ── Row helpers ──────────────────────────────────────────────────────────────
  const toggleSelect = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const updateAccount = (id, patch) => {
    setAccounts(prev => prev.map(a => a.id === id ? { ...a, ...patch } : a));
  };

  const handleApprove = (id) => {
    const account = accounts.find(a => a.id === id);
    Alert.alert('Approve Account', `Are you sure you want to approve ${account?.name || 'this applicant'}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Approve',
        style: 'default',
        onPress: async () => {
          const success = await updateUserStatus(account.userId, 'active');
          if (success) {
            Alert.alert('Success', 'Account has been approved');
          }
        }
      },
    ]);
  };

  const handleReject = (id) => {
    const account = accounts.find(a => a.id === id);
    Alert.alert('Reject Account', `Are you sure you want to reject ${account?.name || 'this applicant'}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reject',
        style: 'destructive',
        onPress: async () => {
          const success = await updateUserStatus(account.userId, 'inactive');
          if (success) {
            Alert.alert('Success', 'Account has been rejected');
          }
        }
      },
    ]);
  };

  // ── Handle barangay change from dropdown ───────────────────────────────────
  const handleBarangayChange = async (id, barangayName) => {
    // Skip if "Select Barangay" is selected
    if (barangayName === 'Select Barangay' || !barangayName) {
      return;
    }
    const account = accounts.find(a => a.id === id);
    const barangay = barangays.find(b => b.barangay_name === barangayName);
    if (barangay) {
      await updateUserBarangay(account.userId, barangay.barangay_id);
    }
  };

  // ── Handle position change from dropdown ──────────────────────────────────
  const handlePositionChange = async (id, displayPosition) => {
    // Skip if "Select Position" is selected
    if (displayPosition === 'Select Position' || !displayPosition) {
      return;
    }
    const account = accounts.find(a => a.id === id);
    // Convert display value back to database value
    const dbPosition = Object.keys(POSITION_DISPLAY).find(
      key => POSITION_DISPLAY[key] === displayPosition
    ) || displayPosition;
    await updateUserPosition(account.userId, dbPosition);
  };

  // ── Handle role change ─────────────────────────────────────────────────────────
  const updateUserRole = async (userId, newRoleName) => {
    try {
      // Get the role_id for the new role
      const { data: roleData } = await supabase
        .from('roles')
        .select('role_id')
        .eq('role_name', newRoleName)
        .single();

      if (roleData) {
        const updates = { role_id: roleData.role_id };
        // If changing to resident, clear position and barangay
        if (newRoleName === 'resident') {
          updates.position = null;
          updates.barangay_id = null;
        }
        // If changing to lydo, clear position
        if (newRoleName === 'lydo') {
          updates.position = null;
        }

        const { error } = await supabase
          .from('users')
          .update(updates)
          .eq('user_id', userId);

        if (error) {
          console.error('Error updating role:', error);
          Alert.alert('Error', 'Failed to update role');
          return false;
        }

        // Update local state
        setAccounts(prev => prev.map(a =>
          a.userId === userId ? {
            ...a,
            roleName: newRoleName,
            roleDisplay: ROLE_DISPLAY[newRoleName],
            roleId: roleData.role_id,
            position: newRoleName === 'resident' || newRoleName === 'lydo' ? null : a.position,
            displayPosition: newRoleName === 'resident' || newRoleName === 'lydo' ? null : a.displayPosition,
            barangay: newRoleName === 'resident' || newRoleName === 'lydo' ? 'Select Barangay' : a.barangay,
            barangayId: newRoleName === 'resident' || newRoleName === 'lydo' ? null : a.barangayId,
          } : a
        ));
        return true;
      }
    } catch (error) {
      console.error('Error:', error);
    }
    return false;
  };

  const handleRoleChange = async (id, displayRole) => {
    // Skip if no valid selection
    if (!displayRole || displayRole === 'Select Role') {
      return;
    }
    // Convert display value back to database value
    const dbRole = Object.keys(ROLE_DISPLAY).find(
      key => ROLE_DISPLAY[key] === displayRole
    ) || displayRole;
    const account = accounts.find(a => a.id === id);
    await updateUserRole(account.userId, dbRole);
  };

  // ── Filtered accounts ────────────────────────────────────────────────────────
  const filtered = filterBrgy === 'All Barangays'
    ? accounts
    : accounts.filter(a => a.barangay === filterBrgy);

  // ── Dropdown options ──────────────────────────────────────────────────────────
  const getBarangayOptions = () => {
    if (barangays.length > 0) {
      return barangays.map(b => b.barangay_name);
    }
    return ['Select Barangay'];
  };

  const getPositionOptions = () => {
    return Object.values(POSITION_DISPLAY);
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
            <Text style={styles.headerDesc}>
              SK Full Disclosure Policy Compliance Portal for the Submission and Validation{'\n'}of Statutory Financial Reports and Developmental Plans
            </Text>
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
            </TouchableOpacity>
          );
        })}
      </View>

      {/* ── Page Title Row ── */}
      <View style={styles.pageTitleRow}>
        <View>
          <Text style={styles.pageTitle}>Account Management</Text>
          <Text style={styles.pageSubTitle}>Review of pending applicants</Text>
        </View>
        {/* Filter by Barangay (top-right) */}
        <FilterDropdown
          value={filterBrgy}
          options={['All Barangays', ...getBarangayOptions()]}
          onSelect={setFilterBrgy}
        />
      </View>

      {/* ── Table ── */}
      <View style={styles.tableContainer}>

          {/* Table Header */}
          <View style={styles.tableHeader}>
            <View style={styles.colSelect}>
              <Text style={styles.tableHeaderText}>Select</Text>
            </View>
            <View style={styles.colName}>
              <Text style={styles.tableHeaderText}>User Name</Text>
            </View>
            <View style={styles.colBarangay}>
              <Text style={styles.tableHeaderText}>Barangay</Text>
            </View>
            <View style={styles.colRole}>
              <Text style={styles.tableHeaderText}>Role</Text>
            </View>
            <View style={styles.colPosition}>
              <Text style={styles.tableHeaderText}>Position</Text>
            </View>
            <View style={styles.colDate}>
              <Text style={styles.tableHeaderText}>Sign-up Date</Text>
            </View>
            <View style={styles.colStatus}>
              <Text style={styles.tableHeaderText}>Status</Text>
            </View>
            <View style={styles.colAction}>
              <Text style={styles.tableHeaderText}>Action</Text>
            </View>
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
              <AccountRow
                key={acc.id}
                account={acc}
                checked={selectedIds.has(acc.id)}
                isEven={idx % 2 !== 0}
                rowIndex={idx}
                onToggle={() => toggleSelect(acc.id)}
                onBrgyChange={val => handleBarangayChange(acc.id, val)}
                onRoleChange={val => handleRoleChange(acc.id, val)}
                onPositionChange={val => handlePositionChange(acc.id, val)}
                onApprove={() => handleApprove(acc.id)}
                onReject={() => handleReject(acc.id)}
                barangayOptions={getBarangayOptions()}
                roleOptions={ROLE_OPTIONS}
                positionOptions={POSITION_OPTIONS}
              />
            ))
          )}

          {/* Extra empty rows to match screenshot appearance */}
          {[...Array(Math.max(0, 6 - filtered.length))].map((_, i) => (
            <View key={`empty-${i}`} style={[styles.tableRow, (filtered.length + i) % 2 !== 0 && styles.tableRowEven, styles.emptyRow]} />
          ))}

       
      </View>

    </ScrollView>
  );

  // ── Root ─────────────────────────────────────────────────────────────────────
  return (
    <GlobalDropdownProvider>
      <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.navy} />

      {/* Mobile Sidebar Modal */}
      <Modal
        visible={isMobile && sidebarVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setSidebarVisible(false)}
      >
        <View style={styles.mobileSidebarContainer}>
          <TouchableOpacity
            style={styles.sidebarOverlay}
            activeOpacity={1}
            onPress={() => setSidebarVisible(false)}
          />
          <View style={styles.mobileSidebar}>
            {renderSidebar()}
          </View>
        </View>
      </Modal>

      {/* Layout */}
      <View style={styles.layout}>
        {!isMobile && renderSidebar()}
        {renderContent()}
      </View>
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
  sidebarOverlay:        { position: 'absolute', left: 0, top: 0, bottom: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 5 },
  mobileSidebarContainer:{ flex: 1 },
  mobileSidebar:         { position: 'absolute', left: 0, top: 0, bottom: 0, width: '75%', maxWidth: 280, zIndex: 10 },

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
  headerDesc:  { fontSize: 15, fontWeight: '700', color: COLORS.darkText, marginTop: 6, lineHeight: 17 },

  // Bell
  bellBtn:        { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.cardBg, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 6, elevation: 3 },
  bellWrapper:    { width: 20, height: 22, alignItems: 'center' },
  bellBody:       { width: 14, height: 12, borderRadius: 7, borderWidth: 2, borderColor: '#8B0000', marginTop: 4 },
  bellBottom:     { width: 8, height: 4, borderBottomLeftRadius: 4, borderBottomRightRadius: 4, backgroundColor: '#8B0000', marginTop: -1 },
  bellDot:        { position: 'absolute', top: 0, right: 1, width: 7, height: 7, borderRadius: 4, backgroundColor: COLORS.gold, borderWidth: 1.5, borderColor: COLORS.cardBg },
  notifBadge:     { position: 'absolute', top: -2, right: -2, width: 16, height: 16, borderRadius: 8, backgroundColor: COLORS.gold, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: COLORS.white },
  notifBadgeText: { fontSize: 8, fontWeight: '900', color: COLORS.navy },

  // ── Monitor tabs ─────────────────────────────────────────────────────────────
  monitorTabBar:        { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: COLORS.lightGray, marginBottom: 14, overflowX: 'hidden', overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.30, shadowRadius: 3, elevation: 6 },
  monitorTab:           { flex: 1, paddingHorizontal: isMobile ? 8 : 40, backgroundColor: COLORS.navy, paddingVertical: 10, borderBottomWidth: 0, borderBottomColor: 'transparent', marginBottom: -1, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', alignItems: 'center' },
  monitorTabActive:     { backgroundColor: COLORS.gold, borderRadius: 4, borderBottomColor: COLORS.gold, borderColor: COLORS.gold, shadowColor: COLORS.gold, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.4, shadowRadius: 4, elevation: 3 },
  monitorTabText:       { fontSize: isMobile ? 10 : 13, fontWeight: '600', color: COLORS.white },
  monitorTabTextActive: { color: COLORS.darkText, fontWeight: '800' },

  // ── Page title row ────────────────────────────────────────────────────────────
  pageTitleRow:  { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16, zIndex: 300 },
  pageTitle:     { fontSize: isMobile ? 16 : 22, fontWeight: '800', color: COLORS.darkText, letterSpacing: 0.2 },
  pageSubTitle:  { fontSize: isMobile ? 10 : 12, color: COLORS.subText, marginTop: 2 },

  // ── Table ─────────────────────────────────────────────────────────────────────
  tableContainer: { backgroundColor: COLORS.white, borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: COLORS.lightGray, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6 },
  tableHeader:   { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.white, paddingVertical: 11, paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: COLORS.lightGray },
  tableHeaderText:{ fontSize: isMobile ? 10 : 12, fontWeight: '700', color: COLORS.darkText, letterSpacing: 0.2 },
  tableRow:      { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: COLORS.lightGray, backgroundColor: COLORS.white, minHeight: 56 },
  tableRowEven:  { backgroundColor: '#FAFAFA' },
  tableRowSelected: { backgroundColor: '#EEF3FB' },
  emptyRow:      { minHeight: 52 },

  // Columns — all flex: 1 to match lydo-monitor tab behaviour
  colSelect:   { width: 44, alignItems: 'center' },
  colName:     { flex: 1, paddingRight: 8 },
  colBarangay: { flex: 1, paddingRight: 8, zIndex: 900 },
  colRole:     { flex: 1, paddingRight: 8, zIndex: 900 },
  colPosition: { flex: 1, paddingRight: 8, zIndex: 900 },
  colDate:     { flex: 1, paddingRight: 8 },
  colStatus:   { flex: 1, paddingRight: 8 },
  colAction:   { width: isMobile ? 80 : 100, gap: 4 },

  // Cells
  cellName:    { fontSize: isMobile ? 10 : 12, color: COLORS.darkText, fontWeight: '500' },
  cellDate:    { fontSize: isMobile ? 10 : 12, color: COLORS.darkText },
  cellEmail:   { fontSize: isMobile ? 8 : 10, color: COLORS.subText, marginTop: 2 },
  cellRole:    { fontSize: isMobile ? 10 : 12, color: COLORS.subText, fontWeight: '500' },

  // Action buttons
  approveBtn:     { backgroundColor: '#43A047', borderRadius: 4, paddingHorizontal: 8, paddingVertical: 4, alignItems: 'center' },
  rejectBtn:      { backgroundColor: '#C62828', borderRadius: 4, paddingHorizontal: 8, paddingVertical: 4, alignItems: 'center' },
  actionBtnText:  { fontSize: 10, fontWeight: '700', color: COLORS.white },

  emptyState: { alignItems: 'center', paddingVertical: 40 },
  emptyText:  { fontSize: 14, color: COLORS.midGray },
});