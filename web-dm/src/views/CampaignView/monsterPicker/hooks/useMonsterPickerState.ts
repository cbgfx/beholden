import * as React from "react";
import { api } from "@/services/api";
import { splitLeadingNumberAndDetail } from "@/lib/parse/statDetails";
import type { AddMonsterOptions } from "@/domain/types/domain";
import type { MonsterDetail } from "@/domain/types/compendium";
import type {
  AttackOverridesByMonsterId,
  CompendiumMonsterRow,
  SortMode,
} from "@/views/CampaignView/monsterPicker/types";
import { SIZE_LABELS } from "@/views/CampaignView/monsterPicker/hooks/useMonsterPickerRows";
import { formatAcString, formatHpString } from "@/views/CampaignView/monsterPicker/utils/monsterFormat";

function normalizeMonsterSortName(name: string): string {
  return name
    .trim()
    .replace(/^[^a-z0-9]+/i, "")
    .replace(/^the\s+/i, "")
    .trim();
}

export function useMonsterPickerState(args: {
  isOpen: boolean;
  compQ: string;
  onAddMonster: (monsterId: string, qty: number, opts?: AddMonsterOptions) => void;
}) {
  const { isOpen, compQ, onAddMonster } = args;

  const [selectedMonsterId, setSelectedMonsterId] = React.useState<string | null>(null);
  const [monster, setMonster] = React.useState<MonsterDetail | null>(null);
  const monsterCache = React.useRef<Record<string, MonsterDetail>>({});

  const [qtyById, setQtyById] = React.useState<Record<string, number>>({});
  const [labelById, setLabelById] = React.useState<Record<string, string>>({});
  const [acById, setAcById] = React.useState<Record<string, string>>({});
  const [acDetailById, setAcDetailById] = React.useState<Record<string, string>>({});
  const [hpById, setHpById] = React.useState<Record<string, string>>({});
  const [hpDetailById, setHpDetailById] = React.useState<Record<string, string>>({});
  const [friendlyById, setFriendlyById] = React.useState<Record<string, boolean>>({});
  const [attackOverridesById, setAttackOverridesById] = React.useState<AttackOverridesByMonsterId>({});

  const [sortMode, setSortMode] = React.useState<SortMode>("az");
  const [envFilter, setEnvFilter] = React.useState<string>("all");
  const [sizeFilter, setSizeFilter] = React.useState<string>("all");
  const [typeFilter, setTypeFilter] = React.useState<string>("all");
  const [crMin, setCrMin] = React.useState<string>("");
  const [crMax, setCrMax] = React.useState<string>("");

  const [filteredRows, setFilteredRows] = React.useState<CompendiumMonsterRow[]>([]);
  const [loadingIndex, setLoadingIndex] = React.useState(false);
  const [indexError, setIndexError] = React.useState<string | null>(null);
  const [envOptions, setEnvOptions] = React.useState<string[]>(["all"]);
  const [sizeOptions, setSizeOptions] = React.useState<string[]>(["all"]);
  const [typeOptions, setTypeOptions] = React.useState<string[]>(["all"]);

  React.useEffect(() => {
    if (!isOpen) return;
    const controller = new AbortController();
    api<{ environments: string[]; sizes: string[]; types: string[] }>("/api/compendium/monsters/facets", {
      signal: controller.signal,
    })
      .then((data) => {
        const nextEnv = Array.isArray(data?.environments) ? data.environments : [];
        const nextSizesRaw = Array.isArray(data?.sizes) ? data.sizes : [];
        const nextTypes = Array.isArray(data?.types) ? data.types : [];

        const sizeOrder = new Map<string, number>(SIZE_LABELS.map((size, index) => [size, index]));
        const nextSizes = [...nextSizesRaw].sort((a, b) => {
          const aOrder = sizeOrder.get(a);
          const bOrder = sizeOrder.get(b);
          if (aOrder != null && bOrder != null) return aOrder - bOrder;
          if (aOrder != null) return -1;
          if (bOrder != null) return 1;
          return a.localeCompare(b);
        });

        setEnvOptions(["all", ...nextEnv]);
        setSizeOptions(["all", ...nextSizes]);
        setTypeOptions(["all", ...nextTypes]);
      })
      .catch(() => {
        setEnvOptions(["all"]);
        setSizeOptions(["all"]);
        setTypeOptions(["all"]);
      });
    return () => controller.abort();
  }, [isOpen]);

  React.useEffect(() => {
    if (!isOpen) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoadingIndex(true);
      setIndexError(null);
      try {
        const params = new URLSearchParams({
          q: compQ,
          limit:
            compQ.trim().length >= 2
            || envFilter !== "all"
            || sizeFilter !== "all"
            || typeFilter !== "all"
            || Boolean(crMin.trim())
            || Boolean(crMax.trim())
              ? "200"
              : "120",
          offset: "0",
          sort: sortMode,
          fields: "id,name,cr,type,environment",
        });
        if (envFilter !== "all") params.set("env", envFilter);
        if (sizeFilter !== "all") params.set("sizes", sizeFilter);
        if (typeFilter !== "all") params.set("types", typeFilter);
        if (crMin.trim()) params.set("crMin", crMin.trim());
        if (crMax.trim()) params.set("crMax", crMax.trim());

        const rows = await api<CompendiumMonsterRow[]>(`/api/compendium/search?${params.toString()}`, {
          signal: controller.signal,
        });
        if (controller.signal.aborted) return;
        setFilteredRows(Array.isArray(rows) ? rows : []);
      } catch (error) {
        if (controller.signal.aborted) return;
        setFilteredRows([]);
        setIndexError(error instanceof Error ? error.message : String(error));
      } finally {
        if (!controller.signal.aborted) setLoadingIndex(false);
      }
    }, 220);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [isOpen, compQ, sortMode, envFilter, sizeFilter, typeFilter, crMin, crMax]);

  const hydrateMonster = React.useCallback(async (monsterId: string): Promise<MonsterDetail> => {
    if (monsterCache.current[monsterId]) return monsterCache.current[monsterId]!;
    const m = await api<MonsterDetail>(`/api/compendium/monsters/${monsterId}`);
    monsterCache.current[monsterId] = m;

    const acSplit = splitLeadingNumberAndDetail(String(m.ac ?? "")) as any;
    const hpSplit = splitLeadingNumberAndDetail(String(m.hp ?? "")) as any;
    const acNumText = acSplit?.numText ?? String(acSplit?.leadingNumber ?? "");
    const acDetailText = acSplit?.detail ?? "";
    const hpNumText = hpSplit?.numText ?? String(hpSplit?.leadingNumber ?? "");
    const hpDetailText = hpSplit?.detail ?? "";

    setQtyById((prev) => ({ ...prev, [monsterId]: prev[monsterId] ?? 1 }));
    setLabelById((prev) => ({ ...prev, [monsterId]: prev[monsterId] ?? "" }));
    setAcById((prev) => ({ ...prev, [monsterId]: prev[monsterId] ?? acNumText }));
    setAcDetailById((prev) => ({ ...prev, [monsterId]: prev[monsterId] ?? acDetailText }));
    setHpById((prev) => ({ ...prev, [monsterId]: prev[monsterId] ?? hpNumText }));
    setHpDetailById((prev) => ({ ...prev, [monsterId]: prev[monsterId] ?? hpDetailText }));
    setFriendlyById((prev) => ({ ...prev, [monsterId]: prev[monsterId] ?? false }));

    return m;
  }, []);

  React.useEffect(() => {
    if (!isOpen || !filteredRows.length) return;
    if (!selectedMonsterId || !filteredRows.some((row) => row.id === selectedMonsterId)) {
      setSelectedMonsterId(filteredRows[0]!.id);
    }
  }, [isOpen, selectedMonsterId, filteredRows]);

  React.useEffect(() => {
    if (!isOpen || !selectedMonsterId) return;
    const row = filteredRows.find((entry) => entry.id === selectedMonsterId);
    if (!row) return;
    setLabelById((prev) => (prev[selectedMonsterId] ? prev : { ...prev, [selectedMonsterId]: row.name }));
  }, [isOpen, selectedMonsterId, filteredRows]);

  React.useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!isOpen || !selectedMonsterId) {
        setMonster(null);
        return;
      }
      try {
        const m = await hydrateMonster(selectedMonsterId);
        if (!cancelled) setMonster(m);
      } catch {
        if (!cancelled) setMonster(null);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [isOpen, selectedMonsterId, hydrateMonster]);

  React.useEffect(() => {
    if (!isOpen || !selectedMonsterId || !monster) return;
    if (monster.id && String(monster.id) !== String(selectedMonsterId)) return;

    const id = selectedMonsterId;
    const acSplit = splitLeadingNumberAndDetail(formatAcString(monster));
    const hpSplit = splitLeadingNumberAndDetail(formatHpString(monster));

    setAcById((prev) => (prev[id] != null && prev[id] !== "" ? prev : { ...prev, [id]: (acSplit as any).numText }));
    setAcDetailById((prev) => (prev[id] != null && prev[id] !== "" ? prev : { ...prev, [id]: (acSplit as any).detail }));
    setHpById((prev) => (prev[id] != null && prev[id] !== "" ? prev : { ...prev, [id]: (hpSplit as any).numText }));
    setHpDetailById((prev) => (prev[id] != null && prev[id] !== "" ? prev : { ...prev, [id]: (hpSplit as any).detail }));
    setFriendlyById((prev) => (prev[id] != null ? prev : { ...prev, [id]: false }));
  }, [isOpen, selectedMonsterId, monster]);

  const onChangeAttack = React.useCallback(
    (actionName: string, patch: { toHit?: number; damage?: string; damageType?: string }) => {
      if (!selectedMonsterId) return;
      setAttackOverridesById((prev) => {
        const current = prev[selectedMonsterId] ?? {};
        return {
          ...prev,
          [selectedMonsterId]: {
            ...current,
            [actionName]: { ...(current[actionName] ?? {}), ...patch },
          },
        };
      });
    },
    [selectedMonsterId],
  );

  const lettersInList = React.useMemo(() => {
    const set = new Set<string>();
    for (const row of filteredRows) {
      const first = normalizeMonsterSortName(String(row.name ?? "")).charAt(0).toUpperCase();
      if (first >= "A" && first <= "Z") set.add(first);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [filteredRows]);

  const letterFirstIndex = React.useMemo(() => {
    const out: Record<string, number> = {};
    for (let i = 0; i < filteredRows.length; i += 1) {
      const first = normalizeMonsterSortName(String(filteredRows[i].name ?? "")).charAt(0).toUpperCase();
      if (!(first >= "A" && first <= "Z")) continue;
      if (out[first] == null) out[first] = i;
    }
    return out;
  }, [filteredRows]);

  const listScrollToIndexRef = React.useRef<((idx: number) => void) | null>(null);
  const onJumpToLetter = React.useCallback(
    (letter: string) => {
      const index = letterFirstIndex[letter];
      if (index == null) return;
      listScrollToIndexRef.current?.(index);
    },
    [letterFirstIndex],
  );

  const handleAddMonster = React.useCallback(
    async (monsterId: string, qty: number, opts?: AddMonsterOptions) => {
      try {
        let acRaw = acById[monsterId];
        let hpRaw = hpById[monsterId];

        if (acRaw == null || hpRaw == null) {
          const m = await hydrateMonster(monsterId);
          const acSplitAny: any = splitLeadingNumberAndDetail(formatAcString(m));
          const hpSplitAny: any = splitLeadingNumberAndDetail(formatHpString(m));
          acRaw = String(acSplitAny.numText ?? acSplitAny.leadingNumber ?? "");
          hpRaw = String(hpSplitAny.numText ?? hpSplitAny.leadingNumber ?? "");
        }

        await Promise.resolve(
          onAddMonster(monsterId, qty, {
            friendly: opts?.friendly ?? (friendlyById[monsterId] ?? false),
            labelBase: (labelById[monsterId] ?? "").trim() || undefined,
            ac: Number.isFinite(Number(opts?.ac ?? acRaw)) ? Number(opts?.ac ?? acRaw) : undefined,
            acDetails: (opts?.acDetails ?? (acDetailById[monsterId] ?? "").trim()) || undefined,
            hpMax: Number.isFinite(Number(opts?.hpMax ?? hpRaw)) ? Number(opts?.hpMax ?? hpRaw) : undefined,
            hpDetails: (opts?.hpDetails ?? (hpDetailById[monsterId] ?? "").trim()) || undefined,
            attackOverrides: opts?.attackOverrides ?? (attackOverridesById[monsterId] ?? null) ?? undefined,
          }),
        );
      } catch (e) {
        alert(e instanceof Error ? e.message : String(e));
      }
    },
    [
      acById,
      hpById,
      friendlyById,
      labelById,
      acDetailById,
      hpDetailById,
      attackOverridesById,
      hydrateMonster,
      onAddMonster,
    ],
  );

  const selectedLabel = selectedMonsterId ? (labelById[selectedMonsterId] ?? "") : "";
  const selectedAc = selectedMonsterId ? (acById[selectedMonsterId] ?? "") : "";
  const selectedAcDetail = selectedMonsterId ? (acDetailById[selectedMonsterId] ?? "") : "";
  const selectedHp = selectedMonsterId ? (hpById[selectedMonsterId] ?? "") : "";
  const selectedHpDetail = selectedMonsterId ? (hpDetailById[selectedMonsterId] ?? "") : "";
  const selectedFriendly = selectedMonsterId ? (friendlyById[selectedMonsterId] ?? false) : false;

  return {
    selectedMonsterId,
    setSelectedMonsterId,
    monster,

    qtyById,
    labelById,
    acById,
    acDetailById,
    hpById,
    hpDetailById,
    friendlyById,
    attackOverridesById,

    setQtyForId: (id: string, qty: number) => setQtyById((prev) => ({ ...prev, [id]: qty })),
    setLabelForId: (id: string, value: string) => setLabelById((prev) => ({ ...prev, [id]: value })),
    setAcForId: (id: string, numText: string, detail: string) => {
      setAcById((prev) => ({ ...prev, [id]: numText }));
      setAcDetailById((prev) => ({ ...prev, [id]: detail }));
    },
    setHpForId: (id: string, numText: string, detail: string) => {
      setHpById((prev) => ({ ...prev, [id]: numText }));
      setHpDetailById((prev) => ({ ...prev, [id]: detail }));
    },
    setFriendlyForId: (id: string, value: boolean) => setFriendlyById((prev) => ({ ...prev, [id]: value })),
    onChangeAttack,

    sortMode,
    setSortMode,
    envFilter,
    setEnvFilter,
    envOptions,
    sizeFilter,
    setSizeFilter,
    sizeOptions,
    typeFilter,
    setTypeFilter,
    typeOptions,
    crMin,
    setCrMin,
    crMax,
    setCrMax,
    filteredRows,
    lettersInList,
    onJumpToLetter,
    listScrollToIndexRef,
    loadingIndex,
    indexError,

    selectedLabel,
    selectedAc,
    selectedAcDetail,
    selectedHp,
    selectedHpDetail,
    selectedFriendly,

    handleAddMonster,
    clearFilters: () => {
      setEnvFilter("all");
      setSizeFilter("all");
      setTypeFilter("all");
      setCrMin("");
      setCrMax("");
      setSortMode("az");
    },
  };
}
