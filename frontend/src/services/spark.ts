/**
 * 🐿️⚡ Spark Service - Client API pour l'assistant IA intelligent
 *
 * Nouveau service unifié pour toutes les interactions avec Spark:
 * - Messages contextuels
 * - Conversations persistantes
 * - Mode tuteur
 * - Briefings quotidiens
 * - Notifications
 * - Insights
 */

import api from '@/lib/api';

// =============================================================================
// TYPES
// =============================================================================

export type SparkMood =
  | 'happy'
  | 'excited'
  | 'sad'
  | 'thinking'
  | 'encouraging'
  | 'sleeping'
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
  | 'evolution'
  | 'explain';

export interface SparkState {
  name: string;
  level: number;
  levelName: string;
  unlockedAccessories: string[];
  currentAccessory: string | null;
  totalAccessories: number;
  userXp: number;
  userStreak: number;
  happiness: number;
}

export interface SparkMessage {
  message: string;
  mood: SparkMood;
  animation: SparkAnimation;
  timestamp: string;
}

export interface SparkChatResponse {
  response: string;
  mood: SparkMood;
  animation: SparkAnimation;
  conversationId: number;
  suggestions: string[];
  timestamp: string;
}

export interface ConversationSummary {
  id: number;
  title: string;
  contextType: string;
  messageCount: number;
  lastMessageAt: string | null;
  createdAt: string;
}

export interface ConversationMessage {
  id: number;
  role: 'user' | 'spark';
  content: string;
  mood?: SparkMood;
  animation?: SparkAnimation;
  createdAt: string;
}

export interface ConversationDetail {
  id: number;
  title: string;
  contextType: string;
  messageCount: number;
  messages: ConversationMessage[];
  createdAt: string;
  updatedAt: string;
}

export interface TutorExplanation {
  explanation: string;
  mood: SparkMood;
  animation: SparkAnimation;
  suggestions: string[];
  timestamp: string;
}

export interface TutorHint {
  hint: string;
  level: number;
  mood: SparkMood;
  animation: SparkAnimation;
}

export interface StreakStatus {
  current: number;
  longest: number;
  risk: 'low' | 'medium' | 'high' | 'critical';
  message: string;
}

export interface DailyGoal {
  type: string;
  title: string;
  target: number;
  unit: string;
  priority: number;
  description?: string;
}

export interface UpcomingExam {
  title: string;
  date: string;
  daysUntil: number;
  urgency: 'normal' | 'high' | 'critical';
}

export interface DailyBriefing {
  id: number;
  greeting: string;
  mood: SparkMood;
  tone: string;
  streakStatus: StreakStatus;
  todayGoals: DailyGoal[];
  pendingReviews: { count: number; message: string };
  upcomingExams: UpcomingExam[];
  funFact: string | null;
  motivationQuote: string | null;
  isViewed: boolean;
  createdAt: string;
}

export interface SparkNotification {
  id: number;
  notificationType: string;
  title: string;
  message: string;
  mood: SparkMood;
  actionType?: string;
  actionData?: Record<string, any>;
  isRead: boolean;
  createdAt: string;
}

export interface SparkInsight {
  id: number;
  insightType: string;
  title: string;
  description: string;
  data: Record<string, any>;
  confidence: number;
  priority: number;
  isAcknowledged: boolean;
  validUntil: string | null;
  createdAt: string;
}

export interface UserAnalysis {
  studyTimes: {
    bestHour: number | null;
    bestDay: string | null;
    pattern: string;
  };
  strengths: Array<{
    type: string;
    subject?: string;
    score?: number;
    message?: string;
  }>;
  weaknesses: Array<{
    type: string;
    message?: string;
    quiz?: string;
  }>;
  streakHealth: {
    currentStreak: number;
    longestStreak: number;
    risk: string;
    status: string;
  };
  upcomingNeeds: {
    upcomingExams: UpcomingExam[];
    overdueReviews: number;
  };
  engagementLevel: {
    level: string;
    emoji: string;
    weeklyActivities: number;
  };
  learningVelocity: {
    trend: string;
    avgXpPerDay: number;
  };
}

