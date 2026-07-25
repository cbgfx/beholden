import React, { useEffect, useRef, useState } from "react";
import { C } from "@/lib/theme";

export function CharacterHudXpPopup(props: {
  xpEarned: number;
  xpNeeded: number;
  xpInput: string;
  xpPopupOpen: boolean;
  setXpInput: (value: string) => void;
  setXpPopupOpen: React.Dispatch<React.SetStateAction<boolean>>;
  saveXp: (value: number) => Promise<void>;
  accentColor: string;
}) {
  const { xpEarned, xpNeeded, xpInput, xpPopupOpen, setXpInput, setXpPopupOpen, saveXp, accentColor } = props;
  const xpPopupRef = useRef<HTMLDivElement | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (!xpPopupOpen) return;
    function handlePointerDown(event: MouseEvent) {
      if (!xpPopupRef.current) return;
      const target = event.target;
      if (target instanceof Node && !xpPopupRef.current.contains(target)) {
        setXpPopupOpen(false);
      }
    }
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [xpPopupOpen, setXpPopupOpen]);

  if (xpNeeded <= 0) return null;

  return (
    <div ref={xpPopupRef} style={{ position: "relative" }}>
      <button
        onClick={() => {
          setXpInput(String(xpEarned));
          setXpPopupOpen((o) => !o);
        }}
        style={{
          background: "none",
          border: "none",
          cursor: "pointer",
          padding: "2px 4px",
          borderRadius: 6,
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-end",
          gap: 4,
        }}
      >
        <span style={{ fontSize: "var(--fs-small)", fontWeight: 700, color: "#fff" }}>
          {xpEarned.toLocaleString()} / {xpNeeded.toLocaleString()} xp
        </span>
        <div style={{ width: "100%", minWidth: 80, height: 3, borderRadius: 2, background: "rgba(255,255,255,0.10)", overflow: "hidden" }}>
          <div style={{ height: "100%", borderRadius: 2, background: accentColor, width: `${Math.min(100, Math.max(0, (xpEarned / xpNeeded) * 100))}%`, transition: "width 0.5s ease" }} />
        </div>
      </button>
      {xpPopupOpen && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            right: 0,
            zIndex: 100,
            background: "#1e2030",
            border: "1px solid rgba(255,255,255,0.15)",
            borderRadius: 10,
            padding: "12px 14px",
            minWidth: 200,
            boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          <div style={{ fontSize: "var(--fs-small)", fontWeight: 700, color: C.muted, marginBottom: 2 }}>Edit XP</div>
          <div style={{ display: "flex", gap: 6 }}>
            <input
              autoFocus
              type="number"
              min={0}
              value={xpInput}
              onChange={(e) => setXpInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  const v = parseInt(xpInput, 10);
                  if (!isNaN(v) && v >= 0) { setSaveError(null); saveXp(v).catch(() => setSaveError("Save failed")); }
                }
                if (e.key === "Escape") setXpPopupOpen(false);
              }}
              style={{
                flex: 1,
                padding: "6px 8px",
                borderRadius: 6,
                fontSize: "var(--fs-subtitle)",
                fontWeight: 700,
                border: "1px solid rgba(255,255,255,0.15)",
                background: "rgba(255,255,255,0.07)",
                color: C.text,
                outline: "none",
                textAlign: "center",
              }}
            />
            <button
              onClick={() => {
                const v = parseInt(xpInput, 10);
                if (!isNaN(v) && v >= 0) { setSaveError(null); saveXp(v).catch(() => setSaveError("Save failed")); }
              }}
              style={{
                padding: "6px 12px",
                borderRadius: 6,
                cursor: "pointer",
                fontSize: "var(--fs-small)",
                fontWeight: 700,
                background: accentColor,
                border: "none",
                color: "#fff",
              }}
            >
              Save
            </button>
          </div>
          <div style={{ display: "flex", gap: 5 }}>
            {[
              { label: "+100", amount: 100 },
              { label: "+1000", amount: 1000 },
              { label: "+Level", amount: Math.max(0, xpNeeded - xpEarned) },
            ].map((quick) => (
              <button
                key={quick.label}
                onClick={() => {
                  const v = xpEarned + quick.amount;
                  setXpInput(String(v));
                  setSaveError(null);
                  saveXp(v).catch(() => setSaveError("Save failed"));
                }}
                style={{
                  flex: 1,
                  padding: "4px 0",
                  borderRadius: 5,
                  cursor: "pointer",
                  fontSize: "var(--fs-tiny)",
                  fontWeight: 700,
                  background: "rgba(255,255,255,0.07)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  color: C.muted,
                }}
              >
                {quick.label}
              </button>
            ))}
          </div>
          {saveError && (
            <div style={{ fontSize: "var(--fs-tiny)", color: "#ef4444", textAlign: "center" }}>{saveError}</div>
          )}
        </div>
      )}
    </div>
  );
}
