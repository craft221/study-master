/**
 * Study Master - Flashcards Screen
 * Liste des decks de flashcards avec statistiques
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
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
  Layout,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useQuery } from '@tanstack/react-query';

import { useTheme } from '@/hooks/useTheme';
import api from '@/services/api';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import {
  Colors,
  Spacing,
  BorderRadius,
  Shadows,
  Typography,
  TextStyles,
} from '@/constants/theme';
import type { FlashcardDeck } from '@/types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ============================================
// DECK CARD COMPONENT
// ============================================

interface DeckCardProps {
  deck: FlashcardDeck;
  index: number;
  onPress: () => void;
  onReview: () => void;
}

function DeckCard({ deck, index, onPress, onReview }: DeckCardProps) {
  const { colors } = useTheme();
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.98);
  };

  const handlePressOut = () => {
    scale.value = withSpring(1);
  };

  // Calculer le pourcentage de maîtrise
  const masteryPercent = deck.total_cards > 0
    ? Math.round((deck.mastered_cards / deck.total_cards) * 100)
    : 0;

  // Couleur du deck (venant du subject)
  const deckColor = deck.subject_color || Colors.primary[500];

  return (
    <Animated.View
      entering={FadeInDown.delay(index * 100).springify()}
      layout={Layout.springify()}
      style={animatedStyle}
    >
      <Pressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
      >
        <Card variant="elevated" style={styles.deckCard}>
          {/* Header avec couleur */}
          <LinearGradient
            colors={[deckColor, deckColor + 'dd']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.deckHeader}
          >
            <View style={styles.deckHeaderContent}>
              <Text style={styles.deckName} numberOfLines={1}>
                {deck.subject_name}
              </Text>
              <View style={styles.deckBadge}>
                <Text style={styles.deckBadgeText}>{deck.total_cards} cartes</Text>
              </View>
            </View>
          </LinearGradient>

          {/* Statistiques */}
          <View style={styles.deckStats}>
            <View style={styles.deckStatItem}>
              <View style={[styles.statDot, { backgroundColor: Colors.accent.red }]} />
              <Text style={[styles.statValue, { color: colors.text }]}>{deck.due_cards}</Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>À revoir</Text>
            </View>

            <View style={styles.statDivider} />

            <View style={styles.deckStatItem}>
              <View style={[styles.statDot, { backgroundColor: Colors.accent.orange }]} />
              <Text style={[styles.statValue, { color: colors.text }]}>{deck.learning_cards}</Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>En cours</Text>
            </View>

            <View style={styles.statDivider} />

            <View style={styles.deckStatItem}>
              <View style={[styles.statDot, { backgroundColor: Colors.accent.green }]} />
              <Text style={[styles.statValue, { color: colors.text }]}>{deck.mastered_cards}</Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Maîtrisées</Text>
            </View>
          </View>

          {/* Barre de progression */}
          <View style={styles.progressSection}>
            <View style={styles.progressHeader}>
              <Text style={[styles.progressLabel, { color: colors.textSecondary }]}>
                Progression
              </Text>
              <Text style={[styles.progressPercent, { color: deckColor }]}>
                {masteryPercent}%
              </Text>
            </View>
            <View style={[styles.progressBar, { backgroundColor: colors.surfaceVariant }]}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${masteryPercent}%`, backgroundColor: deckColor },
                ]}
              />
            </View>
          </View>

          {/* Bouton de révision */}
          {deck.due_cards > 0 && (
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                onReview();
              }}
              style={[styles.reviewButton, { backgroundColor: deckColor }]}
            >
              <Ionicons name="play" size={18} color={Colors.white} />
              <Text style={styles.reviewButtonText}>Réviser maintenant</Text>
            </Pressable>
          )}
        </Card>
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
      <Animated.View entering={FadeInDown.springify()}>
        <Ionicons name="albums-outline" size={80} color={colors.textTertiary} />
      </Animated.View>
      <Text style={[styles.emptyTitle, { color: colors.text }]}>
        Aucune flashcard
      </Text>
      <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
        Créez votre première flashcard pour commencer à mémoriser !
      </Text>
      <Button
        variant="primary"
        onPress={() => router.push('/flashcards/create')}
        icon={<Ionicons name="add" size={20} color={Colors.white} />}
      >
        Créer une flashcard
      </Button>
    </View>
  );
}

// ============================================
// MAIN SCREEN
// ============================================

export default function FlashcardsScreen() {
  const { colors, isDark } = useTheme();
  const [refreshing, setRefreshing] = useState(false);

  // Fetch decks
  const { data: decks, isLoading, refetch } = useQuery({
    queryKey: ['flashcard-decks'],
    queryFn: async () => {
      const response = await api.get<FlashcardDeck[]>('/flashcards/decks');
      return response.data;
    },
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  // Calculer les stats globales
  const totalDue = decks?.reduce((sum, d) => sum + d.due_cards, 0) ?? 0;
  const totalCards = decks?.reduce((sum, d) => sum + d.total_cards, 0) ?? 0;

  const renderDeck = ({ item, index }: { item: FlashcardDeck; index: number }) => (
    <DeckCard
      deck={item}
      index={index}
      onPress={() => router.push(`/flashcards/deck/${item.subject_id}`)}
      onReview={() => router.push(`/flashcards/review/${item.subject_id}`)}
    />
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={[styles.title, { color: colors.text }]}>Flashcards</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            {totalDue > 0
              ? `${totalDue} cartes à réviser aujourd'hui`
              : 'Toutes les cartes sont à jour !'}
          </Text>
        </View>

        <Pressable
          onPress={() => router.push('/flashcards/create')}
          style={[styles.addButton, { backgroundColor: colors.primary }]}
        >
          <Ionicons name="add" size={24} color={Colors.white} />
        </Pressable>
      </View>

      {/* Quick Stats */}
      <Animated.View entering={FadeInRight.delay(100).springify()}>
        <LinearGradient
          colors={[Colors.accent.purple, Colors.accent.purpleLight]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.quickStats}
        >
          <View style={styles.quickStatItem}>
            <Ionicons name="albums" size={24} color={Colors.white} />
            <Text style={styles.quickStatValue}>{totalCards}</Text>
            <Text style={styles.quickStatLabel}>Total</Text>
          </View>

          <View style={styles.quickStatDivider} />

          <View style={styles.quickStatItem}>
            <Ionicons name="time" size={24} color={Colors.white} />
            <Text style={styles.quickStatValue}>{totalDue}</Text>
            <Text style={styles.quickStatLabel}>À revoir</Text>
          </View>

          <View style={styles.quickStatDivider} />

          <Pressable
            style={styles.quickStatItem}
            onPress={() => {
              if (totalDue > 0) {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                router.push('/flashcards/review');
              }
            }}
          >
            <Ionicons name="play-circle" size={24} color={Colors.white} />
            <Text style={styles.quickStatValue}>Go</Text>
            <Text style={styles.quickStatLabel}>Réviser</Text>
          </Pressable>
        </LinearGradient>
      </Animated.View>

      {/* Liste des decks */}
      <FlatList
        data={decks}
        renderItem={renderDeck}
        keyExtractor={(item) => item.subject_id.toString()}
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
  addButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.md,
  },

  // Quick Stats
  quickStats: {
    flexDirection: 'row',
    marginHorizontal: Spacing.lg,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
    ...Shadows.md,
  },
  quickStatItem: {
    flex: 1,
    alignItems: 'center',
  },
  quickStatValue: {
    color: Colors.white,
    ...TextStyles.stat,
    marginTop: Spacing.xs,
  },
  quickStatLabel: {
    color: 'rgba(255, 255, 255, 0.8)',
    ...TextStyles.caption,
    marginTop: 2,
  },
  quickStatDivider: {
    width: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    marginVertical: Spacing.xs,
  },

  // List
  listContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: 120,
  },

  // Deck Card
  deckCard: {
    marginBottom: Spacing.md,
    padding: 0,
    overflow: 'hidden',
  },
  deckHeader: {
    padding: Spacing.base,
  },
  deckHeaderContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  deckName: {
    color: Colors.white,
    ...TextStyles.h4,
    flex: 1,
    marginRight: Spacing.sm,
  },
  deckBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
  },
  deckBadgeText: {
    color: Colors.white,
    ...TextStyles.caption,
    fontWeight: Typography.fontWeight.medium,
  },

  // Deck Stats
  deckStats: {
    flexDirection: 'row',
    padding: Spacing.base,
    borderBottomWidth: 1,
    borderBottomColor: Colors.gray[100],
  },
  deckStatItem: {
    flex: 1,
    alignItems: 'center',
  },
  statDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginBottom: 4,
  },
  statValue: {
    ...TextStyles.h4,
  },
  statLabel: {
    ...TextStyles.caption,
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    backgroundColor: Colors.gray[200],
    marginVertical: Spacing.xs,
  },

  // Progress
  progressSection: {
    padding: Spacing.base,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  progressLabel: {
    ...TextStyles.caption,
  },
  progressPercent: {
    ...TextStyles.label,
    fontWeight: Typography.fontWeight.bold,
  },
  progressBar: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },

  // Review Button
  reviewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.md,
    gap: Spacing.xs,
  },
  reviewButtonText: {
    color: Colors.white,
    ...TextStyles.button,
  },

  // Empty State
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing['4xl'],
  },
  emptyTitle: {
    ...TextStyles.h3,
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  emptySubtitle: {
    ...TextStyles.body,
    textAlign: 'center',
    marginBottom: Spacing.xl,
  },
});
