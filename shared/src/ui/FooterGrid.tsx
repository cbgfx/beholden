import React from "react";
import { useIsNarrow } from "./useIsNarrow";
import { useUiTranslation } from "../i18n/useUiTranslation";

/** 4-column footer grid: left | center-left | center-right | right */
export function FooterGrid(props: {
  left: React.ReactNode;
  centerLeft: React.ReactNode;
  centerRight?: React.ReactNode;
  right?: React.ReactNode;
  borderColor: string;
  background: string;
  color: string;
  mobileSummary?: React.ReactNode;
  mobileVersion?: React.ReactNode;
}) {
  const isNarrow = useIsNarrow("(max-width: 860px)");
  const phone = isNarrow;
  const t = useUiTranslation("sharedUi");
  const [expanded, setExpanded] = React.useState(false);
  const footer = React.useRef<HTMLElement>(null);
  const toggle = React.useRef<HTMLButtonElement>(null);
  const id = React.useId();
  React.useEffect(() => {
    if (!expanded || !phone) return;
    const pointer = (event: PointerEvent) => { if (event.target instanceof Node && !footer.current?.contains(event.target)) setExpanded(false); };
    const key = (event: KeyboardEvent) => { if (event.key === "Escape") { setExpanded(false); toggle.current?.focus(); } };
    document.addEventListener("pointerdown", pointer); document.addEventListener("keydown", key);
    return () => { document.removeEventListener("pointerdown", pointer); document.removeEventListener("keydown", key); };
  }, [expanded, phone]);

  if (phone) return <footer ref={footer} style={{ position: "relative", zIndex: 100, flexShrink: 0, color: props.color, background: props.background, borderTop: `1px solid ${props.borderColor}`, padding: "0 12px env(safe-area-inset-bottom, 0px)", fontSize: "var(--fs-small)" }}>
    <div style={{ display: "flex", alignItems: "center", gap: 12, minHeight: 44 }}>
      <span style={{ flex: 1, minWidth: 0 }}>{props.mobileSummary ?? "Beholden"}</span>
      {props.mobileVersion ? <span style={{ fontSize: "var(--fs-tiny)" }}>{props.mobileVersion}</span> : null}
      <button ref={toggle} type="button" aria-expanded={expanded} aria-controls={id} onClick={() => setExpanded((value) => !value)} style={{ minWidth: 44, minHeight: 44, padding: "0 4px", border: 0, background: "transparent", color: "inherit", font: "inherit", cursor: "pointer" }}>{t("More")} <span aria-hidden="true">{expanded ? "▾" : "▴"}</span></button>
    </div>
    <div id={id} hidden={!expanded} role="region" aria-label={t("Footer information")} onClick={(event) => { if ((event.target as HTMLElement).closest("a[href]")) setExpanded(false); }} style={{ position: "absolute", bottom: "100%", left: 0, right: 0, maxHeight: "60dvh", overflowY: "auto", overscrollBehavior: "contain", padding: "14px 16px", display: expanded ? "grid" : "none", gap: 14, background: "#111827", borderTop: `1px solid ${props.borderColor}`, boxShadow: "0 -10px 30px rgba(0,0,0,.3)", overflowWrap: "anywhere" }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>{props.centerLeft}</div>
      {props.centerRight ? <div>{props.centerRight}</div> : null}
      <div>{props.left}</div><div style={{ fontSize: "var(--fs-tiny)" }}>{props.right}</div>
    </div>
  </footer>;

  return (
    <footer
      style={{
        borderTop: `1px solid ${props.borderColor}`,
        padding: isNarrow ? "8px 12px" : "10px 16px",
        color: props.color,
        fontSize: isNarrow ? "var(--fs-small)" : "var(--fs-medium)",
        background: props.background,
        display: "grid",
        gridTemplateColumns: isNarrow ? "minmax(0, 1fr)" : "minmax(0, 1fr) auto auto minmax(0, 1fr)",
        alignItems: isNarrow ? "start" : "center",
        gap: isNarrow ? 8 : 16,
        flexShrink: 0,
      }}
    >
      <div style={{ minWidth: 0, justifySelf: "start" }}>{props.left}</div>
      <div style={{ justifySelf: isNarrow ? "start" : "center", display: "flex", flexWrap: "wrap", gap: isNarrow ? 10 : 12, alignItems: "center" }}>{props.centerLeft}</div>
      <div style={{ justifySelf: isNarrow ? "start" : "center", display: "flex", justifyContent: "center" }}>{props.centerRight}</div>
      <div style={{ justifySelf: isNarrow ? "start" : "end", textAlign: isNarrow ? "left" : "right", fontSize: "var(--fs-small)" }}>{props.right}</div>
    </footer>
  );
}
