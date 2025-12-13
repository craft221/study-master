"use client";

/**
 * 🐿️⚡ Hook pour les événements Spark
 *
 * Spark réagit aux événements importants avec des messages variés et personnalisés.
 * Ce hook centralise tous les messages d'événements pour Spark.
 */

import { useCallback } from 'react';
import { useSpark } from '@/contexts/SparkContext';

// =============================================================================
// MESSAGES POUR CHAQUE TYPE D'ÉVÉNEMENT
// =============================================================================

// Quiz terminé avec différents scores
const QUIZ_MESSAGES = {
  perfect: [
    "INCROYABLE ! Score parfait ! Tu es un génie ! 🎯🔥",
    "100% ! Perfection totale ! Je suis tellement fier de toi ! 🌟",
    "WOW ! Sans faute ! Tu maîtrises ce sujet comme un pro ! 💯",
    "Score parfait ! Tu as travaillé dur et ça paye ! 🏆",
    "PARFAIT ! Tu es inarrêtable aujourd'hui ! ⭐",
    "100/100 ! Tu viens de prouver que tu es au top ! 🎉",
  ],
  excellent: [
    "Excellent travail ! Tu as presque tout bon ! 🌟",
    "Bravo ! Un super score ! Continue comme ça ! 💪",
    "Impressionnant ! Tu maîtrises vraiment bien ce sujet ! 📚",
    "Wow ! C'est du très bon travail ! Je suis fier de toi ! 🎯",
    "Super score ! Tu progresses vraiment bien ! 🚀",
  ],
  good: [
    "Bien joué ! C'est un bon score ! 👍",
    "Pas mal du tout ! Tu es sur la bonne voie ! 📈",
    "Bon travail ! Avec un peu plus de révision, tu seras parfait ! 💡",
    "C'est bien ! Continue à t'entraîner ! 🎓",
    "Score correct ! Tu t'améliores ! 🌱",
  ],
  needsWork: [
    "C'est un début ! On peut réviser ensemble si tu veux ! 📖",
    "Pas grave ! L'important c'est de continuer ! 💪",
    "Rome ne s'est pas construite en un jour ! Continue ! 🏗️",
    "Hey, chaque quiz est une occasion d'apprendre ! 🌟",
    "Ne te décourage pas ! Révise et tu verras la différence ! 📚",
  ],
};

// Flashcards - fin de révision
const FLASHCARD_MESSAGES = {
  deckComplete: [
    "Deck terminé ! Bravo pour cette session de révision ! 🎴",
    "Tu as fini toutes les cartes ! Excellent travail ! ✨",
    "Session flashcards terminée ! Ton cerveau te remercie ! 🧠",
    "Bien joué ! Les flashcards c'est super efficace ! 📚",
    "Deck révisé avec succès ! Tu mémorises comme un champion ! 💪",
  ],
  perfectReview: [
    "WOW ! Toutes les cartes justes ! Tu gères ! 🔥",
    "Parfait ! Tu connais ce deck par cœur ! 🎯",
    "100% de bonnes réponses ! Impressionnant ! ⭐",
    "Tu maîtrises ces flashcards ! Bravo ! 🏆",
  ],
  goodReview: [
    "Bonne session ! Tu progresses bien ! 📈",
    "Nice ! Tu connais la plupart des cartes ! 👍",
    "Bien révisé ! Continue comme ça ! 💡",
  ],
  needsMoreReview: [
    "Continue à réviser ! La répétition c'est la clé ! 🔑",
    "Quelques cartes à revoir, mais tu t'améliores ! 📖",
    "Pas grave, reviens demain et tu verras la différence ! 🌅",
  ],
};

// Level up
const LEVEL_UP_MESSAGES = [
  "LEVEL UP ! Tu es maintenant niveau {level} ! 🎉🚀",
  "FÉLICITATIONS ! Niveau {level} atteint ! Tu es incroyable ! 🏆",
  "BOOM ! Niveau {level} ! Ta progression est impressionnante ! 💥",
  "WOW ! Tu passes niveau {level} ! Continue comme ça ! ⭐",
  "YES ! Niveau {level} débloqué ! Tu gravis les échelons ! 📈",
  "BRAVO ! Niveau {level} ! Tu deviens de plus en plus fort ! 💪",
  "INCROYABLE ! Tu es niveau {level} maintenant ! 🌟",
  "Level {level} ! Tu es une machine d'apprentissage ! 🤖",
];

