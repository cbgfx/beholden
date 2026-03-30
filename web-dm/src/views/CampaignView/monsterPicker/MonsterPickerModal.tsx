import * as React from "react";
import type { AddMonsterOptions } from "@/domain/types/domain";
import { IconButton } from "@/ui/IconButton";
import { IconClose } from "@/icons";
import { Modal } from "@/components/overlay/Modal";
import type { CompendiumMonsterRow } from "@/views/CampaignView/monsterPicker/types";
import { useCompendiumIndexFallback } from "@/views/CampaignView/monsterPicker/hooks/useCompendiumIndexFallback";
import { MonsterPickerListPane } from "@/views/CampaignView/monsterPicker/components/MonsterPickerListPane";
import { MonsterPickerDetailPane } from "@/views/CampaignView/monsterPicker/components/MonsterPickerDetailPane";
import { useMonsterPickerState } from "@/views/CampaignView/monsterPicker/hooks/useMonsterPickerState";

export { type CompendiumMonsterRow } from "@/views/CampaignView/monsterPicker/types";

export function MonsterPickerModal(props: {
  isOpen: boolean;
  onClose: () => void;
  compQ: string;
  onChangeCompQ: (q: string) => void;
  compRows: CompendiumMonsterRow[];
  onAddMonster: (monsterId: string, qty: number, opts?: AddMonsterOptions) => void;
}) {
  const { rows: baseRows, loadingIndex, indexError } = useCompendiumIndexFallback({
    isOpen: props.isOpen,
    providedRows: props.compRows,
  });

  const s = useMonsterPickerState({
    isOpen: props.isOpen,
    compQ: props.compQ,
    compRows: props.compRows,
    baseRows,
    onAddMonster: props.onAddMonster,
  });

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
      <div style={{ height: "100%", minHeight: 0, fontSize: "var(--fs-medium)", overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: "420px 1fr", gap: 7, height: "100%", minHeight: 0 }}>

          <MonsterPickerListPane
            isOpen={props.isOpen}
            compQ={props.compQ}
            onChangeCompQ={props.onChangeCompQ}
            sortMode={s.sortMode}
            onChangeSortMode={s.setSortMode}
            envFilter={s.envFilter}
            onChangeEnvFilter={s.setEnvFilter}
            envOptions={s.envOptions}
            sizeFilter={s.sizeFilter}
            onChangeSizeFilter={s.setSizeFilter}
            sizeOptions={s.sizeOptions}
            typeFilter={s.typeFilter}
            onChangeTypeFilter={s.setTypeFilter}
            typeOptions={s.typeOptions}
            crMin={s.crMin}
            crMax={s.crMax}
            onChangeCrMin={s.setCrMin}
            onChangeCrMax={s.setCrMax}
            onQuickCr={(min, max) => { s.setCrMin(min); s.setCrMax(max); }}
            onClear={s.clearFilters}
            loadingIndex={loadingIndex}
            indexError={indexError}
            rows={s.filteredRows}
            selectedMonsterId={s.selectedMonsterId}
            onSelectMonster={s.setSelectedMonsterId}
            lettersInList={s.lettersInList}
            onJumpToLetter={s.onJumpToLetter}
            qtyById={s.qtyById}
            setQtyForId={s.setQtyForId}
            labelById={s.labelById}
            acById={s.acById}
            acDetailById={s.acDetailById}
            hpById={s.hpById}
            hpDetailById={s.hpDetailById}
            friendlyById={s.friendlyById}
            attackOverridesById={s.attackOverridesById}
            onAddMonster={s.handleAddMonster}
            onProvideScrollToIndex={(fn) => { s.listScrollToIndexRef.current = fn; }}
          />

          <MonsterPickerDetailPane
            selectedMonsterId={s.selectedMonsterId}
            monster={s.monster}
            label={s.selectedLabel}
            onChangeLabel={(v) => { if (s.selectedMonsterId) s.setLabelForId(s.selectedMonsterId, v); }}
            ac={s.selectedAc}
            acDetail={s.selectedAcDetail}
            hp={s.selectedHp}
            hpDetail={s.selectedHpDetail}
            friendly={s.selectedFriendly}
            onChangeAc={(numText, detail) => { if (s.selectedMonsterId) s.setAcForId(s.selectedMonsterId, numText, detail); }}
            onChangeHp={(numText, detail) => { if (s.selectedMonsterId) s.setHpForId(s.selectedMonsterId, numText, detail); }}
            onChangeFriendly={(v) => { if (s.selectedMonsterId) s.setFriendlyForId(s.selectedMonsterId, v); }}
            attackOverrides={s.attackOverridesById}
            onChangeAttack={s.onChangeAttack}
          />

        </div>
      </div>
    </Modal>
  );
}
