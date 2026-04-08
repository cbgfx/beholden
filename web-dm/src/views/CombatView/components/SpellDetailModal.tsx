import React from "react";
import { theme } from "@/theme/theme";
import { Modal } from "@/components/overlay/Modal";
import { Button } from "@/ui/Button";

export function SpellDetailModal(props: {
  isOpen: boolean;
  title: React.ReactNode;
  isLoading?: boolean;
  error?: string | null;
  spellDetail?: any | null;
  onClose: () => void;
}) {
  return (
    <Modal isOpen={props.isOpen} title={props.title} onClose={props.onClose} width={920} height={640}>
      <div style={{ padding: 14, height: "100%", overflow: "auto" }}>
        {props.isLoading ? (
          <div style={{ color: theme.colors.muted, fontWeight: 900, fontSize: "var(--fs-medium)" }}>Loading spell…</div>
        ) : null}

        {props.error ? (
          <div style={{ color: theme.colors.red, fontSize: "var(--fs-medium)", fontWeight: 900 }}>{props.error}</div>
        ) : null}

        {props.spellDetail ? (
          <div
            style={{
              padding: 12,
              borderRadius: 12,
              background: theme.colors.panelBg,
              border: `1px solid ${theme.colors.panelBorder}`
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
              <div style={{ color: theme.colors.text, fontWeight: 900, fontSize: "var(--fs-medium)" }}>{props.spellDetail.name}</div>
              <Button variant="ghost" onClick={props.onClose}>
                Close
              </Button>
            </div>
            <div style={{ marginTop: 6, color: theme.colors.muted, fontSize: "var(--fs-medium)" }}>
              Level {props.spellDetail.level} • {props.spellDetail.school} • {props.spellDetail.time}
            </div>
            <div style={{ marginTop: 8, color: theme.colors.text, fontSize: "var(--fs-medium)", lineHeight: 1.35, whiteSpace: "pre-wrap" }}>
              {Array.isArray(props.spellDetail.text)
                ? props.spellDetail.text.filter(Boolean).map(String).join("\n")
                : String(props.spellDetail.text ?? "")}
            </div>
          </div>
        ) : null}
      </div>
    </Modal>
  );
}
