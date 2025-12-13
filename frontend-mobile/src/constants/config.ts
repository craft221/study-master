/**
 * Study Master - Configuration
 */

import Constants from 'expo-constants';

// ============================================
// API CONFIGURATION
// ============================================

// En développement, utiliser l'IP locale pour accéder au backend Docker
const DEV_API_URL = 'http://192.168.1.100:8000/api/v1'; // À ajuster selon votre réseau
const PROD_API_URL = 'https://api.studymaster.app/api/v1';

export const API_URL = __DEV__ ? DEV_API_URL : PROD_API_URL;

// WebSocket URLs
export const WS_URL = __DEV__
  ? 'ws://192.168.1.100:8000/api/v1/ws'
  : 'wss://api.studymaster.app/api/v1/ws';

// ============================================
// APP CONFIGURATION
// ============================================

export const APP_CONFIG = {
  name: 'Study Master',
  version: Constants.expoConfig?.version || '1.0.0',
  buildNumber: Constants.expoConfig?.ios?.buildNumber || '1',

  // Limites
  limits: {
    maxNoteLength: 50000,
    maxFlashcardFront: 1000,
    maxFlashcardBack: 2000,
    maxQuizQuestions: 50,
    maxTags: 10,
    maxFileSize: 10 * 1024 * 1024, // 10MB
  },

  // Timeouts
  timeouts: {
    api: 30000,
    upload: 60000,
    websocket: 5000,
  },

  // Cache
  cache: {
    userStatsTTL: 2 * 60 * 1000, // 2 minutes
    mascotStateTTL: 5 * 60 * 1000, // 5 minutes
    achievementsTTL: 60 * 60 * 1000, // 1 heure
    leaderboardTTL: 15 * 60 * 1000, // 15 minutes
  },

  // Pagination
  pagination: {
    defaultPageSize: 20,
    maxPageSize: 100,
  },

  // Study Sessions
  studySession: {
    pomodoroMinutes: 25,
    shortBreakMinutes: 5,
    longBreakMinutes: 15,
    sessionsBeforeLongBreak: 4,
  },

  // Gamification
  gamification: {
    xpPerFlashcardReview: 5,
    xpPerCorrectFlashcard: 10,
    xpPerQuizComplete: 20,
    xpPerPerfectQuiz: 50,
    xpPerNoteCreated: 15,
    xpPerStudyMinute: 1,
    xpPerStreakDay: 25,
    xpPerDuelWin: 50,
    focusRoomBonus: 0.2, // 20%
    duelLossPenalty: 0.5, // 50% de l'enjeu
  },

  // Spaced Repetition
  spacedRepetition: {
    defaultEaseFactor: 2.5,
    minEaseFactor: 1.3,
    maxInterval: 365, // jours
    learningSteps: [1, 10], // minutes
    graduatingInterval: 1, // jour
    easyBonus: 1.3,
    intervalModifier: 1.0,
  },

  // Notifications
  notifications: {
    quietHoursStart: 22, // 22h
    quietHoursEnd: 8, // 8h
    reminderChannelId: 'study-reminders',
    duelChannelId: 'duels',
    achievementChannelId: 'achievements',
  },

  // Features flags
  features: {
    enableOfflineMode: true,
    enablePushNotifications: true,
    enableBiometricAuth: true,
    enableAI: true,
    enableDuels: true,
    enableFocusRooms: true,
    enableStudyGroups: true,
    enableOCR: true,
  },
} as const;

// ============================================
// STORAGE KEYS
// ============================================

export const STORAGE_KEYS = {
  // Auth
  ACCESS_TOKEN: 'access_token',
  REFRESH_TOKEN: 'refresh_token',
  USER: 'user',

  // Preferences
  THEME: 'theme',
  LANGUAGE: 'language',
  ONBOARDING_COMPLETE: 'onboarding_complete',
  BIOMETRIC_ENABLED: 'biometric_enabled',

  // Cache
  USER_STATS: 'cache_user_stats',
  MASCOT_STATE: 'cache_mascot_state',
  SUBJECTS: 'cache_subjects',
  ACHIEVEMENTS: 'cache_achievements',

  // Offline
  PENDING_SYNC: 'pending_sync',
  OFFLINE_NOTES: 'offline_notes',
  OFFLINE_FLASHCARDS: 'offline_flashcards',

  // Study
  CURRENT_SESSION: 'current_session',
  SESSION_HISTORY: 'session_history',

  // Settings
  NOTIFICATION_PREFERENCES: 'notification_preferences',
  DAILY_GOAL: 'daily_goal',
  REMINDER_TIME: 'reminder_time',
} as const;

// ============================================
// REGEX PATTERNS
// ============================================

export const PATTERNS = {
  email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  username: /^[a-zA-Z0-9_-]{3,30}$/,
  password: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/,
} as const;

// ============================================
// ERROR MESSAGES
// ============================================

export const ERROR_MESSAGES = {
  network: 'Impossible de se connecter au serveur. Vérifiez votre connexion internet.',
  unauthorized: 'Session expirée. Veuillez vous reconnecter.',
  forbidden: 'Accès refusé.',
  notFound: 'Ressource non trouvée.',
  serverError: 'Erreur serveur. Veuillez réessayer plus tard.',
  unknown: 'Une erreur est survenue. Veuillez réessayer.',
  validation: {
    required: 'Ce champ est requis.',
    email: 'Veuillez entrer une adresse email valide.',
    username: 'Le nom d\'utilisateur doit contenir entre 3 et 30 caractères (lettres, chiffres, _ ou -).',
    password: 'Le mot de passe doit contenir au moins 8 caractères, une majuscule, une minuscule et un chiffre.',
    passwordMatch: 'Les mots de passe ne correspondent pas.',
    minLength: (min: number) => `Minimum ${min} caractères requis.`,
    maxLength: (max: number) => `Maximum ${max} caractères autorisés.`,
  },
} as const;

// ============================================
// SUCCESS MESSAGES
// ============================================

export const SUCCESS_MESSAGES = {
  login: 'Connexion réussie !',
  register: 'Inscription réussie ! Bienvenue sur Study Master.',
  logout: 'Déconnexion réussie.',
  noteCreated: 'Note créée avec succès.',
  noteUpdated: 'Note mise à jour.',
  noteDeleted: 'Note supprimée.',
  flashcardCreated: 'Flashcard créée.',
  flashcardReviewed: 'Bien joué ! Continue comme ça.',
  quizCompleted: 'Quiz terminé !',
  achievementUnlocked: 'Nouveau succès débloqué !',
  levelUp: 'Félicitations ! Tu as atteint le niveau',
  streakMaintained: 'Streak maintenu ! 🔥',
  duelWon: 'Victoire ! Tu as gagné le duel.',
  duelLost: 'Défaite. Tu feras mieux la prochaine fois !',
  sync: 'Synchronisation réussie.',
} as const;

export default APP_CONFIG;
