/**
 * Study Master - Types TypeScript
 * Types correspondant exactement aux modèles backend
 */

// ============================================
// ENUMS
// ============================================

export enum UserRole {
  STUDENT = 'student',
  TEACHER = 'teacher',
  MODERATOR = 'moderator',
  ADMIN = 'admin',
}

export enum SubscriptionType {
  FREE = 'free',
  PREMIUM = 'premium',
  PREMIUM_PLUS = 'premium_plus',
  INSTITUTIONAL = 'institutional',
}

export enum QuizDifficulty {
  EASY = 'easy',
  MEDIUM = 'medium',
  HARD = 'hard',
}

export enum QuizType {
  PRACTICE = 'practice',
  TEST = 'test',
  EXAM = 'exam',
}

export enum QuestionType {
  MULTIPLE_CHOICE = 'multiple_choice',
  TRUE_FALSE = 'true_false',
  SHORT_ANSWER = 'short_answer',
  ESSAY = 'essay',
}

export enum FlashcardStatus {
  NEW = 'new',
  LEARNING = 'learning',
  REVIEW = 'review',
  RELEARNING = 'relearning',
}

export enum DuelStatus {
  PENDING = 'pending',
  ACCEPTED = 'accepted',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  DECLINED = 'declined',
  CANCELLED = 'cancelled',
}

export enum NotificationType {
  DUEL_CHALLENGE = 'duel_challenge',
  DUEL_ACCEPTED = 'duel_accepted',
  DUEL_DECLINED = 'duel_declined',
  DUEL_COMPLETED = 'duel_completed',
  DUEL_WON = 'duel_won',
  DUEL_LOST = 'duel_lost',
  EVENT_REMINDER = 'event_reminder',
  EXAM_REMINDER = 'exam_reminder',
  STREAK_REMINDER = 'streak_reminder',
  STREAK_LOST = 'streak_lost',
  STREAK_MILESTONE = 'streak_milestone',
  FLASHCARD_REVIEW = 'flashcard_review',
  QUIZ_REMINDER = 'quiz_reminder',
  ACHIEVEMENT_UNLOCKED = 'achievement_unlocked',
  LEVEL_UP = 'level_up',
  XP_GAINED = 'xp_gained',
  GROUP_INVITE = 'group_invite',
  GROUP_MESSAGE = 'group_message',
  SYSTEM = 'system',
  WELCOME = 'welcome',
}

export enum NotificationPriority {
  LOW = 'low',
  NORMAL = 'normal',
  HIGH = 'high',
  URGENT = 'urgent',
}

// AchievementCategory as type alias to match string literal usage
export type AchievementCategory = 'learning' | 'streak' | 'mastery' | 'social' | 'special';

export enum AchievementRarity {
  COMMON = 'common',
  RARE = 'rare',
  EPIC = 'epic',
  LEGENDARY = 'legendary',
}

// LeaderboardType as type alias to match string literal usage
export type LeaderboardType = 'xp' | 'streak' | 'notes' | 'flashcards' | 'quizzes';

// LeaderboardPeriod as type alias to match string literal usage
export type LeaderboardPeriod = 'daily' | 'weekly' | 'monthly' | 'all_time';

export enum FocusRoomType {
  PUBLIC = 'public',
  SUBJECT = 'subject',
  UNIVERSITY = 'university',
  PRIVATE = 'private',
  EVENT = 'event',
}

export enum FocusParticipantStatus {
  FOCUSING = 'focusing',
  BREAK = 'break',
  IDLE = 'idle',
  AWAY = 'away',
}

export enum ScheduleEventType {
  EXAM = 'exam',
  CLASS = 'class',
  DEADLINE = 'deadline',
  STUDY = 'study',
  MEETING = 'meeting',
  OTHER = 'other',
}

// SparkMood as type alias to match string literal usage
export type SparkMood = 'happy' | 'excited' | 'sad' | 'thinking' | 'encouraging' | 'sleeping' | 'helpful';

// ============================================
// USER MODELS
// ============================================

export interface User {
  id: number;
  email: string;
  username: string;
  full_name: string | null;
  avatar_url: string | null;
  is_active: boolean;
  is_verified: boolean;
  is_online: boolean;
  role: UserRole;
  total_xp: number;
  level: number;
  current_streak: number;
  longest_streak: number;
  created_at: string;
  last_login_at: string | null;
}

