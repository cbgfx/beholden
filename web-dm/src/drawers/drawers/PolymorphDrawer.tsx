import React from "react";
import { Button } from "@/ui/Button";
import { api, jsonInit } from "@/services/api";
import { theme } from "@/theme/theme";
import { useStore, type DrawerState } from "@/store";
import type { DrawerContent } from "@/drawers/types";
import type { CompendiumMonsterRow } from "@/views/CampaignView/monsterPicker/types";
import type { MonsterDetail } from "@/domain/types/compendium";
import { parseCrNumber, formatCr, parseLeadingNumberLoose } from "@/views/CampaignView/monsterPicker/utils";
import { titleCase } from "@/lib/format/titleCase";

type PolymorphDrawerState = Exclude<
  Extract<DrawerState, { type: "polymorphTransform" }>,
  null
>;

/** Condition stored on the combatant while polymorphed. */
export type PolymorphCondition = {
  key: "polymorphed";
  polymorphName: string;
  polymorphMonsterId: string | null;
  /** Saved overrides.acBonus before transform (for revert). */
  originalAcBonus: number;
  /** Saved overrides.hpMaxBonus before transform (for revert). */
  originalHpMaxBonus: number;
  /** Saved hpCurrent before transform (for revert). */
  originalHpCurrent: number | null;
};

function isPolymorphCondition(c: { key: string }): c is PolymorphCondition {
  return c.key === "polymorphed";
}

const CR_OPTIONS = ["", "0", "1/8", "1/4", "1/2", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10",
  "11", "12", "13", "14", "15", "16", "17", "18", "19", "20", "21", "22", "23", "24", "25", "26", "27", "28", "29", "30"];

const selectStyle: React.CSSProperties = {
  background: theme.colors.panelBg,
  color: theme.colors.text,
  border: `1px solid ${theme.colors.panelBorder}`,
  borderRadius: 8,
  padding: "6px 8px",
  fontSize: "var(--fs-medium)",
  outline: "none",
  width: "100%",
};

const inputStyle: React.CSSProperties = {
  background: theme.colors.panelBg,
  color: theme.colors.text,
  border: `1px solid ${theme.colors.panelBorder}`,
  borderRadius: 8,
  padding: "6px 10px",
  fontSize: "var(--fs-medium)",
  outline: "none",
  width: "100%",
  boxSizing: "border-box",
};

