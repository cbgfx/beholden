import { theme } from "@/theme/theme";
import { IconDice } from "@/icons";
import { Panel } from "@/ui/Panel";
import { Select } from "@/ui/Select";
import { api } from "@/services/api";
import { FeatsPanel as SharedFeatsPanel, type FeatCatalogRow } from "@beholden/shared/views";

const COLORS = {
  panelBg: theme.colors.panelBg, panelBorder: theme.colors.panelBorder,
  text: theme.colors.text, muted: theme.colors.muted,
  accentHighlight: theme.colors.accentHighlight,
  colorMagic: theme.colors.colorMagic, colorGold: theme.colors.colorGold, green: theme.colors.green,
};
const ICON = <IconDice size={28} title="Feats" />;
const fetchRows = (ruleset?: "5e" | "5.5e") => {
  const params = new URLSearchParams({ fields: "id,name,category,prerequisite,repeatable,abilities" });
  if (ruleset) params.set("ruleset", ruleset);
  return api<FeatCatalogRow[]>(`/api/compendium/feats?${params.toString()}`);
};

export function FeatsPanel(props: { selectedFeatId?: string | null; onSelectFeat?: (id: string) => void }) {
  return (
    <SharedFeatsPanel
      {...props}
      icon={ICON}
      colors={COLORS}
      fetchRows={fetchRows}
      api={api}
      panelStorageKey="compendium-feats"
      PanelComponent={Panel}
      SelectComponent={Select}
    />
  );
}
