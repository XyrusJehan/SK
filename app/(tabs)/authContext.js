import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../../utils/supabase';

const AuthContext = createContext();

// Map database role names to app roles
const ROLE_MAP = {
  'lydo': 'lydo',
  'sk_official': 'sk',
  'resident': 'public',
};

// Simple hash function for password hashing
function hashPassword(password) {
  let hash = 0;
  for (let i = 0; i < password.length; i++) {
    const char = password.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return 'hash_' + Math.abs(hash).toString(16) + '_' + password.length.toString();
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
    const storedUser = localStorage.getItem('sk_user');
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
    setIsLoading(false);
  }, []);

  const login = async (email, password) => {
    try {
      // Query users table
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('email', email.toLowerCase())
        .eq('status', 'active')
        .maybeSingle();

      if (userError) {
        console.error('Supabase error:', userError);
        return { success: false, error: 'Invalid email or password' };
      }

      if (!userData) {
        return { success: false, error: 'Invalid email or password' };
      }

      // Verify password (accept both hashed and plain text for backward compatibility)
      const hashedInput = hashPassword(password);
      if (userData.password !== hashedInput && userData.password !== password) {
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
      localStorage.setItem('sk_user', JSON.stringify(userSession));
      return { success: true, user: userSession };

    } catch (error) {
      console.error('Login error:', error);
      return { success: false, error: 'An error occurred during login' };
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('sk_user');
  };

  const signup = async (email, password, firstName, lastName) => {
    try {
      // Clear any existing session before signup
      setUser(null);
      localStorage.removeItem('sk_user');

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

      // Hash password before storing
      const hashedPassword = hashPassword(password);

      // Insert user directly into users table
      const { error: insertError } = await supabase
        .from('users')
        .insert({
          first_name: firstName,
          last_name: lastName,
          email: email.toLowerCase(),
          password: hashedPassword,
          role_id: roleData?.role_id || 1,
          barangay_id: null,
          status: 'active',
        });

      if (insertError) {
        console.error('Insert error:', insertError);
        return { success: false, error: 'Database error: ' + insertError.message };
      }

      // Fetch the newly created user
      const { data: newUser, error: fetchError } = await supabase
        .from('users')
        .select(`
          *,
          roles (role_name)
        `)
        .eq('email', email.toLowerCase())
        .single();

      if (fetchError || !newUser) {
        console.error('Fetch error:', fetchError);
        return { success: true, user: { email, name: `${firstName} ${lastName}`, role: 'public' } };
      }

      const userSession = {
        userId: newUser.user_id,
        email: newUser.email,
        firstName: newUser.first_name,
        lastName: newUser.last_name,
        name: `${newUser.first_name} ${newUser.last_name}`,
        role: 'public',
        roleName: newUser.roles?.role_name,
        barangay: null,
      };

      setUser(userSession);
      localStorage.setItem('sk_user', JSON.stringify(userSession));
      return { success: true, user: userSession };

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