import React from "react";
import { EmptyState, NoteList, NotesPanel } from "@beholden/shared/ui";
import { C } from "@/lib/theme";
import { IconWerewolf } from "@/icons";
import type { ClassFeatureEntry, PlayerNote, ResourceCounter } from "@/views/character/CharacterSheetTypes";
import { getExhaustionEffects } from "@/views/character/CharacterExhaustion";
import {
  CollapsiblePanel,
  panelHeaderAddBtn,
  miniPillBtn,
  restBtnStyle,
  ClassFeatureItem,
  useSheetDensity,
} from "@/views/character/CharacterViewParts";

export function CharacterSupportPanels(props: {
  accentColor: string;
  hasCampaign: boolean;
  hitDiceCurrent: number;
  hitDiceMax: number;
  hitDieSize: number | null;
  hitDieConMod: number;
  featureHpMaxBonus: number;
  exhaustion: number;
  classResources: ResourceCounter[];
  playerNotesList: PlayerNote[];
  allSharedNotes: PlayerNote[];
  classFeaturesList: ClassFeatureEntry[];
  expandedNoteIds: string[];
  expandedClassFeatureIds: string[];
  onSaveHitDiceCurrent: (value: number) => Promise<void> | void;
  onShortRest: () => Promise<void> | void;
  onLongRest: () => Promise<void> | void;
  onExhaustionChange: (value: number) => Promise<void> | void;
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
  showReferenceContent?: boolean;
  afterUpkeep?: React.ReactNode;
  polymorphName?: string | null;
  onOpenTransformSelf: () => void;
  onRevertTransformSelf?: () => void;
  extraFeatIds?: string[];
  onOpenFeatPicker?: () => void;
  onRemoveExtraFeat?: (featId: string) => Promise<void>;
}) {
  const {
    accentColor,
    hasCampaign,
    hitDiceCurrent,
    hitDiceMax,
    hitDieSize,
    hitDieConMod,
    featureHpMaxBonus,
    exhaustion,
    classResources,
    playerNotesList,
    allSharedNotes,
    classFeaturesList,
    expandedNoteIds,
    expandedClassFeatureIds,
    onSaveHitDiceCurrent,
    onShortRest,
    onLongRest,
    onExhaustionChange,
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
    showReferenceContent = true,
    afterUpkeep,
    polymorphName,
    onOpenTransformSelf,
    onRevertTransformSelf,
    extraFeatIds = [],
    onOpenFeatPicker,
    onRemoveExtraFeat,
  } = props;

  const formatResetLabel = (resource: ResourceCounter): string => {
    const code = String(resource.reset ?? "").trim().toUpperCase();
    if (code === "S" && resource.restoreAmount === "one") return "Regains 1 on Short Rest, all on Long Rest";
    if (code === "S") return "Resets on Short Rest";
    if (code === "L") return "Resets on Long Rest";
    if (code === "SL") return "Resets on Short or Long Rest";
    return `Reset ${resource.reset}`;
  };
  const groupedFeatures = React.useMemo(() => {
    const getGroup = (id: string): "class" | "race" | "background" | "feats" => {
      if (id.startsWith("class:") || id.startsWith("invocation:")) return "class";
      if (id.startsWith("race:") || id.startsWith("race-feat:")) return "race";
      if (id.startsWith("background:") || id.startsWith("background-feat:") || id.startsWith("bg-feat:")) return "background";
      return "feats";
    };
    const groups: Record<"class" | "race" | "background" | "feats", typeof classFeaturesList> = {
      class: [], race: [], background: [], feats: [],
    };
    for (const feature of classFeaturesList) groups[getGroup(feature.id)].push(feature);
    const sort = (arr: typeof classFeaturesList) => arr.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
    return { class: sort(groups.class), race: sort(groups.race), background: sort(groups.background), feats: sort(groups.feats) };
  }, [classFeaturesList]);

  const totalFeatureCount = classFeaturesList.length;
  const compact = useSheetDensity() === "compact";
  const exhaustionColor =
    exhaustion === 0 ? C.muted : exhaustion <= 2 ? "#f59e0b" : exhaustion <= 4 ? "#f97316" : "#dc2626";
  const activeExhaustionEffects = getExhaustionEffects(exhaustion);
  const upkeepSummary = classResources.length > 0
    ? `${classResources.reduce((sum, resource) => sum + resource.current, 0)} / ${classResources.reduce((sum, resource) => sum + resource.max, 0)} resources`
    : `${hitDiceCurrent} / ${hitDiceMax} hit dice`;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: compact ? 9 : 14 }}>
      <CollapsiblePanel
        title="Upkeep"
        color={accentColor}
        storageKey="recovery"
        summary={`${upkeepSummary}${exhaustion > 0 ? ` · Exhaustion ${exhaustion}` : ""}`}
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
              borderRadius: 8,
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

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{
              borderRadius: 9,
              overflow: "hidden",
              background: "rgba(255,255,255,0.035)",
              border: `1px solid ${exhaustion > 0 ? `${exhaustionColor}44` : "rgba(255,255,255,0.08)"}`,
            }}>
              <div style={{
                display: "grid",
                gridTemplateColumns: "minmax(76px, auto) minmax(0, 1fr) auto",
                alignItems: "center",
                gap: 10,
                padding: "7px 10px",
              }}>
                <div style={{ fontSize: "var(--fs-tiny)", fontWeight: 800, color: C.muted, textTransform: "uppercase", letterSpacing: "0.07em" }}>
                  Hit Dice
                </div>
                <div style={{ minWidth: 0, display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ fontSize: "var(--fs-subtitle)", fontWeight: 900, color: C.text }}>
                    {hitDiceCurrent} / {hitDiceMax}
                  </span>
                  {hitDieSize != null && (
                    <span style={{ fontSize: "var(--fs-tiny)", color: C.muted }}>
                      d{hitDieSize}{hitDieConMod >= 0 ? ` + ${hitDieConMod}` : ` - ${Math.abs(hitDieConMod)}`} per die
                    </span>
                  )}
                </div>
                <div style={{ display: "flex", gap: 5 }}>
                  <button
                    type="button"
                    aria-label="Spend Hit Die"
                    onClick={() => void onSaveHitDiceCurrent(hitDiceCurrent - 1)}
                    disabled={hitDiceCurrent <= 0}
                    style={miniPillBtn(hitDiceCurrent > 0)}
                  >
                    -
                  </button>
                  <button
                    type="button"
                    aria-label="Restore Hit Die"
                    onClick={() => void onSaveHitDiceCurrent(hitDiceCurrent + 1)}
                    disabled={hitDiceCurrent >= hitDiceMax}
                    style={miniPillBtn(hitDiceCurrent < hitDiceMax)}
                  >
                    +
                  </button>
                </div>
              </div>

              <div style={{
                display: "grid",
                gridTemplateColumns: "minmax(76px, auto) minmax(0, 1fr) auto",
                alignItems: "center",
                gap: 10,
                padding: "7px 10px",
                borderTop: "1px solid rgba(255,255,255,0.07)",
              }}>
                <div style={{ fontSize: "var(--fs-tiny)", fontWeight: 800, color: C.muted, textTransform: "uppercase", letterSpacing: "0.07em" }}>
                  Exhaustion
                </div>
                <div style={{ minWidth: 0 }}>
                  <span style={{ fontSize: "var(--fs-subtitle)", fontWeight: 900, color: exhaustionColor }}>
                    {exhaustion} / 6
                  </span>
                  {activeExhaustionEffects.length > 0 && (
                    <div
                      title={activeExhaustionEffects.join("; ")}
                      style={{
                        color: exhaustionColor,
                        fontSize: "var(--fs-tiny)",
                        marginTop: 1,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {activeExhaustionEffects.length} active effect{activeExhaustionEffects.length === 1 ? "" : "s"} · {activeExhaustionEffects[activeExhaustionEffects.length - 1]}
                    </div>
                  )}
                </div>
                <div style={{ display: "flex", gap: 5 }}>
                  <button
                    type="button"
                    aria-label="Reduce Exhaustion"
                    onClick={() => void onExhaustionChange(Math.max(0, exhaustion - 1))}
                    disabled={exhaustion <= 0}
                    style={miniPillBtn(exhaustion > 0)}
                  >
                    -
                  </button>
                  <button
                    type="button"
                    aria-label="Increase Exhaustion"
                    onClick={() => void onExhaustionChange(Math.min(6, exhaustion + 1))}
                    disabled={exhaustion >= 6}
                    style={miniPillBtn(exhaustion < 6)}
                  >
                    +
                  </button>
                </div>
              </div>
            </div>

            <div style={{ display: "flex", gap: 8 }}>
              <button type="button" onClick={() => void onShortRest()} style={{ ...restBtnStyle(C.colorRitual), flex: 1, minWidth: 0, padding: "7px 10px", borderRadius: 8 }}>
                Short Rest
              </button>
              <button type="button" onClick={() => void onLongRest()} style={{ ...restBtnStyle("#34d399"), flex: 1, minWidth: 0, padding: "7px 10px", borderRadius: 8 }}>
                Long Rest
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
                        {formatResetLabel(resource)}
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
              <EmptyState textColor={C.muted}>No tracked resources.</EmptyState>
            )}
          </div>
        </div>
      </CollapsiblePanel>

      {afterUpkeep}

      {showReferenceContent && (
        <>
          <NotesPanel
            title={`Player Notes (${playerNotesList.length})`}
            color={accentColor}
            storageKey="player-notes"
            actions={<button type="button" onClick={onOpenPlayerNoteCreate} title="Add note" style={panelHeaderAddBtn(accentColor)}>+</button>}
          >
        <NoteList
          items={playerNotesList.map((note) => ({ id: note.id, title: note.title || "Untitled", text: note.text }))}
          expandedIds={expandedNoteIds}
          accentColor={accentColor}
          textColor={C.text}
          mutedColor={C.muted}
          deleteColor={C.red}
          onToggle={onToggleNoteExpanded}
          onEdit={(id) => {
            const note = playerNotesList.find((entry) => entry.id === id);
            if (note) onOpenPlayerNoteEdit(note);
          }}
          onDelete={onDeletePlayerNote}
          onReorder={(ids) => {
            const byId = Object.fromEntries(playerNotesList.map((n) => [n.id, n]));
            onSavePlayerNotesOrder(ids.map((id) => byId[id]).filter(Boolean));
          }}
          emptyText="No notes yet."
        />
          </NotesPanel>

      {hasCampaign && <NotesPanel
        title={`Shared Notes (${allSharedNotes.length})`}
        color={accentColor}
        storageKey="shared-notes"
        actions={<button type="button" onClick={onOpenSharedNoteCreate} title="Add shared note" style={panelHeaderAddBtn(accentColor)}>+</button>}
      >
        <NoteList
          items={allSharedNotes.map((note) => ({ id: note.id, title: note.title || "Untitled", text: note.text }))}
          expandedIds={expandedNoteIds}
          accentColor={accentColor}
          textColor={C.text}
          mutedColor={C.muted}
          deleteColor={C.red}
          onToggle={onToggleNoteExpanded}
          onEdit={(id) => {
            const note = allSharedNotes.find((entry) => entry.id === id);
            if (note) onOpenSharedNoteEdit(note);
          }}
          onDelete={onDeleteSharedNote}
          onReorder={(ids) => {
            const byId = Object.fromEntries(allSharedNotes.map((n) => [n.id, n]));
            onSaveSharedNotesOrder(ids.map((id) => byId[id]).filter(Boolean));
          }}
          emptyText="No notes yet."
        />
      </NotesPanel>}

          <CollapsiblePanel
            title="Features"
            color={accentColor}
            storageKey="player-features"
            summary={`${totalFeatureCount} features`}
            actions={onOpenFeatPicker ? (
              <button type="button" onClick={onOpenFeatPicker} title="Add feat" style={panelHeaderAddBtn(accentColor)}>+</button>
            ) : undefined}
          >
        {totalFeatureCount > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {(["class", "race", "background", "feats"] as const).map((group) => {
              const features = groupedFeatures[group];
              if (features.length === 0) return null;
              const label = group === "class" ? "Class" : group === "race" ? "Race" : group === "background" ? "Background" : "Feats";
              return (
                <div key={group}>
                  <div style={{ fontSize: "var(--fs-tiny)", fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 5, opacity: 0.6 }}>{label}</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                    {features.map((feature) => {
                      const extraFeatId = feature.id.startsWith("extra-feat:") ? feature.id.slice("extra-feat:".length) : null;
                      return (
                        <div key={feature.id} style={{ position: "relative" }}>
                          <ClassFeatureItem
                            feature={feature}
                            expanded={expandedClassFeatureIds.includes(feature.id)}
                            accentColor={accentColor}
                            onToggle={() => onToggleClassFeatureExpanded(feature.id)}
                          />
                          {extraFeatId && onRemoveExtraFeat && (
                            <button
                              type="button"
                              title="Remove feat"
                              onClick={() => { void onRemoveExtraFeat(extraFeatId); }}
                              style={{ position: "absolute", top: 8, right: 10, border: "none", background: "transparent", cursor: "pointer", color: "rgba(248,113,113,0.6)", fontSize: "var(--fs-body)", lineHeight: 1, padding: 0, fontWeight: 700 }}
                            >×</button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <EmptyState textColor={C.muted}>No features yet. Add feats with the + button above.</EmptyState>
        )}
          </CollapsiblePanel>
        </>
      )}

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
