/**
 * Study Master - Entry Point
 * Redirige vers l'écran approprié (auth ou tabs)
 */

import { Redirect } from 'expo-router';
import { useAuthStore } from '@/stores/authStore';

export default function Index() {
  const { isAuthenticated, isInitialized } = useAuthStore();

  // Attendre l'initialisation
  if (!isInitialized) {
    return null;
  }

  // Rediriger selon l'état d'authentification
  if (isAuthenticated) {
    return <Redirect href="/(tabs)" />;
  }

  return <Redirect href="/(auth)/login" />;
}
