import * as React from "react";
import { api } from "@/services/api";
import { splitLeadingNumberAndDetail } from "@/lib/parse/statDetails";
import type { AddMonsterOptions } from "@/domain/types/domain";
import type { MonsterDetail } from "@/domain/types/compendium";
import type { AttackOverridesByMonsterId, CompendiumMonsterRow, SortMode } from "@/views/CampaignView/monsterPicker/types";
import { useMonsterPickerRows } from "@/views/CampaignView/monsterPicker/hooks/useMonsterPickerRows";
import { formatAcString, formatHpString } from "@/views/CampaignView/monsterPicker/utils/monsterFormat";

export function useMonsterPickerState(args: {
  isOpen: boolean;
  compQ: string;
  compRows: CompendiumMonsterRow[];
  baseRows: CompendiumMonsterRow[];
  onAddMonster: (monsterId: string, qty: number, opts?: AddMonsterOptions) => void;
}) {
  const { isOpen, compQ, baseRows, onAddMonster } = args;

  // Selected monster + loaded detail
  const [selectedMonsterId, setSelectedMonsterId] = React.useState<string | null>(null);
  const [monster, setMonster] = React.useState<MonsterDetail | null>(null);
  const monsterCache = React.useRef<Record<string, MonsterDetail>>({});

  // Per-monster overrides (committed atomically when Add is clicked)
  const [qtyById, setQtyById] = React.useState<Record<string, number>>({});
  const [labelById, setLabelById] = React.useState<Record<string, string>>({});
  const [acById, setAcById] = React.useState<Record<string, string>>({});
  const [acDetailById, setAcDetailById] = React.useState<Record<string, string>>({});
  const [hpById, setHpById] = React.useState<Record<string, string>>({});
  const [hpDetailById, setHpDetailById] = React.useState<Record<string, string>>({});
  const [friendlyById, setFriendlyById] = React.useState<Record<string, boolean>>({});
  const [attackOverridesById, setAttackOverridesById] = React.useState<AttackOverridesByMonsterId>({});

  // List filter/sort controls
  const [sortMode, setSortMode] = React.useState<SortMode>("az");
  const [envFilter, setEnvFilter] = React.useState<string>("all");
  const [sizeFilter, setSizeFilter] = React.useState<string>("all");
  const [typeFilter, setTypeFilter] = React.useState<string>("all");
  const [crMin, setCrMin] = React.useState<string>("");
  const [crMax, setCrMax] = React.useState<string>("");

  const { filteredRows, envOptions, sizeOptions, typeOptions, lettersInList, letterFirstIndex } = useMonsterPickerRows({
    rows: baseRows,
    compQ,
    sortMode,
    envFilter,
    sizeFilter,
    typeFilter,
    crMin,
    crMax,
  });

  // Fetch and cache a monster detail, seeding per-monster defaults on first load
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

  // Auto-select first row when list changes
  React.useEffect(() => {
    if (!isOpen || !filteredRows.length) return;
    if (!selectedMonsterId || !filteredRows.some((r) => r.id === selectedMonsterId)) {
      setSelectedMonsterId(filteredRows[0]!.id);
    }
  }, [isOpen, selectedMonsterId, filteredRows]);

  // Ensure default label when a row is selected
  React.useEffect(() => {
    if (!isOpen || !selectedMonsterId) return;
    const row = baseRows.find((r) => r.id === selectedMonsterId);
    if (!row) return;
    setLabelById((prev) => (prev[selectedMonsterId] ? prev : { ...prev, [selectedMonsterId]: row.name }));
  }, [isOpen, selectedMonsterId, baseRows]);

  // Load monster detail for the selected monster
  React.useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!isOpen || !selectedMonsterId) { setMonster(null); return; }
      try {
        const m = await hydrateMonster(selectedMonsterId);
        if (!cancelled) setMonster(m);
      } catch {
        if (!cancelled) setMonster(null);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [isOpen, selectedMonsterId, hydrateMonster]);

  // Prefill editable AC/HP from loaded monster
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
        const cur = prev[selectedMonsterId] ?? {};
        return { ...prev, [selectedMonsterId]: { ...cur, [actionName]: { ...(cur[actionName] ?? {}), ...patch } } };
      });
    },
    [selectedMonsterId]
  );

  // Scroll-to-index ref lives here so the modal can pass it to the list pane
  const listScrollToIndexRef = React.useRef<((idx: number) => void) | null>(null);
  const onJumpToLetter = React.useCallback(
    (letter: string) => {
      const idx = letterFirstIndex[letter];
      if (idx == null) return;
      listScrollToIndexRef.current?.(idx);
    },
    [letterFirstIndex]
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
          })
        );
      } catch (e) {
        alert(e instanceof Error ? e.message : String(e));
      }
    },
    [acById, hpById, friendlyById, labelById, acDetailById, hpDetailById, attackOverridesById, hydrateMonster, onAddMonster]
  );

  // Derived selected-monster values for the detail pane
  const selectedLabel = selectedMonsterId ? (labelById[selectedMonsterId] ?? "") : "";
  const selectedAc = selectedMonsterId ? (acById[selectedMonsterId] ?? "") : "";
  const selectedAcDetail = selectedMonsterId ? (acDetailById[selectedMonsterId] ?? "") : "";
  const selectedHp = selectedMonsterId ? (hpById[selectedMonsterId] ?? "") : "";
  const selectedHpDetail = selectedMonsterId ? (hpDetailById[selectedMonsterId] ?? "") : "";
  const selectedFriendly = selectedMonsterId ? (friendlyById[selectedMonsterId] ?? false) : false;

  return {
    // Selection
    selectedMonsterId,
    setSelectedMonsterId,
    monster,

    // Per-monster maps (passed to list pane)
    qtyById,
    labelById,
    acById,
    acDetailById,
    hpById,
    hpDetailById,
    friendlyById,
    attackOverridesById,

    // Setters
    setQtyForId: (id: string, qty: number) => setQtyById((prev) => ({ ...prev, [id]: qty })),
    setLabelForId: (id: string, v: string) => setLabelById((prev) => ({ ...prev, [id]: v })),
    setAcForId: (id: string, numText: string, detail: string) => {
      setAcById((prev) => ({ ...prev, [id]: numText }));
      setAcDetailById((prev) => ({ ...prev, [id]: detail }));
    },
    setHpForId: (id: string, numText: string, detail: string) => {
      setHpById((prev) => ({ ...prev, [id]: numText }));
      setHpDetailById((prev) => ({ ...prev, [id]: detail }));
    },
    setFriendlyForId: (id: string, v: boolean) => setFriendlyById((prev) => ({ ...prev, [id]: v })),
    onChangeAttack,

    // List state
    sortMode, setSortMode,
    envFilter, setEnvFilter,
    envOptions,
    sizeFilter, setSizeFilter,
    sizeOptions,
    typeFilter, setTypeFilter,
    typeOptions,
    crMin, setCrMin,
    crMax, setCrMax,
    filteredRows,
    lettersInList,
    onJumpToLetter,
    listScrollToIndexRef,

    // Detail pane derived values
    selectedLabel,
    selectedAc,
    selectedAcDetail,
    selectedHp,
    selectedHpDetail,
    selectedFriendly,

    // Actions
    handleAddMonster,
    clearFilters: () => { setEnvFilter("all"); setSizeFilter("all"); setTypeFilter("all"); setCrMin(""); setCrMax(""); setSortMode("az"); },
  };
}
