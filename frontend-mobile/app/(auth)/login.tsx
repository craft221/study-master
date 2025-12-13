/**
 * Study Master - Login Screen
 * Écran de connexion avec design moderne
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Pressable,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import Animated, {
  FadeInDown,
  FadeInUp,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withSequence,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import * as LocalAuthentication from 'expo-local-authentication';

import { useTheme } from '@/hooks/useTheme';
import { useAuthStore } from '@/stores/authStore';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Spark } from '@/components/mascot/Spark';
import {
  Colors,
  Spacing,
  BorderRadius,
  Typography,
  TextStyles,
} from '@/constants/theme';
import { PATTERNS, ERROR_MESSAGES } from '@/constants/config';

// ============================================
// MAIN COMPONENT
// ============================================

export default function LoginScreen() {
  const { colors, isDark } = useTheme();
  const { login, isLoading, error, clearError } = useAuthStore();

  // Form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [formErrors, setFormErrors] = useState<{ email?: string; password?: string }>({});

  // Animations
  const sparkScale = useSharedValue(1);
  const sparkMood = useSharedValue<'happy' | 'thinking' | 'sad' | 'excited'>('happy');
  const [currentMood, setCurrentMood] = useState<'happy' | 'thinking' | 'sad' | 'excited'>('happy');

  const sparkAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: sparkScale.value }],
  }));

  // Validation
  const validate = (): boolean => {
    const errors: { email?: string; password?: string } = {};

    if (!email.trim()) {
      errors.email = ERROR_MESSAGES.validation.required;
    } else if (!PATTERNS.email.test(email)) {
      errors.email = ERROR_MESSAGES.validation.email;
    }

    if (!password) {
      errors.password = ERROR_MESSAGES.validation.required;
    } else if (password.length < 8) {
      errors.password = ERROR_MESSAGES.validation.minLength(8);
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Handle login
  const handleLogin = async () => {
    clearError();

    if (!validate()) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setCurrentMood('sad');
      sparkScale.value = withSequence(
        withSpring(0.9),
        withSpring(1)
      );
      return;
    }

    setCurrentMood('thinking');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      await login({ username: email, password });

      // Succès !
      setCurrentMood('excited');
      sparkScale.value = withSequence(
        withSpring(1.2),
        withSpring(1)
      );
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      // Rediriger vers le dashboard
      router.replace('/(tabs)');
    } catch (err) {
      setCurrentMood('sad');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  };

  // Biometric login
  const handleBiometricLogin = async () => {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    const isEnrolled = await LocalAuthentication.isEnrolledAsync();

    if (!hasHardware || !isEnrolled) {
      Alert.alert(
        'Non disponible',
        'L\'authentification biométrique n\'est pas configurée sur cet appareil.'
      );
      return;
    }

    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Connectez-vous à Study Master',
      fallbackLabel: 'Utiliser le mot de passe',
    });

    if (result.success) {
      // TODO: Récupérer les credentials stockés et se connecter
      Alert.alert('Succès', 'Authentification biométrique réussie !');
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header avec gradient */}
          <LinearGradient
            colors={isDark
              ? [Colors.primary[800], colors.background]
              : [Colors.primary[100], colors.background]
            }
            style={styles.header}
          >
            {/* Mascotte */}
            <Animated.View
              entering={FadeInDown.delay(100).springify()}
              style={[styles.sparkContainer, sparkAnimatedStyle]}
            >
              <Spark
                size={120}
                mood={currentMood}
                level={1}
                onPress={() => {
                  setCurrentMood('excited');
                  setTimeout(() => setCurrentMood('happy'), 2000);
                }}
              />
            </Animated.View>

            {/* Titre */}
            <Animated.View entering={FadeInDown.delay(200).springify()}>
              <Text style={[styles.title, { color: colors.text }]}>
                Bon retour ! 👋
              </Text>
              <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                Connectez-vous pour continuer à apprendre
              </Text>
            </Animated.View>
          </LinearGradient>

          {/* Formulaire */}
          <View style={styles.form}>
            <Animated.View entering={FadeInUp.delay(300).springify()}>
              <Input
                label="Email"
                placeholder="votre@email.com"
                value={email}
                onChangeText={(text) => {
                  setEmail(text);
                  if (formErrors.email) {
                    const { email: _, ...rest } = formErrors;
                    setFormErrors(rest);
                  }
                }}
                error={formErrors.email}
                leftIcon="mail-outline"
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
              />
            </Animated.View>

            <Animated.View entering={FadeInUp.delay(400).springify()}>
              <Input
                label="Mot de passe"
                placeholder="••••••••"
                value={password}
                onChangeText={(text) => {
                  setPassword(text);
                  if (formErrors.password) {
                    const { password: _, ...rest } = formErrors;
                    setFormErrors(rest);
                  }
                }}
                error={formErrors.password}
                leftIcon="lock-closed-outline"
                secureTextEntry
                autoCapitalize="none"
                autoComplete="password"
              />
            </Animated.View>

            {/* Mot de passe oublié */}
            <Animated.View entering={FadeInUp.delay(450).springify()}>
              <Pressable
                onPress={() => router.push('/(auth)/forgot-password')}
                style={styles.forgotPassword}
              >
                <Text style={[styles.forgotPasswordText, { color: colors.primary }]}>
                  Mot de passe oublié ?
                </Text>
              </Pressable>
            </Animated.View>

            {/* Erreur API */}
            {error && (
              <Animated.View entering={FadeInUp.springify()} style={styles.errorContainer}>
                <Text style={styles.errorText}>{error}</Text>
              </Animated.View>
            )}

            {/* Bouton de connexion */}
            <Animated.View entering={FadeInUp.delay(500).springify()}>
              <Button
                variant="gradient"
                size="lg"
                fullWidth
                onPress={handleLogin}
                loading={isLoading}
                disabled={isLoading}
              >
                Se connecter
              </Button>
            </Animated.View>

            {/* Séparateur */}
            <Animated.View entering={FadeInUp.delay(550).springify()} style={styles.divider}>
              <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
              <Text style={[styles.dividerText, { color: colors.textSecondary }]}>ou</Text>
              <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
            </Animated.View>

            {/* Connexion biométrique */}
            <Animated.View entering={FadeInUp.delay(600).springify()}>
              <Button
                variant="outline"
                size="lg"
                fullWidth
                onPress={handleBiometricLogin}
                icon={
                  <Spark size={24} mood="happy" animated={false} />
                }
              >
                Connexion rapide
              </Button>
            </Animated.View>

            {/* Lien inscription */}
            <Animated.View entering={FadeInUp.delay(650).springify()} style={styles.registerLink}>
              <Text style={[styles.registerText, { color: colors.textSecondary }]}>
                Pas encore de compte ?{' '}
              </Text>
              <Pressable onPress={() => router.push('/(auth)/register')}>
                <Text style={[styles.registerLinkText, { color: colors.primary }]}>
                  S'inscrire
                </Text>
              </Pressable>
            </Animated.View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ============================================
