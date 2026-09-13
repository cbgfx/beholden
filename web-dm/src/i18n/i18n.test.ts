import { expect, it } from "vitest";
import { i18n, loadLanguage } from "./index";
import { applyLanguage } from "@beholden/shared/i18n/config";
import fr from "./locales/fr";

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