export function PolymorphDrawer(props: {
  drawer: PolymorphDrawerState;
  close: () => void;
  refreshEncounter: (eid: string | null) => Promise<void>;
}): DrawerContent {
  const { state } = useStore();

  const combatant = React.useMemo(
    () => state.combatants.find((x) => x.id === props.drawer.combatantId),
    [props.drawer.combatantId, state.combatants]
  );

  const currentPolymorph = React.useMemo(
    () => combatant?.conditions?.find(isPolymorphCondition) ?? null,
    [combatant]
  );

  // Monster list
  const [rows, setRows] = React.useState<CompendiumMonsterRow[]>([]);
  React.useEffect(() => {
    api<CompendiumMonsterRow[]>("/api/compendium/monsters").then(setRows).catch(() => {});
  }, []);

  // Filters
  const [q, setQ] = React.useState("");
  const [crMax, setCrMax] = React.useState("");
  const [typeFilter, setTypeFilter] = React.useState("beast");

  const typeOptions = React.useMemo(() => {
    const set = new Set<string>();
    for (const r of rows) if (r.type) set.add(String(r.type).trim());
    return ["all", ...Array.from(set).sort()];
  }, [rows]);

  const filteredRows = React.useMemo(() => {
    const ql = q.trim().toLowerCase();
    const maxCrNum = crMax ? parseCrNumber(crMax) : NaN;
    return rows
      .filter((r) => {
        if (ql && !String(r.name ?? "").toLowerCase().includes(ql)) return false;
        if (typeFilter !== "all" && String(r.type ?? "").trim() !== typeFilter) return false;
        if (Number.isFinite(maxCrNum)) {
          const crNum = parseCrNumber(r.cr);
          if (!Number.isFinite(crNum) || crNum > maxCrNum) return false;
        }
        return true;
      })
      .sort((a, b) => {
        const crDiff = parseCrNumber(a.cr) - parseCrNumber(b.cr);
        if (Number.isFinite(crDiff) && Math.abs(crDiff) > 1e-9) return crDiff;
        return String(a.name ?? "").localeCompare(String(b.name ?? ""));
      });
  }, [rows, q, crMax, typeFilter]);

  // Manual fields
  const [manualAc, setManualAc] = React.useState("");
  const [manualHp, setManualHp] = React.useState("");
  const [selectedBeast, setSelectedBeast] = React.useState<{ id: string; name: string } | null>(null);

  const [loading, setLoading] = React.useState(false);

  // Selecting a beast prefills manual fields and remembers its name/id
  const selectBeast = React.useCallback(async (row: CompendiumMonsterRow) => {
    setSelectedBeast({ id: row.id, name: row.name });
    try {
      const detail = await api<MonsterDetail>(`/api/compendium/monsters/${row.id}`);
      const ac = parseLeadingNumberLoose(detail.ac);
      const hp = parseLeadingNumberLoose(detail.hp);
      if (Number.isFinite(ac)) setManualAc(String(Math.round(ac)));
      if (Number.isFinite(hp)) setManualHp(String(Math.round(hp)));
    } catch {
      // If detail fails, leave fields as-is
    }
  }, []);

  const applyPolymorph = React.useCallback(
    async (overrideName?: string, overrideMonsterId?: string | null, beastAc?: number, beastHp?: number) => {
      if (!combatant) return;
      const ac = beastAc ?? Number(manualAc);
      const hp = beastHp ?? Number(manualHp);
      if (!Number.isFinite(ac) || !Number.isFinite(hp) || ac <= 0 || hp <= 0) {
        alert("Enter valid AC and HP for the new form.");
        return;
      }
      const name = overrideName ?? selectedBeast?.name ?? `Form (AC ${ac}, HP ${hp})`;
      const baseAc = Number(combatant.ac ?? 0);
      const baseHpMax = Number(combatant.hpMax ?? 0);
      const existingOverrides = combatant.overrides ?? { acBonus: 0, hpMaxBonus: 0, tempHp: 0 };
      const condition: PolymorphCondition = {
        key: "polymorphed",
        polymorphName: name,
        polymorphMonsterId: overrideMonsterId ?? selectedBeast?.id ?? null,
        originalAcBonus: Number(existingOverrides.acBonus ?? 0),
        originalHpMaxBonus: Number(existingOverrides.hpMaxBonus ?? 0),
        originalHpCurrent: combatant.hpCurrent ?? null,
      };
      const nextConditions = [
        ...(combatant.conditions ?? []).filter((c) => c.key !== "polymorphed"),
        condition,
      ];
      // Use overrides so AC/HP changes sync back to players too
      const nextOverrides = {
        ...existingOverrides,
        acBonus: ac - baseAc,
        hpMaxBonus: hp - baseHpMax,
      };
      setLoading(true);
      try {
        await api(
          `/api/encounters/${props.drawer.encounterId}/combatants/${combatant.id}`,
          jsonInit("PUT", {
            hpCurrent: hp,
            overrides: nextOverrides,
            conditions: nextConditions,
          })
        );
        await props.refreshEncounter(props.drawer.encounterId);
        props.close();
      } finally {
        setLoading(false);
      }
    },
    [combatant, manualAc, manualHp, selectedBeast, props]
  );

  const revertPolymorph = React.useCallback(async () => {
    if (!combatant || !currentPolymorph) return;
    const nextConditions = (combatant.conditions ?? []).filter((c) => c.key !== "polymorphed");
    const existingOverrides = combatant.overrides ?? { acBonus: 0, hpMaxBonus: 0, tempHp: 0 };
    const nextOverrides = {
      ...existingOverrides,
      acBonus: currentPolymorph.originalAcBonus,
      hpMaxBonus: currentPolymorph.originalHpMaxBonus,
    };
    setLoading(true);
    try {
      await api(
        `/api/encounters/${props.drawer.encounterId}/combatants/${combatant.id}`,
        jsonInit("PUT", {
          hpCurrent: currentPolymorph.originalHpCurrent,
          overrides: nextOverrides,
          conditions: nextConditions,
        })
      );
      await props.refreshEncounter(props.drawer.encounterId);
      props.close();
    } finally {
      setLoading(false);
    }
  }, [combatant, currentPolymorph, props]);

  const body = (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* Description */}
      <p style={{ color: theme.colors.muted, fontSize: "var(--fs-medium)", lineHeight: 1.5, margin: 0 }}>
        Transform the entity into another creature. You can use this for a druid's Wild Shape, or for the Polymorph spell.
        Damage and healing is handled as normal while transformed.
      </p>

      {/* Current state banner */}
      {currentPolymorph && (
        <div style={{
          padding: "8px 12px",
          borderRadius: 8,
          background: "rgba(109,40,217,0.12)",
          border: "1px solid #6d28d966",
          color: "#c084fc",
          fontSize: "var(--fs-medium)",
          fontWeight: 700,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
        }}>
          <span>✦ Currently: {currentPolymorph.polymorphName}</span>
          <Button variant="danger" onClick={revertPolymorph} disabled={loading} style={{ padding: "4px 10px", fontSize: "var(--fs-small)" }}>
            Revert
          </Button>
        </div>
      )}

      {/* Manual transform */}
      <div>
        <div style={{ color: theme.colors.muted, fontSize: "var(--fs-small)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>
          Manual transform
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <div>
            <div style={{ color: theme.colors.muted, fontSize: "var(--fs-small)", marginBottom: 4 }}>Armor class</div>
            <input
              value={manualAc}
              onChange={(e) => setManualAc(e.target.value.replace(/[^0-9]/g, ""))}
              placeholder="—"
              inputMode="numeric"
              style={inputStyle}
            />
          </div>
          <div>
            <div style={{ color: theme.colors.muted, fontSize: "var(--fs-small)", marginBottom: 4 }}>Hit points</div>
            <input
              value={manualHp}
              onChange={(e) => setManualHp(e.target.value.replace(/[^0-9]/g, ""))}
              placeholder="—"
              inputMode="numeric"
              style={inputStyle}
            />
          </div>
        </div>
      </div>

      {/* Beast picker */}
      <div>
        <div style={{ color: theme.colors.muted, fontSize: "var(--fs-small)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>
          Select to transform
        </div>

        {/* Filters */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search beasts…"
            style={inputStyle}
          />
          <select value={crMax} onChange={(e) => setCrMax(e.target.value)} style={selectStyle}>
            <option value="">Challenge rating</option>
            {CR_OPTIONS.filter(Boolean).map((cr) => (
              <option key={cr} value={cr}>CR ≤ {cr}</option>
            ))}
          </select>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} style={selectStyle}>
            {typeOptions.map((t) => (
              <option key={t} value={t}>{t === "all" ? "All types" : titleCase(t)}</option>
            ))}
          </select>
          <div style={{ color: theme.colors.muted, fontSize: "var(--fs-small)", alignSelf: "center", paddingLeft: 4 }}>
            {filteredRows.length} creature{filteredRows.length !== 1 ? "s" : ""}
          </div>
        </div>

        {/* Beast list */}
        <div style={{
          maxHeight: 260,
          overflowY: "auto",
          border: `1px solid ${theme.colors.panelBorder}`,
          borderRadius: 8,
        }}>
          {filteredRows.length === 0 ? (
            <div style={{ padding: 12, color: theme.colors.muted, fontSize: "var(--fs-medium)" }}>No creatures found.</div>
          ) : (
            filteredRows.map((row) => (
              <BeastRow
                key={row.id}
                row={row}
                selected={selectedBeast?.id === row.id}
                onSelect={selectBeast}
                onTransform={() => {
                  // Direct transform using row data
                  api<MonsterDetail>(`/api/compendium/monsters/${row.id}`)
                    .then((detail) => {
                      const ac = parseLeadingNumberLoose(detail.ac);
                      const hp = parseLeadingNumberLoose(detail.hp);
                      if (!Number.isFinite(ac) || !Number.isFinite(hp) || ac <= 0 || hp <= 0) return;
                      void applyPolymorph(row.name, row.id, Math.round(ac), Math.round(hp));
                    })
                    .catch(() => {});
                }}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );

  const footer = (
    <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
      <Button variant="ghost" onClick={props.close}>Cancel</Button>
      <Button onClick={() => applyPolymorph()} disabled={loading || !manualAc || !manualHp}>
        Transform
      </Button>
    </div>
  );

  return { body, footer };
}

function BeastRow({
  row,
  selected,
  onSelect,
  onTransform,
}: {
  row: CompendiumMonsterRow;
  selected: boolean;
  onSelect: (r: CompendiumMonsterRow) => void;
  onTransform: () => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "7px 10px",
        borderBottom: `1px solid ${theme.colors.panelBorder}`,
        background: selected ? "rgba(109,40,217,0.12)" : "transparent",
        gap: 8,
      }}
    >
      <span
        style={{ flex: 1, fontSize: "var(--fs-medium)", color: selected ? "#e9d5ff" : theme.colors.text, fontWeight: selected ? 700 : 400, cursor: "pointer" }}
        onClick={() => onSelect(row)}
      >
        {row.name}
      </span>
      <span style={{ color: theme.colors.muted, fontSize: "var(--fs-small)", minWidth: 28, textAlign: "right" }}>
        {formatCr(row.cr)}
      </span>
      <button
        type="button"
        title={`Transform into ${row.name}`}
        onClick={() => onTransform()}
        style={{
          background: "transparent",
          border: "none",
          cursor: "pointer",
          color: theme.colors.accentPrimary,
          fontSize: 16,
          padding: "0 2px",
          lineHeight: 1,
          flexShrink: 0,
        }}
      >
        🐾
      </button>
    </div>
  );
}
