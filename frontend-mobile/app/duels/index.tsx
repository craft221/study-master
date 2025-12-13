/**
 * Study Master - Duels Screen
 * Compétitions en temps réel entre étudiants
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  RefreshControl,
  Image,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInLeft,
  FadeInRight,
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
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { useTheme } from '@/hooks/useTheme';
import { useAuthStore } from '@/stores/authStore';
import api from '@/services/api';
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
import type { Duel, DuelStatus, User, Subject } from '@/types';

// ============================================
// DUEL STATUS BADGE
// ============================================

interface StatusBadgeProps {
  status: DuelStatus;
}

function StatusBadge({ status }: StatusBadgeProps) {
  const getStatusConfig = () => {
    switch (status) {
      case 'pending':
        return { label: 'En attente', color: Colors.accent.orange, icon: 'time' };
      case 'accepted':
        return { label: 'Accepté', color: Colors.accent.green, icon: 'checkmark' };
      case 'in_progress':
        return { label: 'En cours', color: Colors.primary[500], icon: 'play' };
      case 'completed':
        return { label: 'Terminé', color: Colors.accent.purple, icon: 'trophy' };
      case 'declined':
        return { label: 'Refusé', color: Colors.accent.red, icon: 'close' };
      case 'cancelled':
        return { label: 'Annulé', color: Colors.gray[400], icon: 'ban' };
      default:
        return { label: status, color: Colors.gray[400], icon: 'help' };
    }
  };

  const config = getStatusConfig();

  return (
    <View style={[styles.statusBadge, { backgroundColor: config.color + '20' }]}>
      <Ionicons name={config.icon as any} size={12} color={config.color} />
      <Text style={[styles.statusText, { color: config.color }]}>{config.label}</Text>
    </View>
  );
}

// ============================================
// VS DIVIDER ANIMATION
// ============================================

function VsDivider() {
  const pulse = useSharedValue(1);

  useEffect(() => {
    pulse.value = withRepeat(
      withSequence(
        withTiming(1.1, { duration: 600 }),
        withTiming(1, { duration: 600 })
      ),
      -1,
      true
    );
  }, []);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
  }));

  return (
    <Animated.View style={[styles.vsDivider, pulseStyle]}>
      <LinearGradient
        colors={[Colors.accent.orange, Colors.accent.red]}
        style={styles.vsCircle}
      >
        <Text style={styles.vsText}>VS</Text>
      </LinearGradient>
    </Animated.View>
  );
}

// ============================================
// PLAYER CARD
// ============================================

interface PlayerCardProps {
  user: User | undefined;
  score: number | null;
  isWinner: boolean;
  isCurrentUser: boolean;
  side: 'left' | 'right';
}

function PlayerCard({ user, score, isWinner, isCurrentUser, side }: PlayerCardProps) {
  const { colors } = useTheme();
  const entering = side === 'left' ? FadeInLeft : FadeInRight;

  return (
    <Animated.View
      entering={entering.delay(200).springify()}
      style={[styles.playerCard, { backgroundColor: colors.card }]}
    >
      {isWinner && (
        <View style={styles.winnerCrown}>
          <Ionicons name="trophy" size={20} color={Colors.accent.gold} />
        </View>
      )}

      <Image
        source={{
          uri: user?.avatar_url ||
            `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.username || 'unknown'}`,
        }}
        style={[
          styles.playerAvatar,
          isWinner && { borderColor: Colors.accent.gold, borderWidth: 3 },
        ]}
      />

      <Text
        style={[
          styles.playerName,
          { color: colors.text },
          isCurrentUser && { color: colors.primary },
        ]}
        numberOfLines={1}
      >
        {user?.username || '???'}
        {isCurrentUser && ' (Vous)'}
      </Text>

      <Text style={[styles.playerLevel, { color: colors.textSecondary }]}>
        Niveau {user?.level || 1}
      </Text>

      {score !== null && (
        <View style={[styles.scoreContainer, isWinner && { backgroundColor: Colors.accent.gold + '20' }]}>
          <Text style={[styles.scoreText, { color: isWinner ? Colors.accent.gold : colors.text }]}>
            {score} pts
          </Text>
        </View>
      )}
    </Animated.View>
  );
}

// ============================================
// DUEL CARD
// ============================================

interface DuelCardProps {
  duel: Duel;
  currentUserId: number;
  index: number;
  onAccept: () => void;
  onDecline: () => void;
  onPlay: () => void;
}

function DuelCard({ duel, currentUserId, index, onAccept, onDecline, onPlay }: DuelCardProps) {
  const { colors } = useTheme();

  const isChallenger = duel.challenger_id === currentUserId;
  const isPending = duel.status === 'pending';
  const canAccept = isPending && !isChallenger;
  const canPlay = duel.status === 'accepted' || duel.status === 'in_progress';

  const challenger = duel.challenger;
  const opponent = duel.opponent;

  const isWinner = (userId: number) => duel.winner_id === userId;

  return (
    <Animated.View entering={FadeInDown.delay(index * 100).springify()}>
      <Card variant="elevated" style={styles.duelCard}>
        {/* Header */}
        <View style={styles.duelHeader}>
          <View style={styles.subjectInfo}>
            <View
              style={[styles.subjectDot, { backgroundColor: duel.subject?.color || Colors.primary[500] }]}
            />
            <Text style={[styles.subjectName, { color: colors.textSecondary }]}>
              {duel.subject?.name || 'Quiz'}
            </Text>
          </View>
          <StatusBadge status={duel.status} />
        </View>

        {/* Players */}
        <View style={styles.playersContainer}>
          <PlayerCard
            user={challenger}
            score={duel.challenger_score}
            isWinner={isWinner(duel.challenger_id)}
            isCurrentUser={duel.challenger_id === currentUserId}
            side="left"
          />

          <VsDivider />

          <PlayerCard
            user={opponent}
            score={duel.opponent_score}
            isWinner={isWinner(duel.opponent_id)}
            isCurrentUser={duel.opponent_id === currentUserId}
            side="right"
          />
        </View>

        {/* Stakes */}
        <View style={styles.stakesContainer}>
          <Ionicons name="flash" size={16} color={Colors.accent.gold} />
          <Text style={[styles.stakesText, { color: colors.textSecondary }]}>
            {duel.stakes_xp} XP en jeu • {duel.duration_minutes} min
          </Text>
        </View>

        {/* Actions */}
        <View style={styles.duelActions}>
          {canAccept && (
            <>
              <Button
                variant="outline"
                size="sm"
                onPress={onDecline}
                style={{ flex: 1 }}
              >
                Refuser
              </Button>
              <Button
                variant="gradient"
                size="sm"
                onPress={onAccept}
                style={{ flex: 1 }}
                icon={<Ionicons name="checkmark" size={16} color={Colors.white} />}
              >
                Accepter
              </Button>
            </>
          )}

          {canPlay && (
            <Button
              variant="gradient"
              size="sm"
              fullWidth
              onPress={onPlay}
              icon={<Ionicons name="play" size={16} color={Colors.white} />}
            >
              Jouer maintenant !
            </Button>
          )}

          {duel.status === 'completed' && (
            <Button
              variant="outline"
              size="sm"
              fullWidth
              onPress={() => router.push(`/duels/result/${duel.id}`)}
            >
              Voir les résultats
            </Button>
          )}
        </View>
      </Card>
    </Animated.View>
  );
}

