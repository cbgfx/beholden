import React from "react";
import { getPolymorphCondition, type SharedPolymorphCondition } from "@beholden/shared/domain";
import { Button } from "@/ui/Button";
import { api, jsonInit } from "@/services/api";
import { theme } from "@/theme/theme";
import { useStore, type DrawerState } from "@/store";
import type { DrawerContent } from "@/drawers/types";
import type { CompendiumMonsterRow } from "@/views/CampaignView/monsterPicker/types";
import type { MonsterDetail } from "@/domain/types/compendium";
import { parseLeadingNumberLoose } from "@/views/CampaignView/monsterPicker/utils";
import {
  inputStyle,
  PolymorphCreatureList,
  PolymorphCurrentBanner,
} from "./PolymorphDrawerParts";

type PolymorphDrawerState = Exclude<
  Extract<DrawerState, { type: "polymorphTransform" }>,
  null
>;

export type PolymorphCondition = SharedPolymorphCondition;

export function PolymorphDrawer(props: {
  drawer: PolymorphDrawerState;
  close: () => void;
  refreshEncounter: (eid: string | null) => Promise<void>;
}): DrawerContent {
  const { state } = useStore();

  const combatant = React.useMemo(
    () => state.combatants.find((combatantRow) => combatantRow.id === props.drawer.combatantId),
    [props.drawer.combatantId, state.combatants],
  );

  const currentPolymorph = React.useMemo(
    () => getPolymorphCondition(combatant?.conditions),
    [combatant],
  );

  const [rows, setRows] = React.useState<CompendiumMonsterRow[]>([]);
  const [typeOptions, setTypeOptions] = React.useState<string[]>(["all"]);

  const [q, setQ] = React.useState("");
  const [crMax, setCrMax] = React.useState("");
  const [typeFilter, setTypeFilter] = React.useState("beast");
  const [manualAc, setManualAc] = React.useState("");
  const [manualHp, setManualHp] = React.useState("");
  const [selectedBeast, setSelectedBeast] = React.useState<{ id: string; name: string } | null>(null);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    const controller = new AbortController();
    api<{ environments: string[]; sizes: string[]; types: string[] }>("/api/compendium/monsters/facets", {
      signal: controller.signal,
    })
      .then((data) => {
        const nextTypes = Array.isArray(data?.types) ? data.types : [];
        setTypeOptions(["all", ...nextTypes]);
      })
      .catch(() => setTypeOptions(["all"]));
    return () => controller.abort();
  }, []);

  React.useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const params = new URLSearchParams({
          q,
          limit:
            q.trim().length >= 2
            || typeFilter !== "all"
            || Boolean(crMax.trim())
              ? "200"
              : "120",
          sort: "crAsc",
        });
        if (typeFilter !== "all") params.set("types", typeFilter);
        if (crMax.trim()) params.set("crMax", crMax.trim());
        const data = await api<CompendiumMonsterRow[]>(`/api/compendium/search?${params.toString()}`, {
          signal: controller.signal,
        });
        if (controller.signal.aborted) return;
        setRows(Array.isArray(data) ? data : []);
      } catch {
        if (controller.signal.aborted) return;
        setRows([]);
      }
    }, 220);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [q, crMax, typeFilter]);

  const filteredRows = rows;

  const selectBeast = React.useCallback(async (row: CompendiumMonsterRow) => {
    setSelectedBeast({ id: row.id, name: row.name });
    try {
      const detail = await api<MonsterDetail>(`/api/compendium/monsters/${row.id}`);
      const ac = parseLeadingNumberLoose(detail.ac);
      const hp = parseLeadingNumberLoose(detail.hp);
      if (Number.isFinite(ac)) setManualAc(String(Math.round(ac)));
      if (Number.isFinite(hp)) setManualHp(String(Math.round(hp)));
    } catch {
      // leave fields as-is
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
        ...(combatant.conditions ?? []).filter((entry) => entry.key !== "polymorphed"),
        condition,
      ];
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
          }),
        );
        await props.refreshEncounter(props.drawer.encounterId);
        props.close();
      } finally {
        setLoading(false);
      }
    },
    [combatant, manualAc, manualHp, props, selectedBeast],
  );

  const revertPolymorph = React.useCallback(async () => {
    if (!combatant || !currentPolymorph) return;
    const nextConditions = (combatant.conditions ?? []).filter((entry) => entry.key !== "polymorphed");
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
        }),
      );
      await props.refreshEncounter(props.drawer.encounterId);
      props.close();
    } finally {
      setLoading(false);
    }
  }, [combatant, currentPolymorph, props]);

  const body = (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <p style={{ color: theme.colors.muted, fontSize: "var(--fs-medium)", lineHeight: 1.5, margin: 0 }}>
        Transform the entity into another creature. You can use this for a druid's Wild Shape, or for the Polymorph spell.
        Damage and healing is handled as normal while transformed.
      </p>

      {currentPolymorph && (
        <PolymorphCurrentBanner polymorphName={currentPolymorph.polymorphName} loading={loading} onRevert={revertPolymorph} />
      )}

      <div>
        <div style={{ color: theme.colors.muted, fontSize: "var(--fs-small)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>
          Manual transform
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <div>
            <div style={{ color: theme.colors.muted, fontSize: "var(--fs-small)", marginBottom: 4 }}>Armor class</div>
            <input
              value={manualAc}
              onChange={(event) => setManualAc(event.target.value.replace(/[^0-9]/g, ""))}
              placeholder="-"
              inputMode="numeric"
              style={inputStyle}
            />
          </div>
          <div>
            <div style={{ color: theme.colors.muted, fontSize: "var(--fs-small)", marginBottom: 4 }}>Hit points</div>
            <input
              value={manualHp}
              onChange={(event) => setManualHp(event.target.value.replace(/[^0-9]/g, ""))}
              placeholder="-"
              inputMode="numeric"
              style={inputStyle}
            />
          </div>
        </div>
      </div>

      <PolymorphCreatureList
        rows={filteredRows}
        selectedId={selectedBeast?.id ?? null}
        typeOptions={typeOptions}
        query={q}
        crMax={crMax}
        typeFilter={typeFilter}
        onQueryChange={setQ}
        onCrMaxChange={setCrMax}
        onTypeFilterChange={setTypeFilter}
        onSelect={selectBeast}
        onTransform={(row) => {
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
