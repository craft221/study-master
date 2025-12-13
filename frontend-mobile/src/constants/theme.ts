/**
 * Study Master - Design System
 * Thème cohérent avec le frontend web
 */

// ============================================
// COULEURS
// ============================================

export const Colors = {
  // Primary - Sky Blue
  primary: {
    50: '#f0f9ff',
    100: '#e0f2fe',
    200: '#bae6fd',
    300: '#7dd3fc',
    400: '#38bdf8',
    500: '#0ea5e9', // Main primary
    600: '#0284c7',
    700: '#0369a1',
    800: '#075985',
    900: '#0c4a6e',
  },

  // Secondary - Slate
  secondary: {
    50: '#f8fafc',
    100: '#f1f5f9',
    200: '#e2e8f0',
    300: '#cbd5e1',
    400: '#94a3b8',
    500: '#64748b',
    600: '#475569',
    700: '#334155',
    800: '#1e293b',
    900: '#0f172a',
  },

  // Accent Colors
  accent: {
    orange: '#ff8c42',      // Spark mascot / Streaks
    orangeLight: '#ffb380',
    orangeDark: '#ff6b35',
    gold: '#fbbf24',        // XP / Achievements
    goldLight: '#fde68a',
    purple: '#a855f7',      // AI / Flashcards
    purpleLight: '#c084fc',
    green: '#10b981',       // Success / Study time
    greenLight: '#34d399',
    red: '#ef4444',         // Error / Destructive
    redLight: '#f87171',
    cyan: '#06b6d4',        // Info / Helpful
    cyanLight: '#22d3ee',
    pink: '#ec4899',        // Special
    pinkLight: '#f472b6',
  },

  // Semantic
  success: '#10b981',
  warning: '#f59e0b',
  error: '#ef4444',
  info: '#0ea5e9',

  // Grayscale
  gray: {
    50: '#f9fafb',
    100: '#f3f4f6',
    200: '#e5e7eb',
    300: '#d1d5db',
    400: '#9ca3af',
    500: '#6b7280',
    600: '#4b5563',
    700: '#374151',
    800: '#1f2937',
    900: '#111827',
  },

  // Special
  white: '#ffffff',
  black: '#000000',
  transparent: 'transparent',

  // Spark Mascot Colors
  spark: {
    body: '#ff8c42',
    bodyLight: '#ffa500',
    belly: '#fff8e7',
    accent: '#ffd700',
    shadow: '#e67332',
  },
} as const;

// ============================================
// THÈMES LIGHT / DARK
// ============================================

export const LightTheme = {
  dark: false,
  colors: {
    // Backgrounds
    background: '#ffffff',
    surface: '#f8fafc',
    surfaceVariant: '#f1f5f9',
    card: '#ffffff',

    // Text
    text: '#0f172a',
    textSecondary: '#64748b',
    textTertiary: '#94a3b8',
    textInverse: '#ffffff',

    // Interactive
    primary: Colors.primary[500],
    primaryContainer: Colors.primary[100],
    secondary: Colors.secondary[500],
    secondaryContainer: Colors.secondary[100],

    // Borders
    border: '#e2e8f0',
    borderLight: '#f1f5f9',
    divider: '#e5e7eb',

    // Status
    success: Colors.success,
    successContainer: '#d1fae5',
    warning: Colors.warning,
    warningContainer: '#fef3c7',
    error: Colors.error,
    errorContainer: '#fee2e2',
    info: Colors.info,
    infoContainer: '#e0f2fe',

    // Overlays
    overlay: 'rgba(0, 0, 0, 0.5)',
    overlayLight: 'rgba(0, 0, 0, 0.3)',

    // Shadows
    shadow: '#000000',

    // Tab Bar
    tabBar: '#ffffff',
    tabBarBorder: '#e2e8f0',
    tabActive: Colors.primary[500],
    tabInactive: Colors.gray[400],

    // Input
    inputBackground: '#f8fafc',
    inputBorder: '#e2e8f0',
    inputFocusBorder: Colors.primary[500],
    placeholder: '#94a3b8',
  },
};

