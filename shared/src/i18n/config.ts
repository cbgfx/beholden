import { createInstance, type i18n as I18nInstance } from "i18next";
import { initReactI18next } from "react-i18next";

export const LANGUAGE_STORAGE_KEY = "beholden_language";

// Kept as `string` rather than a union so adding a language never requires a type change here —
// the real source of truth for "what languages exist" is the set of locale folders on disk.
export type Language = string;

export type LoadLanguage = (lang: string) => Promise<Record<string, object>>;

// Coalesce concurrent loads per instance. Successful bundles stay in its resource store.
const pendingLoads = new WeakMap<I18nInstance, Map<string, Promise<void>>>();
const requests = new WeakMap<I18nInstance, number>();

export async function applyLanguage(instance: I18nInstance, loadLanguage: LoadLanguage, lang: string): Promise<void> {
  const supported = instance.options.supportedLngs;
  if (Array.isArray(supported) && !supported.includes(lang)) return;
  const request = (requests.get(instance) ?? 0) + 1;
  requests.set(instance, request);
  let loads = pendingLoads.get(instance);
  if (!loads) { loads = new Map(); pendingLoads.set(instance, loads); }
  if (!instance.hasResourceBundle(lang, instance.options.defaultNS as string)) {
    let pending = loads.get(lang);
    if (!pending) {
      pending = loadLanguage(lang).then((bundles) => {
        for (const [ns, bundle] of Object.entries(bundles)) {
          instance.addResourceBundle(lang, ns, bundle, true, true);
        }
      }).finally(() => loads.delete(lang));
      loads.set(lang, pending);
    }
    await pending;
  }
  if (requests.get(instance) === request) await instance.changeLanguage(lang);
}

function detectInitialLanguage(storageKey: string, supportedLngs: string[], defaultLanguage: string): string {
  let stored: string | null = null;
  try { stored = typeof localStorage !== "undefined" ? localStorage.getItem(storageKey) : null; } catch { /* Storage may be disabled. */ }
  if (stored && supportedLngs.includes(stored)) return stored;

  const browserLang = typeof navigator !== "undefined" ? navigator.language.slice(0, 2) : defaultLanguage;
  if (supportedLngs.includes(browserLang)) return browserLang;

  return defaultLanguage;
}

export function initI18n({ defaultNS, defaultLanguage, defaultResources, supportedLngs, loadLanguage, storageKey = LANGUAGE_STORAGE_KEY }: {
  defaultNS: string;
  defaultLanguage: string;
  defaultResources: Record<string, object>;
  supportedLngs: string[];
  loadLanguage: LoadLanguage;
  storageKey?: string;
}): I18nInstance {
  // Each application owns its resources, including when both are mounted in one test process.
  const i18n = createInstance();

  // Only the default language's resources are bundled eagerly, so first render never waits on
  // a network/chunk fetch. Every other language is fetched on demand, below.
  void i18n.use(initReactI18next).init({
    resources: { [defaultLanguage]: defaultResources },
    lng: defaultLanguage,
    fallbackLng: defaultLanguage,
    defaultNS,
    supportedLngs,
    interpolation: { escapeValue: false }, // React already escapes interpolated values
  });

  const initialLang = detectInitialLanguage(storageKey, supportedLngs, defaultLanguage);
  if (initialLang !== defaultLanguage) {
    // Renders in the default language first, then swaps in the detected/stored language once
    // its bundle downloads — a brief flash for non-default-language users, never a blank/loading
    // screen, and instant for everyone once a language has been loaded once this session.
    void applyLanguage(i18n, loadLanguage, initialLang).catch(() => { /* Keep the bundled English UI available offline. */ });
  }

  return i18n;
}
