// web-dm/src/views/BinderView/DeityDomainsSection.tsx
import { useState } from "react";
import { Button } from "@/ui/Button";
import { theme, withAlpha } from "@/theme/theme";
import { SearchableSelect } from "@/components/SearchableSelect";
import { addDeityDomain, removeDeityDomain, type BinderReferenceLink } from "@/services/binderReferenceApi";
import type { BinderRecordOption } from "@/services/binderLoreApi";

export function DeityDomainsSection(props: {
  binderId: string;
  deityId: string;
  domains: BinderReferenceLink[];
  options: BinderRecordOption[];
  accent: string;
  canEdit: boolean;
  onChanged: () => Promise<void>;
}) {
  const [addId, setAddId] = useState("");
  const [busy, setBusy] = useState(false);
  const assignedIds = new Set(props.domains.map((domain) => domain.id));
  const available = props.options.filter((option) => !assignedIds.has(option.id));

  async function add() {
    if (!addId || busy) return;
    setBusy(true);
    try {
      await addDeityDomain(props.binderId, props.deityId, addId);
      setAddId("");
      await props.onChanged();
    } finally {
      setBusy(false);
    }
  }

  async function remove(domainId: string) {
    if (busy) return;
    setBusy(true);
    try {
      await removeDeityDomain(props.binderId, props.deityId, domainId);
      await props.onChanged();
    } finally {
      setBusy(false);
    }
  }

  return (
    <section>
      <div style={{ color: theme.colors.muted, fontSize: "var(--fs-small)", fontWeight: 750, textTransform: "uppercase", letterSpacing: "0.06em" }}>
        Domains
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 9 }}>
        {props.domains.length ? props.domains.map((domain) => (
          <span
            key={domain.id}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "5px 6px 5px 11px",
              borderRadius: 999,
              background: withAlpha(props.accent, 0.14),
              border: `1px solid ${withAlpha(props.accent, 0.3)}`,
              fontSize: "var(--fs-small)",
            }}
          >
            {domain.name}
            {props.canEdit ? (
              <button
                type="button"
                onClick={() => void remove(domain.id)}
                disabled={busy}
                aria-label={`Remove ${domain.name}`}
                title={`Remove ${domain.name}`}
                style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 16, height: 16, border: 0, borderRadius: "50%", background: withAlpha("#ffffff", 0.12), color: theme.colors.text, cursor: busy ? "default" : "pointer", padding: 0, lineHeight: 1, fontSize: 12 }}
              >
                ×
              </button>
            ) : null}
          </span>
        )) : <span style={{ color: theme.colors.muted, fontSize: "var(--fs-body)" }}>None</span>}
      </div>
      {props.canEdit ? (
        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
          <div style={{ flex: "1 1 auto" }}>
            <SearchableSelect
              value={addId}
              onChange={setAddId}
              disabled={busy || !available.length}
              placeholder={available.length ? "Add a domain…" : "No more domains to add"}
              options={available.map((option) => ({ id: option.id, name: option.name }))}
            />
          </div>
          <Button onClick={() => void add()} disabled={!addId || busy}>Add</Button>
        </div>
      ) : null}
    </section>
  );
}
