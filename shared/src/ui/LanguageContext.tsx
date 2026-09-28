import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import { I18nextProvider } from "react-i18next";
import type { i18n as I18nInstance } from "i18next";
import { LANGUAGE_STORAGE_KEY, applyLanguage, type Language, type LoadLanguage } from "../i18n/config";

interface LanguageContextValue {
  language: Language;
  languages: Language[];
  setLanguage: (language: Language) => void;
  error: boolean;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ i18n, loadLanguage, children }: {
  i18n: I18nInstance;
  loadLanguage: LoadLanguage;
  children: React.ReactNode;
}) {
  const [language, setLanguageState] = useState<Language>(i18n.language);
  const [error, setError] = useState(false);
  const selection = React.useRef(0);

  // Picks up the case where initI18n kicked off an async switch (detected/stored language
  // differs from the default) after this component's first render already read i18n.language.
  useEffect(() => {
    const handleChanged = (lng: string) => {
      setLanguageState(lng);
      document.documentElement.lang = lng;
    };
    handleChanged(i18n.language);
    i18n.on("languageChanged", handleChanged);
    return () => { i18n.off("languageChanged", handleChanged); };
  }, [i18n]);

  const setLanguage = useCallback((next: Language) => {
    const request = ++selection.current;
    setError(false);
    void applyLanguage(i18n, loadLanguage, next).then(() => {
      if (selection.current !== request || i18n.language !== next) return;
      try { localStorage.setItem(LANGUAGE_STORAGE_KEY, next); } catch { /* Language still works without persistence. */ }
    }).catch(() => { if (selection.current === request) setError(true); });
  }, [i18n, loadLanguage]);

  const value = React.useMemo(() => ({
    language,
    languages: Array.isArray(i18n.options.supportedLngs) ? i18n.options.supportedLngs.filter((lng) => lng !== "cimode") : [language],
    setLanguage,
    error,
  }), [language, i18n, setLanguage, error]);

  return (
    <I18nextProvider i18n={i18n}>
      <LanguageContext.Provider value={value}>
        {children}
      </LanguageContext.Provider>
    </I18nextProvider>
  );
}

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used within LanguageProvider");
  return ctx;
}