export const DarkTheme = {
  dark: true,
  colors: {
    // Backgrounds
    background: '#0f172a',
    surface: '#1e293b',
    surfaceVariant: '#334155',
    card: '#1e293b',

    // Text
    text: '#f8fafc',
    textSecondary: '#94a3b8',
    textTertiary: '#64748b',
    textInverse: '#0f172a',

    // Interactive
    primary: Colors.primary[400],
    primaryContainer: Colors.primary[900],
    secondary: Colors.secondary[400],
    secondaryContainer: Colors.secondary[800],

    // Borders
    border: '#334155',
    borderLight: '#475569',
    divider: '#374151',

    // Status
    success: Colors.accent.greenLight,
    successContainer: '#064e3b',
    warning: Colors.accent.gold,
    warningContainer: '#78350f',
    error: Colors.accent.redLight,
    errorContainer: '#7f1d1d',
    info: Colors.primary[400],
    infoContainer: '#0c4a6e',

    // Overlays
    overlay: 'rgba(0, 0, 0, 0.7)',
    overlayLight: 'rgba(0, 0, 0, 0.5)',

    // Shadows
    shadow: '#000000',

    // Tab Bar
    tabBar: '#1e293b',
    tabBarBorder: '#334155',
    tabActive: Colors.primary[400],
    tabInactive: Colors.gray[500],

    // Input
    inputBackground: '#334155',
    inputBorder: '#475569',
    inputFocusBorder: Colors.primary[400],
    placeholder: '#64748b',
  },
};

// ============================================
// TYPOGRAPHIE
// ============================================

export const Typography = {
  // Font Families (utilisant les polices système)
  fontFamily: {
    regular: 'System',
    medium: 'System',
    semibold: 'System',
    bold: 'System',
  },

  // Font Sizes
  fontSize: {
    xs: 12,
    sm: 14,
    base: 16,
    lg: 18,
    xl: 20,
    '2xl': 24,
    '3xl': 30,
    '4xl': 36,
    '5xl': 48,
  },

  // Line Heights
  lineHeight: {
    tight: 1.25,
    normal: 1.5,
    relaxed: 1.625,
    loose: 2,
  },

  // Font Weights (React Native style)
  fontWeight: {
    normal: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
    extrabold: '800' as const,
  },

  // Letter Spacing
  letterSpacing: {
    tighter: -0.5,
    tight: -0.25,
    normal: 0,
    wide: 0.25,
    wider: 0.5,
  },
};

// Presets typographiques
export const TextStyles = {
  // Headings
  h1: {
    fontSize: Typography.fontSize['3xl'],
    fontWeight: Typography.fontWeight.bold,
    lineHeight: Typography.fontSize['3xl'] * Typography.lineHeight.tight,
  },
  h2: {
    fontSize: Typography.fontSize['2xl'],
    fontWeight: Typography.fontWeight.bold,
    lineHeight: Typography.fontSize['2xl'] * Typography.lineHeight.tight,
  },
  h3: {
    fontSize: Typography.fontSize.xl,
    fontWeight: Typography.fontWeight.semibold,
    lineHeight: Typography.fontSize.xl * Typography.lineHeight.tight,
  },
  h4: {
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.semibold,
    lineHeight: Typography.fontSize.lg * Typography.lineHeight.normal,
  },

  // Body
  bodyLarge: {
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.normal,
    lineHeight: Typography.fontSize.lg * Typography.lineHeight.relaxed,
  },
  body: {
    fontSize: Typography.fontSize.base,
    fontWeight: Typography.fontWeight.normal,
    lineHeight: Typography.fontSize.base * Typography.lineHeight.normal,
  },
  bodySmall: {
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.normal,
    lineHeight: Typography.fontSize.sm * Typography.lineHeight.normal,
  },

  // Labels
  label: {
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.medium,
    lineHeight: Typography.fontSize.sm * Typography.lineHeight.normal,
  },
  labelSmall: {
    fontSize: Typography.fontSize.xs,
    fontWeight: Typography.fontWeight.medium,
    lineHeight: Typography.fontSize.xs * Typography.lineHeight.normal,
  },

  // Special
  caption: {
    fontSize: Typography.fontSize.xs,
    fontWeight: Typography.fontWeight.normal,
    lineHeight: Typography.fontSize.xs * Typography.lineHeight.normal,
  },
  button: {
    fontSize: Typography.fontSize.base,
    fontWeight: Typography.fontWeight.semibold,
    lineHeight: Typography.fontSize.base * Typography.lineHeight.tight,
  },
  buttonSmall: {
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.semibold,
    lineHeight: Typography.fontSize.sm * Typography.lineHeight.tight,
  },

  // Stats / Numbers
  statLarge: {
    fontSize: Typography.fontSize['4xl'],
    fontWeight: Typography.fontWeight.bold,
    lineHeight: Typography.fontSize['4xl'] * Typography.lineHeight.tight,
  },
  stat: {
    fontSize: Typography.fontSize['2xl'],
    fontWeight: Typography.fontWeight.bold,
    lineHeight: Typography.fontSize['2xl'] * Typography.lineHeight.tight,
  },
};

