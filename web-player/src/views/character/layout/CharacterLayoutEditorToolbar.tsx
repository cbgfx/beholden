import { LayoutEditorToolbar } from "@beholden/shared/ui/LayoutEditorToolbar";
import { useUiTranslation } from "@beholden/shared/i18n/useUiTranslation";
import {
  MOVABLE_PANEL_IDS,
  PANEL_IDS,
  PANEL_TITLES,
  type PanelColorSettings,
  type PanelId,
  type SheetViewDef,
} from "./panelRegistry";
import { MIN_SHEET_COLUMNS, MAX_SHEET_COLUMNS } from "./sheetViewLayout";
export function CharacterLayoutEditorToolbar(props: {
  activeView: SheetViewDef;
  protectedView: boolean;
  canReset: boolean;
  canDelete: boolean;
  onRename: (name: string) => void;
  onAddColumn: () => void;
  onRemoveColumn: () => void;
  onReset: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  colorsOpen: boolean;
  colorTarget: PanelId | "all";
  globalColors: Required<PanelColorSettings>;
  onToggleColors: () => void;
  onColorTargetChange: (target: PanelId | "all") => void;
  onColorChange: (key: keyof PanelColorSettings, value: string) => void;
  onResetColors: () => void;
}) {
  const t = useUiTranslation("playerUi");
  return (
    <LayoutEditorToolbar
      {...props}
      renameDisabledReason={t("Combat and All can't be renamed")}
      deleteDisabledReason={t(
        "Combat and All can't be deleted, and at least one view must remain",
      )}
      minColumns={MIN_SHEET_COLUMNS}
      maxColumns={MAX_SHEET_COLUMNS}
      panels={[PANEL_IDS.combatStats, ...MOVABLE_PANEL_IDS].map((id) => ({
        id,
        title: t(PANEL_TITLES[id]),
      }))}
      onColorTargetChange={(target) =>
        props.onColorTargetChange(target as PanelId | "all")
      }
    />
  );
}
