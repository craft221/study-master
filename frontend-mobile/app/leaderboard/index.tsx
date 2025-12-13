/**
 * Study Master - Leaderboard Screen
 * Classement des meilleurs étudiants
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  RefreshControl,
  Image,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
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
} from '@/constants/theme';
import type { LeaderboardEntry, LeaderboardType, LeaderboardPeriod } from '@/types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ============================================
// PERIOD SELECTOR
// ============================================

interface PeriodSelectorProps {
  selected: LeaderboardPeriod;
  onSelect: (period: LeaderboardPeriod) => void;
}

function PeriodSelector({ selected, onSelect }: PeriodSelectorProps) {
  const { colors } = useTheme();

  const periods: { key: LeaderboardPeriod; label: string }[] = [
    { key: 'daily', label: 'Jour' },
    { key: 'weekly', label: 'Semaine' },
    { key: 'monthly', label: 'Mois' },
    { key: 'all_time', label: 'Tout' },
  ];

  return (
    <View style={styles.periodSelector}>
      {periods.map((period) => {
        const isSelected = selected === period.key;
        return (
          <Pressable
            key={period.key}
            onPress={() => {
              Haptics.selectionAsync();
              onSelect(period.key);
            }}
            style={[
              styles.periodButton,
              {
                backgroundColor: isSelected ? colors.primary : 'transparent',
                borderColor: isSelected ? colors.primary : colors.border,
              },
            ]}
          >
            <Text
              style={[
                styles.periodText,
                { color: isSelected ? Colors.white : colors.textSecondary },
              ]}
            >
              {period.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// ============================================
// TYPE SELECTOR
// ============================================

interface TypeSelectorProps {
  selected: LeaderboardType;
  onSelect: (type: LeaderboardType) => void;
}

function TypeSelector({ selected, onSelect }: TypeSelectorProps) {
  const { colors } = useTheme();

  const types: { key: LeaderboardType; label: string; icon: string; color: string }[] = [
    { key: 'xp', label: 'XP', icon: 'star', color: Colors.accent.gold },
    { key: 'streak', label: 'Streak', icon: 'flame', color: Colors.accent.orange },
    { key: 'flashcards', label: 'Cartes', icon: 'albums', color: Colors.accent.purple },
    { key: 'quizzes', label: 'Quiz', icon: 'help-circle', color: Colors.primary[500] },
  ];

  return (
    <View style={styles.typeSelector}>
      {types.map((type) => {
        const isSelected = selected === type.key;
        return (
          <Pressable
            key={type.key}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onSelect(type.key);
            }}
            style={[
              styles.typeButton,
              {
                backgroundColor: isSelected ? type.color + '20' : colors.card,
                borderColor: isSelected ? type.color : colors.border,
              },
            ]}
          >
            <Ionicons
              name={type.icon as any}
              size={20}
              color={isSelected ? type.color : colors.textSecondary}
            />
            <Text
              style={[
                styles.typeText,
                { color: isSelected ? type.color : colors.textSecondary },
              ]}
            >
              {type.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// ============================================
// PODIUM
// ============================================

interface PodiumProps {
  entries: LeaderboardEntry[];
}

function Podium({ entries }: PodiumProps) {
  const { colors } = useTheme();

  if (entries.length < 3) return null;

  const [first, second, third] = entries;

  const renderPodiumUser = (
    entry: LeaderboardEntry,
    position: 1 | 2 | 3,
    delay: number
  ) => {
    const heights = { 1: 100, 2: 70, 3: 50 };
    const crownColors = {
      1: [Colors.accent.gold, Colors.accent.orange],
      2: ['#C0C0C0', '#A0A0A0'],
      3: ['#CD7F32', '#8B4513'],
    };
    const sizes = { 1: 64, 2: 52, 3: 48 };

    return (
      <Animated.View
        entering={FadeInUp.delay(delay).springify()}
        style={[styles.podiumItem, position === 1 && styles.podiumItemFirst]}
      >
        {/* Avatar */}
        <View style={[styles.podiumAvatarContainer, { zIndex: 10 }]}>
          {position === 1 && (
            <Animated.View
              entering={ZoomIn.delay(800).springify()}
              style={styles.crownContainer}
            >
              <Ionicons name="ribbon" size={32} color={Colors.accent.gold} />
            </Animated.View>
          )}
          <Image
            source={{
              uri: entry.avatar_url ||
                `https://api.dicebear.com/7.x/avataaars/svg?seed=${entry.username}`,
            }}
            style={[
              styles.podiumAvatar,
              {
                width: sizes[position],
                height: sizes[position],
                borderRadius: sizes[position] / 2,
                borderColor: crownColors[position][0],
              },
            ]}
          />
          <View
            style={[
              styles.rankBadge,
              { backgroundColor: crownColors[position][0] },
            ]}
          >
            <Text style={styles.rankBadgeText}>{position}</Text>
          </View>
        </View>

        {/* Name */}
        <Text
          style={[styles.podiumName, { color: colors.text }]}
          numberOfLines={1}
        >
          {entry.username}
        </Text>

        {/* Score */}
        <Text style={[styles.podiumScore, { color: crownColors[position][0] }]}>
          {entry.score.toLocaleString()}
        </Text>

        {/* Pedestal */}
        <LinearGradient
          colors={crownColors[position] as [string, string]}
          style={[styles.pedestal, { height: heights[position] }]}
        >
          <Text style={styles.pedestalRank}>{position}</Text>
        </LinearGradient>
      </Animated.View>
    );
  };

  return (
    <View style={styles.podium}>
      {renderPodiumUser(second, 2, 200)}
      {renderPodiumUser(first, 1, 400)}
      {renderPodiumUser(third, 3, 300)}
    </View>
  );
}

