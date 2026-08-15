export const ITEM_MODIFIER_TARGETS = ["ac", "melee_attacks", "melee_damage", "ranged_attacks", "ranged_damage", "weapon_attacks", "weapon_damage", "saving_throws", "ability_checks", "spell_attack", "spell_save_dc", "initiative", "proficiency_bonus"] as const;
export const WEAPON_MASTERIES = ["Cleave", "Graze", "Nick", "Push", "Sap", "Slow", "Topple", "Vex"] as const;
export const AMMO_FAMILIES = ["arrow", "bolt", "energy-cell", "firearm-bullet", "needle", "sling-bullet"] as const;

type ItemModifierRow = { target: string; amount: string };
type ItemRollRow = { formula: string; description: string };
export type ItemSpellRow = { id: string; name?: string; cost: string; level: string; uses: string; consume: boolean; maxLevel: string; maxCost: string; upcast: string; dc: string; attack: string; note: string };
export type ItemForEdit = {
  id: string; ruleset?: "5e" | "5.5e"; name: string; source?: string; type: string; rarity: string;
  magical?: true; attunement?: true | string; equippable?: true; weight?: number; value?: number; proficiency?: string;
  ammo?: string; usage?: "held"; container?: true; ignoreWeight?: true;
  armor?: { ac?: number; stealthDisadvantage?: true; strength?: number };
  weapon?: { damage?: string; twoHandedDamage?: string; damageType?: string; range?: string; properties?: string[]; mastery?: string; ammo?: string };
  modifiers?: Array<{ target: string; amount: number }>; rolls?: Array<{ formula: string; description?: string }>;
  uses?: number | string | { max: number | string; recover?: false | number | string };
  spells?: Record<string, number | "level" | { cost?: number | "level"; level?: number; uses?: number | string; consume?: true; maxLevel?: number; maxCost?: number; upcast?: number; dc?: number; attack?: number; note?: string }>;
  spellcasting?: "character" | { dc?: number; attack?: number }; description: string | string[]; [key: string]: unknown;
};

export type ItemFormData = {
  ruleset: "5e" | "5.5e"; name: string; source: string; type: string; rarity: string; magical: boolean;
  attunement: boolean; attunementRequirements: string; equippable: boolean; weight: string; value: string; proficiency: string; description: string;
  isWeapon: boolean; damage: string; twoHandedDamage: string; damageType: string; range: string; properties: string; mastery: string; weaponAmmo: string;
  isArmor: boolean; armorAc: string; armorStrength: string; stealthDisadvantage: boolean;
  isAmmo: boolean; ammo: string; held: boolean; container: boolean; ignoreWeight: boolean;
  modifiers: ItemModifierRow[]; rolls: ItemRollRow[];
  usesEnabled: boolean; usesMax: string; usesRecover: string;
  spellcasting: "" | "character" | "fixed"; spellDc: string; spellAttack: string; spells: ItemSpellRow[];
};

const text = (value: unknown) => value == null ? "" : String(value);
const positive = (value: string) => value.trim() ? Number(value) : undefined;
const amount = (value: string): number | string | undefined => {
  const clean = value.trim(); if (!clean) return undefined;
  return /^\d+$/u.test(clean) ? Number(clean) : clean;
};
const spellRow = (id: string, access: NonNullable<ItemForEdit["spells"]>[string]): ItemSpellRow => {
  const data = typeof access === "object" ? access : { cost: access };
  return { id, cost: text(data.cost), level: text(data.level), uses: text(data.uses), consume: data.consume === true, maxLevel: text(data.maxLevel), maxCost: text(data.maxCost), upcast: text(data.upcast), dc: text(data.dc), attack: text(data.attack), note: data.note ?? "" };
};

export function emptyItemForm(): ItemFormData {
  return { ruleset: "5.5e", name: "", source: "", type: "Wondrous Item", rarity: "common", magical: false, attunement: false, attunementRequirements: "", equippable: false, weight: "", value: "", proficiency: "", description: "", isWeapon: false, damage: "", twoHandedDamage: "", damageType: "", range: "", properties: "", mastery: "", weaponAmmo: "", isArmor: false, armorAc: "", armorStrength: "", stealthDisadvantage: false, isAmmo: false, ammo: "", held: false, container: false, ignoreWeight: false, modifiers: [], rolls: [], usesEnabled: false, usesMax: "", usesRecover: "", spellcasting: "", spellDc: "", spellAttack: "", spells: [] };
}

