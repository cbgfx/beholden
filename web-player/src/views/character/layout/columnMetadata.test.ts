import { expect, it } from "vitest";
import {
  COLUMN_ICON_PRESETS,
  isColumnIcon,
  normalizeColumnHeaders,
} from "@beholden/shared/domain/layoutColumns";

it("accepts the built-in presets and Game Icons while rejecting malformed or external identifiers", () => {
  for (const icon of [...COLUMN_ICON_PRESETS, "game-icons:crossed-swords"])
    expect(isColumnIcon(icon)).toBe(true);
  for (const icon of [
    null,
    12,
    "",
    "unknown",
    "https://example.com/icon.svg",
    "game-icons:../icon",
    "game-icons:bad/path",
  ])
    expect(isColumnIcon(icon)).toBe(false);
});

it("normalizes untrusted metadata and resizes it without mutating saved input", () => {
  const raw = [
    { name: "  Party  ", icon: "players" },
    { name: "x".repeat(80), icon: "game-icons:bad/path" },
    null,
  ];
  const snapshot = JSON.stringify(raw);
  expect(normalizeColumnHeaders(raw, 2)).toEqual([
    { name: "Party", icon: "players" },
    { name: "x".repeat(60) },
  ]);
  expect(normalizeColumnHeaders(raw, 4)[3]).toEqual({});
  expect(normalizeColumnHeaders({ icon: "players" }, 2)).toEqual([{}, {}]);
  expect(JSON.stringify(raw)).toBe(snapshot);
});
