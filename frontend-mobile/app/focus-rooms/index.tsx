/**
 * Study Master - Focus Rooms Screen
 * Salles d'étude collaboratives en temps réel
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  RefreshControl,
  Dimensions,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInRight,
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
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { useTheme } from '@/hooks/useTheme';
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
import type { FocusRoom, FocusRoomParticipant, FocusRoomType } from '@/types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ============================================
// ROOM CATEGORY FILTER
// ============================================

type RoomCategory = 'all' | 'public' | 'subject' | 'private';

interface CategoryFilterProps {
  selected: RoomCategory;
  onSelect: (category: RoomCategory) => void;
}

function CategoryFilter({ selected, onSelect }: CategoryFilterProps) {
  const { colors } = useTheme();

  const categories: { key: RoomCategory; label: string; icon: string }[] = [
    { key: 'all', label: 'Toutes', icon: 'grid' },
    { key: 'public', label: 'Publiques', icon: 'earth' },
    { key: 'subject', label: 'Matières', icon: 'book' },
    { key: 'private', label: 'Privées', icon: 'lock-closed' },
  ];

  return (
    <View style={styles.filterContainer}>
      {categories.map((cat) => {
        const isSelected = selected === cat.key;
        return (
          <Pressable
            key={cat.key}
            onPress={() => {
              Haptics.selectionAsync();
              onSelect(cat.key);
            }}
            style={[
              styles.filterButton,
              {
                backgroundColor: isSelected ? colors.primary : colors.surfaceVariant,
              },
            ]}
          >
            <Ionicons
              name={cat.icon as any}
              size={16}
              color={isSelected ? Colors.white : colors.textSecondary}
            />
            <Text
              style={[
                styles.filterText,
                { color: isSelected ? Colors.white : colors.textSecondary },
              ]}
            >
              {cat.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// ============================================
// LIVE INDICATOR
// ============================================

function LiveIndicator() {
  const pulse = useSharedValue(1);

  useEffect(() => {
    pulse.value = withRepeat(
      withSequence(
        withTiming(1.3, { duration: 800, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 800, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );
  }, []);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
    opacity: 2 - pulse.value,
  }));

  return (
    <View style={styles.liveContainer}>
      <Animated.View style={[styles.livePulse, pulseStyle]} />
      <View style={styles.liveDot} />
      <Text style={styles.liveText}>LIVE</Text>
    </View>
  );
}

// ============================================
// PARTICIPANT AVATARS
// ============================================

interface ParticipantAvatarsProps {
  participants: FocusRoomParticipant[];
  maxShow?: number;
}

function ParticipantAvatars({ participants, maxShow = 4 }: ParticipantAvatarsProps) {
  const { colors } = useTheme();
  const visibleParticipants = participants.slice(0, maxShow);
  const remaining = participants.length - maxShow;

  return (
    <View style={styles.avatarsContainer}>
      {visibleParticipants.map((participant, index) => (
        <View
          key={participant.id}
          style={[
            styles.avatarWrapper,
            { marginLeft: index === 0 ? 0 : -12, zIndex: maxShow - index },
          ]}
        >
          <Image
            source={{
              uri: participant.user?.avatar_url ||
                `https://api.dicebear.com/7.x/avataaars/svg?seed=${participant.user?.username}`,
            }}
            style={[styles.avatar, { borderColor: colors.card }]}
          />
          {participant.status === 'focusing' && (
            <View style={styles.focusingIndicator} />
          )}
        </View>
      ))}
      {remaining > 0 && (
        <View style={[styles.avatarMore, { backgroundColor: colors.surfaceVariant }]}>
          <Text style={[styles.avatarMoreText, { color: colors.textSecondary }]}>
            +{remaining}
          </Text>
        </View>
      )}
    </View>
  );
}

// ============================================
// ROOM CARD
// ============================================

interface RoomCardProps {
  room: FocusRoom;
  index: number;
  onJoin: () => void;
}

function RoomCard({ room, index, onJoin }: RoomCardProps) {
  const { colors } = useTheme();

  const getRoomTypeIcon = (type: FocusRoomType) => {
    switch (type) {
      case 'public': return 'earth';
      case 'subject': return 'book';
      case 'university': return 'school';
      case 'private': return 'lock-closed';
      case 'event': return 'calendar';
      default: return 'people';
    }
  };

  const getRoomGradient = (type: FocusRoomType): [string, string] => {
    switch (type) {
      case 'public': return [Colors.primary[500], Colors.primary[600]];
      case 'subject': return [Colors.accent.purple, Colors.accent.purpleLight];
      case 'university': return [Colors.accent.green, Colors.accent.greenLight];
      case 'private': return [Colors.accent.orange, Colors.accent.orangeLight];
      case 'event': return [Colors.accent.gold, Colors.accent.orange];
      default: return [Colors.primary[500], Colors.primary[600]];
    }
  };

  const participantCount = room.participants?.length || 0;
  const isFull = participantCount >= room.max_participants;

  return (
    <Animated.View entering={FadeInDown.delay(index * 100).springify()}>
      <Pressable
        onPress={() => {
          if (!isFull) {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            onJoin();
          }
        }}
        disabled={isFull}
        style={({ pressed }) => [
          styles.roomCard,
          {
            backgroundColor: colors.card,
            opacity: isFull ? 0.7 : pressed ? 0.9 : 1,
          },
        ]}
      >
        {/* Header with gradient */}
        <LinearGradient
          colors={getRoomGradient(room.room_type)}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.roomHeader}
        >
          <View style={styles.roomEmoji}>
            <Text style={styles.roomEmojiText}>{room.emoji}</Text>
          </View>
          {room.is_active && participantCount > 0 && <LiveIndicator />}
        </LinearGradient>

        {/* Content */}
        <View style={styles.roomContent}>
          <View style={styles.roomTitleRow}>
            <Text style={[styles.roomName, { color: colors.text }]} numberOfLines={1}>
              {room.name}
            </Text>
            <Ionicons
              name={getRoomTypeIcon(room.room_type)}
              size={16}
              color={colors.textSecondary}
            />
          </View>

          {room.description && (
            <Text
              style={[styles.roomDescription, { color: colors.textSecondary }]}
              numberOfLines={2}
            >
              {room.description}
            </Text>
          )}

          {/* Stats */}
          <View style={styles.roomStats}>
            <View style={styles.roomStat}>
              <Ionicons name="people" size={14} color={colors.textTertiary} />
              <Text style={[styles.roomStatText, { color: colors.textSecondary }]}>
                {participantCount}/{room.max_participants}
              </Text>
            </View>

            <View style={styles.roomStat}>
              <Ionicons name="time" size={14} color={colors.textTertiary} />
              <Text style={[styles.roomStatText, { color: colors.textSecondary }]}>
                {Math.round(room.total_focus_minutes / 60)}h focus
              </Text>
            </View>
          </View>

          {/* Participants */}
          {room.participants && room.participants.length > 0 && (
            <ParticipantAvatars participants={room.participants} />
          )}

          {/* Join Button */}
          <View style={styles.roomActions}>
            {isFull ? (
              <View style={[styles.fullBadge, { backgroundColor: Colors.accent.red + '20' }]}>
                <Text style={[styles.fullBadgeText, { color: Colors.accent.red }]}>
                  Complet
                </Text>
              </View>
            ) : (
              <Button
                variant="primary"
                size="sm"
                onPress={onJoin}
                icon={<Ionicons name="enter" size={16} color={Colors.white} />}
              >
                Rejoindre
              </Button>
            )}
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

