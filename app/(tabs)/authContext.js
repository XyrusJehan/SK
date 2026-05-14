import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import AES from 'react-native-aes-crypto';

import { supabase } from '../../utils/supabase';

const AuthContext = createContext();

// Map database role names to app roles
const ROLE_MAP = {
  'lydo': 'lydo',
  'sk_official': 'sk',
  'resident': 'public',
};

// AES-128 encryption key (16 bytes = 128 bits)
const ENCRYPTION_KEY = 'SKApp2024Key16'; // Must be 16 characters for AES-128
const IV_LENGTH = 16; // AES block size

// Encrypt password using AES-128-CBC
export async function encryptPassword(password) {
  try {
    const iv = await AES.randomIV(IV_LENGTH);
    const encrypted = await AES.encrypt(password, ENCRYPTION_KEY, iv, 'aes-128-cbc');
    // Return IV + encrypted data (IV is prepended for decryption)
    return iv + ':' + encrypted;
  } catch (e) {
    console.error('Encryption error:', e);
    return password;
  }
}

// Decrypt password using AES-128-CBC
export async function decryptPassword(encryptedPassword) {
  try {
    // Split IV and encrypted data
    const parts = encryptedPassword.split(':');
    if (parts.length !== 2) {
      return encryptedPassword; // Not in expected format, return as-is
    }
    const iv = parts[0];
    const encrypted = parts[1];
    const decrypted = await AES.decrypt(encrypted, ENCRYPTION_KEY, iv, 'aes-128-cbc');
    return decrypted;
  } catch (e) {
    console.error('Decryption error:', e);
    return encryptedPassword; // Return as-is if decryption fails
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

      // Verify password (accept plain text and encrypted)
      const encryptedInput = await encryptPassword(password);
      const decryptedStored = await decryptPassword(userData.password);
      if (userData.password !== encryptedInput && userData.password !== password && decryptedStored !== password) {
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
      const encryptedPassword = await encryptPassword(password);

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