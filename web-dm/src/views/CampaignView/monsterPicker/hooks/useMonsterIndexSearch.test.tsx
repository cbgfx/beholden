// @vitest-environment jsdom
/**
 * The monster picker used to fetch the entire index before it would show anything: 200 rows a
 * request, in a loop, until a short page came back - about eleven requests for the current
 * compendium, repeated on every debounced keystroke and filter change. The compendium only grows,
 * so this pins the behaviour that replaced it: one page on open, and further windows only when the
 * list is scrolled over them.
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const harness = vi.hoisted(() => ({ api: vi.fn() }));
vi.mock("@beholden/shared/api/browserClient", () => ({
  api: harness.api,
  apiRaw: harness.api,
  jsonInit: (method: string, body: unknown) => ({ method, body }),
}));

import { useMonsterIndexSearch } from "./useMonsterIndexSearch";

const TOTAL = 2000;

type Search = ReturnType<typeof useMonsterIndexSearch>;
let latest: Search;
let host: HTMLDivElement;
let root: Root;

function Probe(props: { isOpen: boolean; query: string }) {
  latest = useMonsterIndexSearch({ isOpen: props.isOpen, query: props.query });
  return null;
}

const searchCalls = () =>
  harness.api.mock.calls
    .map(([url]) => String(url))
    .filter((url) => url.startsWith("/api/compendium/search"));

const offsetsRequested = () =>
  searchCalls().map((url) => Number(new URLSearchParams(url.split("?")[1]).get("offset") ?? -1));

/** Let the hook's debounce fire and any resolved promises settle. */
async function flush() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 300));
  });
}

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  harness.api.mockReset().mockImplementation(async (url: string) => {
    if (url.startsWith("/api/compendium/search")) {
      const offset = Number(new URLSearchParams(url.split("?")[1]).get("offset") ?? 0);
      return {
        rows: Array.from({ length: 200 }, (_, index) => ({ id: `m${offset + index}`, name: `Monster ${offset + index}` })),
        total: TOTAL,
      };
    }
    if (url.startsWith("/api/compendium/monsters/facets")) return { environments: [], sizes: [], types: [] };
    if (url.startsWith("/api/compendium/monsters/letters")) return { letters: [] };
    if (url.startsWith("/api/compendium/rulesets")) return { rulesets: [] };
    return {};
  });
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});

it("asks for one page when it opens, not the whole compendium", async () => {
  await act(async () => { root.render(<Probe isOpen query="" />); });
  await flush();

  expect(offsetsRequested()).toEqual([0]);
  // The list is sized by what the search matched, even though only 200 rows are in hand.
  expect(latest.totalRows).toBe(TOTAL);
  expect(latest.rows.length).toBe(TOTAL);
  expect(latest.rows[0]?.id).toBe("m0");
  expect(latest.rows[500]).toBeUndefined();
});

it("fetches a window only when the list scrolls over it", async () => {
  await act(async () => { root.render(<Probe isOpen query="" />); });
  await flush();
  expect(offsetsRequested()).toEqual([0]);

  await act(async () => { latest.ensureRange(600, 700); });
  await flush();
  expect(offsetsRequested()).toEqual([0, 600]);
  expect(latest.rows[600]?.id).toBe("m600");

  // Asking for something already in hand costs nothing.
  await act(async () => { latest.ensureRange(0, 100); });
  await flush();
  expect(offsetsRequested()).toEqual([0, 600]);
});

it("stays quiet while the picker is closed", async () => {
  await act(async () => { root.render(<Probe isOpen={false} query="" />); });
  await flush();

  expect(harness.api).not.toHaveBeenCalled();

  // Opening it is what starts the work.
  await act(async () => { root.render(<Probe isOpen query="" />); });
  await flush();
  expect(offsetsRequested()).toEqual([0]);
});

it("starts a fresh search when the query changes, rather than paging the old one", async () => {
  await act(async () => { root.render(<Probe isOpen query="" />); });
  await flush();
  await act(async () => { latest.ensureRange(600, 700); });
  await flush();
  expect(offsetsRequested()).toEqual([0, 600]);

  await act(async () => { root.render(<Probe isOpen query="goblin" />); });
  await flush();

  // One page of the new search - not a re-walk of everything that was loaded before.
  expect(offsetsRequested()).toEqual([0, 600, 0]);
  expect(searchCalls().at(-1)).toContain("q=goblin");
});
