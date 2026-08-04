// web-dm/src/views/BinderView/OrganizationLeaderSection.tsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { theme } from "@/theme/theme";
import { Button } from "@/ui/Button";
import { SearchableSelect } from "@/components/SearchableSelect";
import {
  fetchBinderLeaderCharacterOptions,
  setBinderOrganizationLeaderCharacter,
  updateBinderReference,
  type BinderReferenceLink,
} from "@/services/binderReferenceApi";
import type { BinderRecordOption } from "@/services/binderLoreApi";

export function OrganizationLeaderSection(props: {
  binderId: string;
  organizationId: string;
  leader: BinderReferenceLink | null;
  options: BinderRecordOption[];
  canEdit: boolean;
  onChanged: () => Promise<void>;
}) {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [picking, setPicking] = useState(false);
  const [pickId, setPickId] = useState("");
  const [characterOptions, setCharacterOptions] = useState<Array<{ id: string; name: string }>>([]);

  useEffect(() => {
    if (!picking) return;
    void fetchBinderLeaderCharacterOptions(props.binderId).then(setCharacterOptions).catch(() => setCharacterOptions([]));
  }, [picking, props.binderId]);

  async function setLeader(leaderId: string | null) {
    if (busy) return;
    setBusy(true);
    try {
      if (leaderId?.startsWith("character:")) {
        await setBinderOrganizationLeaderCharacter(props.binderId, props.organizationId, leaderId.slice("character:".length));
      } else {
        await updateBinderReference(props.binderId, "organizations", props.organizationId, { leaderId });
      }
      setPicking(false);
      setPickId("");
      await props.onChanged();
    } finally {
      setBusy(false);
    }
  }

  return (
    <section>
      <div style={{ color: theme.colors.muted, fontSize: "var(--fs-small)", fontWeight: 750, textTransform: "uppercase", letterSpacing: "0.06em" }}>
        Leader
      </div>
      {picking ? (
        <div style={{ display: "flex", gap: 8, marginTop: 9 }}>
          <div style={{ flex: "1 1 auto" }}>
            <SearchableSelect
              value={pickId}
              onChange={setPickId}
              disabled={busy}
              placeholder="Choose a Mortal…"
              options={[
                ...props.options.map((option) => ({ id: option.id, name: option.name })),
                ...characterOptions.map((option) => ({ id: `character:${option.id}`, name: `${option.name} (unassigned PC)` })),
              ]}
              autoFocus
            />
          </div>
          <Button onClick={() => void setLeader(pickId || null)} disabled={busy || !pickId}>Set</Button>
          <Button variant="ghost" onClick={() => { setPicking(false); setPickId(""); }} disabled={busy}>Cancel</Button>
        </div>
      ) : (
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 7 }}>
          {props.leader ? (
            <button
              type="button"
              onClick={() => navigate(`/binder/${props.binderId}/mortals/${props.leader!.id}`)}
              style={{ border: 0, background: "transparent", color: theme.colors.text, cursor: "pointer", padding: 0, font: "inherit", fontSize: "var(--fs-body)", textDecoration: "underline", textUnderlineOffset: 3 }}
            >
              {props.leader.name}
            </button>
          ) : (
            <span style={{ fontSize: "var(--fs-body)", color: theme.colors.muted }}>None</span>
          )}
          {props.canEdit ? (
            <>
              <button type="button" onClick={() => setPicking(true)} style={{ border: 0, background: "transparent", color: theme.colors.muted, cursor: "pointer", padding: "2px 4px", font: "inherit", fontSize: "var(--fs-small)", fontWeight: 750 }}>
                {props.leader ? "Change" : "Set leader"}
              </button>
              {props.leader ? (
                <button type="button" onClick={() => void setLeader(null)} disabled={busy} style={{ border: 0, background: "transparent", color: theme.colors.muted, cursor: busy ? "default" : "pointer", padding: "2px 4px", font: "inherit", fontSize: "var(--fs-small)", fontWeight: 750 }}>
                  Clear
                </button>
              ) : null}
            </>
          ) : null}
        </div>
      )}
    </section>
  );
}
