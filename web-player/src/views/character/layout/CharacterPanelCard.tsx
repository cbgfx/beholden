import type { ComponentProps } from "react";
import { PanelCard as SharedPanelCard } from "@beholden/shared/ui/LayoutPanelCard";
import { useUiTranslation } from "@beholden/shared/i18n/useUiTranslation";
import { PANEL_TITLES, type PanelId } from "./panelRegistry";
export function PanelCard({
  id,
  ...props
}: Omit<ComponentProps<typeof SharedPanelCard>, "title"> & {
  id: PanelId;
}) {
  const t = useUiTranslation("playerUi");
  return <SharedPanelCard {...props} title={t(PANEL_TITLES[id])} />;
}
