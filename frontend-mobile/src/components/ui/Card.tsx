/**
 * Study Master - Card Component
 * Carte réutilisable avec animations et variantes
 */

import React from 'react';
import {
  View,
  StyleSheet,
  ViewStyle,
  Pressable,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  FadeInDown,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { BorderRadius, Shadows, Spacing, Animation } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';

// ============================================
// TYPES
// ============================================

type CardVariant = 'default' | 'elevated' | 'outlined' | 'filled' | 'gradient';

interface CardProps {
  children: React.ReactNode;
  variant?: CardVariant;
  onPress?: () => void;
  disabled?: boolean;
  animated?: boolean;
  animationDelay?: number;
  gradientColors?: string[];
  style?: ViewStyle;
  contentStyle?: ViewStyle;
}

// ============================================
// ANIMATED PRESSABLE
// ============================================

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// ============================================
// COMPONENT
// ============================================

export function Card({
  children,
  variant = 'default',
  onPress,
  disabled = false,
  animated = true,
  animationDelay = 0,
  gradientColors,
  style,
  contentStyle,
}: CardProps) {
  const { colors } = useTheme();
  const scale = useSharedValue(1);
  const translateY = useSharedValue(0);

  // Animation de pression
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: scale.value },
      { translateY: translateY.value },
    ],
  }));

  const handlePressIn = () => {
    if (!onPress || disabled) return;
    scale.value = withSpring(0.98, Animation.spring.stiff);
    translateY.value = withSpring(2, Animation.spring.stiff);
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, Animation.spring.bouncy);
    translateY.value = withSpring(0, Animation.spring.bouncy);
  };

  const handlePress = () => {
    if (onPress && !disabled) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onPress();
    }
  };

  // Styles selon la variante
  const getVariantStyles = (): ViewStyle => {
    switch (variant) {
      case 'default':
        return {
          backgroundColor: colors.card,
          borderWidth: 1,
          borderColor: colors.border,
          ...Shadows.sm,
        };
      case 'elevated':
        return {
          backgroundColor: colors.card,
          ...Shadows.lg,
        };
      case 'outlined':
        return {
          backgroundColor: 'transparent',
          borderWidth: 1.5,
          borderColor: colors.border,
        };
      case 'filled':
        return {
          backgroundColor: colors.surfaceVariant,
        };
      case 'gradient':
        return {
          overflow: 'hidden',
          ...Shadows.md,
        };
      default:
        return {
          backgroundColor: colors.card,
        };
    }
  };

  const variantStyles = getVariantStyles();

  const containerStyle: ViewStyle = {
    ...styles.container,
    ...variantStyles,
    ...(disabled && styles.disabled),
    ...style,
  };

  // Contenu de la carte
  const cardContent = (
    <View style={[styles.content, contentStyle]}>
      {children}
    </View>
  );

  // Carte avec gradient
  if (variant === 'gradient' && gradientColors) {
    const content = (
      <LinearGradient
        colors={gradientColors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.gradient, contentStyle]}
      >
        {children}
      </LinearGradient>
    );

    if (onPress) {
      return (
        <AnimatedPressable
          onPress={handlePress}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          disabled={disabled}
          style={[animatedStyle, containerStyle]}
          entering={animated ? FadeInDown.delay(animationDelay).springify() : undefined}
        >
          {content}
        </AnimatedPressable>
      );
    }

    return (
      <Animated.View
        style={containerStyle}
        entering={animated ? FadeInDown.delay(animationDelay).springify() : undefined}
      >
        {content}
      </Animated.View>
    );
  }

  // Carte interactive
  if (onPress) {
    return (
      <AnimatedPressable
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled}
        style={[animatedStyle, containerStyle]}
        entering={animated ? FadeInDown.delay(animationDelay).springify() : undefined}
      >
        {cardContent}
      </AnimatedPressable>
    );
  }

  // Carte statique
  return (
    <Animated.View
      style={containerStyle}
      entering={animated ? FadeInDown.delay(animationDelay).springify() : undefined}
    >
      {cardContent}
    </Animated.View>
  );
}

// ============================================
// CARD HEADER
// ============================================

interface CardHeaderProps {
  children: React.ReactNode;
  style?: ViewStyle;
}

export function CardHeader({ children, style }: CardHeaderProps) {
  return (
    <View style={[styles.header, style]}>
      {children}
    </View>
  );
}

// ============================================
// CARD CONTENT
// ============================================

interface CardContentProps {
  children: React.ReactNode;
  style?: ViewStyle;
}

export function CardContent({ children, style }: CardContentProps) {
  return (
    <View style={[styles.cardContent, style]}>
      {children}
    </View>
  );
}

// ============================================
// CARD FOOTER
// ============================================

interface CardFooterProps {
  children: React.ReactNode;
  style?: ViewStyle;
}

export function CardFooter({ children, style }: CardFooterProps) {
  return (
    <View style={[styles.footer, style]}>
      {children}
    </View>
  );
}

// ============================================
// STYLES
// ============================================

const styles = StyleSheet.create({
  container: {
    borderRadius: BorderRadius.xl,
    overflow: 'hidden',
  },
  disabled: {
    opacity: 0.5,
  },
  content: {
    padding: Spacing.base,
  },
  gradient: {
    padding: Spacing.base,
  },
  header: {
    paddingBottom: Spacing.sm,
  },
  cardContent: {
    paddingVertical: Spacing.sm,
  },
  footer: {
    paddingTop: Spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: Spacing.sm,
  },
});

export default Card;
