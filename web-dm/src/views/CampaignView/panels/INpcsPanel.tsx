import React from "react";
import { useNavigate } from "react-router-dom";
import { Panel } from "@/ui/Panel";
import { IconButton } from "@/ui/IconButton";
import { theme } from "@/theme/theme";
import { IconBinder, IconINPC, IconPlus } from "@/icons";
import { PlayerRow } from "@/views/CampaignView/components/PlayerRow";
import { MonsterPickerModal } from "@/views/CampaignView/monsterPicker/MonsterPickerModal";
import type { AddMonsterOptions, INpc } from "@/domain/types/domain";
import { titleCase } from "@beholden/shared/domain/text/titleCase";
import { Modal } from "@/components/overlay/Modal";
import { Input } from "@/ui/Input";
import { api, jsonInit } from "@/services/api";
import { createBinderMortal, fetchBinderMortals, fetchMortalOptions, uploadBinderMortalImage, type BinderMortal, type BinderMortalInput, type MortalOptions } from "@/services/binderMortalApi";
import { MortalRecordModal } from "@/views/BinderView/MortalRecordModal";

type Props = {
  inpcs: INpc[];
  selectedCampaignId: string | null;
  binderId?: string | null;
  currentDate?: number | null;
  selectedEncounterId: string | null;

  onAddINpcFromMonster: (monsterId: string, qty: number, opts?: AddMonsterOptions) => void;
  onEditINpc: (inpcId: string) => void;
  onDeleteINpc: (inpcId: string) => void;
  onAddINpcToEncounter: (inpcId: string) => void;
};

