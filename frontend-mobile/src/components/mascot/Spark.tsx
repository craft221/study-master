/**
 * Study Master - Spark Mascot
 * L'écureuil mascotte animé avec personnalité
 */

import React, { useEffect } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withRepeat,
  withSequence,
  withTiming,
  withDelay,
  Easing,
  interpolate,
  cancelAnimation,
} from 'react-native-reanimated';
import Svg, {
  G,
  Path,
  Circle,
  Ellipse,
  Defs,
  LinearGradient,
  Stop,
  RadialGradient,
} from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { SparkConfig, Animation } from '@/constants/theme';
import type { SparkMood } from '@/types';

// ============================================
// TYPES
// ============================================

interface SparkProps {
  size?: number;
  mood?: SparkMood;
  level?: number;
  accessory?: string | null;
  onPress?: () => void;
  animated?: boolean;
  showGlow?: boolean;
}

// ============================================
// ANIMATED SVG COMPONENTS
// ============================================

const AnimatedView = Animated.createAnimatedComponent(View);

// Type for mood colors with optional glow
interface MoodColors {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  glow?: boolean;
}

// ============================================
// COMPONENT
// ============================================

export function Spark({
  size = 128,
  mood = 'happy',
  level = 1,
  accessory = null,
  onPress,
  animated = true,
  showGlow = false,
}: SparkProps) {
  // Animations
  const floatY = useSharedValue(0);
  const tailWag = useSharedValue(0);
  const earTwitch = useSharedValue(0);
  const eyeBlink = useSharedValue(1);
  const bodyScale = useSharedValue(1);
  const headTilt = useSharedValue(0);

  // Couleurs selon l'humeur
  const moodColors: MoodColors = SparkConfig.mood[mood] || SparkConfig.mood.happy;

  // Taille selon le niveau
  const getLevelSize = () => {
    if (level <= 1) return SparkConfig.size.baby;
    if (level <= 2) return SparkConfig.size.junior;
    if (level <= 3) return SparkConfig.size.expert;
    if (level <= 4) return SparkConfig.size.sage;
    return SparkConfig.size.legendary;
  };

  const actualSize = size || getLevelSize();
  const scale = actualSize / 128; // Base size is 128

  // ============================================
  // ANIMATIONS
  // ============================================

  useEffect(() => {
    if (!animated) return;

    // Animation de flottement
    floatY.value = withRepeat(
      withSequence(
        withTiming(-5, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 1500, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );

    // Animation de la queue
    const tailSpeed = mood === 'excited' ? 400 : mood === 'sad' ? 2000 : 800;
    tailWag.value = withRepeat(
      withSequence(
        withTiming(10, { duration: tailSpeed, easing: Easing.inOut(Easing.ease) }),
        withTiming(-10, { duration: tailSpeed, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );

    // Animation des oreilles
    earTwitch.value = withRepeat(
      withSequence(
        withDelay(3000, withTiming(5, { duration: 100 })),
        withTiming(0, { duration: 100 }),
        withDelay(500, withTiming(-3, { duration: 80 })),
        withTiming(0, { duration: 80 })
      ),
      -1,
      false
    );

    // Clignement des yeux
    eyeBlink.value = withRepeat(
      withSequence(
        withDelay(3000, withTiming(0.1, { duration: 100 })),
        withTiming(1, { duration: 100 })
      ),
      -1,
      false
    );

    // Animation spécifique selon l'humeur
    if (mood === 'thinking') {
      headTilt.value = withRepeat(
        withSequence(
          withTiming(5, { duration: 1500 }),
          withTiming(-5, { duration: 1500 })
        ),
        -1,
        true
      );
    } else if (mood === 'sleeping') {
      bodyScale.value = withRepeat(
        withSequence(
          withTiming(1.02, { duration: 2000 }),
          withTiming(0.98, { duration: 2000 })
        ),
        -1,
        true
      );
    }

    return () => {
      cancelAnimation(floatY);
      cancelAnimation(tailWag);
      cancelAnimation(earTwitch);
      cancelAnimation(eyeBlink);
      cancelAnimation(headTilt);
      cancelAnimation(bodyScale);
    };
  }, [animated, mood]);

  // Styles animés
  const containerStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: floatY.value },
      { scale: bodyScale.value },
    ],
  }));

  // Gestion du press
  const handlePress = () => {
    if (onPress) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      // Animation de réaction
      bodyScale.value = withSequence(
        withSpring(1.1, Animation.spring.bouncy),
        withSpring(1, Animation.spring.gentle)
      );

      onPress();
    }
  };

  // ============================================
  // RENDER
  // ============================================

  const renderEyes = () => {
    if (mood === 'sleeping') {
      // Yeux fermés (lignes)
      return (
        <>
          <Path
            d="M 40 52 Q 45 48 50 52"
            stroke="#333"
            strokeWidth="2"
            fill="none"
          />
          <Path
            d="M 78 52 Q 83 48 88 52"
            stroke="#333"
            strokeWidth="2"
            fill="none"
          />
        </>
      );
    }

    const eyeScale = mood === 'excited' ? 1.2 : 1;

    return (
      <>
        {/* Œil gauche */}
        <G transform={`scale(${eyeScale}) translate(${(1 - eyeScale) * 45}, ${(1 - eyeScale) * 50})`}>
          <Ellipse cx="45" cy="50" rx="8" ry="10" fill="white" />
          <Circle cx="45" cy="50" r="5" fill="#2D1B0E" />
          <Circle cx="43" cy="48" r="2" fill="white" />
        </G>

        {/* Œil droit */}
        <G transform={`scale(${eyeScale}) translate(${(1 - eyeScale) * 83}, ${(1 - eyeScale) * 50})`}>
          <Ellipse cx="83" cy="50" rx="8" ry="10" fill="white" />
          <Circle cx="83" cy="50" r="5" fill="#2D1B0E" />
          <Circle cx="81" cy="48" r="2" fill="white" />
        </G>
      </>
    );
  };

  const renderMouth = () => {
    switch (mood) {
      case 'excited':
        return (
          <>
            <Path
              d="M 54 68 Q 64 80 74 68"
              stroke="#2D1B0E"
              strokeWidth="2"
              fill="none"
            />
            {/* Langue */}
            <Ellipse cx="64" cy="73" rx="4" ry="3" fill="#FF6B9D" />
          </>
        );
      case 'sad':
        return (
          <Path
            d="M 54 72 Q 64 65 74 72"
            stroke="#2D1B0E"
            strokeWidth="2"
            fill="none"
          />
        );
      case 'thinking':
        return (
          <Path
            d="M 58 70 L 70 70"
            stroke="#2D1B0E"
            strokeWidth="2"
            fill="none"
          />
        );
      case 'sleeping':
        return (
          <Path
            d="M 58 68 L 70 68"
            stroke="#2D1B0E"
            strokeWidth="1.5"
            fill="none"
          />
        );
      default: // happy, encouraging, helpful
        return (
          <Path
            d="M 54 68 Q 64 76 74 68"
            stroke="#2D1B0E"
            strokeWidth="2"
            fill="none"
          />
        );
    }
  };

  const renderAccessory = () => {
    if (!accessory) return null;

    switch (accessory) {
      case 'glasses':
        return (
          <G>
            {/* Montures */}
            <Circle cx="45" cy="50" r="12" stroke="#DAA520" strokeWidth="2" fill="none" />
            <Circle cx="83" cy="50" r="12" stroke="#DAA520" strokeWidth="2" fill="none" />
            <Path d="M 57 50 L 71 50" stroke="#DAA520" strokeWidth="2" />
            <Path d="M 33 50 L 25 45" stroke="#DAA520" strokeWidth="2" />
            <Path d="M 95 50 L 103 45" stroke="#DAA520" strokeWidth="2" />
          </G>
        );
      case 'graduate_hat':
        return (
          <G>
            {/* Chapeau */}
            <Path
              d="M 64 15 L 30 30 L 64 45 L 98 30 Z"
              fill="#1a1a2e"
            />
            <Path d="M 64 32 L 64 50" stroke="#DAA520" strokeWidth="2" />
            <Circle cx="64" cy="50" r="3" fill="#DAA520" />
          </G>
        );
      case 'crown':
        return (
          <G>
            <Path
              d="M 44 25 L 50 10 L 56 22 L 64 5 L 72 22 L 78 10 L 84 25 L 84 35 L 44 35 Z"
              fill="#FFD700"
            />
            <Circle cx="64" cy="15" r="3" fill="#DC143C" />
            <Circle cx="50" cy="20" r="2" fill="#DC143C" />
            <Circle cx="78" cy="20" r="2" fill="#DC143C" />
          </G>
        );
      default:
        return null;
    }
  };

  return (
    <Pressable onPress={handlePress} disabled={!onPress}>
      <AnimatedView style={[styles.container, containerStyle, { width: actualSize, height: actualSize }]}>
        {/* Glow effect */}
        {(showGlow || moodColors.glow) && (
          <View style={[styles.glow, { backgroundColor: moodColors.primary }]} />
        )}

        <Svg
          width={actualSize}
          height={actualSize}
          viewBox="0 0 128 128"
        >
          <Defs>
            {/* Gradient pour le corps */}
            <LinearGradient id="bodyGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <Stop offset="0%" stopColor={moodColors.secondary} />
              <Stop offset="100%" stopColor={moodColors.primary} />
            </LinearGradient>

            {/* Gradient pour le ventre */}
            <RadialGradient id="bellyGradient" cx="50%" cy="50%" r="50%">
              <Stop offset="0%" stopColor="#FFFAF0" />
              <Stop offset="100%" stopColor="#FFF8E7" />
            </RadialGradient>

            {/* Gradient pour la queue */}
            <LinearGradient id="tailGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <Stop offset="0%" stopColor={moodColors.primary} />
              <Stop offset="50%" stopColor={moodColors.secondary} />
              <Stop offset="100%" stopColor={moodColors.primary} />
            </LinearGradient>
          </Defs>

          {/* Queue (derrière le corps) */}
          <G>
            <Path
              d="M 95 75 Q 115 50 105 25 Q 90 35 95 55 Q 85 45 90 65 Q 80 60 85 75 Z"
              fill="url(#tailGradient)"
            />
            {/* Rayures de la queue */}
            <Path d="M 98 60 Q 105 50 102 40" stroke={moodColors.accent} strokeWidth="2" fill="none" opacity="0.3" />
            <Path d="M 92 65 Q 98 55 95 48" stroke={moodColors.accent} strokeWidth="2" fill="none" opacity="0.3" />
          </G>

          {/* Corps principal */}
          <Ellipse
            cx="64"
            cy="75"
            rx="35"
            ry="40"
            fill="url(#bodyGradient)"
          />

          {/* Ventre */}
          <Ellipse
            cx="64"
            cy="82"
            rx="22"
            ry="25"
            fill="url(#bellyGradient)"
          />

          {/* Pattes */}
          <Ellipse cx="45" cy="110" rx="10" ry="6" fill={moodColors.primary} />
          <Ellipse cx="83" cy="110" rx="10" ry="6" fill={moodColors.primary} />

          {/* Bras */}
          <Ellipse cx="32" cy="78" rx="8" ry="12" fill={moodColors.primary} transform="rotate(-20 32 78)" />
          <Ellipse cx="96" cy="78" rx="8" ry="12" fill={moodColors.primary} transform="rotate(20 96 78)" />

          {/* Tête */}
          <G>
            {/* Base de la tête */}
            <Circle cx="64" cy="50" r="30" fill="url(#bodyGradient)" />

            {/* Oreilles */}
            <G>
              {/* Oreille gauche */}
              <Ellipse cx="38" cy="25" rx="10" ry="15" fill={moodColors.primary} transform="rotate(-15 38 25)" />
              <Ellipse cx="38" cy="25" rx="6" ry="10" fill="#FFB6C1" transform="rotate(-15 38 25)" />
            </G>
            <G>
              {/* Oreille droite */}
              <Ellipse cx="90" cy="25" rx="10" ry="15" fill={moodColors.primary} transform="rotate(15 90 25)" />
              <Ellipse cx="90" cy="25" rx="6" ry="10" fill="#FFB6C1" transform="rotate(15 90 25)" />
            </G>

            {/* Joues */}
            <Circle cx="35" cy="55" r="8" fill="#FFDAB9" opacity="0.6" />
            <Circle cx="93" cy="55" r="8" fill="#FFDAB9" opacity="0.6" />

            {/* Yeux */}
            {renderEyes()}

            {/* Nez */}
            <Ellipse cx="64" cy="60" rx="4" ry="3" fill="#2D1B0E" />

            {/* Bouche */}
            {renderMouth()}

            {/* Moustaches */}
            <G opacity="0.4">
              <Path d="M 40 58 L 25 55" stroke="#2D1B0E" strokeWidth="1" />
              <Path d="M 40 62 L 25 62" stroke="#2D1B0E" strokeWidth="1" />
              <Path d="M 40 66 L 25 69" stroke="#2D1B0E" strokeWidth="1" />
              <Path d="M 88 58 L 103 55" stroke="#2D1B0E" strokeWidth="1" />
              <Path d="M 88 62 L 103 62" stroke="#2D1B0E" strokeWidth="1" />
              <Path d="M 88 66 L 103 69" stroke="#2D1B0E" strokeWidth="1" />
            </G>

            {/* Accessoire */}
            {renderAccessory()}
          </G>

          {/* Gland (pour niveau 3+) */}
          {level >= 3 && (
            <G>
              <Ellipse cx="64" cy="95" rx="6" ry="8" fill="#8B4513" />
              <Path
                d="M 58 88 Q 64 85 70 88 L 70 92 Q 64 90 58 92 Z"
                fill="#654321"
              />
              {/* Brillance du gland */}
              <Ellipse cx="66" cy="93" rx="2" ry="3" fill="#D2691E" opacity="0.5" />
            </G>
          )}

          {/* Effet de brillance sur le corps */}
          <Ellipse cx="50" cy="65" rx="8" ry="12" fill="white" opacity="0.15" />
        </Svg>

        {/* Z's pour le mode sleeping */}
        {mood === 'sleeping' && (
          <View style={styles.sleepZs}>
            <Animated.Text style={styles.sleepZ}>z</Animated.Text>
            <Animated.Text style={[styles.sleepZ, styles.sleepZ2]}>z</Animated.Text>
            <Animated.Text style={[styles.sleepZ, styles.sleepZ3]}>z</Animated.Text>
          </View>
        )}
      </AnimatedView>
    </Pressable>
  );
}

// ============================================
// STYLES
// ============================================

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  glow: {
    position: 'absolute',
    width: '80%',
    height: '80%',
    borderRadius: 100,
    opacity: 0.3,
    transform: [{ scale: 1.2 }],
  },
  sleepZs: {
    position: 'absolute',
    top: 0,
    right: 0,
    flexDirection: 'row',
  },
  sleepZ: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#64748b',
    opacity: 0.7,
  },
  sleepZ2: {
    fontSize: 20,
    marginLeft: 4,
    marginTop: -8,
  },
  sleepZ3: {
    fontSize: 24,
    marginLeft: 4,
    marginTop: -16,
  },
});

export default Spark;
