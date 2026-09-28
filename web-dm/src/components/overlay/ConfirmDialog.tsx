import { theme } from "@/theme";
import { Button } from "@/ui/Button";
import { Modal } from "@/components/overlay/Modal";
import { IconTrash } from "@beholden/shared/icons";

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

  const isDanger = intent === "danger";

  return (
    <Modal
      isOpen={open}
      title={title}
      width={440}
      height="auto"
      onClose={onCancel}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 20, padding: "20px 20px 20px" }}>

        <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
          {isDanger && (
            <div style={{
              flexShrink: 0,
              width: 40, height: 40,
              borderRadius: "50%",
              background: `${theme.colors.red}22`,
              border: `1px solid ${theme.colors.red}55`,
              display: "grid",
              placeItems: "center",
              color: theme.colors.red,
            }}>
              <IconTrash size={18} />
            </div>
          )}
          <p style={{
            margin: 0,
            color: theme.colors.text,
            fontSize: "var(--fs-base)",
            lineHeight: 1.5,
            paddingTop: isDanger ? 8 : 0,
          }}>
            {message}
          </p>
        </div>

        <div style={{
          display: "flex",
          justifyContent: "flex-end",
          gap: 8,
          paddingTop: 4,
          borderTop: `1px solid ${theme.colors.panelBorder}`,
        }}>
          <Button onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button variant={isDanger ? "danger" : "primary"} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
