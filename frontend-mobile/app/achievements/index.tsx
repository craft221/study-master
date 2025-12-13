/**
 * Study Master - Achievements Screen
 * Badges, trophées et accomplissements
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  RefreshControl,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import Animated, {
  FadeIn,
  FadeInDown,
  ZoomIn,
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  Easing,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useQuery } from '@tanstack/react-query';

import { useTheme } from '@/hooks/useTheme';
import { useAuthStore } from '@/stores/authStore';
import api from '@/services/api';
import { Card } from '@/components/ui/Card';
import { Spark } from '@/components/mascot/Spark';
import {
  Colors,
  Spacing,
  BorderRadius,
  Typography,
  TextStyles,
  Shadows,
  GamificationConfig,
} from '@/constants/theme';
import type { Achievement, UserAchievement, AchievementCategory, AchievementRarity } from '@/types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ============================================
// RARITY CONFIGS
// ============================================

const RARITY_CONFIG = {
  common: {
    label: 'Commun',
    color: Colors.gray[400],
    gradient: [Colors.gray[300], Colors.gray[400]] as [string, string],
  },
  rare: {
    label: 'Rare',
    color: Colors.primary[500],
    gradient: [Colors.primary[400], Colors.primary[600]] as [string, string],
  },
  epic: {
    label: 'Épique',
    color: Colors.accent.purple,
    gradient: [Colors.accent.purpleLight, Colors.accent.purple] as [string, string],
  },
  legendary: {
    label: 'Légendaire',
    color: Colors.accent.gold,
    gradient: [Colors.accent.gold, Colors.accent.orange] as [string, string],
  },
};

const CATEGORY_CONFIG: Record<AchievementCategory, { label: string; icon: string }> = {
  learning: { label: 'Apprentissage', icon: 'book' },
  streak: { label: 'Streak', icon: 'flame' },
  mastery: { label: 'Maîtrise', icon: 'ribbon' },
  social: { label: 'Social', icon: 'people' },
  special: { label: 'Spécial', icon: 'star' },
};

// ============================================
// CATEGORY FILTER
// ============================================

interface CategoryFilterProps {
  selected: AchievementCategory | 'all';
  onSelect: (category: AchievementCategory | 'all') => void;
}

function CategoryFilter({ selected, onSelect }: CategoryFilterProps) {
  const { colors } = useTheme();

  const categories: { key: AchievementCategory | 'all'; label: string; icon: string }[] = [
    { key: 'all', label: 'Tous', icon: 'grid' },
    { key: 'learning', label: 'Apprentissage', icon: 'book' },
    { key: 'streak', label: 'Streak', icon: 'flame' },
    { key: 'mastery', label: 'Maîtrise', icon: 'ribbon' },
    { key: 'social', label: 'Social', icon: 'people' },
    { key: 'special', label: 'Spécial', icon: 'star' },
  ];

  return (
    <FlatList
      horizontal
      data={categories}
      renderItem={({ item }) => {
        const isSelected = selected === item.key;
        return (
          <Pressable
            onPress={() => {
              Haptics.selectionAsync();
              onSelect(item.key);
            }}
            style={[
              styles.categoryButton,
              {
                backgroundColor: isSelected ? colors.primary : colors.surfaceVariant,
              },
            ]}
          >
            <Ionicons
              name={item.icon as any}
              size={16}
              color={isSelected ? Colors.white : colors.textSecondary}
            />
            <Text
              style={[
                styles.categoryText,
                { color: isSelected ? Colors.white : colors.textSecondary },
              ]}
            >
              {item.label}
            </Text>
          </Pressable>
        );
      }}
      keyExtractor={(item) => item.key}
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.categoryList}
    />
  );
}

// ============================================
// STATS HEADER
// ============================================

interface StatsHeaderProps {
  totalUnlocked: number;
  totalAchievements: number;
  totalPoints: number;
}

function StatsHeader({ totalUnlocked, totalAchievements, totalPoints }: StatsHeaderProps) {
  const { colors, isDark } = useTheme();
  const progress = totalAchievements > 0 ? (totalUnlocked / totalAchievements) * 100 : 0;

  return (
    <Animated.View entering={FadeIn.delay(100).springify()}>
      <LinearGradient
        colors={isDark
          ? [Colors.accent.gold + '30', Colors.accent.purple + '20', colors.background]
          : [Colors.accent.gold + '20', Colors.accent.purple + '10', colors.background]
        }
        style={styles.statsHeader}
      >
        {/* Main Stats */}
        <View style={styles.mainStats}>
          <View style={styles.mainStatItem}>
            <Ionicons name="trophy" size={32} color={Colors.accent.gold} />
            <Text style={[styles.mainStatValue, { color: colors.text }]}>
              {totalUnlocked}
            </Text>
            <Text style={[styles.mainStatLabel, { color: colors.textSecondary }]}>
              Débloqués
            </Text>
          </View>

          {/* Circular Progress */}
          <View style={styles.progressCircleContainer}>
            <View style={[styles.progressCircleBg, { borderColor: colors.surfaceVariant }]} />
            <View
              style={[
                styles.progressCircleFill,
                {
                  borderColor: Colors.accent.gold,
                  transform: [{ rotate: `${(progress / 100) * 360}deg` }],
                },
              ]}
            />
            <View style={styles.progressCircleInner}>
              <Text style={[styles.progressPercent, { color: colors.text }]}>
                {Math.round(progress)}%
              </Text>
            </View>
          </View>

          <View style={styles.mainStatItem}>
            <Ionicons name="star" size={32} color={Colors.accent.purple} />
            <Text style={[styles.mainStatValue, { color: colors.text }]}>
              {totalPoints}
            </Text>
            <Text style={[styles.mainStatLabel, { color: colors.textSecondary }]}>
              Points
            </Text>
          </View>
        </View>

        {/* Progress Bar */}
        <View style={styles.progressBarContainer}>
          <View style={[styles.progressBarBg, { backgroundColor: colors.surfaceVariant }]}>
            <LinearGradient
              colors={[Colors.accent.gold, Colors.accent.orange]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[styles.progressBarFill, { width: `${progress}%` }]}
            />
          </View>
          <Text style={[styles.progressText, { color: colors.textSecondary }]}>
            {totalUnlocked}/{totalAchievements} achievements
          </Text>
        </View>
      </LinearGradient>
    </Animated.View>
  );
}

