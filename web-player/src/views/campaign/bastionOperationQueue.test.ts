/**
 * The operation queue behind the player's bastion edits: changes show at once, go to the server one
 * at a time, and the screen always reflects the server's latest word plus anything still pending.
 */
import { describe, expect, it, vi } from "vitest";
import { createOperationQueue } from "@beholden/shared/ui/operationQueue";

type Row = { notes: string[]; updatedAt: number };

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}

function setup() {
  const shown: Array<Row | null> = [];
  const onError = vi.fn();
  const onBusyChange = vi.fn();
  const queue = createOperationQueue<Row>({
    onChange: (row) => shown.push(row),
    onError,
    onBusyChange,
    version: (row) => row.updatedAt,
  });
  queue.receive({ notes: [], updatedAt: 1 });
  return { queue, shown, onError, onBusyChange, latest: () => shown[shown.length - 1] };
}

const add = (note: string) => (row: Row): Row => ({ ...row, notes: [...row.notes, note] });

describe("createOperationQueue", () => {
  it("shows a change immediately, then the server's saved record", async () => {
    const { queue, latest, onBusyChange } = setup();
    const response = deferred<Row>();
    const done = queue.run(add("local"), () => response.promise);
    expect(latest()?.notes).toEqual(["local"]);
    expect(onBusyChange).toHaveBeenLastCalledWith(true);

    response.resolve({ notes: ["saved"], updatedAt: 2 });
    await expect(done).resolves.toBe(true);
    expect(latest()?.notes).toEqual(["saved"]);
    expect(onBusyChange).toHaveBeenLastCalledWith(false);
  });

  it("keeps a later pending change on screen when an earlier response lands", async () => {
    const { queue, latest } = setup();
    const first = deferred<Row>();
    const second = deferred<Row>();
    const firstDone = queue.run(add("a"), () => first.promise);
    const secondDone = queue.run(add("b"), () => second.promise);

    first.resolve({ notes: ["a"], updatedAt: 2 });
    await firstDone;
    // The server hasn't seen "b" yet, but it mustn't flicker off the screen.
    expect(latest()?.notes).toEqual(["a", "b"]);

    second.resolve({ notes: ["a", "b"], updatedAt: 3 });
    await secondDone;
    expect(latest()?.notes).toEqual(["a", "b"]);
  });

  it("sends operations one at a time, in order", async () => {
    const { queue } = setup();
    const first = deferred<Row>();
    const secondSend = vi.fn(async () => ({ notes: ["a", "b"], updatedAt: 3 }));
    const firstDone = queue.run(add("a"), () => first.promise);
    const secondDone = queue.run(add("b"), secondSend);

    await Promise.resolve();
    expect(secondSend).not.toHaveBeenCalled();
    first.resolve({ notes: ["a"], updatedAt: 2 });
    await Promise.all([firstDone, secondDone]);
    expect(secondSend).toHaveBeenCalledTimes(1);
  });

  it("drops a refused operation, reports it, and still runs the next one", async () => {
    const { queue, latest, onError } = setup();
    const refused = queue.run(add("nope"), async () => { throw new Error("Forbidden"); });
    const accepted = queue.run(add("yes"), async () => ({ notes: ["yes"], updatedAt: 2 }));

    await expect(refused).resolves.toBe(false);
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: "Forbidden" }));
    await expect(accepted).resolves.toBe(true);
    expect(latest()?.notes).toEqual(["yes"]);
  });

  it("applies someone else's change under pending edits, and ignores an out-of-date refresh", async () => {
    const { queue, latest } = setup();
    const response = deferred<Row>();
    const done = queue.run(add("mine"), () => response.promise);

    queue.receive({ notes: ["theirs"], updatedAt: 5 });
    expect(latest()?.notes).toEqual(["theirs", "mine"]);

    response.resolve({ notes: ["theirs", "mine"], updatedAt: 6 });
    await done;
    // A slow refresh started before our save lands afterwards; it's older, so it's ignored.
    queue.receive({ notes: ["theirs"], updatedAt: 5 });
    expect(latest()?.notes).toEqual(["theirs", "mine"]);
  });
});
