import React from "react";
import { CollectionRow, QuantityStepper, Tag } from "@beholden/shared/ui";
import { IconPlayer, IconPlus } from "@/icons";
import { useStore } from "@/store";
import { theme } from "@/theme/theme";
import { IconButton } from "@/ui/IconButton";
import { Panel } from "@/ui/Panel";
import { ItemPickerModal } from "@/views/CampaignView/components/ItemPickerModal";
import { RarityDot } from "@/views/CampaignView/components/ItemPickerModalParts";
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
              <CollectionRow
                key={t.id}
                onClick={() =>
                  dispatch({
                    type: "openDrawer",
                    drawer: { type: "viewTreasure", treasureId: t.id, title: t.name },
                  })
                }
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
                  <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
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
      </Panel>

      <ItemPickerModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        onAdd={(payload) => { void addItem(payload).then(() => setIsOpen(false)); }}
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
