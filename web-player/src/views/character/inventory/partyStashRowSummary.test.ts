/**
 * Party stash rows previously rendered only the item's notes, which are empty for anything
 * deposited from the compendium -- so most rows showed nothing but a name. They now show a
 * one-line preview of the description instead, which has to survive the shapes real item text
 * arrives in.
 */
import { describe, expect, it } from "vitest";
import { collapseToSingleLine } from "@/views/character/inventory/CharacterInventoryPanelRows";

describe("collapseToSingleLine", () => {
  it("keeps a short description as-is", () => {
    expect(collapseToSingleLine("Forty fist-sized crystals worth 10 gp each.")).toBe(
      "Forty fist-sized crystals worth 10 gp each.",
    );
  });

  it("drops the trailing source line that stored item text carries", () => {
    // Exactly the shape a deposited Chain Shirt has in the stash.
    expect(collapseToSingleLine("The wearer has disadvantage on Stealth (Dexterity) checks.\n\nSource:\tPlayer's Handbook"))
      .toBe("The wearer has disadvantage on Stealth (Dexterity) checks.");
  });

  it("keeps only the first paragraph of a multi-paragraph description", () => {
    expect(collapseToSingleLine("Fits Diego\n\nPlate consists of shaped, interlocking metal plates.")).toBe("Fits Diego");
  });

  it("flattens hard wrapping inside a paragraph", () => {
    expect(collapseToSingleLine("A cloak that\nshimmers faintly\nin moonlight.")).toBe(
      "A cloak that shimmers faintly in moonlight.",
    );
  });

  it("returns an empty string for missing or blank text, so the row renders nothing", () => {
    expect(collapseToSingleLine("")).toBe("");
    expect(collapseToSingleLine(null)).toBe("");
    expect(collapseToSingleLine(undefined)).toBe("");
    expect(collapseToSingleLine("   \n\n  ")).toBe("");
  });
});