export function INpcsPanel(props: Props) {
  const navigate = useNavigate();
  const [isPickerOpen, setIsPickerOpen] = React.useState(false);
  const [binderChoiceOpen, setBinderChoiceOpen] = React.useState(false);
  const [importOpen, setImportOpen] = React.useState(false);
  const [createOpen, setCreateOpen] = React.useState(false);
  const [mortals, setMortals] = React.useState<BinderMortal[]>([]);
  const [mortalOptions, setMortalOptions] = React.useState<MortalOptions>({ records: [], players: [], monsters: [] });
  const [query, setQuery] = React.useState("");
  const addMenuRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!binderChoiceOpen) return;
    const close = (event: MouseEvent) => {
      if (!addMenuRef.current?.contains(event.target as Node)) setBinderChoiceOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [binderChoiceOpen]);

  const loadBinderNpcData = React.useCallback(async () => {
    if (!props.binderId) return;
    const [rows, options] = await Promise.all([
      fetchBinderMortals(props.binderId),
      fetchMortalOptions(props.binderId),
    ]);
    setMortals(rows.filter((row) => row.mortalType === "npc" && Boolean(row.monsterId) && !props.inpcs.some((inpc) => inpc.binderMortalId === row.id)));
    setMortalOptions(options);
  }, [props.binderId, props.inpcs]);

  async function importMortal(mortalId: string) {
    if (!props.selectedCampaignId) return;
    await api(`/api/campaigns/${props.selectedCampaignId}/inpcs/from-binder`, jsonInit("POST", { mortalId }));
    setImportOpen(false);
  }

  async function createAndImport(input: BinderMortalInput, image: File | null) {
    if (!props.binderId || !props.selectedCampaignId) return;
    const created = await createBinderMortal(props.binderId, { ...input, mortalType: "npc" });
    if (image) await uploadBinderMortalImage(props.binderId, created.id, image);
    await importMortal(created.id);
    setCreateOpen(false);
  }

  function beginAdd() {
    if (!props.binderId) {
      setIsPickerOpen(true);
      return;
    }
    void loadBinderNpcData();
    setBinderChoiceOpen((open) => !open);
  }

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
        <div ref={addMenuRef} style={{ position: "relative" }}>
          <IconButton title="Add Important NPC" onClick={beginAdd} disabled={!props.selectedCampaignId} variant="accent">
            <IconPlus />
          </IconButton>
          {binderChoiceOpen ? <div style={{
            position: "absolute",
            zIndex: 240,
            top: "calc(100% + 7px)",
            right: 0,
            width: 230,
            padding: 6,
            border: `1px solid ${theme.colors.panelBorder}`,
            borderRadius: theme.radius.control,
            background: "#0d1525",
            boxShadow: "0 14px 32px rgba(0,0,0,.7)",
          }}>
            <button type="button" onClick={() => { setBinderChoiceOpen(false); setImportOpen(true); }} style={addMenuItemStyle}>
              Import from Binder
            </button>
            <button type="button" onClick={() => { setBinderChoiceOpen(false); setCreateOpen(true); }} style={addMenuItemStyle}>
              Create new Mortal
            </button>
          </div> : null}
        </div>
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
                  (i.binderMortalId && props.binderId) || props.selectedEncounterId ? (
                    <div style={{ display: "flex", gap: 4 }}>
                      {i.binderMortalId && props.binderId ? (
                        <IconButton
                          title="Open in Binder"
                          onClick={(e) => (e.stopPropagation(), navigate(`/binder/${props.binderId}/mortals/${i.binderMortalId}`))}
                          variant="ghost"
                          size="sm"
                        >
                          <IconBinder />
                        </IconButton>
                      ) : null}
                      {props.selectedEncounterId ? (
                        <IconButton
                          title="Add to Encounter"
                          onClick={(e) => (e.stopPropagation(), props.onAddINpcToEncounter(i.id))}
                          variant="ghost"
                          size="sm"
                        >
                          <IconPlus />
                        </IconButton>
                      ) : null}
                    </div>
                  ) : null
                }
                menuItems={[
                  { label: "Edit iNPC", onClick: () => props.onEditINpc(i.id) },
                  ...(i.binderMortalId && props.binderId
                    ? [{ label: "Binder", onClick: () => navigate(`/binder/${props.binderId}/mortals/${i.binderMortalId}`) }]
                    : []),
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
        onAddMonster={(monsterId, qty, opts) => {
          props.onAddINpcFromMonster(monsterId, qty, opts);
          setIsPickerOpen(false);
        }}
      />
      <Modal isOpen={importOpen} onClose={() => setImportOpen(false)} title="Import from Binder" width={560} height="auto">
        <div style={{ display: "grid", gap: 10 }}>
          <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search Binder NPCs…" autoFocus />
          <div style={{ display: "grid", gap: 6, maxHeight: 420, overflowY: "auto" }}>
            {mortals.filter((row) => row.name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())).map((row) => (
              <button key={row.id} type="button" onClick={() => void importMortal(row.id)} style={{ padding: "11px 13px", border: `1px solid ${theme.colors.panelBorder}`, borderRadius: theme.radius.control, background: theme.colors.inputBg, color: theme.colors.text, textAlign: "left", cursor: "pointer", font: "inherit", fontWeight: 700 }}>
                {row.name}
              </button>
            ))}
            {!mortals.length ? <div style={{ color: theme.colors.muted, padding: 8 }}>Every Binder NPC is already in this campaign, or the Binder has no NPCs yet.</div> : null}
          </div>
        </div>
      </Modal>
      <MortalRecordModal
        isOpen={createOpen}
        record={null}
        binderCurrentDate={props.currentDate ?? null}
        options={mortalOptions}
        requireNpcStatblock
        onClose={() => setCreateOpen(false)}
        onSave={createAndImport}
      />
    </Panel>
  );
}

const addMenuItemStyle: React.CSSProperties = {
  display: "block",
  width: "100%",
  padding: "12px 14px",
  border: 0,
  borderRadius: 7,
  background: "transparent",
  color: theme.colors.text,
  textAlign: "left",
  cursor: "pointer",
  font: "inherit",
  fontSize: "18px",
  fontWeight: 700,
};