export interface UserProfile {
  id: number;
  user_id: number;
  avatar_url: string | null;
  bio: string | null;
  university: string | null;
  major: string | null;
  promotion: string | null;
  student_id: string | null;
  phone: string | null;
  country: string | null;
  city: string | null;
  timezone: string;
}

export interface UserPreferences {
  id: number;
  user_id: number;
  language: string;
  theme: 'light' | 'dark' | 'auto';
  notifications_enabled: boolean;
  email_notifications: boolean;
  push_notifications: boolean;
  daily_goal_minutes: number;
  reminder_time: string | null;
  weekend_reminders: boolean;
  profile_public: boolean;
  show_in_leaderboard: boolean;
  show_activity_status: boolean;
}

export interface UserStats {
  user_id: number;
  username: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  total_xp: number;
  level: number;
  xp_progress: number;
  xp_needed_for_next_level: number;
  current_streak: number;
  longest_streak: number;
  total_subjects: number;
  total_notes: number;
  total_flashcards: number;
  flashcards_due_today: number;
  total_flashcards_reviewed: number;
  total_quizzes: number;
  completed_quiz_attempts: number;
  average_quiz_score: number;
  total_study_time_minutes: number;
  study_time_this_month: number;
  notes_this_week: number;
  flashcards_reviewed_this_week: number;
  quizzes_taken_this_week: number;
  member_since: string;
  last_login: string | null;
}

export interface UserGamification {
  id: number;
  user_id: number;
  total_xp: number;
  level: number;
  current_streak: number;
  longest_streak: number;
  last_activity_date: string | null;
  unlocked_achievements: string[];
  achievement_points: number;
  badges: string[];
}

export interface UserMascot {
  id: number;
  user_id: number;
  name: string;
  level: number;
  unlocked_accessories: string[];
  current_accessory: string | null;
  happiness: number;
  last_interaction_date: string | null;
  interaction_count: number;
  color_variant: 'orange' | 'blue' | 'purple' | 'gold';
}

// ============================================
// CONTENT MODELS
// ============================================

export interface Subject {
  id: number;
  name: string;
  color: string;
  icon: string | null;
  description: string | null;
  user_id: number;
  is_archived: boolean;
  is_active: boolean;
  is_favorite: boolean;
  semester: string | null;
  code: string | null;
  year: string | null;
  credits_ects: number;
  coefficient: number;
  professor_name: string | null;
  professor_email: string | null;
  difficulty: 'easy' | 'medium' | 'hard';
  target_grade: number | null;
  current_grade: number | null;
  exam_date: string | null;
  exam_type: string | null;
  total_notes_count: number;
  total_flashcards_count: number;
  total_quizzes_count: number;
  total_documents_count: number;
  total_study_time_minutes: number;
  xp_earned: number;
  mastery_percentage: number;
  created_at: string;
  updated_at: string;
}

export interface Note {
  id: number;
  title: string;
  content: string;
  user_id: number;
  subject_id: number;
  tags: string[];
  parent_id: number | null;
  is_favorite: boolean;
  is_pinned: boolean;
  is_archived: boolean;
  gallery_images: string[];
  created_at: string;
  updated_at: string;
  subject?: Subject;
}

export interface Flashcard {
  id: number;
  front: string;
  back: string;
  hint: string | null;
  explanation: string | null;
  front_image_url: string | null;
  back_image_url: string | null;
  front_audio_url: string | null;
  back_audio_url: string | null;
  is_ai_generated: boolean;
  tags: string[];
  user_id: number;
  subject_id: number;
  status: FlashcardStatus;
  ease_factor: number;
  interval: number;
  repetitions: number;
  next_review_at: string | null;
  due_date: string | null;
  last_reviewed_at: string | null;
  total_reviews: number;
  correct_reviews: number;
  incorrect_reviews: number;
  average_response_time_seconds: number;
  mastery_percentage: number;
  is_suspended: boolean;
  is_buried: boolean;
  is_favorite: boolean;
  created_at: string;
  updated_at: string;
  subject?: Subject;
}

export interface FlashcardDeck {
  subject_id: number;
  subject_name: string;
  subject_color: string;
  total_cards: number;
  due_cards: number;
  new_cards: number;
  learning_cards: number;
  review_cards: number;
  mastered_cards: number;
  average_ease: number;
}

export interface FlashcardReview {
  id: number;
  flashcard_id: number;
  quality: number; // 0-5
  time_taken: number; // seconds
  reviewed_at: string;
}

