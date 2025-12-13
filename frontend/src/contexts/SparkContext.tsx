"use client";

/**
 * 🐿️⚡ Spark Context - État global de l'assistant IA intelligent
 *
 * Gère:
 * - État de Spark (niveau, accessoires, bonheur)
 * - Messages contextuels
 * - Conversations persistantes
 * - Briefing quotidien
 * - Notifications
 * - Événements (quiz, streak, etc.)
 */

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from 'react';
import sparkService, {
  SparkState,
  SparkMessage,
  SparkMood,
  SparkAnimation,
  SparkChatResponse,
  DailyBriefing,
  SparkNotification,
  ConversationSummary,
} from '@/services/spark';

// =============================================================================
// TYPES
// =============================================================================

export type { SparkMood, SparkAnimation };

interface SparkAnswer {
  answer: string;
  mood: SparkMood;
  animation: SparkAnimation;
  suggestions: string[];
  timestamp: string;
}

interface SparkContextType {
  // État
  sparkState: SparkState | null;
  currentMessage: SparkMessage | null;
  currentAnswer: SparkAnswer | null;
  isLoading: boolean;
  briefing: DailyBriefing | null;
  notifications: SparkNotification[];
  unreadNotificationCount: number;
  conversations: ConversationSummary[];
  activeConversationId: number | null;

  // Actions de base
  fetchSparkState: () => Promise<void>;
  showMessage: (event: string, context?: any) => Promise<void>;
  clearMessage: () => void;
  clearAnswer: () => void;
  interactWithSpark: () => Promise<void>;
  checkNewUnlocks: () => Promise<any>;

  // Conversations
  chat: (message: string) => Promise<SparkChatResponse | null>;
  startNewConversation: () => void;
  loadConversation: (conversationId: number) => void;
  fetchConversations: () => Promise<void>;

  // Tuteur
  askForExplanation: (concept: string, subject?: string) => Promise<void>;
  getHint: (question: string, answer: string, level?: 1 | 2 | 3) => Promise<string>;

  // Briefing & Notifications
  fetchBriefing: () => Promise<void>;
  fetchNotifications: () => Promise<void>;
  markNotificationsRead: (ids: number[]) => Promise<void>;
  dismissNotification: (id: number) => Promise<void>;

  // Q&A rapide (legacy)
  askQuestion: (question: string, context?: any) => Promise<void>;
}

const SparkContext = createContext<SparkContextType | undefined>(undefined);

// =============================================================================
// PROVIDER
// =============================================================================

