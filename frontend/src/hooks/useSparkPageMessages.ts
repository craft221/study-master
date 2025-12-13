"use client";

/**
 * 🐿️⚡ Hook pour les messages contextuels de Spark selon la page
 *
 * Spark réagit intelligemment aux changements de page et donne des conseils
 * pertinents selon le contexte.
 */

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useSpark } from '@/contexts/SparkContext';

// Messages contextuels par page
const PAGE_MESSAGES: Record<string, {
  event: string;
  messages: string[];
  context?: Record<string, any>;
  delay?: number;
  probability?: number; // Probabilité d'afficher (0-1)
}> = {
  '/dashboard': {
    event: 'page_dashboard',
    messages: [
      "Bienvenue sur ton tableau de bord ! Prêt à étudier ? 📚",
      "Hey ! Regarde tes stats, tu progresses bien ! 📈",
      "C'est parti pour une session productive ! 💪",
    ],
    delay: 3000, // Plus de délai pour le dashboard (après le message de bienvenue)
    probability: 0.5, // 50% de chance
  },
  '/notes': {
    event: 'page_notes',
    messages: [
      "Tes notes t'attendent ! Qu'est-ce qu'on révise aujourd'hui ? 📝",
      "Prendre des notes c'est la clé ! Tu gères ! ✨",
      "N'oublie pas : relire ses notes régulièrement aide à mémoriser ! 🧠",
    ],
    delay: 1500,
    probability: 0.8, // Augmenté pour test
  },
  '/flashcards': {
    event: 'page_flashcards',
    messages: [
      "Les flashcards ! Ma technique préférée pour mémoriser ! 🎴",
      "Réviser avec les flashcards, c'est super efficace ! 💡",
      "Allez, on fait tourner ces cartes ! Tu vas tout retenir ! 🔥",
    ],
    delay: 1500,
    probability: 0.8, // Augmenté pour test
  },
  '/quizzes': {
    event: 'page_quizzes',
    messages: [
      "Un quiz ? J'adore ! Montre-moi ce que tu sais ! 🎯",
      "Les quiz c'est le meilleur moyen de tester tes connaissances ! 📊",
      "Prêt à te challenger ? Go go go ! 🚀",
    ],
    delay: 1500,
    probability: 0.8, // Augmenté pour test
  },
  '/quests': {
    event: 'page_quests',
    messages: [
      "Tes quêtes du jour ! Complète-les toutes pour le bonus ! 🎯",
      "3 quêtes = 3 récompenses + bonus ! Tu peux le faire ! 💪",
      "Chaque quête complétée te rapproche de ton objectif ! ⭐",
    ],
    delay: 1500,
    probability: 0.8, // Augmenté pour test
  },
  '/leaderboard': {
    event: 'page_leaderboard',
    messages: [
      "Le classement ! Voyons où tu te situes... 🏆",
      "Tu veux monter dans le classement ? Continue comme ça ! 📈",
      "La compétition saine motive ! Tu es dans le top ? 🥇",
    ],
    delay: 1500,
    probability: 0.8,
  },
  '/achievements': {
    event: 'page_achievements',
    messages: [
      "Tes accomplissements ! Tu en as débloqué combien ? 🏅",
      "Chaque badge raconte une histoire de réussite ! ✨",
      "Continue comme ça et tu les auras tous ! 🎖️",
    ],
    delay: 1500,
    probability: 0.8,
  },
  '/profile': {
    event: 'page_profile',
    messages: [
      "Ton profil ! Tu veux personnaliser quelque chose ? 👤",
      "C'est ici que tu peux voir ta progression globale ! 📊",
    ],
    delay: 1500,
    probability: 0.8,
  },
  '/schedule': {
    event: 'page_schedule',
    messages: [
      "Ton planning ! Bien s'organiser c'est la clé du succès ! 📅",
      "Des examens à venir ? Je peux t'aider à te préparer ! 📚",
      "Planifier ses révisions aide à réduire le stress ! 🧘",
    ],
    delay: 1500,
    probability: 0.8,
  },
  '/explore': {
    event: 'page_explore',
    messages: [
      "Explorer ! Découvre ce que les autres ont créé ! 🌍",
      "Tu peux trouver des ressources super utiles ici ! 💎",
      "Partager c'est grandir ensemble ! 🤝",
    ],
    delay: 1500,
    probability: 0.8,
  },
  '/duels': {
    event: 'page_duels',
    messages: [
      "Les duels ! Prêt à affronter d'autres étudiants ? ⚔️",
      "Un duel c'est fun ET éducatif ! En garde ! 🤺",
      "Gagner un duel = XP bonus ! Tu relèves le défi ? 🎮",
    ],
    delay: 1500,
    probability: 0.8,
  },
  '/focus-rooms': {
    event: 'page_focus_rooms',
    messages: [
      "Les Focus Rooms ! Étudier ensemble c'est plus motivant ! 👥",
      "Rejoins une salle et étudie en groupe ! 🎓",
      "La concentration partagée, ça booste la productivité ! 🚀",
    ],
    delay: 1500,
    probability: 0.8,
  },
  '/ai': {
    event: 'page_ai',
    messages: [
      "Hey c'est moi ! Tu veux qu'on discute ? 🐿️",
      "Je suis là pour t'aider ! Pose-moi tes questions ! 💬",
      "Mode tuteur activé ! Qu'est-ce que tu veux apprendre ? 📖",
    ],
    delay: 1000,
    probability: 0.9,
  },
  '/documents': {
    event: 'page_documents',
    messages: [
      "Tes documents ! Tu as besoin de les organiser ? 📁",
      "Les documents bien rangés sont plus faciles à retrouver ! 🗂️",
      "Tu peux partager tes documents avec d'autres étudiants ! 🤝",
    ],
    delay: 1500,
    probability: 0.8,
  },
  '/subjects': {
    event: 'page_subjects',
    messages: [
      "Tes matières ! Quelle est ta préférée ? 📚",
      "Organiser par matière aide à mieux réviser ! 🎯",
      "Chaque matière est une nouvelle aventure ! 🌟",
    ],
    delay: 1500,
    probability: 0.8,
  },
  '/sessions': {
    event: 'page_sessions',
    messages: [
      "Sessions d'étude ! Prêt pour une session productive ? ⚡",
      "Le pomodoro c'est la vie ! 25 min de focus ! 🍅",
      "Une session par jour éloigne l'échec pour toujours ! 💪",
    ],
    delay: 1500,
    probability: 0.8,
  },
  '/groups': {
    event: 'page_groups',
    messages: [
      "Les groupes d'étude ! L'union fait la force ! 👥",
      "Étudier ensemble c'est plus fun ! 🎉",
      "Rejoins ou crée un groupe pour progresser ensemble ! 🤝",
    ],
    delay: 1500,
    probability: 0.8,
  },
};

