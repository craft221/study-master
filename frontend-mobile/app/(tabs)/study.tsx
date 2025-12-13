/**
 * Study Master - Study Session Screen
 * Écran de session d'étude avec timer Pomodoro
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Vibration,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import Animated, {
  FadeIn,
  FadeInDown,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
  cancelAnimation,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Svg, { Circle } from 'react-native-svg';

import { useTheme } from '@/hooks/useTheme';
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
import { APP_CONFIG } from '@/constants/config';

// ============================================
// TYPES
// ============================================

type SessionType = 'focus' | 'shortBreak' | 'longBreak';

interface SessionConfig {
  duration: number; // en secondes
  label: string;
  color: string;
  gradientColors: string[];
}

// ============================================
// CONFIGURATION
// ============================================

const SESSION_CONFIGS: Record<SessionType, SessionConfig> = {
  focus: {
    duration: APP_CONFIG.studySession.pomodoroMinutes * 60,
    label: 'Focus',
    color: Colors.primary[500],
    gradientColors: [Colors.primary[500], Colors.primary[600]],
  },
  shortBreak: {
    duration: APP_CONFIG.studySession.shortBreakMinutes * 60,
    label: 'Pause courte',
    color: Colors.accent.green,
    gradientColors: [Colors.accent.green, Colors.accent.greenLight],
  },
  longBreak: {
    duration: APP_CONFIG.studySession.longBreakMinutes * 60,
    label: 'Pause longue',
    color: Colors.accent.purple,
    gradientColors: [Colors.accent.purple, Colors.accent.purpleLight],
  },
};

// ============================================
// CIRCULAR PROGRESS
// ============================================

interface CircularProgressProps {
  progress: number;
  size: number;
  strokeWidth: number;
  color: string;
}

function CircularProgress({ progress, size, strokeWidth, color }: CircularProgressProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const strokeDashoffset = circumference * (1 - progress);

  return (
    <Svg width={size} height={size} style={styles.progressCircle}>
      {/* Background circle */}
      <Circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        stroke="rgba(255, 255, 255, 0.2)"
        strokeWidth={strokeWidth}
        fill="transparent"
      />
      {/* Progress circle */}
      <Circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        stroke={color}
        strokeWidth={strokeWidth}
        fill="transparent"
        strokeDasharray={`${circumference} ${circumference}`}
        strokeDashoffset={strokeDashoffset}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
    </Svg>
  );
}

// ============================================
// MAIN SCREEN
// ============================================

