// @vitest-environment jsdom
/**
 * Behaviour tests for the shared paged compendium search.
 *
 * The hook used to walk every page before the caller could do anything with the results. Now it
 * fetches one page and waits to be asked for more, which puts three things at risk: that it really
 * does stop after the first page, that a superseded search can't append its late-arriving rows, and
 * that a failed page stops paging instead of retrying the same offset forever.
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { usePaginatedCompendiumSearch } from "@beholden/shared/domain/compendium/usePaginatedCompendiumSearch";

type Row = { id: number };
type RequestPage = (offset: number, signal: AbortSignal) => Promise<{ rows: Row[]; total: number }>;
type HookResult = {
  rows: Row[];
  totalCount: number;
  busy: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  loadMore: () => void;
  error: string | null;
};

const PAGE_SIZE = 3;

let root: Root;
let host: HTMLDivElement;
let latest: HookResult;

function Probe(props: { requestPage: RequestPage; refreshKey: number }) {
  latest = usePaginatedCompendiumSearch<Row>({
    debounceMs: 0,
    refreshKey: props.refreshKey,
    requestPage: props.requestPage,
  });
  return null;
}

/** Let the debounce timer fire and any resolved promises settle. */
async function flush() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 5));
  });
}

async function render(requestPage: RequestPage, refreshKey = 0) {
  await act(async () => {
    root.render(<Probe requestPage={requestPage} refreshKey={refreshKey} />);
  });
  await flush();
}

/** A page source that serves `total` rows, PAGE_SIZE at a time, recording every offset asked for. */
function makeSource(total: number) {
  const offsets: number[] = [];
  const requestPage: RequestPage = async (offset) => {
    offsets.push(offset);
    const count = Math.max(0, Math.min(PAGE_SIZE, total - offset));
    return { rows: Array.from({ length: count }, (_, i) => ({ id: offset + i })), total };
  };
  return { offsets, requestPage };
}

beforeEach(() => {
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});

describe("usePaginatedCompendiumSearch", () => {
  it("fetches only the first page and reports the server's total", async () => {
    const source = makeSource(10);
    await render(source.requestPage);

    expect(source.offsets).toEqual([0]);
    expect(latest.rows).toHaveLength(PAGE_SIZE);
    expect(latest.totalCount).toBe(10);
    expect(latest.hasMore).toBe(true);
    expect(latest.busy).toBe(false);
  });

  it("appends the next page on loadMore", async () => {
    const source = makeSource(10);
    await render(source.requestPage);

    await act(async () => latest.loadMore());
    await flush();

    expect(source.offsets).toEqual([0, 3]);
    expect(latest.rows.map((row) => row.id)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(latest.hasMore).toBe(true);
  });

  it("stops once the last page has arrived and ignores further requests", async () => {
    const source = makeSource(7);
    await render(source.requestPage);

    for (let i = 0; i < 5; i += 1) {
      await act(async () => latest.loadMore());
      await flush();
    }

    expect(latest.rows).toHaveLength(7);
    expect(latest.hasMore).toBe(false);
    // 0, 3, 6 -- and nothing after the short final page.
    expect(source.offsets).toEqual([0, 3, 6]);
  });

  it("treats an empty page as the end even when the total overshoots", async () => {
    // A total that claims more rows than exist would otherwise leave the caller asking forever.
    const requestPage: RequestPage = async (offset) => ({
      rows: offset === 0 ? [{ id: 0 }, { id: 1 }] : [],
      total: 99,
    });
    await render(requestPage);

    await act(async () => latest.loadMore());
    await flush();

    expect(latest.rows).toHaveLength(2);
    expect(latest.hasMore).toBe(false);
  });

  it("discards a page that arrives after the search has been superseded", async () => {
    let releaseFirst: (() => void) | null = null;
    const slowRequest: RequestPage = async () => {
      await new Promise<void>((resolve) => { releaseFirst = resolve; });
      return { rows: [{ id: 111 }], total: 1 };
    };
    const fresh = makeSource(6);

    await act(async () => {
      root.render(<Probe requestPage={slowRequest} refreshKey={0} />);
    });
    await flush();
    expect(releaseFirst).not.toBeNull();

    // A filter change swaps in a new requestPage while the first one is still in flight.
    await render(fresh.requestPage, 1);

    await act(async () => {
      releaseFirst?.();
      await new Promise((resolve) => setTimeout(resolve, 5));
    });

    expect(latest.rows.map((row) => row.id)).toEqual([0, 1, 2]);
    expect(latest.totalCount).toBe(6);
  });

  it("stops paging and reports the failure when a page request rejects", async () => {
    const attempted: number[] = [];
    const requestPage: RequestPage = async (offset) => {
      attempted.push(offset);
      if (offset > 0) throw new Error("network went away");
      return { rows: [{ id: 0 }, { id: 1 }, { id: 2 }], total: 10 };
    };
    await render(requestPage);

    await act(async () => latest.loadMore());
    await flush();

    expect(latest.error).toBe("network went away");
    expect(latest.hasMore).toBe(false);
    expect(latest.rows).toHaveLength(3);

    // A later scroll must not retry the offset that just failed.
    await act(async () => latest.loadMore());
    await flush();
    expect(attempted).toEqual([0, 3]);
  });
});
