import { expect, it, vi } from "vitest";
import { fetchLevelUpSpellOptions } from "./fetchLevelUpSpellOptions";
const mocks = vi.hoisted(() => ({ api: vi.fn() }));
vi.mock("@/services/api", () => ({ api: mocks.api }));

it("loads eligible spells beyond the first API page", async () => {
  mocks.api.mockReset()
    .mockResolvedValueOnce({ rows: [{ id: "first" }], total: 2 })
    .mockResolvedValueOnce({ rows: [{ id: "last" }], total: 2 });
  expect(await fetchLevelUpSpellOptions("classes=wizard")).toEqual([{ id: "first" }, { id: "last" }]);
  expect(mocks.api.mock.calls[1][0]).toContain("offset=1");
});

it("reports an incomplete catalogue rather than validating against it", async () => {
  mocks.api.mockReset().mockResolvedValue({ rows: [], total: 2 });
  await expect(fetchLevelUpSpellOptions("classes=wizard")).rejects.toThrow("incomplete");
});
