import React from "react";
import { C } from "@/lib/theme";
import type { ParsedFeatureEffects } from "@/domain/character/featureEffects";
import {
  deriveAttackAbilityOverrideFromEffects,
  deriveAttackDamageBonusFromEffects,
  deriveAttackDamageDiceOverrideFromEffects,
  deriveAttackRollBonusFromEffects,
} from "@/domain/character/parseFeatureEffects";
import { IconInitiative, IconShield, IconSpeed } from "@/icons";
import { CollapsiblePanel, Tooltip } from "@/views/character/CharacterViewParts";
import { abilityMod, formatModifier } from "@/views/character/CharacterSheetUtils";
import { getExhaustedSpeed, getExhaustionD20Penalty } from "@/views/character/CharacterExhaustion";
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
  accentColor: string;
  inventory: InventoryItem[];
  prof?: ProficiencyMapLike | null;
  parsedFeatureEffects?: ParsedFeatureEffects[] | null;
  nonProficientArmorPenalty: boolean;
  hasDisadvantage?: boolean;
  rageDamageBonus?: number;
  unarmedRageDamageBonus?: number;
  rageActive?: boolean;
  embeddedStats?: boolean;
  showStats?: boolean;
  showActions?: boolean;
  exhaustion?: number;
  reactionUsed?: boolean;
  onToggleReaction?: (() => void) | null;
  incapacitated?: boolean;
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
  accentColor,
  inventory,
  prof,
  parsedFeatureEffects,
  nonProficientArmorPenalty,
  hasDisadvantage = false,
  rageDamageBonus = 0,
  unarmedRageDamageBonus = 0,
  rageActive = false,
  embeddedStats = false,
  showStats = true,
  showActions = true,
  exhaustion = 0,
  reactionUsed = false,
  onToggleReaction = null,
  incapacitated = false,
}: CharacterCombatPanelsProps) {
  const exhaustionPenalty = getExhaustionD20Penalty(exhaustion);
  const displaySpeed = getExhaustedSpeed(speed, exhaustion);
  const speedAccent = exhaustion >= 6 ? "#dc2626" : exhaustion > 0 ? "#f59e0b" : undefined;
  const attackDisadvantage = nonProficientArmorPenalty || hasDisadvantage;
  const actionItems = inventory.filter((it) => getEquipState(it) !== "backpack" && isWeaponItem(it) && (!it.attunement || it.attuned));
  const heldShield = inventory.some((it) =>
    getEquipState(it) !== "backpack"
    && isShieldItem(it)
    && (!it.attunement || it.attuned)
  );
  const nonProficientArmorItems = inventory.filter((it) => getEquipState(it) !== "backpack" && (isShieldItem(it) || /\barmor\b/i.test(it.type ?? "")) && !hasArmorProficiency(it, prof ?? undefined));
  const strMod = abilityMod(strScore);
  const dexMod = abilityMod(dexScore);
  const unarmedAbilityOverride = deriveAttackAbilityOverrideFromEffects(parsedFeatureEffects ?? [], { raging: rageActive, isUnarmed: true });
  const unarmedAttackAbilityMod = unarmedAbilityOverride === "dex" ? dexMod : strMod;
  const unarmedDamageDice = deriveAttackDamageDiceOverrideFromEffects(parsedFeatureEffects ?? [], {
    level,
    scores: { str: strScore, dex: dexScore },
    raging: rageActive,
    isUnarmed: true,
    noWeaponOrShield: actionItems.length === 0 && !heldShield,
  });
  const unarmedAttackRollBonus = deriveAttackRollBonusFromEffects(parsedFeatureEffects ?? [], {
    level,
    scores: { str: strScore, dex: dexScore },
    raging: rageActive,
    item: null,
  });
  const unarmedToHit = unarmedAttackAbilityMod + pb + unarmedAttackRollBonus - exhaustionPenalty;
  const unarmedDamageBonus = unarmedAttackAbilityMod + (rageActive ? unarmedRageDamageBonus : 0);
  const unarmedDmg = unarmedDamageDice
    ? `${unarmedDamageDice}${unarmedDamageBonus === 0 ? "" : `${unarmedDamageBonus >= 0 ? "+" : ""}${unarmedDamageBonus}`}`
    : String(1 + unarmedDamageBonus);
  const isRogue = /rogue/i.test(String(className ?? ""));
  const sneakAttackDice = Math.max(1, Math.ceil(level / 2));

  function weaponUsesStrength(item: InventoryItem): boolean {
    if (isRangedWeapon(item)) return false;
    if (hasItemProperty(item, "F")) return strMod >= dexMod;
    return true;
  }

  function splitDamageDiceBonus(value: string | null | undefined): { dice: string; bonus: number } | null {
    const raw = String(value ?? "").trim();
    if (!raw) return null;
    const match = raw.match(/^(.+?)([+-]\d+)\s*$/);
    if (!match) return { dice: raw, bonus: 0 };
    return {
      dice: match[1].trim(),
      bonus: Number(match[2]) || 0,
    };
  }

  return (
    <>
      {showStats && <CollapsiblePanel
        title="Combat Stats"
        color={accentColor}
        storageKey="combat-stats"
        summary={`AC ${effectiveAc} · Init ${formatModifier(initiativeBonus)} · ${displaySpeed} ft${exhaustion > 0 ? " (exhausted)" : ""} · PP ${passivePerc}`}
        embedded={embeddedStats}
      >
        <div style={{ display: "flex", borderRadius: 10, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)", overflow: "hidden" }}>
          {([
            { label: "Armor Class", value: String(effectiveAc), icon: <IconShield size={13} />, accent: accentColor },
            { label: "Speed",       value: `${displaySpeed} ft`,          icon: <IconSpeed size={13} />, accent: speedAccent },
            { label: "Initiative",  value: formatModifier(initiativeBonus), icon: <IconInitiative size={13} />, accent: accentColor },
            { label: "Proficiency", value: `+${pb}`,               accent: accentColor },
            { label: "Passive Perc.", value: String(passivePerc) },
          ] as Array<{ label: string; value: string; icon?: React.ReactNode; accent?: string }>).map(({ label, value, icon, accent }, i, arr) => (
            <div key={i} style={{ flex: 1, textAlign: "center", padding: "8px 6px", borderRight: i < arr.length - 1 ? "1px solid rgba(255,255,255,0.07)" : undefined }}>
              <div style={{ fontSize: "var(--fs-tiny)", fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 4 }}>{label}</div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 5, fontSize: "var(--fs-body)", fontWeight: 800, color: accent ?? C.text }}>
                {icon}
                {value}
              </div>
            </div>
          ))}
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
      </CollapsiblePanel>}

      {showActions && <CollapsiblePanel
        title="Actions"
        color={accentColor}
        storageKey="actions"
        summary={`${actionItems.length + 1} attack${actionItems.length === 0 ? "" : "s"}`}
      >
        {onToggleReaction ? (
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 10 }}>
            <button
              type="button"
              disabled={incapacitated}
              onClick={() => { if (!incapacitated) onToggleReaction(); }}
              title={incapacitated ? "Reaction unavailable while incapacitated" : reactionUsed ? "Reaction used — click to restore" : "Reaction available — click to mark used"}
              style={{
                all: "unset",
                cursor: incapacitated ? "not-allowed" : "pointer",
                padding: "1px 6px",
                borderRadius: 999,
                fontSize: "var(--fs-tiny)",
                fontWeight: 900,
                border: `1px solid ${reactionUsed ? C.muted : "#ff8c42"}`,
                color: reactionUsed ? C.muted : "#ff8c42",
                background: reactionUsed ? "transparent" : "rgba(255,140,66,0.094)",
                opacity: incapacitated || reactionUsed ? 0.5 : 1,
                transition: "all 150ms ease",
              }}
            >
              ⚡R
            </button>
          </div>
        ) : null}
        {incapacitated ? (
          <div style={{ marginBottom: 10, color: C.colorPinkRed, fontSize: "var(--fs-small)", fontWeight: 800 }}>
            Incapacitated — actions and reactions are unavailable.
          </div>
        ) : null}
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
            const ability = weaponAbilityMod(it, { strScore, dexScore }, parsedFeatureEffects);
            const proficient = hasWeaponProficiency(it, prof ?? undefined);
            const mastery = parseWeaponMastery(it);
            const masteryKnown = hasWeaponMastery(it, prof ?? undefined);
            const masteryName = masteryKnown ? (mastery?.name ?? getWeaponMasteryName(it)) : null;
            const linkedAmmo = isRangedWeapon(it) && it.linkedAmmoId ? inventory.find((entry) => entry.id === it.linkedAmmoId) ?? null : null;
            const magicBonus = parseMagicBonus(it) + (linkedAmmo ? parseMagicBonus(linkedAmmo) : 0);
            const featureAttackRollBonus = deriveAttackRollBonusFromEffects(parsedFeatureEffects ?? [], {
              level,
              scores: { str: strScore, dex: dexScore },
              raging: rageActive,
              item: it,
            });
            const toHit = ability + (proficient ? pb : 0) + magicBonus + featureAttackRollBonus - exhaustionPenalty;
            const damageAbility = attackState === "offhand" && !addsAbilityModToOffhandDamage(it, parsedFeatureEffects) ? 0 : ability;
            const rageBonus = rageActive && weaponUsesStrength(it) ? rageDamageBonus : 0;
            const featureDamageBonus = deriveAttackDamageBonusFromEffects(parsedFeatureEffects ?? [], {
              level,
              scores: { str: strScore, dex: dexScore },
              // Rage is added separately above to avoid double-counting.
              raging: false,
              isWeapon: true,
              attackAbility: weaponUsesStrength(it) ? "str" : "dex",
              item: it,
              hasOtherWeapon: actionItems.some((other) => other.id !== it.id),
            });
            const damageType = formatItemDamageType(it.dmgType);
            const props = formatItemProperties(it.properties);
            const isReach = hasItemProperty(it, "R");
            const rangeLabel = isRangedWeapon(it) ? (it.properties?.find((p) => /^\d/.test(p)) ?? "Range") : `${isReach ? "10" : "5"} ft.`;
            const parsedDmg = splitDamageDiceBonus(dmg);
            const totalFlatBonus = damageAbility + rageBonus + featureDamageBonus + magicBonus + (parsedDmg?.bonus ?? 0);
            const flatBonusText = totalFlatBonus === 0 ? "" : `${totalFlatBonus >= 0 ? "+" : ""}${totalFlatBonus}`;
            const dmgText = parsedDmg ? `${parsedDmg.dice}${flatBonusText}${damageType ? ` ${damageType}` : ""}` : "-";
            const modeLabel = attackState === "mainhand-2h" ? "2H" : attackState === "offhand" ? "Offhand" : null;

            return (
              <div key={`${it.id}:${attackState}`} style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) auto auto minmax(0,1fr)", gap: "0 8px", alignItems: "center", padding: "6px 0", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                    <span style={{ fontSize: "var(--fs-subtitle)", fontWeight: 800, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.name}</span>
                    {modeLabel && <span style={{ fontSize: "var(--fs-tiny)", fontWeight: 800, color: accentColor, border: `1px solid ${accentColor}44`, background: `${accentColor}18`, borderRadius: 999, padding: "1px 5px" }}>{modeLabel}</span>}
                    {masteryName && <Tooltip text={mastery?.text ?? `Weapon Mastery: ${masteryName}`} multiline><span style={{ fontSize: "var(--fs-tiny)", fontWeight: 800, color: C.colorGold, border: "1px solid rgba(251,191,36,0.35)", background: "rgba(251,191,36,0.12)", borderRadius: 999, padding: "1px 5px", cursor: "help" }}>{masteryName}</span></Tooltip>}
                    {linkedAmmo && <span title={`Loaded ammunition: ${linkedAmmo.name}`} style={{ fontSize: "var(--fs-tiny)", fontWeight: 800, color: "#34d399", border: "1px solid rgba(52,211,153,0.4)", background: "rgba(52,211,153,0.12)", borderRadius: 999, padding: "1px 5px" }}>{linkedAmmo.name}</span>}
                    {!proficient && <span style={{ fontSize: "var(--fs-tiny)", color: C.red, fontWeight: 700 }}>No proficiency</span>}
                    {attackDisadvantage && <span style={{ fontSize: "var(--fs-tiny)", color: C.colorPinkRed, fontWeight: 700 }}>D</span>}
                  </div>
                  <div style={{ fontSize: "var(--fs-tiny)", color: C.muted }}>{isWeaponItem(it) ? (isRangedWeapon(it) ? "Ranged Weapon" : "Melee Weapon") : it.type ?? ""}</div>
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
