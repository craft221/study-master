/**
 * Study Master - Dashboard Screen
 * Écran d'accueil avec statistiques et activité
 */

import React, { useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
  Pressable,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import Animated, {
  FadeInDown,
  FadeInRight,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withSequence,
  withDelay,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { useTheme } from '@/hooks/useTheme';
import { useAuthStore } from '@/stores/authStore';
import { Card } from '@/components/ui/Card';
import { Spark } from '@/components/mascot/Spark';
import {
  Colors,
  Spacing,
  BorderRadius,
  Shadows,
  Typography,
  TextStyles,
} from '@/constants/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ============================================
// STAT CARD COMPONENT
// ============================================

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  delay?: number;
  onPress?: () => void;
}

function StatCard({ title, value, subtitle, icon, color, delay = 0, onPress }: StatCardProps) {
  const { colors } = useTheme();
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.95);
  };

  const handlePressOut = () => {
    scale.value = withSpring(1);
  };

  return (
    <Animated.View
      entering={FadeInDown.delay(delay).springify()}
      style={animatedStyle}
    >
      <Pressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
      >
        <Card variant="elevated" style={styles.statCard}>
          <View style={[styles.statIconContainer, { backgroundColor: color + '20' }]}>
            <Ionicons name={icon} size={24} color={color} />
          </View>
          <Text style={[styles.statValue, { color: colors.text }]}>{value}</Text>
          <Text style={[styles.statTitle, { color: colors.textSecondary }]}>{title}</Text>
          {subtitle && (
            <Text style={[styles.statSubtitle, { color: color }]}>{subtitle}</Text>
          )}
        </Card>
      </Pressable>
    </Animated.View>
  );
}

// ============================================
// QUICK ACTION BUTTON
// ============================================

interface QuickActionProps {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  onPress: () => void;
  delay?: number;
}

function QuickAction({ title, icon, color, onPress, delay = 0 }: QuickActionProps) {
  const { colors } = useTheme();

  return (
    <Animated.View entering={FadeInRight.delay(delay).springify()}>
      <Pressable
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onPress();
        }}
        style={({ pressed }) => [
          styles.quickAction,
          { backgroundColor: colors.card, opacity: pressed ? 0.8 : 1 },
        ]}
      >
        <View style={[styles.quickActionIcon, { backgroundColor: color + '20' }]}>
          <Ionicons name={icon} size={20} color={color} />
        </View>
        <Text style={[styles.quickActionTitle, { color: colors.text }]}>{title}</Text>
        <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
      </Pressable>
    </Animated.View>
  );
}

// ============================================
// MAIN DASHBOARD
// ============================================

