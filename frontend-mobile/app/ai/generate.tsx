/**
 * Study Master - AI Generation Screen
 * Génération de flashcards et quiz par IA depuis les notes
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  Dimensions,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withRepeat,
  withSequence,
  withTiming,
  FadeIn,
  FadeInDown,
  FadeInUp,
  ZoomIn,
  Easing,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { useTheme } from '@/hooks/useTheme';
import api from '@/services/api';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Spark } from '@/components/mascot/Spark';
import {
  Colors,
  Spacing,
  BorderRadius,
  Typography,
  TextStyles,
  Shadows,
} from '@/constants/theme';
import type { Note, Subject, Flashcard, Quiz, QuizDifficulty } from '@/types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type GenerationType = 'flashcards' | 'quiz';
type DifficultyLevel = 'easy' | 'medium' | 'hard';

// ============================================
// GENERATION TYPE SELECTOR
// ============================================

interface TypeSelectorProps {
  selected: GenerationType;
  onSelect: (type: GenerationType) => void;
}

function TypeSelector({ selected, onSelect }: TypeSelectorProps) {
  const { colors } = useTheme();

  const types: { type: GenerationType; icon: string; label: string; description: string }[] = [
    {
      type: 'flashcards',
      icon: 'albums',
      label: 'Flashcards',
      description: 'Créer des cartes de révision',
    },
    {
      type: 'quiz',
      icon: 'help-circle',
      label: 'Quiz',
      description: 'Générer un questionnaire',
    },
  ];

  return (
    <View style={styles.typeSelector}>
      {types.map((item, index) => {
        const isSelected = selected === item.type;
        return (
          <Animated.View
            key={item.type}
            entering={FadeInDown.delay(index * 100).springify()}
          >
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                onSelect(item.type);
              }}
              style={[
                styles.typeCard,
                {
                  backgroundColor: isSelected ? colors.primary + '15' : colors.card,
                  borderColor: isSelected ? colors.primary : colors.border,
                },
              ]}
            >
              <LinearGradient
                colors={
                  isSelected
                    ? [Colors.accent.purple, Colors.primary[500]]
                    : [colors.surfaceVariant, colors.surfaceVariant]
                }
                style={styles.typeIconContainer}
              >
                <Ionicons
                  name={item.icon as any}
                  size={28}
                  color={isSelected ? Colors.white : colors.textSecondary}
                />
              </LinearGradient>
              <Text style={[styles.typeLabel, { color: colors.text }]}>
                {item.label}
              </Text>
              <Text style={[styles.typeDescription, { color: colors.textSecondary }]}>
                {item.description}
              </Text>
              {isSelected && (
                <View style={[styles.typeCheckmark, { backgroundColor: colors.primary }]}>
                  <Ionicons name="checkmark" size={14} color={Colors.white} />
                </View>
              )}
            </Pressable>
          </Animated.View>
        );
      })}
    </View>
  );
}

// ============================================
// DIFFICULTY SELECTOR
// ============================================

interface DifficultySelectorProps {
  selected: DifficultyLevel;
  onSelect: (level: DifficultyLevel) => void;
}

function DifficultySelector({ selected, onSelect }: DifficultySelectorProps) {
  const { colors } = useTheme();

  const levels: { level: DifficultyLevel; label: string; color: string }[] = [
    { level: 'easy', label: 'Facile', color: Colors.accent.green },
    { level: 'medium', label: 'Moyen', color: Colors.accent.orange },
    { level: 'hard', label: 'Difficile', color: Colors.accent.red },
  ];

  return (
    <View style={styles.difficultyContainer}>
      <Text style={[styles.sectionTitle, { color: colors.text }]}>Difficulté</Text>
      <View style={styles.difficultyButtons}>
        {levels.map((item) => {
          const isSelected = selected === item.level;
          return (
            <Pressable
              key={item.level}
              onPress={() => {
                Haptics.selectionAsync();
                onSelect(item.level);
              }}
              style={[
                styles.difficultyButton,
                {
                  backgroundColor: isSelected ? item.color + '20' : colors.card,
                  borderColor: isSelected ? item.color : colors.border,
                },
              ]}
            >
              <View style={[styles.difficultyDot, { backgroundColor: item.color }]} />
              <Text
                style={[
                  styles.difficultyLabel,
                  { color: isSelected ? item.color : colors.textSecondary },
                ]}
              >
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

// ============================================
// COUNT SELECTOR
// ============================================

interface CountSelectorProps {
  count: number;
  min: number;
  max: number;
  label: string;
  onCountChange: (count: number) => void;
}

function CountSelector({ count, min, max, label, onCountChange }: CountSelectorProps) {
  const { colors } = useTheme();

  return (
    <View style={styles.countContainer}>
      <Text style={[styles.sectionTitle, { color: colors.text }]}>{label}</Text>
      <View style={styles.countRow}>
        <Pressable
          onPress={() => {
            if (count > min) {
              Haptics.selectionAsync();
              onCountChange(count - 1);
            }
          }}
          disabled={count <= min}
          style={[
            styles.countButton,
            {
              backgroundColor: colors.surfaceVariant,
              opacity: count <= min ? 0.5 : 1,
            },
          ]}
        >
          <Ionicons name="remove" size={24} color={colors.text} />
        </Pressable>

        <View style={[styles.countDisplay, { backgroundColor: colors.card }]}>
          <Text style={[styles.countValue, { color: colors.text }]}>{count}</Text>
        </View>

        <Pressable
          onPress={() => {
            if (count < max) {
              Haptics.selectionAsync();
              onCountChange(count + 1);
            }
          }}
          disabled={count >= max}
          style={[
            styles.countButton,
            {
              backgroundColor: colors.surfaceVariant,
              opacity: count >= max ? 0.5 : 1,
            },
          ]}
        >
          <Ionicons name="add" size={24} color={colors.text} />
        </Pressable>
      </View>
    </View>
  );
}

// ============================================
// NOTE SELECTOR
// ============================================

interface NoteSelectorProps {
  notes: Note[];
  selectedNote: Note | null;
  onSelectNote: (note: Note) => void;
}

function NoteSelector({ notes, selectedNote, onSelectNote }: NoteSelectorProps) {
  const { colors } = useTheme();

  return (
    <View style={styles.noteSelector}>
      <Text style={[styles.sectionTitle, { color: colors.text }]}>
        Sélectionnez une note
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.notesScroll}
      >
        {notes.map((note, index) => {
          const isSelected = selectedNote?.id === note.id;
          return (
            <Animated.View
              key={note.id}
              entering={FadeInUp.delay(index * 50).springify()}
            >
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  onSelectNote(note);
                }}
                style={[
                  styles.noteCard,
                  {
                    backgroundColor: isSelected ? colors.primary + '15' : colors.card,
                    borderColor: isSelected ? colors.primary : colors.border,
                  },
                ]}
              >
                <View
                  style={[
                    styles.noteColorBar,
                    { backgroundColor: note.subject?.color || Colors.primary[500] },
                  ]}
                />
                <Text
                  style={[styles.noteTitle, { color: colors.text }]}
                  numberOfLines={2}
                >
                  {note.title}
                </Text>
                <Text style={[styles.noteSubject, { color: colors.textSecondary }]}>
                  {note.subject?.name || 'Sans matière'}
                </Text>
                {isSelected && (
                  <View style={[styles.noteCheckmark, { backgroundColor: colors.primary }]}>
                    <Ionicons name="checkmark" size={12} color={Colors.white} />
                  </View>
                )}
              </Pressable>
            </Animated.View>
          );
        })}
      </ScrollView>
    </View>
  );
}

// ============================================
// GENERATING ANIMATION
// ============================================

interface GeneratingViewProps {
  type: GenerationType;
}

function GeneratingView({ type }: GeneratingViewProps) {
  const { colors } = useTheme();
  const rotation = useSharedValue(0);
  const scale = useSharedValue(1);
  const sparkle1 = useSharedValue(0);
  const sparkle2 = useSharedValue(0);

  useEffect(() => {
    rotation.value = withRepeat(
      withTiming(360, { duration: 3000, easing: Easing.linear }),
      -1,
      false
    );
    scale.value = withRepeat(
      withSequence(
        withTiming(1.1, { duration: 1000 }),
        withTiming(1, { duration: 1000 })
      ),
      -1,
      true
    );
    sparkle1.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 500 }),
        withTiming(0, { duration: 500 })
      ),
      -1,
      true
    );
    sparkle2.value = withRepeat(
      withSequence(
        withTiming(0, { duration: 300 }),
        withTiming(1, { duration: 500 }),
        withTiming(0, { duration: 500 })
      ),
      -1,
      true
    );
  }, []);

  const rotationStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  const scaleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const sparkle1Style = useAnimatedStyle(() => ({
    opacity: sparkle1.value,
    transform: [{ scale: sparkle1.value }],
  }));

  const sparkle2Style = useAnimatedStyle(() => ({
    opacity: sparkle2.value,
    transform: [{ scale: sparkle2.value }],
  }));

  return (
    <View style={styles.generatingContainer}>
      {/* Background glow */}
      <LinearGradient
        colors={[Colors.accent.purple + '30', Colors.primary[500] + '20', 'transparent']}
        style={styles.generatingGlow}
      />

      {/* Sparkles */}
      <Animated.View style={[styles.sparkle, styles.sparkle1, sparkle1Style]}>
        <Ionicons name="sparkles" size={24} color={Colors.accent.gold} />
      </Animated.View>
      <Animated.View style={[styles.sparkle, styles.sparkle2, sparkle2Style]}>
        <Ionicons name="sparkles" size={20} color={Colors.accent.purple} />
      </Animated.View>
      <Animated.View style={[styles.sparkle, styles.sparkle3, sparkle1Style]}>
        <Ionicons name="star" size={16} color={Colors.accent.orange} />
      </Animated.View>

      {/* Main animation */}
      <Animated.View style={scaleStyle}>
        <Spark size={120} mood="thinking" level={3} animated />
      </Animated.View>

      {/* Loading ring */}
      <Animated.View style={[styles.loadingRing, rotationStyle]}>
        <LinearGradient
          colors={[Colors.accent.purple, Colors.primary[500], 'transparent']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.loadingRingGradient}
        />
      </Animated.View>

      <Animated.View entering={FadeIn.delay(300)} style={styles.generatingText}>
        <Text style={[styles.generatingTitle, { color: colors.text }]}>
          Spark réfléchit...
        </Text>
        <Text style={[styles.generatingSubtitle, { color: colors.textSecondary }]}>
          {type === 'flashcards'
            ? 'Création de vos flashcards intelligentes'
            : 'Génération de votre quiz personnalisé'}
        </Text>
      </Animated.View>
    </View>
  );
}

