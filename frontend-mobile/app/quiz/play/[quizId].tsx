/**
 * Study Master - Quiz Play Screen
 * Interface de quiz interactive avec animations et feedback
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Dimensions,
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
  withDelay,
  runOnJS,
  FadeIn,
  FadeInDown,
  FadeInUp,
  FadeOut,
  SlideInRight,
  ZoomIn,
  interpolateColor,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import ConfettiCannon from 'react-native-confetti-cannon';

import { useTheme } from '@/hooks/useTheme';
import api from '@/services/api';
import { Button } from '@/components/ui/Button';
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
import type { Quiz, QuizQuestion, QuizAttempt } from '@/types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ============================================
// OPTION COMPONENT
// ============================================

interface OptionProps {
  option: string;
  index: number;
  isSelected: boolean;
  isCorrect: boolean | null;
  showResult: boolean;
  onSelect: () => void;
  disabled: boolean;
}

function Option({
  option,
  index,
  isSelected,
  isCorrect,
  showResult,
  onSelect,
  disabled,
}: OptionProps) {
  const { colors } = useTheme();
  const scale = useSharedValue(1);
  const shake = useSharedValue(0);

  const letters = ['A', 'B', 'C', 'D', 'E', 'F'];

  useEffect(() => {
    if (showResult && isSelected && isCorrect === false) {
      // Shake animation for wrong answer
      shake.value = withSequence(
        withTiming(-10, { duration: 50 }),
        withTiming(10, { duration: 50 }),
        withTiming(-10, { duration: 50 }),
        withTiming(10, { duration: 50 }),
        withTiming(0, { duration: 50 })
      );
    }
  }, [showResult, isSelected, isCorrect]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: scale.value },
      { translateX: shake.value },
    ],
  }));

  const getBorderColor = () => {
    if (!showResult) {
      return isSelected ? colors.primary : colors.border;
    }
    if (isCorrect === true) return Colors.accent.green;
    if (isSelected && isCorrect === false) return Colors.accent.red;
    return colors.border;
  };

  const getBackgroundColor = () => {
    if (!showResult) {
      return isSelected ? colors.primary + '15' : colors.card;
    }
    if (isCorrect === true) return Colors.accent.green + '15';
    if (isSelected && isCorrect === false) return Colors.accent.red + '15';
    return colors.card;
  };

  const getIcon = () => {
    if (!showResult) return null;
    if (isCorrect === true) {
      return <Ionicons name="checkmark-circle" size={24} color={Colors.accent.green} />;
    }
    if (isSelected && isCorrect === false) {
      return <Ionicons name="close-circle" size={24} color={Colors.accent.red} />;
    }
    return null;
  };

  return (
    <Animated.View
      entering={FadeInUp.delay(index * 100).springify()}
      style={animatedStyle}
    >
      <Pressable
        onPress={() => {
          if (disabled) return;
          scale.value = withSequence(
            withSpring(0.95),
            withSpring(1)
          );
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onSelect();
        }}
        disabled={disabled}
        style={[
          styles.option,
          {
            backgroundColor: getBackgroundColor(),
            borderColor: getBorderColor(),
            opacity: disabled && !isSelected && !showResult ? 0.6 : 1,
          },
        ]}
      >
        <View style={[styles.optionLetter, { backgroundColor: getBorderColor() + '30' }]}>
          <Text style={[styles.optionLetterText, { color: getBorderColor() }]}>
            {letters[index]}
          </Text>
        </View>

        <Text style={[styles.optionText, { color: colors.text }]} numberOfLines={3}>
          {option}
        </Text>

        {getIcon()}
      </Pressable>
    </Animated.View>
  );
}

// ============================================
// QUESTION COMPONENT
// ============================================

interface QuestionViewProps {
  question: QuizQuestion;
  questionNumber: number;
  totalQuestions: number;
  selectedAnswer: string | null;
  showResult: boolean;
  onSelectAnswer: (answer: string) => void;
}

function QuestionView({
  question,
  questionNumber,
  totalQuestions,
  selectedAnswer,
  showResult,
  onSelectAnswer,
}: QuestionViewProps) {
  const { colors } = useTheme();

  const isCorrectAnswer = (option: string) => {
    if (!showResult) return null;
    return option === question.correct_answer;
  };

  return (
    <View style={styles.questionContainer}>
      {/* Question Header */}
      <Animated.View entering={FadeInDown.springify()}>
        <View style={styles.questionHeader}>
          <Text style={[styles.questionNumber, { color: colors.textSecondary }]}>
            Question {questionNumber}/{totalQuestions}
          </Text>
          <View style={[styles.pointsBadge, { backgroundColor: Colors.accent.gold + '20' }]}>
            <Ionicons name="star" size={14} color={Colors.accent.gold} />
            <Text style={[styles.pointsText, { color: Colors.accent.gold }]}>
              {question.points} pts
            </Text>
          </View>
        </View>

        <Text style={[styles.questionText, { color: colors.text }]}>
          {question.question}
        </Text>
      </Animated.View>

      {/* Options */}
      <View style={styles.optionsContainer}>
        {question.question_type === 'true_false' ? (
          <>
            <Option
              option="Vrai"
              index={0}
              isSelected={selectedAnswer === 'Vrai'}
              isCorrect={isCorrectAnswer('Vrai')}
              showResult={showResult}
              onSelect={() => onSelectAnswer('Vrai')}
              disabled={showResult}
            />
            <Option
              option="Faux"
              index={1}
              isSelected={selectedAnswer === 'Faux'}
              isCorrect={isCorrectAnswer('Faux')}
              showResult={showResult}
              onSelect={() => onSelectAnswer('Faux')}
              disabled={showResult}
            />
          </>
        ) : (
          question.options?.map((option, index) => (
            <Option
              key={index}
              option={option}
              index={index}
              isSelected={selectedAnswer === option}
              isCorrect={isCorrectAnswer(option)}
              showResult={showResult}
              onSelect={() => onSelectAnswer(option)}
              disabled={showResult}
            />
          ))
        )}
      </View>

      {/* Explanation */}
      {showResult && question.explanation && (
        <Animated.View
          entering={FadeInUp.delay(500).springify()}
          style={[styles.explanationCard, { backgroundColor: colors.surfaceVariant }]}
        >
          <Ionicons name="information-circle" size={20} color={Colors.primary[500]} />
          <Text style={[styles.explanationText, { color: colors.text }]}>
            {question.explanation}
          </Text>
        </Animated.View>
      )}
    </View>
  );
}

