/**
 * Study Master - Quizzes Screen
 * Liste des quiz avec création AI
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import Animated, { FadeInDown, FadeInRight } from 'react-native-reanimated';
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
  Typography,
  TextStyles,
  Shadows,
} from '@/constants/theme';
import type { Quiz, QuizDifficulty } from '@/types';

// ============================================
// QUIZ CARD COMPONENT
// ============================================

interface QuizCardProps {
  quiz: Quiz;
  index: number;
  onPress: () => void;
}

function QuizCard({ quiz, index, onPress }: QuizCardProps) {
  const { colors } = useTheme();

  const getDifficultyColor = (difficulty: QuizDifficulty | null) => {
    switch (difficulty) {
      case 'easy': return Colors.accent.green;
      case 'medium': return Colors.accent.orange;
      case 'hard': return Colors.accent.red;
      default: return Colors.gray[400];
    }
  };

  const getDifficultyLabel = (difficulty: QuizDifficulty | null) => {
    switch (difficulty) {
      case 'easy': return 'Facile';
      case 'medium': return 'Moyen';
      case 'hard': return 'Difficile';
      default: return 'Non défini';
    }
  };

  const questionsCount = quiz.questions_data?.length || 0;

  return (
    <Animated.View entering={FadeInDown.delay(index * 80).springify()}>
      <Pressable onPress={onPress}>
        <Card variant="elevated" style={styles.quizCard}>
          <View style={styles.quizHeader}>
            <View style={styles.quizInfo}>
              <Text style={[styles.quizTitle, { color: colors.text }]} numberOfLines={2}>
                {quiz.title}
              </Text>
              {quiz.subject && (
                <Text style={[styles.quizSubject, { color: colors.textSecondary }]}>
                  {quiz.subject.name}
                </Text>
              )}
            </View>

            {quiz.is_ai_generated && (
              <View style={styles.aiBadge}>
                <Ionicons name="sparkles" size={14} color={Colors.accent.purple} />
                <Text style={styles.aiBadgeText}>IA</Text>
              </View>
            )}
          </View>

          <View style={styles.quizMeta}>
            <View style={styles.metaItem}>
              <Ionicons name="help-circle-outline" size={18} color={colors.textSecondary} />
              <Text style={[styles.metaText, { color: colors.textSecondary }]}>
                {questionsCount} questions
              </Text>
            </View>

            <View
              style={[
                styles.difficultyBadge,
                { backgroundColor: getDifficultyColor(quiz.difficulty) + '20' },
              ]}
            >
              <View
                style={[styles.difficultyDot, { backgroundColor: getDifficultyColor(quiz.difficulty) }]}
              />
              <Text style={[styles.difficultyText, { color: getDifficultyColor(quiz.difficulty) }]}>
                {getDifficultyLabel(quiz.difficulty)}
              </Text>
            </View>

            {quiz.time_limit_minutes && (
              <View style={styles.metaItem}>
                <Ionicons name="time-outline" size={18} color={colors.textSecondary} />
                <Text style={[styles.metaText, { color: colors.textSecondary }]}>
                  {quiz.time_limit_minutes} min
                </Text>
              </View>
            )}
          </View>

          {/* Stats du quiz */}
          {quiz.total_attempts > 0 && (
            <View style={styles.quizStats}>
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: colors.text }]}>
                  {quiz.average_score.toFixed(0)}%
                </Text>
                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                  Score moyen
                </Text>
              </View>
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: colors.text }]}>
                  {quiz.total_attempts}
                </Text>
                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                  Tentatives
                </Text>
              </View>
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: Colors.accent.green }]}>
                  {quiz.highest_score.toFixed(0)}%
                </Text>
                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                  Meilleur
                </Text>
              </View>
            </View>
          )}

          {/* Bouton démarrer */}
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              router.push(`/quizzes/play/${quiz.id}`);
            }}
            style={[styles.startButton, { backgroundColor: colors.primary }]}
          >
            <Ionicons name="play" size={18} color={Colors.white} />
            <Text style={styles.startButtonText}>Démarrer</Text>
          </Pressable>
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
      <Ionicons name="help-circle-outline" size={80} color={colors.textTertiary} />
      <Text style={[styles.emptyTitle, { color: colors.text }]}>
        Aucun quiz
      </Text>
      <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
        Créez votre premier quiz ou laissez l'IA en générer un pour vous !
      </Text>
      <View style={styles.emptyButtons}>
        <Button
          variant="primary"
          onPress={() => router.push('/quizzes/create')}
          icon={<Ionicons name="add" size={20} color={Colors.white} />}
        >
          Créer un quiz
        </Button>
        <Button
          variant="outline"
          onPress={() => router.push('/quizzes/generate')}
          icon={<Ionicons name="sparkles" size={20} color={Colors.primary[500]} />}
        >
          Générer avec l'IA
        </Button>
      </View>
    </View>
  );
}

// ============================================
// MAIN SCREEN
// ============================================