// ============================================
// SUCCESS VIEW
// ============================================

interface SuccessViewProps {
  type: GenerationType;
  count: number;
  onView: () => void;
  onGenerateMore: () => void;
}

function SuccessView({ type, count, onView, onGenerateMore }: SuccessViewProps) {
  const { colors } = useTheme();

  return (
    <Animated.View entering={ZoomIn.springify()} style={styles.successContainer}>
      <LinearGradient
        colors={[Colors.accent.green + '30', colors.background]}
        style={styles.successGradient}
      >
        <Spark size={100} mood="excited" level={4} animated />

        <Text style={[styles.successTitle, { color: colors.text }]}>
          {type === 'flashcards' ? 'Flashcards créées !' : 'Quiz généré !'}
        </Text>

        <View style={[styles.successBadge, { backgroundColor: Colors.accent.green + '20' }]}>
          <Ionicons name="checkmark-circle" size={20} color={Colors.accent.green} />
          <Text style={[styles.successBadgeText, { color: Colors.accent.green }]}>
            {count} {type === 'flashcards' ? 'cartes' : 'questions'} créées
          </Text>
        </View>

        <View style={styles.successActions}>
          <Button
            variant="gradient"
            size="lg"
            fullWidth
            onPress={onView}
            icon={<Ionicons name="eye" size={20} color={Colors.white} />}
          >
            Voir {type === 'flashcards' ? 'les flashcards' : 'le quiz'}
          </Button>

          <Button
            variant="outline"
            size="lg"
            fullWidth
            onPress={onGenerateMore}
            icon={<Ionicons name="add" size={20} color={colors.primary} />}
          >
            Générer d'autres
          </Button>
        </View>
      </LinearGradient>
    </Animated.View>
  );
}

