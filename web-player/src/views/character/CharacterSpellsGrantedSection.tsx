import { C } from "@/lib/theme";
import type { GrantedSpellCast, ResourceCounter } from "@/views/character/CharacterSheetTypes";
import {
  type FetchedSpellDetail,
  grantedSpellChargeBtn,
  spellSectionArrow,
  spellSectionHeaderBtn,
} from "@/views/character/CharacterSpellShared";

export type GrantedSpellEntry = Omit<GrantedSpellCast, "spellId"> & {
  spellId: string | null;
  searchName: string;
  key: string;
  grantKey: string;
};

function formatResourceResetLabel(reset: ResourceCounter["reset"]): string {
  if (reset === "S") return "Short Rest";
  if (reset === "SL") return "Short or Long Rest";
  return "Long Rest";
}

export function CharacterSpellsGrantedSection({
  entries,
  details,
  resources,
  collapsed,
  onToggleCollapse,
  onSelectSpell,
  onResourceChange,
}: {
  entries: GrantedSpellEntry[];
  details: Record<string, FetchedSpellDetail>;
  resources: ResourceCounter[];
  collapsed: boolean;
  onToggleCollapse: () => void;
  onSelectSpell: (detail: FetchedSpellDetail, source: string) => void;
  onResourceChange?: (key: string, delta: number) => Promise<void> | void;
}) {
  if (entries.length === 0) return null;
  return (
    <div style={{ marginBottom: 18 }}>
      <button
        type="button"
        onClick={onToggleCollapse}
        style={spellSectionHeaderBtn("rgba(96,165,250,0.25)")}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span aria-hidden="true" style={spellSectionArrow(collapsed, C.colorRitual)}>▼</span>
          <div style={{ fontSize: "var(--fs-small)", fontWeight: 800, color: C.colorRitual, textTransform: "uppercase", letterSpacing: 1 }}>
            Granted Spells
          </div>
        </div>
      </button>
      {!collapsed && entries.map((entry, index) => {
        const detail = details[entry.key];
        const resource = entry.resourceKey ? resources.find((item) => item.key === entry.resourceKey) : null;
        return (
          <div
            key={`${entry.grantKey}:${entry.mode}:${entry.sourceName}:${index}`}
            style={{
              display: "grid",
              gridTemplateColumns: "1fr auto",
              alignItems: "center",
              gap: 10,
              padding: "8px 0",
              borderBottom: "1px solid rgba(255,255,255,0.04)",
              cursor: detail ? "pointer" : "default",
            }}
            onClick={(ev) => {
              if ((ev.target as HTMLElement).closest("button")) return;
              if (detail) onSelectSpell(detail, entry.sourceName);
            }}
          >
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: "var(--fs-subtitle)", color: C.text }}>{detail?.name ?? entry.searchName}</div>
              <div style={{ fontSize: "var(--fs-tiny)", color: C.muted, marginTop: 1 }}>{entry.sourceName}</div>
              {entry.note ? (
                <div style={{ fontSize: "var(--fs-small)", color: C.muted, marginTop: 4, lineHeight: 1.45 }}>{entry.note}</div>
              ) : null}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {(entry.mode === "at_will" || entry.mode === "expanded_list" || entry.mode === "always_prepared" || entry.mode === "known") ? (() => {
                const [rgb, text] = entry.mode === "at_will" ? ["96,165,250", "At Will"]
                  : entry.mode === "expanded_list" ? ["251,191,36", "Expanded"]
                  : entry.mode === "always_prepared" ? ["196,181,253", "Prepared"]
                  : ["52,211,153", "Known"];
                return (
                  <div style={{
                    padding: "5px 8px", borderRadius: 999,
                    border: `1px solid rgba(${rgb},0.35)`,
                    background: `rgba(${rgb},0.12)`,
                    color: `rgb(${rgb})`,
                    fontSize: "var(--fs-tiny)", fontWeight: 800,
                    textTransform: "uppercase", letterSpacing: "0.07em",
                  }}>{text}</div>
                );
              })() : resource ? (
                <>
                  <button
                    type="button"
                    onClick={() => void onResourceChange?.(resource.key, -1)}
                    disabled={resource.current <= 0}
                    style={grantedSpellChargeBtn(resource.current > 0)}
                  >
                    -
                  </button>
                  <div style={{ textAlign: "center", minWidth: 58 }}>
                    <div style={{ fontSize: "var(--fs-subtitle)", fontWeight: 800, color: C.text }}>{resource.current}/{resource.max}</div>
                    <div style={{ fontSize: "var(--fs-tiny)", color: C.muted }}>{formatResourceResetLabel(resource.reset)}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => void onResourceChange?.(resource.key, 1)}
                    disabled={resource.current >= resource.max}
                    style={grantedSpellChargeBtn(resource.current < resource.max)}
                  >
                    +
                  </button>
                </>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}
