import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, ScrollView, TouchableOpacity,
  StyleSheet, SafeAreaView, StatusBar, Dimensions, Image, Alert,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useNav } from './navContext';
import { useAuth, hashPassword, encryptPassword, decryptPassword } from './authContext';
import { supabase } from '../../utils/supabase';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const isMobile = SCREEN_WIDTH < 768;

const COLORS = {
  maroon: '#8B0000', maroonDark: '#6B0000', maroonLight: '#A50000',
  gold: '#E8C547', accent: '#D4A017', calGold: '#E8A020',
  white: '#FFFFFF', offWhite: '#F7F5F2', lightGray: '#ECECEC',
  midGray: '#B0B0B0', darkText: '#1A1A1A', subText: '#666666',
  teal: '#2A7B7B', cardBg: '#FFFFFF', shadow: 'rgba(0,0,0,0.08)',
  navy: '#133E75',
};

// ─── FORMAT FUNCTIONS ───────────────────────────────────────────────────────
function formatRole(role) {
  if (!role) return '';
  const roleMap = {
    'sk_official': 'SK Official',
    'lydo': 'LYDO',
    'resident': 'Resident',
    'sk_federation': 'SK Federation',
  };
  return roleMap[role] || role.charAt(0).toUpperCase() + role.slice(1).replace(/_/g, ' ');
}

function formatPosition(position) {
  if (!position) return '';
  return position.charAt(0).toUpperCase() + position.slice(1);
}

// ─── ICON COMPONENTS ──────────────────────────────────────────────────────────
const MenuIcon = () => (
  <View style={styles.menuIconContainer}>
    <View style={styles.menuLine} />
    <View style={styles.menuLine} />
    <View style={styles.menuLine} />
  </View>
);

