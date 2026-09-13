import React from "react";
import { useTranslation } from "react-i18next";
import { useLanguage } from "./LanguageContext";

type LanguageSelectProps = React.SelectHTMLAttributes<HTMLSelectElement>;

// Native names are shown regardless of the currently active UI language (the standard
// convention for language pickers) rather than run through t() themselves.
const NATIVE_LANGUAGE_NAMES: Record<string, string> = {
  en: "English",
  fr: "Français",
};

export function LanguageSwitcher({ labelStyle, fieldStyle, SelectComponent = "select" }: {
  labelStyle?: React.CSSProperties;
  fieldStyle?: React.CSSProperties;
  SelectComponent?: React.ComponentType<LanguageSelectProps> | "select";
}) {
  const { t } = useTranslation("shared");
  const { language, languages, setLanguage, error } = useLanguage();
  const id = React.useId();

  return (
    <div>
      <label htmlFor={id} style={labelStyle}>{t("languageSwitcher.label")}</label>
      <SelectComponent
        id={id}
        aria-label={t("languageSwitcher.label")}
        style={{ width: "100%", ...fieldStyle }}
        value={language}
        onChange={(e) => setLanguage(e.target.value)}
      >
        {languages.map((lang) => (
          <option key={lang} value={lang}>{NATIVE_LANGUAGE_NAMES[lang] ?? lang}</option>
        ))}
      </SelectComponent>
      {error && <div role="alert">{t("languageSwitcher.loadError")}</div>}
    </div>
  );
}
