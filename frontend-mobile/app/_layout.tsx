/**
 * Study Master - Root Layout
 * Configuration principale de l'application
 */

import { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import * as Font from 'expo-font';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Toast from 'react-native-toast-message';
import { useTheme } from '@/hooks/useTheme';
import { useAuthStore } from '@/stores/authStore';

// Empêcher le splash screen de se cacher automatiquement
SplashScreen.preventAutoHideAsync();

// Créer le client React Query
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 2,
      refetchOnWindowFocus: false,
    },
  },
});

// ============================================
// ROOT LAYOUT
// ============================================

export default function RootLayout() {
  const { colors, isDark, effectiveMode } = useTheme();
  const { initialize, isInitialized } = useAuthStore();

  useEffect(() => {
    async function prepare() {
      try {
        // Charger les polices si nécessaire
        // await Font.loadAsync({
        //   'Inter-Regular': require('@assets/fonts/Inter-Regular.ttf'),
        // });

        // Initialiser l'authentification
        await initialize();
      } catch (e) {
        console.warn('Error during app initialization:', e);
      } finally {
        // Cacher le splash screen
        await SplashScreen.hideAsync();
      }
    }

    prepare();
  }, []);

  if (!isInitialized) {
    return null; // ou un écran de chargement
  }

  return (
    <QueryClientProvider client={queryClient}>
      <GestureHandlerRootView style={styles.container}>
        <View style={[styles.container, { backgroundColor: colors.background }]}>
          <StatusBar style={isDark ? 'light' : 'dark'} />

          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: colors.background },
              animation: 'slide_from_right',
            }}
          >
            <Stack.Screen name="(auth)" options={{ headerShown: false }} />
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen
              name="(modals)"
              options={{
                presentation: 'modal',
                animation: 'slide_from_bottom',
              }}
            />
          </Stack>

          <Toast />
        </View>
      </GestureHandlerRootView>
    </QueryClientProvider>
  );
}

// ============================================
// STYLES
// ============================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