export const SparkProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // État principal
  const [sparkState, setSparkState] = useState<SparkState | null>(null);
  const [currentMessage, setCurrentMessage] = useState<SparkMessage | null>(null);
  const [currentAnswer, setCurrentAnswer] = useState<SparkAnswer | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Briefing & Notifications
  const [briefing, setBriefing] = useState<DailyBriefing | null>(null);
  const [notifications, setNotifications] = useState<SparkNotification[]>([]);
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);

  // Conversations
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<number | null>(null);

  // ---------------------------------------------------------------------------
  // ÉTAT DE SPARK
  // ---------------------------------------------------------------------------

  const fetchSparkState = useCallback(async () => {
    try {
      if (typeof window === 'undefined') return;
      const token = localStorage.getItem('access_token');
      if (!token) return;

      const state = await sparkService.getState();
      setSparkState(state);
      console.log('🐿️ Spark state loaded:', state);
    } catch (error) {
      console.error('Spark: Erreur récupération état:', error);
    }
  }, []);

  // ---------------------------------------------------------------------------
  // MESSAGES CONTEXTUELS
  // ---------------------------------------------------------------------------

  const showMessage = useCallback(async (event: string, context: any = {}) => {
    try {
      setIsLoading(true);
      const token = localStorage.getItem('access_token');
      if (!token) return;

      // Si un message_override est fourni, l'utiliser directement sans appel API
      if (context.message_override) {
        const localMessage = {
          message: context.message_override,
          mood: context.mood || 'happy' as const,
          animation: context.animation || 'wave' as const,
          timestamp: new Date().toISOString(),
        };
        setCurrentMessage(localMessage);
        console.log(`🐿️ Spark local [${event}]:`, localMessage.message);
        setTimeout(() => setCurrentMessage(null), 5000);
        return;
      }

      // Sinon, appeler l'API pour un message généré
      const message = await sparkService.getMessage(event, context);
      setCurrentMessage(message);

      console.log(`🐿️ Spark API [${event}]:`, message.message);

      // Auto-clear après 5 secondes
      setTimeout(() => setCurrentMessage(null), 5000);
    } catch (error) {
      console.error('Spark: Erreur message:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const clearMessage = useCallback(() => {
    setCurrentMessage(null);
  }, []);

  const clearAnswer = useCallback(() => {
    setCurrentAnswer(null);
  }, []);

  // ---------------------------------------------------------------------------
  // INTERACTIONS
  // ---------------------------------------------------------------------------

  const interactWithSpark = useCallback(async () => {
    try {
      const token = localStorage.getItem('access_token');
      if (!token) return;

      const result = await sparkService.interact();

      setCurrentMessage({
        message: result.message,
        mood: result.mood,
        animation: result.animation,
        timestamp: result.timestamp,
      });

      // Mettre à jour le bonheur
      if (sparkState) {
        setSparkState({
          ...sparkState,
          happiness: result.happiness,
        });
      }

      setTimeout(() => setCurrentMessage(null), 4000);
    } catch (error) {
      console.error('Spark: Erreur interaction:', error);
    }
  }, [sparkState]);

  const checkNewUnlocks = useCallback(async () => {
    try {
      const token = localStorage.getItem('access_token');
      if (!token) return null;

      const result = await sparkService.checkUnlocks();

      if (result.hasNewUnlocks && result.message) {
        setCurrentMessage({
          message: result.message,
          mood: result.mood || 'excited',
          animation: result.animation || 'celebration',
          timestamp: new Date().toISOString(),
        });

        await fetchSparkState();

        setTimeout(() => setCurrentMessage(null), 6000);
      }

      return result;
    } catch (error) {
      console.error('Spark: Erreur vérification déblocages:', error);
      return null;
    }
  }, [fetchSparkState]);

  // ---------------------------------------------------------------------------
  // CONVERSATIONS
  // ---------------------------------------------------------------------------

  const chat = useCallback(
    async (message: string): Promise<SparkChatResponse | null> => {
      try {
        setIsLoading(true);
        const token = localStorage.getItem('access_token');
        if (!token) return null;

        const response = await sparkService.chat(message, activeConversationId || undefined);

        // Mettre à jour la conversation active
        setActiveConversationId(response.conversationId);

        // Afficher un message temporaire
        setCurrentMessage({
          message: '💬',
          mood: response.mood,
          animation: response.animation,
          timestamp: response.timestamp,
        });

        setTimeout(() => setCurrentMessage(null), 2000);

        return response;
      } catch (error) {
        console.error('Spark: Erreur chat:', error);
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [activeConversationId]
  );

  const startNewConversation = useCallback(() => {
    setActiveConversationId(null);
  }, []);

  const loadConversation = useCallback((conversationId: number) => {
    setActiveConversationId(conversationId);
  }, []);

  const fetchConversations = useCallback(async () => {
    try {
      const token = localStorage.getItem('access_token');
      if (!token) return;

      const convs = await sparkService.getConversations();
      setConversations(convs);
    } catch (error) {
      console.error('Spark: Erreur récupération conversations:', error);
    }
  }, []);

  // ---------------------------------------------------------------------------
  // MODE TUTEUR
  // ---------------------------------------------------------------------------

  const askForExplanation = useCallback(
    async (concept: string, subject?: string) => {
      try {
        setIsLoading(true);
        const token = localStorage.getItem('access_token');
        if (!token) return;

        const result = await sparkService.tutorExplain(
          concept,
          subject,
          'medium',
          activeConversationId || undefined
        );

        setCurrentAnswer({
          answer: result.explanation,
          mood: result.mood,
          animation: result.animation,
          suggestions: result.suggestions,
          timestamp: result.timestamp,
        });
      } catch (error) {
        console.error('Spark: Erreur tuteur:', error);
        setCurrentAnswer({
          answer: "Oups ! J'ai eu un problème. Réessaie ! 🐿️",
          mood: 'sad',
          animation: 'idle',
          suggestions: [],
          timestamp: new Date().toISOString(),
        });
      } finally {
        setIsLoading(false);
      }
    },
    [activeConversationId]
  );

  const getHint = useCallback(
    async (question: string, answer: string, level: 1 | 2 | 3 = 1): Promise<string> => {
      try {
        const result = await sparkService.tutorHint(question, answer, undefined, level);
        return result.hint;
      } catch (error) {
        console.error('Spark: Erreur hint:', error);
        return 'Réfléchis bien... La réponse est à portée de main ! 🤔';
      }
    },
    []
  );

  // ---------------------------------------------------------------------------
  // BRIEFING & NOTIFICATIONS
  // ---------------------------------------------------------------------------

  const fetchBriefing = useCallback(async () => {
    try {
      const token = localStorage.getItem('access_token');
      if (!token) {
        console.log('🐿️ Briefing: Pas de token');
        return;
      }

      console.log('🐿️ Briefing: Chargement...');
      const data = await sparkService.getDailyBriefing();
      console.log('🐿️ Briefing: Reçu!', data);
      setBriefing(data);
    } catch (error) {
      console.error('🐿️ Briefing: Erreur', error);
    }
  }, []);

  const fetchNotifications = useCallback(async () => {
    try {
      const token = localStorage.getItem('access_token');
      if (!token) return;

      const result = await sparkService.getNotifications();
      setNotifications(result.notifications);
      setUnreadNotificationCount(result.unreadCount);
    } catch (error) {
      console.error('Spark: Erreur notifications:', error);
    }
  }, []);

  const markNotificationsRead = useCallback(async (ids: number[]) => {
    try {
      await sparkService.markNotificationsRead(ids);
      setNotifications((prev) =>
        prev.map((n) => (ids.includes(n.id) ? { ...n, isRead: true } : n))
      );
      setUnreadNotificationCount((prev) => Math.max(0, prev - ids.length));
    } catch (error) {
      console.error('Spark: Erreur marquage notifications:', error);
    }
  }, []);

  const dismissNotification = useCallback(async (id: number) => {
    try {
      await sparkService.dismissNotification(id);
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    } catch (error) {
      console.error('Spark: Erreur suppression notification:', error);
    }
  }, []);

  // ---------------------------------------------------------------------------
  // Q&A LEGACY
  // ---------------------------------------------------------------------------

  const askQuestion = useCallback(async (question: string, context: any = {}) => {
    try {
      setIsLoading(true);
      const token = localStorage.getItem('access_token');
      if (!token) return;

      const result = await sparkService.ask(question, context);

      setCurrentAnswer({
        answer: result.answer,
        mood: result.mood,
        animation: result.animation,
        suggestions: result.suggestions,
        timestamp: new Date().toISOString(),
      });

      setCurrentMessage({
        message: 'Voici ma réponse ! 💡',
        mood: 'happy',
        animation: 'wave',
        timestamp: new Date().toISOString(),
      });

      setTimeout(() => setCurrentMessage(null), 3000);
    } catch (error) {
      console.error('Spark: Erreur question:', error);
      setCurrentAnswer({
        answer: "Oups ! J'ai eu un problème en essayant de répondre. Réessaie ! 🐿️",
        mood: 'sad',
        animation: 'idle',
        suggestions: [],
        timestamp: new Date().toISOString(),
      });
    } finally {
      setIsLoading(false);
    }
  }, []);

  // ---------------------------------------------------------------------------
  // EFFETS
  // ---------------------------------------------------------------------------

  // Charger l'état initial et afficher un message de bienvenue proactif
  useEffect(() => {
    const initializeSpark = async () => {
      try {
        if (typeof window === 'undefined') return;
        const token = localStorage.getItem('access_token');
        if (!token) return;

        // Charger l'état de Spark
        await fetchSparkState();

        // Vérifier si c'est la première visite de la session
        const lastVisit = sessionStorage.getItem('spark_last_visit');
        const now = new Date().getTime();

        if (!lastVisit) {
          // Première visite de la session - message de bienvenue
          sessionStorage.setItem('spark_last_visit', now.toString());

          // Attendre un peu pour que l'UI se charge
          setTimeout(async () => {
            await showMessage('welcome');
          }, 1500);
        } else {
          // Retour dans la session - vérifier le temps écoulé
          const timeSinceLastVisit = now - parseInt(lastVisit);
          const minutesAway = timeSinceLastVisit / (1000 * 60);

          sessionStorage.setItem('spark_last_visit', now.toString());

          if (minutesAway > 30) {
            // Absent plus de 30 minutes
            setTimeout(async () => {
              await showMessage('welcome_back');
            }, 1500);
          }
        }
      } catch (error) {
        console.error('Spark: Erreur initialisation:', error);
      }
    };

    initializeSpark();
  }, [fetchSparkState, showMessage]);

  // Charger les notifications et briefing au démarrage
  useEffect(() => {
    const loadProactiveContent = async () => {
      try {
        const token = localStorage.getItem('access_token');
        if (!token) {
          console.log('🐿️ Proactif: Pas de token, skip');
          return;
        }

        console.log('🐿️ Proactif: Chargement du contenu...');

        // Charger les notifications
        await fetchNotifications();
        console.log('🐿️ Proactif: Notifications OK');

        // Toujours charger le briefing quotidien (l'API gère le cache côté serveur)
        await fetchBriefing();
        console.log('🐿️ Proactif: Briefing OK');
      } catch (error) {
        console.error('🐿️ Proactif: Erreur', error);
      }
    };

    loadProactiveContent();

    // Rafraîchir les notifications toutes les minutes
    const interval = setInterval(fetchNotifications, 60000);

    return () => clearInterval(interval);
  }, [fetchNotifications, fetchBriefing]);

  // Vérifier le streak et afficher des alertes si nécessaire
  useEffect(() => {
    const checkStreakStatus = async () => {
      try {
        if (!sparkState || typeof window === 'undefined') return;
        const token = localStorage.getItem('access_token');
        if (!token) return;

        const lastStreakCheck = sessionStorage.getItem('spark_streak_check');
        const now = new Date().getTime();

        // Vérifier une fois par heure max
        if (lastStreakCheck && (now - parseInt(lastStreakCheck)) < 3600000) return;

        sessionStorage.setItem('spark_streak_check', now.toString());

        // Vérifier l'heure - alertes streak après 18h si pas d'activité
        const currentHour = new Date().getHours();
        if (currentHour >= 18 && sparkState.userStreak > 0) {
          // Vérifier si l'utilisateur a été actif aujourd'hui via l'API
          const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/v1/users/me/activity?days=1`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });

          if (response.ok) {
            const data = await response.json();
            const todayActivities = data.activities?.filter((a: any) => {
              const activityDate = new Date(a.timestamp).toDateString();
              return activityDate === new Date().toDateString();
            }) || [];

            if (todayActivities.length === 0) {
              // Pas d'activité aujourd'hui et il est tard
              setTimeout(async () => {
                await showMessage('streak_warning', { hours_absent: currentHour - 8 });
              }, 5000);
            }
          }
        }
      } catch (error) {
        console.error('Spark: Erreur vérification streak:', error);
      }
    };

    // Vérifier après 10 secondes pour laisser le temps au message de bienvenue
    const timeout = setTimeout(checkStreakStatus, 10000);
    return () => clearTimeout(timeout);
  }, [sparkState, showMessage]);

  // ---------------------------------------------------------------------------
  // VALEUR DU CONTEXTE
  // ---------------------------------------------------------------------------

  const value: SparkContextType = {
    // État
    sparkState,
    currentMessage,
    currentAnswer,
    isLoading,
    briefing,
    notifications,
    unreadNotificationCount,
    conversations,
    activeConversationId,

    // Actions de base
    fetchSparkState,
    showMessage,
    clearMessage,
    clearAnswer,
    interactWithSpark,
    checkNewUnlocks,

    // Conversations
    chat,
    startNewConversation,
    loadConversation,
    fetchConversations,

    // Tuteur
    askForExplanation,
    getHint,

    // Briefing & Notifications
    fetchBriefing,
    fetchNotifications,
    markNotificationsRead,
    dismissNotification,

    // Legacy
    askQuestion,
  };

  return <SparkContext.Provider value={value}>{children}</SparkContext.Provider>;
};

// =============================================================================
// HOOKS
// =============================================================================

export const useSpark = (): SparkContextType => {
  const context = useContext(SparkContext);
  if (context === undefined) {
    throw new Error('useSpark must be used within a SparkProvider');
  }
  return context;
};

/**
 * Hook pour les événements Spark
 */
export const useSparkEvents = () => {
  const { showMessage, checkNewUnlocks } = useSpark();

  const onQuizComplete = useCallback(
    async (score: number, topic: string) => {
      if (score === 100) {
        await showMessage('quiz_perfect', { score, topic });
      } else if (score >= 80) {
        await showMessage('quiz_success', { score, topic });
      } else {
        await showMessage('quiz_failed', { score, topic });
      }
      await checkNewUnlocks();
    },
    [showMessage, checkNewUnlocks]
  );

  const onXpGained = useCallback(
    async (xp: number, source: string) => {
      await checkNewUnlocks();
    },
    [checkNewUnlocks]
  );

  const onLogin = useCallback(async () => {
    await showMessage('welcome');
  }, [showMessage]);

  const onStreakUpdate = useCallback(
    async (days: number) => {
      if (days > 0 && (days === 7 || days === 30 || days === 100 || days === 365 || days % 50 === 0)) {
        await showMessage('streak_milestone', { days });
      } else if (days > 0 && days % 5 === 0) {
        await showMessage('streak_milestone', { days });
      }
    },
    [showMessage]
  );

  const onStreakWarning = useCallback(
    async (hoursRemaining: number) => {
      await showMessage('streak_warning', { hours_absent: 24 - hoursRemaining });
    },
    [showMessage]
  );

  const onLevelUp = useCallback(
    async (newLevel: number) => {
      await showMessage('level_up', { level: newLevel });
      await checkNewUnlocks();
    },
    [showMessage, checkNewUnlocks]
  );

  const onExamReminder = useCallback(
    async (examName: string, daysUntil: number) => {
      await showMessage('exam_reminder', { exam_name: examName, days_until: daysUntil });
    },
    [showMessage]
  );

  return {
    onQuizComplete,
    onXpGained,
    onLogin,
    onStreakUpdate,
    onStreakWarning,
    onLevelUp,
    onExamReminder,
  };
};

export default SparkContext;