export interface Quiz {
  id: number;
  title: string;
  description: string | null;
  subject_id: number;
  user_id: number;
  source_note_id: number | null;
  quiz_type: QuizType | null;
  difficulty: QuizDifficulty | null;
  questions_data: QuizQuestion[] | null;
  total_points: number | null;
  passing_score: number;
  time_limit_minutes: number | null;
  is_timed: boolean;
  allow_multiple_attempts: boolean;
  show_correct_answers: boolean;
  randomize_questions: boolean;
  randomize_options: boolean;
  is_ai_generated: boolean;
  is_public: boolean;
  is_published: boolean;
  share_code: string | null;
  total_plays: number;
  total_shares: number;
  total_attempts: number;
  average_score: number;
  highest_score: number;
  completion_rate: number;
  created_at: string;
  updated_at: string;
  subject?: Subject;
  questions?: QuizQuestion[];
}

export interface QuizQuestion {
  id?: number;
  quiz_id?: number;
  question: string;
  question_type: QuestionType;
  options: string[] | null;
  correct_answer: string;
  explanation: string | null;
  points: number;
  order: number;
}

export interface QuizAttempt {
  id: number;
  quiz_id: number;
  user_id: number;
  answers: Record<number, string>;
  score: number;
  time_taken: number | null;
  completed_at: string;
  quiz?: Quiz;
}

// ============================================
// GAMIFICATION MODELS
// ============================================

export interface Achievement {
  id: number;
  name: string;
  description: string;
  category: AchievementCategory;
  rarity: AchievementRarity;
  icon: string;
  xp_reward: number;
  requirement_type: string;
  requirement_value: number;
}

export interface UserAchievement {
  id: number;
  user_id: number;
  achievement_id: number;
  progress: number;
  is_unlocked: boolean;
  unlocked_at: string | null;
  achievement: Achievement;
}

export interface LeaderboardEntry {
  user_id: number;
  username: string;
  full_name: string | null;
  avatar_url: string | null;
  score: number;
  rank: number;
  level: number;
}

export interface Duel {
  id: number;
  challenger_id: number;
  opponent_id: number;
  subject_id: number;
  quiz_id: number | null;
  status: DuelStatus;
  challenger_score: number | null;
  opponent_score: number | null;
  winner_id: number | null;
  stakes_xp: number;
  duration_minutes: number;
  started_at: string | null;
  ended_at: string | null;
  created_at: string;
  challenger?: User;
  opponent?: User;
  subject?: Subject;
  quiz?: Quiz;
}

// ============================================
// STUDY MODELS
// ============================================

export interface StudySession {
  id: number;
  user_id: number;
  subject_id: number | null;
  duration: number;
  notes_reviewed: number;
  flashcards_reviewed: number;
  quizzes_completed: number;
  started_at: string;
  ended_at: string | null;
  subject?: Subject;
}

export interface Schedule {
  id: number;
  user_id: number;
  subject_id: number | null;
  title: string;
  description: string | null;
  event_type: ScheduleEventType;
  start_time: string;
  end_time: string | null;
  location: string | null;
  is_recurring: boolean;
  recurrence_pattern: string | null;
  reminder_enabled: boolean;
  reminder_minutes_before: number | null;
  is_completed: boolean;
  completed_at: string | null;
  is_cancelled: boolean;
  created_at: string;
  subject?: Subject;
}

// ============================================
// SOCIAL MODELS
// ============================================

export interface StudyGroup {
  id: number;
  creator_id: number;
  name: string;
  description: string | null;
  subject_id: number | null;
  university: string | null;
  promotion: string | null;
  max_members: number;
  is_private: boolean;
  cover_image_url: string | null;
  current_members: number;
  total_study_hours: number;
  total_shared_notes: number;
  created_at: string;
  creator?: User;
  subject?: Subject;
}

export interface GroupMessage {
  id: number;
  group_id: number;
  user_id: number;
  content: string;
  is_edited: boolean;
  reply_to_message_id: number | null;
  mentions: number[];
  created_at: string;
  user?: User;
  reactions?: MessageReaction[];
}

export interface MessageReaction {
  id: number;
  message_id: number;
  user_id: number;
  emoji: string;
}

// ============================================
// FOCUS ROOM MODELS
// ============================================

export interface FocusRoom {
  id: number;
  name: string;
  description: string | null;
  emoji: string;
  room_type: FocusRoomType;
  category: string;
  subject_id: number | null;
  university: string | null;
  promotion: string | null;
  max_participants: number;
  is_active: boolean;
  is_private: boolean;
  invite_code: string | null;
  creator_id: number;
  total_focus_minutes: number;
  total_sessions: number;
  peak_participants: number;
  created_at: string;
  participants?: FocusRoomParticipant[];
}