export interface SparkAccessory {
  id: string;
  name: string;
  description: string;
  emoji: string;
  requirement: string;
  rarity: 'common' | 'rare' | 'epic' | 'legendary' | 'mythic';
  isUnlocked: boolean;
}

// =============================================================================
// SERVICE
// =============================================================================

class SparkService {
  private baseUrl = '/spark';

  // ---------------------------------------------------------------------------
  // ÉTAT
  // ---------------------------------------------------------------------------

  /**
   * Récupère l'état complet de Spark
   */
  async getState(): Promise<SparkState> {
    const response = await api.get(`${this.baseUrl}/state`);
    const data = response.data;
    return {
      name: data.name,
      level: data.level,
      levelName: data.level_name,
      unlockedAccessories: data.unlocked_accessories,
      currentAccessory: data.current_accessory,
      totalAccessories: data.total_accessories,
      userXp: data.user_xp,
      userStreak: data.user_streak,
      happiness: data.happiness,
    };
  }

  /**
   * Met à jour Spark (nom ou accessoire)
   */
  async updateSpark(data: { name?: string; currentAccessory?: string }): Promise<void> {
    await api.patch(`${this.baseUrl}/update`, {
      name: data.name,
      current_accessory: data.currentAccessory,
    });
  }

  /**
   * Interaction avec Spark (clic)
   */
  async interact(): Promise<SparkMessage & { happiness: number; interactionCount: number }> {
    const response = await api.post(`${this.baseUrl}/interaction`);
    return {
      message: response.data.message,
      mood: response.data.mood,
      animation: response.data.animation,
      timestamp: new Date().toISOString(),
      happiness: response.data.happiness,
      interactionCount: response.data.interaction_count,
    };
  }

  // ---------------------------------------------------------------------------
  // MESSAGES CONTEXTUELS
  // ---------------------------------------------------------------------------

  /**
   * Obtient un message de Spark pour un événement
   */
  async getMessage(event: string, context: Record<string, any> = {}): Promise<SparkMessage> {
    const response = await api.post(`${this.baseUrl}/message`, { event, context });
    return {
      message: response.data.message,
      mood: response.data.mood,
      animation: response.data.animation,
      timestamp: response.data.timestamp,
    };
  }

  /**
   * Envoie un événement au backend pour que Spark apprenne (stocke en mémoire)
   * Fire-and-forget : n'attend pas la réponse, ne bloque pas l'UI
   */
  trackEvent(event: string, context: Record<string, any> = {}): void {
    // Fire and forget - on ne bloque pas l'UI
    api.post(`${this.baseUrl}/message`, { event, context })
      .then(() => {
        console.log(`🐿️ Spark tracked event: ${event}`, context);
      })
      .catch((error) => {
        console.error(`🐿️ Spark failed to track event: ${event}`, error);
      });
  }

  // ---------------------------------------------------------------------------
  // CONVERSATIONS
  // ---------------------------------------------------------------------------

  /**
   * Envoie un message à Spark dans une conversation
   */
  async chat(
    message: string,
    conversationId?: number,
    context?: Record<string, any>
  ): Promise<SparkChatResponse> {
    const response = await api.post(`${this.baseUrl}/chat`, {
      message,
      conversation_id: conversationId,
      context,
    });
    return {
      response: response.data.response,
      mood: response.data.mood,
      animation: response.data.animation,
      conversationId: response.data.conversation_id,
      suggestions: response.data.suggestions,
      timestamp: response.data.timestamp,
    };
  }

  /**
   * Récupère la liste des conversations
   */
  async getConversations(limit: number = 20): Promise<ConversationSummary[]> {
    const response = await api.get(`${this.baseUrl}/conversations`, { params: { limit } });
    return response.data.conversations.map((c: any) => ({
      id: c.id,
      title: c.title,
      contextType: c.context_type,
      messageCount: c.message_count,
      lastMessageAt: c.last_message_at,
      createdAt: c.created_at,
    }));
  }

