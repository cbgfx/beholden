import React from "react";
import { Panel } from "@/ui/Panel";
import { IconButton } from "@/ui/IconButton";
import { theme } from "@/theme/theme";
import { IconINPC, IconPlus, IconPencil, IconTrash, IconEncounter } from "@/icons";
import { PlayerRow } from "@/views/CampaignView/components/PlayerRow";
import { MonsterPickerModal } from "@/views/CampaignView/monsterPicker/MonsterPickerModal";
import type { AddMonsterOptions, INpc } from "@/domain/types/domain";
import { titleCase } from "@/lib/format/titleCase";

type Props = {
  inpcs: INpc[];
  selectedCampaignId: string;
  selectedEncounterId: string | null;

  compQ: string;
  onChangeCompQ: (q: string) => void;
  compRows: any[];

  onAddINpcFromMonster: (monsterId: string, qty: number, opts?: AddMonsterOptions) => void;
  onEditINpc: (inpcId: string) => void;
  onDeleteINpc: (inpcId: string) => void;
  onAddINpcToEncounter: (inpcId: string) => void;
};

export function INpcsPanel(props: Props) {
  const [isPickerOpen, setIsPickerOpen] = React.useState(false);

  const getMonsterKeyLabel = React.useCallback((monsterId?: string | null) => {
    if (!monsterId) return "";
    // Compendium ids are typically "m_<name_key>". Showing the raw id is noisy.
    // Prefer the name_key portion when possible.
    const key = monsterId.startsWith("m_") ? monsterId.slice(2) : monsterId;
    return titleCase(key.replace(/[_-]+/g, " ").trim());
  }, []);

  const useTwoColumn = Boolean(props.selectedEncounterId) && props.inpcs.length > 4;

  return (
    <Panel
      title={
        <span style={{ display: "inline-flex", gap: 8, alignItems: "center" }}>
          <IconINPC /> Important NPCs ({props.inpcs.length})
        </span>
      }
      actions={
        <IconButton title="Add iNPC" onClick={() => setIsPickerOpen(true)} disabled={!props.selectedCampaignId}>
          <IconPlus />
        </IconButton>
      }
    >
      {props.inpcs.length ? (
        <div
          style={{
            display: "grid",
            gap: 5,
            gridTemplateColumns: useTwoColumn ? "repeat(2, minmax(0, 1fr))" : "1fr"
          }}
        >
          {props.inpcs.map((i) => {
            const monsterKeyLabel = getMonsterKeyLabel(i.monsterId);
            const subtitle = (
              <>
                {monsterKeyLabel ? <span style={{ opacity: 0.7 }}>{monsterKeyLabel}</span> : null}
              </>
            );

            const alreadyIn = false; // iNPCs can be added multiple times; each click makes a new combatant

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
                icon={i.friendly? (<span style={{ color: theme.colors.green }}><IconINPC /></span>): (<span style={{ color: theme.colors.red }}><IconINPC /></span>)}
                subtitle={subtitle}
                actions={
                  <>
                    <IconButton title="Edit" onClick={(e) => (e.stopPropagation(), props.onEditINpc(i.id))}>
                      <IconPencil />
                    </IconButton>
                    {props.selectedEncounterId ? (
                      <IconButton
                        title={alreadyIn ? "Already in encounter" : "Add to Encounter"}
                        onClick={(e) => (e.stopPropagation(), props.onAddINpcToEncounter(i.id))}
                      >
                        <IconPlus />
                      </IconButton>
                    ) : null}
                    <IconButton title="Delete" onClick={(e) => (e.stopPropagation(), props.onDeleteINpc(i.id))}>
                      <IconTrash />
                    </IconButton>
                  </>
                }
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
        compRows={props.compRows as any}
        onAddMonster={(monsterId, qty, opts) => {
          props.onAddINpcFromMonster(monsterId, qty, opts);
          setIsPickerOpen(false);
        }}
      />
    </Panel>
  );
}
