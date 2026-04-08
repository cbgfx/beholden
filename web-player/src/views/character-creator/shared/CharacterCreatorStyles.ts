import React from "react";
import { C } from "@/lib/theme";

export const headingStyle: React.CSSProperties = {
  fontWeight: 900,
  fontSize: "var(--fs-large)",
  margin: "0 0 16px",
};

export const detailBoxStyle: React.CSSProperties = {
  marginTop: 14,
  padding: "14px 16px",
  borderRadius: 10,
  background: "rgba(56,182,255,0.06)",
  border: "1px solid rgba(56,182,255,0.20)",
};

export const inputStyle: React.CSSProperties = {
  background: "rgba(0,0,0,0.35)",
  color: C.text,
  border: "1px solid rgba(255,255,255,0.18)",
  borderRadius: 8,
  padding: "8px 11px",
  outline: "none",
  fontSize: "var(--fs-medium)",
};

export const labelStyle: React.CSSProperties = {
  color: C.muted,
  fontSize: "var(--fs-small)",
  display: "block",
  marginBottom: 6,
  fontWeight: 600,
};

export const smallBtnStyle: React.CSSProperties = {
  width: 28,
  height: 28,
  borderRadius: 6,
  border: "1px solid rgba(255,255,255,0.18)",
  background: "rgba(255,255,255,0.08)",
  color: C.text,
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontWeight: 700,
};

export const statLabelStyle: React.CSSProperties = {
  color: "rgba(160,180,220,0.5)",
  fontSize: "var(--fs-tiny)",
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: 0.6,
  marginBottom: 3,
};

export const statValueStyle: React.CSSProperties = {
  color: C.text,
  fontSize: "var(--fs-medium)",
  fontWeight: 700,
};

export const profChipStyle: React.CSSProperties = {
  fontSize: "var(--fs-small)",
  fontWeight: 600,
  background: "rgba(255,255,255,0.07)",
  border: "1px solid rgba(255,255,255,0.16)",
  borderRadius: 4,
  padding: "2px 8px",
  color: C.text,
};

export const sourceTagStyle: React.CSSProperties = {
  fontSize: "var(--fs-tiny)",
  background: "rgba(56,182,255,0.12)",
  border: "1px solid rgba(56,182,255,0.25)",
  borderRadius: 4,
  padding: "2px 6px",
  color: C.accentHl,
  fontWeight: 500,
};
