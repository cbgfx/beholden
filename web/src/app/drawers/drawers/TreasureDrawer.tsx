import React from "react";
import { useStore, type DrawerState } from "@/app/store";
import type { DrawerContent } from "@/app/drawers/types";
import { theme } from "@/app/theme/theme";

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
          <div style={{ fontSize: "var(--fs-large)", fontWeight: 900 }}>{entry.name}</div>
          {meta ? <div style={{ color: theme.colors.muted, marginTop: 4 }}>{meta}</div> : null}
        </div>

        <div
          className="bh-prewrap"
          style={{
            color: theme.colors.text,
            lineHeight: 1.4,
            background: theme.colors.panel2,
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
