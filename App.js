// App.js  —  root navigator
// Install deps first:
//   npx expo install @react-navigation/native @react-navigation/native-stack
//   npx expo install react-native-screens react-native-safe-area-context

import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import HomeScreen       from './screens/HomeScreen';
import DocumentsScreen  from './screens/DocumentsScreen';
import DocumentListScreen from './screens/DocumentListScreen';

const Stack = createNativeStackNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName="Home"
        screenOptions={{ headerShown: false }} // we use custom headers
      >
        <Stack.Screen name="Home"         component={HomeScreen} />
        <Stack.Screen name="Documents"    component={DocumentsScreen} />
        <Stack.Screen
          name="DocumentList"
          component={DocumentListScreen}
          options={{ animation: 'slide_from_right' }}
        />
        <Stack.Screen name="Login"  component={LoginScreen} />
<Stack.Screen name="SignUp" component={SignUpScreen} />
// Set initialRouteName="Login" so the app opens on login
      </Stack.Navigator>
    </NavigationContainer>
  );
}

// ─── HOW NAVIGATION FLOWS ────────────────────────────────────────────────────
//
//  HomeScreen
//    └─ tap "Documents" sidebar  →  DocumentsScreen
//
//  DocumentsScreen
//    ├─ tap any category CARD    →  DocumentListScreen  ({ category: 'Planning' | 'Financial' | ... })
//    ├─ tap category TAB (not All) →  DocumentListScreen  ({ category: ... })
//    └─ tap "Create New +"       →  DocumentListScreen  ({ category: 'All' })
//
//  DocumentListScreen
//    ├─ category tabs at top let user switch without going back
//    ├─ tap ⋮ menu               →  Alert with View / Download / Delete
//    └─ tap sidebar "Documents"  →  DocumentsScreen  (pop back)
