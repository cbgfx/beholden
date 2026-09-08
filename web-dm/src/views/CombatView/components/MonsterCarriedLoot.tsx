import * as React from "react";
import { TreasureRow } from "@/components/treasure/TreasureRow";
import { theme } from "@/theme/theme";
import { IconButton } from "@/ui/IconButton";
import { IconPlus } from "@/icons";
import type { CampaignCharacter, EncounterActor } from "@/domain/types/domain";
import type { MonsterDetail } from "@/domain/types/compendium";
import { ItemPickerModal } from "@/views/CampaignView/components/ItemPickerModal";
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
              <TreasureRow
                key={t.id}
                item={t}
                onAward={() => { setAwardError(null); setAwardTreasure(t); }}
                updateQty={updateQty}
                remove={remove}
              />
            ))}
          </div>
        )}
      </div>

      <ItemPickerModal
        isOpen={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onAdd={(payload) => { void addItem(payload); }}
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
