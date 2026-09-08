import React from "react";
import { TreasureRow } from "@/components/treasure/TreasureRow";
import { IconPlus } from "@/icons";
import { useStore } from "@/store";
import { theme } from "@/theme/theme";
import { IconButton } from "@/ui/IconButton";
import { Panel } from "@/ui/Panel";
import { ItemPickerModal } from "@/views/CampaignView/components/ItemPickerModal";
import { AwardTreasureModal } from "@/components/treasure/AwardTreasureModal";
import { useTreasurePool, type TreasureScope } from "@/components/treasure/useTreasurePool";

function titleFromScope(opts: {
  encounterName?: string | null;
  isEncounter: boolean;
  selectedAdventureId: string | null;
  adventureName?: string | null;
}) {
  if (opts.isEncounter) return `Treasure (${opts.encounterName ?? "Encounter"})`;
  if (!opts.selectedAdventureId) return "Treasure (Campaign)";
  return opts.adventureName ? `Treasure (${opts.adventureName})` : "Treasure (Adventure)";
}

export function TreasurePanel(props: { encounterId?: string } = {}) {
  const { state, dispatch } = useStore();
  const [isOpen, setIsOpen] = React.useState(false);

  const scopeAdventureId = state.selectedAdventureId;
  const scope: TreasureScope = props.encounterId
    ? { level: "encounter", encounterId: props.encounterId }
    : scopeAdventureId
      ? { level: "adventure", adventureId: scopeAdventureId }
      : { level: "campaign" };

  const {
    treasure, addItem, remove, updateQty, award,
    awardTreasure, setAwardTreasure, awardBusy, awardError, setAwardError,
  } = useTreasurePool(scope);

  const scopeAdventureName = React.useMemo(() => {
    if (!scopeAdventureId) return null;
    return state.adventures.find((a) => a.id === scopeAdventureId)?.name ?? null;
  }, [scopeAdventureId, state.adventures]);

  const encounterName = React.useMemo(() => {
    if (!props.encounterId) return null;
    return state.encounters.find((e) => e.id === props.encounterId)?.name ?? null;
  }, [props.encounterId, state.encounters]);

  return (
    <>
      <Panel
        storageKey="treasure"
        title={titleFromScope({
          isEncounter: scope.level === "encounter",
          encounterName,
          selectedAdventureId: scopeAdventureId,
          adventureName: scopeAdventureName,
        })}
        actions={(
          <IconButton title="Add item" onClick={() => setIsOpen(true)} variant="accent">
            <IconPlus />
          </IconButton>
        )}
      >
        {treasure.length === 0 ? (
          <div style={{ color: theme.colors.muted }}>No treasure yet.</div>
        ) : (
          <div style={{ maxHeight: 340, overflowY: "auto" }}>
            {treasure.map((t) => (
              <TreasureRow
                key={t.id}
                item={t}
                onClick={() => dispatch({ type: "openDrawer", drawer: { type: "viewTreasure", treasureId: t.id, title: t.name } })}
                onAward={() => { setAwardError(null); setAwardTreasure(t); }}
                updateQty={updateQty}
                remove={remove}
              />
            ))}
          </div>
        )}
      </Panel>

      <ItemPickerModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        onAdd={(payload) => { void addItem(payload); }}
      />
      <AwardTreasureModal
        treasure={awardTreasure}
        players={state.players}
        busy={awardBusy}
        error={awardError}
        onClose={() => {
          if (awardBusy) return;
          setAwardTreasure(null);
          setAwardError(null);
        }}
        onAward={(playerId, quantity) => void award(playerId, quantity)}
      />
    </>
  );
}
