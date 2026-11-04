import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Language, translations } from '../utils/translations';

const LANGUAGE_STORAGE_KEY = 'pharmacare_language';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  toggleLanguage: () => void;
  t: (key: string, fallback?: string) => string;
  getTabInfo: (activeTab: string) => { title: string; subtitle: string };
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(() => {
    try {
      const saved = localStorage.getItem(LANGUAGE_STORAGE_KEY);
      if (saved === 'en' || saved === 'mr') {
        return saved;
      }
    } catch {
      // Ignore localStorage failure
    }
    return 'en';
  });

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
    try {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
    } catch (e) {
      console.warn('Failed to save language preference:', e);
    }
  }, []);

  const toggleLanguage = useCallback(() => {
    setLanguageState((prev) => {
      const next: Language = prev === 'en' ? 'mr' : 'en';
      try {
        localStorage.setItem(LANGUAGE_STORAGE_KEY, next);
      } catch (e) {
        console.warn('Failed to save language preference:', e);
      }
      return next;
    });
  }, []);

  const t = useCallback(
    (key: string, fallback?: string): string => {
      const currentDict = translations[language];
      if (currentDict && currentDict[key]) {
        return currentDict[key];
      }
      const enDict = translations.en;
      if (enDict && enDict[key]) {
        return enDict[key];
      }
      return fallback !== undefined ? fallback : key;
    },
    [language]
  );

  const getTabInfo = useCallback(
    (activeTab: string): { title: string; subtitle: string } => {
      const titleKey = `tab.${activeTab}.title`;
      const subtitleKey = `tab.${activeTab}.subtitle`;
      return {
        title: t(titleKey, 'PharmaCare Pro'),
        subtitle: t(subtitleKey, 'Pharmacy Management & Billing System'),
      };
    },
    [t]
  );

  return (
    <LanguageContext.Provider
      value={{
        language,
        setLanguage,
        toggleLanguage,
        t,
        getTabInfo,
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = (): LanguageContextType => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};

