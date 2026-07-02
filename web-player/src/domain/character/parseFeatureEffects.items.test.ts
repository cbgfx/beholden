/**
 * Item effects corpus — verifies that parseFeatureEffects correctly derives
 * structured FeatureEffect objects from real WotC 2024 magic item descriptions.
 *
 * Description strings are taken verbatim from the converted v2 corpus so any
 * future text change to the XML will surface here immediately.
 */

import { describe, expect, it } from "vitest";
import { parseFeatureEffects } from "@/domain/character/parseFeatureEffects";

function parseItem(name: string, description: string) {
  return parseFeatureEffects({
    source: { id: `item:${name.toLowerCase().replace(/\s+/g, "_")}`, kind: "item", name },
    text: description,
  });
}

// ── Ability score floor effects ────────────────────────────────────────────────

describe("parseFeatureEffects – magic item ability score floors", () => {
  it("Amulet of Health: CON floor 19 (while_equipped)", () => {
    const { effects } = parseItem(
      "Amulet of Health",
      "Your Constitution score is 19 while you wear this amulet. It has no effect on you if your Constitution is already 19 or higher without it.",
    );
    expect(effects).toContainEqual(expect.objectContaining({
      type: "ability_score",
      mode: "set_minimum",
      ability: "con",
      amount: 19,
      gate: expect.objectContaining({ duration: "while_equipped" }),
    }));
  });

  it("Headband of Intellect: INT floor 19 (while_equipped)", () => {
    const { effects } = parseItem(
      "Headband of Intellect",
      "Your Intelligence score is 19 while you wear this headband. It has no effect on you if your Intelligence is 19 or higher without it.",
    );
    expect(effects).toContainEqual(expect.objectContaining({
      type: "ability_score",
      mode: "set_minimum",
      ability: "int",
      amount: 19,
      gate: expect.objectContaining({ duration: "while_equipped" }),
    }));
  });

  it("Gauntlets of Ogre Power: STR floor 19 (while_equipped)", () => {
    const { effects } = parseItem(
      "Gauntlets of Ogre Power",
      "Your Strength score is 19 while you wear these gauntlets. They have no effect on you if your Strength is 19 or higher without them.",
    );
    expect(effects).toContainEqual(expect.objectContaining({
      type: "ability_score",
      mode: "set_minimum",
      ability: "str",
      amount: 19,
      gate: expect.objectContaining({ duration: "while_equipped" }),
    }));
  });

  it("Belt of Hill Giant Strength: STR floor 21 via 'changes to' pattern (while_equipped)", () => {
    const { effects } = parseItem(
      "Belt of Hill Giant Strength",
      "While wearing this belt, your Strength score changes to 21. The item has no effect on you if your Strength without the belt is equal to or greater than the belt's score.",
    );
    expect(effects).toContainEqual(expect.objectContaining({
      type: "ability_score",
      mode: "set_minimum",
      ability: "str",
      amount: 21,
      gate: expect.objectContaining({ duration: "while_equipped" }),
    }));
  });

  it("Belt of Storm Giant Strength: STR floor 29 (while_equipped)", () => {
    const { effects } = parseItem(
      "Belt of Storm Giant Strength",
      "While wearing this belt, your Strength score changes to 29. The item has no effect on you if your Strength without the belt is equal to or greater than the belt's score.",
    );
    expect(effects).toContainEqual(expect.objectContaining({
      type: "ability_score",
      mode: "set_minimum",
      ability: "str",
      amount: 29,
      gate: expect.objectContaining({ duration: "while_equipped" }),
    }));
  });

  it("no duplicate set_minimum when both patterns could match", () => {
    // Hypothetical text that could match both pattern A and B — must emit only one effect.
    const { effects } = parseItem(
      "Hypothetical Item",
      "While wearing this ring, your Constitution score is 19. Your Constitution score is 19 while you wear this ring.",
    );
    const setMin = effects.filter((e) => e.type === "ability_score" && e.mode === "set_minimum");
    expect(setMin).toHaveLength(1);
  });
});

// ── Speed grant effects ────────────────────────────────────────────────────────

