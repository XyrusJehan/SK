import { Tabs } from 'expo-router';
import React from 'react';

import { NavProvider } from './navContext';

export default function TabLayout() {
  return (
    <NavProvider>
      <Tabs screenOptions={{ headerShown: false, tabBarStyle: { display: 'none' } }}>
        <Tabs.Screen name="sk-dashboard" />
        <Tabs.Screen name="sk-document" />
        <Tabs.Screen name="sk-document-list" />
        <Tabs.Screen name="sk-planning" />
        <Tabs.Screen name="sk-planning-templates" />
        <Tabs.Screen name="sk-portal" />
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