// ============================================
// TIMER COMPONENT
// ============================================

interface TimerProps {
  timeLeft: number;
  totalTime: number;
  isPaused: boolean;
}

function Timer({ timeLeft, totalTime, isPaused }: TimerProps) {
  const { colors } = useTheme();
  const progress = totalTime > 0 ? timeLeft / totalTime : 1;
  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;

  const isLow = timeLeft <= 60;
  const isCritical = timeLeft <= 30;

  return (
    <View style={styles.timerContainer}>
      <Ionicons
        name={isPaused ? 'pause' : 'time'}
        size={18}
        color={isCritical ? Colors.accent.red : isLow ? Colors.accent.orange : colors.textSecondary}
      />
      <Text
        style={[
          styles.timerText,
          {
            color: isCritical
              ? Colors.accent.red
              : isLow
                ? Colors.accent.orange
                : colors.textSecondary,
          },
        ]}
      >
        {minutes.toString().padStart(2, '0')}:{seconds.toString().padStart(2, '0')}
      </Text>
    </View>
  );
}

// ============================================
// RESULTS SCREEN
// ============================================

interface ResultsProps {
  quiz: Quiz;
  score: number;
  totalPoints: number;
  correctAnswers: number;
  timeTaken: number;
  answers: Record<number, string>;
  onRetry: () => void;
  onExit: () => void;
}

