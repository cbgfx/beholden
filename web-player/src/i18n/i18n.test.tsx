// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useTranslation } from "react-i18next";
import { i18n, loadLanguage } from "./index";
import { LanguageProvider, useLanguage } from "@beholden/shared/ui/LanguageContext";

let root: Root;
let host: HTMLDivElement;
let switchTo: (lang: string) => void;

function Probe() {
  const { t } = useTranslation("shared");
  const { setLanguage } = useLanguage();
  switchTo = setLanguage;
  return <div>{t("profileSettings.title")}</div>;
}

function waitForLanguage(lang: string): Promise<void> {
  return new Promise((resolve) => {
    if (i18n.language === lang) { resolve(); return; }
    const handler = (lng: string) => {
      if (lng === lang) { i18n.off("languageChanged", handler); resolve(); }
    };
    i18n.on("languageChanged", handler);
  });
}

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});

it("renders English by default and lazily switches to French on demand", async () => {
  await act(async () => {
    root.render(
      <LanguageProvider i18n={i18n} loadLanguage={loadLanguage}>
        <Probe />
      </LanguageProvider>,
    );
  });
  expect(host.textContent).toBe("Account Settings");

  await act(async () => {
    switchTo("fr");
    await waitForLanguage("fr");
  });
  expect(host.textContent).toBe("Paramètres du compte");
});
