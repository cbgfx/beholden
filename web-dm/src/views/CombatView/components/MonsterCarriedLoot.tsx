import * as React from "react";
import { CollectionRow, QuantityStepper, Tag } from "@beholden/shared/ui";
import { theme } from "@/theme/theme";
import { IconButton } from "@/ui/IconButton";
import { IconPlayer, IconPlus } from "@/icons";
import type { CampaignCharacter, EncounterActor } from "@/domain/types/domain";
import type { MonsterDetail } from "@/domain/types/compendium";
import { ItemPickerModal } from "@/views/CampaignView/components/ItemPickerModal";
import { RarityDot } from "@/views/CampaignView/components/ItemPickerModalParts";
import { AwardTreasureModal } from "@/components/treasure/AwardTreasureModal";
import { useTreasurePool } from "@/components/treasure/useTreasurePool";

const LOOT_MONSTER_TYPES = new Set(["monster", "inpc"]);

export function MonsterCarriedLoot(props: {
  encounterId: string;
  orderedCombatants: EncounterActor[];
  monsterCache: Record<string, MonsterDetail>;
  resolveMonsterId: (c: EncounterActor | null) => string | null;
  ensureMonster: (id: string) => Promise<void>;
  players: CampaignCharacter[];
}) {
  const { encounterId, orderedCombatants, monsterCache, resolveMonsterId, ensureMonster, players } = props;

  const monsterIds = React.useMemo(() => {
    const ids = new Set<string>();
    for (const c of orderedCombatants) {
      if (!LOOT_MONSTER_TYPES.has(c.baseType)) continue;
      const id = resolveMonsterId(c);
      if (id) ids.add(id);
    }
    return Array.from(ids);
  }, [orderedCombatants, resolveMonsterId]);

  React.useEffect(() => {
    for (const id of monsterIds) void ensureMonster(id);
  }, [monsterIds, ensureMonster]);

  const lootHints = React.useMemo(() => {
    const counts = new Map<string, number>();
    for (const c of orderedCombatants) {
      if (!LOOT_MONSTER_TYPES.has(c.baseType)) continue;
      const id = resolveMonsterId(c);
      if (!id) continue;
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .map(([id, count]) => ({ id, count, monster: monsterCache[id] }))
      .filter((entry): entry is { id: string; count: number; monster: MonsterDetail } =>
        Boolean(entry.monster?.treasure))
      .sort((a, b) => a.monster.name.localeCompare(b.monster.name));
  }, [orderedCombatants, resolveMonsterId, monsterCache]);

  const {
    treasure, addItem, remove, updateQty, award,
    awardTreasure, setAwardTreasure, awardBusy, awardError, setAwardError,
  } = useTreasurePool({ level: "encounter", encounterId });
  const [pickerOpen, setPickerOpen] = React.useState(false);

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div>
        <div style={{ fontWeight: 800, color: theme.colors.muted, fontSize: "var(--fs-tiny)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>
          Monster Carried Loot
        </div>
        {lootHints.length === 0 ? (
          <div style={{ color: theme.colors.muted, fontSize: "var(--fs-small)" }}>
            No treasure hints for the monsters in this encounter.
          </div>
        ) : (
          <div style={{ display: "grid", gap: 8, maxHeight: 160, overflowY: "auto" }}>
            {lootHints.map(({ id, count, monster }) => (
              <div key={id} style={{ padding: "8px 10px", borderRadius: 8, background: "rgba(255,255,255,0.04)", border: `1px solid ${theme.colors.panelBorder}` }}>
                <div style={{ fontWeight: 700, color: theme.colors.text, fontSize: "var(--fs-small)" }}>
                  {monster.name}{count > 1 ? ` ×${count}` : ""}
                </div>
                <div style={{ color: theme.colors.muted, fontSize: "var(--fs-tiny)", marginTop: 2, whiteSpace: "pre-wrap" }}>
                  {monster.treasure}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <span style={{ fontWeight: 800, color: theme.colors.muted, fontSize: "var(--fs-tiny)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Encounter Treasure
          </span>
          <IconButton title="Add item" onClick={() => setPickerOpen(true)} variant="accent" size="sm">
            <IconPlus />
          </IconButton>
        </div>
        {treasure.length === 0 ? (
          <div style={{ color: theme.colors.muted, fontSize: "var(--fs-small)" }}>No treasure yet.</div>
        ) : (
          <div style={{ maxHeight: 220, overflowY: "auto" }}>
            {treasure.map((t) => (
              <CollectionRow
                key={t.id}
                borderColor={theme.colors.panelBorder}
                padding="6px 4px"
                main={(
                  <>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 700, fontSize: "var(--fs-subtitle)", color: theme.colors.text }}>
                      {t.rarity ? <RarityDot rarity={t.rarity} /> : null}
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}>{t.name}</span>
                      {t.magic ? <Tag label="Magic" color={theme.colors.colorMagic} /> : null}
                    </div>
                    {[t.rarity, t.type, t.attunement ? "attunement" : null].filter(Boolean).length > 0 ? (
                      <div style={{ color: theme.colors.muted, fontSize: "var(--fs-tiny)", marginTop: 1 }}>
                        {[t.rarity, t.type, t.attunement ? "attunement" : null].filter(Boolean).join(" • ")}
                      </div>
                    ) : null}
                  </>
                )}
                trailing={(
                  <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
                    <IconButton
                      title="Award to player"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setAwardError(null);
                        setAwardTreasure(t);
                      }}
                    >
                      <IconPlayer size={15} />
                    </IconButton>
                    <QuantityStepper
                      value={(t.qty ?? 1) > 1 ? t.qty : null}
                      valuePrefix="x"
                      onDecrement={(t.qty ?? 1) > 1 ? () => updateQty(t.id, Math.max(1, (t.qty ?? 1) - 1)) : undefined}
                      decrementDisabled={(t.qty ?? 1) <= 1}
                      onIncrement={() => updateQty(t.id, (t.qty ?? 1) + 1)}
                      theme={{
                        buttonBackground: "rgba(255,255,255,0.05)",
                        buttonBorder: "rgba(255,255,255,0.12)",
                        buttonColor: "rgba(255,255,255,0.7)",
                        valueColor: theme.colors.muted,
                        buttonSize: 22,
                        borderRadius: 6,
                        fontSize: "var(--fs-body)",
                        valueMinWidth: 18,
                      }}
                    />
                    <button
                      type="button"
                      title="Remove"
                      onClick={() => remove(t.id)}
                      style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(248,113,113,0.55)", fontSize: 16, padding: "0 2px", lineHeight: 1 }}
                    >
                      ×
                    </button>
                  </div>
                )}
              />
            ))}
          </div>
        )}
      </div>

      <ItemPickerModal
        isOpen={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onAdd={(payload) => { void addItem(payload).then(() => setPickerOpen(false)); }}
      />
      <AwardTreasureModal
        treasure={awardTreasure}
        players={players}
        busy={awardBusy}
        error={awardError}
        onClose={() => {
          if (awardBusy) return;
          setAwardTreasure(null);
          setAwardError(null);
        }}
        onAward={(playerId, quantity) => void award(playerId, quantity)}
      />
    </div>
  );
}