// ============================================
// LEADERBOARD ENTRY
// ============================================

interface LeaderboardRowProps {
  entry: LeaderboardEntry;
  index: number;
  isCurrentUser: boolean;
  type: LeaderboardType;
}

function LeaderboardRow({ entry, index, isCurrentUser, type }: LeaderboardRowProps) {
  const { colors } = useTheme();

  const getScoreIcon = () => {
    switch (type) {
      case 'xp': return 'star';
      case 'streak': return 'flame';
      case 'flashcards': return 'albums';
      case 'quizzes': return 'help-circle';
      case 'notes': return 'document-text';
      default: return 'trophy';
    }
  };

  const getScoreColor = () => {
    switch (type) {
      case 'xp': return Colors.accent.gold;
      case 'streak': return Colors.accent.orange;
      case 'flashcards': return Colors.accent.purple;
      case 'quizzes': return Colors.primary[500];
      case 'notes': return Colors.accent.green;
      default: return Colors.accent.gold;
    }
  };

  return (
    <Animated.View entering={FadeInDown.delay(index * 50).springify()}>
      <Pressable
        style={[
          styles.leaderboardRow,
          {
            backgroundColor: isCurrentUser ? colors.primary + '15' : colors.card,
            borderColor: isCurrentUser ? colors.primary : 'transparent',
          },
        ]}
      >
        {/* Rank */}
        <View style={styles.rankContainer}>
          <Text
            style={[
              styles.rankText,
              { color: entry.rank <= 3 ? getScoreColor() : colors.textSecondary },
            ]}
          >
            #{entry.rank}
          </Text>
        </View>

        {/* Avatar */}
        <Image
          source={{
            uri: entry.avatar_url ||
              `https://api.dicebear.com/7.x/avataaars/svg?seed=${entry.username}`,
          }}
          style={styles.rowAvatar}
        />

        {/* User Info */}
        <View style={styles.userInfo}>
          <Text
            style={[
              styles.userName,
              { color: colors.text },
              isCurrentUser && { fontWeight: Typography.fontWeight.bold },
            ]}
          >
            {entry.username}
            {isCurrentUser && ' (Vous)'}
          </Text>
          <Text style={[styles.userLevel, { color: colors.textSecondary }]}>
            Niveau {entry.level}
          </Text>
        </View>

        {/* Score */}
        <View style={[styles.scoreContainer, { backgroundColor: getScoreColor() + '20' }]}>
          <Ionicons name={getScoreIcon() as any} size={14} color={getScoreColor()} />
          <Text style={[styles.scoreText, { color: getScoreColor() }]}>
            {entry.score.toLocaleString()}
          </Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}

// ============================================
// MY RANK CARD
// ============================================

interface MyRankCardProps {
  entry: LeaderboardEntry | null;
  type: LeaderboardType;
}

function MyRankCard({ entry, type }: MyRankCardProps) {
  const { colors } = useTheme();

  if (!entry) return null;

  const getTypeLabel = () => {
    switch (type) {
      case 'xp': return 'XP';
      case 'streak': return 'jours de streak';
      case 'flashcards': return 'cartes révisées';
      case 'quizzes': return 'quiz complétés';
      case 'notes': return 'notes créées';
      default: return 'points';
    }
  };

  return (
    <Animated.View entering={FadeIn.delay(100).springify()}>
      <LinearGradient
        colors={[Colors.accent.purple + '30', Colors.primary[500] + '20']}
        style={styles.myRankCard}
      >
        <View style={styles.myRankLeft}>
          <Text style={[styles.myRankLabel, { color: colors.textSecondary }]}>
            Votre classement
          </Text>
          <View style={styles.myRankRow}>
            <Text style={[styles.myRankValue, { color: colors.text }]}>
              #{entry.rank}
            </Text>
            <Text style={[styles.myRankScore, { color: Colors.accent.gold }]}>
              {entry.score.toLocaleString()} {getTypeLabel()}
            </Text>
          </View>
        </View>

        <Pressable
          style={[styles.improveButton, { backgroundColor: Colors.accent.purple }]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            // Navigate to relevant section based on type
            switch (type) {
              case 'xp':
              case 'streak':
                router.push('/(tabs)/study');
                break;
              case 'flashcards':
                router.push('/(tabs)/flashcards');
                break;
              case 'quizzes':
                router.push('/(tabs)/quizzes');
                break;
              default:
                router.push('/(tabs)');
            }
          }}
        >
          <Ionicons name="trending-up" size={20} color={Colors.white} />
        </Pressable>
      </LinearGradient>
    </Animated.View>
  );
}

