/**
 * Framer Motion Animation Variants
 * Centralized animation configurations for consistent UX across the app
 */

import { Variants } from 'framer-motion'

// ============================================
// PAGE TRANSITIONS
// ============================================

export const pageVariants: Variants = {
  initial: {
    opacity: 0,
    y: 20,
  },
  animate: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.4,
      ease: [0.25, 0.1, 0.25, 1], // Custom easing
    },
  },
  exit: {
    opacity: 0,
    y: -20,
    transition: {
      duration: 0.3,
    },
  },
}

export const pageSlideVariants: Variants = {
  initial: {
    opacity: 0,
    x: -50,
  },
  animate: {
    opacity: 1,
    x: 0,
    transition: {
      duration: 0.5,
      ease: [0.16, 1, 0.3, 1], // Smooth ease out
    },
  },
  exit: {
    opacity: 0,
    x: 50,
    transition: {
      duration: 0.3,
    },
  },
}

// ============================================
// CARD ANIMATIONS
// ============================================

export const cardVariants: Variants = {
  initial: {
    opacity: 0,
    y: 30,
    scale: 0.95,
  },
  animate: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      duration: 0.4,
      ease: [0.25, 0.1, 0.25, 1],
    },
  },
  hover: {
    y: -4,
    scale: 1.02,
    transition: {
      duration: 0.2,
      ease: 'easeOut',
    },
  },
  tap: {
    scale: 0.98,
    transition: {
      duration: 0.1,
    },
  },
}

export const cardHoverVariants: Variants = {
  rest: {
    scale: 1,
    y: 0,
  },
  hover: {
    scale: 1.03,
    y: -5,
    transition: {
      duration: 0.3,
      ease: [0.25, 0.1, 0.25, 1],
    },
  },
}

// ============================================
// STAGGER ANIMATIONS (for lists)
// ============================================

export const containerVariants: Variants = {
  initial: {},
  animate: {
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.1,
    },
  },
}

export const itemVariants: Variants = {
  initial: {
    opacity: 0,
    y: 20,
  },
  animate: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.4,
      ease: [0.25, 0.1, 0.25, 1],
    },
  },
}

export const staggerFastVariants: Variants = {
  initial: {},
  animate: {
    transition: {
      staggerChildren: 0.05,
      delayChildren: 0.05,
    },
  },
}

// ============================================
// MODAL/DIALOG ANIMATIONS
// ============================================

export const modalBackdropVariants: Variants = {
  initial: {
    opacity: 0,
  },
  animate: {
    opacity: 1,
    transition: {
      duration: 0.2,
    },
  },
  exit: {
    opacity: 0,
    transition: {
      duration: 0.2,
    },
  },
}

export const modalContentVariants: Variants = {
  initial: {
    opacity: 0,
    scale: 0.9,
    y: 20,
  },
  animate: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: {
      duration: 0.3,
      ease: [0.25, 0.1, 0.25, 1],
    },
  },
  exit: {
    opacity: 0,
    scale: 0.95,
    y: 10,
    transition: {
      duration: 0.2,
    },
  },
}

export const slideUpVariants: Variants = {
  initial: {
    y: '100%',
    opacity: 0,
  },
  animate: {
    y: 0,
    opacity: 1,
    transition: {
      duration: 0.4,
      ease: [0.25, 0.1, 0.25, 1],
    },
  },
  exit: {
    y: '100%',
    opacity: 0,
    transition: {
      duration: 0.3,
    },
  },
}

// ============================================
// BUTTON ANIMATIONS
// ============================================

export const buttonVariants: Variants = {
  rest: {
    scale: 1,
  },
  hover: {
    scale: 1.05,
    transition: {
      duration: 0.2,
      ease: 'easeOut',
    },
  },
  tap: {
    scale: 0.95,
    transition: {
      duration: 0.1,
    },
  },
}

export const iconButtonVariants: Variants = {
  rest: {
    scale: 1,
    rotate: 0,
  },
  hover: {
    scale: 1.1,
    transition: {
      duration: 0.2,
    },
  },
  tap: {
    scale: 0.9,
    rotate: -5,
    transition: {
      duration: 0.1,
    },
  },
}

// ============================================
// NOTIFICATION/TOAST ANIMATIONS
// ============================================

export const toastVariants: Variants = {
  initial: {
    opacity: 0,
    x: 100,
    scale: 0.8,
  },
  animate: {
    opacity: 1,
    x: 0,
    scale: 1,
    transition: {
      duration: 0.3,
      ease: [0.25, 0.1, 0.25, 1],
    },
  },
  exit: {
    opacity: 0,
    x: 100,
    scale: 0.8,
    transition: {
      duration: 0.2,
    },
  },
}

