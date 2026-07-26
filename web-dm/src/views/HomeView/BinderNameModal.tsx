import { useEffect, useState, type FormEvent } from "react";
import { Modal } from "@/components/overlay/Modal";
import { Button } from "@/ui/Button";
import { Input } from "@/ui/Input";
import { theme, withAlpha } from "@/theme/theme";
import { ENTITY_COLOR_PRESETS } from "@/theme/colorPresets";

export function BinderNameModal(props: {
  isOpen: boolean;
  title: string;
  initialName?: string;
  initialColor?: string;
  initialCurrentDate?: number | null;
  submitLabel: string;
  onClose: () => void;
  onSubmit: (name: string, color: string, currentDate: number) => Promise<void>;
}) {
  const [name, setName] = useState(props.initialName ?? "");
  const [color, setColor] = useState(props.initialColor ?? "#38b6ff");
  const [currentDate, setCurrentDate] = useState(props.initialCurrentDate == null ? "" : String(props.initialCurrentDate));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!props.isOpen) return;
    setName(props.initialName ?? "");
    setColor(props.initialColor ?? "#38b6ff");
    setCurrentDate(props.initialCurrentDate == null ? "" : String(props.initialCurrentDate));
    setError(null);
  }, [props.initialColor, props.initialCurrentDate, props.initialName, props.isOpen]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const trimmedName = name.trim();
    const parsedCurrentDate = Number(currentDate);
    const unchanged = trimmedName === props.initialName?.trim() && color === (props.initialColor ?? "#38b6ff") && parsedCurrentDate === props.initialCurrentDate;
    if (!trimmedName || !currentDate.trim() || !Number.isInteger(parsedCurrentDate) || unchanged) return;

    setSaving(true);
    setError(null);
    try {
      await props.onSubmit(trimmedName, color, parsedCurrentDate);
      props.onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to save Binder.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal isOpen={props.isOpen} onClose={props.onClose} title={props.title} width={440} height="auto">
      <form onSubmit={(event) => void handleSubmit(event)} style={{ padding: 22 }}>
        <label
          htmlFor="binder-name"
          style={{
            display: "block",
            marginBottom: 7,
            color: theme.colors.muted,
            fontSize: "var(--fs-small)",
            fontWeight: 700,
            letterSpacing: "0.05em",
            textTransform: "uppercase",
          }}
        >
          Binder name
        </label>
        <Input
          id="binder-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          autoFocus
          disabled={saving}
          maxLength={160}
          placeholder="Tarentha"
        />

        <div style={{ marginTop: 18 }}>
          <label htmlFor="binder-current-date" style={{ display: "block", marginBottom: 7, color: theme.colors.muted, fontSize: "var(--fs-small)", fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase" }}>
            Current date
          </label>
          <Input id="binder-current-date" type="number" step={1} value={currentDate} onChange={(event) => setCurrentDate(event.target.value)} disabled={saving} placeholder="2438" />
          <div style={{ marginTop: 6, color: theme.colors.muted, fontSize: "var(--fs-small)" }}>Used for ages and setting chronology.</div>
        </div>

        <div style={{ marginTop: 18 }}>
          <div style={{ marginBottom: 9, color: theme.colors.muted, fontSize: "var(--fs-small)", fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase" }}>
            Theme color
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 9 }}>
            {ENTITY_COLOR_PRESETS.map((preset) => {
              const selected = preset === color;
              return (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setColor(preset)}
                  title={preset}
                  aria-label={`Use ${preset} Binder theme`}
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: "50%",
                    background: preset,
                    border: selected ? "2px solid white" : "2px solid transparent",
                    boxShadow: selected ? `0 0 0 2px ${preset}` : "none",
                    cursor: "pointer",
                  }}
                />
              );
            })}
          </div>
        </div>

        {error ? (
          <div
            role="alert"
            style={{
              marginTop: 14,
              padding: "9px 12px",
              borderRadius: theme.radius.control,
              background: withAlpha(theme.colors.red, 0.12),
              border: `1px solid ${withAlpha(theme.colors.red, 0.35)}`,
              color: theme.colors.red,
              fontSize: "var(--fs-subtitle)",
            }}
          >
            {error}
          </div>
        ) : null}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 20 }}>
          <Button type="button" variant="ghost" onClick={props.onClose} disabled={saving}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            disabled={saving || !name.trim() || !currentDate.trim() || !Number.isInteger(Number(currentDate)) || (
              name.trim() === props.initialName?.trim() &&
              color === (props.initialColor ?? "#38b6ff") &&
              Number(currentDate) === props.initialCurrentDate
            )}
          >
            {saving ? "Saving…" : props.submitLabel}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
