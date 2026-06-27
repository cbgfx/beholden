import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/services/api";
import { C } from "@/lib/theme";
import {
  ABILITY_LABELS,
  getExtraFeatAbilityChoiceSpec,
  isValidExtraFeatAbilityChoice,
} from "@/domain/character/extraFeatAbilityScores";
import type { AbilKey } from "@/views/character/CharacterSheetTypes";
import { inputStyle } from "@/views/character/CharacterInventoryPanelHelpers";
import { cancelBtnStyle } from "@/views/character/CharacterViewParts";

type FeatRow = { id: string; name: string };
type FeatDetail = { id: string; name: string; text?: string | null };

function choiceInstruction(spec: NonNullable<ReturnType<typeof getExtraFeatAbilityChoiceSpec>>): string {
  if (spec.effects.length === 1) {
    const effect = spec.effects[0];
    return `Choose ${effect.choiceCount} ${effect.choiceCount === 1 ? "ability" : "abilities"} (+${effect.amount} each).`;
  }
  return spec.effects
    .map((effect) => `${effect.choiceCount} ${effect.choiceCount === 1 ? "ability" : "abilities"} at +${effect.amount}`)
    .join(" or ");
}

export function CharacterFeatPickerModal(props: {
  isOpen: boolean;
  accentColor: string;
  currentFeatIds: string[];
  existingFeatureNames: string[];
  onClose: () => void;
  onAdd: (feat: FeatRow, abilityChoices: string[]) => void;
}) {
  const [allFeats, setAllFeats] = useState<FeatRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedDetail, setSelectedDetail] = useState<FeatDetail | null>(null);
  const [detailBusy, setDetailBusy] = useState(false);
  const [selectedAbilities, setSelectedAbilities] = useState<AbilKey[]>([]);
  const detailCache = useRef<Record<string, FeatDetail>>({});

  useEffect(() => {
    if (!props.isOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") props.onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [props.isOpen, props.onClose]);

  useEffect(() => {
    if (!props.isOpen || allFeats.length > 0) return;
    setBusy(true);
    api<FeatRow[]>("/api/compendium/feats?fields=id,name")
      .then((rows) => setAllFeats((rows ?? []).sort((a, b) => a.name.localeCompare(b.name))))
      .catch(() => {})
      .finally(() => setBusy(false));
  }, [allFeats.length, props.isOpen]);

  useEffect(() => {
    if (!props.isOpen) {
      setQuery("");
      setSelectedId(null);
      setSelectedDetail(null);
      setSelectedAbilities([]);
    }
  }, [props.isOpen]);

  useEffect(() => {
    let alive = true;
    setSelectedAbilities([]);
    if (!selectedId) {
      setSelectedDetail(null);
      return () => { alive = false; };
    }
    const cached = detailCache.current[selectedId];
    if (cached) {
      setSelectedDetail(cached);
      return () => { alive = false; };
    }
    setSelectedDetail(null);
    setDetailBusy(true);
    api<{ rows: Array<{ id: string; feat: FeatDetail | null }> }>("/api/compendium/feats/lookup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: [selectedId] }),
    })
      .then((payload) => {
        if (!alive) return;
        const feat = payload.rows?.[0]?.feat ?? null;
        if (feat) detailCache.current[selectedId] = feat;
        setSelectedDetail(feat);
      })
      .catch(() => {
        if (alive) setSelectedDetail(null);
      })
      .finally(() => {
        if (alive) setDetailBusy(false);
      });
    return () => { alive = false; };
  }, [selectedId]);

  const existingNamesLower = new Set(props.existingFeatureNames.map((name) => name.toLowerCase().trim()));
  const rows = query
    ? allFeats.filter((feat) => feat.name.toLowerCase().includes(query.toLowerCase()))
    : allFeats;
  const selectedFeat = selectedId ? allFeats.find((feat) => feat.id === selectedId) ?? null : null;
  const choiceSpec = useMemo(() => getExtraFeatAbilityChoiceSpec(selectedDetail), [selectedDetail]);
  const choicesValid = isValidExtraFeatAbilityChoice(choiceSpec, selectedAbilities);
  const canAdd = Boolean(selectedFeat && selectedDetail && !detailBusy && choicesValid);
  const maxChoices = choiceSpec ? Math.max(...choiceSpec.allowedCounts) : 0;

  if (!props.isOpen) return null;

  return (
    <div
      style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,0.72)", display: "flex", alignItems: "center", justifyContent: "center" }}
      onClick={(event) => { if (event.target === event.currentTarget) props.onClose(); }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="feat-picker-title"
        style={{ background: "#0f1823", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 16, padding: 20, width: "min(860px, 96vw)", maxHeight: "86vh", display: "flex", flexDirection: "column", gap: 12 }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span id="feat-picker-title" style={{ fontWeight: 800, fontSize: "var(--fs-title)", color: C.text }}>Add Feat</span>
          <button type="button" onClick={props.onClose} style={cancelBtnStyle}>Close</button>
        </div>
        <input
          autoFocus
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search feats..."
          style={{ ...inputStyle, width: "100%", boxSizing: "border-box" as const }}
        />

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1.15fr", gap: 14, overflow: "hidden", flex: 1, minHeight: 0 }}>
          <div style={{ overflowY: "auto", display: "flex", flexDirection: "column", gap: 3 }}>
            {busy ? (
              <div style={{ color: C.muted, padding: "8px 2px" }}>Loading...</div>
            ) : rows.length === 0 ? (
              <div style={{ color: C.muted, padding: "8px 2px" }}>No feats found.</div>
            ) : rows.map((feat) => {
              const already = props.currentFeatIds.includes(feat.id)
                || existingNamesLower.has(feat.name.toLowerCase().trim());
              const isSelected = selectedId === feat.id;
              return (
                <button
                  key={feat.id}
                  type="button"
                  onClick={() => { if (!already) setSelectedId(feat.id); }}
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "8px 12px", borderRadius: 8, cursor: already ? "default" : "pointer",
                    border: `1px solid ${isSelected ? props.accentColor + "66" : "rgba(255,255,255,0.07)"}`,
                    background: isSelected ? `${props.accentColor}14` : "rgba(255,255,255,0.03)",
                    color: already ? C.muted : C.text, textAlign: "left",
                    fontWeight: isSelected ? 700 : already ? 400 : 500, fontSize: "var(--fs-body)",
                    opacity: already ? 0.4 : 1, width: "100%",
                  }}
                >
                  <span>{feat.name}</span>
                  {already && <span style={{ fontSize: "var(--fs-tiny)", color: C.muted }}>Already have it</span>}
                </button>
              );
            })}
          </div>

          <div style={{ overflowY: "auto", padding: "4px 2px 4px 14px", borderLeft: "1px solid rgba(255,255,255,0.07)" }}>
            {detailBusy ? (
              <div style={{ color: C.muted, fontSize: "var(--fs-small)", padding: 4 }}>Loading...</div>
            ) : selectedDetail ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ fontWeight: 800, fontSize: "var(--fs-subtitle)", color: props.accentColor }}>{selectedDetail.name}</div>

                {choiceSpec && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: 10, borderRadius: 10, background: `${props.accentColor}10`, border: `1px solid ${props.accentColor}33` }}>
                    <div style={{ color: C.text, fontSize: "var(--fs-small)", fontWeight: 700 }}>
                      {choiceInstruction(choiceSpec)}
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {choiceSpec.options.map((ability) => {
                        const active = selectedAbilities.includes(ability);
                        return (
                          <button
                            key={ability}
                            type="button"
                            onClick={() => {
                              setSelectedAbilities((current) => {
                                if (current.includes(ability)) return current.filter((entry) => entry !== ability);
                                if (maxChoices === 1) return [ability];
                                if (current.length >= maxChoices) return current;
                                return [...current, ability];
                              });
                            }}
                            style={{
                              padding: "6px 10px", borderRadius: 8, cursor: "pointer",
                              border: `1px solid ${active ? props.accentColor + "88" : "rgba(255,255,255,0.12)"}`,
                              background: active ? `${props.accentColor}24` : "rgba(255,255,255,0.04)",
                              color: active ? props.accentColor : C.muted,
                              fontWeight: 700, fontSize: "var(--fs-small)",
                            }}
                          >
                            {ABILITY_LABELS[ability]}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div style={{ fontSize: "var(--fs-small)", color: C.text, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
                  {selectedDetail.text ?? <span style={{ color: C.muted }}>No description available.</span>}
                </div>

                <button
                  type="button"
                  disabled={!canAdd}
                  onClick={() => {
                    if (!selectedFeat || !canAdd) return;
                    props.onAdd(selectedFeat, selectedAbilities);
                    props.onClose();
                  }}
                  style={{
                    padding: "10px 14px", borderRadius: 9,
                    border: `1px solid ${canAdd ? props.accentColor + "88" : "rgba(255,255,255,0.1)"}`,
                    background: canAdd ? `${props.accentColor}24` : "rgba(255,255,255,0.04)",
                    color: canAdd ? props.accentColor : C.muted,
                    cursor: canAdd ? "pointer" : "not-allowed",
                    fontWeight: 800, fontSize: "var(--fs-body)",
                  }}
                >
                  {choiceSpec && !choicesValid ? "Choose ability increase" : `Add ${selectedDetail.name}`}
                </button>
              </div>
            ) : (
              <div style={{ color: C.muted, fontSize: "var(--fs-small)", lineHeight: 1.6, paddingTop: 4 }}>
                Select a feat on the left to preview and add it.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
