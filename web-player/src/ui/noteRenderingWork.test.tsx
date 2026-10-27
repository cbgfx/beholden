// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { NoteRow } from "@beholden/shared/ui/NoteRow";
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (s: string) => s }) }));
it("skips collapsed note parsing and reuses expanded content across unrelated updates", async () => {
  const text = "# Campaign history\n" + "A very long campaign paragraph.\n".repeat(1000);
  const original = String.prototype.replace;
  let parses = 0;
  const spy = vi.spyOn(String.prototype, "replace").mockImplementation(function (this: string, ...args: Parameters<typeof original>) {
    if (String(this) === text && args[0] instanceof RegExp && args[0].source === "\\r") parses++;
    return original.apply(this, args);
  } as typeof original);
  const host = document.createElement("div"); document.body.append(host); const root = createRoot(host);
  const props = { title: "History", text, accentColor: "#fff", textColor: "#fff", mutedColor: "#aaa", deleteColor: "#f00", onToggle: () => {} };
  const render = async (expanded: boolean, title = "History") => { await act(async () => root.render(<NoteRow {...props} expanded={expanded} title={title} onToggle={() => {}} />)); };
  try {
    await render(false); expect(parses).toBe(0);
    await render(true); expect(parses).toBe(1); expect(host.textContent).toContain("Campaign history");
    await render(true, "Renamed history"); expect(parses).toBe(1); expect(host.textContent).toContain("Renamed history");
    await render(false); expect(parses).toBe(1); expect(host.textContent).not.toContain("Campaign history");
  } finally { await act(async () => root.unmount()); host.remove(); spy.mockRestore(); }
});
