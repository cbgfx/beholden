import type { ComponentProps } from "react";
import {
  useUiTranslation,
  type UiTranslator,
} from "@beholden/shared/i18n/useUiTranslation";
import {
  ColumnHeading as Heading,
  ColumnTabs as Tabs,
  type ColumnView,
} from "@beholden/shared/ui/ColumnNavigation";
import {
  PANEL_IDS,
  PANEL_TITLES,
  type SheetViewDef,
  type SheetColumnIcon,
} from "./panelRegistry";
export { useColumnNavigation as useSheetColumnNavigation } from "@beholden/shared/ui/useColumnNavigation";
function presentation(view: SheetViewDef, t: UiTranslator): ColumnView {
  return {
    ...view,
    columnDefaults: view.layout.map((column, index) => {
      const first = column[0];
      const icon: SheetColumnIcon =
        index === 0
          ? "stats"
          : first === PANEL_IDS.inventory
            ? "inventory"
            : first === PANEL_IDS.spells || first === PANEL_IDS.itemSpells
              ? "spells"
              : first === PANEL_IDS.actions
                ? "actions"
                : first === PANEL_IDS.recovery
                  ? "rest"
                  : "notes";
      return {
        name:
          index === 0
            ? t("Combat Stats")
            : first
              ? t(PANEL_TITLES[first])
              : undefined,
        icon: index > 0 && !first ? undefined : icon,
      };
    }),
  };
}
export function CharacterColumnHeading(
  props: Omit<ComponentProps<typeof Heading>, "view"> & {
    view: SheetViewDef;
  },
) {
  const t = useUiTranslation("playerUi");
  return <Heading {...props} view={presentation(props.view, t)} />;
}
export function CharacterColumnTabs(
  props: Omit<ComponentProps<typeof Tabs>, "view"> & {
    view: SheetViewDef;
  },
) {
  const t = useUiTranslation("playerUi");
  return <Tabs {...props} view={presentation(props.view, t)} />;
}
