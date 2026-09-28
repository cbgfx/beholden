/**
 * The character example in docs/guides/ai-content.md must survive the client-side import
 * conversion (buildCharacterCreatePayload) with the values an AI copied from it intact. The server
 * side of the same example is checked in server/src/tests/docs/aiContentGuide.test.ts.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { CHARACTER_EXPORT_FORMAT, CHARACTER_EXPORT_VERSION, buildCharacterCreatePayload } from "./PlayerHomeUtils";

/** The first ```json block under "# Character import" in the guide. */
function guideCharacterExample(): Record<string, any> {
  const lines = readFileSync(resolve(__dirname, "../../../../docs/guides/ai-content.md"), "utf8").split(/\r?\n/u);
  const section = lines.findIndex((line) => line === "# Character import");
  const open = lines.findIndex((line, index) => index > section && line.startsWith("```json"));
  const close = lines.findIndex((line, index) => index > open && line.startsWith("```"));
  expect(section, "the guide has a # Character import section").toBeGreaterThanOrEqual(0);
  return JSON.parse(lines.slice(open + 1, close).join("\n"));
}

describe("ai-content.md character example", () => {
  const example = guideCharacterExample();

  it("uses the current character export envelope", () => {
    expect(example.format).toBe(CHARACTER_EXPORT_FORMAT);
    expect(example.version).toBe(CHARACTER_EXPORT_VERSION);
  });

  it("converts to a create payload that keeps its identity, ruleset, and sheet data", () => {
    const payload = buildCharacterCreatePayload(example);
    const character = example.character;
    expect(payload.name).toBe(character.name);
    expect(payload.ruleset).toBe(character.ruleset);
    const characterData = payload.characterData as Record<string, unknown>;
    // The server rejects a character without these, so the conversion must not drop them.
    expect(characterData.age).toBe(character.characterData.age);
    expect(characterData.gender).toBe(character.characterData.gender);
    expect(characterData.classes).toEqual(character.characterData.classes);
  });
});
