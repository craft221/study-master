/**
 * Types TypeScript pour Spark la Mascotte ⚡🐿️
 */

export type SparkMood =
  | 'happy'
  | 'excited'
  | 'sad'
  | 'thinking'
  | 'encouraging'
  | 'sleeping'
  | 'helpful'
  | 'sarcastic'
  | 'proud'
  | 'worried'
  | 'playful';

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
  | 'evolution';

export type SparkEvent =
  | 'welcome'
  | 'quiz_success'
  | 'quiz_failed'
  | 'streak'
  | 'idle'
  | 'new_accessory'
  | 'level_up'
  | 'flashcard_created'
  | 'note_created'
  | 'achievement';

export interface SparkState {
  name: string;
  level: number;
  level_name: string;
  unlocked_accessories: string[];
  current_accessory: string | null;
  total_accessories: number;
  user_xp: number;
  user_streak: number;
}

export interface SparkMessage {
  message: string;
  mood: SparkMood;
  animation: SparkAnimation;
  timestamp: string;
}

export interface SparkAccessory {
  id: string;
  name: string;
  description: string;
  emoji: string;
  requirement: string;
  is_unlocked: boolean;
}

export interface SparkAccessoriesResponse {
  accessories: SparkAccessory[];
  unlocked_count: number;
  total_count: number;
  newly_unlocked?: string[];
}

export interface SparkMessageRequest {
  event: SparkEvent;
  use_ai?: boolean;
  context?: Record<string, any>;
}

export interface SparkUpdateRequest {
  name?: string;
  current_accessory?: string;
}

export interface SparkHintRequest {
  topic: string;
  difficulty?: 'easy' | 'medium' | 'hard';
}

export interface SparkHintResponse {
  hint: string;
  mood: SparkMood;
  animation: SparkAnimation;
}

/**
 * Configuration des niveaux de Spark
 * Spark évolue aux niveaux utilisateur 5, 10, 15 et 20
 */
export const SPARK_LEVEL_CONFIG = {
  1: { name: 'Spark Bébé', emoji: '🐿️', userLevelRequired: 1 },       // Niveaux 1-4
  2: { name: 'Spark Junior', emoji: '🐿️✨', userLevelRequired: 5 },   // Niveaux 5-9
  3: { name: 'Spark Expert', emoji: '🐿️⚡', userLevelRequired: 10 },  // Niveaux 10-14
  4: { name: 'Spark Sage', emoji: '🐿️📚', userLevelRequired: 15 },    // Niveaux 15-19
  5: { name: 'Spark Légendaire', emoji: '🐿️👑', userLevelRequired: 20 }, // Niveau 20+
} as const;

/**
 * Configuration des accessoires
 */
export const ACCESSORY_CONFIG = {
  graduate_hat: {
    name: 'Chapeau de Diplômé',
    emoji: '🎓',
    requirement: '100 flashcards créées',
  },
  glasses: {
    name: 'Lunettes d\'Érudit',
    emoji: '👓',
    requirement: '10 jours de série',
  },
  golden_acorn: {
    name: 'Noisette en Or',
    emoji: '🌰✨',
    requirement: '1000 XP atteints',
  },
  lightning_cape: {
    name: 'Cape d\'Éclair',
    emoji: '⚡',
    requirement: 'Niveau 10 atteint',
  },
  mini_library: {
    name: 'Mini Bibliothèque',
    emoji: '📚',
    requirement: '50 notes créées',
  },
  trophy: {
    name: 'Trophée du Champion',
    emoji: '🏆',
    requirement: '20 quiz complétés',
  },
  crown: {
    name: 'Couronne Légendaire',
    emoji: '👑',
    requirement: '30 jours de série',
  },
} as const;
