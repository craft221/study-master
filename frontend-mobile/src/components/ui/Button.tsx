/**
 * Study Master - Button Component
 * Bouton réutilisable avec animations et variantes
 */

import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ViewStyle,
  TextStyle,
  ActivityIndicator,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  interpolate,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, BorderRadius, Shadows, Typography, ComponentSize, Animation } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';

// ============================================
// TYPES
// ============================================

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive' | 'success' | 'gradient';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps {
  children: React.ReactNode;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  haptic?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

// ============================================
// ANIMATED TOUCHABLE
// ============================================

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

// ============================================
// COMPONENT
// ============================================

export function Button({
  children,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  fullWidth = false,
  icon,
  iconPosition = 'left',
  haptic = true,
  style,
  textStyle,
}: ButtonProps) {
  const { colors, isDark } = useTheme();
  const scale = useSharedValue(1);

  // Animation de pression
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.96, Animation.spring.stiff);
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, Animation.spring.bouncy);
  };

  const handlePress = () => {
    if (haptic) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onPress();
  };

  // Styles selon la variante
  const getVariantStyles = (): { container: ViewStyle; text: TextStyle } => {
    switch (variant) {
      case 'primary':
        return {
          container: {
            backgroundColor: colors.primary,
            ...Shadows.base,
          },
          text: {
            color: Colors.white,
          },
        };
      case 'secondary':
        return {
          container: {
            backgroundColor: colors.surfaceVariant,
          },
          text: {
            color: colors.text,
          },
        };
      case 'outline':
        return {
          container: {
            backgroundColor: 'transparent',
            borderWidth: 1.5,
            borderColor: colors.primary,
          },
          text: {
            color: colors.primary,
          },
        };
      case 'ghost':
        return {
          container: {
            backgroundColor: 'transparent',
          },
          text: {
            color: colors.primary,
          },
        };
      case 'destructive':
        return {
          container: {
            backgroundColor: colors.error,
            ...Shadows.base,
          },
          text: {
            color: Colors.white,
          },
        };
      case 'success':
        return {
          container: {
            backgroundColor: colors.success,
            ...Shadows.base,
          },
          text: {
            color: Colors.white,
          },
        };
      case 'gradient':
        return {
          container: {
            overflow: 'hidden',
            ...Shadows.md,
          },
          text: {
            color: Colors.white,
          },
        };
      default:
        return {
          container: {},
          text: {},
        };
    }
  };

  // Styles selon la taille
  const getSizeStyles = (): { container: ViewStyle; text: TextStyle } => {
    const sizeConfig = ComponentSize.button[size];
    return {
      container: {
        height: sizeConfig.height,
        paddingHorizontal: sizeConfig.paddingHorizontal,
      },
      text: {
        fontSize: size === 'sm' ? Typography.fontSize.sm : Typography.fontSize.base,
      },
    };
  };

  const variantStyles = getVariantStyles();
  const sizeStyles = getSizeStyles();

  const containerStyle: ViewStyle = {
    ...styles.container,
    ...variantStyles.container,
    ...sizeStyles.container,
    ...(fullWidth && styles.fullWidth),
    ...(disabled && styles.disabled),
    ...style,
  };

  const labelStyle: TextStyle = {
    ...styles.text,
    ...variantStyles.text,
    ...sizeStyles.text,
    ...textStyle,
  };

  const content = (
    <>
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variantStyles.text.color as string}
        />
      ) : (
        <>
          {icon && iconPosition === 'left' && (
            <Animated.View style={styles.iconLeft}>{icon}</Animated.View>
          )}
          <Text style={labelStyle}>
            {typeof children === 'string' ? children : children}
          </Text>
          {icon && iconPosition === 'right' && (
            <Animated.View style={styles.iconRight}>{icon}</Animated.View>
          )}
        </>
      )}
    </>
  );

  // Rendu avec gradient si nécessaire
  if (variant === 'gradient') {
    return (
      <AnimatedTouchable
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled || loading}
        activeOpacity={0.9}
        style={[animatedStyle, containerStyle]}
      >
        <LinearGradient
          colors={[Colors.primary[400], Colors.primary[600]]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.gradient}
        >
          {content}
        </LinearGradient>
      </AnimatedTouchable>
    );
  }

  return (
    <AnimatedTouchable
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled || loading}
      activeOpacity={0.8}
      style={[animatedStyle, containerStyle]}
    >
      {content}
    </AnimatedTouchable>
  );
}

// ============================================
// STYLES
// ============================================

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: BorderRadius.lg,
    gap: 8,
  },
  fullWidth: {
    width: '100%',
  },
  disabled: {
    opacity: 0.5,
  },
  text: {
    fontWeight: Typography.fontWeight.semibold,
    textAlign: 'center',
  },
  iconLeft: {
    marginRight: 4,
  },
  iconRight: {
    marginLeft: 4,
  },
  gradient: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    borderRadius: BorderRadius.lg,
  },
});

export default Button;
