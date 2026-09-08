import { ProfileSettings } from "@beholden/shared/ui/ProfileSettings";
import { C } from "@/lib/theme";
import { Button } from "@/ui/Button";

const theme = {
  colors: { bg: C.bg, text: C.text, muted: C.muted, panelBg: "rgba(255,255,255,0.04)",
    panelBorder: "rgba(255,255,255,0.08)", accentHighlight: C.accentHl,
    red: "rgba(248,113,113,0.9)", green: "rgba(74,222,128,0.9)" },
  radius: { control: 8, panel: 12 },
};
const styles = {
  field: { background: "rgba(0,0,0,0.35)", color: "rgba(200,215,240,0.9)", border: "1px solid rgba(255,255,255,0.12)" },
  label: { color: "rgba(160,180,220,0.65)" },
  button: { padding: undefined, fontSize: undefined },
  fontFamily: "system-ui, Segoe UI, Arial, sans-serif",
};
export function ProfileView() {
  return <ProfileSettings theme={theme} Button={Button} styles={styles} />;
}
