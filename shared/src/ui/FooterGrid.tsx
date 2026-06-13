import React from "react";

/** 4-column footer grid: left | center-left | center-right | right */
export function FooterGrid(props: {
  left: React.ReactNode;
  centerLeft: React.ReactNode;
  centerRight?: React.ReactNode;
  right?: React.ReactNode;
  borderColor: string;
  background: string;
  color: string;
}) {
  const [isNarrow, setIsNarrow] = React.useState<boolean>(() =>
    typeof window !== "undefined" ? window.innerWidth <= 860 : false,
  );

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const onResize = () => setIsNarrow(window.innerWidth <= 860);
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

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
