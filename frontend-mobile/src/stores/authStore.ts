/**
 * Study Master - Auth Store
 * Gestion de l'état d'authentification avec Zustand
 */

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api, { tokenService, getErrorMessage } from '@/services/api';
import type {
  User,
  UserStats,
  AuthResponse,
  LoginRequest,
  RegisterRequest,
} from '@/types';

// ============================================
// TYPES
// ============================================

interface AuthState {
  // État
  user: User | null;
  userStats: UserStats | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isInitialized: boolean;
  error: string | null;

  // Actions
  initialize: () => Promise<void>;
  login: (credentials: LoginRequest) => Promise<void>;
  register: (data: RegisterRequest) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  refreshStats: () => Promise<void>;
  updateUser: (updates: Partial<User>) => void;
  clearError: () => void;
}

// ============================================
// STORE
// ============================================

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      // État initial
      user: null,
      userStats: null,
      isAuthenticated: false,
      isLoading: false,
      isInitialized: false,
      error: null,

      // ============================================
      // INITIALISATION
      // ============================================
      initialize: async () => {
        try {
          set({ isLoading: true, error: null });

          const hasTokens = await tokenService.hasTokens();

          if (hasTokens) {
            // Essayer de récupérer l'utilisateur
            try {
              const response = await api.get<User>('/users/me');
              set({
                user: response.data,
                isAuthenticated: true,
                isInitialized: true,
                isLoading: false,
              });

              // Charger les stats en background
              get().refreshStats();
            } catch {
              // Token invalide, déconnecter
              await tokenService.clearTokens();
              set({
                user: null,
                userStats: null,
                isAuthenticated: false,
                isInitialized: true,
                isLoading: false,
              });
            }
          } else {
            set({
              isInitialized: true,
              isLoading: false,
            });
          }
        } catch (error) {
          set({
            error: getErrorMessage(error),
            isInitialized: true,
            isLoading: false,
          });
        }
      },

      // ============================================
      // LOGIN
      // ============================================
      login: async (credentials: LoginRequest) => {
        try {
          set({ isLoading: true, error: null });

          // L'API attend username mais on peut envoyer l'email
          const response = await api.post<AuthResponse>('/auth/login', {
            username: credentials.username,
            password: credentials.password,
          });

          const { access_token, refresh_token, user } = response.data;

          // Sauvegarder les tokens
          await tokenService.setTokens(access_token, refresh_token);

          set({
            user,
            isAuthenticated: true,
            isLoading: false,
            error: null,
          });

          // Charger les stats
          get().refreshStats();
        } catch (error) {
          set({
            error: getErrorMessage(error),
            isLoading: false,
          });
          throw error;
        }
      },

      // ============================================
      // REGISTER
      // ============================================
      register: async (data: RegisterRequest) => {
        try {
          set({ isLoading: true, error: null });

          const response = await api.post<AuthResponse>('/auth/register', data);

          const { access_token, refresh_token, user } = response.data;

          // Sauvegarder les tokens
          await tokenService.setTokens(access_token, refresh_token);

          set({
            user,
            isAuthenticated: true,
            isLoading: false,
            error: null,
          });

          // Charger les stats
          get().refreshStats();
        } catch (error) {
          set({
            error: getErrorMessage(error),
            isLoading: false,
          });
          throw error;
        }
      },

      // ============================================
      // LOGOUT
      // ============================================
      logout: async () => {
        try {
          set({ isLoading: true });

          // Appeler l'API de déconnexion (optionnel)
          try {
            await api.post('/auth/logout');
          } catch {
            // Ignorer les erreurs de logout API
          }

          // Supprimer les tokens
          await tokenService.clearTokens();

          set({
            user: null,
            userStats: null,
            isAuthenticated: false,
            isLoading: false,
            error: null,
          });
        } catch (error) {
          // Même en cas d'erreur, déconnecter localement
          await tokenService.clearTokens();
          set({
            user: null,
            userStats: null,
            isAuthenticated: false,
            isLoading: false,
            error: null,
          });
        }
      },

      // ============================================
      // REFRESH USER
      // ============================================
      refreshUser: async () => {
        try {
          const response = await api.get<User>('/users/me');
          set({ user: response.data });
        } catch (error) {
          console.error('Failed to refresh user:', error);
        }
      },

      // ============================================
      // REFRESH STATS
      // ============================================
      refreshStats: async () => {
        try {
          const response = await api.get<UserStats>('/users/me/stats');
          set({ userStats: response.data });
        } catch (error) {
          console.error('Failed to refresh stats:', error);
        }
      },

      // ============================================
      // UPDATE USER (local)
      // ============================================
      updateUser: (updates: Partial<User>) => {
        const currentUser = get().user;
        if (currentUser) {
          set({ user: { ...currentUser, ...updates } });
        }
      },

      // ============================================
      // CLEAR ERROR
      // ============================================
      clearError: () => {
        set({ error: null });
      },
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);

// ============================================
// SELECTORS
// ============================================

export const selectUser = (state: AuthState) => state.user;
export const selectUserStats = (state: AuthState) => state.userStats;
export const selectIsAuthenticated = (state: AuthState) => state.isAuthenticated;
export const selectIsLoading = (state: AuthState) => state.isLoading;
export const selectError = (state: AuthState) => state.error;

// Computed selectors
export const selectUserLevel = (state: AuthState) => state.user?.level ?? 1;
export const selectUserXP = (state: AuthState) => state.user?.total_xp ?? 0;
export const selectUserStreak = (state: AuthState) => state.user?.current_streak ?? 0;
export const selectXPProgress = (state: AuthState) => {
  const stats = state.userStats;
  if (!stats) return 0;
  const progress = stats.xp_progress / stats.xp_needed_for_next_level;
  return Math.min(Math.max(progress, 0), 1);
};

export default useAuthStore;
