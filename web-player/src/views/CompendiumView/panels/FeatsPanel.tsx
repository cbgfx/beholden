import { C } from "@/lib/theme";
import { IconInspiration } from "@/icons";
import { Panel } from "@/ui/Panel";
import { Select } from "@/ui/Select";
import { fetchFeatCatalog } from "@/services/compendiumApi";
import { FeatsPanel as SharedFeatsPanel } from "@beholden/shared/views";

const COLORS = {
  panelBg: C.panelBg, panelBorder: C.panelBorder, text: C.text, muted: C.muted,
  accentHighlight: C.accentHl, colorMagic: C.colorMagic, colorGold: C.colorGold, green: C.green,
};
const ICON = <IconInspiration size={27} />;
const fetchRows = () => fetchFeatCatalog(["id", "name", "category", "prerequisite", "repeatable", "abilities"]);

export function FeatsPanel(props: { selectedFeatId?: string | null; onSelectFeat?: (id: string) => void }) {
  return (
    <SharedFeatsPanel
      {...props}
      icon={ICON}
      colors={COLORS}
      fetchRows={fetchRows}
      PanelComponent={Panel}
      SelectComponent={Select}
    />
  );
}