// XP gagné
const XP_GAINED_MESSAGES = {
  small: [
    "+{xp} XP ! Chaque point compte ! 💫",
    "{xp} XP de plus ! Tu avances ! ⚡",
    "Bien ! +{xp} XP ! 📈",
  ],
  medium: [
    "Woah ! +{xp} XP ! Tu progresses vite ! 🚀",
    "Nice ! {xp} XP gagnés ! Continue ! 💪",
    "+{xp} XP ! Tu es sur le bon chemin ! 🎯",
  ],
  large: [
    "ÉNORME ! +{xp} XP d'un coup ! 🔥",
    "WOW ! {xp} XP ! C'est une grosse récompense ! 💎",
    "Jackpot ! +{xp} XP ! Tu es en feu ! 🌟",
  ],
};

// Quêtes
const QUEST_MESSAGES = {
  questComplete: [
    "Quête accomplie ! Bien joué ! 🎯",
    "Mission terminée ! Tu es efficace ! ✅",
    "Une quête de plus dans la poche ! 💰",
    "Bravo ! Quête validée ! Continue ! 🌟",
    "Check ! Une quête de faite ! 📋",
  ],
  allQuestsComplete: [
    "TOUTES LES QUÊTES DU JOUR COMPLÉTÉES ! Tu es une légende ! 🏆🎉",
    "WOW ! 3/3 quêtes ! Tu as le bonus du jour ! 🎁",
    "Incroyable ! Toutes les quêtes sont terminées ! Tu gères ! ⭐",
    "Champion ! Tu as terminé toutes tes quêtes quotidiennes ! 👑",
    "100% des quêtes ! Tu es vraiment motivé aujourd'hui ! 🔥",
  ],
  dailyBonusClaimed: [
    "BONUS QUOTIDIEN ! Tu mérites cette récompense ! 🎁",
    "Bonus réclamé ! Reviens demain pour un autre ! 💎",
    "Félicitations pour ton bonus ! Continue comme ça ! 🌟",
  ],
};

// Streak
const STREAK_MESSAGES = {
  maintained: [
    "Streak maintenu ! {days} jours d'affilée ! 🔥",
    "{days} jours de suite ! Tu es régulier ! 💪",
    "Super ! Ta série continue : {days} jours ! ⚡",
  ],
  milestone: {
    7: [
      "UNE SEMAINE DE STREAK ! 7 jours ! Tu es déterminé ! 🔥🔥",
      "7 jours consécutifs ! Une semaine complète ! Bravo ! 🌟",
    ],
    14: [
      "2 SEMAINES DE STREAK ! 14 jours ! Impressionnant ! 🔥🔥🔥",
      "14 jours ! Tu es vraiment discipliné ! 💎",
    ],
    30: [
      "UN MOIS DE STREAK ! 30 JOURS ! Tu es INCROYABLE ! 🏆🔥",
      "30 jours consécutifs ! Un mois entier ! Tu es une légende ! 👑",
    ],
    50: [
      "50 JOURS DE STREAK ! Tu es inarrêtable ! 🔥🔥🔥🔥",
    ],
    100: [
      "100 JOURS DE STREAK !! CENTURION DE L'ÉTUDE ! 🏆🏆🏆",
      "CENT JOURS ! Tu as une discipline de fer ! 👑💎",
    ],
    365: [
      "UN AN DE STREAK !!! TU ES UNE LÉGENDE VIVANTE ! 🏆👑🌟💎🔥",
    ],
  },
  warning: [
    "Hey ! N'oublie pas d'étudier pour garder ta série ! 🔥",
    "Ta streak est en danger ! Une petite session ? 😊",
    "Viens réviser pour maintenir ta série de {days} jours ! 💪",
  ],
  lost: [
    "Oh non ! Ta série est terminée... Mais on recommence ! 💪",
    "Pas grave ! Une nouvelle série commence maintenant ! 🌅",
    "La streak est partie mais pas ta motivation ! Go ! 🚀",
  ],
};

