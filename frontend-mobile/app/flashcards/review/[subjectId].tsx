/**
 * Study Master - Flashcard Review Screen
 * Interface de révision avec swipe et spaced repetition
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withSequence,
  runOnJS,
  interpolate,
  Extrapolate,
  FadeIn,
  FadeInDown,
  FadeOut,
  SlideInRight,
} from 'react-native-reanimated';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { useTheme } from '@/hooks/useTheme';
import api from '@/services/api';
import { Button } from '@/components/ui/Button';
import { Spark } from '@/components/mascot/Spark';
import {
  Colors,
  Spacing,
  BorderRadius,
  Typography,
  TextStyles,
  Shadows,
  Animation,
} from '@/constants/theme';
import type { Flashcard, FlashcardDeck } from '@/types';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.25;
const CARD_WIDTH = SCREEN_WIDTH - Spacing.lg * 2;
const CARD_HEIGHT = SCREEN_HEIGHT * 0.5;

// ============================================
// QUALITY RATING (SM-2 Algorithm)
// ============================================

const QUALITY_RATINGS = [
  { value: 0, label: 'Oublié', color: Colors.accent.red, icon: 'close-circle' },
  { value: 1, label: 'Difficile', color: Colors.accent.orange, icon: 'alert-circle' },
  { value: 3, label: 'Correct', color: Colors.accent.gold, icon: 'checkmark-circle' },
  { value: 5, label: 'Facile', color: Colors.accent.green, icon: 'star' },
];

// ============================================
// FLASHCARD COMPONENT
// ============================================

interface FlashcardViewProps {
  flashcard: Flashcard;
  isFlipped: boolean;
  onFlip: () => void;
  translateX: Animated.SharedValue<number>;
  translateY: Animated.SharedValue<number>;
  rotate: Animated.SharedValue<number>;
}

function FlashcardView({
  flashcard,
  isFlipped,
  onFlip,
  translateX,
  translateY,
  rotate
}: FlashcardViewProps) {
  const { colors, isDark } = useTheme();
  const flipProgress = useSharedValue(0);

  useEffect(() => {
    flipProgress.value = withSpring(isFlipped ? 1 : 0, {
      damping: 15,
      stiffness: 200,
    });
  }, [isFlipped]);

  const cardAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { rotate: `${rotate.value}deg` },
    ],
  }));

  const frontAnimatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(flipProgress.value, [0, 0.5, 1], [1, 0, 0]),
    transform: [{ rotateY: `${interpolate(flipProgress.value, [0, 1], [0, 180])}deg` }],
    backfaceVisibility: 'hidden',
  }));

  const backAnimatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(flipProgress.value, [0, 0.5, 1], [0, 0, 1]),
    transform: [{ rotateY: `${interpolate(flipProgress.value, [0, 1], [180, 360])}deg` }],
    backfaceVisibility: 'hidden',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  }));

  // Swipe indicators
  const leftIndicatorStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      translateX.value,
      [-SWIPE_THRESHOLD, -50, 0],
      [1, 0.5, 0],
      Extrapolate.CLAMP
    ),
  }));

  const rightIndicatorStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      translateX.value,
      [0, 50, SWIPE_THRESHOLD],
      [0, 0.5, 1],
      Extrapolate.CLAMP
    ),
  }));

  return (
    <Animated.View style={[styles.cardContainer, cardAnimatedStyle]}>
      {/* Swipe Indicators */}
      <Animated.View style={[styles.swipeIndicator, styles.swipeIndicatorLeft, leftIndicatorStyle]}>
        <Ionicons name="close-circle" size={60} color={Colors.accent.red} />
        <Text style={styles.swipeIndicatorText}>Oublié</Text>
      </Animated.View>

      <Animated.View style={[styles.swipeIndicator, styles.swipeIndicatorRight, rightIndicatorStyle]}>
        <Ionicons name="checkmark-circle" size={60} color={Colors.accent.green} />
        <Text style={styles.swipeIndicatorText}>Correct</Text>
      </Animated.View>

      <Pressable onPress={onFlip} style={styles.cardPressable}>
        {/* Front of card */}
        <Animated.View
          style={[
            styles.card,
            { backgroundColor: colors.card },
            frontAnimatedStyle
          ]}
        >
          <LinearGradient
            colors={[flashcard.subject?.color || Colors.primary[500], (flashcard.subject?.color || Colors.primary[500]) + 'cc']}
            style={styles.cardAccent}
          />
          <View style={styles.cardContent}>
            <View style={styles.cardHeader}>
              <Text style={[styles.cardLabel, { color: colors.textSecondary }]}>
                Question
              </Text>
              {flashcard.is_ai_generated && (
                <View style={styles.aiBadge}>
                  <Ionicons name="sparkles" size={12} color={Colors.accent.purple} />
                  <Text style={styles.aiBadgeText}>IA</Text>
                </View>
              )}
            </View>

            <Text style={[styles.cardText, { color: colors.text }]}>
              {flashcard.front}
            </Text>

            {flashcard.hint && (
              <View style={[styles.hintContainer, { backgroundColor: colors.surfaceVariant }]}>
                <Ionicons name="bulb-outline" size={16} color={Colors.accent.gold} />
                <Text style={[styles.hintText, { color: colors.textSecondary }]}>
                  {flashcard.hint}
                </Text>
              </View>
            )}

            <View style={styles.tapHint}>
              <Ionicons name="finger-print-outline" size={20} color={colors.textTertiary} />
              <Text style={[styles.tapHintText, { color: colors.textTertiary }]}>
                Toucher pour voir la réponse
              </Text>
            </View>
          </View>
        </Animated.View>

        {/* Back of card */}
        <Animated.View
          style={[
            styles.card,
            styles.cardBack,
            { backgroundColor: colors.card },
            backAnimatedStyle
          ]}
        >
          <LinearGradient
            colors={[Colors.accent.green, Colors.accent.greenLight]}
            style={styles.cardAccent}
          />
          <View style={styles.cardContent}>
            <View style={styles.cardHeader}>
              <Text style={[styles.cardLabel, { color: colors.textSecondary }]}>
                Réponse
              </Text>
            </View>

            <Text style={[styles.cardText, { color: colors.text }]}>
              {flashcard.back}
            </Text>

            {flashcard.explanation && (
              <View style={[styles.explanationContainer, { backgroundColor: colors.surfaceVariant }]}>
                <Ionicons name="information-circle-outline" size={16} color={Colors.primary[500]} />
                <Text style={[styles.explanationText, { color: colors.textSecondary }]}>
                  {flashcard.explanation}
                </Text>
              </View>
            )}
          </View>
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}