// ============================================
// FORM ANIMATIONS
// ============================================

export const formFieldVariants: Variants = {
  initial: {
    opacity: 0,
    x: -20,
  },
  animate: {
    opacity: 1,
    x: 0,
    transition: {
      duration: 0.3,
    },
  },
}

export const errorVariants: Variants = {
  initial: {
    opacity: 0,
    height: 0,
    y: -10,
  },
  animate: {
    opacity: 1,
    height: 'auto',
    y: 0,
    transition: {
      duration: 0.3,
      ease: [0.25, 0.1, 0.25, 1],
    },
  },
  exit: {
    opacity: 0,
    height: 0,
    y: -10,
    transition: {
      duration: 0.2,
    },
  },
}

// ============================================
// LOADING ANIMATIONS
// ============================================

export const spinVariants: Variants = {
  animate: {
    rotate: 360,
    transition: {
      duration: 1,
      repeat: Infinity,
      ease: 'linear',
    },
  },
}

export const pulseVariants: Variants = {
  animate: {
    scale: [1, 1.05, 1],
    opacity: [1, 0.8, 1],
    transition: {
      duration: 2,
      repeat: Infinity,
      ease: 'easeInOut',
    },
  },
}

export const skeletonVariants: Variants = {
  animate: {
    opacity: [0.5, 1, 0.5],
    transition: {
      duration: 1.5,
      repeat: Infinity,
      ease: 'easeInOut',
    },
  },
}

// ============================================
// SPECIAL EFFECTS
// ============================================

export const fadeInUpVariants: Variants = {
  initial: {
    opacity: 0,
    y: 40,
  },
  animate: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.5,
      ease: [0.25, 0.1, 0.25, 1],
    },
  },
}

export const scaleInVariants: Variants = {
  initial: {
    opacity: 0,
    scale: 0,
  },
  animate: {
    opacity: 1,
    scale: 1,
    transition: {
      duration: 0.5,
      ease: [0.34, 1.56, 0.64, 1], // Spring-like easing
    },
  },
}

export const bounceVariants: Variants = {
  animate: {
    y: [0, -10, 0],
    transition: {
      duration: 0.6,
      repeat: Infinity,
      repeatDelay: 2,
      ease: 'easeOut',
    },
  },
}

// ============================================
// FLASHCARD FLIP ANIMATION
// ============================================

export const flipVariants = {
  front: {
    rotateY: 0,
    transition: {
      duration: 0.6,
      ease: [0.34, 1.56, 0.64, 1],
    },
  },
  back: {
    rotateY: 180,
    transition: {
      duration: 0.6,
      ease: [0.34, 1.56, 0.64, 1],
    },
  },
}

// ============================================
// NAVIGATION/MENU ANIMATIONS
// ============================================

export const menuVariants: Variants = {
  closed: {
    opacity: 0,
    scale: 0.95,
    y: -20,
    transition: {
      duration: 0.2,
    },
  },
  open: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: {
      duration: 0.3,
      ease: [0.25, 0.1, 0.25, 1],
    },
  },
}

export const menuItemVariants: Variants = {
  closed: {
    opacity: 0,
    x: -20,
  },
  open: (i: number) => ({
    opacity: 1,
    x: 0,
    transition: {
      delay: i * 0.05,
      duration: 0.3,
    },
  }),
}

// ============================================
// HOVER GLOW EFFECT
// ============================================

export const glowVariants: Variants = {
  rest: {
    boxShadow: '0 0 0 rgba(139, 92, 246, 0)',
  },
  hover: {
    boxShadow: '0 0 20px rgba(139, 92, 246, 0.5)',
    transition: {
      duration: 0.3,
    },
  },
}

// ============================================
// SUCCESS/CONFETTI ANIMATION
// ============================================

export const successVariants: Variants = {
  initial: {
    scale: 0,
    rotate: -180,
  },
  animate: {
    scale: [0, 1.2, 1],
    rotate: 0,
    transition: {
      duration: 0.6,
      ease: [0.34, 1.56, 0.64, 1],
    },
  },
}

// ============================================
// CUSTOM SPRING CONFIGS
// ============================================

export const springConfig = {
  type: 'spring',
  stiffness: 300,
  damping: 25,
}

export const gentleSpring = {
  type: 'spring',
  stiffness: 100,
  damping: 15,
}

export const bouncySpring = {
  type: 'spring',
  stiffness: 400,
  damping: 10,
}

// ============================================
// UTILITY: Generate stagger delay
// ============================================

export const generateStagger = (index: number, baseDelay = 0.05) => {
  return {
    transition: {
      delay: index * baseDelay,
    },
  }
}