// Achievements
const ACHIEVEMENT_MESSAGES = [
  "SUCCÈS DÉBLOQUÉ : {name} ! 🏅",
  "Nouveau badge : {name} ! Tu collectionnes les réussites ! 🎖️",
  "Achievement unlocked : {name} ! Bravo ! 🏆",
  "Tu as débloqué '{name}' ! Félicitations ! ⭐",
  "Badge obtenu : {name} ! Continue ta collection ! 💎",
];

// Duels
const DUEL_MESSAGES = {
  won: [
    "VICTOIRE ! Tu as gagné le duel ! 🏆⚔️",
    "Tu as écrasé ton adversaire ! Champion ! 💪",
    "Duel remporté ! Tu es le meilleur ! 🥇",
    "GAGNÉ ! Personne ne peut t'arrêter ! 🔥",
  ],
  lost: [
    "Défaite... Mais tu auras ta revanche ! 💪",
    "Pas cette fois, mais tu t'améliores ! 📈",
    "Tu apprendras de cette défaite ! Go revenge ! ⚔️",
  ],
  challenged: [
    "Un défi t'attend ! Prêt à te battre ? ⚔️",
    "Quelqu'un veut t'affronter ! En garde ! 🤺",
  ],
};

// Sessions d'étude
const SESSION_MESSAGES = {
  started: [
    "Session lancée ! C'est parti pour la productivité ! 🚀",
    "Timer démarré ! Allez, on se concentre ! 💪",
    "Session en cours ! Tu vas tout déchirer ! 🔥",
  ],
  completed: [
    "Session terminée ! Bien joué ! 🎉",
    "Bravo ! Tu as tenu toute la session ! 💪",
    "Session accomplie ! Tu peux être fier de toi ! ⭐",
  ],
  pomodoroComplete: [
    "Pomodoro terminé ! Prends une pause méritée ! 🍅",
    "25 minutes de focus ! Tu gères ! 💪",
    "Un pomodoro de plus ! Continue comme ça ! 🔥",
  ],
};

// Messages génériques d'encouragement (utilisés aléatoirement)
const ENCOURAGEMENT_MESSAGES = [
  "Tu fais du super boulot aujourd'hui ! 💪",
  "Continue comme ça, tu es sur la bonne voie ! 🚀",
  "Je suis fier de toi ! 🌟",
  "Tu progresses chaque jour ! 📈",
  "L'effort paie toujours ! Continue ! ⭐",
  "Tu es vraiment motivé aujourd'hui ! 🔥",
  "Garde cette énergie ! Tu es génial ! ⚡",
];

// =============================================================================
// HOOK
// =============================================================================

