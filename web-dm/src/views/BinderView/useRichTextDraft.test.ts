import { beforeEach, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ slots: [] as unknown[], cursor: 0, effects: [] as Array<() => void | (() => void)>, deps: [] as unknown[][] }));
vi.mock("react", () => ({
  useState(initial: unknown) {
    const i = h.cursor++;
    if (!(i in h.slots)) h.slots[i] = initial;
    return [h.slots[i], (value: unknown) => { h.slots[i] = value; }];
  },
  useRef(initial: unknown) {
    const i = h.cursor++;
    if (!(i in h.slots)) h.slots[i] = { current: initial };
    return h.slots[i];
  },
  useEffect(effect: () => void | (() => void), deps: unknown[]) {
    const i = h.cursor++;
    if (!h.deps[i] || deps.some((v, j) => !Object.is(v, h.deps[i][j]))) h.effects.push(effect);
    h.deps[i] = deps;
  },
}));
import { useRichTextDraft } from "./useRichTextDraft";

beforeEach(() => { h.slots = []; h.cursor = 0; h.effects = []; h.deps = []; });
function Render(value: string | null, save: (value: string | null) => Promise<void>) {
  h.cursor = 0;
  return useRichTextDraft(value, save);
}
function flush() { return h.effects.splice(0).map((effect) => effect()); }

it("preserves a draft across background refreshes and cancels to the latest saved value", () => {
  const save = vi.fn();
  let field = Render("original", save); flush();
  field.startEditing();
  field = Render("original", save); flush();
  field.setDraft("unsaved");
  field = Render("remote update", save); flush();
  expect(Render("remote update", save).draft).toBe("unsaved");
  field.cancel();
  expect(Render("remote update", save).draft).toBe("remote update");
});

it("keeps edits made during a save and prevents duplicate submissions", async () => {
  let resolve!: () => void;
  const save = vi.fn(() => new Promise<void>((yes) => { resolve = yes; }));
  let field = Render("original", save); flush();
  field.startEditing();
  field = Render("original", save); flush();
  field.setDraft("submitted");
  const pending = field.save();
  await field.save();
  field.setDraft("newer typing");
  resolve(); await pending;
  field = Render("submitted", save); flush();
  expect(field.editing).toBe(true);
  expect(field.draft).toBe("newer typing");
  expect(save).toHaveBeenCalledExactlyOnceWith("submitted");
});

it("shows failures without discarding the draft and allows retry", async () => {
  const save = vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce(undefined);
  let field = Render(null, save); flush();
  field.startEditing(); field.setDraft("text");
  await field.save();
  field = Render(null, save);
  expect(field.error).toBe("offline");
  expect(field.draft).toBe("text");
  expect(field.editing).toBe(true);
  await field.save();
  field = Render("text", save);
  expect(field.error).toBeNull();
  expect(field.editing).toBe(false);
});

it("ignores a save completion after unmount", async () => {
  let resolve!: () => void;
  const save = () => new Promise<void>((yes) => { resolve = yes; });
  const field = Render("original", save);
  const cleanups = flush();
  field.startEditing();
  const pending = field.save();
  cleanups.forEach((cleanup) => cleanup?.());
  const before = h.slots.slice(0, 4);
  resolve(); await pending;
  expect(h.slots.slice(0, 4)).toEqual(before);
});
