import { expect, it } from "vitest";
import { i18n, loadLanguage } from "./index";
import { applyLanguage } from "@beholden/shared/i18n/config";
import fr from "./locales/fr";
import sharedFr from "@beholden/shared/i18n/locales/fr";

it("loads French DM and shared labels together and returns to English without another load", async () => {
  await applyLanguage(i18n, loadLanguage, "fr");
  expect(i18n.t("Home", { ns: "dmUi" })).toBe("Accueil");
  expect(i18n.t("profileSettings.title", { ns: "shared" })).toBe("Paramètres du compte");
  await applyLanguage(i18n, async () => { throw new Error("English must already be bundled"); }, "en");
  expect(i18n.t("Home", { ns: "dmUi", defaultValue: "Home" })).toBe("Home");
});

it("preserves interpolation variables across the DM interface catalog", () => {
  const keys = (text: string) => [...text.matchAll(/{{\s*([^}]+)\s*}}/g)].map((match) => match[1].trim()).sort();
  expect(Object.keys(fr.ui).length).toBeGreaterThan(700);
  for (const [source, translated] of Object.entries(fr.ui)) {
    expect(keys(translated), source).toEqual(keys(source));
  }
});

it("has French copy for every literal passed through the DM source-key translators", () => {
  const used = new Set<string>();
  const sources = import.meta.glob(["../**/*.ts", "../**/*.tsx", "!../**/*.test.ts", "!../**/*.test.tsx", "!./locales/**"], { eager: true, query: "?raw", import: "default" }) as Record<string, string>;
  for (const text of Object.values(sources)) {
      const pattern = /\btranslate(?:Ui|Message)\(\s*(?:"((?:\\.|[^"\\])*)"|'((?:\\.|[^'\\])*)')/g;
      for (const match of text.matchAll(pattern)) {
        const raw = match[1] ?? match[2] ?? "";
        used.add(raw.replace(/\\n/g, "\n").replace(/\\'/g, "'").replace(/\\"/g, '"').replace(/\\\\/g, "\\"));
      }
  }
  const translated = new Set([...Object.keys(fr.ui), ...Object.keys(sharedFr.ui)]);
  expect([...used].filter((key) => !translated.has(key)).sort()).toEqual([]);
});