const BellIcon = ({ hasNotif }) => (
  <View style={styles.bellWrapper}>
    <View style={styles.bellBody} />
    <View style={styles.bellBottom} />
    {hasNotif && <View style={styles.bellDot} />}
  </View>
);

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
export default function AccountScreen() {
  const router = useRouter();
  const { activeTab, setActiveTab } = useNav();
  const { logout, user } = useAuth();

  const [sidebarVisible, setSidebarVisible] = useState(false);
  const [notifCount] = useState(2);

  // Personal Details
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [middleInitial, setMiddleInitial] = useState('');
  const [barangay, setBarangay] = useState('');
  const [email, setEmail] = useState('');

  // Account & Role
  const [position, setPosition] = useState('');
  const [role, setRole] = useState('');

  // Change Password
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);

  // Save Profile
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState(false);

  // Change Password
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  // Modals
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);

  // Track original values for change detection
  const [originalFirstName, setOriginalFirstName] = useState('');
  const [originalLastName, setOriginalLastName] = useState('');
  const [originalMiddleInitial, setOriginalMiddleInitial] = useState('');

  // Check if profile has changes
  const hasProfileChanges = firstName !== originalFirstName || lastName !== originalLastName || middleInitial !== originalMiddleInitial;

  // Check if password fields are filled
  const hasPasswordFields = currentPassword && newPassword && confirmPassword;

  useEffect(() => {
    if (user && user.role !== 'sk') router.replace('/');
  }, [user]);

  useEffect(() => {
    if (user) {
      setFirstName(user.firstName || '');
      setLastName(user.lastName || '');
      setMiddleInitial(user.middleInitial || '');
      setBarangay(user.barangay?.barangay_name || '');
      setEmail(user.email || '');
      setRole(formatRole(user.roleName));

      // Store original values for change detection
      setOriginalFirstName(user.firstName || '');
      setOriginalLastName(user.lastName || '');
      setOriginalMiddleInitial(user.middleInitial || '');
    }
  }, [user]);

  // Fetch user's position from database
  useEffect(() => {
    const fetchPosition = async () => {
      if (!user?.userId) return;
      try {
        const { data, error } = await supabase
          .from('users')
          .select('position')
          .eq('user_id', user.userId)
          .single();
        if (data?.position) {
          setPosition(formatPosition(data.position));
        }
      } catch (err) {
        console.error('Error fetching position:', err);
      }
    };
    fetchPosition();
  }, [user?.userId]);

  const handleNavPress = (tab) => {
    if (tab === 'Dashboard') router.push('/(tabs)/sk-dashboard');
    else if (tab === 'Documents') router.push('/(tabs)/sk-document');
    else if (tab === 'Planning') router.push('/(tabs)/sk-planning');
    else if (tab === 'Portal') router.push('/(tabs)/sk-portal');
    else if (tab === 'Account') router.push('/(tabs)/sk-account');
    setActiveTab(tab);
    setSidebarVisible(false);
  };

  const handleLogout = () => { logout(); router.replace('/'); };

  const handleSaveProfile = async () => {
    if (!firstName.trim() || !lastName.trim()) {
      Alert.alert('Error', 'First name and last name are required.');
      return;
    }

    setSavingProfile(true);
    try {
      const { error } = await supabase
        .from('users')
        .update({
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          middle_initial: middleInitial.trim() || null,
        })
        .eq('user_id', user.userId);

      if (error) {
        Alert.alert('Error', error.message);
      } else {
        setProfileSuccess(true);
        setTimeout(() => setProfileSuccess(false), 3000);
        // Update local storage with new user data
        const updatedUser = {
          ...user,
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          middleInitial: middleInitial.trim(),
          name: `${firstName.trim()} ${lastName.trim()}`,
        };
        await AsyncStorage.setItem('sk_user', JSON.stringify(updatedUser));

        // Update original values to disable button
        setOriginalFirstName(firstName.trim());
        setOriginalLastName(lastName.trim());
        setOriginalMiddleInitial(middleInitial.trim());
      }
    } catch (err) {
      Alert.alert('Error', 'Something went wrong. Please try again.');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      Alert.alert('Error', 'Please fill in all password fields.');
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Error', 'New password and confirmation do not match.');
      return;
    }
    if (newPassword.length < 6) {
      Alert.alert('Error', 'New password must be at least 6 characters.');
      return;
    }

    setSavingPassword(true);
    try {
      // First, verify the current password
      const currentEncryptedPassword = encryptPassword(currentPassword);
      const { data: userData, error: fetchError } = await supabase
        .from('users')
        .select('password')
        .eq('user_id', user.userId)
        .single();

      if (fetchError) {
        Alert.alert('Error', 'Could not verify current password.');
        setSavingPassword(false);
        return;
      }

      // Check if current password matches (accept hashed, encrypted, and plain text for backward compatibility)
      const currentHashedPassword = hashPassword(currentPassword);
      const decryptedStored = decryptPassword(userData.password);
      if (userData.password !== currentHashedPassword && userData.password !== currentEncryptedPassword && userData.password !== currentPassword && decryptedStored !== currentPassword) {
        Alert.alert('Error', 'Current password is incorrect.');
        setSavingPassword(false);
        return;
      }

      // Encrypt new password and update
      const newEncryptedPassword = encryptPassword(newPassword);
      const { error: updateError } = await supabase
        .from('users')
        .update({ password: newEncryptedPassword })
        .eq('user_id', user.userId);

      if (updateError) {
        Alert.alert('Error', updateError.message);
      } else {
        setPasswordSuccess(true);
        setTimeout(() => setPasswordSuccess(false), 3000);
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      }
    } catch (err) {
      Alert.alert('Error', 'Something went wrong. Please try again.');
    } finally {
      setSavingPassword(false);
    }
  };

  const renderSidebar = () => (
    <View style={styles.sidebar}>
      <View style={styles.logoPill}>
        <Image
          source={require('./../../assets/images/sk-logo.png')}
          style={styles.logoImage}
          resizeMode="contain"
        />
      </View>
      <View style={styles.sidebarSpacer} />
      {['Dashboard', 'Documents', 'Planning', 'Portal', 'Account'].map((tab) => {
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

  const barangayName = user?.barangay?.barangay_name || 'Unknown Barangay';

  return (
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

        <ScrollView
          style={[styles.main, isMobile && styles.mainMobile]}
          contentContainerStyle={styles.mainContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Mobile Header */}
          {isMobile && (
            <View style={styles.mobileHeader}>
              <TouchableOpacity style={styles.menuBtn} onPress={() => setSidebarVisible(!sidebarVisible)}>
                <MenuIcon />
              </TouchableOpacity>
              <Text style={styles.mobileTitle}>Account</Text>
              <View style={styles.mobileHeaderActions}>
                <TouchableOpacity style={styles.bellBtnMobile} activeOpacity={0.7}>
                  <BellIcon hasNotif={notifCount > 0} />
                  {notifCount > 0 && (
                    <View style={styles.notifBadgeMobile}>
                      <Text style={styles.notifBadgeTextMobile}>{notifCount}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Desktop Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.headerSub}>SANGGUNIANG KABATAAN</Text>
              <Text style={styles.headerTitle}>{barangayName.toUpperCase()}</Text>
            </View>
            {!isMobile && (
              <View style={styles.headerActions}>
                <TouchableOpacity style={styles.headerActionBtn} activeOpacity={0.7}>
                  <View style={{ position: 'relative' }}>
                    <BellIcon hasNotif={notifCount > 0} />
                    {notifCount > 0 && (
                      <View style={styles.notifBadge}>
                        <Text style={styles.notifBadgeText}>{notifCount}</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.headerActionLabel}>Notification</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* ── Page Title ── */}
          <Text style={styles.pageTitle}>ACCOUNT</Text>

          {/* ── Account Card ── */}
          <View style={styles.card}>

            {/* ── Top row: Avatar left + Form right ── */}
            <View style={styles.cardBody}>

              {/* Avatar column */}
              {!isMobile && (
                <View style={styles.avatarCol}>
                  <View style={styles.avatarWrap}>
                    <Image
                      source={require('./../../assets/images/sk-logo.png')}
                      style={styles.avatarImage}
                      resizeMode="contain"
                    />
                  </View>
                </View>
              )}

              {/* Form column */}
              <View style={styles.formCol}>

                {/* Avatar on mobile (above form) */}
                {isMobile && (
                  <View style={styles.avatarRowMobile}>
                    <View style={styles.avatarWrap}>
                      <Image
                        source={require('./../../assets/images/sk-logo.png')}
                        style={styles.avatarImage}
                        resizeMode="contain"
                      />
                    </View>
                  </View>
                )}

                {/* ── Personal Details ── */}
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Personal Details</Text>

                  <View style={styles.fieldRow}>
                    <View style={styles.fieldCol}>
                      <Text style={styles.fieldLabel}>First Name</Text>
                      <TextInput
                        style={styles.fieldInput}
                        value={firstName}
                        onChangeText={setFirstName}
                        placeholder="First Name"
                        placeholderTextColor={COLORS.midGray}
                      />
                    </View>
                    <View style={styles.fieldCol}>
                      <Text style={styles.fieldLabel}>Last Name</Text>
                      <TextInput
                        style={styles.fieldInput}
                        value={lastName}
                        onChangeText={setLastName}
                        placeholder="Last Name"
                        placeholderTextColor={COLORS.midGray}
                      />
                    </View>
                    <View style={[styles.fieldCol, styles.fieldColSmall]}>
                      <Text style={styles.fieldLabel}>Middle Initial</Text>
                      <TextInput
                        style={styles.fieldInput}
                        value={middleInitial}
                        onChangeText={setMiddleInitial}
                        placeholder="M.I."
                        placeholderTextColor={COLORS.midGray}
                        maxLength={3}
                      />
                    </View>
                  </View>

                  <View style={styles.fieldRow}>
                    <View style={styles.fieldCol}>
                      <Text style={styles.fieldLabel}>Barangay</Text>
                      <TextInput
                        style={[styles.fieldInput, styles.fieldInputDisabled]}
                        value={barangay}
                        editable={false}
                        placeholderTextColor={COLORS.midGray}
                      />
                    </View>
                    <View style={styles.fieldCol}>
                      <Text style={styles.fieldLabel}>Email</Text>
                      <TextInput
                        style={[styles.fieldInput, styles.fieldInputDisabled]}
                        value={email}
                        editable={false}
                        placeholderTextColor={COLORS.midGray}
                        keyboardType="email-address"
                        autoCapitalize="none"
                      />
                    </View>
                    {!isMobile && <View style={[styles.fieldCol, styles.fieldColSmall]} />}
                  </View>

                  {/* Save Changes button */}
                  <View style={styles.buttonRow}>
                    <TouchableOpacity
                      style={[
                        styles.saveChangesBtn,
                        (savingProfile || !hasProfileChanges) && styles.saveChangesBtnDisabled
                      ]}
                      onPress={() => setShowProfileModal(true)}
                      activeOpacity={0.8}
                      disabled={savingProfile || !hasProfileChanges}
                    >
                      <Text style={styles.saveChangesBtnText}>
                        {savingProfile ? 'Saving...' : 'Save Changes'}
                      </Text>
                    </TouchableOpacity>
                    {profileSuccess && (
                      <View style={styles.successIndicator}>
                        <Text style={styles.successCheck}>✓</Text>
                        <Text style={styles.successText}>Profile updated successfully</Text>
                      </View>
                    )}
                  </View>
                </View>

                {/* ── Account & Role ── */}
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Account & Role</Text>

                  <View style={styles.fieldRow}>
                    <View style={styles.fieldCol}>
                      <Text style={styles.fieldLabel}>Position</Text>
                      <TextInput
                        style={[styles.fieldInput, styles.fieldInputDisabled]}
                        value={position}
                        editable={false}
                        placeholderTextColor={COLORS.midGray}
                      />
                    </View>
                    <View style={styles.fieldCol}>
                      <Text style={styles.fieldLabel}>Role</Text>
                      <TextInput
                        style={[styles.fieldInput, styles.fieldInputDisabled]}
                        value={role}
                        editable={false}
                        placeholderTextColor={COLORS.midGray}
                      />
                    </View>
                  </View>
                </View>

                {/* ── Change Password ── */}
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Change Password</Text>

                  {/* Current password — same width as a single field col */}
                  <View style={[styles.fieldRow, { marginBottom: isMobile ? 10 : 12 }]}>
                    <View style={styles.fieldCol}>
                      <Text style={styles.fieldLabel}>Current password:</Text>
                      <TextInput
                        style={styles.fieldInput}
                        value={currentPassword}
                        onChangeText={setCurrentPassword}
                        secureTextEntry
                        placeholderTextColor={COLORS.midGray}
                      />
                    </View>
                    {/* spacer so current-password matches single-col width */}
                    <View style={styles.fieldCol} />
                    {!isMobile && <View style={[styles.fieldCol, styles.fieldColSmall]} />}
                  </View>

                  <View style={styles.fieldRow}>
                    <View style={styles.fieldCol}>
                      <Text style={styles.fieldLabel}>New password:</Text>
                      <TextInput
                        style={styles.fieldInput}
                        value={newPassword}
                        onChangeText={setNewPassword}
                        secureTextEntry
                        placeholderTextColor={COLORS.midGray}
                      />
                    </View>
                    <View style={styles.fieldCol}>
                      <Text style={styles.fieldLabel}>Confirm new password:</Text>
                      <TextInput
                        style={styles.fieldInput}
                        value={confirmPassword}
                        onChangeText={setConfirmPassword}
                        secureTextEntry
                        placeholderTextColor={COLORS.midGray}
                      />
                    </View>
                    {!isMobile && <View style={[styles.fieldCol, styles.fieldColSmall]} />}
                  </View>

                  <View style={styles.buttonRow}>
                    <TouchableOpacity
                      style={[
                        styles.changePwBtn,
                        (savingPassword || !hasPasswordFields) && styles.changePwBtnDisabled
                      ]}
                      onPress={() => setShowPasswordModal(true)}
                      activeOpacity={0.8}
                      disabled={savingPassword || !hasPasswordFields}
                    >
                      <Text style={styles.changePwBtnText}>
                        {savingPassword ? 'Updating…' : 'Change Account Password'}
                      </Text>
                    </TouchableOpacity>
                    {passwordSuccess && (
                      <View style={styles.successIndicator}>
                        <Text style={styles.successCheck}>✓</Text>
                        <Text style={styles.successText}>Password updated successfully!</Text>
                      </View>
                    )}
                  </View>
                </View>

              </View>{/* end formCol */}
            </View>{/* end cardBody */}

          </View>

        </ScrollView>

        {/* ── Profile Confirmation Modal ── */}
        {showProfileModal && (
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Confirm Profile Update</Text>
              <Text style={styles.modalMessage}>
                Are you sure you want to save changes to your profile?
              </Text>
              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={styles.modalCancelBtn}
                  onPress={() => setShowProfileModal(false)}
                >
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.modalConfirmBtn}
                  onPress={async () => {
                    setShowProfileModal(false);
                    await handleSaveProfile();
                  }}
                >
                  <Text style={styles.modalConfirmText}>Confirm</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}

        {/* ── Password Confirmation Modal ── */}
        {showPasswordModal && (
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Confirm Password Change</Text>
              <Text style={styles.modalMessage}>
                Are you sure you want to change your password? This action cannot be undone.
              </Text>
              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={styles.modalCancelBtn}
                  onPress={() => setShowPasswordModal(false)}
                >
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalConfirmBtn, styles.modalConfirmBtnDanger]}
                  onPress={async () => {
                    setShowPasswordModal(false);
                    await handleChangePassword();
                  }}
                >
                  <Text style={styles.modalConfirmText}>Change Password</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

// ─── STYLES ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.navy },
  layout: { flex: 1, flexDirection: 'row' },

  // ── Sidebar ──
  sidebar: {
    width: 250, backgroundColor: COLORS.navy,
    alignItems: 'center', paddingTop: 20, paddingBottom: 24, paddingHorizontal: 10, zIndex: 10,
  },
  sidebarOverlay: {
    position: 'absolute', left: 0, top: 0, bottom: 0, right: 0,
    backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 5,
  },
  logoPill: {
    marginTop: 20, width: 70, height: 70, borderRadius: 35,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 8, borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)',
  },
  logoImage: { width: 100, height: 100 },
  sidebarSpacer: { height: 28 },
  navItem: {
    width: '100%', paddingVertical: 12, paddingHorizontal: 12,
    borderRadius: 24, marginBottom: 8, alignItems: 'center',
    borderWidth: 1.5, borderColor: COLORS.white, backgroundColor: COLORS.navy,
  },
  navItemActive: { backgroundColor: COLORS.white, borderWidth: 1.5, borderColor: '#000000' },
  navLabel: { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.8)', letterSpacing: 0.3 },
  navLabelActive: { color: '#000000', fontWeight: '800' },
  logoutBtn: {
    width: '100%', paddingVertical: 12, paddingHorizontal: 12,
    borderRadius: 24, marginTop: 8, alignItems: 'center',
    borderWidth: 1.5, borderColor: COLORS.white, backgroundColor: 'rgba(255,255,255,0.1)',
  },
  logoutText: { fontSize: 13, fontWeight: '600', color: COLORS.white, letterSpacing: 0.3 },

  // ── Main area ──
  main: { flex: 1, backgroundColor: COLORS.offWhite, borderTopLeftRadius: 20 },
  mainMobile: { borderTopLeftRadius: 0 },
  mainContent: { padding: isMobile ? 12 : 20, paddingBottom: isMobile ? 24 : 40 },

  // ── Mobile header ──
  mobileHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 12, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: COLORS.lightGray,
  },
  menuBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.cardBg, alignItems: 'center', justifyContent: 'center' },
  menuIconContainer: { width: 20, height: 16, justifyContent: 'space-between' },
  menuLine: { width: 20, height: 2, backgroundColor: COLORS.maroon, borderRadius: 1 },
  mobileTitle: { fontSize: 16, fontWeight: '800', color: COLORS.darkText },
  mobileHeaderActions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  bellBtnMobile: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.cardBg,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, elevation: 2,
  },
  notifBadgeMobile: {
    position: 'absolute', top: -2, right: -2, width: 14, height: 14, borderRadius: 7,
    backgroundColor: COLORS.gold, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: COLORS.white,
  },
  notifBadgeTextMobile: { fontSize: 7, fontWeight: '900', color: COLORS.maroon },

  // ── Desktop header ──
  header: {
    flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between',
    marginBottom: isMobile ? 12 : 16,
  },
  headerSub: { fontSize: isMobile ? 8 : 10, fontWeight: '600', color: COLORS.subText, letterSpacing: 2, marginBottom: 2, textTransform: 'uppercase' },
  headerTitle: { fontSize: isMobile ? 16 : 20, fontWeight: '900', color: COLORS.darkText, letterSpacing: 0.5 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerActionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingVertical: 7, paddingHorizontal: 12, borderRadius: 20,
    backgroundColor: COLORS.cardBg, borderWidth: 1, borderColor: COLORS.lightGray,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  headerActionLabel: { fontSize: 12, fontWeight: '600', color: COLORS.darkText },
  bellWrapper: { width: 20, height: 22, alignItems: 'center' },
  bellBody: { width: 14, height: 12, borderRadius: 7, borderWidth: 2, borderColor: COLORS.maroon, marginTop: 4 },
  bellBottom: { width: 8, height: 4, borderBottomLeftRadius: 4, borderBottomRightRadius: 4, backgroundColor: COLORS.maroon, marginTop: -1 },
  bellDot: { position: 'absolute', top: 0, right: 1, width: 7, height: 7, borderRadius: 4, backgroundColor: COLORS.gold, borderWidth: 1.5, borderColor: COLORS.cardBg },
  notifBadge: {
    position: 'absolute', top: -2, right: -2, width: 16, height: 16, borderRadius: 8,
    backgroundColor: COLORS.gold, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: COLORS.white,
  },
  notifBadgeText: { fontSize: 8, fontWeight: '900', color: COLORS.maroon },

  // ── Page Title ──
  pageTitle: {
    fontSize: isMobile ? 18 : 22, fontWeight: '900', color: COLORS.navy,
    letterSpacing: 0.5, marginBottom: isMobile ? 14 : 20,
  },

  // ── Card ──
  card: {
    backgroundColor: COLORS.cardBg, borderRadius: isMobile ? 12 : 18,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08,
    shadowRadius: 12, elevation: 4, overflow: 'hidden',
    paddingHorizontal: isMobile ? 16 : 28, paddingVertical: isMobile ? 16 : 24,
  },

  // ── Avatar ──
  avatarRow: { alignItems: 'flex-start', marginBottom: isMobile ? 16 : 20 },
  avatarWrap: {
    width: 80, height: 80, borderRadius: 40,
    borderWidth: 2.5, borderColor: COLORS.navy,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: COLORS.offWhite, overflow: 'hidden',
  },
  avatarImage: { width: 100, height: 100 },

  // ── Sections ──
  section: { marginBottom: isMobile ? 14 : 20 },
  sectionTitle: {
    fontSize: isMobile ? 13 : 15, fontWeight: '800', color: COLORS.navy,
    marginBottom: isMobile ? 10 : 14, letterSpacing: 0.2,
  },
  divider: { height: 1, backgroundColor: COLORS.lightGray, marginBottom: isMobile ? 14 : 20 },

  // ── Field grid ──
  fieldRow: {
    flexDirection: isMobile ? 'column' : 'row',
    gap: isMobile ? 10 : 14,
    marginBottom: isMobile ? 0 : 12,
  },
  fieldCol: { flex: 1, marginBottom: isMobile ? 10 : 0 },
  fieldColSmall: { flex: 0.45 },
  fieldColFull: { flex: 1, marginBottom: isMobile ? 10 : 12 },
  fieldLabel: {
    fontSize: isMobile ? 11 : 12, fontWeight: '600', color: COLORS.darkText,
    marginBottom: 5, letterSpacing: 0.1,
  },
  fieldInput: {
    borderWidth: 1.5, borderColor: COLORS.lightGray, borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: isMobile ? 8 : 10,
    fontSize: isMobile ? 13 : 14, color: COLORS.darkText,
    backgroundColor: COLORS.white,
  },
  fieldInputDisabled: {
    backgroundColor: COLORS.offWhite, color: COLORS.subText,
  },

  // ── Change Password button ──
  changePwBtn: {
    marginTop: isMobile ? 12 : 16,
    alignSelf: 'flex-start',
    backgroundColor: COLORS.navy,
    borderRadius: 8,
    paddingVertical: isMobile ? 10 : 12,
    paddingHorizontal: isMobile ? 16 : 22,
  },
  changePwBtnDisabled: { opacity: 0.6 },
  changePwBtnText: {
    fontSize: isMobile ? 12 : 13, fontWeight: '700', color: COLORS.white, letterSpacing: 0.3,
  },

  // ── Save Changes button ──
  saveChangesBtn: {
    marginTop: isMobile ? 12 : 16,
    alignSelf: 'flex-start',
    backgroundColor: COLORS.navy,
    borderRadius: 8,
    paddingVertical: isMobile ? 10 : 12,
    paddingHorizontal: isMobile ? 16 : 22,
  },
  saveChangesBtnDisabled: { opacity: 0.6 },
  saveChangesBtnText: {
    fontSize: isMobile ? 12 : 13, fontWeight: '700', color: COLORS.white, letterSpacing: 0.3,
  },

  // Button row for success indicator
  buttonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  successIndicator: {
    backgroundColor: '#22C55E',
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    shadowColor: '#22C55E',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  successText: {
    color: COLORS.white,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  successCheck: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: '900',
  },

  // ── Modals ──
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  modalContent: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 24,
    width: '85%',
    maxWidth: 360,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.darkText,
    textAlign: 'center',
    marginBottom: 12,
  },
  modalMessage: {
    fontSize: 14,
    color: COLORS.subText,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: COLORS.lightGray,
    alignItems: 'center',
  },
  modalCancelText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.subText,
  },
  modalConfirmBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: COLORS.navy,
    alignItems: 'center',
  },
  modalConfirmBtnDanger: {
    backgroundColor: COLORS.maroon,
  },
  modalConfirmText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.white,
  },
});