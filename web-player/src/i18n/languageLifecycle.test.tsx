// @vitest-environment jsdom
import { act, useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import { applyLanguage, initI18n, LANGUAGE_STORAGE_KEY } from "@beholden/shared/i18n/config";
import { LanguageProvider } from "@beholden/shared/ui/LanguageContext";
import { LanguageSwitcher } from "@beholden/shared/ui/LanguageSwitcher";
import { useUiMessages, useUiTranslation } from "@beholden/shared/i18n/useUiTranslation";
import { Select } from "@/ui/Select";

function instance() {
  return initI18n({ defaultNS: "player", defaultLanguage: "en", supportedLngs: ["en", "fr"],
    defaultResources: { player: { ready: "Ready" }, playerUi: {}, shared: { languageSwitcher: { label: "Language", loadError: "Try again" } } },
    loadLanguage: async () => ({ player: { ready: "Prêt" } }),
  });
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}
let root: Root | undefined;
afterEach(async () => {
  if (root) await act(() => root!.unmount());
  root = undefined;
  document.body.replaceChildren();
  localStorage.clear();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it("deduplicates concurrent loads and keeps the most recent language selection", async () => {
  const app = instance();
  const pending = deferred<Record<string, object>>();
  const load = vi.fn(() => pending.promise);
  const first = applyLanguage(app, load, "fr");
  const second = applyLanguage(app, load, "fr");
  await applyLanguage(app, load, "en");
  pending.resolve({ player: { ready: "Prêt" } });
  await Promise.all([first, second]);
  expect(load).toHaveBeenCalledOnce();
  expect(app.language).toBe("en");
  await applyLanguage(app, load, "fr");
  expect(app.t("ready")).toBe("Prêt");
  expect(load).toHaveBeenCalledOnce();
});

it("isolates resource caches between application instances", async () => {
  const player = instance();
  const dm = instance();
  await applyLanguage(player, async () => ({ player: { ready: "Joueur" } }), "fr");
  const loadDm = vi.fn(async () => ({ player: { ready: "MJ" } }));
  await applyLanguage(dm, loadDm, "fr");
  expect(player.t("ready")).toBe("Joueur");
  expect(dm.t("ready")).toBe("MJ");
  expect(loadDm).toHaveBeenCalledOnce();
});

it("allows retry after a failed load and ignores unsupported languages", async () => {
  const app = instance();
  const load = vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValue({ player: { ready: "Prêt" } });
  await expect(applyLanguage(app, load, "fr")).rejects.toThrow("offline");
  expect(app.language).toBe("en");
  await applyLanguage(app, load, "unknown");
  expect(load).toHaveBeenCalledTimes(1);
  await applyLanguage(app, load, "fr");
  expect(app.language).toBe("fr");
});

it("switches rendered copy without remounting inputs, fetching application data, or requiring storage", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const fetch = vi.fn();
  vi.stubGlobal("fetch", fetch);
  const app = instance();
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("blocked"); });
  function Form() {
    const ui = useUiTranslation("playerUi");
    return <><input aria-label="draft" defaultValue="unsaved" /><span>{ui("Save")}</span></>;
  }
  const host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  await act(() => root!.render(<LanguageProvider i18n={app} loadLanguage={async () => ({ player: {}, playerUi: { Save: "Enregistrer" } })}>
    <LanguageSwitcher SelectComponent={Select} /><Form />
  </LanguageProvider>));
  const input = host.querySelector("input")!;
  input.value = "unfinished edit";
  const select = host.querySelector("select")!;
  expect(Array.from(select.options, (option) => option.value)).toEqual(["en", "fr"]);
  expect(host.querySelector("label")!.htmlFor).toBe(select.id);
  expect(host.querySelector("button")!.textContent).toContain("English");
  expect(host.querySelector("button")!.getAttribute("aria-label")).toBe("Language");
  await act(async () => { select.value = "fr"; select.dispatchEvent(new Event("change", { bubbles: true })); });
  expect(host.textContent).toContain("Enregistrer");
  expect(document.documentElement.lang).toBe("fr");
  expect(host.querySelector("input")).toBe(input);
  expect(input.value).toBe("unfinished edit");
  expect(fetch).not.toHaveBeenCalled();
  expect(localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBeNull();
});

it("falls back safely when browser storage cannot be read", () => {
  vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("blocked"); });
  expect(() => instance()).not.toThrow();
});

it("keeps request callbacks stable while their messages use the newly selected language", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const app = instance();
  const request = vi.fn();
  let message!: ReturnType<typeof useUiMessages>;
  function Loader() {
    const requestMessage = useUiMessages("playerUi");
    message = requestMessage;
    useEffect(() => { request(); }, [requestMessage]);
    return null;
  }
  const host = document.createElement("div"); document.body.appendChild(host); root = createRoot(host);
  const load = async () => ({ player: {}, playerUi: { "Save failed": "Échec de l’enregistrement" } });
  await act(() => root!.render(<LanguageProvider i18n={app} loadLanguage={load}><Loader /></LanguageProvider>));
  const originalMessage = message;
  await act(() => applyLanguage(app, load, "fr"));
  expect(message).toBe(originalMessage);
  expect(message("Save failed")).toBe("Échec de l’enregistrement");
  expect(request).toHaveBeenCalledOnce();
});
