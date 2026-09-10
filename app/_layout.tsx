import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { AuthProvider } from './(tabs)/authContext';
import Head from 'expo-router/head';

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <SafeAreaProvider>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <Head>
          <title>SK Monitoring</title>
          <meta name="description" content="SK Monitoring System for the Sangguniang Kabataan" />
          <meta name="theme-color" content="#1E3A6E" />
        </Head>
        <AuthProvider>
          <Stack screenOptions={{ headerShown: false, title: 'SK Monitoring' }}>
            <Stack.Screen name="index" options={{ title: 'SK Monitoring' }} />
            <Stack.Screen name="signup" options={{ title: 'SK Monitoring' }} />
            <Stack.Screen name="(tabs)" options={{ title: 'SK Monitoring' }} />
            <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
          </Stack>
          <StatusBar style="auto" />
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
