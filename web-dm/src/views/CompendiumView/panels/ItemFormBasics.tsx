import { Input } from "@/ui/Input";
import { TextArea } from "@/ui/TextArea";
import { ITEM_RARITY_ORDER, KNOWN_ITEM_TYPES } from "@beholden/shared/domain";
import { SpellChoiceMenu } from "./SpellFormControls";
import { AMMO_FAMILIES, type ItemFormData } from "./ItemFormModel";
import { ItemColumn, ItemField, ItemPills, itemChoices, itemSectionStyle, itemSectionTitle, type ItemFormSetter } from "./ItemFormCommon";

function mechanicsForType(type: string) {
  return {
    isWeapon: /^(?:Melee Weapon|Ranged Weapon|Staff)$/u.test(type),
    isArmor: /^(?:Light Armor|Medium Armor|Heavy Armor|Shield)$/u.test(type),
    isAmmo: type === "Ammunition",
  };
}

export function ItemBasicsView({ form, set }: { form: ItemFormData; set: ItemFormSetter }) {
  const changeType = (type: string) => {
    const mechanics = mechanicsForType(type);
    set("type", type); set("isWeapon", mechanics.isWeapon); set("isArmor", mechanics.isArmor); set("isAmmo", mechanics.isAmmo);
  };
  return <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: 12, alignItems: "start" }}>
    <ItemColumn><section style={itemSectionStyle}><h3 style={itemSectionTitle}>Item</h3>
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 145px", gap: 10 }}><ItemField label="Name *"><Input autoFocus value={form.name} onChange={(e) => set("name", e.target.value)} /></ItemField><ItemField label="Ruleset"><SpellChoiceMenu ariaLabel="Ruleset" value={form.ruleset} onChange={(value) => set("ruleset", value as ItemFormData["ruleset"])} options={[{ value: "5.5e", label: "5.5e (2024)" }, { value: "5e", label: "5e (2014)" }]} /></ItemField></div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 10 }}><ItemField label="Type *"><SpellChoiceMenu ariaLabel="Item type" value={form.type} onChange={changeType} options={itemChoices(KNOWN_ITEM_TYPES)} /></ItemField><ItemField label="Rarity *"><SpellChoiceMenu ariaLabel="Rarity" value={form.rarity} onChange={(value) => set("rarity", value)} options={itemChoices(ITEM_RARITY_ORDER)} /></ItemField><ItemField label="Weight (lb)"><Input type="number" min={0} step="any" value={form.weight} onChange={(e) => set("weight", e.target.value)} /></ItemField><ItemField label="Value (gp)"><Input type="number" min={0} step="any" value={form.value} onChange={(e) => set("value", e.target.value)} /></ItemField></div>
      <div style={{ marginTop: 10 }}><ItemField label="Source"><Input value={form.source} onChange={(e) => set("source", e.target.value)} placeholder="Book and page, or Homebrew" /></ItemField></div>
      {form.isAmmo ? <div style={{ marginTop: 10 }}><ItemField label="Ammunition family"><SpellChoiceMenu ariaLabel="Ammunition family" value={form.ammo} onChange={(value) => set("ammo", value)} options={itemChoices(AMMO_FAMILIES)} /></ItemField></div> : null}
      <ItemPills items={[{ label: "Magical", active: form.magical, toggle: () => set("magical", !form.magical) }, { label: "Equippable", active: form.equippable, toggle: () => set("equippable", !form.equippable) }, { label: "Requires attunement", active: form.attunement, toggle: () => set("attunement", !form.attunement) }, { label: "Held to use", active: form.held, toggle: () => set("held", !form.held) }]} />
      {form.attunement ? <div style={{ marginTop: 10 }}><ItemField label="Attunement requirements"><Input value={form.attunementRequirements} onChange={(e) => set("attunementRequirements", e.target.value)} placeholder="Optional, e.g. by a spellcaster" /></ItemField></div> : null}
    </section></ItemColumn>
    <ItemColumn><section style={itemSectionStyle}><h3 style={itemSectionTitle}>Description *</h3><div style={{ color: "#8190aa", fontSize: "var(--fs-tiny)", marginBottom: 7 }}>Separate paragraphs with a blank line.</div><TextArea value={form.description} onChange={(e) => set("description", e.target.value)} style={{ minHeight: 390 }} /></section></ItemColumn>
  </div>;
}
