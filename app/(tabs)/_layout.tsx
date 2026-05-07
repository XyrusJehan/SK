import { Tabs } from 'expo-router';
import React, { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { useAuth } from './authContext';

import { NavProvider } from './navContext';

export default function TabLayout() {
  const router = useRouter();
  const { user, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace('/');
    } else if (!isLoading && user && user.role === 'public') {
      // Public/resident users should not access tab screens
      router.replace('/');
    }
  }, [user, isLoading]);

  if (isLoading || !user) {
    return null;
  }

  return (
    <NavProvider>
      <Tabs screenOptions={{ headerShown: false, tabBarStyle: { display: 'none' } }}>
        <Tabs.Screen name="sk-dashboard" />
        <Tabs.Screen name="sk-document" />
        <Tabs.Screen name="sk-document-list" />
        <Tabs.Screen name="sk-planning" />
        <Tabs.Screen name="sk-planning-budget" />
        <Tabs.Screen name="sk-portal" />
        <Tabs.Screen name="sk-portal-feedback" />
        <Tabs.Screen name="lydo-home" />
        <Tabs.Screen name="lydo-document" />
        <Tabs.Screen name="lydo-document-list" />
        <Tabs.Screen name="lydo-document-reports" />
        <Tabs.Screen name="lydo-document-templates" />
        <Tabs.Screen name="lydo-monitor" />
        <Tabs.Screen name="lydo-monitor-budget" />
        <Tabs.Screen name="lydo-monitor-report" />
      </Tabs>
    </NavProvider>
  );
}