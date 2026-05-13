import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { supabase } from '../../utils/supabase';

const AuthContext = createContext();

// Map database role names to app roles
const ROLE_MAP = {
  'lydo': 'lydo',
  'sk_official': 'sk',
  'resident': 'public',
};

// Simple hash function for password hashing (for backward compatibility)
export function hashPassword(password) {
  let hash = 0;
  for (let i = 0; i < password.length; i++) {
    const char = password.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return 'hash_' + Math.abs(hash).toString(16) + '_' + password.length.toString();
}

// Encryption key (should be stored securely in production)
const ENCRYPTION_KEY = 'SKApp2024SecretKey';

// Simple base64 encode/decode helpers (works in React Native)
function base64Encode(str) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let result = '';
  let i = 0;
  while (i < str.length) {
    const a = str.charCodeAt(i++);
    const b = i < str.length ? str.charCodeAt(i++) : 0;
    const c = i < str.length ? str.charCodeAt(i++) : 0;
    const triplet = (a << 16) | (b << 8) | c;
    result += chars[(triplet >> 18) & 0x3F];
    result += chars[(triplet >> 12) & 0x3F];
    result += i > str.length + 1 ? '=' : chars[(triplet >> 6) & 0x3F];
    result += i > str.length ? '=' : chars[triplet & 0x3F];
  }
  return result;
}

function base64Decode(str) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let result = '';
  const cleanStr = str.replace(/=/g, '');
  let i = 0;
  while (i < cleanStr.length) {
    const a = chars.indexOf(cleanStr[i++]);
    const b = chars.indexOf(cleanStr[i++]);
    const c = chars.indexOf(cleanStr[i++]);
    const d = chars.indexOf(cleanStr[i++]);
    const triplet = (a << 18) | (b << 12) | (c << 6) | d;
    result += String.fromCharCode((triplet >> 16) & 0xFF);
    if (c !== -1) result += String.fromCharCode((triplet >> 8) & 0xFF);
    if (d !== -1) result += String.fromCharCode(triplet & 0xFF);
  }
  return result;
}

// Simple XOR-based encryption
function xorEncrypt(text, key) {
  let result = '';
  for (let i = 0; i < text.length; i++) {
    result += String.fromCharCode(text.charCodeAt(i) ^ key.charCodeAt(i % key.length));
  }
  return base64Encode(result);
}

// Simple XOR-based decryption
function xorDecrypt(encoded, key) {
  const decoded = base64Decode(encoded);
  let result = '';
  for (let i = 0; i < decoded.length; i++) {
    result += String.fromCharCode(decoded.charCodeAt(i) ^ key.charCodeAt(i % key.length));
  }
  return result;
}

// Encrypt password for storage
export function encryptPassword(password) {
  return xorEncrypt(password, ENCRYPTION_KEY);
}

// Decrypt password for display/verification
export function decryptPassword(encryptedPassword) {
  try {
    return xorDecrypt(encryptedPassword, ENCRYPTION_KEY);
  } catch (e) {
    return encryptedPassword; // Return as-is if decryption fails (plain text or old hash)
  }
}

