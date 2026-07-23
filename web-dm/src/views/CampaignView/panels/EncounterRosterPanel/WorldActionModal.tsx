import React from "react";
import { Modal } from "@/components/overlay/Modal";
import { Button } from "@/ui/Button";
import { Input } from "@/ui/Input";
import { TextArea } from "@/ui/TextArea";
import { theme } from "@/theme/theme";

export function WorldActionModal(props: {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (name: string, description?: string) => Promise<void> | void;
}) {
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (!props.isOpen) return;
    setName("");
    setDescription("");
  }, [props.isOpen]);

  const submit = async () => {
    const trimmedName = name.trim();
    if (!trimmedName || saving) return;
    setSaving(true);
    try {
      await props.onAdd(trimmedName, description.trim() || undefined);
      props.onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={props.isOpen} onClose={props.onClose} title="Add World Action" width={520} height="auto">
      <div style={{ display: "grid", gap: 14, padding: 18 }}>
        <label style={{ display: "grid", gap: 6, color: theme.colors.muted }}>
          Name
          <Input autoFocus value={name} onChange={(event) => setName(event.target.value)} placeholder="Falling Meteors" />
        </label>
        <label style={{ display: "grid", gap: 6, color: theme.colors.muted }}>
          Description or reminder (optional)
          <TextArea value={description} onChange={(event) => setDescription(event.target.value)} rows={6} placeholder="At the start of this turn..." />
        </label>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <Button variant="ghost" onClick={props.onClose}>Cancel</Button>
          <Button disabled={!name.trim() || saving} onClick={() => void submit()}>{saving ? "Adding..." : "Add World Action"}</Button>
        </div>
      </div>
    </Modal>
  );
}
