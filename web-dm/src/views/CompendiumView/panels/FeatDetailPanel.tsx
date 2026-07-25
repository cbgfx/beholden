import { theme } from "@/theme/theme";
import { Panel } from "@/ui/Panel";
import { api } from "@/services/api";
import { FeatDetailPanel as SharedFeatDetailPanel, type FeatDetail } from "@beholden/shared/views";

const COLORS = {
  panelBg: theme.colors.panelBg, panelBorder: theme.colors.panelBorder,
  text: theme.colors.text, muted: theme.colors.muted,
  accentHighlight: theme.colors.accentHighlight,
  colorMagic: theme.colors.colorMagic, colorGold: theme.colors.colorGold, green: theme.colors.green,
};
const fetchFeat = (id: string) => api<FeatDetail>(`/api/compendium/feats/${encodeURIComponent(id)}`);

export function FeatDetailPanel({ featId }: { featId: string }) {
  return <SharedFeatDetailPanel featId={featId} fetchFeat={fetchFeat} colors={COLORS} PanelComponent={Panel} />;
}
