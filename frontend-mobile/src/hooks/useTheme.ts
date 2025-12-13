/**
 * Study Master - Theme Hook
 * Hook pour accéder au thème actuel (light/dark)
 */

import { useColorScheme } from 'react-native';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LightTheme, DarkTheme, Colors } from '@/constants/theme';
import type { ThemeMode } from '@/types';

// ============================================
// THEME STORE
// ============================================

interface ThemeState {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      mode: 'auto',
      setMode: (mode: ThemeMode) => set({ mode }),
    }),
    {
      name: 'theme-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);

// ============================================
// USE THEME HOOK
// ============================================

export function useTheme() {
  const systemColorScheme = useColorScheme();
  const { mode, setMode } = useThemeStore();

  // Déterminer le thème effectif
  const effectiveMode: 'light' | 'dark' =
    mode === 'auto'
      ? systemColorScheme === 'dark'
        ? 'dark'
        : 'light'
      : mode;

  const isDark = effectiveMode === 'dark';
  const theme = isDark ? DarkTheme : LightTheme;

  return {
    // État
    mode,
    effectiveMode,
    isDark,
    isLight: !isDark,

    // Couleurs du thème
    colors: theme.colors,

    // Couleurs globales (indépendantes du thème)
    palette: Colors,

    // Actions
    setMode,
    toggleTheme: () => setMode(isDark ? 'light' : 'dark'),
    setAutoTheme: () => setMode('auto'),
  };
}

// ============================================
// THEME-AWARE STYLES HELPER
// ============================================

// Type for theme colors (compatible with both light and dark themes)
type ThemeColors = typeof LightTheme.colors | typeof DarkTheme.colors;

export function useThemedStyles<T extends Record<string, any>>(
  stylesFn: (colors: ThemeColors, isDark: boolean) => T
): T {
  const { colors, isDark } = useTheme();
  return stylesFn(colors, isDark);
}

export default useTheme;
