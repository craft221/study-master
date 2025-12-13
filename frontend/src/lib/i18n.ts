/**
 * Internationalisation (i18n) - Client-side translations
 * ========================================================
 *
 * Ce module gère les traductions côté client.
 * Il charge les messages JSON et fournit des fonctions pour traduire.
 */

import frMessages from '../../messages/fr.json';
import enMessages from '../../messages/en.json';
import esMessages from '../../messages/es.json';

// Types
export type Locale = 'fr' | 'en' | 'es';
export type Messages = typeof frMessages;

// Langues supportées
export const SUPPORTED_LOCALES: Locale[] = ['fr', 'en', 'es'];
export const DEFAULT_LOCALE: Locale = 'fr';

// Noms des langues pour l'affichage
export const LOCALE_NAMES: Record<Locale, { native: string; english: string }> = {
  fr: { native: 'Français', english: 'French' },
  en: { native: 'English', english: 'English' },
  es: { native: 'Español', english: 'Spanish' },
};

// Messages par langue
const messages: Record<Locale, Messages> = {
  fr: frMessages,
  en: enMessages,
  es: esMessages,
};

/**
 * Récupère les messages pour une langue donnée
 */
export function getMessages(locale: Locale): Messages {
  return messages[locale] || messages[DEFAULT_LOCALE];
}

/**
 * Récupère une traduction par son chemin (ex: "nav.dashboard")
 */
export function t(locale: Locale, path: string, params?: Record<string, string | number>): string {
  const keys = path.split('.');
  let result: any = messages[locale] || messages[DEFAULT_LOCALE];

  for (const key of keys) {
    if (result && typeof result === 'object' && key in result) {
      result = result[key];
    } else {
      console.warn(`Translation not found: ${path}`);
      return path;
    }
  }

  if (typeof result !== 'string') {
    console.warn(`Translation is not a string: ${path}`);
    return path;
  }

  // Remplacer les paramètres {param} par leurs valeurs
  if (params) {
    return result.replace(/\{(\w+)\}/g, (_, key) => {
      return params[key]?.toString() || `{${key}}`;
    });
  }

  return result;
}

/**
 * Détecte la langue préférée du navigateur
 */
export function detectBrowserLocale(): Locale {
  if (typeof window === 'undefined') {
    return DEFAULT_LOCALE;
  }

  const browserLang = navigator.language.split('-')[0];

  if (SUPPORTED_LOCALES.includes(browserLang as Locale)) {
    return browserLang as Locale;
  }

  return DEFAULT_LOCALE;
}

/**
 * Récupère la langue stockée dans localStorage
 */
export function getStoredLocale(): Locale | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const stored = localStorage.getItem('locale');

  if (stored && SUPPORTED_LOCALES.includes(stored as Locale)) {
    return stored as Locale;
  }

  return null;
}

/**
 * Stocke la langue dans localStorage
 */
export function setStoredLocale(locale: Locale): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem('locale', locale);
  }
}

/**
 * Récupère la langue à utiliser (stored > browser > default)
 */
export function getInitialLocale(): Locale {
  return getStoredLocale() || detectBrowserLocale();
}
