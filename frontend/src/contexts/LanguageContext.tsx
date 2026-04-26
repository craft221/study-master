'use client';

/**
 * Language Context - Gestion de la langue dans l'application
 * ===========================================================
 *
 * Ce contexte gère:
 * - La langue actuelle de l'interface
 * - Le changement de langue
 * - La synchronisation avec le backend
 * - La persistance dans localStorage
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  Locale,
  DEFAULT_LOCALE,
  SUPPORTED_LOCALES,
  LOCALE_NAMES,
  getMessages,
  t as translate,
  getArray as getArrayTranslation,
  getInitialLocale,
  setStoredLocale,
  isRTL as isRTLLocale,
  Messages,
} from '@/lib/i18n';
import { useAuth } from '@/store/auth-store';
import api from '@/lib/api';

// Types
interface LanguageContextType {
  locale: Locale;
  messages: Messages;
  setLocale: (locale: Locale) => Promise<void>;
  t: (path: string, params?: Record<string, string | number>) => string;
  tArray: (path: string) => string[];
  supportedLocales: typeof SUPPORTED_LOCALES;
  localeNames: typeof LOCALE_NAMES;
  isLoading: boolean;
  isRTL: boolean;
}

// Contexte
const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

// Provider
export function LanguageProvider({ children }: { children: React.ReactNode }) {
  // Toujours commencer avec DEFAULT_LOCALE pour éviter les erreurs d'hydratation
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE);
  const [messages, setMessages] = useState<Messages>(getMessages(DEFAULT_LOCALE));
  const [isLoading, setIsLoading] = useState(true);
  const [isMounted, setIsMounted] = useState(false);
  const { user, isAuthenticated } = useAuth();

  // Marquer le composant comme monté (côté client uniquement)
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Initialiser la langue au chargement (seulement après le montage)
  useEffect(() => {
    if (!isMounted) return;

    const initLocale = async () => {
      setIsLoading(true);

      try {
        // Si l'utilisateur est connecté, utiliser sa langue préférée
        if (isAuthenticated && user?.language) {
          const userLocale = user.language as Locale;
          if (SUPPORTED_LOCALES.includes(userLocale)) {
            setLocaleState(userLocale);
            setMessages(getMessages(userLocale));
            setStoredLocale(userLocale);
            setIsLoading(false);
            return;
          }
        }

        // Sinon, utiliser la langue stockée ou celle du navigateur
        const initialLocale = getInitialLocale();
        setLocaleState(initialLocale);
        setMessages(getMessages(initialLocale));
      } catch (error) {
        console.error('Error initializing locale:', error);
      } finally {
        setIsLoading(false);
      }
    };

    initLocale();
  }, [isMounted, isAuthenticated, user?.language]);

  // Fonction pour changer la langue
  const setLocale = useCallback(async (newLocale: Locale) => {
    if (!SUPPORTED_LOCALES.includes(newLocale)) {
      console.warn(`Unsupported locale: ${newLocale}`);
      return;
    }

    setIsLoading(true);

    try {
      // Mettre à jour l'état local
      setLocaleState(newLocale);
      setMessages(getMessages(newLocale));
      setStoredLocale(newLocale);

      // Synchroniser avec le backend si connecté
      if (isAuthenticated) {
        await api.patch('/users/me/language', { language: newLocale });
      }
    } catch (error) {
      console.error('Error updating locale:', error);
      // On ne revert pas car le changement local a réussi
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated]);

  // Fonction de traduction avec la locale actuelle
  const t = useCallback((path: string, params?: Record<string, string | number>) => {
    return translate(locale, path, params);
  }, [locale]);

  // Fonction pour récupérer un tableau de traductions
  const tArray = useCallback((path: string) => {
    return getArrayTranslation(locale, path);
  }, [locale]);

  const value: LanguageContextType = {
    locale,
    messages,
    setLocale,
    t,
    tArray,
    supportedLocales: SUPPORTED_LOCALES,
    localeNames: LOCALE_NAMES,
    isLoading,
    isRTL: isRTLLocale(locale),
  };

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

// Hook pour utiliser le contexte
export function useLanguage() {
  const context = useContext(LanguageContext);

  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }

  return context;
}

// Hook raccourci pour les traductions
export function useTranslation() {
  const { t, locale } = useLanguage();
  return { t, locale };
}
