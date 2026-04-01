import React from "react";
import { C } from "@/lib/theme";
import type { ParsedFeatureEffects } from "@/domain/character/featureEffects";
import { IconInitiative, IconShield, IconSpeed } from "@/icons";
import { CollapsiblePanel, MiniStat, Tooltip } from "@/views/character/CharacterViewParts";
import { abilityMod, formatModifier } from "@/views/character/CharacterSheetUtils";
import {
  type InventoryItem,
  type ProficiencyMapLike,
  addsAbilityModToOffhandDamage,
  formatItemDamageType,
  formatItemProperties,
  getEquipState,
  getWeaponMasteryName,
  hasArmorProficiency,
  hasItemProperty,
  hasWeaponMastery,
  hasWeaponProficiency,
  isRangedWeapon,
  isShieldItem,
  isWeaponItem,
  parseMagicBonus,
  parseWeaponMastery,
  weaponAbilityMod,
  weaponDamageDice,
} from "@/views/character/CharacterInventory";

export interface CharacterCombatPanelsProps {
  effectiveAc: number;
  speed: number;
  movementModes?: Array<{ mode: "fly" | "swim" | "climb" | "burrow"; speed: number | null }>;
  level: number;
  className?: string | null;
  initiativeBonus: number;
  strScore: number | null;
  dexScore: number | null;
  pb: number;
  passivePerc: number;
  passiveInv: number;
  accentColor: string;
  inventory: InventoryItem[];
  prof?: ProficiencyMapLike | null;
  parsedFeatureEffects?: ParsedFeatureEffects[] | null;
  nonProficientArmorPenalty: boolean;
  hasDisadvantage?: boolean;
  rageDamageBonus?: number;
  unarmedRageDamageBonus?: number;
  rageActive?: boolean;
  showActions?: boolean;
}

