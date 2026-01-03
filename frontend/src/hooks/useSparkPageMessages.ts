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
import { useLanguage } from '@/contexts/LanguageContext';
import { getArray } from '@/lib/i18n';

// Configuration des pages (sans les messages, juste les paramètres)
const PAGE_CONFIG: Record<string, {
  event: string;
  messageKey: string;
  context?: Record<string, any>;
  delay?: number;
  probability?: number;
}> = {
  '/dashboard': {
    event: 'page_dashboard',
    messageKey: 'dashboard',
    delay: 3000,
    probability: 0.5,
  },
  '/notes': {
    event: 'page_notes',
    messageKey: 'notes',
    delay: 1500,
    probability: 0.8,
  },
  '/flashcards': {
    event: 'page_flashcards',
    messageKey: 'flashcards',
    delay: 1500,
    probability: 0.8,
  },
  '/quizzes': {
    event: 'page_quizzes',
    messageKey: 'quizzes',
    delay: 1500,
    probability: 0.8,
  },
  '/quests': {
    event: 'page_quests',
    messageKey: 'quests',
    delay: 1500,
    probability: 0.8,
  },
  '/leaderboard': {
    event: 'page_leaderboard',
    messageKey: 'leaderboard',
    delay: 1500,
    probability: 0.8,
  },
  '/achievements': {
    event: 'page_achievements',
    messageKey: 'achievements',
    delay: 1500,
    probability: 0.8,
  },
  '/profile': {
    event: 'page_profile',
    messageKey: 'profile',
    delay: 1500,
    probability: 0.8,
  },
  '/schedule': {
    event: 'page_schedule',
    messageKey: 'schedule',
    delay: 1500,
    probability: 0.8,
  },
  '/explore': {
    event: 'page_explore',
    messageKey: 'explore',
    delay: 1500,
    probability: 0.8,
  },
  '/duels': {
    event: 'page_duels',
    messageKey: 'duels',
    delay: 1500,
    probability: 0.8,
  },
  '/focus-rooms': {
    event: 'page_focus_rooms',
    messageKey: 'focusRooms',
    delay: 1500,
    probability: 0.8,
  },
  '/ai': {
    event: 'page_ai',
    messageKey: 'ai',
    delay: 1000,
    probability: 0.9,
  },
  '/documents': {
    event: 'page_documents',
    messageKey: 'documents',
    delay: 1500,
    probability: 0.8,
  },
  '/subjects': {
    event: 'page_subjects',
    messageKey: 'subjects',
    delay: 1500,
    probability: 0.8,
  },
  '/sessions': {
    event: 'page_sessions',
    messageKey: 'sessions',
    delay: 1500,
    probability: 0.8,
  },
  '/groups': {
    event: 'page_groups',
    messageKey: 'groups',
    delay: 1500,
    probability: 0.8,
  },
};

export function useSparkPageMessages() {
  const pathname = usePathname();
  const { showMessage } = useSpark();
  const { locale } = useLanguage();
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
    let pageConfig = PAGE_CONFIG[pathname];

    // Si pas de config exacte, chercher une correspondance partielle
    if (!pageConfig) {
      for (const [path, config] of Object.entries(PAGE_CONFIG)) {
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

    // Récupérer les messages traduits depuis i18n
    const messagesKey = `sparkWidget.pageMessages.${pageConfig.messageKey}`;
    const messages = getArray(locale, messagesKey);

    // Vérifier que les messages existent et sont un tableau
    if (!Array.isArray(messages) || messages.length === 0) {
      console.log('🐿️ PageMessages: Skip - pas de messages pour:', messagesKey);
      lastPageRef.current = pathname;
      return;
    }

    // Choisir un message aléatoire
    const randomMessage = messages[Math.floor(Math.random() * messages.length)];

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
  }, [pathname, isReady, showMessage, locale]);
}

export default useSparkPageMessages;
