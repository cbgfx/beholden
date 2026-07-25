import { describe, expect, it } from "vitest";
import { parsePackDescription } from "./CharacterInventoryBundles";

describe("pack description fallback", () => {
  it("extracts an Entertainer's Pack and its quantities", () => {
    expect(parsePackDescription("Entertainer's Pack", "An Entertainer's Pack contains the following items: Backpack, Bedroll, Bell, Bullseye Lantern, 3 Costumes, Mirror, 8 flasks of Oil, 9 days of Rations, Tinderbox, and Waterskin.")).toEqual({
      containerName: "Backpack",
      items: [
        { name: "Bedroll", quantity: 1 }, { name: "Bell", quantity: 1 },
        { name: "Bullseye Lantern", quantity: 1 }, { name: "Costume", quantity: 3 },
        { name: "Mirror", quantity: 1 }, { name: "Oil", quantity: 8 },
        { name: "Rations", quantity: 9 }, { name: "Tinderbox", quantity: 1 },
        { name: "Waterskin", quantity: 1 },
      ],
    });
  });

  it("supports the alternate chest container and measure words", () => {
    expect(parsePackDescription("Diplomat's Pack", "A Diplomat's Pack contains the following items: Chest, Fine Clothes, Ink, 5 Ink Pens, 2 Map or Scroll Cases, 5 sheets of Paper, and Tinderbox.")).toMatchObject({
      containerName: "Chest",
      items: expect.arrayContaining([
        { name: "Ink Pen", quantity: 5 },
        { name: "Map or Scroll Case", quantity: 2 },
        { name: "Paper", quantity: 5 },
      ]),
    });
  });

  it("does not infer arbitrary item descriptions", () => {
    expect(parsePackDescription("Backpack", "A backpack can hold equipment.")).toBeNull();
  });
});