export interface FocusRoomParticipant {
  id: number;
  room_id: number;
  user_id: number;
  status: FocusParticipantStatus;
  current_activity: string | null;
  current_subject_id: number | null;
  joined_at: string;
  focus_started_at: string | null;
  current_focus_minutes: number;
  today_focus_minutes: number;
  is_visible: boolean;
  user?: User;
}

// ============================================
// NOTIFICATION MODELS
// ============================================

export interface Notification {
  id: number;
  user_id: number;
  type: NotificationType;
  title: string;
  message: string;
  priority: NotificationPriority;
  is_read: boolean;
  read_at: string | null;
  data: string | null;
  action_url: string | null;
  created_at: string;
  expires_at: string | null;
}

export interface NotificationPreference {
  id: number;
  user_id: number;
  email_enabled: boolean;
  push_enabled: boolean;
  in_app_enabled: boolean;
  duel_notifications: boolean;
  calendar_notifications: boolean;
  streak_notifications: boolean;
  study_reminders: boolean;
  achievement_notifications: boolean;
  social_notifications: boolean;
  quiet_hours_start: number;
  quiet_hours_end: number;
  email_digest: boolean;
  email_digest_hour: number;
}

// ============================================
// MASCOT (SPARK)
// ============================================

export interface MascotState {
  name: string;
  level: number;
  unlocked_accessories: string[];
  current_accessory: string | null;
  happiness: number;
  mood: SparkMood;
  total_xp: number;
  current_streak: number;
  message?: string;
}

// ============================================
// AI MODELS
// ============================================

export interface AIGenerateFlashcardsRequest {
  note_id: number;
  count?: number;
  difficulty?: QuizDifficulty;
}

export interface AIGenerateQuizRequest {
  note_id: number;
  question_count?: number;
  question_types?: QuestionType[];
  difficulty?: QuizDifficulty;
}

export interface AISummarizeRequest {
  note_id: number;
  max_length?: number;
}

export interface AIAskRequest {
  question: string;
  note_id?: number;
  subject_id?: number;
}

// ============================================
// API RESPONSE TYPES
// ============================================

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface AuthResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  user: User;
}

export interface ApiError {
  detail: string;
  status_code?: number;
}

// ============================================
// REQUEST TYPES
// ============================================

export interface LoginRequest {
  username: string; // email or username
  password: string;
}

export interface RegisterRequest {
  email: string;
  username: string;
  password: string;
  full_name?: string;
}

export interface CreateSubjectRequest {
  name: string;
  color?: string;
  icon?: string;
  description?: string;
  semester?: string;
  code?: string;
  year?: string;
  credits_ects?: number;
  coefficient?: number;
  professor_name?: string;
  professor_email?: string;
  difficulty?: 'easy' | 'medium' | 'hard';
  target_grade?: number;
  exam_date?: string;
  exam_type?: string;
}

export interface CreateNoteRequest {
  title: string;
  content: string;
  subject_id: number;
  tags?: string[];
  parent_id?: number;
}

export interface CreateFlashcardRequest {
  front: string;
  back: string;
  subject_id: number;
  hint?: string;
  explanation?: string;
  tags?: string[];
}

export interface ReviewFlashcardRequest {
  quality: number; // 0-5
  time_taken: number; // seconds
}

export interface CreateQuizRequest {
  title: string;
  subject_id: number;
  description?: string;
  quiz_type?: QuizType;
  difficulty?: QuizDifficulty;
  questions: QuizQuestion[];
  time_limit_minutes?: number;
  passing_score?: number;
}

export interface SubmitQuizRequest {
  answers: Record<number, string>;
  time_taken?: number;
}

export interface CreateDuelRequest {
  opponent_id: number;
  subject_id: number;
  quiz_id?: number;
  stakes_xp?: number;
}

export interface CreateScheduleRequest {
  title: string;
  event_type: ScheduleEventType;
  start_time: string;
  subject_id?: number;
  description?: string;
  end_time?: string;
  location?: string;
  is_recurring?: boolean;
  recurrence_pattern?: string;
  reminder_enabled?: boolean;
  reminder_minutes_before?: number;
}

// ============================================
// UTILITY TYPES
// ============================================

export type ThemeMode = 'light' | 'dark' | 'auto';

export interface AppState {
  isOnline: boolean;
  isLoading: boolean;
  theme: ThemeMode;
}