describe("parseFeatureEffects – magic item speed grants", () => {
  it("Ring of Swimming: Swim Speed 40 ft, while_equipped gate", () => {
    const { effects } = parseItem(
      "Ring of Swimming",
      "You have a Swim Speed of 40 feet while wearing this ring.",
    );
    const speed = effects.find((e) => e.type === "speed");
    expect(speed).toBeTruthy();
    if (!speed || speed.type !== "speed") return;
    expect(speed.mode).toBe("grant_mode");
    expect(speed.movementMode).toBe("swim");
    expect(speed.amount).toEqual({ kind: "fixed", value: 40 });
    expect(speed.gate?.duration).toBe("while_equipped");
  });

  it("Cloak of the Manta Ray: Swim Speed 60 ft, while_equipped gate", () => {
    const { effects } = parseItem(
      "Cloak of the Manta Ray",
      "While wearing this cloak, you have a Swim Speed of 60 feet, and you can breathe underwater.",
    );
    const speed = effects.find((e) => e.type === "speed");
    expect(speed).toBeTruthy();
    if (!speed || speed.type !== "speed") return;
    expect(speed.movementMode).toBe("swim");
    expect(speed.amount).toEqual({ kind: "fixed", value: 60 });
    expect(speed.gate?.duration).toBe("while_equipped");
  });

  it("Mariner's armor: Swim Speed equal to Speed, while_equipped gate", () => {
    const { effects } = parseItem(
      "Mariner's Breastplate",
      "While wearing this armor, you have a Swim Speed equal to your Speed.",
    );
    const speed = effects.find((e) => e.type === "speed");
    expect(speed).toBeTruthy();
    if (!speed || speed.type !== "speed") return;
    expect(speed.movementMode).toBe("swim");
    expect(speed.amount).toEqual({ kind: "named_progression", key: "equal_to_speed" });
    expect(speed.gate?.duration).toBe("while_equipped");
  });

  it("Broom of Flying: Fly Speed 50 ft (no attunement context = passive)", () => {
    const { effects } = parseItem(
      "Broom of Flying",
      "You have a Fly Speed of 50 feet while you ride the broom.",
    );
    const speed = effects.find((e) => e.type === "speed");
    expect(speed).toBeTruthy();
    if (!speed || speed.type !== "speed") return;
    expect(speed.movementMode).toBe("fly");
    expect(speed.amount).toEqual({ kind: "fixed", value: 50 });
  });

  it("Cloak of Arachnida: Climb Speed equal to Speed, while_equipped", () => {
    const { effects } = parseItem(
      "Cloak of Arachnida",
      "While wearing this cloak, you have a Climb Speed equal to your Speed and can move up, down, and across vertical surfaces.",
    );
    const speed = effects.find((e) => e.type === "speed");
    expect(speed).toBeTruthy();
    if (!speed || speed.type !== "speed") return;
    expect(speed.movementMode).toBe("climb");
    expect(speed.amount).toEqual({ kind: "named_progression", key: "equal_to_speed" });
    expect(speed.gate?.duration).toBe("while_equipped");
  });

  it("adjective-form 'swimming speed of N' is parsed identically to 'Swim Speed of N'", () => {
    const canonical = parseItem("Item A", "You have a Swim Speed of 30 feet while wearing this item.");
    const adjective = parseItem("Item B", "You have a swimming speed of 30 feet while wearing this item.");
    const speedA = canonical.effects.find((e) => e.type === "speed");
    const speedB = adjective.effects.find((e) => e.type === "speed");
    expect(speedA?.type).toBe("speed");
    expect(speedB?.type).toBe("speed");
    if (speedA?.type === "speed" && speedB?.type === "speed") {
      expect(speedA.movementMode).toBe(speedB.movementMode);
      expect(speedA.amount).toEqual(speedB.amount);
    }
  });
});

// ── Senses effects ────────────────────────────────────────────────────────────

describe("parseFeatureEffects – magic item senses", () => {
  it("Goggles of Night: Darkvision 60 ft", () => {
    const { effects } = parseItem(
      "Goggles of Night",
      "While wearing these goggles, you have Darkvision out to 60 feet. If you already have Darkvision, wearing the goggles increases its range by 60 feet.",
    );
    const grant = effects.find((e) => e.type === "senses" && e.mode === "grant");
    expect(grant).toBeTruthy();
    if (!grant || grant.type !== "senses") return;
    expect(grant.senses).toContainEqual({ kind: "darkvision", range: 60 });
  });

  it("Goggles of Night: Darkvision range bonus when already present", () => {
    const { effects } = parseItem(
      "Goggles of Night",
      "While wearing these goggles, you have Darkvision out to 60 feet. If you already have Darkvision, wearing the goggles increases its range by 60 feet.",
    );
    const bonus = effects.find((e) => e.type === "senses" && e.mode === "bonus");
    expect(bonus).toBeTruthy();
    if (!bonus || bonus.type !== "senses") return;
    expect(bonus.senses).toContainEqual({ kind: "darkvision", range: 60 });
  });
});