function Results({
  quiz,
  score,
  totalPoints,
  correctAnswers,
  timeTaken,
  answers,
  onRetry,
  onExit,
}: ResultsProps) {
  const { colors } = useTheme();
  const confettiRef = useRef<any>(null);

  const percentage = Math.round((score / totalPoints) * 100);
  const passed = percentage >= quiz.passing_score;
  const isPerfect = percentage === 100;

  const sparkMood = isPerfect
    ? 'excited'
    : passed
      ? 'happy'
      : percentage >= 50
        ? 'encouraging'
        : 'sad';

  const xpEarned = Math.round(score * 2) + (passed ? 20 : 0) + (isPerfect ? 50 : 0);

  useEffect(() => {
    if (passed && confettiRef.current) {
      setTimeout(() => confettiRef.current?.start(), 500);
    }
  }, [passed]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <SafeAreaView style={[styles.resultsContainer, { backgroundColor: colors.background }]}>
      {passed && (
        <ConfettiCannon
          ref={confettiRef}
          count={100}
          origin={{ x: SCREEN_WIDTH / 2, y: -20 }}
          autoStart={false}
          fadeOut
        />
      )}

      <ScrollView contentContainerStyle={styles.resultsScroll}>
        <LinearGradient
          colors={
            isPerfect
              ? [Colors.accent.gold + '40', Colors.accent.green + '20', colors.background]
              : passed
                ? [Colors.accent.green + '30', colors.background]
                : [Colors.accent.orange + '20', colors.background]
          }
          style={styles.resultsGradient}
        >
          {/* Mascot */}
          <Animated.View entering={ZoomIn.delay(200).springify()}>
            <Spark size={100} mood={sparkMood} level={isPerfect ? 5 : passed ? 3 : 2} animated />
          </Animated.View>

          {/* Score Circle */}
          <Animated.View entering={FadeInDown.delay(400).springify()} style={styles.scoreCircle}>
            <LinearGradient
              colors={
                isPerfect
                  ? [Colors.accent.gold, Colors.accent.orange]
                  : passed
                    ? [Colors.accent.green, Colors.accent.greenLight]
                    : [Colors.accent.orange, Colors.accent.orangeLight]
              }
              style={styles.scoreCircleGradient}
            >
              <Text style={styles.scorePercentage}>{percentage}%</Text>
              <Text style={styles.scoreLabel}>
                {score}/{totalPoints} pts
              </Text>
            </LinearGradient>
          </Animated.View>

          {/* Message */}
          <Animated.View entering={FadeInDown.delay(600).springify()}>
            <Text style={[styles.resultsTitle, { color: colors.text }]}>
              {isPerfect
                ? 'Parfait ! 🏆'
                : passed
                  ? 'Bien joué ! 🎉'
                  : percentage >= 50
                    ? 'Pas mal ! 💪'
                    : 'Continuez à étudier ! 📚'}
            </Text>
            <Text style={[styles.resultsSubtitle, { color: colors.textSecondary }]}>
              {passed
                ? 'Vous avez réussi ce quiz !'
                : `Il faut ${quiz.passing_score}% pour réussir`}
            </Text>
          </Animated.View>

          {/* Stats Grid */}
          <Animated.View entering={FadeInDown.delay(800).springify()} style={styles.statsRow}>
            <View style={[styles.resultStatCard, { backgroundColor: colors.card }]}>
              <Ionicons name="checkmark-circle" size={24} color={Colors.accent.green} />
              <Text style={[styles.resultStatValue, { color: colors.text }]}>
                {correctAnswers}/{quiz.questions?.length || 0}
              </Text>
              <Text style={[styles.resultStatLabel, { color: colors.textSecondary }]}>
                Correct
              </Text>
            </View>

            <View style={[styles.resultStatCard, { backgroundColor: colors.card }]}>
              <Ionicons name="time" size={24} color={Colors.primary[500]} />
              <Text style={[styles.resultStatValue, { color: colors.text }]}>
                {formatTime(timeTaken)}
              </Text>
              <Text style={[styles.resultStatLabel, { color: colors.textSecondary }]}>
                Temps
              </Text>
            </View>

            <View style={[styles.resultStatCard, { backgroundColor: colors.card }]}>
              <Ionicons name="star" size={24} color={Colors.accent.gold} />
              <Text style={[styles.resultStatValue, { color: colors.text }]}>
                +{xpEarned}
              </Text>
              <Text style={[styles.resultStatLabel, { color: colors.textSecondary }]}>
                XP
              </Text>
            </View>
          </Animated.View>

          {/* Actions */}
          <Animated.View entering={FadeInDown.delay(1000).springify()} style={styles.resultsActions}>
            {!passed && (
              <Button
                variant="gradient"
                size="lg"
                fullWidth
                onPress={onRetry}
                icon={<Ionicons name="refresh" size={20} color={Colors.white} />}
              >
                Réessayer
              </Button>
            )}

            <Button
              variant={passed ? 'gradient' : 'outline'}
              size="lg"
              fullWidth
              onPress={onExit}
              icon={<Ionicons name={passed ? 'checkmark' : 'arrow-back'} size={20} color={passed ? Colors.white : colors.primary} />}
            >
              {passed ? 'Terminer' : 'Retour'}
            </Button>
          </Animated.View>
        </LinearGradient>
      </ScrollView>
    </SafeAreaView>
  );
}

// ============================================
// MAIN SCREEN
// ============================================