// ============================================
// RATING BUTTONS
// ============================================

interface RatingButtonsProps {
  visible: boolean;
  onRate: (quality: number) => void;
  isLoading: boolean;
}

function RatingButtons({ visible, onRate, isLoading }: RatingButtonsProps) {
  const { colors } = useTheme();

  if (!visible) return null;

  return (
    <Animated.View
      entering={FadeInDown.delay(200).springify()}
      style={styles.ratingContainer}
    >
      <Text style={[styles.ratingTitle, { color: colors.textSecondary }]}>
        Comment était cette carte ?
      </Text>

      <View style={styles.ratingButtons}>
        {QUALITY_RATINGS.map((rating, index) => (
          <Animated.View
            key={rating.value}
            entering={FadeInDown.delay(300 + index * 100).springify()}
          >
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                onRate(rating.value);
              }}
              disabled={isLoading}
              style={({ pressed }) => [
                styles.ratingButton,
                {
                  backgroundColor: pressed ? rating.color + '30' : colors.card,
                  borderColor: rating.color,
                  opacity: isLoading ? 0.5 : 1,
                },
              ]}
            >
              <Ionicons
                name={rating.icon as any}
                size={28}
                color={rating.color}
              />
              <Text style={[styles.ratingLabel, { color: rating.color }]}>
                {rating.label}
              </Text>
            </Pressable>
          </Animated.View>
        ))}
      </View>
    </Animated.View>
  );
}

// ============================================
// SESSION COMPLETE
// ============================================

interface SessionCompleteProps {
  stats: {
    total: number;
    correct: number;
    xpEarned: number;
  };
  onContinue: () => void;
}

