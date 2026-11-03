// @vitest-environment jsdom
import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  collectBinderBacklinks,
  backlinkDestination,
} from "@beholden/shared/domain/binderBacklinks";
import { BacklinkList } from "@beholden/shared/ui/BacklinkList";
import { ReferencedMarkdown } from "@beholden/shared/ui/ReferencedMarkdown";
import { PlayerBinderBacklinks } from "./PlayerBinderBacklinks";
vi.mock("@beholden/shared/i18n/useUiTranslation", () => ({
  useUiTranslation: () => (source: string) => source,
}));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (source: string) => source }),
}));
let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});
const link = "[Brother Diego](/binder/b/mortals/target)";
const source = {
  id: "source",
  name: "Chapel",
  type: "location",
  route: "/source?existing=yes",
  field: "description",
  text: `The party met ${link} at the chapel. Later ${link} left.`,
};
it("groups contextual occurrences and ignores malformed and cross-Binder links", () => {
  const rows = collectBinderBacklinks(
    [
      source,
      { ...source, field: "dm_notes", text: `Secret: ${link}.` },
      {
        ...source,
        id: "wrong",
        text: "[Diego](/binder/other/mortals/target) [Bad](/binder/b/mortals/%bad)",
      },
    ],
    "b",
    "target",
  );
  expect(rows).toHaveLength(1);
  expect(rows[0].fields).toEqual(["description", "dm_notes"]);
  expect(rows[0].contexts.map((context) => context.occurrence)).toEqual([
    0, 1, 0,
  ]);
  expect(rows[0].contexts[0]).toMatchObject({
    before: "The party met ",
    mention: "Brother Diego",
    after: " at the chapel.",
  });
  const destination = backlinkDestination(
    source.route,
    "target",
    rows[0].contexts[1],
  );
  expect(destination).toContain("existing=yes");
  expect(destination).toContain("mentionOccurrence=1");
});
it("bounds excerpts without rendering Markdown URLs", () => {
  const rows = collectBinderBacklinks(
    [{ ...source, text: `${"x".repeat(500)} ${link} ${"y".repeat(500)}` }],
    "b",
    "target",
  );
  const context = rows[0].contexts[0];
  expect(context.before.length).toBeLessThanOrEqual(111);
  expect(context.after.length).toBeLessThanOrEqual(151);
  expect(`${context.before}${context.mention}${context.after}`).not.toContain(
    "/binder/",
  );
});
it("opens the source at the requested occurrence in the correct field", async () => {
  function Source() {
    const [valid, setValid] = useState(new Set<string>());
    return (
      <>
        <button onClick={() => setValid(new Set(["target"]))}>
          Resolve records
        </button>
        <section data-field="description">
          <ReferencedMarkdown
            sourceField="description"
            text={link}
            binderId="b"
            validMentionIds={valid}
          />
        </section>
        <section data-field="dm_notes">
          <ReferencedMarkdown
            sourceField="dm_notes"
            text={`${link} then ${link}`}
            binderId="b"
            validMentionIds={valid}
          />
        </section>
      </>
    );
  }
  const rows = collectBinderBacklinks(
    [{ ...source, field: "dm_notes", text: `${link} then ${link}` }],
    "b",
    "target",
  );
  const router = createMemoryRouter([
    { path: "/", element: <BacklinkList rows={rows} targetId="target" /> },
    { path: "/source", element: <Source /> },
  ]);
  await act(async () => root.render(<RouterProvider router={router} />));
  await act(async () =>
    host.querySelectorAll<HTMLAnchorElement>("a")[1].click(),
  );
  expect(router.state.location.pathname).toBe("/source");
  await act(async () =>
    host.querySelector<HTMLButtonElement>("button")!.click(),
  );
  const descriptions = host.querySelectorAll<HTMLAnchorElement>(
    '[data-field="description"] a',
  );
  const notes = host.querySelectorAll<HTMLAnchorElement>(
    '[data-field="dm_notes"] a',
  );
  expect(descriptions[0].style.outline).toBe("");
  expect(notes[0].style.outline).toBe("");
  expect(notes[1].style.outline).toContain("2px");
  expect(document.activeElement).toBe(notes[1]);
});
it("builds Player backlinks only from visible descriptions/story and keeps navigation in Player", async () => {
  const publicSource = {
    id: "public",
    name: "Public NPC",
    description: `Met ${link}.`,
    backstory: null,
    dm_notes: `SECRET ${link}`,
  };
  const router = createMemoryRouter([
    {
      path: "/",
      element: (
        <PlayerBinderBacklinks
          characterId="hero"
          binderId="b"
          targetId="target"
          mortals={[publicSource]}
          campaigns={[]}
          records={[]}
        />
      ),
    },
  ]);
  await act(async () => root.render(<RouterProvider router={router} />));
  expect(host.textContent).toContain("Public NPC");
  expect(host.textContent).not.toContain("SECRET");
  expect(host.querySelector("a")!.getAttribute("href")).toContain(
    "/characters/hero/binder?section=mortals",
  );
});
