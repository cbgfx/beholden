import React from "react";
import { theme } from "@/theme/theme";
import { IconTargeted } from "@/icons";

export function TurnBadge(props: { active: boolean; targeted: boolean }) {
  const size = 22;
  const border = props.active ? theme.colors.accentHighlight : theme.colors.panelBorder;
  const bg = props.active ? theme.colors.accentHighlight : "transparent";
  const shadow = props.active ? `0 0 0 2px ${theme.colors.accentHighlight}40` : "none";
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
