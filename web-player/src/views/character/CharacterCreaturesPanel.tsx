import React, { useEffect, useMemo, useState } from "react";
import { C } from "@/lib/theme";
import { CharacterCreatureDrawer } from "@/views/character/CharacterCreatureDrawer";
import { CharacterCreaturePickerModal } from "@/views/character/CharacterCreaturePickerModal";
import { useCompendiumMonster } from "@/views/character/CharacterCompendiumMonsterHooks";
import { creatureAcPill, creatureHpPill, creatureRoundPill, formatCreatureMonsterSource } from "@/views/character/CharacterCreaturesHelpers";
import { CollapsiblePanel, panelHeaderAddBtn } from "@/views/character/CharacterViewParts";
import type { CharacterCreature, CharacterData } from "@/views/character/CharacterSheetTypes";

export function CharacterCreaturesPanel(props: {
  charData: CharacterData | null;
  accentColor: string;
  onSave: (data: CharacterData) => Promise<unknown>;
}) {
  const [creatures, setCreatures] = useState<CharacterCreature[]>(() => props.charData?.creatures ?? []);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [selectedCreatureId, setSelectedCreatureId] = useState<string | null>(null);

  useEffect(() => {
    setCreatures(props.charData?.creatures ?? []);
  }, [props.charData?.creatures]);

  useEffect(() => {
    if (!selectedCreatureId) return;
    if (!creatures.some((creature) => creature.id === selectedCreatureId)) {
      setSelectedCreatureId(null);
    }
  }, [creatures, selectedCreatureId]);

  const selectedCreature = useMemo(
    () => creatures.find((creature) => creature.id === selectedCreatureId) ?? null,
    [creatures, selectedCreatureId]
  );

  const selectedMonsterState = useCompendiumMonster(selectedCreature?.monsterId, "Failed to load creature details.");

  async function persist(nextCreatures: CharacterCreature[]) {
    setCreatures(nextCreatures);
    await props.onSave({ creatures: nextCreatures });
  }

  function adjustCreatureHp(creatureId: string, delta: number) {
    const nextCreatures = creatures.map((creature) => {
      if (creature.id !== creatureId) return creature;
      return {
        ...creature,
        hpCurrent: Math.max(0, Math.min(creature.hpMax, creature.hpCurrent + delta)),
      };
    });
    void persist(nextCreatures);
  }

  const orderedCreatures = useMemo(
    () => [...creatures].sort((a, b) => a.name.localeCompare(b.name)),
    [creatures]
  );

  return (
    <>
      <CollapsiblePanel
        title={<>Creatures ({creatures.length})</>}
        color={props.accentColor}
        storageKey="creatures"
        actions={
          <button type="button" onClick={() => setPickerOpen(true)} style={panelHeaderAddBtn(props.accentColor)} title="Add creature">
            +
          </button>
        }
      >
        {orderedCreatures.length === 0 ? (
          <div style={{ color: C.muted, fontSize: "var(--fs-small)", lineHeight: 1.6 }}>
            No creatures yet. Add companions, familiars, summons, pact creatures, ranger pets, or any other party creature from the compendium.
          </div>
        ) : (
          <div style={{ display: "grid", gap: 8 }}>
            {orderedCreatures.map((creature) => {
              const sourceLabel = formatCreatureMonsterSource(creature.monsterId);
              return (
                <button
                  key={creature.id}
                  type="button"
                  onClick={() => setSelectedCreatureId(creature.id)}
                  style={{
                    width: "100%",
                    textAlign: "left",
                    border: `1px solid ${C.panelBorder}`,
                    background: C.panelBg,
                    borderRadius: 12,
                    padding: "12px 14px",
                    display: "grid",
                    gap: 8,
                    cursor: "pointer",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontWeight: 900, fontSize: "var(--fs-medium)", color: C.text }}>
                        {creature.name}
                      </div>
                      <div style={{ color: C.muted, fontSize: "var(--fs-small)" }}>
                        {[creature.label?.trim() || null, sourceLabel, creature.friendly ? "Friendly" : "Neutral/Hostile"].filter(Boolean).join(" • ")}
                      </div>
                    </div>
                    <div style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          adjustCreatureHp(creature.id, -1);
                        }}
                        title="Take 1 damage"
                        style={creatureRoundPill(C.muted)}
                      >
                        -
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          adjustCreatureHp(creature.id, 1);
                        }}
                        title="Heal 1 HP"
                        style={creatureRoundPill(C.muted)}
                      >
                        +
                      </button>
                    </div>
                    <span style={creatureHpPill(creature.hpCurrent, creature.hpMax)}>
                      HP {creature.hpCurrent}/{creature.hpMax}
                    </span>
                    <span style={creatureAcPill(props.accentColor)}>
                      AC {creature.ac}
                    </span>
                  </div>
                  {creature.notes?.trim() ? (
                    <div style={{ color: C.muted, fontSize: "var(--fs-small)", lineHeight: 1.45 }}>
                      {creature.notes.trim()}
                    </div>
                  ) : null}
                </button>
              );
            })}
          </div>
        )}
      </CollapsiblePanel>

      <CharacterCreaturePickerModal
        isOpen={pickerOpen}
        accentColor={props.accentColor}
        onClose={() => setPickerOpen(false)}
        onAdd={(creature) => {
          const nextCreatures = [...creatures, creature];
          void persist(nextCreatures);
          setPickerOpen(false);
          setSelectedCreatureId(creature.id);
        }}
      />

      <CharacterCreatureDrawer
        creature={selectedCreature}
        monster={selectedMonsterState.monster}
        busy={selectedMonsterState.busy}
        error={selectedMonsterState.error}
        accentColor={props.accentColor}
        onClose={() => setSelectedCreatureId(null)}
        onSave={(nextCreature) => {
          const nextCreatures = creatures.map((creature) => creature.id === nextCreature.id ? nextCreature : creature);
          void persist(nextCreatures);
          setSelectedCreatureId(nextCreature.id);
        }}
        onDelete={(creatureId) => {
          const nextCreatures = creatures.filter((creature) => creature.id !== creatureId);
          void persist(nextCreatures);
          setSelectedCreatureId(null);
        }}
      />
    </>
  );
}
