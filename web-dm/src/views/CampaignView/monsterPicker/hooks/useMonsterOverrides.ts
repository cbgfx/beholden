import * as React from "react";
import { api } from "@/services/api";
import { splitLeadingNumberAndDetail } from "@/lib/parse/statDetails";
import type { AddMonsterOptions } from "@/domain/types/domain";
import type { MonsterDetail } from "@/domain/types/compendium";
import type { AttackOverridesByMonsterId, CompendiumMonsterRow } from "@/views/CampaignView/monsterPicker/types";
import { formatAcString, formatHpString } from "@/views/CampaignView/monsterPicker/utils/monsterFormat";

type MonsterOverrideDraft = {
  qty?: number;
  label?: string;
  ac?: string;
  acDetail?: string;
  hp?: string;
  hpDetail?: string;
  friendly?: boolean;
  attackOverrides?: AttackOverridesByMonsterId[string];
};

function initializeDraft(draft: MonsterOverrideDraft, monster: MonsterDetail): MonsterOverrideDraft {
  const ac = splitLeadingNumberAndDetail(formatAcString(monster));
  const hp = splitLeadingNumberAndDetail(formatHpString(monster));
  return {
    ...draft,
    qty: draft.qty ?? 1,
    label: draft.label ?? "",
    ac: draft.ac || ac.numText,
    acDetail: draft.acDetail || ac.detail,
    hp: draft.hp || hp.numText,
    hpDetail: draft.hpDetail || hp.detail,
    friendly: draft.friendly ?? false,
  };
}