// ============================================
// ESPACEMENTS
// ============================================

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 20,
  xl: 24,
  '2xl': 32,
  '3xl': 40,
  '4xl': 48,
  '5xl': 64,
} as const;

// ============================================
// BORDURES & RAYONS
// ============================================

export const BorderRadius = {
  none: 0,
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  '2xl': 20,
  '3xl': 24,
  full: 9999,
} as const;

export const BorderWidth = {
  none: 0,
  hairline: 0.5,
  thin: 1,
  base: 1.5,
  thick: 2,
} as const;

// ============================================
// OMBRES
// ============================================

export const Shadows = {
  none: {
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  base: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 4,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  xl: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 12,
  },
  glow: (color: string) => ({
    shadowColor: color,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  }),
} as const;

// ============================================
// ANIMATIONS
// ============================================

export const Animation = {
  // Durées
  duration: {
    instant: 100,
    fast: 200,
    normal: 300,
    slow: 500,
    slower: 700,
  },

  // Springs (pour react-native-reanimated)
  spring: {
    gentle: {
      damping: 15,
      stiffness: 100,
      mass: 1,
    },
    default: {
      damping: 20,
      stiffness: 300,
      mass: 1,
    },
    bouncy: {
      damping: 10,
      stiffness: 400,
      mass: 0.8,
    },
    stiff: {
      damping: 30,
      stiffness: 500,
      mass: 1,
    },
  },

  // Easing (pour Animated)
  easing: {
    easeInOut: 'ease-in-out',
    easeOut: 'ease-out',
    easeIn: 'ease-in',
    linear: 'linear',
  },
} as const;

// ============================================
// Z-INDEX
// ============================================

export const ZIndex = {
  base: 0,
  dropdown: 10,
  sticky: 20,
  fixed: 30,
  modal: 40,
  popover: 50,
  tooltip: 60,
  toast: 70,
  overlay: 80,
  max: 100,
} as const;

// ============================================
// TAILLES D'ICÔNES
// ============================================

export const IconSize = {
  xs: 12,
  sm: 16,
  md: 20,
  base: 24,
  lg: 28,
  xl: 32,
  '2xl': 40,
  '3xl': 48,
  '4xl': 64,
} as const;

// ============================================
// TAILLES DE COMPOSANTS
// ============================================

export const ComponentSize = {
  // Boutons
  button: {
    sm: { height: 36, paddingHorizontal: 12 },
    md: { height: 44, paddingHorizontal: 16 },
    lg: { height: 52, paddingHorizontal: 24 },
  },

  // Inputs
  input: {
    sm: { height: 36, paddingHorizontal: 12 },
    md: { height: 44, paddingHorizontal: 16 },
    lg: { height: 52, paddingHorizontal: 20 },
  },

  // Avatars
  avatar: {
    xs: 24,
    sm: 32,
    md: 40,
    lg: 56,
    xl: 80,
    '2xl': 120,
  },

  // Cards
  card: {
    padding: Spacing.base,
    paddingLarge: Spacing.xl,
  },

  // Tab Bar
  tabBar: {
    height: 60,
    iconSize: 24,
  },

  // Header
  header: {
    height: 56,
  },
} as const;

// ============================================
// MASCOTTE SPARK
// ============================================

