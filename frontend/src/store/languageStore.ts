import { create } from 'zustand';
import { useCallback } from 'react';
import { format, parseISO } from 'date-fns';
import { de, enUS } from 'date-fns/locale';
import { Language, TranslationKey, translations } from '../lib/i18n/translations';

interface LanguageState {
  language: Language;
  setLanguage: (lang: Language) => void;
  toggleLanguage: () => void;
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;
  getMonthName: (monthNumber: number) => string;
  getMonthShort: (monthNumber: number) => string;
}

const savedLang = (localStorage.getItem('app_lang') as Language) || 'de';

export const useLanguageStore = create<LanguageState>((set, get) => ({
  language: savedLang === 'en' ? 'en' : 'de',

  setLanguage: (lang: Language) => {
    localStorage.setItem('app_lang', lang);
    set({ language: lang });
  },

  toggleLanguage: () => {
    const current = get().language;
    const next: Language = current === 'de' ? 'en' : 'de';
    localStorage.setItem('app_lang', next);
    set({ language: next });
  },

  t: (key: TranslationKey, params?: Record<string, string | number>) => {
    const lang = get().language;
    let text = (translations[lang] as any)?.[key] || (translations['de'] as any)?.[key] || key;
    if (typeof text !== 'string') return String(text);
    if (params) {
      Object.entries(params).forEach(([paramKey, paramVal]) => {
        text = text.replace(new RegExp(`\\{${paramKey}\\}`, 'g'), String(paramVal));
      });
    }
    return text;
  },

  getMonthName: (monthNumber: number) => {
    const lang = get().language;
    const idx = Math.max(0, Math.min(11, monthNumber - 1));
    return translations[lang].months[idx];
  },

  getMonthShort: (monthNumber: number) => {
    const lang = get().language;
    const idx = Math.max(0, Math.min(11, monthNumber - 1));
    return translations[lang].monthsShort[idx];
  },
}));

/**
 * Reactive React hook that guarantees immediate component re-render when language changes
 */
export function useTranslation() {
  const language = useLanguageStore((state) => state.language);
  const setLanguage = useLanguageStore((state) => state.setLanguage);
  const toggleLanguage = useLanguageStore((state) => state.toggleLanguage);

  const t = useCallback(
    (key: TranslationKey, params?: Record<string, string | number>) => {
      let text = (translations[language] as any)?.[key] || (translations['de'] as any)?.[key] || key;
      if (typeof text !== 'string') return String(text);
      if (params) {
        Object.entries(params).forEach(([paramKey, paramVal]) => {
          text = text.replace(new RegExp(`\\{${paramKey}\\}`, 'g'), String(paramVal));
        });
      }
      return text;
    },
    [language]
  );

  const getMonthName = useCallback(
    (monthNumber: number) => {
      const idx = Math.max(0, Math.min(11, monthNumber - 1));
      return translations[language].months[idx];
    },
    [language]
  );

  const getMonthShort = useCallback(
    (monthNumber: number) => {
      const idx = Math.max(0, Math.min(11, monthNumber - 1));
      return translations[language].monthsShort[idx];
    },
    [language]
  );

  const formatCurrency = useCallback(
    (amount: number) => {
      const locale = language === 'en' ? 'en-US' : 'de-DE';
      return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: 'EUR',
      }).format(amount);
    },
    [language]
  );

  const formatDate = useCallback(
    (dateStr: string) => {
      if (!dateStr) return '';
      const dateObj = typeof dateStr === 'string' ? parseISO(dateStr) : dateStr;
      const formatStr = language === 'en' ? 'MM/dd/yyyy' : 'dd.MM.yyyy';
      const locale = language === 'en' ? enUS : de;
      return format(dateObj, formatStr, { locale });
    },
    [language]
  );

  return {
    language,
    setLanguage,
    toggleLanguage,
    t,
    getMonthName,
    getMonthShort,
    formatCurrency,
    formatDate,
  };
}