export function useMonsterOverrides(args: {
  isOpen: boolean;
  selectedMonsterId: string | null;
  rows: CompendiumMonsterRow[];
  onAddMonster: (monsterId: string, qty: number, options?: AddMonsterOptions) => void;
}) {
  const { isOpen, selectedMonsterId, rows, onAddMonster } = args;
  const [monster, setMonster] = React.useState<MonsterDetail | null>(null);
  const cache = React.useRef<Record<string, MonsterDetail>>({});
  const [drafts, setDrafts] = React.useState<Record<string, MonsterOverrideDraft>>({});
  const patchDraft = React.useCallback((id: string, patch: Partial<MonsterOverrideDraft>) => {
    setDrafts((previous) => ({ ...previous, [id]: { ...previous[id], ...patch } }));
  }, []);

  const hydrateMonster = React.useCallback(async (monsterId: string) => {
    const cached = cache.current[monsterId];
    const detail = cached ?? await api<MonsterDetail>(`/api/compendium/monsters/${monsterId}`);
    cache.current[monsterId] = detail;
    setDrafts((previous) => ({
      ...previous,
      [monsterId]: initializeDraft(previous[monsterId] ?? {}, detail),
    }));
    return detail;
  }, []);

  React.useEffect(() => {
    if (!isOpen || !selectedMonsterId) return;
    const row = rows.find((entry) => entry.id === selectedMonsterId);
    if (!row) return;
    setDrafts((previous) => {
      const current = previous[selectedMonsterId] ?? {};
      if (current.label) return previous;
      return { ...previous, [selectedMonsterId]: { ...current, label: row.name } };
    });
  }, [isOpen, rows, selectedMonsterId]);

  React.useEffect(() => {
    let cancelled = false;
    if (!isOpen || !selectedMonsterId) {
      setMonster(null);
      return;
    }
    hydrateMonster(selectedMonsterId)
      .then((detail) => { if (!cancelled) setMonster(detail); })
      .catch(() => { if (!cancelled) setMonster(null); });
    return () => { cancelled = true; };
  }, [hydrateMonster, isOpen, selectedMonsterId]);

  const onChangeAttack = React.useCallback((
    actionName: string,
    patch: { toHit?: number; damage?: string; damageType?: string },
  ) => {
    if (!selectedMonsterId) return;
    setDrafts((previous) => {
      const draft = previous[selectedMonsterId] ?? {};
      const attacks = draft.attackOverrides ?? {};
      return {
        ...previous,
        [selectedMonsterId]: {
          ...draft,
          attackOverrides: {
            ...attacks,
            [actionName]: { ...(attacks[actionName] ?? {}), ...patch },
          },
        },
      };
    });
  }, [selectedMonsterId]);

  const projectedDrafts = React.useMemo(() => {
    const qtyById: Record<string, number> = {};
    const labelById: Record<string, string> = {};
    const acById: Record<string, string> = {};
    const acDetailById: Record<string, string> = {};
    const hpById: Record<string, string> = {};
    const hpDetailById: Record<string, string> = {};
    const friendlyById: Record<string, boolean> = {};
    const attackOverridesById: AttackOverridesByMonsterId = {};
    for (const [id, draft] of Object.entries(drafts)) {
      if (draft.qty != null) qtyById[id] = draft.qty;
      if (draft.label != null) labelById[id] = draft.label;
      if (draft.ac != null) acById[id] = draft.ac;
      if (draft.acDetail != null) acDetailById[id] = draft.acDetail;
      if (draft.hp != null) hpById[id] = draft.hp;
      if (draft.hpDetail != null) hpDetailById[id] = draft.hpDetail;
      if (draft.friendly != null) friendlyById[id] = draft.friendly;
      if (draft.attackOverrides != null) attackOverridesById[id] = draft.attackOverrides;
    }
    return { qtyById, labelById, acById, acDetailById, hpById, hpDetailById, friendlyById, attackOverridesById };
  }, [drafts]);

  const handleAddMonster = React.useCallback(async (
    monsterId: string,
    qty: number,
    options?: AddMonsterOptions,
  ) => {
    try {
      let draft = drafts[monsterId] ?? {};
      if (draft.ac == null || draft.hp == null) {
        const detail = await hydrateMonster(monsterId);
        draft = initializeDraft(draft, detail);
      }
      await Promise.resolve(onAddMonster(monsterId, qty, {
        friendly: options?.friendly ?? (draft.friendly ?? false),
        labelBase: (draft.label ?? "").trim() || undefined,
        ac: Number.isFinite(Number(options?.ac ?? draft.ac)) ? Number(options?.ac ?? draft.ac) : undefined,
        acDetails: (options?.acDetails ?? (draft.acDetail ?? "").trim()) || undefined,
        hpMax: Number.isFinite(Number(options?.hpMax ?? draft.hp)) ? Number(options?.hpMax ?? draft.hp) : undefined,
        hpDetails: (options?.hpDetails ?? (draft.hpDetail ?? "").trim()) || undefined,
        attackOverrides: options?.attackOverrides ?? draft.attackOverrides,
      }));
    } catch (error) {
      alert(error instanceof Error ? error.message : String(error));
    }
  }, [drafts, hydrateMonster, onAddMonster]);

  const selectedDraft = selectedMonsterId ? drafts[selectedMonsterId] : undefined;
  return {
    monster,
    ...projectedDrafts,
    setQtyForId: (id: string, qty: number) => patchDraft(id, { qty }),
    setLabelForId: (id: string, label: string) => patchDraft(id, { label }),
    setAcForId: (id: string, ac: string, acDetail: string) => patchDraft(id, { ac, acDetail }),
    setHpForId: (id: string, hp: string, hpDetail: string) => patchDraft(id, { hp, hpDetail }),
    setFriendlyForId: (id: string, friendly: boolean) => patchDraft(id, { friendly }),
    onChangeAttack,
    selectedLabel: selectedDraft?.label ?? "",
    selectedAc: selectedDraft?.ac ?? "",
    selectedAcDetail: selectedDraft?.acDetail ?? "",
    selectedHp: selectedDraft?.hp ?? "",
    selectedHpDetail: selectedDraft?.hpDetail ?? "",
    selectedFriendly: selectedDraft?.friendly ?? false,
    handleAddMonster,
  };
}