export function useSparkEventMessages() {
  const { showMessage } = useSpark();

  // Helper pour choisir un message aléatoire
  const pickRandom = useCallback((messages: string[]): string => {
    return messages[Math.floor(Math.random() * messages.length)];
  }, []);

  // Helper pour remplacer les variables dans un message
  const formatMessage = useCallback((message: string, vars: Record<string, any>): string => {
    let result = message;
    for (const [key, value] of Object.entries(vars)) {
      result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), String(value));
    }
    return result;
  }, []);

  // -------------------------------------------------------------------------
  // QUIZ
  // -------------------------------------------------------------------------

  const onQuizComplete = useCallback(async (score: number, totalQuestions: number, topic?: string) => {
    const percentage = (score / totalQuestions) * 100;
    let messages: string[];
    let mood: 'happy' | 'excited' | 'thinking' = 'happy';

    if (percentage === 100) {
      messages = QUIZ_MESSAGES.perfect;
      mood = 'excited';
    } else if (percentage >= 80) {
      messages = QUIZ_MESSAGES.excellent;
      mood = 'excited';
    } else if (percentage >= 60) {
      messages = QUIZ_MESSAGES.good;
    } else {
      messages = QUIZ_MESSAGES.needsWork;
      mood = 'thinking';
    }

    const message = pickRandom(messages);
    await showMessage('quiz_complete', {
      message_override: message,
      mood,
      animation: percentage >= 80 ? 'celebration' : 'wave',
    });
  }, [showMessage, pickRandom]);

  // -------------------------------------------------------------------------
  // FLASHCARDS
  // -------------------------------------------------------------------------

  const onFlashcardDeckComplete = useCallback(async (correctCount: number, totalCards: number, deckName?: string) => {
    const percentage = (correctCount / totalCards) * 100;
    let messages: string[];
    let mood: 'happy' | 'excited' | 'thinking' = 'happy';

    if (percentage === 100) {
      messages = FLASHCARD_MESSAGES.perfectReview;
      mood = 'excited';
    } else if (percentage >= 70) {
      messages = FLASHCARD_MESSAGES.goodReview;
    } else {
      messages = [...FLASHCARD_MESSAGES.deckComplete, ...FLASHCARD_MESSAGES.needsMoreReview];
      mood = 'thinking';
    }

    const message = pickRandom(messages);
    await showMessage('flashcard_complete', {
      message_override: message,
      mood,
      animation: percentage >= 80 ? 'celebration' : 'wave',
    });
  }, [showMessage, pickRandom]);

  // -------------------------------------------------------------------------
  // LEVEL UP
  // -------------------------------------------------------------------------

  const onLevelUp = useCallback(async (newLevel: number) => {
    const message = formatMessage(pickRandom(LEVEL_UP_MESSAGES), { level: newLevel });
    await showMessage('level_up', {
      message_override: message,
      mood: 'excited',
      animation: 'celebration',
    });
  }, [showMessage, pickRandom, formatMessage]);

  // -------------------------------------------------------------------------
  // XP
  // -------------------------------------------------------------------------

  const onXPGained = useCallback(async (xp: number, source?: string) => {
    // Ne pas afficher pour les petits gains (moins de 10 XP)
    if (xp < 10) return;

    let messages: string[];
    if (xp >= 100) {
      messages = XP_GAINED_MESSAGES.large;
    } else if (xp >= 30) {
      messages = XP_GAINED_MESSAGES.medium;
    } else {
      messages = XP_GAINED_MESSAGES.small;
    }

    const message = formatMessage(pickRandom(messages), { xp });
    await showMessage('xp_gained', {
      message_override: message,
      mood: xp >= 50 ? 'excited' : 'happy',
      animation: 'wave',
    });
  }, [showMessage, pickRandom, formatMessage]);

  // -------------------------------------------------------------------------
  // QUESTS
  // -------------------------------------------------------------------------

  const onQuestComplete = useCallback(async (questTitle: string, isAllComplete: boolean = false) => {
    if (isAllComplete) {
      const message = pickRandom(QUEST_MESSAGES.allQuestsComplete);
      await showMessage('all_quests_complete', {
        message_override: message,
        mood: 'excited',
        animation: 'celebration',
      });
    } else {
      const message = pickRandom(QUEST_MESSAGES.questComplete);
      await showMessage('quest_complete', {
        message_override: message,
        mood: 'happy',
        animation: 'wave',
      });
    }
  }, [showMessage, pickRandom]);

  const onDailyBonusClaimed = useCallback(async () => {
    const message = pickRandom(QUEST_MESSAGES.dailyBonusClaimed);
    await showMessage('daily_bonus', {
      message_override: message,
      mood: 'excited',
      animation: 'celebration',
    });
  }, [showMessage, pickRandom]);

  // -------------------------------------------------------------------------
  // STREAK
  // -------------------------------------------------------------------------

  const onStreakUpdate = useCallback(async (days: number, isNewMilestone: boolean = false) => {
    let message: string;
    let mood: 'happy' | 'excited' = 'happy';

    // Vérifier si c'est un milestone spécial
    const milestones = [7, 14, 30, 50, 100, 365];
    const milestone = milestones.find(m => m === days);

    if (milestone && STREAK_MESSAGES.milestone[milestone as keyof typeof STREAK_MESSAGES.milestone]) {
      const milestoneMessages = STREAK_MESSAGES.milestone[milestone as keyof typeof STREAK_MESSAGES.milestone];
      message = pickRandom(milestoneMessages);
      mood = 'excited';
    } else {
      message = formatMessage(pickRandom(STREAK_MESSAGES.maintained), { days });
    }

    await showMessage('streak_update', {
      message_override: message,
      mood,
      animation: mood === 'excited' ? 'celebration' : 'wave',
    });
  }, [showMessage, pickRandom, formatMessage]);

  const onStreakWarning = useCallback(async (currentDays: number) => {
    const message = formatMessage(pickRandom(STREAK_MESSAGES.warning), { days: currentDays });
    await showMessage('streak_warning', {
      message_override: message,
      mood: 'thinking',
      animation: 'idle',
    });
  }, [showMessage, pickRandom, formatMessage]);

  const onStreakLost = useCallback(async () => {
    const message = pickRandom(STREAK_MESSAGES.lost);
    await showMessage('streak_lost', {
      message_override: message,
      mood: 'sad',
      animation: 'idle',
    });
  }, [showMessage, pickRandom]);

  // -------------------------------------------------------------------------
  // ACHIEVEMENTS
  // -------------------------------------------------------------------------

  const onAchievementUnlocked = useCallback(async (achievementName: string, xpReward: number) => {
    const message = formatMessage(pickRandom(ACHIEVEMENT_MESSAGES), { name: achievementName });
    await showMessage('achievement_unlocked', {
      message_override: message,
      mood: 'excited',
      animation: 'celebration',
    });
  }, [showMessage, pickRandom, formatMessage]);

  // -------------------------------------------------------------------------
  // DUELS
  // -------------------------------------------------------------------------

  const onDuelWon = useCallback(async (opponentName: string, xpWon: number) => {
    const message = pickRandom(DUEL_MESSAGES.won);
    await showMessage('duel_won', {
      message_override: message,
      mood: 'excited',
      animation: 'celebration',
    });
  }, [showMessage, pickRandom]);

  const onDuelLost = useCallback(async (opponentName: string) => {
    const message = pickRandom(DUEL_MESSAGES.lost);
    await showMessage('duel_lost', {
      message_override: message,
      mood: 'thinking',
      animation: 'idle',
    });
  }, [showMessage, pickRandom]);

  const onDuelChallenged = useCallback(async (challengerName: string) => {
    const message = pickRandom(DUEL_MESSAGES.challenged);
    await showMessage('duel_challenged', {
      message_override: message,
      mood: 'excited',
      animation: 'wave',
    });
  }, [showMessage, pickRandom]);

  // -------------------------------------------------------------------------
  // SESSIONS
  // -------------------------------------------------------------------------

  const onSessionStart = useCallback(async () => {
    const message = pickRandom(SESSION_MESSAGES.started);
    await showMessage('session_start', {
      message_override: message,
      mood: 'excited',
      animation: 'wave',
    });
  }, [showMessage, pickRandom]);

  const onSessionComplete = useCallback(async (durationMinutes: number) => {
    const message = pickRandom(SESSION_MESSAGES.completed);
    await showMessage('session_complete', {
      message_override: message,
      mood: 'happy',
      animation: 'celebration',
    });
  }, [showMessage, pickRandom]);

  const onPomodoroComplete = useCallback(async () => {
    const message = pickRandom(SESSION_MESSAGES.pomodoroComplete);
    await showMessage('pomodoro_complete', {
      message_override: message,
      mood: 'happy',
      animation: 'wave',
    });
  }, [showMessage, pickRandom]);

  // -------------------------------------------------------------------------
  // ENCOURAGEMENT RANDOM
  // -------------------------------------------------------------------------

  const showEncouragement = useCallback(async () => {
    const message = pickRandom(ENCOURAGEMENT_MESSAGES);
    await showMessage('encouragement', {
      message_override: message,
      mood: 'happy',
      animation: 'wave',
    });
  }, [showMessage, pickRandom]);

  return {
    // Quiz
    onQuizComplete,

    // Flashcards
    onFlashcardDeckComplete,

    // Progression
    onLevelUp,
    onXPGained,

    // Quests
    onQuestComplete,
    onDailyBonusClaimed,

    // Streak
    onStreakUpdate,
    onStreakWarning,
    onStreakLost,

    // Achievements
    onAchievementUnlocked,

    // Duels
    onDuelWon,
    onDuelLost,
    onDuelChallenged,

    // Sessions
    onSessionStart,
    onSessionComplete,
    onPomodoroComplete,

    // General
    showEncouragement,
  };
}

export default useSparkEventMessages;
