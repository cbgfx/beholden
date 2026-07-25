import { C } from "@/lib/theme";
import { formatCr } from "@/lib/monsterPicker/utils";
import type { CompendiumMonsterRow } from "@/lib/monsterPicker/types";
import { formatMonsterTypeLabel } from "@beholden/shared/domain";
import { RightDrawer } from "@/ui/RightDrawer";

export function CharacterPolymorphDrawer(props: {
  open: boolean;
  accentColor: string;
  polymorphQuery: string;
  polymorphTypeFilter: string;
  polymorphCrMax: string;
  polymorphTypeOptions: string[];
  polymorphRowsBusy: boolean;
  polymorphRowsError: string | null;
  filteredPolymorphRows: CompendiumMonsterRow[];
  polymorphApplyingId: string | null;
  onClose: () => void;
  onQueryChange: (value: string) => void;
  onTypeFilterChange: (value: string) => void;
  onCrMaxChange: (value: string) => void;
  onApply: (row: CompendiumMonsterRow) => void | Promise<void>;
}) {
  if (!props.open) return null;
  return (
    <RightDrawer
      onClose={props.onClose}
      width="min(560px, 92vw)"
      title={(
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontWeight: 900, fontSize: "var(--fs-subtitle)", letterSpacing: "0.08em", textTransform: "uppercase", color: props.accentColor }}>
            Transform Self
          </span>
        </div>
      )}
    >
      <div style={{ display: "grid", gap: 12 }}>
        <div style={{ color: C.muted, fontSize: "var(--fs-small)", lineHeight: 1.5 }}>
          Choose a creature form to polymorph into. Your current HP and AC bonuses are snapshotted, the form HP becomes your active pool, and if the form drops to 0 HP any overflow carries back into your original HP.
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr 1fr", gap: 8 }}>
          <input
            value={props.polymorphQuery}
            onChange={(e) => props.onQueryChange(e.target.value)}
            placeholder="Search creatures..."
            style={{
              background: C.bg,
              color: C.text,
              border: `1px solid ${C.panelBorder}`,
              borderRadius: 8,
              padding: "8px 10px",
              fontSize: "var(--fs-subtitle)",
              outline: "none",
              width: "100%",
              boxSizing: "border-box",
            }}
          />
          <select
            value={props.polymorphTypeFilter}
            onChange={(e) => props.onTypeFilterChange(e.target.value)}
            style={{
              background: C.bg,
              color: C.text,
              border: `1px solid ${C.panelBorder}`,
              borderRadius: 8,
              padding: "8px 10px",
              fontSize: "var(--fs-subtitle)",
              outline: "none",
              width: "100%",
            }}
          >
            {props.polymorphTypeOptions.map((type) => (
              <option key={type} value={type}>
                {type === "all" ? "All types" : formatMonsterTypeLabel(type)}
              </option>
            ))}
          </select>
          <input
            value={props.polymorphCrMax}
            onChange={(e) => props.onCrMaxChange(e.target.value)}
            placeholder="CR max"
            style={{
              background: C.bg,
              color: C.text,
              border: `1px solid ${C.panelBorder}`,
              borderRadius: 8,
              padding: "8px 10px",
              fontSize: "var(--fs-subtitle)",
              outline: "none",
              width: "100%",
              boxSizing: "border-box",
            }}
          />
        </div>
        <div style={{ color: C.muted, fontSize: "var(--fs-small)" }}>
          {props.polymorphRowsBusy ? "Loading creatures..." : `${props.filteredPolymorphRows.length} creature${props.filteredPolymorphRows.length === 1 ? "" : "s"}`}
        </div>
        <div style={{ maxHeight: 420, overflowY: "auto", border: `1px solid ${C.panelBorder}`, borderRadius: 12 }}>
          {props.polymorphRowsError ? (
            <div style={{ padding: 12, color: C.red, fontSize: "var(--fs-small)" }}>{props.polymorphRowsError}</div>
          ) : null}
          {!props.polymorphRowsBusy && !props.polymorphRowsError && props.filteredPolymorphRows.length === 0 ? (
            <div style={{ padding: 12, color: C.muted, fontSize: "var(--fs-small)" }}>No creatures match the current filters.</div>
          ) : null}
          {props.filteredPolymorphRows.map((row) => (
            <button
              key={row.id}
              type="button"
              disabled={props.polymorphApplyingId !== null}
              onClick={() => void props.onApply(row)}
              style={{
                width: "100%",
                border: "none",
                borderBottom: `1px solid ${C.panelBorder}`,
                background: "transparent",
                color: C.text,
                textAlign: "left",
                padding: "10px 12px",
                cursor: props.polymorphApplyingId !== null ? "wait" : "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 800, lineHeight: 1.2 }}>{row.name}</div>
                <div style={{ color: C.muted, fontSize: "var(--fs-small)", marginTop: 2 }}>
                  {[row.type ? formatMonsterTypeLabel(row.type) : null, row.environment ? String(row.environment) : null].filter(Boolean).join(" • ")}
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                <span style={{ color: props.accentColor, fontSize: "var(--fs-small)", fontWeight: 800 }}>
                  CR {formatCr(row.cr)}
                </span>
                <span style={{ color: props.polymorphApplyingId === row.id ? C.muted : props.accentColor, fontSize: "var(--fs-small)", fontWeight: 900, letterSpacing: "0.06em", textTransform: "uppercase" }}>
                  {props.polymorphApplyingId === row.id ? "Applying..." : "Transform"}
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>
    </RightDrawer>
  );
}
