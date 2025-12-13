"use client";

import { useState, useEffect, useCallback } from 'react';
import { SparkMood, SparkAnimation } from '@/components/Spark';
import api from '@/lib/api';

/**
 * Hook personnalisé pour gérer Spark la Mascotte
 *
 * Gère l'état, les messages, les interactions avec l'API
 */

interface SparkState {
  name: string;
  level: number;
  levelName: string;
  unlockedAccessories: string[];
  currentAccessory: string | null;
  totalAccessories: number;
  userXp: number;
  userStreak: number;
}

interface SparkMessage {
  message: string;
  mood: SparkMood;
  animation: SparkAnimation;
  timestamp: string;
}

interface SparkAnswer {
  answer: string;
  mood: SparkMood;
  animation: SparkAnimation;
  suggestions: string[];
  timestamp: string;
}

interface UseSparkReturn {
  // État
  sparkState: SparkState | null;
  currentMessage: SparkMessage | null;
  currentAnswer: SparkAnswer | null;
  isLoading: boolean;

  // Actions
  fetchSparkState: () => Promise<void>;
  showMessage: (event: string, context?: any, useAI?: boolean) => Promise<void>;
  askQuestion: (question: string, context?: any) => Promise<void>;
  interactWithSpark: () => Promise<void>;
  checkNewUnlocks: () => Promise<any>;
  updateSparkName: (name: string) => Promise<void>;
  equipAccessory: (accessoryId: string) => Promise<void>;

  // Utilitaires
  clearMessage: () => void;
  clearAnswer: () => void;
}

