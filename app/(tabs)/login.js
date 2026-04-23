import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, SafeAreaView, StatusBar,
  KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';

// Replace with: import { Image } from 'react-native'; and use your seal asset
// <Image source={require('../assets/seal.png')} style={styles.seal} />

const COLORS = {
  navy: '#1E3A6E',
  navyDark: '#162D55',
  navyLight: '#264A88',
  white: '#FFFFFF',
  inputBg: '#FFFFFF',
  inputBorder: 'rgba(255,255,255,0.3)',
  inputBorderFocus: '#FFFFFF',
  placeholder: '#999',
  label: '#FFFFFF',
  subText: 'rgba(255,255,255,0.65)',
  link: '#90B8F0',
  btnBg: '#FFFFFF',
  btnText: '#1E3A6E',
  gold: '#C8A84B',
};

export default function LoginScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [passFocused, setPassFocused] = useState(false);

  const handleLogin = () => {
    // TODO: hook up your auth logic
    navigation.navigate('Home');
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
              {/* Replace this placeholder with your actual seal image */}
              <View style={styles.sealPlaceholder}>
                <View style={styles.sealInner}>
                  <Text style={styles.sealText}>SK</Text>
                  <Text style={styles.sealSub}>SEAL</Text>
                </View>
              </View>
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
                onChangeText={setEmail}
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
                onChangeText={setPassword}
                onFocus={() => setPassFocused(true)}
                onBlur={() => setPassFocused(false)}
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeBtn}>
                <Text style={styles.eyeIcon}>{showPassword ? '🙈' : '👁'}</Text>
              </TouchableOpacity>
            </View>

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
              <TouchableOpacity onPress={() => navigation.navigate('SignUp')}>
                <Text style={styles.linkText}>Sign Up</Text>
              </TouchableOpacity>
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
    padding: 32,
    paddingTop: 40,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },

  // Seal
  sealWrap: { alignItems: 'center', marginBottom: 36 },
  sealPlaceholder: {
    width: 96, height: 96, borderRadius: 48,
    backgroundColor: COLORS.navyLight,
    borderWidth: 3, borderColor: COLORS.gold,
    alignItems: 'center', justifyContent: 'center',
  },
  sealInner: { alignItems: 'center' },
  sealText: { fontSize: 22, fontWeight: '900', color: COLORS.white },
  sealSub: { fontSize: 9, fontWeight: '700', color: COLORS.gold, letterSpacing: 2 },

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
});