// ============================================
// ACTIVE SESSION BANNER
// ============================================

interface ActiveSessionBannerProps {
  room: FocusRoom;
  focusMinutes: number;
  onResume: () => void;
}

function ActiveSessionBanner({ room, focusMinutes, onResume }: ActiveSessionBannerProps) {
  return (
    <Animated.View entering={FadeInRight.springify()}>
      <Pressable
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          onResume();
        }}
      >
        <LinearGradient
          colors={[Colors.accent.green, Colors.accent.greenLight]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.activeBanner}
        >
          <View style={styles.activeBannerContent}>
            <View style={styles.activeBannerIcon}>
              <Ionicons name="pulse" size={24} color={Colors.white} />
            </View>
            <View style={styles.activeBannerText}>
              <Text style={styles.activeBannerTitle}>Session en cours</Text>
              <Text style={styles.activeBannerSubtitle}>
                {room.name} • {focusMinutes} min
              </Text>
            </View>
          </View>
          <Ionicons name="arrow-forward" size={20} color={Colors.white} />
        </LinearGradient>
      </Pressable>
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
      <Spark size={80} mood="thinking" level={2} />
      <Text style={[styles.emptyTitle, { color: colors.text }]}>
        Aucune salle disponible
      </Text>
      <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
        Créez votre propre Focus Room{'\n'}et invitez vos amis !
      </Text>
      <Button
        variant="gradient"
        onPress={() => router.push('/focus-rooms/create')}
        icon={<Ionicons name="add" size={20} color={Colors.white} />}
      >
        Créer une salle
      </Button>
    </View>
  );
}