// ============================================
// MAIN SCREEN
// ============================================

export default function LeaderboardScreen() {
  const { colors, isDark } = useTheme();
  const { user } = useAuthStore();

  const [type, setType] = useState<LeaderboardType>('xp');
  const [period, setPeriod] = useState<LeaderboardPeriod>('weekly');
  const [refreshing, setRefreshing] = useState(false);

  // Fetch leaderboard
  const { data: leaderboard = [], isLoading, refetch } = useQuery({
    queryKey: ['leaderboard', type, period],
    queryFn: async () => {
      const response = await api.get<LeaderboardEntry[]>(
        `/leaderboard?type=${type}&period=${period}`
      );
      return response.data;
    },
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  // Find current user in leaderboard
  const myEntry = leaderboard.find((e) => e.user_id === user?.id);

  // Split top 3 and rest
  const topThree = leaderboard.slice(0, 3);
  const rest = leaderboard.slice(3);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={[styles.title, { color: colors.text }]}>Classement</Text>
        <View style={styles.placeholder} />
      </View>

      {/* Type Selector */}
      <TypeSelector selected={type} onSelect={setType} />

      {/* Period Selector */}
      <PeriodSelector selected={period} onSelect={setPeriod} />

      {/* My Rank Card */}
      {myEntry && <MyRankCard entry={myEntry} type={type} />}

      {/* List */}
      <FlatList
        data={rest}
        renderItem={({ item, index }) => (
          <LeaderboardRow
            entry={item}
            index={index}
            isCurrentUser={item.user_id === user?.id}
            type={type}
          />
        )}
        keyExtractor={(item) => item.user_id.toString()}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          topThree.length > 0 ? (
            <Podium entries={topThree} />
          ) : null
        }
        ListEmptyComponent={
          !isLoading ? (
            <View style={styles.emptyState}>
              <Spark size={80} mood="thinking" level={2} />
              <Text style={[styles.emptyTitle, { color: colors.text }]}>
                Pas encore de données
              </Text>
              <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
                Commencez à étudier pour apparaître{'\n'}dans le classement !
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

  // Type Selector
  typeSelector: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
    gap: Spacing.sm,
  },
  typeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.lg,
    borderWidth: 2,
    gap: 6,
  },
  typeText: {
    ...TextStyles.caption,
    fontWeight: Typography.fontWeight.semibold,
  },

  // Period Selector
  periodSelector: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
    gap: Spacing.xs,
  },
  periodButton: {
    flex: 1,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    alignItems: 'center',
  },
  periodText: {
    ...TextStyles.caption,
    fontWeight: Typography.fontWeight.medium,
  },

  // My Rank Card
  myRankCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
    padding: Spacing.base,
    borderRadius: BorderRadius.xl,
  },
  myRankLeft: {
    flex: 1,
  },
  myRankLabel: {
    ...TextStyles.caption,
    marginBottom: 4,
  },
  myRankRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: Spacing.sm,
  },
  myRankValue: {
    ...TextStyles.h2,
  },
  myRankScore: {
    ...TextStyles.label,
  },
  improveButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // List
  listContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: 120,
  },

  // Podium
  podium: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    marginBottom: Spacing.xl,
    marginTop: Spacing.lg,
    paddingHorizontal: Spacing.md,
  },
  podiumItem: {
    flex: 1,
    alignItems: 'center',
    marginHorizontal: 4,
  },
  podiumItemFirst: {
    marginBottom: 20,
  },
  podiumAvatarContainer: {
    position: 'relative',
    marginBottom: Spacing.sm,
  },
  crownContainer: {
    position: 'absolute',
    top: -24,
    alignSelf: 'center',
    zIndex: 20,
  },
  podiumAvatar: {
    borderWidth: 3,
    backgroundColor: Colors.gray[200],
  },
  rankBadge: {
    position: 'absolute',
    bottom: -6,
    alignSelf: 'center',
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.white,
  },
  rankBadgeText: {
    ...TextStyles.caption,
    color: Colors.white,
    fontWeight: Typography.fontWeight.bold,
  },
  podiumName: {
    ...TextStyles.label,
    textAlign: 'center',
    marginBottom: 2,
  },
  podiumScore: {
    ...TextStyles.h4,
    marginBottom: Spacing.sm,
  },
  pedestal: {
    width: '100%',
    borderTopLeftRadius: BorderRadius.lg,
    borderTopRightRadius: BorderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pedestalRank: {
    ...TextStyles.h1,
    color: 'rgba(255, 255, 255, 0.3)',
  },

  // Leaderboard Row
  leaderboardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.sm,
    borderWidth: 2,
  },
  rankContainer: {
    width: 40,
    alignItems: 'center',
  },
  rankText: {
    ...TextStyles.label,
    fontWeight: Typography.fontWeight.bold,
  },
  rowAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginRight: Spacing.md,
    backgroundColor: Colors.gray[200],
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    ...TextStyles.body,
  },
  userLevel: {
    ...TextStyles.caption,
    marginTop: 2,
  },
  scoreContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    gap: 4,
  },
  scoreText: {
    ...TextStyles.label,
    fontWeight: Typography.fontWeight.bold,
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