  /**
   * Récupère les détails d'une conversation
   */
  async getConversation(conversationId: number): Promise<ConversationDetail> {
    const response = await api.get(`${this.baseUrl}/conversations/${conversationId}`);
    const data = response.data;
    return {
      id: data.id,
      title: data.title,
      contextType: data.context_type,
      messageCount: data.message_count,
      messages: data.messages.map((m: any) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        mood: m.mood,
        animation: m.animation,
        createdAt: m.created_at,
      })),
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  }

  /**
   * Supprime une conversation
   */
  async deleteConversation(conversationId: number): Promise<void> {
    await api.delete(`${this.baseUrl}/conversations/${conversationId}`);
  }

  // ---------------------------------------------------------------------------
  // MODE TUTEUR
  // ---------------------------------------------------------------------------

  /**
   * Demande une explication en mode tuteur
   */
  async tutorExplain(
    concept: string,
    subject?: string,
    difficulty: 'easy' | 'medium' | 'hard' = 'medium',
    conversationId?: number
  ): Promise<TutorExplanation> {
    const response = await api.post(`${this.baseUrl}/tutor/explain`, {
      concept,
      subject,
      difficulty,
      conversation_id: conversationId,
    });
    return {
      explanation: response.data.explanation,
      mood: response.data.mood,
      animation: response.data.animation,
      suggestions: response.data.suggestions,
      timestamp: response.data.timestamp,
    };
  }

  /**
   * Demande un indice pour une question
   */
  async tutorHint(
    question: string,
    answer: string,
    userAttempt?: string,
    hintLevel: 1 | 2 | 3 = 1
  ): Promise<TutorHint> {
    const response = await api.post(`${this.baseUrl}/tutor/hint`, {
      question,
      answer,
      user_attempt: userAttempt,
      hint_level: hintLevel,
    });
    return {
      hint: response.data.hint,
      level: response.data.level,
      mood: response.data.mood,
      animation: response.data.animation,
    };
  }

  // ---------------------------------------------------------------------------
  // BRIEFING QUOTIDIEN
  // ---------------------------------------------------------------------------

  /**
   * Récupère le briefing quotidien
   */
  async getDailyBriefing(): Promise<DailyBriefing> {
    const response = await api.get(`${this.baseUrl}/briefing`);
    const data = response.data;
    return {
      id: data.id,
      greeting: data.greeting,
      mood: data.mood,
      tone: data.tone,
      streakStatus: {
        current: data.streak_status.current,
        longest: data.streak_status.longest,
        risk: data.streak_status.risk,
        message: data.streak_status.message,
      },
      todayGoals: data.today_goals.map((g: any) => ({
        type: g.type,
        title: g.title,
        target: g.target,
        unit: g.unit,
        priority: g.priority,
        description: g.description,
      })),
      pendingReviews: data.pending_reviews,
      upcomingExams: data.upcoming_exams.map((e: any) => ({
        title: e.title,
        date: e.date,
        daysUntil: e.days_until,
        urgency: e.urgency,
      })),
      funFact: data.fun_fact,
      motivationQuote: data.motivation_quote,
      isViewed: data.is_viewed,
      createdAt: data.created_at,
    };
  }

  // ---------------------------------------------------------------------------
  // NOTIFICATIONS
  // ---------------------------------------------------------------------------

  /**
   * Récupère les notifications de Spark
   */
  async getNotifications(
    limit: number = 20,
    unreadOnly: boolean = false
  ): Promise<{ notifications: SparkNotification[]; unreadCount: number }> {
    const response = await api.get(`${this.baseUrl}/notifications`, {
      params: { limit, unread_only: unreadOnly },
    });
    return {
      notifications: response.data.notifications.map((n: any) => ({
        id: n.id,
        notificationType: n.notification_type,
        title: n.title,
        message: n.message,
        mood: n.mood,
        actionType: n.action_type,
        actionData: n.action_data,
        isRead: n.is_read,
        createdAt: n.created_at,
      })),
      unreadCount: response.data.unread_count,
    };
  }

  /**
   * Marque des notifications comme lues
   */
  async markNotificationsRead(notificationIds: number[]): Promise<void> {
    await api.post(`${this.baseUrl}/notifications/read`, {
      notification_ids: notificationIds,
    });
  }

  /**
   * Supprime une notification
   */
  async dismissNotification(notificationId: number): Promise<void> {
    await api.post(`${this.baseUrl}/notifications/${notificationId}/dismiss`);
  }

  // ---------------------------------------------------------------------------
  // INSIGHTS & ANALYSE
  // ---------------------------------------------------------------------------

  /**
   * Récupère les insights de Spark
   */
  async getInsights(limit: number = 10): Promise<SparkInsight[]> {
    const response = await api.get(`${this.baseUrl}/insights`, { params: { limit } });
    return response.data.insights.map((i: any) => ({
      id: i.id,
      insightType: i.insight_type,
      title: i.title,
      description: i.description,
      data: i.data,
      confidence: i.confidence,
      priority: i.priority,
      isAcknowledged: i.is_acknowledged,
      validUntil: i.valid_until,
      createdAt: i.created_at,
    }));
  }

  /**
   * Marque un insight comme reconnu
   */
  async acknowledgeInsight(insightId: number): Promise<void> {
    await api.post(`${this.baseUrl}/insights/${insightId}/acknowledge`);
  }

  /**
   * Récupère l'analyse complète de l'utilisateur
   */
  async getUserAnalysis(): Promise<UserAnalysis> {
    const response = await api.get(`${this.baseUrl}/analysis`);
    const data = response.data;
    return {
      studyTimes: {
        bestHour: data.study_times.best_hour,
        bestDay: data.study_times.best_day,
        pattern: data.study_times.pattern,
      },
      strengths: data.strengths,
      weaknesses: data.weaknesses,
      streakHealth: {
        currentStreak: data.streak_health.current_streak,
        longestStreak: data.streak_health.longest_streak,
        risk: data.streak_health.risk,
        status: data.streak_health.status,
      },
      upcomingNeeds: {
        upcomingExams: data.upcoming_needs.upcoming_exams,
        overdueReviews: data.upcoming_needs.overdue_reviews,
      },
      engagementLevel: {
        level: data.engagement_level.level,
        emoji: data.engagement_level.emoji,
        weeklyActivities: data.engagement_level.weekly_activities,
      },
      learningVelocity: {
        trend: data.learning_velocity.trend,
        avgXpPerDay: data.learning_velocity.avg_xp_per_day,
      },
    };
  }

  // ---------------------------------------------------------------------------
  // ACCESSOIRES
  // ---------------------------------------------------------------------------

  /**
   * Récupère la liste des accessoires
   */
  async getAccessories(): Promise<{
    accessories: SparkAccessory[];
    unlockedCount: number;
    totalCount: number;
  }> {
    const response = await api.get(`${this.baseUrl}/accessories`);
    return {
      accessories: response.data.accessories.map((a: any) => ({
        id: a.id,
        name: a.name,
        description: a.description,
        emoji: a.emoji,
        requirement: a.requirement,
        rarity: a.rarity,
        isUnlocked: a.is_unlocked,
      })),
      unlockedCount: response.data.unlocked_count,
      totalCount: response.data.total_count,
    };
  }

  /**
   * Vérifie les nouveaux déblocages
   */
  async checkUnlocks(): Promise<{
    hasNewUnlocks: boolean;
    newlyUnlocked: string[];
    message?: string;
    mood?: SparkMood;
    animation?: SparkAnimation;
  }> {
    const response = await api.get(`${this.baseUrl}/check-unlocks`);
    return {
      hasNewUnlocks: response.data.has_new_unlocks,
      newlyUnlocked: response.data.newly_unlocked,
      message: response.data.message,
      mood: response.data.mood,
      animation: response.data.animation,
    };
  }

  // ---------------------------------------------------------------------------
  // Q&A RAPIDE (rétrocompatibilité)
  // ---------------------------------------------------------------------------

  /**
   * Pose une question rapide à Spark
   */
  async ask(
    question: string,
    context?: Record<string, any>
  ): Promise<{
    answer: string;
    mood: SparkMood;
    animation: SparkAnimation;
    suggestions: string[];
  }> {
    const response = await api.post(`${this.baseUrl}/ask`, { question, context });
    return {
      answer: response.data.answer,
      mood: response.data.mood,
      animation: response.data.animation,
      suggestions: response.data.suggestions,
    };
  }
}

export const sparkService = new SparkService();
export default sparkService;