export default function QuizPlayScreen() {
  const { colors, isDark } = useTheme();
  const { quizId } = useLocalSearchParams<{ quizId: string }>();
  const queryClient = useQueryClient();

  // State
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [showResult, setShowResult] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const [timeTaken, setTimeTaken] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const startTimeRef = useRef(Date.now());

  // Fetch quiz
  const { data: quiz, isLoading, error } = useQuery({
    queryKey: ['quiz', quizId],
    queryFn: async () => {
      const response = await api.get<Quiz>(`/quizzes/${quizId}`);
      return response.data;
    },
  });

  // Submit quiz mutation
  const submitMutation = useMutation({
    mutationFn: async (data: { answers: Record<number, string>; time_taken: number }) => {
      const response = await api.post<QuizAttempt>(`/quizzes/${quizId}/submit`, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quiz-attempts'] });
      queryClient.invalidateQueries({ queryKey: ['user-stats'] });
    },
  });

  // Initialize timer
  useEffect(() => {
    if (quiz?.is_timed && quiz.time_limit_minutes) {
      setTimeLeft(quiz.time_limit_minutes * 60);
    }
  }, [quiz]);

  // Timer countdown
  useEffect(() => {
    if (!quiz?.is_timed || isPaused || isFinished || timeLeft <= 0) return;

    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          handleFinish();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [quiz?.is_timed, isPaused, isFinished]);

  const questions = quiz?.questions || quiz?.questions_data || [];
  const currentQ = questions[currentQuestion];
  const totalQuestions = questions.length;

  // Calculate score
  const calculateScore = useCallback(() => {
    let score = 0;
    let correct = 0;

    questions.forEach((q, index) => {
      const answer = answers[index];
      if (answer === q.correct_answer) {
        score += q.points || 1;
        correct++;
      }
    });

    const totalPoints = questions.reduce((sum, q) => sum + (q.points || 1), 0);
    return { score, totalPoints, correct };
  }, [questions, answers]);

  // Handle answer selection
  const handleSelectAnswer = useCallback((answer: string) => {
    if (showResult) return;

    setAnswers((prev) => ({ ...prev, [currentQuestion]: answer }));
    setShowResult(true);

    Haptics.impactAsync(
      answer === currentQ?.correct_answer
        ? Haptics.ImpactFeedbackStyle.Medium
        : Haptics.ImpactFeedbackStyle.Heavy
    );
  }, [currentQuestion, currentQ, showResult]);

  // Handle next question
  const handleNext = useCallback(() => {
    if (currentQuestion < totalQuestions - 1) {
      setCurrentQuestion((prev) => prev + 1);
      setShowResult(false);
    } else {
      handleFinish();
    }
  }, [currentQuestion, totalQuestions]);

  // Handle finish
  const handleFinish = useCallback(() => {
    const elapsed = Math.round((Date.now() - startTimeRef.current) / 1000);
    setTimeTaken(elapsed);
    setIsFinished(true);

    submitMutation.mutate({
      answers,
      time_taken: elapsed,
    });
  }, [answers, submitMutation]);

  // Handle retry
  const handleRetry = useCallback(() => {
    setCurrentQuestion(0);
    setAnswers({});
    setShowResult(false);
    setIsFinished(false);
    startTimeRef.current = Date.now();

    if (quiz?.is_timed && quiz.time_limit_minutes) {
      setTimeLeft(quiz.time_limit_minutes * 60);
    }
  }, [quiz]);

  // Loading state
  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
            Chargement du quiz...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // Error state
  if (error || !quiz) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={60} color={Colors.accent.red} />
          <Text style={[styles.errorTitle, { color: colors.text }]}>
            Erreur de chargement
          </Text>
          <Button variant="primary" onPress={() => router.back()}>
            Retour
          </Button>
        </View>
      </SafeAreaView>
    );
  }

  // Results screen
  if (isFinished) {
    const { score, totalPoints, correct } = calculateScore();
    return (
      <Results
        quiz={quiz}
        score={score}
        totalPoints={totalPoints}
        correctAnswers={correct}
        timeTaken={timeTaken}
        answers={answers}
        onRetry={handleRetry}
        onExit={() => router.back()}
      />
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.closeButton}>
          <Ionicons name="close" size={24} color={colors.text} />
        </Pressable>

        {/* Progress Bar */}
        <View style={styles.progressContainer}>
          <View style={[styles.progressBarBg, { backgroundColor: colors.surfaceVariant }]}>
            <View
              style={[
                styles.progressBarFill,
                {
                  width: `${((currentQuestion + 1) / totalQuestions) * 100}%`,
                  backgroundColor: Colors.primary[500],
                },
              ]}
            />
          </View>
        </View>

        {/* Timer */}
        {quiz.is_timed && (
          <Timer
            timeLeft={timeLeft}
            totalTime={(quiz.time_limit_minutes || 0) * 60}
            isPaused={isPaused}
          />
        )}
      </View>

      {/* Quiz Info */}
      <View style={styles.quizInfo}>
        <Text style={[styles.quizTitle, { color: colors.text }]} numberOfLines={1}>
          {quiz.title}
        </Text>
        {quiz.is_ai_generated && (
          <View style={styles.aiBadge}>
            <Ionicons name="sparkles" size={14} color={Colors.accent.purple} />
            <Text style={[styles.aiBadgeText, { color: Colors.accent.purple }]}>
              Généré par IA
            </Text>
          </View>
        )}
      </View>

      {/* Question */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {currentQ && (
          <QuestionView
            question={currentQ}
            questionNumber={currentQuestion + 1}
            totalQuestions={totalQuestions}
            selectedAnswer={answers[currentQuestion] || null}
            showResult={showResult}
            onSelectAnswer={handleSelectAnswer}
          />
        )}
      </ScrollView>

      {/* Footer */}
      <View style={[styles.footer, { borderTopColor: colors.border }]}>
        {showResult ? (
          <Button
            variant="gradient"
            size="lg"
            fullWidth
            onPress={handleNext}
          >
            {currentQuestion < totalQuestions - 1 ? 'Question suivante' : 'Voir les résultats'}
          </Button>
        ) : (
          <Button
            variant="outline"
            size="lg"
            fullWidth
            onPress={() => {
              // Skip question
              handleSelectAnswer('__SKIPPED__');
            }}
          >
            Passer
          </Button>
        )}
      </View>
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
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    gap: Spacing.md,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressContainer: {
    flex: 1,
  },
  progressBarBg: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },

  // Timer
  timerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.md,
  },
  timerText: {
    ...TextStyles.label,
    fontWeight: Typography.fontWeight.semibold,
    fontVariant: ['tabular-nums'],
  },

  // Quiz Info
  quizInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.sm,
    gap: Spacing.sm,
  },
  quizTitle: {
    ...TextStyles.h4,
    flex: 1,
  },
  aiBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.accent.purple + '20',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
    gap: 4,
  },
  aiBadgeText: {
    ...TextStyles.caption,
    fontWeight: Typography.fontWeight.semibold,
  },

  // Scroll
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xl,
  },

  // Question
  questionContainer: {
    gap: Spacing.lg,
  },
  questionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  questionNumber: {
    ...TextStyles.caption,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  pointsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
    gap: 4,
  },
  pointsText: {
    ...TextStyles.caption,
    fontWeight: Typography.fontWeight.semibold,
  },
  questionText: {
    ...TextStyles.h3,
    marginBottom: Spacing.md,
  },

  // Options
  optionsContainer: {
    gap: Spacing.md,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.base,
    borderRadius: BorderRadius.xl,
    borderWidth: 2,
    gap: Spacing.md,
  },
  optionLetter: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionLetterText: {
    ...TextStyles.label,
    fontWeight: Typography.fontWeight.bold,
  },
  optionText: {
    ...TextStyles.body,
    flex: 1,
  },

  // Explanation
  explanationCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: Spacing.base,
    borderRadius: BorderRadius.lg,
    gap: Spacing.sm,
  },
  explanationText: {
    ...TextStyles.bodySmall,
    flex: 1,
  },

  // Footer
  footer: {
    padding: Spacing.lg,
    borderTopWidth: 1,
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

  // Error
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.lg,
    paddingHorizontal: Spacing.xl,
  },
  errorTitle: {
    ...TextStyles.h3,
    textAlign: 'center',
  },

  // Results
  resultsContainer: {
    flex: 1,
  },
  resultsScroll: {
    flexGrow: 1,
  },
  resultsGradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing['2xl'],
    gap: Spacing.xl,
  },
  scoreCircle: {
    marginVertical: Spacing.lg,
  },
  scoreCircleGradient: {
    width: 150,
    height: 150,
    borderRadius: 75,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.lg,
  },
  scorePercentage: {
    ...TextStyles.statLarge,
    color: Colors.white,
  },
  scoreLabel: {
    ...TextStyles.label,
    color: 'rgba(255, 255, 255, 0.9)',
  },
  resultsTitle: {
    ...TextStyles.h1,
    textAlign: 'center',
  },
  resultsSubtitle: {
    ...TextStyles.body,
    textAlign: 'center',
    marginTop: Spacing.xs,
  },
  statsRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: Spacing.lg,
  },
  resultStatCard: {
    alignItems: 'center',
    padding: Spacing.base,
    borderRadius: BorderRadius.xl,
    minWidth: 90,
    ...Shadows.md,
  },
  resultStatValue: {
    ...TextStyles.h3,
    marginTop: Spacing.xs,
  },
  resultStatLabel: {
    ...TextStyles.caption,
    marginTop: 2,
  },
  resultsActions: {
    width: '100%',
    gap: Spacing.md,
    marginTop: Spacing.xl,
  },
});