export default function DashboardScreen() {
  const { colors, isDark } = useTheme();
  const { user, userStats, refreshStats, isLoading } = useAuthStore();
  const [refreshing, setRefreshing] = React.useState(false);

  // Animation du header
  const headerScale = useSharedValue(0.9);
  const headerOpacity = useSharedValue(0);

  useEffect(() => {
    headerScale.value = withSpring(1, { damping: 12 });
    headerOpacity.value = withDelay(100, withSpring(1));
  }, []);

  const headerAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: headerScale.value }],
    opacity: headerOpacity.value,
  }));

  const onRefresh = async () => {
    setRefreshing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await refreshStats();
    setRefreshing(false);
  };

  // Calculer le niveau et la progression XP
  const level = userStats?.level ?? user?.level ?? 1;
  const totalXp = userStats?.total_xp ?? user?.total_xp ?? 0;
  const xpProgress = userStats?.xp_progress ?? 0;
  const xpNeeded = userStats?.xp_needed_for_next_level ?? 100;
  const progressPercent = xpNeeded > 0 ? (xpProgress / xpNeeded) * 100 : 0;

  // Message de bienvenue selon l'heure
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Bonjour';
    if (hour < 18) return 'Bon après-midi';
    return 'Bonsoir';
  };

  // Déterminer l'humeur de Spark
  const getSparkMood = () => {
    const streak = userStats?.current_streak ?? 0;
    const dueCards = userStats?.flashcards_due_today ?? 0;

    if (streak >= 7) return 'excited';
    if (dueCards > 20) return 'encouraging';
    if (dueCards === 0 && streak > 0) return 'happy';
    return 'happy';
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        {/* Header avec gradient */}
        <Animated.View style={headerAnimatedStyle}>
          <LinearGradient
            colors={isDark
              ? [Colors.primary[900], colors.background]
              : [Colors.primary[50], colors.background]
            }
            style={styles.headerGradient}
          >
            <View style={styles.header}>
              <View style={styles.headerLeft}>
                <Text style={[styles.greeting, { color: colors.textSecondary }]}>
                  {getGreeting()} 👋
                </Text>
                <Text style={[styles.username, { color: colors.text }]}>
                  {user?.full_name || user?.username || 'Étudiant'}
                </Text>
              </View>

              <Pressable
                onPress={() => router.push('/notifications')}
                style={[styles.notificationButton, { backgroundColor: colors.surfaceVariant }]}
              >
                <Ionicons name="notifications-outline" size={22} color={colors.text} />
                {/* Badge de notification */}
                <View style={styles.notificationBadge}>
                  <Text style={styles.notificationBadgeText}>3</Text>
                </View>
              </Pressable>
            </View>

            {/* Carte XP et Niveau */}
            <Card
              variant="gradient"
              gradientColors={[Colors.primary[500], Colors.primary[600]]}
              style={styles.xpCard}
            >
              <View style={styles.xpCardContent}>
                <View style={styles.xpLeft}>
                  <View style={styles.levelBadge}>
                    <Text style={styles.levelText}>Niv. {level}</Text>
                  </View>
                  <Text style={styles.xpText}>{totalXp.toLocaleString()} XP</Text>
                  <View style={styles.progressBarContainer}>
                    <View style={styles.progressBarBg}>
                      <Animated.View
                        style={[
                          styles.progressBarFill,
                          { width: `${Math.min(progressPercent, 100)}%` },
                        ]}
                      />
                    </View>
                    <Text style={styles.progressText}>
                      {xpProgress} / {xpNeeded} XP
                    </Text>
                  </View>
                </View>

                <View style={styles.xpRight}>
                  <Spark
                    size={80}
                    mood={getSparkMood()}
                    level={level}
                    onPress={() => router.push('/mascot')}
                  />
                </View>
              </View>
            </Card>
          </LinearGradient>
        </Animated.View>

        {/* Streak et Stats rapides */}
        <View style={styles.section}>
          <View style={styles.statsGrid}>
            <StatCard
              title="Streak"
              value={userStats?.current_streak ?? 0}
              subtitle="jours"
              icon="flame"
              color={Colors.accent.orange}
              delay={100}
              onPress={() => router.push('/streak')}
            />
            <StatCard
              title="À réviser"
              value={userStats?.flashcards_due_today ?? 0}
              subtitle="flashcards"
              icon="albums"
              color={Colors.accent.purple}
              delay={150}
              onPress={() => router.push('/flashcards')}
            />
            <StatCard
              title="Temps"
              value={Math.round((userStats?.total_study_time_minutes ?? 0) / 60)}
              subtitle="heures"
              icon="time"
              color={Colors.accent.green}
              delay={200}
            />
            <StatCard
              title="Quiz"
              value={userStats?.total_quizzes ?? 0}
              subtitle="complétés"
              icon="checkmark-circle"
              color={Colors.primary[500]}
              delay={250}
              onPress={() => router.push('/quizzes')}
            />
          </View>
        </View>

        {/* Actions rapides */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Actions rapides
          </Text>

          <View style={styles.quickActions}>
            <QuickAction
              title="Réviser les flashcards"
              icon="albums"
              color={Colors.accent.purple}
              onPress={() => router.push('/flashcards/review')}
              delay={300}
            />
            <QuickAction
              title="Commencer un quiz"
              icon="help-circle"
              color={Colors.primary[500]}
              onPress={() => router.push('/quizzes')}
              delay={350}
            />
            <QuickAction
              title="Session Pomodoro"
              icon="timer"
              color={Colors.accent.orange}
              onPress={() => router.push('/study')}
              delay={400}
            />
            <QuickAction
              title="Créer une note"
              icon="document-text"
              color={Colors.accent.green}
              onPress={() => router.push('/notes/new')}
              delay={450}
            />
            <QuickAction
              title="Lancer un duel"
              icon="flash"
              color={Colors.accent.gold}
              onPress={() => router.push('/duels')}
              delay={500}
            />
          </View>
        </View>

        {/* Activité de la semaine */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Cette semaine
            </Text>
            <Pressable onPress={() => router.push('/stats')}>
              <Text style={[styles.seeAll, { color: colors.primary }]}>
                Voir tout
              </Text>
            </Pressable>
          </View>

          <Animated.View entering={FadeInDown.delay(500).springify()}>
            <Card variant="default" style={styles.weekCard}>
              <View style={styles.weekStats}>
                <View style={styles.weekStat}>
                  <Ionicons name="document-text" size={20} color={Colors.accent.green} />
                  <Text style={[styles.weekStatValue, { color: colors.text }]}>
                    {userStats?.notes_this_week ?? 0}
                  </Text>
                  <Text style={[styles.weekStatLabel, { color: colors.textSecondary }]}>
                    Notes
                  </Text>
                </View>
                <View style={styles.weekStatDivider} />
                <View style={styles.weekStat}>
                  <Ionicons name="albums" size={20} color={Colors.accent.purple} />
                  <Text style={[styles.weekStatValue, { color: colors.text }]}>
                    {userStats?.flashcards_reviewed_this_week ?? 0}
                  </Text>
                  <Text style={[styles.weekStatLabel, { color: colors.textSecondary }]}>
                    Flashcards
                  </Text>
                </View>
                <View style={styles.weekStatDivider} />
                <View style={styles.weekStat}>
                  <Ionicons name="help-circle" size={20} color={Colors.primary[500]} />
                  <Text style={[styles.weekStatValue, { color: colors.text }]}>
                    {userStats?.quizzes_taken_this_week ?? 0}
                  </Text>
                  <Text style={[styles.weekStatLabel, { color: colors.textSecondary }]}>
                    Quiz
                  </Text>
                </View>
              </View>
            </Card>
          </Animated.View>
        </View>

        {/* Espacement pour la tab bar */}
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
  scrollContent: {
    paddingBottom: 100,
  },
  headerGradient: {
    paddingTop: Spacing.base,
    paddingBottom: Spacing.xl,
    borderBottomLeftRadius: BorderRadius['2xl'],
    borderBottomRightRadius: BorderRadius['2xl'],
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  headerLeft: {
    flex: 1,
  },
  greeting: {
    ...TextStyles.bodySmall,
  },
  username: {
    ...TextStyles.h2,
    marginTop: 2,
  },
  notificationButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  notificationBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: Colors.accent.red,
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notificationBadgeText: {
    color: Colors.white,
    fontSize: 10,
    fontWeight: '700',
  },

  // XP Card
  xpCard: {
    marginHorizontal: Spacing.lg,
  },
  xpCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.base,
  },
  xpLeft: {
    flex: 1,
  },
  xpRight: {
    marginLeft: Spacing.base,
  },
  levelBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
    alignSelf: 'flex-start',
  },
  levelText: {
    color: Colors.white,
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.bold,
  },
  xpText: {
    color: Colors.white,
    ...TextStyles.h2,
    marginTop: Spacing.sm,
  },
  progressBarContainer: {
    marginTop: Spacing.sm,
  },
  progressBarBg: {
    height: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: Colors.white,
    borderRadius: 4,
  },
  progressText: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: Typography.fontSize.xs,
    marginTop: 4,
  },

  // Sections
  section: {
    paddingHorizontal: Spacing.lg,
    marginTop: Spacing.xl,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.base,
  },
  sectionTitle: {
    ...TextStyles.h3,
  },
  seeAll: {
    ...TextStyles.label,
  },

  // Stats Grid
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  statCard: {
    width: (SCREEN_WIDTH - Spacing.lg * 2 - Spacing.sm) / 2,
    padding: Spacing.base,
  },
  statIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  statValue: {
    ...TextStyles.stat,
    marginBottom: 2,
  },
  statTitle: {
    ...TextStyles.caption,
  },
  statSubtitle: {
    ...TextStyles.caption,
    fontWeight: Typography.fontWeight.medium,
  },

  // Quick Actions
  quickActions: {
    gap: Spacing.sm,
  },
  quickAction: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.base,
    borderRadius: BorderRadius.lg,
    ...Shadows.sm,
  },
  quickActionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  quickActionTitle: {
    flex: 1,
    ...TextStyles.body,
    fontWeight: Typography.fontWeight.medium,
  },

  // Week Stats
  weekCard: {
    padding: Spacing.lg,
  },
  weekStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  weekStat: {
    alignItems: 'center',
    flex: 1,
  },
  weekStatValue: {
    ...TextStyles.stat,
    marginTop: Spacing.xs,
  },
  weekStatLabel: {
    ...TextStyles.caption,
    marginTop: 2,
  },
  weekStatDivider: {
    width: 1,
    height: 40,
    backgroundColor: Colors.gray[200],
  },

  bottomSpacer: {
    height: 20,
  },
});