function SessionComplete({ stats, onContinue }: SessionCompleteProps) {
  const { colors } = useTheme();
  const accuracy = stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0;
  const sparkMood = accuracy >= 80 ? 'excited' : accuracy >= 50 ? 'happy' : 'encouraging';

  return (
    <Animated.View
      entering={FadeIn.duration(500)}
      style={[styles.completeContainer, { backgroundColor: colors.background }]}
    >
      <LinearGradient
        colors={[Colors.accent.gold + '30', Colors.accent.green + '20', colors.background]}
        style={styles.completeGradient}
      >
        {/* Mascot */}
        <Animated.View entering={FadeInDown.delay(200).springify()}>
          <Spark size={120} mood={sparkMood} level={3} animated />
        </Animated.View>

        {/* Title */}
        <Animated.View entering={FadeInDown.delay(400).springify()}>
          <Text style={[styles.completeTitle, { color: colors.text }]}>
            Session terminée ! 🎉
          </Text>
          <Text style={[styles.completeSubtitle, { color: colors.textSecondary }]}>
            {accuracy >= 80
              ? 'Excellent travail !'
              : accuracy >= 50
                ? 'Bon travail, continuez !'
                : 'Ne lâchez pas, vous progressez !'}
          </Text>
        </Animated.View>

        {/* Stats */}
        <Animated.View
          entering={FadeInDown.delay(600).springify()}
          style={styles.statsGrid}
        >
          <View style={[styles.statCard, { backgroundColor: colors.card }]}>
            <Ionicons name="albums" size={24} color={Colors.primary[500]} />
            <Text style={[styles.statValue, { color: colors.text }]}>{stats.total}</Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Cartes</Text>
          </View>

          <View style={[styles.statCard, { backgroundColor: colors.card }]}>
            <Ionicons name="checkmark-circle" size={24} color={Colors.accent.green} />
            <Text style={[styles.statValue, { color: colors.text }]}>{accuracy}%</Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Précision</Text>
          </View>

          <View style={[styles.statCard, { backgroundColor: colors.card }]}>
            <Ionicons name="star" size={24} color={Colors.accent.gold} />
            <Text style={[styles.statValue, { color: colors.text }]}>+{stats.xpEarned}</Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>XP</Text>
          </View>
        </Animated.View>

        {/* Action Button */}
        <Animated.View entering={FadeInDown.delay(800).springify()} style={styles.completeActions}>
          <Button
            variant="gradient"
            size="lg"
            fullWidth
            onPress={onContinue}
          >
            Continuer
          </Button>
        </Animated.View>
      </LinearGradient>
    </Animated.View>
  );
}

// ============================================
// MAIN SCREEN
// ============================================

