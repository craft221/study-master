'use client';

/**
 * Language Selector Component
 * ===========================
 *
 * Composant pour sélectionner la langue de l'interface.
 * Synchronise automatiquement avec le backend.
 */

import React from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Locale } from '@/lib/i18n';
import { Globe } from 'lucide-react';

interface LanguageSelectorProps {
  variant?: 'dropdown' | 'buttons' | 'select';
  showLabel?: boolean;
  className?: string;
}

export function LanguageSelector({
  variant = 'select',
  showLabel = true,
  className = '',
}: LanguageSelectorProps) {
  const { locale, setLocale, supportedLocales, localeNames, isLoading, t } = useLanguage();

  const handleChange = async (newLocale: Locale) => {
    if (newLocale !== locale) {
      await setLocale(newLocale);
    }
  };

  if (variant === 'buttons') {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        {showLabel && (
          <span className="text-sm text-gray-600 dark:text-gray-400 flex items-center gap-1">
            <Globe className="h-4 w-4" />
            {t('settings.language')}:
          </span>
        )}
        <div className="flex gap-1">
          {supportedLocales.map((loc) => (
            <button
              key={loc}
              onClick={() => handleChange(loc)}
              disabled={isLoading}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                locale === loc
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
              } ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {localeNames[loc].native}
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (variant === 'dropdown') {
    return (
      <div className={`relative ${className}`}>
        <button
          className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          disabled={isLoading}
        >
          <Globe className="h-4 w-4" />
          {localeNames[locale].native}
        </button>
        {/* Dropdown menu would go here */}
      </div>
    );
  }

  // Default: select
  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      {showLabel && (
        <label className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
          <Globe className="h-4 w-4" />
          {t('settings.language')}
        </label>
      )}
      <select
        value={locale}
        onChange={(e) => handleChange(e.target.value as Locale)}
        disabled={isLoading}
        className={`
          w-full px-3 py-2 text-sm
          bg-white dark:bg-gray-800
          border border-gray-300 dark:border-gray-600
          rounded-lg
          text-gray-900 dark:text-gray-100
          focus:ring-2 focus:ring-primary-500 focus:border-primary-500
          disabled:opacity-50 disabled:cursor-not-allowed
          transition-colors
        `}
      >
        {supportedLocales.map((loc) => (
          <option key={loc} value={loc}>
            {localeNames[loc].native} ({localeNames[loc].english})
          </option>
        ))}
      </select>
      {isLoading && (
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {t('common.loading')}
        </p>
      )}
    </div>
  );
}

/**
 * Compact language toggle for navbar/header
 */
export function LanguageToggle({ className = '' }: { className?: string }) {
  const { locale, setLocale, supportedLocales, localeNames, isLoading } = useLanguage();

  const toggleLocale = async () => {
    // Cycle through: fr -> en -> es -> fr
    const currentIndex = supportedLocales.indexOf(locale);
    const nextIndex = (currentIndex + 1) % supportedLocales.length;
    const newLocale = supportedLocales[nextIndex];
    await setLocale(newLocale);
  };

  // Get next locale name for tooltip
  const currentIndex = supportedLocales.indexOf(locale);
  const nextIndex = (currentIndex + 1) % supportedLocales.length;
  const nextLocale = supportedLocales[nextIndex];

  return (
    <button
      onClick={toggleLocale}
      disabled={isLoading}
      className={`
        flex items-center gap-1.5 px-2 py-1.5
        text-sm font-medium
        text-gray-600 dark:text-gray-400
        hover:text-gray-900 dark:hover:text-gray-100
        hover:bg-gray-100 dark:hover:bg-gray-800
        rounded-md transition-colors
        disabled:opacity-50 disabled:cursor-not-allowed
        ${className}
      `}
      title={`Switch to ${localeNames[nextLocale].native}`}
    >
      <Globe className="h-4 w-4" />
      <span className="uppercase">{locale}</span>
    </button>
  );
}
