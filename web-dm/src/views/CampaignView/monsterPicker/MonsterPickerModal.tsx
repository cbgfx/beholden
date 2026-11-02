import { useUiTranslation } from "@beholden/shared/i18n/useUiTranslation";
import * as React from "react";
import type { AddMonsterOptions } from "@/domain/types/domain";
import { Button } from "@/ui/Button";
import { QtyStepper } from "./components/QtyStepper";
import { useIsNarrow } from "@beholden/shared/ui/useIsNarrow";

import { Modal } from "@/components/overlay/Modal";
import { MonsterPickerListPane } from "@/views/CampaignView/monsterPicker/components/MonsterPickerListPane";
import { MonsterPickerDetailPane } from "@/views/CampaignView/monsterPicker/components/MonsterPickerDetailPane";
import { useMonsterPickerState } from "@/views/CampaignView/monsterPicker/hooks/useMonsterPickerState";

export function MonsterPickerModal(props: {
  isOpen: boolean;
  onClose: () => void;
  onAddMonster: (
    monsterId: string,
    qty: number,
    opts?: AddMonsterOptions,
  ) => void;
}) {
  const translateUi = useUiTranslation("dmUi");
  const compact = useIsNarrow("(max-width: 1024px)");
  const [detailOpen, setDetailOpen] = React.useState(false);
  const [adding, setAdding] = React.useState(false);
  const [compQ, setCompQ] = React.useState("");

  React.useEffect(() => {
    if (!props.isOpen) {
      setCompQ("");
      setDetailOpen(false);
    }
  }, [props.isOpen]);

  const s = useMonsterPickerState({
    isOpen: props.isOpen,
    compQ,
    onAddMonster: props.onAddMonster,
  });

  return (
    <Modal
      isOpen={props.isOpen}
      onClose={props.onClose}
      title={translateUi("Add MONSTERS")}
      width={1100}
    >
      <div
        style={{
          height: "100%",
          minHeight: 0,
          fontSize: "var(--fs-medium)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: compact
              ? "minmax(0, 1fr)"
              : "420px minmax(0, 1fr)",
            gap: 7,
            height: "100%",
            minHeight: 0,
            minWidth: 0,
            padding: 8,
            boxSizing: "border-box",
          }}
        >
          <div
            hidden={compact && detailOpen}
            style={{
              display: compact && detailOpen ? "none" : "flex",
              minWidth: 0,
              minHeight: 0,
              flexDirection: "column",
            }}
          >
            <MonsterPickerListPane
              compact={compact}
              isOpen={props.isOpen}
              compQ={compQ}
              onChangeCompQ={setCompQ}
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
              onClear={s.clearFilters}
              rulesetFilter={s.rulesetFilter}
              onChangeRulesetFilter={s.setRulesetFilter}
              showRulesetFilter={s.showRulesetFilter}
              loadingIndex={s.loadingIndex}
              indexError={s.indexError}
              rows={s.rows}
              totalRows={s.totalRows}
              ensureRange={s.ensureRange}
              selectedMonsterId={s.selectedMonsterId}
              onSelectMonster={(id) => {
                s.setSelectedMonsterId(id);
                if (compact) setDetailOpen(true);
              }}
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
              onProvideScrollToIndex={(fn) => {
                s.listScrollToIndexRef.current = fn;
              }}
            />
          </div>
          <div
            hidden={compact && !detailOpen}
            style={{
              display: compact && !detailOpen ? "none" : "flex",
              flexDirection: "column",
              minWidth: 0,
              minHeight: 0,
            }}
          >
            {compact ? (
              <Button
                variant="ghost"
                onClick={() => setDetailOpen(false)}
                style={{
                  alignSelf: "flex-start",
                  flexShrink: 0,
                  minHeight: 44,
                  marginBottom: 8,
                }}
              >
                {translateUi("Back to list")}
              </Button>
            ) : null}
            <MonsterPickerDetailPane
              compact={compact}
              selectedMonsterId={s.selectedMonsterId}
              monster={s.monster}
              label={s.selectedLabel}
              onChangeLabel={(v) => {
                if (s.selectedMonsterId)
                  s.setLabelForId(s.selectedMonsterId, v);
              }}
              ac={s.selectedAc}
              acDetail={s.selectedAcDetail}
              hp={s.selectedHp}
              hpDetail={s.selectedHpDetail}
              friendly={s.selectedFriendly}
              onChangeAc={(numText, detail) => {
                if (s.selectedMonsterId)
                  s.setAcForId(s.selectedMonsterId, numText, detail);
              }}
              onChangeHp={(numText, detail) => {
                if (s.selectedMonsterId)
                  s.setHpForId(s.selectedMonsterId, numText, detail);
              }}
              onChangeFriendly={(v) => {
                if (s.selectedMonsterId)
                  s.setFriendlyForId(s.selectedMonsterId, v);
              }}
              attackOverrides={s.attackOverridesById}
              onChangeAttack={s.onChangeAttack}
            />
            {compact && s.selectedMonsterId ? (
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 8,
                  flexWrap: "wrap",
                  flexShrink: 0,
                  paddingTop: 8,
                }}
              >
                <QtyStepper
                  value={s.qtyById[s.selectedMonsterId] ?? 1}
                  onChange={(qty) => s.setQtyForId(s.selectedMonsterId!, qty)}
                />
                <Button
                  disabled={adding}
                  onClick={async () => {
                    const id = s.selectedMonsterId;
                    if (!id) return;
                    setAdding(true);
                    try {
                      await s.handleAddMonster(id, s.qtyById[id] ?? 1, {
                        ruleset: s.rows.find((row) => row?.id === id)?.ruleset,
                      });
                    } finally {
                      setAdding(false);
                    }
                  }}
                >
                  {translateUi("Add")}
                </Button>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </Modal>
  );
}
