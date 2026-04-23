import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext();

// Temporary accounts for testing
const TEMP_ACCOUNTS = [
  { email: 'lydo@sk.com', password: 'lydo123', name: 'LYDO', role: 'lydo' },
  { email: 'sk@sk.com', password: 'sk123', name: 'SK Barangay', role: 'sk' },
];

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

  const login = (email, password) => {
    const account = TEMP_ACCOUNTS.find(
      (acc) => acc.email.toLowerCase() === email.toLowerCase() && acc.password === password
    );

    if (account) {
      const userData = { email: account.email, name: account.name, role: account.role };
      setUser(userData);
      localStorage.setItem('sk_user', JSON.stringify(userData));
      return { success: true, user: userData };
    }

    return { success: false, error: 'Invalid email or password' };
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('sk_user');
  };

  const signup = (email, password, firstName, lastName) => {
    // For demo, just create a new account
    const newUser = { email, name: `${firstName} ${lastName}`, role: 'sk' };
    setUser(newUser);
    localStorage.setItem('sk_user', JSON.stringify(newUser));
    return { success: true, user: newUser };
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