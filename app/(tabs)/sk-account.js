import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, ScrollView, TouchableOpacity,
  StyleSheet, SafeAreaView, StatusBar, Dimensions, Image, Alert,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useNav } from './navContext';
import { useAuth, encryptPassword, decryptPassword, validatePassword } from './authContext';
import { supabase } from '../../utils/supabase';
import { NotificationModal, useNotificationCenter, BellIcon } from './notificationCenter';
import Sidebar from './../components/Sidebar';

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



const EyeIcon = ({ visible, onPress }) => (
  <TouchableOpacity onPress={onPress} style={styles.eyeBtn} activeOpacity={0.7}>
    <Text style={styles.eyeIconText}>{visible ? '👁' : '⌣'}</Text>
  </TouchableOpacity>
);

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
export default function AccountScreen() {
  const router = useRouter();
  const { activeTab, setActiveTab } = useNav();
  const { logout, user } = useAuth();

  const [sidebarVisible, setSidebarVisible] = useState(false);

  // ── Shared notification bell (returned/approved docs, templates, deadlines) ──
  const barangayId = user?.barangayId;
  const notif = useNotificationCenter(barangayId);
  const notifCount = notif.count;

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
  const [newPasswordError, setNewPasswordError] = useState('');
  const [currentPasswordError, setCurrentPasswordError] = useState('');
  const [confirmPasswordError, setConfirmPasswordError] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  // Save Profile
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState(false);

  // Change Password
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);

  // Track original values for change detection
  const [originalFirstName, setOriginalFirstName] = useState('');
  const [originalLastName, setOriginalLastName] = useState('');
  const [originalMiddleInitial, setOriginalMiddleInitial] = useState('');

  // Check if profile has changes
  const hasProfileChanges = firstName !== originalFirstName || lastName !== originalLastName || middleInitial !== originalMiddleInitial;

  // Check if password fields are filled and valid
  const hasPasswordFields = currentPassword && newPassword && confirmPassword && !newPasswordError;

  // Validate new password in real-time
  const validateNewPassword = (password) => {
    if (!password) {
      setNewPasswordError('');
      return;
    }
    if (password.length < 8) {
      setNewPasswordError('Password must be at least 8 characters');
      return;
    }
    const error = validatePassword(password);
    setNewPasswordError(error || '');
  };

  const handleNewPasswordChange = (text) => {
    setNewPassword(text);
    validateNewPassword(text);
  };

  const handleCurrentPasswordBlur = async () => {
    if (!currentPassword) {
      setCurrentPasswordError('');
      return;
    }
    try {
      const currentEncryptedPassword = encryptPassword(currentPassword);
      const { data: userData, error: fetchError } = await supabase
        .from('users')
        .select('password')
        .eq('user_id', user.userId)
        .single();

      if (fetchError) {
        setCurrentPasswordError('');
        return;
      }

      const decryptedStored = decryptPassword(userData.password);
      if (userData.password !== currentEncryptedPassword && userData.password !== currentPassword && decryptedStored !== currentPassword) {
        setCurrentPasswordError('Current password is incorrect');
      } else {
        setCurrentPasswordError('');
      }
    } catch (err) {
      setCurrentPasswordError('');
    }
  };

  const handleConfirmPasswordChange = (text) => {
    setConfirmPassword(text);
    if (!text) {
      setConfirmPasswordError('');
    } else if (text !== newPassword) {
      setConfirmPasswordError('Passwords do not match');
    } else {
      setConfirmPasswordError('');
    }
  };

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
    else if (tab === 'Logs') router.push('/(tabs)/sk-logs');
    else if (tab === 'Account') router.push('/(tabs)/sk-account');
    setActiveTab(tab);
    setSidebarVisible(false);
  };

  const handleLogout = () => { logout(); router.replace('/'); };

  const handleSaveProfile = async () => {
    setShowProfileModal(false);
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
    setSavingPassword(true);
    setShowPasswordModal(false);
    try {
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
        setNewPasswordError('');
        setCurrentPasswordError('');
        setConfirmPasswordError('');
      }
    } catch (err) {
      Alert.alert('Error', 'Something went wrong. Please try again.');
    } finally {
      setSavingPassword(false);
    }
  };

  const barangayName = user?.barangay?.barangay_name || 'Unknown Barangay';

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.navy} />

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
                      onPress={() => {
                        if (!firstName.trim() || !lastName.trim()) {
                          Alert.alert('Error', 'First name and last name are required.');
                          return;
                        }
                        setShowProfileModal(true);
                      }}
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
                      <View style={styles.passwordInputContainer}>
                        <TextInput
                          style={[styles.fieldInput, styles.passwordInput, currentPasswordError && styles.fieldInputError]}
                          value={currentPassword}
                          onChangeText={(text) => {
                            setCurrentPassword(text);
                            if (currentPasswordError) setCurrentPasswordError('');
                          }}
                          onBlur={handleCurrentPasswordBlur}
                          secureTextEntry={!showCurrentPassword}
                          placeholderTextColor={COLORS.midGray}
                        />
                        <EyeIcon visible={showCurrentPassword} onPress={() => setShowCurrentPassword(!showCurrentPassword)} />
                      </View>
                      {currentPasswordError ? (
                        <Text style={styles.errorText}>{currentPasswordError}</Text>
                      ) : null}
                    </View>
                    {/* spacer so current-password matches single-col width */}
                    <View style={styles.fieldCol} />
                    {!isMobile && <View style={[styles.fieldCol, styles.fieldColSmall]} />}
                  </View>

                  <View style={styles.fieldRow}>
                    <View style={styles.fieldCol}>
                      <Text style={styles.fieldLabel}>New password:</Text>
                      <View style={styles.passwordInputContainer}>
                        <TextInput
                          style={[styles.fieldInput, styles.passwordInput, newPasswordError && styles.fieldInputError]}
                          value={newPassword}
                          onChangeText={handleNewPasswordChange}
                          secureTextEntry={!showNewPassword}
                          placeholderTextColor={COLORS.midGray}
                        />
                        <EyeIcon visible={showNewPassword} onPress={() => setShowNewPassword(!showNewPassword)} />
                      </View>
                      {newPasswordError ? (
                        <Text style={styles.errorText}>{newPasswordError}</Text>
                      ) : (
                        <Text style={styles.passwordNote}>Min. 8 characters, with uppercase, lowercase, number, and special character</Text>
                      )}
                    </View>
                    <View style={styles.fieldCol}>
                      <Text style={styles.fieldLabel}>Confirm new password:</Text>
                      <View style={styles.passwordInputContainer}>
                        <TextInput
                          style={[styles.fieldInput, styles.passwordInput, confirmPasswordError && styles.fieldInputError]}
                          value={confirmPassword}
                          onChangeText={handleConfirmPasswordChange}
                          secureTextEntry={!showConfirmPassword}
                          placeholderTextColor={COLORS.midGray}
                        />
                        <EyeIcon visible={showConfirmPassword} onPress={() => setShowConfirmPassword(!showConfirmPassword)} />
                      </View>
                      {confirmPasswordError ? (
                        <Text style={styles.errorText}>{confirmPasswordError}</Text>
                      ) : null}
                    </View>
                    {!isMobile && <View style={[styles.fieldCol, styles.fieldColSmall]} />}
                  </View>

                  <View style={styles.buttonRow}>
                    <TouchableOpacity
                      style={[
                        styles.changePwBtn,
                        (savingPassword || !hasPasswordFields) && styles.changePwBtnDisabled
                      ]}
                      onPress={async () => {
                        // Validate current password against database before showing modal
                        if (!currentPassword || !newPassword || !confirmPassword) {
                          Alert.alert('Error', 'Please fill in all password fields.');
                          return;
                        }
                        if (newPassword !== confirmPassword) {
                          Alert.alert('Error', 'New password and confirmation do not match.');
                          return;
                        }
                        if (newPassword.length < 8) {
                          Alert.alert('Error', 'New password must be at least 8 characters.');
                          return;
                        }
                        const pwError = validatePassword(newPassword);
                        if (pwError) {
                          Alert.alert('Error', pwError);
                          return;
                        }

                        // Verify current password against database
                        try {
                          const currentEncryptedPassword = encryptPassword(currentPassword);
                          const { data: userData, error: fetchError } = await supabase
                            .from('users')
                            .select('password')
                            .eq('user_id', user.userId)
                            .single();

                          if (fetchError) {
                            Alert.alert('Error', 'Could not verify current password.');
                            return;
                          }

                          const decryptedStored = decryptPassword(userData.password);
                          if (userData.password !== currentEncryptedPassword && userData.password !== currentPassword && decryptedStored !== currentPassword) {
                            Alert.alert('Error', 'Current password is incorrect.');
                            return;
                          }

                          setShowPasswordModal(true);
                        } catch (err) {
                          Alert.alert('Error', 'Something went wrong. Please try again.');
                        }
                      }}
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
      </View>

      {/* Password Change Confirmation Modal */}
      {showPasswordModal && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Confirm Password Change</Text>

            <View style={styles.modalDivider} />

            <View style={styles.passwordFlowContainer}>
              <View style={styles.passwordBox}>
                <Text style={styles.passwordBoxLabel}>Current Password</Text>
                <Text style={styles.passwordBoxValue}>{currentPassword}</Text>
              </View>

              <View style={styles.arrowContainer}>
                <Text style={styles.arrowText}>→</Text>
              </View>

              <View style={styles.passwordBox}>
                <Text style={styles.passwordBoxLabel}>New Password</Text>
                <Text style={styles.passwordBoxValue}>{newPassword}</Text>
              </View>
            </View>

            <View style={styles.modalDivider} />

            <Text style={styles.modalNote}>
              Please ensure you remember your new password. You will need it to log in.
            </Text>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setShowPasswordModal(false)}
                activeOpacity={0.8}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalConfirmBtn, savingPassword && styles.modalBtnDisabled]}
                onPress={handleChangePassword}
                activeOpacity={0.8}
                disabled={savingPassword}
              >
                <Text style={styles.modalConfirmText}>
                  {savingPassword ? 'Changing...' : 'Confirm Change'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* Profile Save Confirmation Modal */}
      {showProfileModal && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Confirm Profile Update</Text>

            <View style={styles.modalDivider} />

            <View style={styles.profileFlowContainer}>
              <View style={styles.profileBox}>
                <Text style={styles.profileBoxLabel}>Current Details</Text>
                <Text style={styles.profileBoxValue}>
                  {originalFirstName} {originalMiddleInitial ? originalMiddleInitial + '. ' : ''}{originalLastName}
                </Text>
              </View>

              <View style={styles.arrowContainer}>
                <Text style={styles.arrowText}>→</Text>
              </View>

              <View style={styles.profileBox}>
                <Text style={styles.profileBoxLabel}>New Details</Text>
                <Text style={styles.profileBoxValue}>
                  {firstName} {middleInitial ? middleInitial + '. ' : ''}{lastName}
                </Text>
              </View>
            </View>

            <View style={styles.modalDivider} />

            <Text style={styles.modalNote}>
              Please review your details before confirming.
            </Text>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setShowProfileModal(false)}
                activeOpacity={0.8}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalConfirmBtn, savingProfile && styles.modalBtnDisabled]}
                onPress={handleSaveProfile}
                activeOpacity={0.8}
                disabled={savingProfile}
              >
                <Text style={styles.modalConfirmText}>
                  {savingProfile ? 'Saving...' : 'Confirm Update'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

// ─── STYLES ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.navy },
  layout: { flex: 1, flexDirection: 'row' },

  // ── Sidebar ──
  sidebarOverlay: {
    position: 'absolute', left: 0, top: 0, bottom: 0, right: 0,
    backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 15,
  },

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
  headerRight:    { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },

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
  fieldInputError: {
    borderColor: '#DC2626',
  },
  errorText: {
    fontSize: 11,
    color: '#DC2626',
    marginTop: 4,
    fontWeight: '500',
  },
  passwordNote: {
    fontSize: 10,
    color: COLORS.subText,
    marginTop: 4,
    fontStyle: 'italic',
  },
  passwordInputContainer: {
    position: 'relative',
  },
  passwordInput: {
    paddingRight: 40,
  },
  eyeIcon: {
    position: 'absolute',
    right: 12,
    top: '50%',
    marginTop: -10,
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eyeBtn: {
    position: 'absolute',
    right: 10,
    top: '50%',
    marginTop: -10,
    paddingLeft: 8,
  },
  eyeIconText: {
    fontSize: 16,
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

  // Modal styles
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  modalContent: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 20,
    width: '85%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.navy,
    textAlign: 'center',
    marginBottom: 8,
  },
  modalDivider: {
    height: 1,
    backgroundColor: COLORS.lightGray,
    marginVertical: 14,
  },
  modalInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  modalLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.darkText,
  },
  modalValue: {
    fontSize: 13,
    color: COLORS.subText,
    letterSpacing: 2,
  },
  passwordFlowContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  passwordBox: {
    flex: 1,
    backgroundColor: COLORS.offWhite,
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.lightGray,
  },
  passwordBoxLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: COLORS.subText,
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  passwordBoxValue: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.darkText,
  },
  arrowContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrowText: {
    fontSize: 24,
    color: COLORS.navy,
    fontWeight: '800',
  },
  modalNote: {
    fontSize: 11,
    color: COLORS.subText,
    fontStyle: 'italic',
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 16,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: COLORS.navy,
    alignItems: 'center',
  },
  modalCancelText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.navy,
  },
  modalConfirmBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: COLORS.navy,
    alignItems: 'center',
  },
  modalBtnDisabled: {
    opacity: 0.6,
  },
  modalConfirmText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.white,
  },

  // Profile modal styles
  profileFlowContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  profileBox: {
    flex: 1,
    backgroundColor: COLORS.offWhite,
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.lightGray,
  },
  profileBoxLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: COLORS.subText,
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  profileBoxValue: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.darkText,
  },
});