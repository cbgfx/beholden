import React from "react";
import { C } from "@/lib/theme";
import { IconWerewolf } from "@/icons";
import { DraggableList } from "@/ui/DraggableList";
import type { ClassFeatureEntry, PlayerNote, ResourceCounter } from "@/views/character/CharacterSheetTypes";
import {
  CollapsiblePanel,
  panelHeaderAddBtn,
  miniPillBtn,
  restBtnStyle,
  NoteItem,
  ClassFeatureItem,
} from "@/views/character/CharacterViewParts";

export function CharacterSupportPanels(props: {
  accentColor: string;
  hasCampaign: boolean;
  hitDiceCurrent: number;
  hitDiceMax: number;
  hitDieSize: number | null;
  hitDieConMod: number;
  featureHpMaxBonus: number;
  classResources: ResourceCounter[];
  playerNotesList: PlayerNote[];
  allSharedNotes: PlayerNote[];
  classFeaturesList: ClassFeatureEntry[];
  expandedNoteIds: string[];
  expandedClassFeatureIds: string[];
  onSaveHitDiceCurrent: (value: number) => Promise<void> | void;
  onShortRest: () => Promise<void> | void;
  onLongRest: () => Promise<void> | void;
  onFullRest: () => Promise<void> | void;
  onChangeResourceCurrent: (key: string, delta: number) => Promise<void> | void;
  onOpenPlayerNoteCreate: () => void;
  onOpenSharedNoteCreate: () => void;
  onToggleNoteExpanded: (id: string) => void;
  onToggleClassFeatureExpanded: (id: string) => void;
  onOpenPlayerNoteEdit: (note: PlayerNote) => void;
  onOpenSharedNoteEdit: (note: PlayerNote) => void;
  onDeletePlayerNote: (id: string) => void;
  onDeleteSharedNote: (id: string) => void;
  onSavePlayerNotesOrder: (list: PlayerNote[]) => void;
  onSaveSharedNotesOrder: (list: PlayerNote[]) => void;
  polymorphName?: string | null;
  onOpenTransformSelf: () => void;
  onRevertTransformSelf?: () => void;
}) {
  const {
    accentColor,
    hasCampaign,
    hitDiceCurrent,
    hitDiceMax,
    hitDieSize,
    hitDieConMod,
    featureHpMaxBonus,
    classResources,
    playerNotesList,
    allSharedNotes,
    classFeaturesList,
    expandedNoteIds,
    expandedClassFeatureIds,
    onSaveHitDiceCurrent,
    onShortRest,
    onLongRest,
    onFullRest,
    onChangeResourceCurrent,
    onOpenPlayerNoteCreate,
    onOpenSharedNoteCreate,
    onToggleNoteExpanded,
    onToggleClassFeatureExpanded,
    onOpenPlayerNoteEdit,
    onOpenSharedNoteEdit,
    onDeletePlayerNote,
    onDeleteSharedNote,
    onSavePlayerNotesOrder,
    onSaveSharedNotesOrder,
    polymorphName,
    onOpenTransformSelf,
    onRevertTransformSelf,
  } = props;

  const formatResetLabel = (reset: string): string => {
    const code = String(reset ?? "").trim().toUpperCase();
    if (code === "S") return "Resets on Short Rest";
    if (code === "L") return "Resets on Long Rest";
    if (code === "SL") return "Resets on Short or Long Rest";
    return `Reset ${reset}`;
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <CollapsiblePanel
        title="Upkeep"
        color={accentColor}
        storageKey="recovery"
        actions={
          <button
            type="button"
            onClick={onOpenTransformSelf}
            title="Transform Self"
            style={{
              ...panelHeaderAddBtn(accentColor),
              minWidth: 34,
              width: 34,
              height: 34,
              padding: 0,
              borderRadius: 999,
            }}
          >
            <IconWerewolf size={18} />
          </button>
        }
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {polymorphName && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 10,
                padding: "8px 10px",
                borderRadius: 8,
                background: `${accentColor}12`,
                border: `1px solid ${accentColor}44`,
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: "var(--fs-tiny)", fontWeight: 800, color: accentColor, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 2 }}>
                  Current Form
                </div>
                <div style={{ fontSize: "var(--fs-subtitle)", fontWeight: 800, color: C.text }}>
                  {polymorphName}
                </div>
              </div>
              {onRevertTransformSelf ? (
                <button
                  type="button"
                  onClick={onRevertTransformSelf}
                  style={{
                    ...panelHeaderAddBtn(accentColor),
                    padding: "6px 12px",
                    minWidth: "auto",
                    height: "auto",
                    borderRadius: 999,
                  }}
                >
                  Revert
                </button>
              ) : null}
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{
              padding: "10px 12px",
              borderRadius: 10,
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.08)",
            }}>
              <div style={{ fontSize: "var(--fs-tiny)", fontWeight: 800, color: C.muted, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 4 }}>
                Hit Dice
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, justifyContent: "space-between" }}>
                <div>
                  <div style={{ fontSize: "var(--fs-title)", fontWeight: 900, color: C.text }}>
                    {hitDiceCurrent} / {hitDiceMax}
                  </div>
                  {hitDieSize != null && (
                    <div style={{ fontSize: "var(--fs-small)", color: C.muted }}>
                      d{hitDieSize}{hitDieConMod >= 0 ? ` + ${hitDieConMod}` : ` - ${Math.abs(hitDieConMod)}`} per die
                    </div>
                  )}
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <button
                    type="button"
                    onClick={() => void onSaveHitDiceCurrent(hitDiceCurrent - 1)}
                    disabled={hitDiceCurrent <= 0}
                    style={miniPillBtn(hitDiceCurrent > 0)}
                  >
                    -
                  </button>
                  <button
                    type="button"
                    onClick={() => void onSaveHitDiceCurrent(hitDiceCurrent + 1)}
                    disabled={hitDiceCurrent >= hitDiceMax}
                    style={miniPillBtn(hitDiceCurrent < hitDiceMax)}
                  >
                    +
                  </button>
                </div>
              </div>
            </div>

            <div style={{ display: "flex", gap: 10 }}>
              <button type="button" onClick={() => void onShortRest()} style={{ ...restBtnStyle(C.colorRitual), flex: 1 }}>
                Short Rest
              </button>
              <button type="button" onClick={() => void onLongRest()} style={{ ...restBtnStyle("#34d399"), flex: 1 }}>
                Long Rest
              </button>
              <button type="button" onClick={() => void onFullRest()} style={{ ...restBtnStyle(accentColor), flex: 1 }}>
                Full Rest
              </button>
            </div>
          </div>

          {featureHpMaxBonus !== 0 && (
            <div
              style={{
                padding: "10px 12px",
                borderRadius: 10,
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.08)",
              }}
            >
              <div style={{ fontSize: "var(--fs-tiny)", fontWeight: 800, color: C.muted, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 4 }}>
                Max HP Bonus
              </div>
              <div style={{ fontSize: "var(--fs-title)", fontWeight: 900, color: featureHpMaxBonus > 0 ? accentColor : C.colorPinkRed }}>
                {featureHpMaxBonus > 0 ? "+" : ""}{featureHpMaxBonus}
              </div>
              <div style={{ fontSize: "var(--fs-small)", color: C.muted }}>
                Passive feature bonus applied to maximum hit points.
              </div>
            </div>
          )}

          <div>
            <div style={{ fontSize: "var(--fs-tiny)", fontWeight: 800, color: C.muted, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 6 }}>
              Resources
            </div>
            {classResources.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {classResources.map((resource) => (
                  <div
                    key={resource.key}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "minmax(0,1fr) auto auto auto",
                      gap: 8,
                      alignItems: "center",
                      padding: "8px 10px",
                      borderRadius: 8,
                      background: "rgba(255,255,255,0.03)",
                      border: "1px solid rgba(255,255,255,0.06)",
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: "var(--fs-subtitle)", fontWeight: 700, color: C.text }}>{resource.name}</div>
                      <div style={{ fontSize: "var(--fs-tiny)", color: C.muted }}>
                        {formatResetLabel(resource.reset)}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => void onChangeResourceCurrent(resource.key, -1)}
                      disabled={resource.current <= 0}
                      style={miniPillBtn(resource.current > 0)}
                    >
                      -
                    </button>
                    <div style={{ fontSize: "var(--fs-medium)", fontWeight: 800, color: C.text, minWidth: 52, textAlign: "center" }}>
                      {resource.current} / {resource.max}
                    </div>
                    <button
                      type="button"
                      onClick={() => void onChangeResourceCurrent(resource.key, 1)}
                      disabled={resource.current >= resource.max}
                      style={miniPillBtn(resource.current < resource.max)}
                    >
                      +
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ color: C.muted, fontSize: "var(--fs-small)" }}>No tracked resources.</div>
            )}
          </div>
        </div>
      </CollapsiblePanel>

      <CollapsiblePanel title="Player Notes" color={accentColor} storageKey="player-notes" actions={
        <button type="button" onClick={onOpenPlayerNoteCreate} title="Add note" style={panelHeaderAddBtn(accentColor)}>+</button>
      }>
        {playerNotesList.length ? (
          <DraggableList
            items={playerNotesList}
            expandedIds={expandedNoteIds}
            onSelect={(id) => onToggleNoteExpanded(id)}
            onReorder={(ids) => {
              const byId = Object.fromEntries(playerNotesList.map((n) => [n.id, n]));
              onSavePlayerNotesOrder(ids.map((id) => byId[id]).filter(Boolean));
            }}
            renderItem={(it) => {
              const note = playerNotesList.find((n) => n.id === it.id)!;
              return (
                <NoteItem
                  note={note}
                  expanded={expandedNoteIds.includes(it.id)}
                  accentColor={accentColor}
                  onToggle={() => onToggleNoteExpanded(it.id)}
                  onEdit={() => onOpenPlayerNoteEdit(note)}
                  onDelete={() => onDeletePlayerNote(it.id)}
                />
              );
            }}
          />
        ) : (
          <div style={{ color: C.muted, fontSize: "var(--fs-small)" }}>No notes yet.</div>
        )}
      </CollapsiblePanel>

      {hasCampaign && <CollapsiblePanel title="Shared Notes" color={accentColor} storageKey="shared-notes" actions={
        <button type="button" onClick={onOpenSharedNoteCreate} title="Add shared note" style={panelHeaderAddBtn(accentColor)}>+</button>
      }>
        {allSharedNotes.length ? (
          <DraggableList
            items={allSharedNotes}
            expandedIds={expandedNoteIds}
            onSelect={(id) => onToggleNoteExpanded(id)}
            onReorder={(ids) => {
              const byId = Object.fromEntries(allSharedNotes.map((n) => [n.id, n]));
              onSaveSharedNotesOrder(ids.map((id) => byId[id]).filter(Boolean));
            }}
            renderItem={(it) => {
              const note = allSharedNotes.find((n) => n.id === it.id)!;
              return (
                <NoteItem
                  note={note}
                  expanded={expandedNoteIds.includes(it.id)}
                  accentColor={C.green}
                  onToggle={() => onToggleNoteExpanded(it.id)}
                  onEdit={() => onOpenSharedNoteEdit(note)}
                  onDelete={() => onDeleteSharedNote(it.id)}
                />
              );
            }}
          />
        ) : (
          <div style={{ color: C.muted, fontSize: "var(--fs-small)" }}>No notes yet.</div>
        )}
      </CollapsiblePanel>}

      <CollapsiblePanel title="Player Features" color={accentColor} storageKey="player-features">
        {classFeaturesList.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {classFeaturesList.map((feature) => (
              <ClassFeatureItem
                key={feature.id}
                feature={feature}
                expanded={expandedClassFeatureIds.includes(feature.id)}
                accentColor={accentColor}
                onToggle={() => onToggleClassFeatureExpanded(feature.id)}
              />
            ))}
          </div>
        ) : (
          <div style={{ color: C.muted, fontSize: "var(--fs-small)" }}>No live player features were derived for this character.</div>
        )}
      </CollapsiblePanel>

      <div style={{ display: "none" }}>
        <button
          style={{
            background: "transparent", border: "1px solid rgba(255,255,255,0.14)",
            borderRadius: 8, padding: "7px 16px", color: C.muted,
            cursor: "pointer", fontSize: "var(--fs-subtitle)",
          }}
        >
          ← Back
        </button>
      </div>
    </div>
  );
}