// ============================================
// MAIN SCREEN
// ============================================

export default function AIGenerateScreen() {
  const { colors, isDark } = useTheme();
  const { noteId, subjectId } = useLocalSearchParams<{ noteId?: string; subjectId?: string }>();
  const queryClient = useQueryClient();

  // State
  const [generationType, setGenerationType] = useState<GenerationType>('flashcards');
  const [difficulty, setDifficulty] = useState<DifficultyLevel>('medium');
  const [count, setCount] = useState(5);
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [generatedCount, setGeneratedCount] = useState(0);
  const [generatedId, setGeneratedId] = useState<number | null>(null);

  // Fetch notes
  const { data: notes = [], isLoading: notesLoading } = useQuery({
    queryKey: ['notes', subjectId],
    queryFn: async () => {
      const endpoint = subjectId ? `/notes?subject_id=${subjectId}` : '/notes';
      const response = await api.get<Note[]>(endpoint);
      return response.data;
    },
  });

  // Pre-select note if noteId is provided
  useEffect(() => {
    if (noteId && notes.length > 0) {
      const note = notes.find((n) => n.id.toString() === noteId);
      if (note) setSelectedNote(note);
    }
  }, [noteId, notes]);

  // Generate flashcards mutation
  const generateFlashcardsMutation = useMutation({
    mutationFn: async () => {
      const response = await api.post<Flashcard[]>('/ai/generate-flashcards', {
        note_id: selectedNote?.id,
        count,
        difficulty,
      });
      return response.data;
    },
    onSuccess: (data) => {
      setGeneratedCount(data.length);
      setIsSuccess(true);
      setIsGenerating(false);
      queryClient.invalidateQueries({ queryKey: ['flashcards'] });
      queryClient.invalidateQueries({ queryKey: ['flashcard-decks'] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    onError: () => {
      setIsGenerating(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    },
  });

  // Generate quiz mutation
  const generateQuizMutation = useMutation({
    mutationFn: async () => {
      const response = await api.post<Quiz>('/ai/generate-quiz', {
        note_id: selectedNote?.id,
        question_count: count,
        difficulty,
      });
      return response.data;
    },
    onSuccess: (data) => {
      setGeneratedCount(data.questions?.length || count);
      setGeneratedId(data.id);
      setIsSuccess(true);
      setIsGenerating(false);
      queryClient.invalidateQueries({ queryKey: ['quizzes'] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    onError: () => {
      setIsGenerating(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    },
  });

  // Handle generate
  const handleGenerate = useCallback(() => {
    if (!selectedNote) return;

    setIsGenerating(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    if (generationType === 'flashcards') {
      generateFlashcardsMutation.mutate();
    } else {
      generateQuizMutation.mutate();
    }
  }, [selectedNote, generationType, generateFlashcardsMutation, generateQuizMutation]);

  // Handle view generated content
  const handleView = useCallback(() => {
    if (generationType === 'flashcards') {
      router.push(`/flashcards/deck/${selectedNote?.subject_id}`);
    } else if (generatedId) {
      router.push(`/quiz/play/${generatedId}`);
    }
  }, [generationType, selectedNote, generatedId]);

  // Reset for generating more
  const handleGenerateMore = useCallback(() => {
    setIsSuccess(false);
    setGeneratedId(null);
  }, []);

  // Generating state
  if (isGenerating) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <GeneratingView type={generationType} />
      </SafeAreaView>
    );
  }

  // Success state
  if (isSuccess) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <SuccessView
          type={generationType}
          count={generatedCount}
          onView={handleView}
          onGenerateMore={handleGenerateMore}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: colors.text }]}>
            Génération IA
          </Text>
          <View style={styles.aiBadge}>
            <Ionicons name="sparkles" size={16} color={Colors.accent.purple} />
          </View>
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Spark Introduction */}
          <Animated.View entering={FadeInDown.springify()} style={styles.introSection}>
            <Spark size={80} mood="helpful" level={3} />
            <View style={styles.introText}>
              <Text style={[styles.introTitle, { color: colors.text }]}>
                Bonjour ! Je suis Spark
              </Text>
              <Text style={[styles.introSubtitle, { color: colors.textSecondary }]}>
                Je peux créer des flashcards ou quiz à partir de vos notes
              </Text>
            </View>
          </Animated.View>

          {/* Type Selector */}
          <TypeSelector selected={generationType} onSelect={setGenerationType} />

          {/* Note Selector */}
          {notesLoading ? (
            <View style={styles.loadingNotes}>
              <ActivityIndicator color={colors.primary} />
              <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
                Chargement des notes...
              </Text>
            </View>
          ) : notes.length > 0 ? (
            <NoteSelector
              notes={notes}
              selectedNote={selectedNote}
              onSelectNote={setSelectedNote}
            />
          ) : (
            <Card style={styles.noNotesCard}>
              <Ionicons name="document-text-outline" size={40} color={colors.textTertiary} />
              <Text style={[styles.noNotesText, { color: colors.textSecondary }]}>
                Aucune note disponible.{'\n'}Créez une note pour commencer !
              </Text>
              <Button
                variant="primary"
                size="sm"
                onPress={() => router.push('/notes/create')}
              >
                Créer une note
              </Button>
            </Card>
          )}

          {/* Options */}
          {selectedNote && (
            <Animated.View entering={FadeInUp.delay(200).springify()}>
              {/* Difficulty */}
              <DifficultySelector selected={difficulty} onSelect={setDifficulty} />

              {/* Count */}
              <CountSelector
                count={count}
                min={3}
                max={generationType === 'flashcards' ? 20 : 15}
                label={generationType === 'flashcards' ? 'Nombre de cartes' : 'Nombre de questions'}
                onCountChange={setCount}
              />

              {/* Selected Note Preview */}
              <View style={styles.selectedNotePreview}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>
                  Note sélectionnée
                </Text>
                <Card variant="elevated" style={styles.previewCard}>
                  <View
                    style={[
                      styles.previewColorBar,
                      { backgroundColor: selectedNote.subject?.color || Colors.primary[500] },
                    ]}
                  />
                  <View style={styles.previewContent}>
                    <Text style={[styles.previewTitle, { color: colors.text }]}>
                      {selectedNote.title}
                    </Text>
                    <Text
                      style={[styles.previewExcerpt, { color: colors.textSecondary }]}
                      numberOfLines={2}
                    >
                      {selectedNote.content.substring(0, 150)}...
                    </Text>
                  </View>
                </Card>
              </View>
            </Animated.View>
          )}
        </ScrollView>

        {/* Generate Button */}
        <View style={[styles.footer, { borderTopColor: colors.border }]}>
          <Button
            variant="gradient"
            size="lg"
            fullWidth
            onPress={handleGenerate}
            disabled={!selectedNote}
            icon={<Ionicons name="sparkles" size={20} color={Colors.white} />}
          >
            Générer {generationType === 'flashcards' ? `${count} flashcards` : `${count} questions`}
          </Button>
        </View>
      </KeyboardAvoidingView>
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
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    ...TextStyles.h3,
    flex: 1,
  },
  aiBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.accent.purple + '20',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Scroll
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xl,
  },

  // Intro
  introSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginBottom: Spacing.xl,
    padding: Spacing.md,
  },
  introText: {
    flex: 1,
  },
  introTitle: {
    ...TextStyles.h4,
  },
  introSubtitle: {
    ...TextStyles.bodySmall,
    marginTop: 2,
  },

  // Type Selector
  typeSelector: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginBottom: Spacing.xl,
  },
  typeCard: {
    flex: 1,
    padding: Spacing.base,
    borderRadius: BorderRadius.xl,
    borderWidth: 2,
    alignItems: 'center',
    position: 'relative',
  },
  typeIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  typeLabel: {
    ...TextStyles.label,
    fontWeight: Typography.fontWeight.semibold,
  },
  typeDescription: {
    ...TextStyles.caption,
    textAlign: 'center',
    marginTop: 2,
  },
  typeCheckmark: {
    position: 'absolute',
    top: Spacing.sm,
    right: Spacing.sm,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Note Selector
  noteSelector: {
    marginBottom: Spacing.xl,
  },
  sectionTitle: {
    ...TextStyles.label,
    marginBottom: Spacing.md,
  },
  notesScroll: {
    paddingRight: Spacing.lg,
    gap: Spacing.md,
  },
  noteCard: {
    width: 160,
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 2,
    position: 'relative',
    overflow: 'hidden',
  },
  noteColorBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 4,
  },
  noteTitle: {
    ...TextStyles.label,
    marginTop: Spacing.xs,
    marginBottom: 4,
  },
  noteSubject: {
    ...TextStyles.caption,
  },
  noteCheckmark: {
    position: 'absolute',
    top: Spacing.sm,
    right: Spacing.sm,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingNotes: {
    alignItems: 'center',
    padding: Spacing.xl,
    gap: Spacing.md,
  },
  loadingText: {
    ...TextStyles.body,
  },
  noNotesCard: {
    alignItems: 'center',
    padding: Spacing.xl,
    gap: Spacing.md,
    marginBottom: Spacing.xl,
  },
  noNotesText: {
    ...TextStyles.body,
    textAlign: 'center',
  },

  // Difficulty
  difficultyContainer: {
    marginBottom: Spacing.xl,
  },
  difficultyButtons: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  difficultyButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 2,
    gap: Spacing.xs,
  },
  difficultyDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  difficultyLabel: {
    ...TextStyles.label,
  },

  // Count
  countContainer: {
    marginBottom: Spacing.xl,
  },
  countRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  countButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countDisplay: {
    flex: 1,
    height: 48,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countValue: {
    ...TextStyles.h2,
  },

  // Preview
  selectedNotePreview: {
    marginBottom: Spacing.xl,
  },
  previewCard: {
    flexDirection: 'row',
    overflow: 'hidden',
    padding: 0,
  },
  previewColorBar: {
    width: 6,
  },
  previewContent: {
    flex: 1,
    padding: Spacing.base,
  },
  previewTitle: {
    ...TextStyles.label,
    fontWeight: Typography.fontWeight.semibold,
  },
  previewExcerpt: {
    ...TextStyles.caption,
    marginTop: 4,
  },

  // Footer
  footer: {
    padding: Spacing.lg,
    borderTopWidth: 1,
  },

  // Generating
  generatingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  generatingGlow: {
    position: 'absolute',
    width: 300,
    height: 300,
    borderRadius: 150,
  },
  sparkle: {
    position: 'absolute',
  },
  sparkle1: {
    top: '25%',
    left: '20%',
  },
  sparkle2: {
    top: '30%',
    right: '25%',
  },
  sparkle3: {
    bottom: '35%',
    left: '30%',
  },
  loadingRing: {
    position: 'absolute',
    width: 160,
    height: 160,
  },
  loadingRingGradient: {
    width: '100%',
    height: '100%',
    borderRadius: 80,
    borderWidth: 3,
    borderColor: 'transparent',
  },
  generatingText: {
    alignItems: 'center',
    marginTop: Spacing['2xl'],
  },
  generatingTitle: {
    ...TextStyles.h3,
  },
  generatingSubtitle: {
    ...TextStyles.body,
    textAlign: 'center',
    marginTop: Spacing.xs,
  },

  // Success
  successContainer: {
    flex: 1,
  },
  successGradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
    gap: Spacing.lg,
  },
  successTitle: {
    ...TextStyles.h1,
    textAlign: 'center',
  },
  successBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    gap: Spacing.sm,
  },
  successBadgeText: {
    ...TextStyles.label,
    fontWeight: Typography.fontWeight.semibold,
  },
  successActions: {
    width: '100%',
    gap: Spacing.md,
    marginTop: Spacing.xl,
  },
});
