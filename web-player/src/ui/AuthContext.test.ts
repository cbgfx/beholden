import { beforeEach, afterEach, expect, it, vi } from "vitest";

const harness = vi.hoisted(() => ({ slots: [] as unknown[], cursor: 0, effects: [] as Array<() => void>, api: vi.fn() }));
vi.mock("@beholden/shared/api/browserClient", () => ({ apiRaw: harness.api }));
vi.mock("react", () => {
  const hooks = {
    createContext: () => ({ Provider: "provider" }),
    useContext: vi.fn(),
    useState(initial: unknown) {
      const index = harness.cursor++;
      if (!(index in harness.slots)) harness.slots[index] = typeof initial === "function" ? initial() : initial;
      return [harness.slots[index], (value: unknown) => { harness.slots[index] = value; }];
    },
    useRef(initial: unknown) {
      const index = harness.cursor++;
      if (!(index in harness.slots)) harness.slots[index] = { current: initial };
      return harness.slots[index];
    },
    useMemo: (fn: () => unknown) => fn(),
    useCallback(fn: unknown) {
      const index = harness.cursor++;
      if (!(index in harness.slots)) harness.slots[index] = fn;
      return harness.slots[index];
    },
    useEffect(fn: () => (() => void) | undefined, deps: unknown[]) {
      const index = harness.cursor++;
      const prev = harness.slots[index] as { deps: unknown[]; cleanup?: () => void } | undefined;
      if (prev && deps.every((dep, i) => Object.is(dep, prev.deps[i]))) return;
      harness.effects.push(() => {
        prev?.cleanup?.();
        harness.slots[index] = { deps, cleanup: fn() };
      });
    },
  };
  return { ...hooks, default: hooks };
});
import { AuthProvider, type AuthUser } from "@beholden/shared/ui/AuthContext";

const user: AuthUser = { id: "1", username: "test", name: "Test", isAdmin: false, hasDmAccess: false, textScale: 1 };
function Render() {
  harness.cursor = 0;
  const element = AuthProvider({ children: null });
  const pending = harness.effects.splice(0);
  pending.forEach((effect) => effect());
  return element.props.value;
}
function deferred() {
  let resolve!: (value: unknown) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
const settle = async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); };
beforeEach(() => {
  harness.slots = []; harness.cursor = 0; harness.effects = []; harness.api.mockReset();
  const values = new Map([["beholden_token", "old"]]);
  vi.stubGlobal("localStorage", { getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value), removeItem: (key: string) => values.delete(key) });
});
afterEach(() => vi.unstubAllGlobals());

it("a late verification cannot restore a logged-out user", async () => {
  const request = deferred(); harness.api.mockReturnValue(request.promise);
  Render().logout();
  request.resolve(user); await settle();
  expect(Render().user).toBeNull();
  expect(localStorage.getItem("beholden_token")).toBeNull();
});

it("a stale authorization error cannot discard a newer profile/token", async () => {
  const request = deferred(); harness.api.mockReturnValue(request.promise);
  Render().updateUser(user, "new");
  request.reject({ status: 401 }); await settle();
  expect(Render().user).toEqual(user);
  expect(localStorage.getItem("beholden_token")).toBe("new");
});

it("keeps the token on network failure but clears it on authorization rejection", async () => {
  harness.api.mockRejectedValueOnce(new Error("offline"));
  Render(); await settle();
  expect(localStorage.getItem("beholden_token")).toBe("old");
  const request = deferred(); harness.api.mockReturnValue(request.promise);
  Render().updateUser(user, "new"); Render();
  request.reject({ status: 403 }); await settle();
  expect(localStorage.getItem("beholden_token")).toBeNull();
  expect(Render().isLoading).toBe(false);
});

it("a pending login cannot undo logout", async () => {
  localStorage.removeItem("beholden_token");
  const request = deferred(); harness.api.mockReturnValue(request.promise);
  const auth = Render();
  const login = auth.login("test", "password"); auth.logout();
  request.resolve({ token: "late", user }); await login;
  expect(Render().user).toBeNull();
  expect(localStorage.getItem("beholden_token")).toBeNull();
});
