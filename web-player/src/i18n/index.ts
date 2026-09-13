import { initI18n, mapLocaleLoaders, loadNamespaceBundle, sharedDefaultResources, type LoadLanguage } from "@beholden/shared/i18n";
import enPlayer from "./locales/en";

// English ships eagerly (the fixed default). Every other language is discovered here but not
// fetched until requested — adding a language means adding ./locales/<code>/index.ts, nothing
// here needs editing.
const playerModules = import.meta.glob(["./locales/*/index.ts", "!./locales/en/index.ts"]) as Record<string, () => Promise<{ default: Record<string, unknown> }>>;
const playerLoaders = mapLocaleLoaders(playerModules);
delete playerLoaders.en;

// Reaches into @beholden/shared's own locale folder directly — import.meta.glob needs a literal
// relative/absolute path it can statically analyze, so a bundler alias can't be used here. Same
// "adding a language means adding a folder" rule applies on the shared side.
const sharedModules = import.meta.glob(["../../../shared/src/i18n/locales/*/index.ts", "!../../../shared/src/i18n/locales/en/index.ts"]) as Record<string, () => Promise<{ default: Record<string, unknown> }>>;
const sharedLoaders = mapLocaleLoaders(sharedModules);
delete sharedLoaders.en;

const supportedLngs = ["en", ...Object.keys(playerLoaders).filter((lang) => lang in sharedLoaders)];

const loadLanguage: LoadLanguage = async (lang) => {
  const [player, shared] = await Promise.all([
    playerLoaders[lang] ? loadNamespaceBundle(playerLoaders[lang]) : Promise.resolve({}),
    sharedLoaders[lang] ? loadNamespaceBundle(sharedLoaders[lang]) : Promise.resolve({}),
  ]);
  return { player, shared, playerUi: (player as Record<string, object>).ui ?? {}, sharedUi: (shared as Record<string, object>).ui ?? {} };
};

export const i18n = initI18n({
  defaultNS: "player",
  defaultLanguage: "en",
  defaultResources: { player: enPlayer, shared: sharedDefaultResources, playerUi: {}, sharedUi: {} },
  supportedLngs,
  loadLanguage,
});

export { loadLanguage };

/** For pure render helpers; their owning view subscribes to language changes. */
export const translateUi = (source: string, values?: Record<string, unknown>): string => i18n.t(source, { ...values, ns: ["playerUi", "sharedUi"], defaultValue: source, keySeparator: false, nsSeparator: false });
