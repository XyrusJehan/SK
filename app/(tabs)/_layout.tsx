import { Tabs } from 'expo-router';
import React from 'react';

import { NavProvider } from './navContext';

export default function TabLayout() {
  return (
    <NavProvider>
      <Tabs screenOptions={{ headerShown: false, tabBarStyle: { display: 'none' } }}>
        <Tabs.Screen name="sk-home" />
        <Tabs.Screen name="sk-document" />
        <Tabs.Screen name="sk-document-list" />
        <Tabs.Screen name="lydo-home" />
      </Tabs>
    </NavProvider>
  );
}