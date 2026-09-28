import React from "react";
import { MagicBadge } from "./MagicBadge";
import { RarityDot } from "./RarityDot";

export function ItemListRow({
  name,
  subtitle,
  rarityColor,
  magicColor,
  active = false,
  onClick,
  trailing,
  borderColor = "rgba(255,255,255,0.12)",
  activeBackground = "rgba(255,255,255,0.08)",
  textColor = "white",
  mutedColor = "rgba(255,255,255,0.7)",
  height = 52,
  padding = "0 12px",
  magic = false,
}: {
  name: string;
  subtitle?: string | null;
  rarityColor?: string | null;
  magicColor?: string;
  active?: boolean;
  onClick?: () => void;
  trailing?: React.ReactNode;
  borderColor?: string;
  activeBackground?: string;
  textColor?: string;
  mutedColor?: string;
  height?: number;
  padding?: React.CSSProperties["padding"];
  magic?: boolean;
}) {
  const content = (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
        {rarityColor ? <RarityDot color={rarityColor} /> : null}
        <span style={{ fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
          {name}
        </span>
        {magic && magicColor ? <MagicBadge color={magicColor} /> : null}
        {trailing}
      </div>
      {subtitle ? (
        <div style={{ color: mutedColor, fontSize: "var(--fs-small)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {subtitle}
        </div>
      ) : null}
    </>
  );

  const style: React.CSSProperties = {
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    height,
    width: "100%",
    textAlign: "left",
    padding,
    border: "none",
    borderBottom: `1px solid ${borderColor}`,
    background: active ? activeBackground : "transparent",
    color: textColor,
    cursor: onClick ? "pointer" : "default",
  };

  if (!onClick) {
    return <div style={style}>{content}</div>;
  }

  return (
    <button type="button" onClick={onClick} style={style}>
      {content}
    </button>
  );
}
