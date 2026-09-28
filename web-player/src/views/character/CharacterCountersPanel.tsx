import { useEffect, useState } from "react";
import { C } from "@/lib/theme";
import type { CharacterCounter } from "@/views/character/CharacterSheetTypes";
import { CollapsiblePanel, miniPillBtn, PanelHeaderAddButton } from "@/views/character/CharacterViewParts";
import { PANEL_IDS } from "@/views/character/layout/panelRegistry";
import { useQueuedPersistedState } from "@/views/character/state/useQueuedPersistedState";
import { useUiTranslation } from "@beholden/shared/i18n";

function counterId(): string {
  return `counter-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function CounterTitle(props: { value: string; onSave: (value: string) => void }) {
  const t = useUiTranslation("playerUi");
  const [draft, setDraft] = useState(props.value);
  useEffect(() => setDraft(props.value), [props.value]);
  const commit = () => {
    const title = draft.trim() || t("Counter");
    setDraft(title);
    if (title !== props.value) props.onSave(title);
  };
  return (
    <input
      aria-label={t("Counter title")}
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === "Enter") event.currentTarget.blur();
        if (event.key === "Escape") { setDraft(props.value); event.currentTarget.blur(); }
      }}
      style={{
        minWidth: 0, width: "100%", boxSizing: "border-box", padding: "7px 9px",
        borderRadius: 7, border: "1px solid rgba(255,255,255,0.12)",
        background: "rgba(255,255,255,0.045)", color: C.text,
        font: "inherit", fontSize: "var(--fs-medium)", fontWeight: 700, outline: "none",
      }}
    />
  );
}

export function CharacterCountersPanel(props: {
  counters: CharacterCounter[];
  accentColor: string;
  onSave: (counters: CharacterCounter[]) => void | Promise<unknown>;
}) {
  const t = useUiTranslation("playerUi");
  const [counters, update] = useQueuedPersistedState(props.counters, async (next) => props.onSave(next));
  const saveCounter = (id: string, patch: Partial<CharacterCounter>) => {
    update((current) => current.map((counter) => counter.id === id ? { ...counter, ...patch } : counter));
  };
  const addCounter = () => {
    update((current) => [...current, { id: counterId(), title: t("Counter"), numCount: 0 }]);
  };

  return (
    <CollapsiblePanel
      title={t("Counters ({{count}})", { count: counters.length })}
      color={props.accentColor}
      storageKey={PANEL_IDS.counters}
      summary={counters.map((counter) => `${counter.title} ${counter.numCount}`).join(" · ") || t("No counters")}
      actions={<PanelHeaderAddButton color={props.accentColor} title={t("Add counter")} onClick={addCounter} />}
    >
      {counters.length === 0 ? (
        <div style={{ color: C.muted, fontSize: "var(--fs-small)", lineHeight: 1.6 }}>{t("No counters yet.")}</div>
      ) : (
        <div style={{ display: "grid", gap: 7 }}>
          {counters.map((counter) => (
            <div
              key={counter.id}
              className="character-counter-row"
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(0, 1fr) auto auto auto auto",
                alignItems: "center",
                gap: 7,
                padding: "7px 8px",
                borderRadius: 9,
                border: "1px solid rgba(255,255,255,0.08)",
                background: "rgba(255,255,255,0.025)",
              }}
            >
              <CounterTitle value={counter.title} onSave={(title) => saveCounter(counter.id, { title })} />
              <button
                type="button"
                aria-label={t("Decrease {{title}}", { title: counter.title })}
                onClick={() => saveCounter(counter.id, { numCount: counter.numCount - 1 })}
                style={miniPillBtn(true)}
              >
                −
              </button>
              <input
                aria-label={t("{{title}} value", { title: counter.title })}
                type="number"
                value={counter.numCount}
                onChange={(event) => saveCounter(counter.id, { numCount: Math.trunc(Number(event.target.value) || 0) })}
                style={{
                  width: 58,
                  boxSizing: "border-box",
                  padding: "5px 4px",
                  borderRadius: 7,
                  border: `1px solid ${props.accentColor}44`,
                  background: `${props.accentColor}0d`,
                  color: C.text,
                  textAlign: "center",
                  font: "inherit",
                  fontWeight: 900,
                  outline: "none",
                }}
              />
              <button
                type="button"
                aria-label={t("Increase {{title}}", { title: counter.title })}
                onClick={() => saveCounter(counter.id, { numCount: counter.numCount + 1 })}
                style={miniPillBtn(true)}
              >
                +
              </button>
              <button
                type="button"
                className="counter-row-action"
                title={t("Delete {{title}}", { title: counter.title })}
                onClick={() => update((current) => current.filter((entry) => entry.id !== counter.id))}
                style={{
                  width: 24,
                  height: 30,
                  padding: 0,
                  border: 0,
                  background: "transparent",
                  color: "rgb(248,113,113)",
                  cursor: "pointer",
                  fontSize: "var(--fs-medium)",
                  fontWeight: 900,
                }}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </CollapsiblePanel>
  );
}