export function CharacterCombatPanels({
  effectiveAc,
  speed,
  movementModes = [],
  level,
  className,
  initiativeBonus,
  strScore,
  dexScore,
  pb,
  passivePerc,
  passiveInv,
  accentColor,
  inventory,
  prof,
  parsedFeatureEffects,
  nonProficientArmorPenalty,
  hasDisadvantage = false,
  rageDamageBonus = 0,
  unarmedRageDamageBonus = 0,
  rageActive = false,
  showActions = true,
}: CharacterCombatPanelsProps) {
  const attackDisadvantage = nonProficientArmorPenalty || hasDisadvantage;
  const actionItems = inventory.filter((it) => getEquipState(it) !== "backpack" && isWeaponItem(it) && (!it.attunement || it.attuned));
  const nonProficientArmorItems = inventory.filter((it) => getEquipState(it) !== "backpack" && (isShieldItem(it) || /\barmor\b/i.test(it.type ?? "")) && !hasArmorProficiency(it, prof ?? undefined));
  const strMod = abilityMod(strScore);
  const dexMod = abilityMod(dexScore);
  const unarmedToHit = strMod + pb;
  const unarmedDmg = 1 + strMod + (rageActive ? unarmedRageDamageBonus : 0);
  const isRogue = /rogue/i.test(String(className ?? ""));
  const sneakAttackDice = Math.max(1, Math.ceil(level / 2));

  function weaponUsesStrength(item: InventoryItem): boolean {
    if (isRangedWeapon(item)) return false;
    if (hasItemProperty(item, "F")) return strMod >= dexMod;
    return true;
  }

  return (
    <>
      <CollapsiblePanel title="Combat Stats" color={accentColor} storageKey="combat-stats">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(88px, 1fr))", gap: 6 }}>
          <MiniStat label="Armor Class" value={String(effectiveAc)} accent={accentColor} icon={<IconShield size={11} />} />
          <MiniStat label="Speed" value={`${speed} ft`} icon={<IconSpeed size={11} />} />
          <MiniStat label="Initiative" value={formatModifier(initiativeBonus)} accent={accentColor} icon={<IconInitiative size={11} />} />
          <MiniStat label="Prof. Bonus" value={`+${pb}`} accent={accentColor} />
          <MiniStat label="Passive Perc." value={String(passivePerc)} />
        </div>
        {movementModes.length > 0 && (
          <div style={{ marginTop: 10 }}>
            <div style={{ fontSize: "var(--fs-tiny)", fontWeight: 800, color: C.muted, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 6 }}>
              Special Movement
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {movementModes.map((entry) => (
                <span
                  key={entry.mode}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    fontSize: "var(--fs-small)",
                    fontWeight: 700,
                    color: accentColor,
                    background: `${accentColor}18`,
                    border: `1px solid ${accentColor}44`,
                    borderRadius: 999,
                    padding: "3px 10px",
                  }}
                >
                  {entry.mode[0].toUpperCase() + entry.mode.slice(1)} {entry.speed != null ? `${entry.speed} ft` : ""}
                </span>
              ))}
            </div>
          </div>
        )}
        {rageActive && (
          <div style={{ marginTop: 10 }}>
            <div style={{ fontSize: "var(--fs-tiny)", fontWeight: 800, color: C.muted, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 6 }}>
              Rage
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  fontSize: "var(--fs-small)",
                  fontWeight: 700,
                  color: C.red,
                  background: `${C.red}18`,
                  border: `1px solid ${C.red}44`,
                  borderRadius: 999,
                  padding: "3px 10px",
                }}
              >
                Active
              </span>
              {rageDamageBonus > 0 && (
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    fontSize: "var(--fs-small)",
                    fontWeight: 700,
                    color: accentColor,
                    background: `${accentColor}18`,
                    border: `1px solid ${accentColor}44`,
                    borderRadius: 999,
                    padding: "3px 10px",
                  }}
                >
                  Rage Damage +{rageDamageBonus}
                </span>
              )}
            </div>
          </div>
        )}
      </CollapsiblePanel>

      {showActions && <CollapsiblePanel title="Actions" color={accentColor} storageKey="actions">
        {nonProficientArmorItems.length > 0 && (
          <div style={{
            marginBottom: 10,
            padding: "8px 10px",
            borderRadius: 8,
            border: "1px solid rgba(248,113,113,0.35)",
            background: "rgba(248,113,113,0.10)",
            color: "#fca5a5",
            fontSize: "var(--fs-small)",
            fontWeight: 700,
          }}>
            Not proficient with equipped armor: disadvantage on STR/DEX attacks and you can't cast spells.
          </div>
        )}
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) auto auto minmax(0,1fr)", gap: "0 8px", marginBottom: 6 }}>
          {(["ATTACK", "RANGE", "HIT / DC", "DAMAGE / NOTES"] as const).map((h) => (
            <div key={h} style={{ fontSize: "var(--fs-tiny)", fontWeight: 900, letterSpacing: "0.07em", textTransform: "uppercase", color: C.muted, paddingBottom: 4, borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
              {h}
            </div>
          ))}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {actionItems.map((it) => {
            const state = getEquipState(it);
            const attackState = state === "mainhand-2h" ? "mainhand-2h" : state === "offhand" ? "offhand" : "mainhand-1h";
            const dmg = weaponDamageDice(it, attackState);
            const ability = weaponAbilityMod(it, { strScore, dexScore });
            const proficient = hasWeaponProficiency(it, prof ?? undefined);
            const mastery = parseWeaponMastery(it);
            const masteryKnown = hasWeaponMastery(it, prof ?? undefined);
            const masteryName = masteryKnown ? (mastery?.name ?? getWeaponMasteryName(it)) : null;
            const magicBonus = parseMagicBonus(it);
            const toHit = ability + (proficient ? pb : 0) + magicBonus;
            const damageAbility = attackState === "offhand" && !addsAbilityModToOffhandDamage(it, parsedFeatureEffects) ? 0 : ability;
            const rageBonus = rageActive && weaponUsesStrength(it) ? rageDamageBonus : 0;
            const damageType = formatItemDamageType(it.dmgType);
            const props = formatItemProperties(it.properties);
            const isReach = hasItemProperty(it, "R");
            const rangeLabel = isRangedWeapon(it) ? (it.properties?.find((p) => /^\d/.test(p)) ?? "Range") : `${isReach ? "10" : "5"} ft.`;
            const totalFlatBonus = damageAbility + rageBonus + magicBonus;
            const dmgText = dmg ? `${dmg}${totalFlatBonus === 0 ? "" : `${totalFlatBonus >= 0 ? "+" : ""}${totalFlatBonus}`}${damageType ? ` ${damageType}` : ""}` : "-";
            const modeLabel = attackState === "mainhand-2h" ? "2H" : attackState === "offhand" ? "Offhand" : null;

            return (
              <div key={`${it.id}:${attackState}`} style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) auto auto minmax(0,1fr)", gap: "0 8px", alignItems: "center", padding: "6px 0", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                    <span style={{ fontSize: "var(--fs-subtitle)", fontWeight: 800, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.name}</span>
                    {modeLabel && <span style={{ fontSize: "var(--fs-tiny)", fontWeight: 800, color: accentColor, border: `1px solid ${accentColor}44`, background: `${accentColor}18`, borderRadius: 999, padding: "1px 5px" }}>{modeLabel}</span>}
                    {masteryName && <Tooltip text={mastery?.text ?? `Weapon Mastery: ${masteryName}`} multiline><span style={{ fontSize: "var(--fs-tiny)", fontWeight: 800, color: C.colorGold, border: "1px solid rgba(251,191,36,0.35)", background: "rgba(251,191,36,0.12)", borderRadius: 999, padding: "1px 5px", cursor: "help" }}>{masteryName}</span></Tooltip>}
                    {!proficient && <span style={{ fontSize: "var(--fs-tiny)", color: C.red, fontWeight: 700 }}>No proficiency</span>}
                    {attackDisadvantage && <span style={{ fontSize: "var(--fs-tiny)", color: C.colorPinkRed, fontWeight: 700 }}>D</span>}
                  </div>
                  <div style={{ fontSize: "var(--fs-tiny)", color: C.muted }}>{isWeaponItem(it) ? "Melee Weapon" : it.type ?? ""}</div>
                </div>
                <div style={{ fontSize: "var(--fs-small)", color: C.muted, textAlign: "center", whiteSpace: "nowrap" }}>{rangeLabel}</div>
                <div
                  style={{
                    fontSize: "var(--fs-title)",
                    fontWeight: 900,
                    color: attackDisadvantage ? C.colorPinkRed : C.text,
                    textAlign: "center",
                    minWidth: 36,
                    border: `1px solid ${proficient ? accentColor + "55" : "rgba(255,255,255,0.15)"}`,
                    borderRadius: 8,
                    padding: "3px 6px",
                    background: "rgba(255,255,255,0.04)",
                  }}
                >
                  {formatModifier(toHit)}{attackDisadvantage ? " D" : ""}
                </div>
                <div>
                  <div style={{ fontSize: "var(--fs-subtitle)", fontWeight: 700, color: C.text }}>{dmgText}</div>
                  {props && <div style={{ fontSize: "var(--fs-small)", color: C.muted }}>{props}</div>}
                </div>
              </div>
            );
          })}

          {isRogue && (
            <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) auto auto minmax(0,1fr)", gap: "0 8px", alignItems: "center", padding: "6px 0", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
              <div>
                <div style={{ fontSize: "var(--fs-subtitle)", fontWeight: 800, color: C.text }}>Sneak Attack</div>
                <div style={{ fontSize: "var(--fs-tiny)", color: C.muted }}>Once per turn</div>
              </div>
              <div style={{ fontSize: "var(--fs-small)", color: C.muted, textAlign: "center", whiteSpace: "nowrap" }}>On hit</div>
              <div style={{ fontSize: "var(--fs-medium)", fontWeight: 800, color: C.muted, textAlign: "center", minWidth: 36 }}>
                -
              </div>
              <div>
                <div style={{ fontSize: "var(--fs-subtitle)", fontWeight: 700, color: C.text }}>{sneakAttackDice}d6</div>
                <div style={{ fontSize: "var(--fs-small)", color: C.muted }}>Finesse or ranged weapon</div>
              </div>
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) auto auto minmax(0,1fr)", gap: "0 8px", alignItems: "center", padding: "6px 0" }}>
            <div>
              <div style={{ fontSize: "var(--fs-subtitle)", fontWeight: 800, color: C.text }}>Unarmed Strike</div>
              <div style={{ fontSize: "var(--fs-tiny)", color: C.muted }}>Melee Attack</div>
            </div>
            <div style={{ fontSize: "var(--fs-small)", color: C.muted, textAlign: "center", whiteSpace: "nowrap" }}>5 ft.</div>
            <div style={{ fontSize: "var(--fs-title)", fontWeight: 900, color: attackDisadvantage ? C.colorPinkRed : C.text, textAlign: "center", minWidth: 36, border: "1px solid rgba(255,255,255,0.15)", borderRadius: 8, padding: "3px 6px", background: "rgba(255,255,255,0.04)" }}>
              {formatModifier(unarmedToHit)}{attackDisadvantage ? " D" : ""}
            </div>
            <div>
              <div style={{ fontSize: "var(--fs-subtitle)", fontWeight: 700, color: C.text }}>{unarmedDmg}</div>
              <div style={{ fontSize: "var(--fs-small)", color: C.muted }}>Bludgeoning</div>
            </div>
          </div>
        </div>
      </CollapsiblePanel>}
    </>
  );
}
