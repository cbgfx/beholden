import { useEffect, useState, type FormEvent } from "react";
import { Drawer } from "@/components/overlay/Drawer";
import { Modal } from "@/components/overlay/Modal";
import { Button } from "@/ui/Button";
import { Input } from "@/ui/Input";
import { TextArea } from "@/ui/TextArea";
import { theme, withAlpha } from "@/theme/theme";
import { EntityIcon, IconPicker, getDefaultEntityIcon } from "@/components/iconPicker";
import type {
  BinderReferenceInput,
  BinderReferenceRecord,
} from "@/services/binderReferenceApi";

export function ReferenceRecordModal(props: {
  isOpen: boolean;
  singularLabel: string;
  record: BinderReferenceRecord | null;
  accent: string;
  showDescription: boolean;
  showIcon?: boolean;
  useDrawer?: boolean;
  parentLabel?: string;
  parentOptions?: Array<{ id: string; name: string; type: string; icon?: string | null }>;
  onClose: () => void;
  onSave: (input: BinderReferenceInput) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [icon, setIcon] = useState<string | null>(null);
  const [parentId, setParentId] = useState("");
  const [parentQuery, setParentQuery] = useState("");
  const [parentOpen, setParentOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!props.isOpen) return;
    setName(props.record?.name ?? "");
    setDescription(props.record?.description ?? "");
    setIcon(props.record?.icon ?? null);
    setParentId(props.record?.parent?.id ?? "");
    setParentQuery(props.record?.parent?.name ?? "");
    setError(null);
  }, [props.isOpen, props.record]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await props.onSave({
        name: name.trim(),
        description: props.showDescription ? description.trim() || null : null,
        parentId: props.parentLabel ? parentId || null : undefined,
        icon: props.showIcon ? icon : undefined,
      });
      props.onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : `Unable to save ${props.singularLabel}.`);
    } finally {
      setSaving(false);
    }
  }

  const labelStyle: React.CSSProperties = {
    color: theme.colors.muted,
    fontSize: "var(--fs-small)",
    fontWeight: 750,
    letterSpacing: "0.05em",
    textTransform: "uppercase",
  };

  const content = (
      <form onSubmit={(event) => void submit(event)} style={{ padding: 22, display: "grid", gap: 17 }}>
        <div style={{ display: "grid", gap: 7 }}>
          <label htmlFor="binder-reference-name" style={labelStyle}>Name</label>
          <Input
            id="binder-reference-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            autoFocus
            maxLength={160}
            disabled={saving}
          />
        </div>

        {props.showIcon ? <IconPicker value={icon} onChange={setIcon} label="Icon" /> : null}

        {props.showDescription ? (
          <div style={{ display: "grid", gap: 7 }}>
            <label htmlFor="binder-reference-description" style={labelStyle}>Description</label>
            <TextArea
              id="binder-reference-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={6}
              disabled={saving}
              placeholder="Optional"
            />
          </div>
        ) : null}

        {props.parentLabel ? (
          <div style={{ display: "grid", gap: 7 }}>
            <label htmlFor="binder-reference-parent" style={labelStyle}>{props.parentLabel}</label>
            <div style={{ position: "relative" }}>
              <Input
                id="binder-reference-parent"
                value={parentQuery}
                onFocus={() => setParentOpen(true)}
                onBlur={() => window.setTimeout(() => {
                  setParentOpen(false);
                  setParentQuery(props.parentOptions?.find((option) => option.id === parentId)?.name ?? "");
                }, 120)}
                onChange={(event) => { setParentQuery(event.target.value); setParentId(""); setParentOpen(true); }}
                placeholder="None"
                disabled={saving}
                autoComplete="off"
              />
              {parentOpen && !saving ? (
                <div style={{ position: "absolute", zIndex: 30, top: "calc(100% + 4px)", left: 0, right: 0, maxHeight: 230, overflowY: "auto", border: `1px solid ${theme.colors.panelBorder}`, borderRadius: theme.radius.control, background: "#0d1525", boxShadow: "0 12px 28px rgba(0,0,0,.65)" }}>
                  <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => { setParentId(""); setParentQuery(""); setParentOpen(false); }} style={optionStyle}>None</button>
                  {(props.parentOptions ?? [])
                    .filter((option) => option.name.toLocaleLowerCase().includes(parentQuery.trim().toLocaleLowerCase()))
                    .map((option) => (
                      <button key={option.id} type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => { setParentId(option.id); setParentQuery(option.name); setParentOpen(false); }} style={{ ...optionStyle, display: "flex", alignItems: "center", gap: 8 }}>
                        {option.type === "poi" ? <EntityIcon icon={option.icon ?? getDefaultEntityIcon("points-of-interest")} size={16} /> : null}
                        <span>{option.name}{props.parentLabel === "Parent" ? <span style={{ color: theme.colors.muted }}> · {option.type === "location" ? "Location" : option.type === "poi" ? "Point of Interest" : option.type}</span> : null}</span>
                      </button>
                    ))}
                </div>
              ) : null}
            </div>
          </div>
        ) : null}

        {error ? (
          <div style={{ color: theme.colors.red, background: withAlpha(theme.colors.red, 0.1), border: `1px solid ${withAlpha(theme.colors.red, 0.3)}`, borderRadius: theme.radius.control, padding: "9px 11px" }}>
            {error}
          </div>
        ) : null}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <Button type="button" variant="ghost" onClick={props.onClose} disabled={saving}>Cancel</Button>
          <Button type="submit" disabled={saving || !name.trim()}>
            {saving ? "Saving…" : props.record ? "Save Changes" : `Create ${props.singularLabel}`}
          </Button>
        </div>
      </form>
  );

  const title = props.record ? `Edit ${props.singularLabel}` : `New ${props.singularLabel}`;
  if (props.useDrawer) {
    return (
      <Drawer isOpen={props.isOpen} onClose={props.onClose} title={title} width="min(460px, 94vw)" hideFooter>
        {content}
      </Drawer>
    );
  }
  return (
    <Modal isOpen={props.isOpen} onClose={props.onClose} title={title} width={540} height="auto">
      {content}
    </Modal>
  );
}

const optionStyle: React.CSSProperties = {
  display: "block",
  width: "100%",
  padding: "9px 12px",
  border: 0,
  background: "transparent",
  color: theme.colors.text,
  textAlign: "left",
  cursor: "pointer",
  font: "inherit",
};
