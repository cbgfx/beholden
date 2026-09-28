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

  // Rows arrive a window at a time, so "the first row" means the first one that has loaded, and a
  // selection stays put while the rest of the list is still full of holes.
  const loadedRows = React.useMemo(
    () => index.rows.filter((row): row is NonNullable<typeof row> => Boolean(row)),
    [index.rows],
  );

  React.useEffect(() => {
    if (!isOpen || !loadedRows.length) return;
    if (!selectedMonsterId) {
      setSelectedMonsterId(loadedRows[0]!.id);
      return;
    }
    // Only give up a selection once the search that replaced it has actually returned something,
    // otherwise every scroll would reset it to whatever is on screen.
    const stillListed = loadedRows.some((row) => row.id === selectedMonsterId);
    if (!stillListed && !index.loadingIndex && index.totalRows > 0 && loadedRows.length >= Math.min(index.totalRows, 1)) {
      const knownToSearch = index.rows.some((row) => row?.id === selectedMonsterId);
      if (!knownToSearch) setSelectedMonsterId(loadedRows[0]!.id);
    }
  }, [index.loadingIndex, index.rows, index.totalRows, isOpen, loadedRows, selectedMonsterId]);

  const overrides = useMonsterOverrides({
    isOpen,
    selectedMonsterId,
    rows: loadedRows,
    onAddMonster,
  });

  return {
    selectedMonsterId,
    setSelectedMonsterId,
    ...overrides,
    ...index,
  };
}
