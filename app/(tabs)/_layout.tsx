import { Tabs } from 'expo-router';
import React from 'react';

import { HapticTab } from '@/components/haptic-tab';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
<<<<<<< HEAD
import { NavProvider } from './navContext';
=======
>>>>>>> 4883f35edbfdaedde52ffa8c6d7b191a5a3f2f24

export default function TabLayout() {
  const colorScheme = useColorScheme();

<<<<<<< HEAD
  return (
    <NavProvider>
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: Colors[colorScheme ?? 'light'].tint,
          headerShown: false,
          tabBarButton: HapticTab,
        }}>
      </Tabs>
    </NavProvider>
  );
}
=======
  return ( 
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors[colorScheme ?? 'light'].tint,
        headerShown: false,
        tabBarButton: HapticTab,
      }}>
<Tabs screenOptions={{ tabBarStyle: { display: "none" } }} />
    </Tabs>
  );
}
>>>>>>> 4883f35edbfdaedde52ffa8c6d7b191a5a3f2f24