export default function QuizzesScreen() {
  const { colors, isDark } = useTheme();
  const [refreshing, setRefreshing] = useState(false);

  // Fetch quizzes
  const { data: quizzes, isLoading, refetch } = useQuery({
    queryKey: ['quizzes'],
    queryFn: async () => {
      const response = await api.get<Quiz[]>('/quizzes/');
      return response.data;
    },
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const renderQuiz = ({ item, index }: { item: Quiz; index: number }) => (
    <QuizCard
      quiz={item}
      index={index}
      onPress={() => router.push(`/quizzes/${item.id}`)}
    />
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={[styles.title, { color: colors.text }]}>Quiz</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Testez vos connaissances
          </Text>
        </View>

        <View style={styles.headerButtons}>
          <Pressable
            onPress={() => router.push('/quizzes/generate')}
            style={[styles.aiButton, { backgroundColor: Colors.accent.purple + '20' }]}
          >
            <Ionicons name="sparkles" size={20} color={Colors.accent.purple} />
          </Pressable>

          <Pressable
            onPress={() => router.push('/quizzes/create')}
            style={[styles.addButton, { backgroundColor: colors.primary }]}
          >
            <Ionicons name="add" size={24} color={Colors.white} />
          </Pressable>
        </View>
      </View>

      {/* Quick Actions */}
      <Animated.View entering={FadeInRight.delay(100).springify()}>
        <View style={styles.quickActions}>
          <Pressable
            onPress={() => router.push('/duels')}
            style={[styles.quickAction, { backgroundColor: Colors.accent.gold + '15' }]}
          >
            <Ionicons name="flash" size={24} color={Colors.accent.gold} />
            <Text style={[styles.quickActionText, { color: colors.text }]}>Duels</Text>
            <Text style={[styles.quickActionSubtext, { color: colors.textSecondary }]}>
              Défiez vos amis
            </Text>
          </Pressable>

          <Pressable
            onPress={() => router.push('/quizzes/public')}
            style={[styles.quickAction, { backgroundColor: Colors.primary[500] + '15' }]}
          >
            <Ionicons name="globe" size={24} color={Colors.primary[500]} />
            <Text style={[styles.quickActionText, { color: colors.text }]}>Publics</Text>
            <Text style={[styles.quickActionSubtext, { color: colors.textSecondary }]}>
              Quiz communautaires
            </Text>
          </Pressable>
        </View>
      </Animated.View>

      {/* Section Title */}
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Mes quiz</Text>
        <Text style={[styles.sectionCount, { color: colors.textSecondary }]}>
          {quizzes?.length || 0} quiz
        </Text>
      </View>

      {/* Liste des quiz */}
      <FlatList
        data={quizzes}
        renderItem={renderQuiz}
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
  headerButtons: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  aiButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.md,
  },

  // Quick Actions
  quickActions: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.lg,
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  quickAction: {
    flex: 1,
    padding: Spacing.base,
    borderRadius: BorderRadius.xl,
    alignItems: 'center',
  },
  quickActionText: {
    ...TextStyles.label,
    marginTop: Spacing.xs,
  },
  quickActionSubtext: {
    ...TextStyles.caption,
    marginTop: 2,
  },

  // Section
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    ...TextStyles.h4,
  },
  sectionCount: {
    ...TextStyles.caption,
  },

  // List
  listContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: 120,
  },

  // Quiz Card
  quizCard: {
    marginBottom: Spacing.md,
    padding: Spacing.base,
  },
  quizHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.sm,
  },
  quizInfo: {
    flex: 1,
    marginRight: Spacing.sm,
  },
  quizTitle: {
    ...TextStyles.h4,
    marginBottom: 4,
  },
  quizSubject: {
    ...TextStyles.caption,
  },
  aiBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.accent.purple + '15',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
    gap: 4,
  },
  aiBadgeText: {
    color: Colors.accent.purple,
    ...TextStyles.caption,
    fontWeight: Typography.fontWeight.semibold,
  },

  // Meta
  quizMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    ...TextStyles.caption,
  },
  difficultyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
    gap: 4,
  },
  difficultyDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  difficultyText: {
    ...TextStyles.caption,
    fontWeight: Typography.fontWeight.medium,
  },

  // Stats
  quizStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.gray[100],
    borderBottomWidth: 1,
    borderBottomColor: Colors.gray[100],
    marginBottom: Spacing.md,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    ...TextStyles.h4,
  },
  statLabel: {
    ...TextStyles.caption,
    marginTop: 2,
  },

  // Start Button
  startButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    gap: Spacing.xs,
  },
  startButtonText: {
    color: Colors.white,
    ...TextStyles.button,
  },

  // Empty State
  emptyState: {
    alignItems: 'center',
    paddingTop: Spacing['4xl'],
    paddingHorizontal: Spacing.xl,
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
  emptyButtons: {
    gap: Spacing.md,
    width: '100%',
  },
});
