import { describe, expect, it } from "vitest";
import { parseCharacterHpDelta } from "@/views/character/CharacterHpDelta";

describe("parseCharacterHpDelta", () => {
  it("treats a leading plus as healing even from the damage button", () => {
    expect(parseCharacterHpDelta("+5", "damage")).toMatchObject({
      amount: 5,
      kind: "heal",
      sign: "+",
      expression: "5",
    });
  });

  it("treats a leading minus as damage even from the heal button", () => {
    expect(parseCharacterHpDelta("-5", "heal")).toMatchObject({
      amount: 5,
      kind: "damage",
      sign: "-",
      expression: "5",
    });
  });

  it("uses the clicked button when there is no leading sign", () => {
    expect(parseCharacterHpDelta("5", "heal")).toMatchObject({
      amount: 5,
      kind: "heal",
      sign: "",
      expression: "5",
    });
  });
});