export default function StudyScreen() {
  const { colors, isDark } = useTheme();

  // État du timer
  const [sessionType, setSessionType] = useState<SessionType>('focus');
  const [timeRemaining, setTimeRemaining] = useState(SESSION_CONFIGS.focus.duration);
  const [isRunning, setIsRunning] = useState(false);
  const [sessionsCompleted, setSessionsCompleted] = useState(0);

  // Ref pour l'intervalle
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Animations
  const pulseScale = useSharedValue(1);
  const sparkMood = isRunning ? 'thinking' : 'happy';

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
  }));

  // Configuration actuelle
  const config = SESSION_CONFIGS[sessionType];
  const progress = 1 - (timeRemaining / config.duration);

  // Formater le temps
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Gérer le timer
  useEffect(() => {
    if (isRunning) {
      // Animation de pulsation
      pulseScale.value = withRepeat(
        withSequence(
          withTiming(1.02, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
          withTiming(1, { duration: 1000, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        true
      );

      intervalRef.current = setInterval(() => {
        setTimeRemaining((prev) => {
          if (prev <= 1) {
            handleSessionComplete();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      cancelAnimation(pulseScale);
      pulseScale.value = withSpring(1);

      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isRunning]);

  // Session terminée
  const handleSessionComplete = () => {
    setIsRunning(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Vibration.vibrate([0, 250, 250, 250]);

    if (sessionType === 'focus') {
      const newCount = sessionsCompleted + 1;
      setSessionsCompleted(newCount);

      // Après X sessions, pause longue
      if (newCount % APP_CONFIG.studySession.sessionsBeforeLongBreak === 0) {
        setSessionType('longBreak');
        setTimeRemaining(SESSION_CONFIGS.longBreak.duration);
      } else {
        setSessionType('shortBreak');
        setTimeRemaining(SESSION_CONFIGS.shortBreak.duration);
      }
    } else {
      // Après une pause, retour au focus
      setSessionType('focus');
      setTimeRemaining(SESSION_CONFIGS.focus.duration);
    }
  };

  // Contrôles
  const toggleTimer = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsRunning(!isRunning);
  };

  const resetTimer = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsRunning(false);
    setTimeRemaining(config.duration);
  };

  const skipSession = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    handleSessionComplete();
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <LinearGradient
        colors={config.gradientColors}
        style={styles.gradient}
      >
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="chevron-down" size={28} color={Colors.white} />
          </Pressable>

          <Text style={styles.sessionLabel}>{config.label}</Text>

          <View style={styles.sessionsCounter}>
            <Text style={styles.sessionsText}>
              {sessionsCompleted} / {APP_CONFIG.studySession.sessionsBeforeLongBreak}
            </Text>
          </View>
        </View>

        {/* Timer */}
        <Animated.View style={[styles.timerContainer, pulseStyle]}>
          <CircularProgress
            progress={progress}
            size={280}
            strokeWidth={12}
            color={Colors.white}
          />

          <View style={styles.timerContent}>
            <Text style={styles.timerText}>{formatTime(timeRemaining)}</Text>
            <Text style={styles.timerLabel}>
              {isRunning ? 'En cours...' : 'Prêt'}
            </Text>
          </View>
        </Animated.View>

        {/* Mascotte */}
        <Animated.View entering={FadeIn.delay(300)} style={styles.sparkContainer}>
          <Spark
            size={80}
            mood={sparkMood}
            level={2}
            animated={true}
          />
        </Animated.View>

        {/* Contrôles */}
        <Animated.View entering={FadeInDown.delay(400)} style={styles.controls}>
          <Pressable onPress={resetTimer} style={styles.controlButton}>
            <Ionicons name="refresh" size={28} color={Colors.white} />
          </Pressable>

          <Pressable onPress={toggleTimer} style={styles.mainButton}>
            <Ionicons
              name={isRunning ? 'pause' : 'play'}
              size={40}
              color={config.color}
            />
          </Pressable>

          <Pressable onPress={skipSession} style={styles.controlButton}>
            <Ionicons name="play-skip-forward" size={28} color={Colors.white} />
          </Pressable>
        </Animated.View>

        {/* Type de session */}
        <View style={styles.sessionTypes}>
          {(['focus', 'shortBreak', 'longBreak'] as SessionType[]).map((type) => (
            <Pressable
              key={type}
              onPress={() => {
                if (!isRunning) {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setSessionType(type);
                  setTimeRemaining(SESSION_CONFIGS[type].duration);
                }
              }}
              style={[
                styles.sessionTypeButton,
                sessionType === type && styles.sessionTypeButtonActive,
              ]}
            >
              <Text
                style={[
                  styles.sessionTypeText,
                  sessionType === type && styles.sessionTypeTextActive,
                ]}
              >
                {SESSION_CONFIGS[type].label}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Stats de la session */}
        <Animated.View entering={FadeInDown.delay(500)}>
          <Card variant="filled" style={styles.statsCard}>
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Ionicons name="flame" size={24} color={Colors.accent.orange} />
                <Text style={[styles.statValue, { color: colors.text }]}>
                  {sessionsCompleted * APP_CONFIG.studySession.pomodoroMinutes}
                </Text>
                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                  min focus
                </Text>
              </View>

              <View style={styles.statDivider} />

              <View style={styles.statItem}>
                <Ionicons name="checkmark-circle" size={24} color={Colors.accent.green} />
                <Text style={[styles.statValue, { color: colors.text }]}>
                  {sessionsCompleted}
                </Text>
                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                  sessions
                </Text>
              </View>

              <View style={styles.statDivider} />

              <View style={styles.statItem}>
                <Ionicons name="star" size={24} color={Colors.accent.gold} />
                <Text style={[styles.statValue, { color: colors.text }]}>
                  +{sessionsCompleted * APP_CONFIG.studySession.pomodoroMinutes}
                </Text>
                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                  XP
                </Text>
              </View>
            </View>
          </Card>
        </Animated.View>
      </LinearGradient>
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
  gradient: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: Spacing.base,
  },
  backButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sessionLabel: {
    color: Colors.white,
    ...TextStyles.h3,
  },
  sessionsCounter: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  sessionsText: {
    color: Colors.white,
    ...TextStyles.label,
  },

  // Timer
  timerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing['3xl'],
    alignSelf: 'center',
  },
  progressCircle: {
    position: 'absolute',
  },
  timerContent: {
    alignItems: 'center',
  },
  timerText: {
    color: Colors.white,
    fontSize: 64,
    fontWeight: Typography.fontWeight.bold,
    fontVariant: ['tabular-nums'],
  },
  timerLabel: {
    color: 'rgba(255, 255, 255, 0.8)',
    ...TextStyles.body,
    marginTop: Spacing.xs,
  },

  // Spark
  sparkContainer: {
    alignItems: 'center',
    marginTop: Spacing.xl,
  },

  // Controls
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing['2xl'],
    gap: Spacing.xl,
  },
  controlButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mainButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.lg,
  },

  // Session Types
  sessionTypes: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: Spacing['2xl'],
    gap: Spacing.sm,
  },
  sessionTypeButton: {
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  sessionTypeButtonActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  sessionTypeText: {
    color: 'rgba(255, 255, 255, 0.7)',
    ...TextStyles.label,
  },
  sessionTypeTextActive: {
    color: Colors.white,
    fontWeight: Typography.fontWeight.semibold,
  },

  // Stats
  statsCard: {
    marginTop: Spacing.xl,
    padding: Spacing.lg,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    ...TextStyles.h3,
    marginTop: Spacing.xs,
  },
  statLabel: {
    ...TextStyles.caption,
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: Colors.gray[200],
  },
});
