import { C } from "@/lib/theme";
import { Panel } from "@/ui/Panel";
import { api } from "@/services/api";
import { FeatDetailPanel as SharedFeatDetailPanel, type FeatDetail } from "@beholden/shared/views";

const COLORS = {
  panelBg: C.panelBg, panelBorder: C.panelBorder, text: C.text, muted: C.muted,
  accentHighlight: C.accentHl, colorMagic: C.colorMagic, colorGold: C.colorGold, green: C.green,
};
const fetchFeat = (id: string) => api<FeatDetail>(`/api/compendium/feats/${encodeURIComponent(id)}`);

export function FeatDetailPanel({ featId }: { featId: string }) {
  return <SharedFeatDetailPanel featId={featId} fetchFeat={fetchFeat} colors={COLORS} PanelComponent={Panel} />;
}