export function useSparkPageMessages() {
  const pathname = usePathname();
  const { showMessage } = useSpark();
  const lastPageRef = useRef<string | null>(null);
  const lastMessageTimeRef = useRef<number>(0);
  const [isReady, setIsReady] = useState(false);
  const isFirstPageRef = useRef(true);

  // Attendre un peu après le montage pour que Spark soit initialisé
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsReady(true);
      console.log('🐿️ PageMessages: Hook prêt');
    }, 3000); // 3s pour laisser le message de bienvenue s'afficher
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    // Ne rien faire si pas prêt ou pas de pathname
    if (!isReady || !pathname) {
      console.log('🐿️ PageMessages: Skip - isReady:', isReady, 'pathname:', pathname);
      return;
    }

    // Ignorer la première page (généralement le dashboard après login)
    // car le message de bienvenue est déjà affiché
    if (isFirstPageRef.current) {
      console.log('🐿️ PageMessages: Skip - première page (welcome message déjà affiché)');
      isFirstPageRef.current = false;
      lastPageRef.current = pathname;
      return;
    }

    // Éviter de répéter le message sur la même page
    if (lastPageRef.current === pathname) {
      console.log('🐿️ PageMessages: Skip - même page:', pathname);
      return;
    }

    // Éviter les messages trop fréquents (minimum 10 secondes entre chaque)
    const now = Date.now();
    const timeSinceLast = now - lastMessageTimeRef.current;
    if (timeSinceLast < 10000 && lastMessageTimeRef.current > 0) {
      console.log('🐿️ PageMessages: Skip - trop récent:', timeSinceLast, 'ms');
      lastPageRef.current = pathname;
      return;
    }

    // Trouver la config de la page actuelle
    let pageConfig = PAGE_MESSAGES[pathname];

    // Si pas de config exacte, chercher une correspondance partielle
    if (!pageConfig) {
      for (const [path, config] of Object.entries(PAGE_MESSAGES)) {
        if (pathname.startsWith(path) && path !== '/') {
          pageConfig = config;
          break;
        }
      }
    }

    if (!pageConfig) {
      console.log('🐿️ PageMessages: Skip - pas de config pour:', pathname);
      lastPageRef.current = pathname;
      return;
    }

    console.log('🐿️ PageMessages: Config trouvée pour:', pathname, pageConfig.event);

    // Vérifier la probabilité
    const probability = pageConfig.probability || 0.5;
    const random = Math.random();
    if (random > probability) {
      console.log('🐿️ PageMessages: Skip - probabilité:', random, '>', probability);
      lastPageRef.current = pathname;
      return;
    }

    // Choisir un message aléatoire
    const randomMessage = pageConfig.messages[
      Math.floor(Math.random() * pageConfig.messages.length)
    ];

    console.log('🐿️ PageMessages: Programmation message:', randomMessage);

    // Afficher le message après un délai
    const delay = pageConfig.delay || 1500;
    const timer = setTimeout(() => {
      console.log('🐿️ PageMessages: AFFICHAGE message:', randomMessage);
      showMessage(pageConfig.event, {
        ...pageConfig.context,
        message_override: randomMessage,
      });
      lastMessageTimeRef.current = Date.now();
    }, delay);

    lastPageRef.current = pathname;

    return () => clearTimeout(timer);
  }, [pathname, isReady, showMessage]);
}

export default useSparkPageMessages;