export const SparkConfig = {
  // Tailles par niveau
  size: {
    baby: 96,      // Level 1
    junior: 128,   // Level 2
    expert: 128,   // Level 3
    sage: 144,     // Level 4
    legendary: 144, // Level 5
  },

  // Couleurs par humeur
  mood: {
    happy: {
      primary: '#ff8c42',
      secondary: '#ffa500',
      accent: '#ffd700',
      background: Colors.accent.orangeLight,
    },
    excited: {
      primary: '#ff8c42',
      secondary: '#ffb347',
      accent: '#ffd700',
      background: '#fef3c7',
      glow: true,
    },
    sad: {
      primary: '#b0a090',
      secondary: '#9a8a7a',
      accent: '#c4b5a0',
      background: '#e0f2fe',
    },
    thinking: {
      primary: '#ff8c42',
      secondary: '#b87fcc',
      accent: '#ffd700',
      background: '#f3e8ff',
    },
    encouraging: {
      primary: '#ff8c42',
      secondary: '#ffa500',
      accent: '#10b981',
      background: '#d1fae5',
    },
    sleeping: {
      primary: '#c4b5a0',
      secondary: '#b0a090',
      accent: '#d4c4b0',
      background: '#f3f4f6',
    },
    helpful: {
      primary: '#ff8c42',
      secondary: '#06b6d4',
      accent: '#ffd700',
      background: '#cffafe',
    },
  },

  // Accessoires
  accessories: {
    glasses: { xp: 0, name: 'Lunettes', icon: '👓' },
    graduate_hat: { xp: 1000, name: 'Chapeau diplômé', icon: '🎓' },
    mini_library: { xp: 500, name: 'Mini bibliothèque', icon: '📚' },
    trophy: { xp: 2000, name: 'Trophée', icon: '🏆' },
    golden_acorn: { xp: 5000, name: 'Gland doré', icon: '🌰' },
    lightning_cape: { xp: 10000, name: 'Cape éclair', icon: '⚡' },
    crown: { xp: 20000, name: 'Couronne', icon: '👑' },
  },

  // Niveaux
  levels: {
    1: { name: 'Baby', emoji: '🐿️', minXp: 0 },
    2: { name: 'Junior', emoji: '🐿️✨', minXp: 100 },
    3: { name: 'Expert', emoji: '🐿️⚡', minXp: 500 },
    4: { name: 'Sage', emoji: '🐿️📚', minXp: 1000 },
    5: { name: 'Legendary', emoji: '🐿️👑', minXp: 5000 },
  },
} as const;

// ============================================
// GAMIFICATION
// ============================================

export const GamificationConfig = {
  // XP par action
  xp: {
    flashcardReview: 5,
    flashcardCorrect: 10,
    quizComplete: 20,
    quizPerfect: 50,
    noteCreated: 15,
    studySessionMinute: 1,
    streakDay: 25,
    achievementUnlock: 100,
    duelWin: 50,
    duelLose: -25,
    focusRoomMinute: 1,
    focusRoomBonus: 0.2, // 20% bonus
  },

  // Formule de niveau
  levelFormula: (xp: number) => Math.max(1, Math.floor(Math.sqrt(xp / 100))),
  xpForLevel: (level: number) => level * level * 100,

  // Couleurs des raretés
  rarityColors: {
    common: Colors.gray[400],
    rare: Colors.primary[500],
    epic: Colors.accent.purple,
    legendary: Colors.accent.gold,
  },

  // Badges de streak
  streakMilestones: [3, 7, 14, 30, 60, 100, 365],
} as const;

// ============================================
// EXPORT UNIFIÉ
// ============================================

export const theme = {
  colors: Colors,
  light: LightTheme,
  dark: DarkTheme,
  typography: Typography,
  textStyles: TextStyles,
  spacing: Spacing,
  borderRadius: BorderRadius,
  borderWidth: BorderWidth,
  shadows: Shadows,
  animation: Animation,
  zIndex: ZIndex,
  iconSize: IconSize,
  componentSize: ComponentSize,
  spark: SparkConfig,
  gamification: GamificationConfig,
} as const;

export default theme;
