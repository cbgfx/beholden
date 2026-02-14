import * as React from "react";
import { api } from "@/services/api";
import { splitLeadingNumberAndDetail } from "@/lib/parse/statDetails";
import type { AddMonsterOptions } from "@/domain/types/domain";
import { IconButton } from "@/ui/IconButton";
import { IconClose } from "@/icons";
import { Modal } from "@/components/overlay/Modal";

import type { AttackOverridesByMonsterId, CompendiumMonsterRow, SortMode } from "@/views/CampaignView/monsterPicker/types";
import { useCompendiumIndexFallback } from "@/views/CampaignView/monsterPicker/hooks/useCompendiumIndexFallback";
import { useMonsterPickerRows } from "@/views/CampaignView/monsterPicker/hooks/useMonsterPickerRows";
import { MonsterPickerListPane } from "@/views/CampaignView/monsterPicker/components/MonsterPickerListPane";
import { MonsterPickerDetailPane } from "@/views/CampaignView/monsterPicker/components/MonsterPickerDetailPane";
import { formatAcString, formatHpString } from "@/views/CampaignView/monsterPicker/utils/monsterFormat";

export { type CompendiumMonsterRow } from "@/views/CampaignView/monsterPicker/types";

export function MonsterPickerModal(props: {
  isOpen: boolean;
  onClose: () => void;

  compQ: string;
  onChangeCompQ: (q: string) => void;
  compRows: CompendiumMonsterRow[];

  onAddMonster: (monsterId: string, qty: number, opts?: AddMonsterOptions) => void;
}) {
  const { rows: baseRows, loadingIndex, indexError } = useCompendiumIndexFallback({ isOpen: props.isOpen, providedRows: props.compRows });

  const [selectedMonsterId, setSelectedMonsterId] = React.useState<string | null>(null);
  const [monster, setMonster] = React.useState<any | null>(null);

  // Per-monster overrides stored in the modal (commit is atomic when Add is clicked).
  const [qtyById, setQtyById] = React.useState<Record<string, number>>({});
  const [labelById, setLabelById] = React.useState<Record<string, string>>({});
  const [acById, setAcById] = React.useState<Record<string, string>>({});
  const [acDetailById, setAcDetailById] = React.useState<Record<string, string>>({});
  const [hpById, setHpById] = React.useState<Record<string, string>>({});
  const [hpDetailById, setHpDetailById] = React.useState<Record<string, string>>({});
  const [friendlyById, setFriendlyById] = React.useState<Record<string, boolean>>({});
  const [attackOverridesById, setAttackOverridesById] = React.useState<AttackOverridesByMonsterId>({});

  const monsterCache = React.useRef<Record<string, any>>({});

  const hydrateMonster = React.useCallback(async (monsterId: string) => {
    if (monsterCache.current[monsterId]) return monsterCache.current[monsterId];
    const m = await api<any>(`/api/compendium/monsters/${monsterId}`);
    monsterCache.current[monsterId] = m;

    // Fill defaults if we don't already have overrides for that monster.
    // splitLeadingNumberAndDetail has evolved over time; support both shapes.
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

  // List controls
  const [sortMode, setSortMode] = React.useState<SortMode>("az");
  const [envFilter, setEnvFilter] = React.useState<string>("all");
  const [crMin, setCrMin] = React.useState<string>("");
  const [crMax, setCrMax] = React.useState<string>("");

  const { filteredRows, envOptions, lettersInList, letterFirstIndex } = useMonsterPickerRows({
    rows: baseRows,
    compQ: props.compQ,
    sortMode,
    envFilter,
    crMin,
    crMax
  });

  // When opening, select the first visible result.
  React.useEffect(() => {
    if (!props.isOpen) return;
    if (!filteredRows.length) return;

    if (!selectedMonsterId) {
      setSelectedMonsterId(filteredRows[0].id);
      return;
    }

    if (!filteredRows.some((r) => r.id === selectedMonsterId)) {
      setSelectedMonsterId(filteredRows[0].id);
    }
  }, [props.isOpen, selectedMonsterId, filteredRows]);

  // Ensure default label
  React.useEffect(() => {
    if (!props.isOpen) return;
    if (!selectedMonsterId) return;
    const row = baseRows.find((r) => r.id === selectedMonsterId);
    if (!row) return;
    setLabelById((prev) => (prev[selectedMonsterId] ? prev : { ...prev, [selectedMonsterId]: row.name }));
  }, [props.isOpen, selectedMonsterId, baseRows]);

  // Load monster detail for preview
  React.useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!props.isOpen) return;
      if (!selectedMonsterId) {
        setMonster(null);
        return;
      }
      try {
        // Use the modal cache so we don't double-fetch.
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
  }, [props.isOpen, selectedMonsterId, hydrateMonster]);

  // Prefill editable AC/HP from the loaded monster record
  React.useEffect(() => {
    if (!props.isOpen) return;
    if (!selectedMonsterId) return;
    if (!monster) return;
    if ((monster as any).id && String((monster as any).id) !== String(selectedMonsterId)) return;

    const id = selectedMonsterId;
    const defaultAcRaw = formatAcString(monster);
    const defaultHpRaw = formatHpString(monster);
    const acSplit = splitLeadingNumberAndDetail(defaultAcRaw);
    const hpSplit = splitLeadingNumberAndDetail(defaultHpRaw);

    setAcById((prev) => (prev[id] != null && prev[id] !== "" ? prev : { ...prev, [id]: acSplit.numText }));
    setAcDetailById((prev) => (prev[id] != null && prev[id] !== "" ? prev : { ...prev, [id]: acSplit.detail }));
    setHpById((prev) => (prev[id] != null && prev[id] !== "" ? prev : { ...prev, [id]: hpSplit.numText }));
    setHpDetailById((prev) => (prev[id] != null && prev[id] !== "" ? prev : { ...prev, [id]: hpSplit.detail }));
    setFriendlyById((prev) => (prev[id] != null ? prev : { ...prev, [id]: false }));
  }, [props.isOpen, selectedMonsterId, monster]);

  const onChangeAttack = React.useCallback(
    (actionName: string, patch: { toHit?: number; damage?: string; damageType?: string }) => {
      if (!selectedMonsterId) return;
      setAttackOverridesById((prev) => {
        const cur = prev[selectedMonsterId] ?? {};
        const next = { ...cur, [actionName]: { ...(cur[actionName] ?? {}), ...patch } };
        return { ...prev, [selectedMonsterId]: next };
      });
    },
    [selectedMonsterId]
  );

  // NOTE: list pane needs direct access to scroll-to-index.
  const listScrollToIndexRef = React.useRef<((idx: number) => void) | null>(null);
  const onJumpToLetter = React.useCallback(
    (letter: string) => {
      const idx = letterFirstIndex[letter];
      if (idx == null) return;
      listScrollToIndexRef.current?.(idx);
    },
    [letterFirstIndex]
  );

  const selectedLabel = selectedMonsterId ? labelById[selectedMonsterId] ?? "" : "";
  const selectedAc = selectedMonsterId ? acById[selectedMonsterId] ?? "" : "";
  const selectedAcDetail = selectedMonsterId ? acDetailById[selectedMonsterId] ?? "" : "";
  const selectedHp = selectedMonsterId ? hpById[selectedMonsterId] ?? "" : "";
  const selectedHpDetail = selectedMonsterId ? hpDetailById[selectedMonsterId] ?? "" : "";
  const selectedFriendly = selectedMonsterId ? friendlyById[selectedMonsterId] ?? false : false;

  const handleAddMonster = React.useCallback(
    async (monsterId: string, qty: number, opts?: { friendly?: boolean }) => {
      // If the user clicks "Add" without selecting a monster first, hydrate defaults on-demand.
      let acRaw = acById[monsterId];
      let hpRaw = hpById[monsterId];

      if (acRaw == null || hpRaw == null) {
        const m = await hydrateMonster(monsterId);

        // Derive sane defaults from the monster's base AC/HP.
        const acSplitAny: any = splitLeadingNumberAndDetail(formatAcString(m));
        const hpSplitAny: any = splitLeadingNumberAndDetail(formatHpString(m));

        acRaw = String(acSplitAny.numText ?? acSplitAny.leadingNumber ?? "");
        hpRaw = String(hpSplitAny.numText ?? hpSplitAny.leadingNumber ?? "");
      }

      props.onAddMonster(monsterId, qty, {
        friendly: opts?.friendly ?? (friendlyById[monsterId] ?? false),
        labelBase: (labelById[monsterId] ?? "").trim() || undefined,
        ac: Number.isFinite(Number(acRaw)) ? Number(acRaw) : undefined,
        acDetail: (acDetailById[monsterId] ?? "").trim() || undefined,
        hpMax: Number.isFinite(Number(hpRaw)) ? Number(hpRaw) : undefined,
        hpDetail: (hpDetailById[monsterId] ?? "").trim() || undefined
      });
    },
    [acById, hpById, friendlyById, labelById, acDetailById, hpDetailById, hydrateMonster, props]
  );

  return (
    <Modal
      isOpen={props.isOpen}
      onClose={props.onClose}
      title={
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 5 }}>
          <div style={{ fontWeight: 900 }}>Add monsters</div>
          <IconButton title="Close" variant="ghost" onClick={props.onClose}>
            <IconClose />
          </IconButton>
        </div>
      }
      width={1100}
    >
      <div style={{ height: "70vh", fontSize: "var(--fs-medium)", lineHeight: "16px", minHeight: 520, overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: "420px 1fr", gap: 7, height: "100%", minHeight: 0 }}>
          <MonsterPickerListPane
            isOpen={props.isOpen}
            compQ={props.compQ}
            onChangeCompQ={props.onChangeCompQ}
            sortMode={sortMode}
            onChangeSortMode={setSortMode}
            envFilter={envFilter}
            onChangeEnvFilter={setEnvFilter}
            envOptions={envOptions}
            crMin={crMin}
            crMax={crMax}
            onChangeCrMin={setCrMin}
            onChangeCrMax={setCrMax}
            onQuickCr={(min, max) => {
              setCrMin(min);
              setCrMax(max);
            }}
            onClear={() => {
              setEnvFilter("all");
              setCrMin("");
              setCrMax("");
              setSortMode("az");
            }}
            loadingIndex={loadingIndex}
            indexError={indexError}
            rows={filteredRows}
            selectedMonsterId={selectedMonsterId}
            onSelectMonster={setSelectedMonsterId}
            lettersInList={lettersInList}
            onJumpToLetter={onJumpToLetter}
            qtyById={qtyById}
            setQtyForId={(id, qty) => setQtyById((prev) => ({ ...prev, [id]: qty }))}
            labelById={labelById}
            acById={acById}
            acDetailById={acDetailById}
            hpById={hpById}
            hpDetailById={hpDetailById}
            friendlyById={friendlyById}
            attackOverridesById={attackOverridesById}
            onAddMonster={handleAddMonster}
            onProvideScrollToIndex={(fn) => {
              listScrollToIndexRef.current = fn;
            }}
          />

          <MonsterPickerDetailPane
            selectedMonsterId={selectedMonsterId}
            monster={monster}
            label={selectedLabel}
            onChangeLabel={(v) => {
              if (!selectedMonsterId) return;
              setLabelById((prev) => ({ ...prev, [selectedMonsterId]: v }));
            }}
            ac={selectedAc}
            acDetail={selectedAcDetail}
            hp={selectedHp}
            hpDetail={selectedHpDetail}
            friendly={selectedFriendly}
            onChangeAc={(numText, detail) => {
              if (!selectedMonsterId) return;
              setAcById((prev) => ({ ...prev, [selectedMonsterId]: numText }));
              setAcDetailById((prev) => ({ ...prev, [selectedMonsterId]: detail }));
            }}
            onChangeHp={(numText, detail) => {
              if (!selectedMonsterId) return;
              setHpById((prev) => ({ ...prev, [selectedMonsterId]: numText }));
              setHpDetailById((prev) => ({ ...prev, [selectedMonsterId]: detail }));
            }}
            onChangeFriendly={(v) => {
              if (!selectedMonsterId) return;
              setFriendlyById((prev) => ({ ...prev, [selectedMonsterId]: v }));
            }}
            attackOverrides={attackOverridesById}
            onChangeAttack={onChangeAttack}
          />
        </div>
      </div>
    </Modal>
  );
}
