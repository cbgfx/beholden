import { useCallback, useContext } from "react";
import { getI18n, I18nContext, useTranslation } from "react-i18next";

/** react-i18next's useTranslation result wraps i18n anew on language changes. */
export function useStableI18n() {
  const instance = useContext(I18nContext)?.i18n ?? getI18n();
  if (!instance) throw new Error("Translation callbacks require an I18nextProvider");
  return instance;
}

/** Source-key translations for interface copy. Never pass saved content or rule identifiers. */
export function useUiTranslation(namespace: "sharedUi" | "playerUi" | "dmUi") {
  const { t } = useTranslation(namespace);
  return useCallback((source: string, values?: Record<string, unknown>) => t(source, {
    ...values,
    ns: [namespace, "sharedUi"],
    defaultValue: source,
    keySeparator: false,
    nsSeparator: false,
  }), [t, namespace]);
}

export function UiText({ text, namespace }: { text: string; namespace: "sharedUi" | "playerUi" | "dmUi" }) {
  const ui = useUiTranslation(namespace);
  return ui(text);
}

/** Stable callback for request handlers: changing language must not refetch or autosave data. */
export function useUiMessages(namespace: "sharedUi" | "playerUi" | "dmUi") {
  useTranslation(namespace);
  const i18n = useStableI18n();
  return useCallback((source: string, values?: Record<string, unknown>) => i18n.t(source, {
    ...values, ns: [namespace, "sharedUi"], defaultValue: source, keySeparator: false, nsSeparator: false,
  }), [i18n, namespace]);
}
