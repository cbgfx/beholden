import React from "react";
import { Panel } from "@/ui/Panel";
import { IconButton } from "@/ui/IconButton";
import { theme } from "@/theme/theme";
import { IconINPC, IconPlus } from "@/icons";
import { PlayerRow } from "@/views/CampaignView/components/PlayerRow";
import { MonsterPickerModal } from "@/views/CampaignView/monsterPicker/MonsterPickerModal";
import type { AddMonsterOptions, INpc } from "@/domain/types/domain";
import { titleCase } from "@/lib/format/titleCase";
import type { CompendiumMonsterRow } from "@/views/CampaignView/monsterPicker/types";

type Props = {
  inpcs: INpc[];
  selectedCampaignId: string | null;
  selectedEncounterId: string | null;

  compQ: string;
  onChangeCompQ: (q: string) => void;
  compRows?: CompendiumMonsterRow[];

  onAddINpcFromMonster: (monsterId: string, qty: number, opts?: AddMonsterOptions) => void;
  onEditINpc: (inpcId: string) => void;
  onDeleteINpc: (inpcId: string) => void;
  onAddINpcToEncounter: (inpcId: string) => void;
};

export function INpcsPanel(props: Props) {
  const [isPickerOpen, setIsPickerOpen] = React.useState(false);

  const sorted = React.useMemo(
    () => [...props.inpcs].sort((a, b) => a.name.localeCompare(b.name)),
    [props.inpcs]
  );

  const getMonsterKeyLabel = React.useCallback((monsterId?: string | null) => {
    if (!monsterId) return "";
    const key = monsterId.startsWith("m_") ? monsterId.slice(2) : monsterId;
    return titleCase(key.replace(/[_-]+/g, " ").trim());
  }, []);

  const useTwoColumn = Boolean(props.selectedEncounterId) && sorted.length > 4;

  return (
    <Panel
      storageKey="campaign-inpcs"
      title={`Important NPCs (${props.inpcs.length})`}
      actions={
        <IconButton title="Add iNPC" onClick={() => setIsPickerOpen(true)} disabled={!props.selectedCampaignId} variant="accent">
          <IconPlus />
        </IconButton>
      }
    >
      {sorted.length ? (
        <div
          style={{
            display: "grid",
            gap: 5,
            gridTemplateColumns: useTwoColumn ? "repeat(2, minmax(0, 1fr))" : "1fr"
          }}
        >
          {sorted.map((i) => {
            const monsterKeyLabel = getMonsterKeyLabel(i.monsterId);
            const subtitle = monsterKeyLabel
              ? <span style={{ opacity: 0.7 }}>{monsterKeyLabel}</span>
              : undefined;

            return (
              <PlayerRow
                key={i.id}
                p={{
                  id: i.id,
                  characterName: i.name,
                  level: 0,
                  class: "",
                  species: "",
                  hpMax: i.hpMax,
                  hpCurrent: i.hpCurrent,
                  ac: i.ac
                }}
                icon={
                  i.friendly
                    ? <span style={{ color: theme.colors.green }}><IconINPC /></span>
                    : <span style={{ color: theme.colors.red }}><IconINPC /></span>
                }
                subtitle={subtitle}
                primaryAction={
                  props.selectedEncounterId ? (
                    <IconButton
                      title="Add to Encounter"
                      onClick={(e) => (e.stopPropagation(), props.onAddINpcToEncounter(i.id))}
                      variant="ghost"
                      size="sm"
                    >
                      <IconPlus />
                    </IconButton>
                  ) : null
                }
                menuItems={[
                  { label: "Edit iNPC", onClick: () => props.onEditINpc(i.id) },
                  { label: "Delete iNPC", danger: true, onClick: () => props.onDeleteINpc(i.id) },
                ]}
              />
            );
          })}
        </div>
      ) : (
        <div style={{ color: theme.colors.muted }}>No iNPCs yet.</div>
      )}

      <MonsterPickerModal
        isOpen={isPickerOpen}
        onClose={() => setIsPickerOpen(false)}
        compQ={props.compQ}
        onChangeCompQ={props.onChangeCompQ}
        compRows={(props.compRows ?? []) as any}
        onAddMonster={(monsterId, qty, opts) => {
          props.onAddINpcFromMonster(monsterId, qty, opts);
          setIsPickerOpen(false);
        }}
      />
    </Panel>
  );
}
