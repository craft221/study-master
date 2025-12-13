/**
 * Study Master - Register Screen
 * Écran d'inscription avec validation
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

export default function RegisterScreen() {
  const { colors, isDark } = useTheme();
  const { register, isLoading, error, clearError } = useAuthStore();

  // Form state
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Animations
  const sparkScale = useSharedValue(1);
  const [currentMood, setCurrentMood] = useState<'happy' | 'thinking' | 'sad' | 'excited'>('happy');

  const sparkAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: sparkScale.value }],
  }));

  // Validation
  const validate = (): boolean => {
    const errors: Record<string, string> = {};

    if (!fullName.trim()) {
      errors.fullName = ERROR_MESSAGES.validation.required;
    }

    if (!email.trim()) {
      errors.email = ERROR_MESSAGES.validation.required;
    } else if (!PATTERNS.email.test(email)) {
      errors.email = ERROR_MESSAGES.validation.email;
    }

    if (!username.trim()) {
      errors.username = ERROR_MESSAGES.validation.required;
    } else if (!PATTERNS.username.test(username)) {
      errors.username = ERROR_MESSAGES.validation.username;
    }

    if (!password) {
      errors.password = ERROR_MESSAGES.validation.required;
    } else if (!PATTERNS.password.test(password)) {
      errors.password = ERROR_MESSAGES.validation.password;
    }

    if (!confirmPassword) {
      errors.confirmPassword = ERROR_MESSAGES.validation.required;
    } else if (password !== confirmPassword) {
      errors.confirmPassword = ERROR_MESSAGES.validation.passwordMatch;
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Handle registration
  const handleRegister = async () => {
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
      await register({
        email,
        username,
        password,
        full_name: fullName,
      });

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

  const clearFieldError = (field: string) => {
    if (formErrors[field]) {
      const newErrors = { ...formErrors };
      delete newErrors[field];
      setFormErrors(newErrors);
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
              ? [Colors.accent.purple + '40', colors.background]
              : [Colors.accent.purple + '20', colors.background]
            }
            style={styles.header}
          >
            {/* Bouton retour */}
            <Pressable
              onPress={() => router.back()}
              style={styles.backButton}
            >
              <Text style={[styles.backButtonText, { color: colors.primary }]}>
                ← Retour
              </Text>
            </Pressable>

            {/* Mascotte */}
            <Animated.View
              entering={FadeInDown.delay(100).springify()}
              style={[styles.sparkContainer, sparkAnimatedStyle]}
            >
              <Spark
                size={100}
                mood={currentMood}
                level={1}
              />
            </Animated.View>

            {/* Titre */}
            <Animated.View entering={FadeInDown.delay(200).springify()}>
              <Text style={[styles.title, { color: colors.text }]}>
                Créer un compte
              </Text>
              <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                Rejoignez Study Master et commencez à apprendre !
              </Text>
            </Animated.View>
          </LinearGradient>

          {/* Formulaire */}
          <View style={styles.form}>
            <Animated.View entering={FadeInUp.delay(250).springify()}>
              <Input
                label="Nom complet"
                placeholder="Jean Dupont"
                value={fullName}
                onChangeText={(text) => {
                  setFullName(text);
                  clearFieldError('fullName');
                }}
                error={formErrors.fullName}
                leftIcon="person-outline"
                autoCapitalize="words"
                autoComplete="name"
              />
            </Animated.View>

            <Animated.View entering={FadeInUp.delay(300).springify()}>
              <Input
                label="Email"
                placeholder="votre@email.com"
                value={email}
                onChangeText={(text) => {
                  setEmail(text);
                  clearFieldError('email');
                }}
                error={formErrors.email}
                leftIcon="mail-outline"
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
              />
            </Animated.View>

            <Animated.View entering={FadeInUp.delay(350).springify()}>
              <Input
                label="Nom d'utilisateur"
                placeholder="jean_dupont"
                value={username}
                onChangeText={(text) => {
                  setUsername(text.toLowerCase());
                  clearFieldError('username');
                }}
                error={formErrors.username}
                leftIcon="at-outline"
                autoCapitalize="none"
                autoComplete="username"
              />
            </Animated.View>

            <Animated.View entering={FadeInUp.delay(400).springify()}>
              <Input
                label="Mot de passe"
                placeholder="••••••••"
                value={password}
                onChangeText={(text) => {
                  setPassword(text);
                  clearFieldError('password');
                }}
                error={formErrors.password}
                leftIcon="lock-closed-outline"
                secureTextEntry
                autoCapitalize="none"
              />
            </Animated.View>

            <Animated.View entering={FadeInUp.delay(450).springify()}>
              <Input
                label="Confirmer le mot de passe"
                placeholder="••••••••"
                value={confirmPassword}
                onChangeText={(text) => {
                  setConfirmPassword(text);
                  clearFieldError('confirmPassword');
                }}
                error={formErrors.confirmPassword}
                leftIcon="lock-closed-outline"
                secureTextEntry
                autoCapitalize="none"
              />
            </Animated.View>

            {/* Erreur API */}
            {error && (
              <Animated.View entering={FadeInUp.springify()} style={styles.errorContainer}>
                <Text style={styles.errorText}>{error}</Text>
              </Animated.View>
            )}

            {/* Bouton d'inscription */}
            <Animated.View entering={FadeInUp.delay(500).springify()}>
              <Button
                variant="gradient"
                size="lg"
                fullWidth
                onPress={handleRegister}
                loading={isLoading}
                disabled={isLoading}
              >
                Créer mon compte
              </Button>
            </Animated.View>

            {/* Termes et conditions */}
            <Animated.View entering={FadeInUp.delay(550).springify()}>
              <Text style={[styles.terms, { color: colors.textSecondary }]}>
                En créant un compte, vous acceptez nos{' '}
                <Text style={[styles.termsLink, { color: colors.primary }]}>
                  Conditions d'utilisation
                </Text>
                {' '}et notre{' '}
                <Text style={[styles.termsLink, { color: colors.primary }]}>
                  Politique de confidentialité
                </Text>
              </Text>
            </Animated.View>

            {/* Lien connexion */}
            <Animated.View entering={FadeInUp.delay(600).springify()} style={styles.loginLink}>
              <Text style={[styles.loginText, { color: colors.textSecondary }]}>
                Déjà un compte ?{' '}
              </Text>
              <Pressable onPress={() => router.push('/(auth)/login')}>
                <Text style={[styles.loginLinkText, { color: colors.primary }]}>
                  Se connecter
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
    paddingTop: Spacing.base,
    paddingBottom: Spacing.xl,
    paddingHorizontal: Spacing.lg,
  },
  backButton: {
    alignSelf: 'flex-start',
    marginBottom: Spacing.md,
  },
  backButtonText: {
    ...TextStyles.label,
  },
  sparkContainer: {
    marginBottom: Spacing.md,
  },
  title: {
    ...TextStyles.h2,
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
    paddingTop: Spacing.base,
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
  terms: {
    ...TextStyles.caption,
    textAlign: 'center',
    marginTop: Spacing.lg,
    lineHeight: 20,
  },
  termsLink: {
    fontWeight: Typography.fontWeight.medium,
  },
  loginLink: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: Spacing.xl,
    marginBottom: Spacing['2xl'],
  },
  loginText: {
    ...TextStyles.body,
  },
  loginLinkText: {
    ...TextStyles.body,
    fontWeight: Typography.fontWeight.semibold,
  },
});