export default function FlashcardReviewScreen() {
  const { colors, isDark } = useTheme();
  const { subjectId } = useLocalSearchParams<{ subjectId: string }>();
  const queryClient = useQueryClient();

  // State
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [sessionStats, setSessionStats] = useState({ total: 0, correct: 0, xpEarned: 0 });
  const [isSessionComplete, setIsSessionComplete] = useState(false);
  const startTime = useRef(Date.now());

  // Animated values
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const rotate = useSharedValue(0);

  // Fetch due flashcards
  const { data: flashcards, isLoading, error } = useQuery({
    queryKey: ['flashcards-review', subjectId],
    queryFn: async () => {
      const endpoint = subjectId && subjectId !== 'all'
        ? `/flashcards/due?subject_id=${subjectId}`
        : '/flashcards/due';
      const response = await api.get<Flashcard[]>(endpoint);
      return response.data;
    },
  });

  // Review mutation
  const reviewMutation = useMutation({
    mutationFn: async ({ flashcardId, quality, timeTaken }: {
      flashcardId: number;
      quality: number;
      timeTaken: number;
    }) => {
      const response = await api.post(`/flashcards/${flashcardId}/review`, {
        quality,
        time_taken: timeTaken,
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['flashcard-decks'] });
      queryClient.invalidateQueries({ queryKey: ['user-stats'] });
    },
  });

  const currentCard = flashcards?.[currentIndex];

  // Handle swipe
  const handleSwipe = useCallback((direction: 'left' | 'right') => {
    if (!currentCard) return;

    const quality = direction === 'right' ? 3 : 1;
    const timeTaken = Math.round((Date.now() - startTime.current) / 1000);

    // Update stats
    setSessionStats(prev => ({
      total: prev.total + 1,
      correct: prev.correct + (quality >= 3 ? 1 : 0),
      xpEarned: prev.xpEarned + (quality >= 3 ? 10 : 5),
    }));

    // Submit review
    reviewMutation.mutate({
      flashcardId: currentCard.id,
      quality,
      timeTaken,
    });

    // Move to next card
    setTimeout(() => {
      if (currentIndex >= (flashcards?.length || 0) - 1) {
        setIsSessionComplete(true);
      } else {
        setCurrentIndex(prev => prev + 1);
        setIsFlipped(false);
        translateX.value = 0;
        translateY.value = 0;
        rotate.value = 0;
        startTime.current = Date.now();
      }
    }, 200);

    Haptics.impactAsync(
      direction === 'right'
        ? Haptics.ImpactFeedbackStyle.Medium
        : Haptics.ImpactFeedbackStyle.Light
    );
  }, [currentCard, currentIndex, flashcards, reviewMutation]);

  // Handle manual rating
  const handleRate = useCallback((quality: number) => {
    if (!currentCard) return;

    const timeTaken = Math.round((Date.now() - startTime.current) / 1000);

    setSessionStats(prev => ({
      total: prev.total + 1,
      correct: prev.correct + (quality >= 3 ? 1 : 0),
      xpEarned: prev.xpEarned + (quality >= 3 ? 10 : 5) + (quality === 5 ? 5 : 0),
    }));

    reviewMutation.mutate({
      flashcardId: currentCard.id,
      quality,
      timeTaken,
    });

    // Animate card out
    translateX.value = withSpring(quality >= 3 ? SCREEN_WIDTH : -SCREEN_WIDTH, {
      velocity: 800,
    });
    rotate.value = withSpring(quality >= 3 ? 20 : -20);

    setTimeout(() => {
      if (currentIndex >= (flashcards?.length || 0) - 1) {
        setIsSessionComplete(true);
      } else {
        setCurrentIndex(prev => prev + 1);
        setIsFlipped(false);
        translateX.value = 0;
        translateY.value = 0;
        rotate.value = 0;
        startTime.current = Date.now();
      }
    }, 300);
  }, [currentCard, currentIndex, flashcards, reviewMutation]);

  // Pan gesture for swiping
  const panGesture = Gesture.Pan()
    .onUpdate((event) => {
      translateX.value = event.translationX;
      translateY.value = event.translationY * 0.5;
      rotate.value = interpolate(
        event.translationX,
        [-SCREEN_WIDTH / 2, 0, SCREEN_WIDTH / 2],
        [-15, 0, 15],
        Extrapolate.CLAMP
      );
    })
    .onEnd((event) => {
      if (Math.abs(event.translationX) > SWIPE_THRESHOLD && isFlipped) {
        // Complete swipe
        const direction = event.translationX > 0 ? 'right' : 'left';
        translateX.value = withSpring(
          direction === 'right' ? SCREEN_WIDTH * 1.5 : -SCREEN_WIDTH * 1.5,
          { velocity: event.velocityX }
        );
        rotate.value = withSpring(direction === 'right' ? 30 : -30);
        runOnJS(handleSwipe)(direction);
      } else {
        // Reset position
        translateX.value = withSpring(0);
        translateY.value = withSpring(0);
        rotate.value = withSpring(0);
      }
    });

  // Loading state
  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
            Chargement des cartes...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // No cards state
  if (!flashcards || flashcards.length === 0) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.emptyContainer}>
          <Spark size={100} mood="happy" level={2} />
          <Text style={[styles.emptyTitle, { color: colors.text }]}>
            Tout est à jour !
          </Text>
          <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
            Aucune carte à réviser pour le moment.{'\n'}Revenez plus tard !
          </Text>
          <Button
            variant="primary"
            onPress={() => router.back()}
            icon={<Ionicons name="arrow-back" size={20} color={Colors.white} />}
          >
            Retour
          </Button>
        </View>
      </SafeAreaView>
    );
  }

  // Session complete
  if (isSessionComplete) {
    return (
      <SessionComplete
        stats={sessionStats}
        onContinue={() => router.back()}
      />
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="close" size={24} color={colors.text} />
          </Pressable>

          <View style={styles.progressInfo}>
            <Text style={[styles.progressText, { color: colors.textSecondary }]}>
              {currentIndex + 1} / {flashcards.length}
            </Text>
            <View style={[styles.progressBar, { backgroundColor: colors.surfaceVariant }]}>
              <View
                style={[
                  styles.progressFill,
                  {
                    width: `${((currentIndex + 1) / flashcards.length) * 100}%`,
                    backgroundColor: Colors.primary[500],
                  }
                ]}
              />
            </View>
          </View>

          <View style={styles.xpBadge}>
            <Ionicons name="star" size={16} color={Colors.accent.gold} />
            <Text style={[styles.xpText, { color: Colors.accent.gold }]}>
              +{sessionStats.xpEarned}
            </Text>
          </View>
        </View>

        {/* Card */}
        <View style={styles.cardArea}>
          {currentCard && (
            <GestureDetector gesture={panGesture}>
              <FlashcardView
                flashcard={currentCard}
                isFlipped={isFlipped}
                onFlip={() => {
                  setIsFlipped(!isFlipped);
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
                translateX={translateX}
                translateY={translateY}
                rotate={rotate}
              />
            </GestureDetector>
          )}
        </View>

        {/* Rating Buttons */}
        <RatingButtons
          visible={isFlipped}
          onRate={handleRate}
          isLoading={reviewMutation.isPending}
        />

        {/* Swipe hint when not flipped */}
        {!isFlipped && (
          <Animated.View
            entering={FadeIn.delay(500)}
            style={styles.swipeHint}
          >
            <Ionicons name="hand-left-outline" size={20} color={colors.textTertiary} />
            <Text style={[styles.swipeHintText, { color: colors.textTertiary }]}>
              Touchez la carte pour voir la réponse
            </Text>
          </Animated.View>
        )}
      </SafeAreaView>
    </GestureHandlerRootView>
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
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    gap: Spacing.md,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressInfo: {
    flex: 1,
  },
  progressText: {
    ...TextStyles.caption,
    textAlign: 'center',
    marginBottom: 4,
  },
  progressBar: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  xpBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.accent.gold + '20',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
    gap: 4,
  },
  xpText: {
    ...TextStyles.label,
    fontWeight: Typography.fontWeight.bold,
  },

  // Card Area
  cardArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.lg,
  },
  cardContainer: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
  },
  cardPressable: {
    width: '100%',
    height: '100%',
  },
  card: {
    width: '100%',
    height: '100%',
    borderRadius: BorderRadius['2xl'],
    ...Shadows.lg,
    overflow: 'hidden',
  },
  cardBack: {
    // Positioned absolutely via animated style
  },
  cardAccent: {
    height: 6,
    width: '100%',
  },
  cardContent: {
    flex: 1,
    padding: Spacing.xl,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  cardLabel: {
    ...TextStyles.caption,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  aiBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.accent.purple + '20',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
    gap: 4,
  },
  aiBadgeText: {
    ...TextStyles.caption,
    color: Colors.accent.purple,
    fontWeight: Typography.fontWeight.semibold,
  },
  cardText: {
    ...TextStyles.h3,
    flex: 1,
    textAlign: 'center',
    textAlignVertical: 'center',
  },
  hintContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    gap: Spacing.sm,
    marginTop: Spacing.lg,
  },
  hintText: {
    ...TextStyles.bodySmall,
    flex: 1,
  },
  explanationContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    gap: Spacing.sm,
    marginTop: Spacing.lg,
  },
  explanationText: {
    ...TextStyles.bodySmall,
    flex: 1,
  },
  tapHint: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    marginTop: 'auto',
    paddingTop: Spacing.lg,
  },
  tapHintText: {
    ...TextStyles.caption,
  },

  // Swipe Indicators
  swipeIndicator: {
    position: 'absolute',
    top: '40%',
    alignItems: 'center',
    zIndex: 10,
  },
  swipeIndicatorLeft: {
    left: 20,
  },
  swipeIndicatorRight: {
    right: 20,
  },
  swipeIndicatorText: {
    ...TextStyles.label,
    color: Colors.white,
    marginTop: 4,
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },

  // Rating
  ratingContainer: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xl,
  },
  ratingTitle: {
    ...TextStyles.body,
    textAlign: 'center',
    marginBottom: Spacing.md,
  },
  ratingButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  ratingButton: {
    flex: 1,
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: BorderRadius.xl,
    borderWidth: 2,
    minWidth: 75,
  },
  ratingLabel: {
    ...TextStyles.caption,
    fontWeight: Typography.fontWeight.semibold,
    marginTop: 4,
  },

  // Swipe Hint
  swipeHint: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    paddingBottom: Spacing.xl,
  },
  swipeHintText: {
    ...TextStyles.caption,
  },

  // Loading
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
  },
  loadingText: {
    ...TextStyles.body,
  },

  // Empty State
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
    gap: Spacing.lg,
  },
  emptyTitle: {
    ...TextStyles.h2,
    textAlign: 'center',
  },
  emptySubtitle: {
    ...TextStyles.body,
    textAlign: 'center',
  },

  // Session Complete
  completeContainer: {
    flex: 1,
  },
  completeGradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
    gap: Spacing.xl,
  },
  completeTitle: {
    ...TextStyles.h1,
    textAlign: 'center',
  },
  completeSubtitle: {
    ...TextStyles.body,
    textAlign: 'center',
  },
  statsGrid: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  statCard: {
    alignItems: 'center',
    padding: Spacing.lg,
    borderRadius: BorderRadius.xl,
    minWidth: 100,
    ...Shadows.md,
  },
  statValue: {
    ...TextStyles.stat,
    marginTop: Spacing.sm,
  },
  statLabel: {
    ...TextStyles.caption,
    marginTop: 2,
  },
  completeActions: {
    width: '100%',
    marginTop: Spacing.xl,
  },
});
