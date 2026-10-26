// @vitest-environment jsdom
import { beforeEach, afterEach, expect, it, vi } from "vitest";

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { deferred } from "@beholden/shared/tests/renderHook";
const harness = vi.hoisted(() => ({ raw: vi.fn(), api: vi.fn() }));
vi.mock("@beholden/shared/api/browserClient", () => ({
  apiRaw: harness.raw, api: harness.api, AUTH_INVALID_EVENT: "beholden:auth-invalid", CSRF_STORAGE_KEY: "beholden_csrf",
}));
import { AuthProvider, useAuth, type AuthUser } from "@beholden/shared/ui/AuthContext";

const user: AuthUser = { id: "1", username: "test", name: "Test", isAdmin: false, hasDmAccess: false, textScale: 1 };
async function renderAuth() {
  const host = document.createElement("div"); document.body.appendChild(host);
  const root = createRoot(host); roots.push({ root, host });
  function Consumer() { current = useAuth(); return null; }
  let current!: ReturnType<typeof useAuth>;
  await act(async () => { root.render(createElement(AuthProvider, null, createElement(Consumer))); });
  return { get result() { return current; } };
}
const roots: Array<{ root: Root; host: HTMLDivElement }> = [];
beforeEach(() => {
  harness.raw.mockReset(); harness.api.mockReset().mockResolvedValue({});
  localStorage.clear(); localStorage.setItem("beholden_token", "old");
});
afterEach(async () => {
  for (const { root, host } of roots.splice(0)) { await act(async () => root.unmount()); host.remove(); }
  localStorage.clear();
});

it("a late verification cannot restore a logged-out user", async () => {
  const request = deferred<unknown>(); harness.raw.mockReturnValue(request.promise);
  const auth = await renderAuth();
  act(() => auth.result.logout());
  await act(async () => { request.resolve(user); });
  expect(auth.result.user).toBeNull(); expect(localStorage.getItem("beholden_token")).toBeNull();
});
it("a stale authorization error cannot discard a newer profile/token", async () => {
  const request = deferred<unknown>(); harness.raw.mockReturnValue(request.promise);
  const auth = await renderAuth();
  act(() => auth.result.updateUser(user, "new"));
  await act(async () => { request.reject({ status: 401 }); });
  expect(auth.result.user).toEqual(user); expect(localStorage.getItem("beholden_csrf")).toBe("new");
});
it("keeps a migration token on network failure and clears credentials on authorization rejection", async () => {
  harness.raw.mockRejectedValueOnce(new Error("offline"));
  const auth = await renderAuth();
  expect(localStorage.getItem("beholden_token")).toBe("old");
  act(() => window.dispatchEvent(new Event("beholden:auth-invalid")));
  expect(localStorage.getItem("beholden_token")).toBeNull(); expect(localStorage.getItem("beholden_csrf")).toBeNull();
  expect(auth.result.isLoading).toBe(false);
});
it("a pending login cannot undo logout", async () => {
  localStorage.removeItem("beholden_token");
  harness.raw.mockRejectedValueOnce({ status: 401 });
  const auth = await renderAuth();
  const request = deferred<unknown>(); harness.raw.mockReturnValueOnce(request.promise);
  let login!: Promise<void>;
  act(() => { login = auth.result.login("test", "password"); auth.result.logout(); });
  await act(async () => { request.resolve({ csrfToken: "late", user }); await login; });
  expect(auth.result.user).toBeNull(); expect(localStorage.getItem("beholden_csrf")).toBeNull();
});
it("an authenticated API rejection signs the current tab out", async () => {
  localStorage.removeItem("beholden_token"); harness.raw.mockResolvedValue(user);
  const auth = await renderAuth(); expect(auth.result.user).toEqual(user);
  act(() => window.dispatchEvent(new Event("beholden:auth-invalid")));
  expect(auth.result.user).toBeNull(); expect(localStorage.getItem("beholden_token")).toBeNull();
});