// ============================================
// CHALLENGE BUTTON
// ============================================

function ChallengeButton() {
  const { colors } = useTheme();
  const scale = useSharedValue(1);

  useEffect(() => {
    scale.value = withRepeat(
      withSequence(
        withTiming(1.05, { duration: 1000 }),
        withTiming(1, { duration: 1000 })
      ),
      -1,
      true
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View style={[styles.challengeButtonContainer, animatedStyle]}>
      <Pressable
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
          router.push('/duels/create');
        }}
      >
        <LinearGradient
          colors={[Colors.accent.orange, Colors.accent.red]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.challengeButton}
        >
          <Ionicons name="flash" size={28} color={Colors.white} />
          <Text style={styles.challengeButtonText}>Défier un ami</Text>
        </LinearGradient>
      </Pressable>
    </Animated.View>
  );
}

// ============================================
// STATS CARD
// ============================================

interface StatsCardProps {
  wins: number;
  losses: number;
  winRate: number;
  xpWon: number;
}

function StatsCard({ wins, losses, winRate, xpWon }: StatsCardProps) {
  const { colors } = useTheme();

  return (
    <Animated.View entering={FadeIn.delay(200).springify()}>
      <LinearGradient
        colors={[Colors.accent.purple + '30', Colors.primary[500] + '20', 'transparent']}
        style={styles.statsCard}
      >
        <View style={styles.statItem}>
          <Ionicons name="trophy" size={20} color={Colors.accent.green} />
          <Text style={[styles.statValue, { color: colors.text }]}>{wins}</Text>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Victoires</Text>
        </View>

        <View style={styles.statDivider} />

        <View style={styles.statItem}>
          <Ionicons name="close-circle" size={20} color={Colors.accent.red} />
          <Text style={[styles.statValue, { color: colors.text }]}>{losses}</Text>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Défaites</Text>
        </View>

        <View style={styles.statDivider} />

        <View style={styles.statItem}>
          <Ionicons name="trending-up" size={20} color={Colors.accent.gold} />
          <Text style={[styles.statValue, { color: colors.text }]}>{winRate}%</Text>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Ratio</Text>
        </View>

        <View style={styles.statDivider} />

        <View style={styles.statItem}>
          <Ionicons name="flash" size={20} color={Colors.accent.purple} />
          <Text style={[styles.statValue, { color: colors.text }]}>+{xpWon}</Text>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>XP gagné</Text>
        </View>
      </LinearGradient>
    </Animated.View>
  );
}

