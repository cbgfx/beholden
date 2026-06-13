import { theme } from "@/theme";
import { Button } from "@/ui/Button";
import { Modal } from "@/components/overlay/Modal";

export function ConfirmDialog(props: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  intent: "danger" | "default";
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const { open, title, message, confirmLabel, cancelLabel, intent, onConfirm, onCancel } = props;
  if (!open) return null;

  return (
    <Modal
      isOpen={open}
      title={title}
      width={520}
      height={220}
      onClose={onCancel}
    >
      <div
        style={{
          height: "100%",
          display: "flex",
          flexDirection: "column",
          gap: 16,
        }}
      >
        <div
          style={{
            flex: 1,
            color: theme.colors.text,
            // Font sizes are standardized via CSS variables (theme doesn't expose fontSize).
            fontSize: "var(--fs-base)",
            whiteSpace: "pre-wrap",
          }}
        >
          {message}
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <Button onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button variant={intent === "danger" ? "danger" : "primary"} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
