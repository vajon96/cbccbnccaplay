import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import { Language, translations, TranslationKey } from "../i18n/translations";

interface LanguageContextType {
  lang: Language;
  setLang: (lang: Language) => void;
  toggleLang: () => void;
  t: (key: TranslationKey, fallback?: string) => string;
  formatNumber: (value: number) => string;
  formatDate: (date: Date | string | number, options?: Intl.DateTimeFormatOptions) => string;
}

const STORAGE_KEY = "bncc_lang";

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Language>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved === "en" || saved === "bn" ? saved : "bn";
    } catch {
      return "bn";
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      // ignore storage quota errors
    }
    document.documentElement.lang = lang === "bn" ? "bn" : "en";
  }, [lang]);

  const setLang = useCallback((nextLang: Language) => {
    setLangState(nextLang);
  }, []);

  const toggleLang = useCallback(() => {
    setLangState((prev) => (prev === "bn" ? "en" : "bn"));
  }, []);

  const t = useCallback(
    (key: TranslationKey, fallback?: string): string => {
      return translations[lang][key] || fallback || translations.en[key] || String(key);
    },
    [lang]
  );

  const formatNumber = useCallback(
    (value: number): string => {
      try {
        return new Intl.NumberFormat(lang === "bn" ? "bn-BD" : "en-US").format(value);
      } catch {
        return String(value);
      }
    },
    [lang]
  );

  const formatDate = useCallback(
    (date: Date | string | number, options?: Intl.DateTimeFormatOptions): string => {
      const parsed = date instanceof Date ? date : new Date(date);
      if (Number.isNaN(parsed.getTime())) return "";
      try {
        return new Intl.DateTimeFormat(
          lang === "bn" ? "bn-BD" : "en-US",
          options || { year: "numeric", month: "short", day: "numeric" }
        ).format(parsed);
      } catch {
        return parsed.toLocaleDateString();
      }
    },
    [lang]
  );

  return (
    <LanguageContext.Provider value={{ lang, setLang, toggleLang, t, formatNumber, formatDate }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage(): LanguageContextType {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return ctx;
}
