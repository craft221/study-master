'use client';

/**
 * HtmlLangSync
 * ============
 * Client component qui synchronise les attributs `lang` et `dir` de
 * `<html>` avec la locale active. Nécessaire pour le support RTL (arabe)
 * et l'accessibilité multilingue.
 */

import { useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';

export function HtmlLangSync() {
  const { locale, isRTL } = useLanguage();

  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.documentElement.lang = locale;
    document.documentElement.dir = isRTL ? 'rtl' : 'ltr';
  }, [locale, isRTL]);

  return null;
}
