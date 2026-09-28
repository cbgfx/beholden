import { describe, expect, it } from "vitest";
import frPlayer from "./locales/fr";
import enShared from "@beholden/shared/i18n/locales/en";
import frShared from "@beholden/shared/i18n/locales/fr";

function flatten(value: object, prefix = ""): Record<string, string> {
  return Object.fromEntries(Object.entries(value).flatMap(([key, entry]) => typeof entry === "string"
    ? [[prefix + key, entry]]
    : Object.entries(flatten(entry, `${prefix}${key}.`))));
}
const placeholders = (value: string) => [...value.matchAll(/{{\s*([^}]+)\s*}}/g)].map((match) => match[1].trim()).sort();

describe.each([["Shared", enShared, frShared]] as const)("%s translations", (_name, en, fr) => {
  it("registers every structured English key in French with matching interpolation values", () => {
    const english = flatten(en);
    const french = flatten(fr);
    expect(Object.keys(english).length).toBeGreaterThan(20);
    for (const [key, value] of Object.entries(english)) {
      expect(french[key], key).toBeTypeOf("string");
      expect(placeholders(french[key]), key).toEqual(placeholders(value));
      expect(french[key], key).not.toMatch(/&(?:amp|lt|gt|nbsp|ldquo|rdquo);/);
    }
  });
});

describe("Player source-key translations", () => {
  it("preserves source-key placeholders", () => {
    expect(Object.keys(frPlayer.ui).length).toBeGreaterThan(20);
    for (const [source, value] of Object.entries(frPlayer.ui)) {
      expect(value, source).not.toBe("");
      expect(placeholders(value), source).toEqual(placeholders(source));
    }
  });
});