export const useSpark = (): UseSparkReturn => {
  const [sparkState, setSparkState] = useState<SparkState | null>(null);
  const [currentMessage, setCurrentMessage] = useState<SparkMessage | null>(null);
  const [currentAnswer, setCurrentAnswer] = useState<SparkAnswer | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  /**
   * Récupère l'état actuel de Spark
   */
  const fetchSparkState = useCallback(async () => {
    try {
      const token = localStorage.getItem('access_token');
      if (!token) {
        console.log('Spark: Pas de token, skip fetch');
        return;
      }

      const response = await api.get('/mascot/state');
      const data = response.data;

      setSparkState({
        name: data.name,
        level: data.level,
        levelName: data.level_name,
        unlockedAccessories: data.unlocked_accessories,
        currentAccessory: data.current_accessory,
        totalAccessories: data.total_accessories,
        userXp: data.user_xp,
        userStreak: data.user_streak,
      });
      console.log('Spark: État récupéré', data);
    } catch (error) {
      console.error('Spark: Erreur lors de la récupération:', error);
    }
  }, []);

  /**
   * Affiche un message de Spark selon l'événement
   */
  const showMessage = useCallback(async (
    event: string,
    context: any = {},
    useAI: boolean = false
  ) => {
    try {
      setIsLoading(true);
      const token = localStorage.getItem('access_token');
      if (!token) return;

      const response = await api.post('/mascot/message', {
        event,
        use_ai: useAI,
        context,
      });

      const data = response.data;
      setCurrentMessage({
        message: data.message,
        mood: data.mood as SparkMood,
        animation: data.animation as SparkAnimation,
        timestamp: data.timestamp,
      });

      console.log('Spark message:', data.message);

      // Auto-clear après 5 secondes
      setTimeout(() => {
        setCurrentMessage(null);
      }, 5000);
    } catch (error) {
      console.error('Spark: Erreur lors de la génération du message:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Pose une question directe à Spark
   */
  const askQuestion = useCallback(async (
    question: string,
    context: any = {}
  ) => {
    try {
      setIsLoading(true);
      const token = localStorage.getItem('access_token');
      if (!token) return;

      const response = await api.post('/mascot/ask', {
        question,
        context,
      });

      const data = response.data;
      setCurrentAnswer({
        answer: data.answer,
        mood: data.mood as SparkMood,
        animation: data.animation as SparkAnimation,
        suggestions: data.suggestions || [],
        timestamp: data.timestamp,
      });

      // Afficher aussi un message court sur Spark
      setCurrentMessage({
        message: "Voici ma réponse ! 💡",
        mood: 'helpful' as SparkMood,
        animation: 'wave',
        timestamp: new Date().toISOString(),
      });

      // Auto-clear message après 3 secondes
      setTimeout(() => {
        setCurrentMessage(null);
      }, 3000);
    } catch (error) {
      console.error('Spark: Erreur lors de la question:', error);
      setCurrentAnswer({
        answer: "Oups ! J'ai eu un petit problème en essayant de répondre. Réessaie dans un instant ! 🐿️",
        mood: 'sad',
        animation: 'idle',
        suggestions: [],
        timestamp: new Date().toISOString(),
      });
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Interaction avec Spark (clic)
   */
  const interactWithSpark = useCallback(async () => {
    try {
      const token = localStorage.getItem('access_token');
      if (!token) return;

      const response = await api.post('/mascot/interaction');
      const data = response.data;

      setCurrentMessage({
        message: data.message,
        mood: data.mood as SparkMood,
        animation: data.animation as SparkAnimation,
        timestamp: new Date().toISOString(),
      });

      setTimeout(() => {
        setCurrentMessage(null);
      }, 4000);
    } catch (error) {
      console.error('Spark: Erreur lors de l\'interaction:', error);
    }
  }, []);

  /**
   * Vérifie les nouveaux débloquages
   */
  const checkNewUnlocks = useCallback(async () => {
    try {
      const token = localStorage.getItem('access_token');
      if (!token) return null;

      const response = await api.get('/mascot/check-new-unlocks');
      const data = response.data;

      if (data.has_new_unlocks) {
        setCurrentMessage({
          message: data.message,
          mood: data.mood as SparkMood,
          animation: data.animation as SparkAnimation,
          timestamp: new Date().toISOString(),
        });

        // Rafraîchir l'état
        await fetchSparkState();

        setTimeout(() => {
          setCurrentMessage(null);
        }, 6000);
      }

      return data;
    } catch (error) {
      console.error('Spark: Erreur lors de la vérification des déblocages:', error);
    }
    return null;
  }, [fetchSparkState]);

  /**
   * Met à jour le nom de Spark
   */
  const updateSparkName = useCallback(async (name: string) => {
    try {
      const token = localStorage.getItem('access_token');
      if (!token) return;

      await api.patch('/mascot/update', { name });
      await fetchSparkState();
    } catch (error) {
      console.error('Spark: Erreur lors de la mise à jour du nom:', error);
    }
  }, [fetchSparkState]);

  /**
   * Équipe un accessoire
   */
  const equipAccessory = useCallback(async (accessoryId: string) => {
    try {
      const token = localStorage.getItem('access_token');
      if (!token) return;

      await api.patch('/mascot/update', { current_accessory: accessoryId });
      await fetchSparkState();

      // Message de confirmation
      setCurrentMessage({
        message: `Nouvel accessoire équipé ! Je suis trop stylé ! ⚡`,
        mood: 'excited',
        animation: 'showcase',
        timestamp: new Date().toISOString(),
      });

      setTimeout(() => {
        setCurrentMessage(null);
      }, 3000);
    } catch (error) {
      console.error('Spark: Erreur lors de l\'équipement de l\'accessoire:', error);
    }
  }, [fetchSparkState]);

  /**
   * Efface le message actuel
   */
  const clearMessage = useCallback(() => {
    setCurrentMessage(null);
  }, []);

  /**
   * Efface la réponse actuelle
   */
  const clearAnswer = useCallback(() => {
    setCurrentAnswer(null);
  }, []);

  // Charger l'état initial au montage
  useEffect(() => {
    fetchSparkState();
  }, [fetchSparkState]);

  return {
    sparkState,
    currentMessage,
    currentAnswer,
    isLoading,
    fetchSparkState,
    showMessage,
    askQuestion,
    interactWithSpark,
    checkNewUnlocks,
    updateSparkName,
    equipAccessory,
    clearMessage,
    clearAnswer,
  };
};

/**
 * Hook pour afficher automatiquement Spark sur certains événements
 */
export const useSparkEvents = () => {
  const { showMessage, checkNewUnlocks } = useSpark();

  /**
   * Appelé après un quiz
   */
  const onQuizComplete = useCallback(async (score: number, topic: string) => {
    if (score >= 80) {
      await showMessage('quiz_success', { score, topic });
    } else {
      await showMessage('quiz_failed', { score, topic });
    }
    // Vérifier les déblocages
    await checkNewUnlocks();
  }, [showMessage, checkNewUnlocks]);

  /**
   * Appelé après gain de XP
   */
  const onXpGained = useCallback(async (xp: number, source: string) => {
    await checkNewUnlocks();
  }, [checkNewUnlocks]);

  /**
   * Appelé lors de la connexion
   */
  const onLogin = useCallback(async () => {
    await showMessage('welcome');
  }, [showMessage]);

  /**
   * Appelé après une série
   */
  const onStreakUpdate = useCallback(async (days: number) => {
    if (days > 0 && days % 5 === 0) {
      await showMessage('streak', { days });
    }
  }, [showMessage]);

  return {
    onQuizComplete,
    onXpGained,
    onLogin,
    onStreakUpdate,
  };
};
