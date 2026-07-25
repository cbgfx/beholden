import { describe, expect, it } from "vitest";
import { appendMissingFeatureNotes } from "./featureNoteTemplates";

describe("appendMissingFeatureNotes", () => {
  const template = { id: "nt_artificer_plans_known", title: "Plans Known", text: "Plan 1:" };

  it("creates a missing templated note", () => {
    expect(appendMissingFeatureNotes([], [template])).toEqual([template]);
  });

  it("never overwrites a player-edited note with the same stable id", () => {
    const edited = { ...template, text: "Plan 1: Bag of Holding" };
    expect(appendMissingFeatureNotes([edited], [template])).toEqual([edited]);
  });
});
