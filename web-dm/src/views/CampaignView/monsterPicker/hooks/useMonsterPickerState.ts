import * as React from "react";
import type { AddMonsterOptions } from "@/domain/types/domain";
import { useMonsterIndexSearch } from "@/views/CampaignView/monsterPicker/hooks/useMonsterIndexSearch";
import { useMonsterOverrides } from "@/views/CampaignView/monsterPicker/hooks/useMonsterOverrides";

export function useMonsterPickerState(args: {
  isOpen: boolean;
  compQ: string;
  onAddMonster: (monsterId: string, qty: number, options?: AddMonsterOptions) => void;
}) {
  const { isOpen, compQ, onAddMonster } = args;
  const [selectedMonsterId, setSelectedMonsterId] = React.useState<string | null>(null);
  const index = useMonsterIndexSearch({ isOpen, query: compQ });

  React.useEffect(() => {
    if (!isOpen || !index.filteredRows.length) return;
    if (!selectedMonsterId || !index.filteredRows.some((row) => row.id === selectedMonsterId)) {
      setSelectedMonsterId(index.filteredRows[0]!.id);
    }
  }, [index.filteredRows, isOpen, selectedMonsterId]);

  const overrides = useMonsterOverrides({
    isOpen,
    selectedMonsterId,
    rows: index.filteredRows,
    onAddMonster,
  });

  return {
    selectedMonsterId,
    setSelectedMonsterId,
    ...overrides,
    ...index,
  };
}
