/**
 * Study Master - Input Component
 * Champ de saisie avec animations et validation
 */

import React, { useState, useRef } from 'react';
import {
  View,
  TextInput,
  Text,
  StyleSheet,
  ViewStyle,
  TextStyle,
  TextInputProps,
  Pressable,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  interpolateColor,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { BorderRadius, Spacing, Typography, Colors, Animation } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';

// ============================================
// TYPES
// ============================================

interface InputProps extends Omit<TextInputProps, 'style'> {
  label?: string;
  error?: string;
  hint?: string;
  leftIcon?: keyof typeof Ionicons.glyphMap;
  rightIcon?: keyof typeof Ionicons.glyphMap;
  onRightIconPress?: () => void;
  containerStyle?: ViewStyle;
  inputStyle?: TextStyle;
  disabled?: boolean;
}

// ============================================
// ANIMATED COMPONENTS
// ============================================

const AnimatedView = Animated.createAnimatedComponent(View);
const AnimatedTextInput = Animated.createAnimatedComponent(TextInput);

// ============================================
// COMPONENT
// ============================================

export function Input({
  label,
  error,
  hint,
  leftIcon,
  rightIcon,
  onRightIconPress,
  containerStyle,
  inputStyle,
  disabled = false,
  secureTextEntry,
  ...props
}: InputProps) {
  const { colors, isDark } = useTheme();
  const inputRef = useRef<TextInput>(null);
  const [isFocused, setIsFocused] = useState(false);
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);

  // Animations
  const focusProgress = useSharedValue(0);
  const labelPosition = useSharedValue(props.value ? 1 : 0);

  // Animation du container
  const containerAnimatedStyle = useAnimatedStyle(() => {
    const borderColor = error
      ? colors.error
      : interpolateColor(
          focusProgress.value,
          [0, 1],
          [colors.inputBorder, colors.primary]
        );

    return {
      borderColor,
      borderWidth: withTiming(isFocused ? 2 : 1.5, { duration: 150 }),
    };
  });

  // Animation du label flottant
  const labelAnimatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        {
          translateY: withSpring(labelPosition.value === 1 ? -28 : 0, Animation.spring.gentle),
        },
        {
          scale: withSpring(labelPosition.value === 1 ? 0.85 : 1, Animation.spring.gentle),
        },
      ],
      color: withTiming(
        error
          ? colors.error
          : isFocused
          ? colors.primary
          : colors.textSecondary,
        { duration: 150 }
      ),
    };
  });

  const handleFocus = () => {
    setIsFocused(true);
    focusProgress.value = withTiming(1, { duration: 200 });
    labelPosition.value = 1;
    props.onFocus?.({} as any);
  };

  const handleBlur = () => {
    setIsFocused(false);
    focusProgress.value = withTiming(0, { duration: 200 });
    if (!props.value) {
      labelPosition.value = 0;
    }
    props.onBlur?.({} as any);
  };

  const togglePasswordVisibility = () => {
    setIsPasswordVisible(!isPasswordVisible);
  };

  // Déterminer si on affiche un bouton de visibilité du mot de passe
  const showPasswordToggle = secureTextEntry;
  const actualSecureTextEntry = secureTextEntry && !isPasswordVisible;

  return (
    <View style={[styles.wrapper, containerStyle]}>
      {/* Label flottant */}
      {label && (
        <Pressable
          onPress={() => inputRef.current?.focus()}
          style={styles.labelContainer}
        >
          <Animated.Text style={[styles.label, labelAnimatedStyle]}>
            {label}
          </Animated.Text>
        </Pressable>
      )}

      {/* Container de l'input */}
      <AnimatedView
        style={[
          styles.container,
          {
            backgroundColor: colors.inputBackground,
          },
          containerAnimatedStyle,
          disabled && styles.disabled,
        ]}
      >
        {/* Icône gauche */}
        {leftIcon && (
          <Ionicons
            name={leftIcon}
            size={20}
            color={error ? colors.error : isFocused ? colors.primary : colors.textSecondary}
            style={styles.leftIcon}
          />
        )}

        {/* Input */}
        <TextInput
          ref={inputRef}
          style={[
            styles.input,
            {
              color: colors.text,
            },
            leftIcon && styles.inputWithLeftIcon,
            (rightIcon || showPasswordToggle) && styles.inputWithRightIcon,
            inputStyle,
          ]}
          placeholderTextColor={colors.placeholder}
          editable={!disabled}
          secureTextEntry={actualSecureTextEntry}
          onFocus={handleFocus}
          onBlur={handleBlur}
          {...props}
        />

        {/* Toggle mot de passe */}
        {showPasswordToggle && (
          <Pressable onPress={togglePasswordVisibility} style={styles.rightIconButton}>
            <Ionicons
              name={isPasswordVisible ? 'eye-off-outline' : 'eye-outline'}
              size={20}
              color={colors.textSecondary}
            />
          </Pressable>
        )}

        {/* Icône droite */}
        {rightIcon && !showPasswordToggle && (
          <Pressable
            onPress={onRightIconPress}
            style={styles.rightIconButton}
            disabled={!onRightIconPress}
          >
            <Ionicons
              name={rightIcon}
              size={20}
              color={error ? colors.error : colors.textSecondary}
            />
          </Pressable>
        )}
      </AnimatedView>

      {/* Message d'erreur ou hint */}
      {(error || hint) && (
        <Text
          style={[
            styles.helperText,
            { color: error ? colors.error : colors.textSecondary },
          ]}
        >
          {error || hint}
        </Text>
      )}
    </View>
  );
}

// ============================================
// STYLES
// ============================================

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: Spacing.base,
  },
  labelContainer: {
    position: 'absolute',
    left: Spacing.base,
    top: Spacing.md + 2,
    zIndex: 1,
    backgroundColor: 'transparent',
  },
  label: {
    fontSize: Typography.fontSize.base,
    fontWeight: Typography.fontWeight.medium,
    paddingHorizontal: 4,
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: BorderRadius.lg,
    minHeight: 56,
    paddingHorizontal: Spacing.base,
  },
  disabled: {
    opacity: 0.5,
  },
  input: {
    flex: 1,
    fontSize: Typography.fontSize.base,
    paddingVertical: Spacing.md,
    paddingTop: Spacing.lg,
  },
  inputWithLeftIcon: {
    paddingLeft: Spacing.sm,
  },
  inputWithRightIcon: {
    paddingRight: Spacing.sm,
  },
  leftIcon: {
    marginRight: Spacing.xs,
  },
  rightIconButton: {
    padding: Spacing.xs,
    marginLeft: Spacing.xs,
  },
  helperText: {
    fontSize: Typography.fontSize.sm,
    marginTop: Spacing.xs,
    marginLeft: Spacing.xs,
  },
});

export default Input;
