"use client";

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import SparkSVG from './SparkSVG';
import { useLanguage } from '@/contexts/LanguageContext';

/**
 * Spark - La Mascotte Écureuil de Study Master ⚡🐿️
 *
 * Composant animé qui affiche Spark avec différents états émotionnels
 * et animations selon le contexte
 */

export type SparkMood =
  | 'happy'
  | 'excited'
  | 'sad'
  | 'thinking'
  | 'encouraging'
  | 'sleeping'
  | 'helpful';

export type SparkAnimation =
  | 'idle'
  | 'wave'
  | 'celebration'
  | 'jump'
  | 'sleep'
  | 'think'
  | 'pat'
  | 'collect'
  | 'read'
  | 'showcase'
  | 'evolution'
  | 'explain';

interface SparkProps {
  mood?: SparkMood;
  animation?: SparkAnimation;
  message?: string;
  level?: number;
  accessory?: string | null;
  onClick?: () => void;
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left' | 'center';
  showMessage?: boolean;
  className?: string;
}

/**
 * Émojis et représentations de Spark selon son niveau
 */
const SPARK_LEVELS = {
  1: { emoji: '🐿️', nameKey: 'baby', size: 'small' },
  2: { emoji: '🐿️✨', nameKey: 'junior', size: 'medium' },
  3: { emoji: '🐿️⚡', nameKey: 'expert', size: 'medium' },
  4: { emoji: '🐿️📚', nameKey: 'sage', size: 'large' },
  5: { emoji: '🐿️👑', nameKey: 'legendary', size: 'large' },
};

/**
 * Accessoires disponibles (emoji overlay)
 */
const ACCESSORIES = {
  'graduate_hat': '🎓',
  'glasses': '👓',
  'golden_acorn': '🌰✨',
  'lightning_cape': '⚡',
  'mini_library': '📚',
  'trophy': '🏆',
  'crown': '👑',
};

/**
 * Positions prédéfinies
 */
const POSITIONS = {
  'bottom-right': 'fixed bottom-6 right-6',
  'bottom-left': 'fixed bottom-6 left-6',
  'top-right': 'fixed top-6 right-6',
  'top-left': 'fixed top-6 left-6',
  'center': 'mx-auto',
};

