import React from "react";
import { useStore, type DrawerState } from "@/store";
import type { DrawerContent } from "@/drawers/types";
import { theme } from "@/theme/theme";

type TreasureDrawerState = Exclude<Extract<DrawerState, { type: "viewTreasure" }>, null>;

export function TreasureDrawer(props: { drawer: TreasureDrawerState; close: () => void }): DrawerContent {
  const { state } = useStore();

  const entry = React.useMemo(() => {
    const all = [...state.campaignTreasure, ...state.adventureTreasure];
    return all.find((t) => t.id === props.drawer.treasureId) ?? null;
  }, [props.drawer.treasureId, state.adventureTreasure, state.campaignTreasure]);

  if (!entry) {
    return {
      body: <div style={{ color: theme.colors.muted }}>Item not found.</div>
    };
  }

  const meta = [entry.rarity, entry.type, entry.attunement ? "Requires attunement" : null].filter(Boolean).join(" • ");

  return {
    body: (
      <div style={{ display: "grid", gap: 12 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontSize: "var(--fs-large)", fontWeight: 900 }}>{entry.name}</span>
            {entry.magic ? (
              <span style={{ fontSize: "var(--fs-small)", fontWeight: 700, color: "#6ea8fe", border: "1px solid #3d6db0", borderRadius: 6, padding: "1px 6px", lineHeight: 1.4 }}>
                ✦ Magic
              </span>
            ) : null}
          </div>
          {meta ? <div style={{ color: theme.colors.muted, marginTop: 4 }}>{meta}</div> : null}
        </div>

        <div
          className="bh-prewrap"
          style={{
            color: theme.colors.text,
            lineHeight: 1.4,
            background: theme.colors.inputBg,
            border: `1px solid ${theme.colors.panelBorder}`,
            borderRadius: 12,
            padding: 12
          }}
        >
          {entry.text}
        </div>
      </div>
    )
  };
}