// ============================================
// MAIN SCREEN
// ============================================

export default function FocusRoomsScreen() {
  const { colors, isDark } = useTheme();
  const queryClient = useQueryClient();

  const [category, setCategory] = useState<RoomCategory>('all');
  const [refreshing, setRefreshing] = useState(false);

  // Fetch rooms
  const { data: rooms = [], isLoading, refetch } = useQuery({
    queryKey: ['focus-rooms', category],
    queryFn: async () => {
      const params = category !== 'all' ? `?room_type=${category}` : '';
      const response = await api.get<FocusRoom[]>(`/focus-rooms${params}`);
      return response.data;
    },
  });

  // Fetch active session
  const { data: activeSession } = useQuery({
    queryKey: ['active-focus-session'],
    queryFn: async () => {
      const response = await api.get<{ room: FocusRoom; focus_minutes: number } | null>(
        '/focus-rooms/active-session'
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

  const handleJoinRoom = useCallback((roomId: number) => {
    router.push(`/focus-rooms/session/${roomId}`);
  }, []);

  const handleResumeSession = useCallback(() => {
    if (activeSession?.room) {
      router.push(`/focus-rooms/session/${activeSession.room.id}`);
    }
  }, [activeSession]);

  // Calculate stats
  const totalParticipants = rooms.reduce(
    (sum, r) => sum + (r.participants?.length || 0),
    0
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={[styles.title, { color: colors.text }]}>Focus Rooms</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            {totalParticipants} étudiants en ligne
          </Text>
        </View>

        <Pressable
          onPress={() => router.push('/focus-rooms/create')}
          style={[styles.createButton, { backgroundColor: colors.primary }]}
        >
          <Ionicons name="add" size={24} color={Colors.white} />
        </Pressable>
      </View>

      {/* Active Session Banner */}
      {activeSession?.room && (
        <View style={styles.bannerContainer}>
          <ActiveSessionBanner
            room={activeSession.room}
            focusMinutes={activeSession.focus_minutes}
            onResume={handleResumeSession}
          />
        </View>
      )}

      {/* Quick Stats */}
      <Animated.View entering={FadeIn.delay(100).springify()} style={styles.quickStats}>
        <LinearGradient
          colors={isDark
            ? [Colors.primary[900] + '80', colors.surfaceVariant]
            : [Colors.primary[100], colors.surfaceVariant]
          }
          style={styles.quickStatsGradient}
        >
          <View style={styles.quickStat}>
            <Ionicons name="people" size={20} color={Colors.primary[500]} />
            <Text style={[styles.quickStatValue, { color: colors.text }]}>
              {totalParticipants}
            </Text>
            <Text style={[styles.quickStatLabel, { color: colors.textSecondary }]}>
              En ligne
            </Text>
          </View>

          <View style={styles.quickStatDivider} />

          <View style={styles.quickStat}>
            <Ionicons name="grid" size={20} color={Colors.accent.purple} />
            <Text style={[styles.quickStatValue, { color: colors.text }]}>
              {rooms.length}
            </Text>
            <Text style={[styles.quickStatLabel, { color: colors.textSecondary }]}>
              Salles
            </Text>
          </View>

          <View style={styles.quickStatDivider} />

          <Pressable
            style={styles.quickStat}
            onPress={() => router.push('/focus-rooms/leaderboard')}
          >
            <Ionicons name="trophy" size={20} color={Colors.accent.gold} />
            <Text style={[styles.quickStatValue, { color: colors.text }]}>
              Top
            </Text>
            <Text style={[styles.quickStatLabel, { color: colors.textSecondary }]}>
              Classement
            </Text>
          </Pressable>
        </LinearGradient>
      </Animated.View>

      {/* Category Filter */}
      <CategoryFilter selected={category} onSelect={setCategory} />

      {/* Rooms List */}
      <FlatList
        data={rooms}
        renderItem={({ item, index }) => (
          <RoomCard
            room={item}
            index={index}
            onJoin={() => handleJoinRoom(item.id)}
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
  createButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.md,
  },

  // Banner
  bannerContainer: {
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
  },
  activeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.base,
    borderRadius: BorderRadius.xl,
    ...Shadows.md,
  },
  activeBannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  activeBannerIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeBannerText: {},
  activeBannerTitle: {
    ...TextStyles.label,
    color: Colors.white,
    fontWeight: Typography.fontWeight.semibold,
  },
  activeBannerSubtitle: {
    ...TextStyles.caption,
    color: 'rgba(255, 255, 255, 0.9)',
    marginTop: 2,
  },

  // Quick Stats
  quickStats: {
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
    borderRadius: BorderRadius.xl,
    overflow: 'hidden',
  },
  quickStatsGradient: {
    flexDirection: 'row',
    padding: Spacing.base,
  },
  quickStat: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  quickStatValue: {
    ...TextStyles.h4,
  },
  quickStatLabel: {
    ...TextStyles.caption,
  },
  quickStatDivider: {
    width: 1,
    backgroundColor: Colors.gray[200],
    marginVertical: Spacing.xs,
  },

  // Filter
  filterContainer: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
    gap: Spacing.sm,
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    gap: 6,
  },
  filterText: {
    ...TextStyles.caption,
    fontWeight: Typography.fontWeight.medium,
  },

  // List
  listContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: 120,
  },

  // Room Card
  roomCard: {
    borderRadius: BorderRadius.xl,
    marginBottom: Spacing.md,
    overflow: 'hidden',
    ...Shadows.md,
  },
  roomHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.base,
  },
  roomEmoji: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  roomEmojiText: {
    fontSize: 24,
  },
  roomContent: {
    padding: Spacing.base,
    gap: Spacing.sm,
  },
  roomTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  roomName: {
    ...TextStyles.h4,
    flex: 1,
  },
  roomDescription: {
    ...TextStyles.bodySmall,
  },
  roomStats: {
    flexDirection: 'row',
    gap: Spacing.lg,
  },
  roomStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  roomStatText: {
    ...TextStyles.caption,
  },
  roomActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: Spacing.sm,
  },
  fullBadge: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  fullBadgeText: {
    ...TextStyles.caption,
    fontWeight: Typography.fontWeight.semibold,
  },

  // Live Indicator
  liveContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
    gap: 6,
  },
  livePulse: {
    position: 'absolute',
    left: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.accent.red,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.accent.red,
  },
  liveText: {
    ...TextStyles.caption,
    color: Colors.white,
    fontWeight: Typography.fontWeight.bold,
    fontSize: 10,
  },

  // Avatars
  avatarsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.xs,
  },
  avatarWrapper: {
    position: 'relative',
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
  },
  focusingIndicator: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.accent.green,
    borderWidth: 2,
    borderColor: Colors.white,
  },
  avatarMore: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginLeft: -12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarMoreText: {
    ...TextStyles.caption,
    fontWeight: Typography.fontWeight.semibold,
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
    ...TextStyles.h3,
    marginTop: Spacing.md,
  },
  emptySubtitle: {
    ...TextStyles.body,
    textAlign: 'center',
  },
});
