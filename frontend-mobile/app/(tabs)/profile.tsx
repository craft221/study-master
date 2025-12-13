/**
 * Study Master - Profile Screen
 * Profil utilisateur avec stats et paramètres
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Image,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import Animated, { FadeInDown, FadeInRight } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { useTheme } from '@/hooks/useTheme';
import { useAuthStore } from '@/stores/authStore';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Spark } from '@/components/mascot/Spark';
import {
  Colors,
  Spacing,
  BorderRadius,
  Typography,
  TextStyles,
  Shadows,
} from '@/constants/theme';

// ============================================
// MENU ITEM
// ============================================

interface MenuItemProps {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
  color?: string;
  onPress: () => void;
  showArrow?: boolean;
  danger?: boolean;
}

function MenuItem({ icon, title, subtitle, color, onPress, showArrow = true, danger = false }: MenuItemProps) {
  const { colors } = useTheme();
  const iconColor = danger ? Colors.accent.red : (color || colors.primary);

  return (
    <Pressable
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
      }}
      style={({ pressed }) => [
        styles.menuItem,
        { backgroundColor: pressed ? colors.surfaceVariant : colors.card },
      ]}
    >
      <View style={[styles.menuIconContainer, { backgroundColor: iconColor + '15' }]}>
        <Ionicons name={icon} size={22} color={iconColor} />
      </View>
      <View style={styles.menuContent}>
        <Text style={[styles.menuTitle, { color: danger ? Colors.accent.red : colors.text }]}>
          {title}
        </Text>
        {subtitle && (
          <Text style={[styles.menuSubtitle, { color: colors.textSecondary }]}>
            {subtitle}
          </Text>
        )}
      </View>
      {showArrow && (
        <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
      )}
    </Pressable>
  );
}

// ============================================
// MAIN SCREEN
// ============================================

export default function ProfileScreen() {
  const { colors, isDark, toggleTheme, mode } = useTheme();
  const { user, userStats, logout } = useAuthStore();

  const handleLogout = () => {
    Alert.alert(
      'Déconnexion',
      'Êtes-vous sûr de vouloir vous déconnecter ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Déconnexion',
          style: 'destructive',
          onPress: async () => {
            await logout();
            router.replace('/(auth)/login');
          },
        },
      ]
    );
  };

  // Avatar URL ou placeholder
  const avatarUrl = user?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.username}`;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header avec profil */}
        <LinearGradient
          colors={isDark
            ? [Colors.primary[900], colors.background]
            : [Colors.primary[100], colors.background]
          }
          style={styles.header}
        >
          <Animated.View entering={FadeInDown.springify()} style={styles.profileSection}>
            {/* Avatar */}
            <Pressable
              onPress={() => router.push('/profile/edit')}
              style={styles.avatarContainer}
            >
              <Image
                source={{ uri: avatarUrl }}
                style={styles.avatar}
              />
              <View style={[styles.avatarBadge, { backgroundColor: colors.primary }]}>
                <Ionicons name="camera" size={14} color={Colors.white} />
              </View>
            </Pressable>

            {/* Infos */}
            <Text style={[styles.username, { color: colors.text }]}>
              {user?.full_name || user?.username}
            </Text>
            <Text style={[styles.email, { color: colors.textSecondary }]}>
              @{user?.username}
            </Text>

            {/* Niveau */}
            <View style={styles.levelContainer}>
              <LinearGradient
                colors={[Colors.accent.gold, Colors.accent.orange]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.levelBadge}
              >
                <Ionicons name="star" size={14} color={Colors.white} />
                <Text style={styles.levelText}>Niveau {userStats?.level || user?.level || 1}</Text>
              </LinearGradient>
            </View>
          </Animated.View>

          {/* Stats rapides */}
          <Animated.View entering={FadeInRight.delay(200).springify()}>
            <Card variant="elevated" style={styles.statsCard}>
              <View style={styles.statsRow}>
                <Pressable style={styles.statItem} onPress={() => router.push('/achievements')}>
                  <Text style={[styles.statValue, { color: Colors.accent.gold }]}>
                    {userStats?.total_xp?.toLocaleString() || 0}
                  </Text>
                  <Text style={[styles.statLabel, { color: colors.textSecondary }]}>XP Total</Text>
                </Pressable>

                <View style={styles.statDivider} />

                <Pressable style={styles.statItem} onPress={() => router.push('/streak')}>
                  <View style={styles.streakContainer}>
                    <Ionicons name="flame" size={20} color={Colors.accent.orange} />
                    <Text style={[styles.statValue, { color: Colors.accent.orange }]}>
                      {userStats?.current_streak || 0}
                    </Text>
                  </View>
                  <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Streak</Text>
                </Pressable>

                <View style={styles.statDivider} />

                <Pressable style={styles.statItem} onPress={() => router.push('/achievements')}>
                  <Text style={[styles.statValue, { color: colors.text }]}>
                    {Math.round((userStats?.total_study_time_minutes || 0) / 60)}h
                  </Text>
                  <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Étude</Text>
                </Pressable>
              </View>
            </Card>
          </Animated.View>
        </LinearGradient>

        {/* Mascotte */}
        <Animated.View entering={FadeInDown.delay(300).springify()} style={styles.mascotSection}>
          <Card
            variant="gradient"
            gradientColors={[Colors.accent.orange, Colors.accent.orangeLight]}
            onPress={() => router.push('/mascot')}
            style={styles.mascotCard}
          >
            <View style={styles.mascotContent}>
              <View style={styles.mascotInfo}>
                <Text style={styles.mascotTitle}>Mon compagnon</Text>
                <Text style={styles.mascotName}>Spark</Text>
                <Text style={styles.mascotLevel}>Niveau {userStats?.level || 1}</Text>
              </View>
              <Spark size={80} mood="happy" level={userStats?.level || 1} />
            </View>
          </Card>
        </Animated.View>

        {/* Menu Sections */}
        <View style={styles.menuSection}>
          <Text style={[styles.menuSectionTitle, { color: colors.textSecondary }]}>
            COMPTE
          </Text>
          <Card variant="default" style={styles.menuCard}>
            <MenuItem
              icon="person-outline"
              title="Modifier le profil"
              subtitle="Nom, avatar, bio"
              onPress={() => router.push('/profile/edit')}
            />
            <MenuItem
              icon="trophy-outline"
              title="Achievements"
              subtitle={`${userStats?.current_streak || 0} jours de streak`}
              color={Colors.accent.gold}
              onPress={() => router.push('/achievements')}
            />
            <MenuItem
              icon="stats-chart-outline"
              title="Statistiques"
              subtitle="Voir ma progression"
              color={Colors.accent.green}
              onPress={() => router.push('/stats')}
            />
            <MenuItem
              icon="podium-outline"
              title="Classement"
              subtitle="Comparez-vous aux autres"
              color={Colors.accent.purple}
              onPress={() => router.push('/leaderboard')}
            />
          </Card>
        </View>

        <View style={styles.menuSection}>
          <Text style={[styles.menuSectionTitle, { color: colors.textSecondary }]}>
            PRÉFÉRENCES
          </Text>
          <Card variant="default" style={styles.menuCard}>
            <MenuItem
              icon={isDark ? 'moon' : 'sunny'}
              title="Thème"
              subtitle={mode === 'auto' ? 'Automatique' : isDark ? 'Sombre' : 'Clair'}
              onPress={toggleTheme}
              showArrow={false}
            />
            <MenuItem
              icon="notifications-outline"
              title="Notifications"
              subtitle="Gérer les alertes"
              onPress={() => router.push('/settings/notifications')}
            />
            <MenuItem
              icon="timer-outline"
              title="Objectif quotidien"
              subtitle={`${userStats?.total_study_time_minutes ? Math.round(userStats.total_study_time_minutes / 7) : 30} min/jour`}
              color={Colors.accent.orange}
              onPress={() => router.push('/settings/goals')}
            />
            <MenuItem
              icon="language-outline"
              title="Langue"
              subtitle="Français"
              onPress={() => router.push('/settings/language')}
            />
          </Card>
        </View>

        <View style={styles.menuSection}>
          <Text style={[styles.menuSectionTitle, { color: colors.textSecondary }]}>
            SUPPORT
          </Text>
          <Card variant="default" style={styles.menuCard}>
            <MenuItem
              icon="help-circle-outline"
              title="Aide & FAQ"
              onPress={() => router.push('/help')}
            />
            <MenuItem
              icon="chatbubble-outline"
              title="Nous contacter"
              onPress={() => router.push('/contact')}
            />
            <MenuItem
              icon="star-outline"
              title="Noter l'application"
              onPress={() => {/* Open app store */}}
            />
            <MenuItem
              icon="share-outline"
              title="Partager Study Master"
              onPress={() => {/* Share */}}
            />
          </Card>
        </View>

        <View style={styles.menuSection}>
          <Card variant="default" style={styles.menuCard}>
            <MenuItem
              icon="log-out-outline"
              title="Déconnexion"
              onPress={handleLogout}
              danger
              showArrow={false}
            />
          </Card>
        </View>

        {/* Version */}
        <Text style={[styles.version, { color: colors.textTertiary }]}>
          Study Master v1.0.0
        </Text>

        <View style={styles.bottomSpacer} />
      </ScrollView>
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
  header: {
    paddingBottom: Spacing.xl,
  },
  profileSection: {
    alignItems: 'center',
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.lg,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: Spacing.md,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: Colors.gray[200],
  },
  avatarBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: Colors.white,
  },
  username: {
    ...TextStyles.h2,
    marginBottom: 4,
  },
  email: {
    ...TextStyles.body,
    marginBottom: Spacing.md,
  },
  levelContainer: {
    alignItems: 'center',
  },
  levelBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    gap: 6,
  },
  levelText: {
    color: Colors.white,
    ...TextStyles.label,
    fontWeight: Typography.fontWeight.bold,
  },

  // Stats
  statsCard: {
    marginHorizontal: Spacing.lg,
    padding: Spacing.lg,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    ...TextStyles.h3,
  },
  statLabel: {
    ...TextStyles.caption,
    marginTop: 4,
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: Colors.gray[200],
  },
  streakContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },

  // Mascot
  mascotSection: {
    paddingHorizontal: Spacing.lg,
    marginTop: Spacing.lg,
  },
  mascotCard: {
    padding: Spacing.lg,
  },
  mascotContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  mascotInfo: {
    flex: 1,
  },
  mascotTitle: {
    color: 'rgba(255, 255, 255, 0.8)',
    ...TextStyles.caption,
  },
  mascotName: {
    color: Colors.white,
    ...TextStyles.h2,
    marginTop: 4,
  },
  mascotLevel: {
    color: 'rgba(255, 255, 255, 0.9)',
    ...TextStyles.label,
    marginTop: 4,
  },

  // Menu
  menuSection: {
    paddingHorizontal: Spacing.lg,
    marginTop: Spacing.xl,
  },
  menuSectionTitle: {
    ...TextStyles.caption,
    fontWeight: Typography.fontWeight.semibold,
    marginBottom: Spacing.sm,
    marginLeft: Spacing.xs,
  },
  menuCard: {
    padding: 0,
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.base,
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.gray[100],
  },
  menuIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  menuContent: {
    flex: 1,
  },
  menuTitle: {
    ...TextStyles.body,
    fontWeight: Typography.fontWeight.medium,
  },
  menuSubtitle: {
    ...TextStyles.caption,
    marginTop: 2,
  },

  // Footer
  version: {
    ...TextStyles.caption,
    textAlign: 'center',
    marginTop: Spacing.xl,
  },
  bottomSpacer: {
    height: 120,
  },
});
