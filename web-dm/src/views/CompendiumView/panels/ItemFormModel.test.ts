import { describe, expect, it } from "vitest";
import { buildItemPayload, emptyItemForm, itemToForm, type ItemForEdit } from "./ItemFormModel";

describe("ItemFormModel", () => {
  it("builds conditional weapon, use, modifier, roll, and spell facts", () => {
    const form = emptyItemForm();
    Object.assign(form, { name: "Staff of Testing", type: "Staff", rarity: "rare", magical: true, attunement: true, weight: "3", isWeapon: true, damage: "1d6", twoHandedDamage: "1d8", damageType: "Bludgeoning", properties: "V", usesEnabled: true, usesMax: "10", usesRecover: "1d6+4", spellcasting: "fixed", spellDc: "15", description: "First paragraph.\n\nSecond paragraph." });
    form.modifiers = [{ target: "ac", amount: "1" }];
    form.rolls = [{ formula: "1d6+4", description: "Charges regained" }];
    form.spells = [{ id: "s_shield", name: "Shield", cost: "2", level: "", uses: "", consume: false, maxLevel: "", maxCost: "", upcast: "", dc: "", attack: "", note: "" }];
    expect(buildItemPayload(form, null)).toMatchObject({ name: "Staff of Testing", magical: true, attunement: true, weight: 3, weapon: { damage: "1d6", twoHandedDamage: "1d8", damageType: "Bludgeoning", properties: ["V"] }, uses: { max: 10, recover: "1d6+4" }, spellcasting: { dc: 15 }, spells: { s_shield: 2 }, modifiers: [{ target: "ac", amount: 1 }], rolls: [{ formula: "1d6+4", description: "Charges regained" }], description: ["First paragraph.", "Second paragraph."] });
  });

  it("preserves advanced facts that this editor does not alter", () => {
    const item = { id: "i_test", ruleset: "5.5e", name: "Test", type: "Wondrous Item", rarity: "rare", description: ["Text"], effects: [{ type: "armor_class", amount: 1 }], spellTemplate: { kind: "stored", capacity: 5 } } as ItemForEdit;
    const payload = buildItemPayload(itemToForm(item), item);
    expect(payload.effects).toEqual(item.effects);
    expect(payload.spellTemplate).toEqual(item.spellTemplate);
  });

  it("emits an empty string rather than an invalid empty description array", () => {
    expect(buildItemPayload(emptyItemForm(), null).description).toBe("");
  });

  it("does not duplicate armor classification in proficiency", () => {
    const form = emptyItemForm();
    Object.assign(form, { type: "Light Armor", isArmor: true, proficiency: "stale weapon value", armorAc: "12" });
    expect(buildItemPayload(form, null)).toMatchObject({ type: "Light Armor", armor: { ac: 12 } });
    expect(buildItemPayload(form, null).proficiency).toBeUndefined();
  });
});
