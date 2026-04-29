import React from "react";
import { theme } from "@/theme/theme";
import { IconTargeted } from "@/icons";

export function TurnBadge(props: { active: boolean; targeted: boolean; activeColor?: string }) {
  const size = 22;
  const activeColor = props.activeColor ?? theme.colors.accentHighlight;
  const border = props.active ? activeColor : theme.colors.panelBorder;
  const bg = props.active ? activeColor : "transparent";
  const shadow = props.active ? `0 0 0 2px ${activeColor}40` : "none";
  const iconColor = props.active ? theme.colors.panelBg : theme.colors.accentHighlight;

  return (
    <div
      title={props.active ? "Active" : props.targeted ? "Target" : ""}
      style={{
        width: size,
        height: size,
        clipPath: "polygon(25% 5%, 75% 5%, 100% 50%, 75% 95%, 25% 95%, 0% 50%)",
        border: `2px solid ${border}`,
        background: bg,
        boxShadow: shadow,
        flex: "0 0 auto",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: iconColor
      }}
    >
      {props.targeted ? <IconTargeted size={22} /> : null}
    </div>
  );
}
