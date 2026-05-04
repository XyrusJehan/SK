import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, SafeAreaView, StatusBar,
  KeyboardAvoidingView, Platform, ScrollView,
  Dimensions, Image,
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
  inputBg: '#FFFFFF',
  placeholder: '#999',
  label: '#FFFFFF',
  subText: 'rgba(255,255,255,0.65)',
  link: '#90B8F0',
  btnBg: '#FFFFFF',
  btnText: '#1E3A6E',
  gold: '#C8A84B',
  error: '#FF6B6B',
};

export default function LoginScreen() {
  const router = useRouter();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [passFocused, setPassFocused] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = () => {
    if (!email || !password) {
      setError('Please enter email and password');
      return;
    }

    const result = login(email, password);
    if (result.success) {
      setError('');
      if (result.user.role === 'lydo') {
        router.replace('/(tabs)/lydo-home');
      } else {
        router.replace('/(tabs)/sk-dashboard');
      }
    } else {
      setError(result.error);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.navyDark} />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.card}>

            {/* Seal / Logo */}
            <View style={styles.sealWrap}>
              <Image
                source={require('./../assets/images/rizal-logo.png')}
                style={styles.logoImage}
                resizeMode="contain"
              />
            </View>

            {/* E-mail */}
            <Text style={styles.label}>E-mail</Text>
            <View style={[styles.inputWrap, emailFocused && styles.inputWrapFocus]}>
              <TextInput
                style={styles.input}
                placeholder="Enter your E-mail"
                placeholderTextColor={COLORS.placeholder}
                keyboardType="email-address"
                autoCapitalize="none"
                value={email}
                onChangeText={(text) => {
                  setEmail(text);
                  setError('');
                }}
                onFocus={() => setEmailFocused(true)}
                onBlur={() => setEmailFocused(false)}
              />
            </View>

            {/* Password */}
            <Text style={styles.label}>Password</Text>
            <View style={[styles.inputWrap, passFocused && styles.inputWrapFocus]}>
              <TextInput
                style={[styles.input, { flex: 1 }]}
                placeholder="Password"
                placeholderTextColor={COLORS.placeholder}
                secureTextEntry={!showPassword}
                value={password}
                onChangeText={(text) => {
                  setPassword(text);
                  setError('');
                }}
                onFocus={() => setPassFocused(true)}
                onBlur={() => setPassFocused(false)}
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeBtn}>
                <Text style={styles.eyeIcon}>{showPassword ? '⌣' : '👁'}</Text>
              </TouchableOpacity>
            </View>

            {/* Error Message */}
            {error !== '' && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            {/* Forgot Password */}
            <TouchableOpacity style={styles.forgotWrap} onPress={() => {}}>
              <Text style={styles.forgotText}>Forgot Password?</Text>
            </TouchableOpacity>

            {/* Login Button */}
            <TouchableOpacity style={styles.loginBtn} onPress={handleLogin} activeOpacity={0.85}>
              <Text style={styles.loginBtnText}>Login</Text>
            </TouchableOpacity>

            {/* Sign Up Link */}
            <View style={styles.signupRow}>
              <Text style={styles.subText}>Don't have an account? </Text>
              <TouchableOpacity onPress={() => router.push('/signup')}>
                <Text style={styles.linkText}>Sign Up</Text>
              </TouchableOpacity>
            </View>

            {/* Demo Accounts Info */}
            <View style={styles.demoBox}>
              <Text style={styles.demoTitle}>Demo Accounts:</Text>
              <Text style={styles.demoText}>LYDO: lydo@sk.com / lydo123</Text>
              <Text style={styles.demoText}>SK: sk@sk.com / sk123</Text>
            </View>

          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.navyDark },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: COLORS.navy,
    borderRadius: 20,
    padding: isMobile ? 20 : 32,
    paddingTop: isMobile ? 24 : 40,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },

  // Seal / Logo
  sealWrap: { alignItems: 'center', marginBottom: isMobile ? 24 : 36 },
  logoImage: {
    width: isMobile ? 120 : 140,
    height: isMobile ? 120 : 140,
  },

  // Labels & Inputs
  label: {
    fontSize: 13, fontWeight: '700',
    color: COLORS.label, marginBottom: 6, marginTop: 14,
  },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.inputBg,
    borderRadius: 10, borderWidth: 2,
    borderColor: 'transparent',
    paddingHorizontal: 14,
    height: 50,
  },
  inputWrapFocus: { borderColor: COLORS.gold },
  input: {
    flex: 1, fontSize: 14,
    color: '#1A1A1A', padding: 0,
  },
  eyeBtn: { paddingLeft: 8 },
  eyeIcon: { fontSize: 16 },

  // Error
  errorBox: {
    backgroundColor: 'rgba(255,107,107,0.15)',
    borderRadius: 8, padding: 10,
    borderWidth: 1, borderColor: COLORS.error,
    marginTop: 12,
  },
  errorText: { fontSize: 12, color: COLORS.error, fontWeight: '600', textAlign: 'center' },

  // Forgot
  forgotWrap: { alignItems: 'flex-end', marginTop: 8, marginBottom: 4 },
  forgotText: { fontSize: 12, color: COLORS.link, fontWeight: '600' },

  // Button
  loginBtn: {
    backgroundColor: COLORS.btnBg,
    borderRadius: 10, height: 50,
    alignItems: 'center', justifyContent: 'center',
    marginTop: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
  },
  loginBtnText: { fontSize: 16, fontWeight: '800', color: COLORS.btnText, letterSpacing: 0.5 },

  // Sign Up link
  signupRow: {
    flexDirection: 'row', justifyContent: 'center',
    alignItems: 'center', marginTop: 18,
  },
  subText: { fontSize: 13, color: COLORS.subText },
  linkText: { fontSize: 13, fontWeight: '700', color: COLORS.link },

  // Demo Box
  demoBox: {
    marginTop: 24,
    padding: 12,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 10,
  },
  demoTitle: { fontSize: 12, fontWeight: '700', color: COLORS.gold, marginBottom: 6 },
  demoText: { fontSize: 11, color: COLORS.subText, marginBottom: 2 },
});