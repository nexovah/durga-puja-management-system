import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Language, translations, TranslationKey, LOCALE_MAP } from './translations';

const STORAGE_KEY = 'puja-language';
const DEFAULT_LANGUAGE: Language = 'en';

interface LanguageContextValue {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: TranslationKey) => string;
  locale: string;
}

const LanguageContext = createContext<LanguageContextValue | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => {
    const saved = localStorage.getItem(STORAGE_KEY) as Language | null;
    return saved && saved in translations ? saved : DEFAULT_LANGUAGE;
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, language);
    document.documentElement.lang = language;
  }, [language]);

  const setLanguage = (lang: Language) => setLanguageState(lang);

  const t = (key: TranslationKey): string => {
    return translations[language][key] ?? translations[DEFAULT_LANGUAGE][key] ?? key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, locale: LOCALE_MAP[language] }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be used within a LanguageProvider');
  return ctx;
}