export function itemToForm(item: ItemForEdit): ItemFormData {
  const base = emptyItemForm(); const uses = item.uses; const structuredUses = typeof uses === "object";
  return { ...base, ruleset: item.ruleset ?? "5.5e", name: item.name, source: item.source ?? "", type: item.type, rarity: item.rarity, magical: item.magical === true, attunement: Boolean(item.attunement), attunementRequirements: typeof item.attunement === "string" ? item.attunement : "", equippable: item.equippable === true, weight: text(item.weight), value: text(item.value), proficiency: item.proficiency ?? "", description: Array.isArray(item.description) ? item.description.join("\n\n") : item.description, isWeapon: Boolean(item.weapon), damage: item.weapon?.damage ?? "", twoHandedDamage: item.weapon?.twoHandedDamage ?? "", damageType: item.weapon?.damageType ?? "", range: item.weapon?.range ?? "", properties: item.weapon?.properties?.join(", ") ?? "", mastery: item.weapon?.mastery ?? "", weaponAmmo: item.weapon?.ammo ?? "", isArmor: Boolean(item.armor), armorAc: text(item.armor?.ac), armorStrength: text(item.armor?.strength), stealthDisadvantage: item.armor?.stealthDisadvantage === true, isAmmo: Boolean(item.ammo), ammo: item.ammo ?? "", held: item.usage === "held", container: item.container === true, ignoreWeight: item.ignoreWeight === true, modifiers: item.modifiers?.map((row) => ({ target: row.target, amount: text(row.amount) })) ?? [], rolls: item.rolls?.map((row) => ({ formula: row.formula, description: row.description ?? "" })) ?? [], usesEnabled: uses !== undefined, usesMax: text(structuredUses ? uses.max : uses), usesRecover: text(structuredUses ? uses.recover : ""), spellcasting: item.spellcasting === "character" ? "character" : item.spellcasting ? "fixed" : "", spellDc: text(typeof item.spellcasting === "object" ? item.spellcasting.dc : ""), spellAttack: text(typeof item.spellcasting === "object" ? item.spellcasting.attack : ""), spells: Object.entries(item.spells ?? {}).map(([id, access]) => spellRow(id, access)) };
}

export function buildItemPayload(form: ItemFormData, original: ItemForEdit | null): Record<string, unknown> {
  const description = form.description.split(/\n{2,}/u).map((part) => part.trim()).filter(Boolean);
  const weapon = form.isWeapon ? { ...(form.damage.trim() ? { damage: form.damage.trim() } : {}), ...(form.twoHandedDamage.trim() ? { twoHandedDamage: form.twoHandedDamage.trim() } : {}), ...(form.damageType.trim() ? { damageType: form.damageType.trim() } : {}), ...(form.range.trim() ? { range: form.range.trim() } : {}), ...(form.properties.trim() ? { properties: form.properties.split(",").map((part) => part.trim()).filter(Boolean) } : {}), ...(form.mastery ? { mastery: form.mastery } : {}), ...(form.weaponAmmo ? { ammo: form.weaponAmmo } : {}) } : undefined;
  const armor = form.isArmor ? { ...(form.armorAc ? { ac: Number(form.armorAc) } : {}), ...(form.armorStrength ? { strength: Number(form.armorStrength) } : {}), ...(form.stealthDisadvantage ? { stealthDisadvantage: true } : {}) } : undefined;
  const modifiers = form.modifiers.filter((row) => row.target && row.amount).map((row) => ({ target: row.target, amount: Number(row.amount) }));
  const rolls = form.rolls.filter((row) => row.formula.trim()).map((row) => ({ formula: row.formula.trim(), ...(row.description.trim() ? { description: row.description.trim() } : {}) }));
  let uses: unknown; const max = amount(form.usesMax); const recover = amount(form.usesRecover);
  if (form.usesEnabled && max !== undefined) uses = recover !== undefined ? { max, recover } : max;
  const spells = Object.fromEntries(form.spells.filter((row) => row.id).map((row) => { const cost = row.cost === "level" ? "level" : positive(row.cost); const access = { ...(cost !== undefined ? { cost } : {}), ...(positive(row.level) !== undefined ? { level: positive(row.level) } : {}), ...(amount(row.uses) !== undefined ? { uses: amount(row.uses) } : {}), ...(row.consume ? { consume: true } : {}), ...(positive(row.maxLevel) !== undefined ? { maxLevel: positive(row.maxLevel) } : {}), ...(positive(row.maxCost) !== undefined ? { maxCost: positive(row.maxCost) } : {}), ...(positive(row.upcast) !== undefined ? { upcast: positive(row.upcast) } : {}), ...(row.dc ? { dc: Number(row.dc) } : {}), ...(row.attack ? { attack: Number(row.attack) } : {}), ...(row.note.trim() ? { note: row.note.trim() } : {}) }; return [row.id, Object.keys(access).length === 1 && cost !== undefined ? cost : access]; }));
  const spellcasting = form.spellcasting === "character" ? "character" : form.spellcasting === "fixed" ? { ...(form.spellDc ? { dc: Number(form.spellDc) } : {}), ...(form.spellAttack ? { attack: Number(form.spellAttack) } : {}) } : undefined;
  return { ...(original ?? {}), ruleset: form.ruleset, name: form.name.trim(), source: form.source.trim() || undefined, type: form.type.trim(), rarity: form.rarity.trim(), magical: form.magical || undefined, attunement: form.attunement ? form.attunementRequirements.trim() || true : undefined, equippable: form.equippable || undefined, weight: form.weight ? Number(form.weight) : undefined, value: form.value ? Number(form.value) : undefined, proficiency: form.isWeapon ? form.proficiency.trim() || undefined : undefined, ammo: form.isAmmo && form.ammo ? form.ammo : undefined, usage: form.held ? "held" : undefined, container: form.container || undefined, ignoreWeight: form.container && form.ignoreWeight || undefined, weapon: weapon && Object.keys(weapon).length ? weapon : undefined, armor: armor && Object.keys(armor).length ? armor : undefined, modifiers: modifiers.length ? modifiers : undefined, rolls: rolls.length ? rolls : undefined, uses, spells: Object.keys(spells).length ? spells : undefined, spellcasting, description: description.length ? description : "" };
}
