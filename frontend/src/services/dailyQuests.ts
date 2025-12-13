import api from '@/lib/api'

// ==================== TYPES ====================

export type QuestType =
  | 'review_flashcards'
  | 'complete_quiz'
  | 'study_minutes'
  | 'earn_xp'
  | 'maintain_streak'
  | 'create_notes'
  | 'create_flashcards'
  | 'win_duel'
  | 'join_focus_room'
  | 'perfect_quiz'

export type QuestDifficulty = 'easy' | 'medium' | 'hard'

export type QuestStatus = 'pending' | 'in_progress' | 'completed' | 'claimed' | 'expired'

export type ChestRarity = 'common' | 'rare' | 'epic' | 'legendary'

// ==================== INTERFACES ====================

export interface SparkMessage {
  mood: string
  text: string
}

export interface Quest {
  id: number
  quest_type: QuestType
  difficulty: QuestDifficulty
  title: string
  description: string | null
  icon: string
  target_value: number
  current_value: number
  xp_reward: number
  status: QuestStatus
  progress_percent: number
  completed_at: string | null
  claimed_at: string | null
}

export interface DailyQuestsResponse {
  quests: Quest[]
  stats: {
    total_completed: number
    total_claimed: number
    all_completed: boolean
    bonus_available: boolean
    bonus_claimed: boolean
    spark_message: SparkMessage
  }
  spark_message: SparkMessage
}

export interface ClaimRewardResponse {
  success: boolean
  xp_earned: number
  spark_message: SparkMessage
}

export interface ClaimBonusResponse {
  success: boolean
  bonus_xp: number
  chest_id: number
  chest_rarity: ChestRarity
  quest_streak: number
  spark_message: SparkMessage
  milestone_bonus: {
    streak: number
    xp: number
    chest_rarity: ChestRarity
  } | null
}

export interface StreakStats {
  current_streak: number
  longest_streak: number
  total_quests_completed: number
  total_bonus_claimed: number
  total_xp_from_quests: number
}

export interface MysteryChest {
  id: number
  rarity: ChestRarity
  source: string
  is_opened: boolean
  contents: {
    xp?: number
    accessory?: string
    title?: string
    theme?: string
  } | null
  created_at: string
}

export interface OpenChestResponse {
  success: boolean
  chest_id: number
  rarity: ChestRarity
  contents: {
    xp?: number
    accessory?: string
    title?: string
    theme?: string
  }
  spark_message: SparkMessage
}

export interface SparkContextualMessage {
  context: string
  days_absent: number
  current_streak: number
  spark_message: SparkMessage
}

// ==================== API FUNCTIONS ====================

/**
 * Recupere les objectifs quotidiens de l'utilisateur
 */
export async function getDailyQuests(): Promise<DailyQuestsResponse> {
  const response = await api.get('/daily-quests/')
  return response.data
}

/**
 * Reclame la recompense d'un objectif complete
 */
export async function claimQuestReward(questId: number): Promise<ClaimRewardResponse> {
  const response = await api.post(`/daily-quests/${questId}/claim`)
  return response.data
}

/**
 * Reclame le bonus quotidien (3/3 objectifs completes)
 */
export async function claimDailyBonus(): Promise<ClaimBonusResponse> {
  const response = await api.post('/daily-quests/bonus/claim')
  return response.data
}

/**
 * Recupere les statistiques de streak des quests
 */
export async function getQuestStreakStats(): Promise<StreakStats> {
  const response = await api.get('/daily-quests/streak')
  return response.data
}

/**
 * Recupere les coffres mystere de l'utilisateur
 */
export async function getMysteryChests(unopenedOnly: boolean = true): Promise<MysteryChest[]> {
  const response = await api.get('/daily-quests/chests', {
    params: { unopened_only: unopenedOnly }
  })
  return response.data
}

/**
 * Ouvre un coffre mystere
 */
export async function openMysteryChest(chestId: number): Promise<OpenChestResponse> {
  const response = await api.post(`/daily-quests/chests/${chestId}/open`)
  return response.data
}

/**
 * Recupere un message contextuel de Spark
 */
export async function getSparkContextualMessage(
  context: 'welcome' | 'streak_reminder' | 'absence' | 'return' = 'welcome'
): Promise<SparkContextualMessage> {
  const response = await api.get('/daily-quests/spark-message', {
    params: { context }
  })
  return response.data
}

// ==================== HELPERS ====================

/**
 * Retourne la couleur selon la difficulte
 */
export function getDifficultyColor(difficulty: QuestDifficulty): string {
  switch (difficulty) {
    case 'easy':
      return 'green'
    case 'medium':
      return 'yellow'
    case 'hard':
      return 'red'
    default:
      return 'gray'
  }
}

/**
 * Retourne l'XP selon la difficulte
 */
export function getDifficultyXP(difficulty: QuestDifficulty): number {
  switch (difficulty) {
    case 'easy':
      return 10
    case 'medium':
      return 25
    case 'hard':
      return 40
    default:
      return 0
  }
}

/**
 * Retourne le label de difficulte
 */
export function getDifficultyLabel(difficulty: QuestDifficulty): string {
  switch (difficulty) {
    case 'easy':
      return 'Facile'
    case 'medium':
      return 'Moyen'
    case 'hard':
      return 'Difficile'
    default:
      return difficulty
  }
}

/**
 * Retourne la couleur selon la rarete du coffre
 */
export function getChestRarityColor(rarity: ChestRarity): string {
  switch (rarity) {
    case 'common':
      return 'gray'
    case 'rare':
      return 'blue'
    case 'epic':
      return 'purple'
    case 'legendary':
      return 'yellow'
    default:
      return 'gray'
  }
}

/**
 * Retourne l'emoji du coffre selon la rarete
 */
export function getChestEmoji(rarity: ChestRarity): string {
  switch (rarity) {
    case 'common':
      return '📦'
    case 'rare':
      return '💎'
    case 'epic':
      return '👑'
    case 'legendary':
      return '🌟'
    default:
      return '📦'
  }
}

/**
 * Retourne le label de rarete
 */
export function getChestRarityLabel(rarity: ChestRarity): string {
  switch (rarity) {
    case 'common':
      return 'Commun'
    case 'rare':
      return 'Rare'
    case 'epic':
      return 'Epique'
    case 'legendary':
      return 'Legendaire'
    default:
      return rarity
  }
}

/**
 * Retourne l'humeur de Spark en emoji
 */
export function getSparkMoodEmoji(mood: string): string {
  switch (mood) {
    case 'excited':
      return '🤩'
    case 'happy':
      return '😊'
    case 'proud':
      return '😎'
    case 'encouraging':
      return '💪'
    case 'worried':
      return '😟'
    case 'sad':
      return '😢'
    case 'crying':
      return '😭'
    case 'angry':
      return '😤'
    case 'dramatic':
      return '🎭'
    case 'desperate':
      return '😰'
    case 'relieved':
      return '😮‍💨'
    default:
      return '😊'
  }
}
