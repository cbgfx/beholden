import * as React from "react";
import { theme, withAlpha } from "@/theme/theme";
import { togglePillStyle } from "./browserParts";
import type { ItemFormData } from "./ItemFormModel";

const itemLabelStyle: React.CSSProperties = { display: "flex", flexDirection: "column", gap: 5, color: theme.colors.muted, fontSize: "var(--fs-small)", fontWeight: 650 };
export const itemSectionStyle: React.CSSProperties = { border: "1px solid rgba(120,150,200,0.14)", borderRadius: 10, padding: 14, background: "rgba(3,8,18,0.34)" };
export const itemSectionTitle: React.CSSProperties = { margin: "0 0 10px", color: theme.colors.accentHighlight, fontSize: "var(--fs-small)", fontWeight: 800, letterSpacing: ".065em", textTransform: "uppercase" };
export const itemRemoveStyle: React.CSSProperties = { border: `1px solid ${withAlpha(theme.colors.red, .35)}`, borderRadius: 7, background: withAlpha(theme.colors.red, .08), color: theme.colors.red, cursor: "pointer" };
export type ItemFormSetter = <K extends keyof ItemFormData>(key: K, value: ItemFormData[K]) => void;
export const itemChoices = (values: readonly string[], empty = "None") => [{ value: "", label: empty }, ...values.map((value) => ({ value, label: value }))];

export function ItemField({ label, children }: { label: string; children: React.ReactNode }) { return <label style={itemLabelStyle}>{label}{children}</label>; }
export function ItemPills({ items }: { items: Array<{ label: string; active: boolean; toggle: () => void }> }) { return <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 12 }}>{items.map((item) => <button key={item.label} type="button" style={togglePillStyle(item.active)} onClick={item.toggle}>{item.label}</button>)}</div>; }
export function ItemEmpty({ children }: { children: React.ReactNode }) { return <div style={{ color: theme.colors.muted, fontStyle: "italic", fontSize: "var(--fs-small)", padding: 8 }}>{children}</div>; }
export function ItemColumn({ children }: { children: React.ReactNode }) { return <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>{children}</div>; }