const Spark: React.FC<SparkProps> = ({
  mood = 'happy',
  animation = 'idle',
  message,
  level = 1,
  accessory = null,
  onClick,
  position = 'bottom-right',
  showMessage = true,
  className = '',
}) => {
  const { t } = useLanguage();
  const [isHovered, setIsHovered] = useState(false);
  const [showBubble, setShowBubble] = useState(false);

  const sparkData = SPARK_LEVELS[level as keyof typeof SPARK_LEVELS] || SPARK_LEVELS[1];
  const sparkName = t(`sparkWidget.levels.${sparkData.nameKey}`);
  const accessoryEmoji = accessory ? ACCESSORIES[accessory as keyof typeof ACCESSORIES] : null;

  // Afficher la bulle de message si un message est fourni
  useEffect(() => {
    console.log('[Spark] useEffect - message:', message, 'showMessage:', showMessage);
    if (message && showMessage) {
      console.log('[Spark] Setting showBubble = true');
      setShowBubble(true);
      const timer = setTimeout(() => {
        console.log('[Spark] Timer: Setting showBubble = false');
        setShowBubble(false);
      }, 5000);
      return () => clearTimeout(timer);
    } else {
      // Reset bubble when no message
      setShowBubble(false);
    }
  }, [message, showMessage]);

  // Variants d'animation selon le type
  const getAnimationVariants = () => {
    switch (animation) {
      case 'wave':
        return {
          animate: {
            rotate: [0, 14, -8, 14, -4, 10, 0],
            transition: { duration: 1, repeat: 2 }
          }
        };
      case 'celebration':
        return {
          animate: {
            scale: [1, 1.2, 1, 1.1, 1],
            rotate: [0, -10, 10, -10, 0],
            y: [0, -20, 0, -10, 0],
            transition: { duration: 0.8, repeat: 3 }
          }
        };
      case 'jump':
        return {
          animate: {
            y: [0, -30, 0, -15, 0],
            transition: { duration: 0.6, repeat: 2 }
          }
        };
      case 'sleep':
        return {
          animate: {
            scale: [1, 0.95, 1],
            opacity: [1, 0.8, 1],
            transition: { duration: 2, repeat: Infinity }
          }
        };
      case 'think':
        return {
          animate: {
            rotate: [-5, 5, -5],
            transition: { duration: 1.5, repeat: Infinity }
          }
        };
      case 'showcase':
        return {
          animate: {
            scale: [1, 1.15, 1],
            rotate: [0, 360],
            transition: { duration: 1.5 }
          }
        };
      case 'evolution':
        return {
          animate: {
            scale: [1, 1.5, 1.2, 1],
            opacity: [1, 0.5, 1],
            transition: { duration: 2 }
          }
        };
      case 'explain':
        return {
          animate: {
            rotate: [0, -3, 3, -3, 3, 0],
            y: [0, -5, 0],
            transition: { duration: 1.5, repeat: 2 }
          }
        };
      default:
        return {
          animate: {
            y: [0, -5, 0],
            transition: { duration: 2, repeat: Infinity, ease: "easeInOut" }
          }
        };
    }
  };

  // Couleur de fond de la bulle selon le mood
  const getMoodColor = () => {
    switch (mood) {
      case 'excited':
        return 'bg-yellow-100 border-yellow-400 text-yellow-900';
      case 'sad':
        return 'bg-blue-100 border-blue-400 text-blue-900';
      case 'thinking':
        return 'bg-purple-100 border-purple-400 text-purple-900';
      case 'encouraging':
        return 'bg-green-100 border-green-400 text-green-900';
      case 'sleeping':
        return 'bg-gray-100 border-gray-400 text-gray-700';
      case 'helpful':
        return 'bg-cyan-100 border-cyan-400 text-cyan-900';
      default:
        return 'bg-orange-100 border-orange-400 text-orange-900';
    }
  };

  // Taille selon le niveau
  const getSizeClass = () => {
    switch (sparkData.size) {
      case 'small':
        return 'text-6xl';
      case 'medium':
        return 'text-7xl';
      case 'large':
        return 'text-8xl';
      default:
        return 'text-6xl';
    }
  };

  // Debug render
  console.log('[Spark] Render - showBubble:', showBubble, 'message:', message);

  return (
    <div className={`${POSITIONS[position]} z-50 flex flex-col items-center ${className}`}>
      {/* Bulle de message */}
      <AnimatePresence>
        {showBubble && message && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.8 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.9 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
            className={`
              mb-3 px-4 py-3 rounded-2xl border-2 shadow-lg max-w-xs relative
              ${getMoodColor()}
            `}
          >
            <p className="text-sm font-medium leading-relaxed">
              {message}
            </p>
            {/* Triangle pointeur */}
            <div className={`
              absolute -bottom-2 left-1/2 transform -translate-x-1/2
              w-0 h-0 border-l-8 border-r-8 border-t-8
              border-l-transparent border-r-transparent
              ${mood === 'excited' ? 'border-t-yellow-400' :
                mood === 'sad' ? 'border-t-blue-400' :
                mood === 'thinking' ? 'border-t-purple-400' :
                mood === 'encouraging' ? 'border-t-green-400' :
                mood === 'sleeping' ? 'border-t-gray-400' :
                mood === 'helpful' ? 'border-t-cyan-400' :
                'border-t-orange-400'}
            `} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Spark lui-même */}
      <motion.div
        {...getAnimationVariants()}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
        onHoverStart={() => setIsHovered(true)}
        onHoverEnd={() => setIsHovered(false)}
        onClick={onClick}
        className={`
          relative cursor-pointer select-none
          transition-all duration-200
          ${onClick ? 'hover:drop-shadow-2xl' : ''}
        `}
        role="button"
        aria-label={`Spark - ${sparkName}`}
        tabIndex={0}
      >
        {/* Écureuil SVG principal */}
        <SparkSVG
          mood={mood}
          level={level}
          accessory={accessory}
          size={sparkData.size === 'small' ? 96 : sparkData.size === 'large' ? 144 : 128}
        />

        {/* Particules de sparkles (pour animations spéciales) */}
        {(animation === 'celebration' || animation === 'evolution') && (
          <>
            {[...Array(6)].map((_, i) => (
              <motion.span
                key={i}
                initial={{
                  opacity: 0,
                  scale: 0,
                  x: 0,
                  y: 0
                }}
                animate={{
                  opacity: [0, 1, 0],
                  scale: [0, 1, 0],
                  x: [0, (i % 2 === 0 ? 1 : -1) * (20 + i * 10)],
                  y: [0, -20 - i * 5],
                }}
                transition={{
                  duration: 1,
                  delay: i * 0.1,
                  repeat: animation === 'celebration' ? 2 : 0
                }}
                className="absolute top-0 left-1/2 text-2xl"
              >
                ✨
              </motion.span>
            ))}
          </>
        )}

        {/* Indicateur de niveau */}
        {isHovered && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="absolute -top-8 left-1/2 transform -translate-x-1/2 whitespace-nowrap"
          >
            <span className="text-xs font-bold bg-black/70 text-white px-2 py-1 rounded-full">
              {sparkName}
            </span>
          </motion.div>
        )}
      </motion.div>

      {/* Noisette qui tombe (easter egg pour certaines animations) */}
      {animation === 'collect' && (
        <motion.span
          initial={{ opacity: 1, y: -50, x: 0 }}
          animate={{
            opacity: [1, 1, 0],
            y: 20,
            rotate: 360
          }}
          transition={{ duration: 1 }}
          className="absolute top-0 left-1/2 text-4xl"
        >
          🌰
        </motion.span>
      )}
    </div>
  );
};

export default Spark;