// ============================================
// EMPTY STATE
// ============================================

function EmptyState() {
  const { colors } = useTheme();

  return (
    <View style={styles.emptyState}>
      <Animated.View entering={ZoomIn.springify()}>
        <Spark size={100} mood="excited" level={3} animated />
      </Animated.View>
      <Text style={[styles.emptyTitle, { color: colors.text }]}>
        Prêt pour le combat ?
      </Text>
      <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
        Défiez vos amis dans des quiz{'\n'}et gagnez des XP !
      </Text>
      <ChallengeButton />
    </View>
  );
}

// ============================================
// MAIN SCREEN
// ============================================

export default function DuelsScreen() {
  const { colors, isDark } = useTheme();
  const { user } = useAuthStore();
  const queryClient = useQueryClient();

  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'all' | 'pending' | 'active' | 'completed'>('all');

  // Fetch duels
  const { data: duels = [], isLoading, refetch } = useQuery({
    queryKey: ['duels', filter],
    queryFn: async () => {
      const params = filter !== 'all' ? `?status=${filter}` : '';
      const response = await api.get<Duel[]>(`/duels${params}`);
      return response.data;
    },
  });

  // Fetch stats
  const { data: stats } = useQuery({
    queryKey: ['duel-stats'],
    queryFn: async () => {
      const response = await api.get<{
        wins: number;
        losses: number;
        win_rate: number;
        xp_won: number;
      }>('/duels/stats');
      return response.data;
    },
  });

  // Accept duel mutation
  const acceptMutation = useMutation({
    mutationFn: async (duelId: number) => {
      const response = await api.post(`/duels/${duelId}/accept`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['duels'] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
  });

  // Decline duel mutation
  const declineMutation = useMutation({
    mutationFn: async (duelId: number) => {
      const response = await api.post(`/duels/${duelId}/decline`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['duels'] });
    },
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const handleAccept = useCallback((duelId: number) => {
    Alert.alert(
      'Accepter le défi',
      'Êtes-vous prêt à relever ce défi ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Accepter',
          onPress: () => acceptMutation.mutate(duelId),
        },
      ]
    );
  }, [acceptMutation]);

  const handleDecline = useCallback((duelId: number) => {
    Alert.alert(
      'Refuser le défi',
      'Voulez-vous vraiment refuser ce défi ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Refuser',
          style: 'destructive',
          onPress: () => declineMutation.mutate(duelId),
        },
      ]
    );
  }, [declineMutation]);

  const handlePlay = useCallback((duelId: number) => {
    router.push(`/duels/play/${duelId}`);
  }, []);

  const pendingCount = duels.filter((d) =>
    d.status === 'pending' && d.opponent_id === user?.id
  ).length;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={[styles.title, { color: colors.text }]}>Duels</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Affrontez vos amis !
          </Text>
        </View>

        <View style={styles.headerActions}>
          {pendingCount > 0 && (
            <View style={styles.pendingBadge}>
              <Text style={styles.pendingBadgeText}>{pendingCount}</Text>
            </View>
          )}
          <Pressable
            onPress={() => router.push('/duels/create')}
            style={[styles.createButton, { backgroundColor: Colors.accent.orange }]}
          >
            <Ionicons name="flash" size={24} color={Colors.white} />
          </Pressable>
        </View>
      </View>

      {/* Stats */}
      {stats && (
        <View style={styles.statsContainer}>
          <StatsCard
            wins={stats.wins}
            losses={stats.losses}
            winRate={stats.win_rate}
            xpWon={stats.xp_won}
          />
        </View>
      )}

      {/* Filter Tabs */}
      <View style={styles.filterTabs}>
        {(['all', 'pending', 'active', 'completed'] as const).map((tab) => {
          const isSelected = filter === tab;
          const labels = {
            all: 'Tous',
            pending: 'En attente',
            active: 'En cours',
            completed: 'Terminés',
          };
          return (
            <Pressable
              key={tab}
              onPress={() => {
                Haptics.selectionAsync();
                setFilter(tab);
              }}
              style={[
                styles.filterTab,
                {
                  backgroundColor: isSelected ? colors.primary : 'transparent',
                  borderColor: isSelected ? colors.primary : colors.border,
                },
              ]}
            >
              <Text
                style={[
                  styles.filterTabText,
                  { color: isSelected ? Colors.white : colors.textSecondary },
                ]}
              >
                {labels[tab]}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Duels List */}
      <FlatList
        data={duels}
        renderItem={({ item, index }) => (
          <DuelCard
            duel={item}
            currentUserId={user?.id || 0}
            index={index}
            onAccept={() => handleAccept(item.id)}
            onDecline={() => handleDecline(item.id)}
            onPlay={() => handlePlay(item.id)}
          />
        )}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={!isLoading ? <EmptyState /> : null}
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
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.base,
    paddingBottom: Spacing.md,
  },
  title: {
    ...TextStyles.h2,
  },
  subtitle: {
    ...TextStyles.bodySmall,
    marginTop: 2,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pendingBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: Colors.accent.red,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  pendingBadgeText: {
    ...TextStyles.caption,
    color: Colors.white,
    fontWeight: Typography.fontWeight.bold,
    fontSize: 11,
  },
  createButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.md,
  },

  // Stats
  statsContainer: {
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
  },
  statsCard: {
    flexDirection: 'row',
    padding: Spacing.base,
    borderRadius: BorderRadius.xl,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  statValue: {
    ...TextStyles.h4,
  },
  statLabel: {
    ...TextStyles.caption,
  },
  statDivider: {
    width: 1,
    backgroundColor: Colors.gray[200],
    marginVertical: Spacing.xs,
  },

  // Filter Tabs
  filterTabs: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
    gap: Spacing.sm,
  },
  filterTab: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  filterTabText: {
    ...TextStyles.caption,
    fontWeight: Typography.fontWeight.medium,
  },

  // List
  listContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: 120,
  },

  // Duel Card
  duelCard: {
    marginBottom: Spacing.md,
    padding: Spacing.base,
  },
  duelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  subjectInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  subjectDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  subjectName: {
    ...TextStyles.caption,
  },

  // Status Badge
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
    gap: 4,
  },
  statusText: {
    ...TextStyles.caption,
    fontWeight: Typography.fontWeight.semibold,
  },

  // Players
  playersContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  playerCard: {
    flex: 1,
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    position: 'relative',
  },
  winnerCrown: {
    position: 'absolute',
    top: -10,
    right: -10,
  },
  playerAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    marginBottom: Spacing.sm,
  },
  playerName: {
    ...TextStyles.label,
    textAlign: 'center',
  },
  playerLevel: {
    ...TextStyles.caption,
    marginTop: 2,
  },
  scoreContainer: {
    marginTop: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
  },
  scoreText: {
    ...TextStyles.label,
    fontWeight: Typography.fontWeight.bold,
  },

  // VS Divider
  vsDivider: {
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: Spacing.md,
  },
  vsCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.md,
  },
  vsText: {
    ...TextStyles.label,
    color: Colors.white,
    fontWeight: Typography.fontWeight.bold,
  },

  // Stakes
  stakesContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    marginBottom: Spacing.md,
  },
  stakesText: {
    ...TextStyles.caption,
  },

  // Actions
  duelActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },

  // Challenge Button
  challengeButtonContainer: {
    marginTop: Spacing.lg,
  },
  challengeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.base,
    borderRadius: BorderRadius.xl,
    gap: Spacing.sm,
    ...Shadows.lg,
  },
  challengeButtonText: {
    ...TextStyles.button,
    color: Colors.white,
  },

  // Empty State
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing['4xl'],
    gap: Spacing.md,
  },
  emptyTitle: {
    ...TextStyles.h2,
    marginTop: Spacing.lg,
  },
  emptySubtitle: {
    ...TextStyles.body,
    textAlign: 'center',
  },
});
