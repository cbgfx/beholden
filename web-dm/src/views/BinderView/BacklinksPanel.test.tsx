// @vitest-environment jsdom
import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { BacklinksPanel } from "./BacklinksPanel";
const mocks = vi.hoisted(() => ({ fetch: vi.fn() }));
vi.mock("@/services/binderLoreApi", () => ({
  fetchBinderBacklinks: mocks.fetch,
}));
vi.mock("@beholden/shared/i18n/useUiTranslation", () => ({
  useUiTranslation: () => (source: string) => source,
}));
const rows = [
  {
    id: "source",
    name: "Chapel",
    type: "location",
    route: "/source",
    fields: ["description"],
    contexts: [
      {
        field: "description",
        occurrence: 0,
        before: "Met ",
        mention: "Diego",
        after: " at the chapel.",
      },
    ],
  },
];
let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  mocks.fetch.mockReset();
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});
it("shows an actionable failure and loads contextual results on retry", async () => {
  mocks.fetch
    .mockRejectedValueOnce(new Error("offline"))
    .mockResolvedValueOnce(rows);
  const router = createMemoryRouter([
    { path: "/", element: <BacklinksPanel binderId="b" recordId="target" /> },
  ]);
  await act(async () => root.render(<RouterProvider router={router} />));
  expect(host.querySelector('[role="alert"]')!.textContent).toContain(
    "Could not load backlinks.",
  );
  await act(async () =>
    host.querySelector<HTMLButtonElement>("button")!.click(),
  );
  expect(host.querySelector('[role="alert"]')).toBeNull();
  expect(host.textContent).toContain("Met Diego at the chapel.");
  expect(host.querySelector("a")!.getAttribute("href")).toContain(
    "mentionTarget=target",
  );
});
it("ignores a late response after selecting another record", async () => {
  let resolve!: (value: typeof rows) => void;
  mocks.fetch
    .mockReturnValueOnce(
      new Promise((done) => {
        resolve = done;
      }),
    )
    .mockResolvedValueOnce([]);
  function Subject() {
    const [id, setId] = useState("old");
    return (
      <>
        <button onClick={() => setId("new")}>Next</button>
        <BacklinksPanel binderId="b" recordId={id} />
      </>
    );
  }
  const router = createMemoryRouter([{ path: "/", element: <Subject /> }]);
  await act(async () => root.render(<RouterProvider router={router} />));
  await act(async () =>
    host.querySelector<HTMLButtonElement>("button")!.click(),
  );
  await act(async () => resolve(rows));
  expect(host.textContent).toContain("No mentions yet.");
  expect(host.textContent).not.toContain("Chapel");
});
