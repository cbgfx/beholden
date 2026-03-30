import React from "react";
import { theme } from "@/theme/theme";
import { IconHeart, IconShield } from "@/icons";
import { api } from "@/services/api";

type Props = {
  playerId?: string;
  encounterId?: string;
  combatantId: string;
  variant: "campaign" | "combatList";
  persisted?: { success: number; fail: number };
  hpCurrent: number;
};

export function PlayerDeathSaves({ playerId, encounterId, combatantId, variant, persisted, hpCurrent }: Props) {
  const cur = Math.max(0, Number(hpCurrent) || 0);
  const [deathSaves, setDeathSaves] = React.useState(() => ({
    s: Math.max(0, Math.min(3, Number(persisted?.success ?? 0) || 0)),
    f: Math.max(0, Math.min(3, Number(persisted?.fail ?? 0) || 0)),
  }));

  React.useEffect(() => {
    setDeathSaves({
      s: Math.max(0, Math.min(3, Number(persisted?.success ?? 0) || 0)),
      f: Math.max(0, Math.min(3, Number(persisted?.fail ?? 0) || 0)),
    });
  }, [persisted?.success, persisted?.fail]);

  const persist = React.useCallback(async (next: { s: number; f: number }) => {
    try {
      if (variant === "combatList") {
        if (!encounterId) return;
        await api(`/api/encounters/${encounterId}/combatants/${combatantId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ deathSaves: { success: next.s, fail: next.f } }),
        });
      } else {
        if (!playerId) return;
        await api(`/api/players/${playerId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ deathSaves: { success: next.s, fail: next.f } }),
        });
      }
    } catch { /* ws refresh reconciles */ }
  }, [variant, encounterId, combatantId, playerId]);

  React.useEffect(() => {
    if (cur > 0 && (deathSaves.s > 0 || deathSaves.f > 0)) {
      const next = { s: 0, f: 0 };
      setDeathSaves(next);
      void persist(next);
    }
  }, [cur, deathSaves.s, deathSaves.f, persist]);

  const dots = (count: number, color: string, on: boolean[], onClick: (i: number, isOn: boolean) => void) => (
    <div style={{ display: "flex", gap: 6 }}>
      {[0, 1, 2].map((i) => {
        const active = i < count;
        return (
          <button
            key={i}
            type="button"
            onClick={(e) => { e.stopPropagation(); onClick(i, active); }}
            style={{
              width: 20, height: 20, borderRadius: "50%",
              border: `2px solid ${color}`,
              background: active ? color : "transparent",
              cursor: "pointer", padding: 0,
            }}
          />
        );
      })}
    </div>
  );

  return (
    <div style={{ display: "grid", gridTemplateColumns: "auto auto", gap: 10, alignItems: "center" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: "var(--fs-small)", fontWeight: 900, color: theme.colors.green }}>S</span>
        {dots(deathSaves.s, theme.colors.green, [], (i, on) => {
          const next = { ...deathSaves, s: Math.max(0, Math.min(3, on ? i : i + 1)) };
          setDeathSaves(next); void persist(next);
        })}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: "var(--fs-small)", fontWeight: 900, color: theme.colors.red }}>F</span>
        {dots(deathSaves.f, theme.colors.red, [], (i, on) => {
          const next = { ...deathSaves, f: Math.max(0, Math.min(3, on ? i : i + 1)) };
          setDeathSaves(next); void persist(next);
        })}
      </div>
    </div>
  );
}