// STYLES
// ============================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  header: {
    alignItems: 'center',
    paddingTop: Spacing['2xl'],
    paddingBottom: Spacing['3xl'],
    paddingHorizontal: Spacing.lg,
  },
  sparkContainer: {
    marginBottom: Spacing.lg,
  },
  title: {
    ...TextStyles.h1,
    textAlign: 'center',
    marginBottom: Spacing.xs,
  },
  subtitle: {
    ...TextStyles.body,
    textAlign: 'center',
  },
  form: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
  },
  forgotPassword: {
    alignSelf: 'flex-end',
    marginBottom: Spacing.lg,
  },
  forgotPasswordText: {
    ...TextStyles.label,
  },
  errorContainer: {
    backgroundColor: Colors.accent.red + '15',
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.accent.red + '30',
  },
  errorText: {
    color: Colors.accent.red,
    ...TextStyles.bodySmall,
    textAlign: 'center',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: Spacing.xl,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    ...TextStyles.caption,
    paddingHorizontal: Spacing.md,
  },
  registerLink: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: Spacing.xl,
    marginBottom: Spacing['2xl'],
  },
  registerText: {
    ...TextStyles.body,
  },
  registerLinkText: {
    ...TextStyles.body,
    fontWeight: Typography.fontWeight.semibold,
  },
});
