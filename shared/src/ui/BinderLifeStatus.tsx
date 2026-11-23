import type { CSSProperties } from "react";
import type { UiTranslator } from "../i18n/useUiTranslation";

export function BinderLifeStatus(props: {
  status: string | null;
  translate: UiTranslator;
  theme: { muted: string; red: string; green: string };
  style?: CSSProperties;
}) {
  if (!props.status) return <span style={{ color: props.theme.muted }}>{props.translate("Not specified")}</span>;
  const dead = props.status === "dead";
  return <span style={{ display: "inline-flex", padding: "2px 7px", borderRadius: 5, color: "#fff", background: dead ? props.theme.red : props.theme.green, fontSize: "var(--fs-small)", lineHeight: 1.35, fontWeight: 800, ...props.style }}>
    {props.translate(dead ? "Dead" : "Alive")}
  </span>;
}
