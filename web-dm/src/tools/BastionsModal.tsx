import React from "react";
import { Modal } from "@/components/overlay/Modal";
import { theme, withAlpha } from "@/theme/theme";

export function BastionsModal(props: { isOpen: boolean; onClose: () => void }) {
  return (
    <Modal isOpen={props.isOpen} onClose={props.onClose} title="Bastions" width={400} height={260}>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 14,
          height: "100%",
          padding: 32,
        }}
      >
        <div style={{ fontSize: 40 }}>🏰</div>
        <div style={{ fontSize: 20, fontWeight: 900, color: theme.colors.text }}>Under Construction</div>
        <div style={{ fontSize: 14, color: theme.colors.muted, textAlign: "center", maxWidth: 280 }}>
          Bastions management is coming soon. Check back after the compendium is ready.
        </div>
        <div
          style={{
            marginTop: 8,
            padding: "6px 16px",
            borderRadius: theme.radius.control,
            background: withAlpha(theme.colors.accentWarning, 0.1),
            color: theme.colors.accentWarning,
            fontSize: 13,
            fontWeight: 600,
            border: `1px solid ${withAlpha(theme.colors.accentWarning, 0.3)}`,
          }}
        >
          Coming Soon
        </div>
      </div>
    </Modal>
  );
}