// Validate password requirements
function validatePassword(password) {
  if (password.length < 8) {
    return 'Password must be at least 8 characters';
  }
  if (!/[a-z]/.test(password)) {
    return 'Password must contain a lowercase letter';
  }
  if (!/[A-Z]/.test(password)) {
    return 'Password must contain an uppercase letter';
  }
  if (!/[0-9]/.test(password)) {
    return 'Password must contain a digit';
  }
  if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    return 'Password must contain a symbol';
  }
  return null;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check for stored session
    const checkStoredSession = async () => {
      try {
        const storedUser = await AsyncStorage.getItem('sk_user');
        if (storedUser) {
          setUser(JSON.parse(storedUser));
        }
      } catch (error) {
        console.error('Error reading stored session:', error);
      }
      setIsLoading(false);
    };
    checkStoredSession();
  }, []);

  const login = async (email, password) => {
    try {
      // First check if user exists (without status filter)
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('email', email.toLowerCase())
        .maybeSingle();

      if (userError) {
        console.error('Supabase error:', userError);
        return { success: false, error: 'Invalid email or password' };
      }

      if (!userData) {
        return { success: false, error: 'Invalid email or password' };
      }

      // Check account status
      if (userData.status === 'pending') {
        return { success: false, error: 'Account is pending approval. Please wait for admin to approve your registration.' };
      }

      if (userData.status === 'inactive') {
        return { success: false, error: 'Account has been deactivated. Please contact the admin.' };
      }

      if (userData.status !== 'active') {
        return { success: false, error: 'Invalid account status' };
      }

      // Verify password (accept plain text, hashed, and encrypted for backward compatibility)
      const hashedInput = hashPassword(password);
      const decryptedStored = decryptPassword(userData.password);
      if (userData.password !== hashedInput && userData.password !== password && decryptedStored !== password) {
        return { success: false, error: 'Invalid email or password' };
      }

      // Get role name from roles table
      let dbRole = 'resident';
      const roleId = Number(userData.role_id);
      console.log('User role_id:', userData.role_id, 'Type:', typeof roleId);

      const { data: roleData } = await supabase
        .from('roles')
        .select('role_name')
        .eq('role_id', roleId)
        .maybeSingle();

      console.log('Role data:', roleData);
      if (roleData?.role_name) {
        dbRole = roleData.role_name;
      }

      const mappedRole = ROLE_MAP[dbRole] || 'public';
      console.log('dbRole:', dbRole, 'mappedRole:', mappedRole);

      // Get barangay info (only if barangay_id exists)
      let barangayData = null;
      if (userData.barangay_id) {
        const { data } = await supabase
          .from('barangays')
          .select('barangay_name, municipality, province')
          .eq('barangay_id', userData.barangay_id)
          .single();
        barangayData = data;
      }

      const userSession = {
        userId: userData.user_id,
        email: userData.email,
        firstName: userData.first_name,
        lastName: userData.last_name,
        name: `${userData.first_name} ${userData.last_name}`,
        role: mappedRole,
        roleName: dbRole,
        barangay: barangayData,
        barangayId: userData.barangay_id,
      };

      setUser(userSession);
      await AsyncStorage.setItem('sk_user', JSON.stringify(userSession));
      return { success: true, user: userSession };

    } catch (error) {
      console.error('Login error:', error);
      return { success: false, error: 'An error occurred during login' };
    }
  };

  const logout = async () => {
    setUser(null);
    await AsyncStorage.removeItem('sk_user');
  };

  const signup = async (email, password, firstName, lastName) => {
    try {
      // Validate password requirements
      const passwordError = validatePassword(password);
      if (passwordError) {
        return { success: false, error: passwordError };
      }

      // Check if email already exists
      const { data: existingUser } = await supabase
        .from('users')
        .select('user_id')
        .eq('email', email.toLowerCase())
        .maybeSingle();

      if (existingUser) {
        return { success: false, error: 'Email already registered' };
      }

      // Get resident role_id
      const { data: roleData } = await supabase
        .from('roles')
        .select('role_id')
        .eq('role_name', 'resident')
        .maybeSingle();

      // Encrypt password before storing
      const encryptedPassword = encryptPassword(password);

      // Insert user with 'pending' status — requires admin approval before login
      const { error: insertError } = await supabase
        .from('users')
        .insert({
          first_name: firstName,
          last_name: lastName,
          email: email.toLowerCase(),
          password: encryptedPassword,
          role_id: roleData?.role_id || 1,
          position: null,
          barangay_id: null,
          status: 'pending',
        });

      if (insertError) {
        console.error('Insert error:', insertError);
        return { success: false, error: 'Database error: ' + insertError.message };
      }

      // Return success without creating a session — user must wait for admin approval
      return {
        success: true,
        user: { email, name: `${firstName} ${lastName}`, role: 'public' },
      };

    } catch (error) {
      console.error('Signup error:', error);
      return { success: false, error: 'An error occurred during signup' };
    }
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, signup, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}