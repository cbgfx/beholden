import { useEffect, useState, type FormEvent } from "react";
import { Drawer } from "@/components/overlay/Drawer";
import { Modal } from "@/components/overlay/Modal";
import { Button } from "@/ui/Button";
import { Input } from "@/ui/Input";
import { TextArea } from "@/ui/TextArea";
import { theme, withAlpha } from "@/theme/theme";
import { IconPicker } from "@/components/iconPicker";
import { SearchableSelect } from "@/components/SearchableSelect";
import {
  DEITY_RANK_COLORS,
  DEITY_RANKS,
  type BinderReferenceInput,
  type BinderReferenceRecord,
  type DeityRank,
} from "@/services/binderReferenceApi";

const PARENT_TYPE_LABELS: Record<string, string> = {
  location: "Location",
  poi: "Point of Interest",
};

export function ReferenceRecordModal(props: {
  isOpen: boolean;
  singularLabel: string;
  record: BinderReferenceRecord | null;
  accent: string;
  showDescription: boolean;
  showIcon?: boolean;
  showRank?: boolean;
  useDrawer?: boolean;
  parentLabel?: string;
  parentOptions?: Array<{ id: string; name: string; type: string; icon?: string | null }>;
  onClose: () => void;
  onSave: (input: BinderReferenceInput) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [icon, setIcon] = useState<string | null>(null);
  const [rank, setRank] = useState<DeityRank | null>(null);
  const [parentId, setParentId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!props.isOpen) return;
    setName(props.record?.name ?? "");
    setDescription(props.record?.description ?? "");
    setIcon(props.record?.icon ?? null);
    setRank(props.record?.rank ?? null);
    setParentId(props.record?.parent?.id ?? "");
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
        rank: props.showRank ? rank : undefined,
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

        {props.showRank ? (
          <div style={{ display: "grid", gap: 7 }}>
            <div style={labelStyle}>Rank</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {DEITY_RANKS.map((option) => {
                const active = rank === option;
                const color = DEITY_RANK_COLORS[option];
                return (
                  <button
                    key={option}
                    type="button"
                    disabled={saving}
                    onClick={() => setRank(active ? null : option)}
                    style={{
                      padding: "4px 12px",
                      borderRadius: 999,
                      border: `1.5px solid ${color}`,
                      background: active ? color : withAlpha(color, 0.14),
                      color: active ? "#0b0e14" : color,
                      fontWeight: 800,
                      fontSize: "var(--fs-small)",
                      cursor: saving ? "default" : "pointer",
                    }}
                  >
                    {option}
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}

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
            <SearchableSelect
              id="binder-reference-parent"
              value={parentId}
              onChange={setParentId}
              disabled={saving}
              options={(props.parentOptions ?? []).map((option) => ({
                id: option.id,
                name: option.name,
                icon: option.icon,
                meta: props.parentLabel === "Parent" ? PARENT_TYPE_LABELS[option.type] ?? option.type : undefined,
              }))}
            />
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
