import { C } from "@/lib/theme";

export function CharacterHudDeathSaves(props: {
  hpCurrent: number;
  deathSaves?: { success: number; fail: number };
  dsSaving: boolean;
  saveDeathSaves: (next: { success: number; fail: number }) => void;
}) {
  const { hpCurrent, deathSaves, dsSaving, saveDeathSaves } = props;

  if (hpCurrent !== 0) return null;

  return (
    <div style={{ margin: "4px 0 10px", padding: "10px 14px", borderRadius: 10, background: "rgba(220,38,38,0.08)", border: "1px solid rgba(220,38,38,0.35)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <span style={{ fontSize: "var(--fs-tiny)", fontWeight: 900, color: C.red, textTransform: "uppercase", letterSpacing: "0.1em" }}>Death Saving Throws</span>
        {dsSaving && <span style={{ fontSize: "var(--fs-tiny)", color: C.muted }}>saving...</span>}
      </div>
      <div style={{ display: "flex", gap: 20, alignItems: "center" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5 }}>
          <span style={{ fontSize: "var(--fs-tiny)", fontWeight: 700, color: "#4ade80", textTransform: "uppercase", letterSpacing: "0.06em" }}>Success</span>
          <div style={{ display: "flex", gap: 6 }}>
            {[0, 1, 2].map((i) => {
              const filled = i < (deathSaves?.success ?? 0);
              return (
                <button
                  key={i}
                  type="button"
                  disabled={dsSaving}
                  onClick={() => {
                    const cur = deathSaves?.success ?? 0;
                    const next = cur > i ? i : i + 1;
                    saveDeathSaves({ success: Math.min(3, next), fail: deathSaves?.fail ?? 0 });
                  }}
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: "50%",
                    border: `2px solid ${filled ? "#4ade80" : "rgba(74,222,128,0.3)"}`,
                    background: filled ? "#4ade80" : "transparent",
                    cursor: dsSaving ? "default" : "pointer",
                    padding: 0,
                    transition: "all 120ms",
                  }}
                />
              );
            })}
          </div>
        </div>

        <span style={{ fontSize: "var(--fs-title)", opacity: 0.4 }}>💀</span>

        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5 }}>
          <span style={{ fontSize: "var(--fs-tiny)", fontWeight: 700, color: C.red, textTransform: "uppercase", letterSpacing: "0.06em" }}>Failure</span>
          <div style={{ display: "flex", gap: 6 }}>
            {[0, 1, 2].map((i) => {
              const filled = i < (deathSaves?.fail ?? 0);
              return (
                <button
                  key={i}
                  type="button"
                  disabled={dsSaving}
                  onClick={() => {
                    const cur = deathSaves?.fail ?? 0;
                    const next = cur > i ? i : i + 1;
                    saveDeathSaves({ success: deathSaves?.success ?? 0, fail: Math.min(3, next) });
                  }}
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: "50%",
                    border: `2px solid ${filled ? C.red : "rgba(220,38,38,0.3)"}`,
                    background: filled ? C.red : "transparent",
                    cursor: dsSaving ? "default" : "pointer",
                    padding: 0,
                    transition: "all 120ms",
                  }}
                />
              );
            })}
          </div>
        </div>
      </div>

      {(deathSaves?.success ?? 0) >= 3 && <div style={{ marginTop: 8, fontSize: "var(--fs-small)", fontWeight: 700, color: "#4ade80", textAlign: "center" }}>✦ Stable - character has stabilised</div>}
      {(deathSaves?.fail ?? 0) >= 3 && <div style={{ marginTop: 8, fontSize: "var(--fs-small)", fontWeight: 700, color: C.red, textAlign: "center" }}>✦ Dead</div>}
    </div>
  );
}