// ============================================
// ACHIEVEMENT CARD
// ============================================

interface AchievementCardProps {
  achievement: Achievement;
  userAchievement?: UserAchievement;
  index: number;
}

function AchievementCard({ achievement, userAchievement, index }: AchievementCardProps) {
  const { colors } = useTheme();

  const isUnlocked = userAchievement?.is_unlocked ?? false;
  const progress = userAchievement?.progress ?? 0;
  const progressPercent = Math.min(100, (progress / achievement.requirement_value) * 100);

  const rarityConfig = RARITY_CONFIG[achievement.rarity];
  const categoryConfig = CATEGORY_CONFIG[achievement.category];

  const glow = useSharedValue(0);

  React.useEffect(() => {
    if (isUnlocked && achievement.rarity === 'legendary') {
      glow.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
          withTiming(0, { duration: 1500, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        true
      );
    }
  }, [isUnlocked, achievement.rarity]);

  const glowStyle = useAnimatedStyle(() => ({
    opacity: 0.3 + glow.value * 0.4,
  }));

  return (
    <Animated.View entering={FadeInDown.delay(index * 50).springify()}>
      <Pressable
        onPress={() => {
          Haptics.impactAsync(
            isUnlocked
              ? Haptics.ImpactFeedbackStyle.Medium
              : Haptics.ImpactFeedbackStyle.Light
          );
        }}
        style={[
          styles.achievementCard,
          {
            backgroundColor: colors.card,
            opacity: isUnlocked ? 1 : 0.7,
          },
        ]}
      >
        {/* Glow effect for legendary */}
        {isUnlocked && achievement.rarity === 'legendary' && (
          <Animated.View
            style={[
              styles.legendaryGlow,
              { backgroundColor: Colors.accent.gold },
              glowStyle,
            ]}
          />
        )}

        {/* Icon */}
        <View style={styles.achievementIcon}>
          <LinearGradient
            colors={isUnlocked ? rarityConfig.gradient : [Colors.gray[300], Colors.gray[400]]}
            style={styles.iconGradient}
          >
            <Text style={styles.iconEmoji}>{achievement.icon}</Text>
          </LinearGradient>
          {isUnlocked && (
            <View style={[styles.unlockedBadge, { backgroundColor: Colors.accent.green }]}>
              <Ionicons name="checkmark" size={10} color={Colors.white} />
            </View>
          )}
        </View>

        {/* Content */}
        <View style={styles.achievementContent}>
          <View style={styles.achievementHeader}>
            <Text
              style={[
                styles.achievementName,
                { color: isUnlocked ? colors.text : colors.textSecondary },
              ]}
              numberOfLines={1}
            >
              {achievement.name}
            </Text>
            <View style={[styles.rarityBadge, { backgroundColor: rarityConfig.color + '20' }]}>
              <Text style={[styles.rarityText, { color: rarityConfig.color }]}>
                {rarityConfig.label}
              </Text>
            </View>
          </View>

          <Text
            style={[styles.achievementDescription, { color: colors.textSecondary }]}
            numberOfLines={2}
          >
            {achievement.description}
          </Text>

          {/* Progress Bar (if not unlocked) */}
          {!isUnlocked && (
            <View style={styles.achievementProgress}>
              <View style={[styles.progressBarSmall, { backgroundColor: colors.surfaceVariant }]}>
                <View
                  style={[
                    styles.progressBarSmallFill,
                    {
                      width: `${progressPercent}%`,
                      backgroundColor: rarityConfig.color,
                    },
                  ]}
                />
              </View>
              <Text style={[styles.progressSmallText, { color: colors.textTertiary }]}>
                {progress}/{achievement.requirement_value}
              </Text>
            </View>
          )}

          {/* XP Reward */}
          <View style={styles.rewardContainer}>
            <Ionicons name="star" size={14} color={Colors.accent.gold} />
            <Text style={[styles.rewardText, { color: Colors.accent.gold }]}>
              +{achievement.xp_reward} XP
            </Text>
            {userAchievement?.unlocked_at && (
              <Text style={[styles.unlockedDate, { color: colors.textTertiary }]}>
                Débloqué le {new Date(userAchievement.unlocked_at).toLocaleDateString('fr-FR')}
              </Text>
            )}
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

// ============================================
// RECENT ACHIEVEMENT BANNER
// ============================================

interface RecentAchievementProps {
  achievement: Achievement;
  userAchievement: UserAchievement;
}

function RecentAchievementBanner({ achievement, userAchievement }: RecentAchievementProps) {
  const rarityConfig = RARITY_CONFIG[achievement.rarity];

  return (
    <Animated.View entering={ZoomIn.delay(300).springify()}>
      <LinearGradient
        colors={rarityConfig.gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.recentBanner}
      >
        <View style={styles.recentBannerIcon}>
          <Text style={styles.recentBannerEmoji}>{achievement.icon}</Text>
        </View>
        <View style={styles.recentBannerContent}>
          <Text style={styles.recentBannerLabel}>Dernier accomplissement</Text>
          <Text style={styles.recentBannerName}>{achievement.name}</Text>
        </View>
        <Ionicons name="sparkles" size={24} color="rgba(255,255,255,0.8)" />
      </LinearGradient>
    </Animated.View>
  );
}

// ============================================
// MAIN SCREEN
// ============================================

export default function AchievementsScreen() {
  const { colors, isDark } = useTheme();
  const { user } = useAuthStore();

  const [category, setCategory] = useState<AchievementCategory | 'all'>('all');
  const [refreshing, setRefreshing] = useState(false);

  // Fetch achievements
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['achievements'],
    queryFn: async () => {
      const response = await api.get<{
        achievements: Achievement[];
        user_achievements: UserAchievement[];
      }>('/achievements');
      return response.data;
    },
  });

  const achievements = data?.achievements ?? [];
  const userAchievements = data?.user_achievements ?? [];

  // Filter by category
  const filteredAchievements = category === 'all'
    ? achievements
    : achievements.filter((a) => a.category === category);

  // Sort: unlocked first, then by rarity
  const sortedAchievements = [...filteredAchievements].sort((a, b) => {
    const aUnlocked = userAchievements.find((ua) => ua.achievement_id === a.id)?.is_unlocked ?? false;
    const bUnlocked = userAchievements.find((ua) => ua.achievement_id === b.id)?.is_unlocked ?? false;

    if (aUnlocked !== bUnlocked) return bUnlocked ? 1 : -1;

    const rarityOrder = ['legendary', 'epic', 'rare', 'common'];
    return rarityOrder.indexOf(a.rarity) - rarityOrder.indexOf(b.rarity);
  });

  // Stats
  const totalUnlocked = userAchievements.filter((ua) => ua.is_unlocked).length;
  const totalPoints = userAchievements
    .filter((ua) => ua.is_unlocked)
    .reduce((sum, ua) => {
      const achievement = achievements.find((a) => a.id === ua.achievement_id);
      return sum + (achievement?.xp_reward ?? 0);
    }, 0);

  // Most recent unlocked
  const recentUnlocked = userAchievements
    .filter((ua) => ua.is_unlocked && ua.unlocked_at)
    .sort((a, b) => new Date(b.unlocked_at!).getTime() - new Date(a.unlocked_at!).getTime())[0];

  const recentAchievement = recentUnlocked
    ? achievements.find((a) => a.id === recentUnlocked.achievement_id)
    : null;

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={[styles.title, { color: colors.text }]}>Achievements</Text>
        <View style={styles.placeholder} />
      </View>

      {/* List */}
      <FlatList
        data={sortedAchievements}
        renderItem={({ item, index }) => (
          <AchievementCard
            achievement={item}
            userAchievement={userAchievements.find((ua) => ua.achievement_id === item.id)}
            index={index}
          />
        )}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <>
            <StatsHeader
              totalUnlocked={totalUnlocked}
              totalAchievements={achievements.length}
              totalPoints={totalPoints}
            />

            {recentAchievement && recentUnlocked && (
              <View style={styles.recentContainer}>
                <RecentAchievementBanner
                  achievement={recentAchievement}
                  userAchievement={recentUnlocked}
                />
              </View>
            )}

            <CategoryFilter selected={category} onSelect={setCategory} />

            <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
              {category === 'all' ? 'Tous les achievements' : CATEGORY_CONFIG[category].label}
              {' '}({sortedAchievements.length})
            </Text>
          </>
        }
        ListEmptyComponent={
          !isLoading ? (
            <View style={styles.emptyState}>
              <Spark size={80} mood="thinking" level={2} />
              <Text style={[styles.emptyTitle, { color: colors.text }]}>
                Aucun achievement
              </Text>
              <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
                Commencez à étudier pour{'\n'}débloquer des achievements !
              </Text>
            </View>
          ) : null
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      />
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

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    ...TextStyles.h2,
  },
  placeholder: {
    width: 40,
  },

  // Stats Header
  statsHeader: {
    paddingVertical: Spacing.xl,
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
  },
  mainStats: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    marginBottom: Spacing.xl,
  },
  mainStatItem: {
    alignItems: 'center',
  },
  mainStatValue: {
    ...TextStyles.h2,
    marginTop: Spacing.sm,
  },
  mainStatLabel: {
    ...TextStyles.caption,
    marginTop: 2,
  },
  progressCircleContainer: {
    position: 'relative',
    width: 100,
    height: 100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressCircleBg: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 8,
  },
  progressCircleFill: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 8,
    borderLeftColor: 'transparent',
    borderBottomColor: 'transparent',
  },
  progressCircleInner: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressPercent: {
    ...TextStyles.h3,
  },
  progressBarContainer: {
    alignItems: 'center',
  },
  progressBarBg: {
    width: '100%',
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressText: {
    ...TextStyles.caption,
    marginTop: Spacing.sm,
  },

  // Recent Banner
  recentContainer: {
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
  },
  recentBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.base,
    borderRadius: BorderRadius.xl,
    ...Shadows.md,
  },
  recentBannerIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  recentBannerEmoji: {
    fontSize: 24,
  },
  recentBannerContent: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  recentBannerLabel: {
    ...TextStyles.caption,
    color: 'rgba(255,255,255,0.8)',
  },
  recentBannerName: {
    ...TextStyles.h4,
    color: Colors.white,
    marginTop: 2,
  },

  // Category Filter
  categoryList: {
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
    gap: Spacing.sm,
  },
  categoryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    gap: 6,
  },
  categoryText: {
    ...TextStyles.caption,
    fontWeight: Typography.fontWeight.medium,
  },

  // Section Title
  sectionTitle: {
    ...TextStyles.caption,
    fontWeight: Typography.fontWeight.semibold,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
  },

  // List
  listContent: {
    paddingBottom: 120,
  },

  // Achievement Card
  achievementCard: {
    flexDirection: 'row',
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
    padding: Spacing.base,
    borderRadius: BorderRadius.xl,
    overflow: 'hidden',
    position: 'relative',
    ...Shadows.sm,
  },
  legendaryGlow: {
    position: 'absolute',
    top: -50,
    left: -50,
    right: -50,
    bottom: -50,
    borderRadius: BorderRadius.xl,
  },
  achievementIcon: {
    position: 'relative',
    marginRight: Spacing.md,
  },
  iconGradient: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconEmoji: {
    fontSize: 28,
  },
  unlockedBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.white,
  },
  achievementContent: {
    flex: 1,
  },
  achievementHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  achievementName: {
    ...TextStyles.label,
    fontWeight: Typography.fontWeight.semibold,
    flex: 1,
    marginRight: Spacing.sm,
  },
  rarityBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
  },
  rarityText: {
    ...TextStyles.caption,
    fontSize: 10,
    fontWeight: Typography.fontWeight.semibold,
  },
  achievementDescription: {
    ...TextStyles.caption,
    marginBottom: Spacing.sm,
  },
  achievementProgress: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  progressBarSmall: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBarSmallFill: {
    height: '100%',
    borderRadius: 2,
  },
  progressSmallText: {
    ...TextStyles.caption,
    fontSize: 10,
  },
  rewardContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  rewardText: {
    ...TextStyles.caption,
    fontWeight: Typography.fontWeight.semibold,
  },
  unlockedDate: {
    ...TextStyles.caption,
    fontSize: 10,
    marginLeft: 'auto',
  },

  // Empty State
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing['4xl'],
    gap: Spacing.md,
  },
  emptyTitle: {
    ...TextStyles.h3,
    marginTop: Spacing.md,
  },
  emptySubtitle: {
    ...TextStyles.body,
    textAlign: 'center',
  },
});
