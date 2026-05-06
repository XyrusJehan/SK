import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, SafeAreaView, StatusBar,
  KeyboardAvoidingView, Platform, ScrollView,
  Dimensions, Image, Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from './(tabs)/authContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const isMobile = SCREEN_WIDTH < 400;

const COLORS = {
  navy: '#1E3A6E',
  navyDark: '#162D55',
  navyLight: '#264A88',
  white: '#FFFFFF',
  placeholder: '#999',
  label: '#FFFFFF',
  subText: 'rgba(255,255,255,0.65)',
  link: '#90B8F0',
  btnBg: '#FFFFFF',
  btnText: '#1E3A6E',
  gold: '#C8A84B',
  error: '#FF6B6B',
  success: '#4CAF50',
};

const InputField = ({ label, placeholder, value, onChangeText, secureTextEntry, keyboardType, autoCapitalize, style }) => {
  const [focused, setFocused] = useState(false);
  const [show, setShow] = useState(false);
  const isPassword = secureTextEntry;

  return (
    <View style={style}>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.inputWrap, focused && styles.inputWrapFocus]}>
        <TextInput
          style={[styles.input, { flex: 1 }]}
          placeholder={placeholder}
          placeholderTextColor={COLORS.placeholder}
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={isPassword && !show}
          keyboardType={keyboardType ?? 'default'}
          autoCapitalize={autoCapitalize ?? 'words'}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />
        {isPassword && (
          <TouchableOpacity onPress={() => setShow(!show)} style={styles.eyeBtn}>
            <Text style={styles.eyeIcon}>{show ? '🙈' : '👁'}</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

export default function SignUpScreen() {
  const router = useRouter();
  const { signup } = useAuth();
  const [lastName, setLastName] = useState('');
  const [firstName, setFirstName] = useState('');
  const [middleInitial, setMiddleInitial] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  const handleSignUp = async () => {
    if (!lastName || !firstName || !email || !password || !confirmPassword) {
      setError('Please fill in all required fields.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (!agreed) {
      setError('Please agree to the terms of service and privacy policy.');
      return;
    }
    setError('');
    setIsLoading(true);

    const result = await signup(email, password, firstName, lastName);
    setIsLoading(false);

    if (result.success) {
      setShowSuccessModal(true);
    } else {
      setError(result.error);
    }
  };

  return (
    <>
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.navyDark} />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.card}>

            {/* Seal */}
            <View style={styles.sealWrap}>
              <Image
                source={require('./../assets/images/rizal-logo.png')}
                style={styles.logoImage}
                resizeMode="contain"
              />
            </View>

            {/* Name Row */}
            <View style={styles.nameRow}>
              <InputField
                label="Last Name"
                placeholder="Last Name"
                value={lastName}
                onChangeText={setLastName}
                style={isMobile ? styles.nameFieldStack : styles.nameFieldLarge}
              />
              <InputField
                label="First Name"
                placeholder="First Name"
                value={firstName}
                onChangeText={setFirstName}
                style={isMobile ? styles.nameFieldStack : styles.nameFieldLarge}
              />
              {!isMobile && (
                <InputField
                  label="M.I."
                  placeholder="M.I."
                  value={middleInitial}
                  onChangeText={(t) => setMiddleInitial(t.slice(0, 2).toUpperCase())}
                  style={styles.nameFieldSmall}
                />
              )}
            </View>

            {/* Mobile: Middle Initial below */}
            {isMobile && (
              <InputField
                label="M.I."
                placeholder="M.I."
                value={middleInitial}
                onChangeText={(t) => setMiddleInitial(t.slice(0, 2).toUpperCase())}
                style={{ marginTop: 14 }}
              />
            )}

            {/* Email */}
            <InputField
              label="E-mail"
              placeholder="Enter your E-mail"
              value={email}
              onChangeText={(text) => {
                setEmail(text);
                setError('');
              }}
              keyboardType="email-address"
              autoCapitalize="none"
              style={{ marginTop: 14 }}
            />

            {/* Password */}
            <InputField
              label="Password"
              placeholder="Password"
              value={password}
              onChangeText={(text) => {
                setPassword(text);
                setError('');
              }}
              secureTextEntry
              autoCapitalize="none"
              style={{ marginTop: 14 }}
            />

            {/* Confirm Password */}
            <InputField
              label="Confirm Password"
              placeholder="Confirm Password"
              value={confirmPassword}
              onChangeText={(text) => {
                setConfirmPassword(text);
                setError('');
              }}
              secureTextEntry
              autoCapitalize="none"
              style={{ marginTop: 14 }}
            />

            {/* Password match indicator */}
            {confirmPassword.length > 0 && (
              <Text style={[
                styles.matchHint,
                { color: password === confirmPassword ? COLORS.success : COLORS.error }
              ]}>
                {password === confirmPassword ? '✓ Passwords match' : '✗ Passwords do not match'}
              </Text>
            )}

            {/* Error */}
            {error !== '' && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            {/* Terms Checkbox */}
            <TouchableOpacity
              style={styles.termsRow}
              onPress={() => setAgreed(!agreed)}
              activeOpacity={0.8}
            >
              <View style={[styles.checkbox, agreed && styles.checkboxChecked]}>
                {agreed && <Text style={styles.checkMark}>✓</Text>}
              </View>
              <Text style={styles.termsText}>
                I agree to the{' '}
                <Text style={styles.termsLink}>terms of services</Text>
                {' '}and{' '}
                <Text style={styles.termsLink}>privacy policy</Text>
              </Text>
            </TouchableOpacity>

            {/* Sign Up Button */}
            <TouchableOpacity
              style={[styles.signUpBtn, (!agreed || isLoading) && styles.signUpBtnDisabled]}
              onPress={handleSignUp}
              activeOpacity={agreed ? 0.85 : 1}
              disabled={isLoading}
            >
              <Text style={styles.signUpBtnText}>{isLoading ? 'Creating Account...' : 'Sign Up'}</Text>
            </TouchableOpacity>

            {/* Login link */}
            <View style={styles.loginRow}>
              <Text style={styles.subText}>Already have an account? </Text>
              <TouchableOpacity onPress={() => router.back()}>
                <Text style={styles.linkText}>Login</Text>
              </TouchableOpacity>
            </View>

          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>

      {/* Success Modal */}
      <Modal
        visible={showSuccessModal}
        transparent
        animationType="fade"
        statusBarTranslucent
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.checkCircle}>
              <Text style={styles.checkIcon}>✓</Text>
            </View>
            <Text style={styles.modalTitle}>SIGN-UP SUCCESSFUL!</Text>
            <Text style={styles.modalBody}>
              Thanks! your account is now created. Please wait for{'\n'}
              the Admin reviews and approves your registration.{'\n'}
              You will receive an email once it's finalized.
            </Text>
            <TouchableOpacity
              style={styles.modalBtn}
              onPress={() => {
                setShowSuccessModal(false);
                router.replace('/');
              }}
              activeOpacity={0.85}
            >
              <Text style={styles.modalBtnText}>OK, GOT IT</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.navyDark },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    paddingVertical: 32,
  },
  card: {
    width: '100%',
    maxWidth: 440,
    backgroundColor: COLORS.navy,
    borderRadius: 20,
    padding: isMobile ? 16 : 28,
    paddingTop: isMobile ? 20 : 36,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },

  // Seal
  sealWrap: { alignItems: 'center', marginBottom: isMobile ? 20 : 28 },
  logoImage: {
    width: isMobile ? 100 : 120,
    height: isMobile ? 100 : 120,
  },

  // Name Row
  nameRow: { flexDirection: 'row', gap: isMobile ? 6 : 8 },
  nameFieldLarge: { flex: 1 },
  nameFieldSmall: { width: isMobile ? 50 : 60 },
  nameFieldStack: { flex: 1 },

  // Labels & Inputs
  label: { fontSize: 12, fontWeight: '700', color: COLORS.label, marginBottom: 5, marginTop: 2 },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.white, borderRadius: 9,
    borderWidth: 2, borderColor: 'transparent',
    paddingHorizontal: 12, height: 46,
  },
  inputWrapFocus: { borderColor: COLORS.gold },
  input: { flex: 1, fontSize: 13, color: '#1A1A1A', padding: 0 },
  eyeBtn: { paddingLeft: 8 },
  eyeIcon: { fontSize: 15 },

  // Match hint
  matchHint: { fontSize: 11, fontWeight: '600', marginTop: 6, marginLeft: 2 },

  // Error
  errorBox: {
    backgroundColor: 'rgba(255,107,107,0.15)',
    borderRadius: 8, padding: 10,
    borderWidth: 1, borderColor: COLORS.error,
    marginTop: 12,
  },
  errorText: { fontSize: 12, color: COLORS.error, fontWeight: '600', textAlign: 'center' },

  // Terms
  termsRow: {
    flexDirection: 'row', alignItems: 'flex-start',
    gap: 10, marginTop: 20,
  },
  checkbox: {
    width: 20, height: 20, borderRadius: 5,
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.5)',
    alignItems: 'center', justifyContent: 'center',
    marginTop: 1,
  },
  checkboxChecked: { backgroundColor: COLORS.gold, borderColor: COLORS.gold },
  checkMark: { fontSize: 12, fontWeight: '900', color: COLORS.navy },
  termsText: { flex: 1, fontSize: 12, color: COLORS.subText, lineHeight: 18 },
  termsLink: { color: COLORS.link, fontWeight: '700' },

  // Button
  signUpBtn: {
    backgroundColor: COLORS.btnBg, borderRadius: 10,
    height: 50, alignItems: 'center', justifyContent: 'center',
    marginTop: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15, shadowRadius: 6, elevation: 4,
  },
  signUpBtnDisabled: { opacity: 0.6 },
  signUpBtnText: { fontSize: 16, fontWeight: '800', color: COLORS.btnText, letterSpacing: 0.5 },

  // Login link
  loginRow: {
    flexDirection: 'row', justifyContent: 'center',
    alignItems: 'center', marginTop: 16,
  },
  subText: { fontSize: 12, color: COLORS.subText },
  linkText: { fontSize: 12, fontWeight: '700', color: COLORS.link },

  // Success Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    backgroundColor: COLORS.navy,
    borderRadius: 20,
    padding: 28,
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.4,
    shadowRadius: 24,
    elevation: 12,
  },
  checkCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#2EAA57',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    shadowColor: '#2EAA57',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 6,
  },
  checkIcon: { fontSize: 36, color: COLORS.white, fontWeight: '900' },
  modalTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: COLORS.white,
    letterSpacing: 0.5,
    marginBottom: 14,
    textAlign: 'center',
  },
  modalBody: {
    fontSize: 13,
    color: COLORS.subText,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  modalBtn: {
    backgroundColor: COLORS.navyLight,
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 48,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  modalBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.white,
    letterSpacing: 1,
  },
});