import { useEffect, useState } from "react";
import { IconCampaign, IconPencil } from "@/icons";
import { Button } from "@/ui/Button";
import { theme, withAlpha } from "@/theme/theme";
import type { Campaign } from "@/domain/types/domain";
import { updateCampaignBinderContent } from "@/services/binderApi";
import { MarkdownRichText, WysiwygNoteEditor } from "@beholden/shared/ui";

function CampaignRichText(props: {
  label: string;
  value: string | null;
  accent: string;
  onSave: (value: string | null) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(props.value ?? "");
  const [saving, setSaving] = useState(false);
  useEffect(() => setDraft(props.value ?? ""), [props.value]);

  return (
    <section style={{ paddingTop: 20, borderTop: `1px solid ${withAlpha(props.accent, 0.18)}` }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 10 }}>
        <h2 style={{ margin: 0, color: theme.colors.text, fontSize: "var(--fs-title)" }}>{props.label}</h2>
        {!editing ? <button type="button" onClick={() => setEditing(true)} title={`Edit ${props.label.toLocaleLowerCase()}`} style={{ display: "inline-flex", alignItems: "center", gap: 5, border: 0, background: "transparent", color: theme.colors.muted, cursor: "pointer", padding: "2px 4px", font: "inherit", fontSize: "var(--fs-small)", fontWeight: 750 }}>
          <IconPencil size={13} /> Edit
        </button> : null}
      </div>
      {editing ? (
        <div style={{ display: "grid", gap: 10 }}>
          <WysiwygNoteEditor
            value={draft}
            onChange={setDraft}
            placeholder={`Add ${props.label.toLocaleLowerCase()}…`}
            minHeight={300}
            theme={{ radius: theme.radius.control, panelBorder: theme.colors.panelBorder, inputBg: theme.colors.inputBg, text: theme.colors.text }}
          />
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <Button variant="ghost" disabled={saving} onClick={() => {
              setDraft(props.value ?? "");
              setEditing(false);
            }}>Cancel</Button>
            <Button disabled={saving} onClick={async () => {
              setSaving(true);
              try {
                await props.onSave(draft.trim() || null);
                setEditing(false);
              } finally {
                setSaving(false);
              }
            }}>{saving ? "Saving…" : "Save"}</Button>
          </div>
        </div>
      ) : (
        <div style={{ minHeight: 90, padding: "8px 2px", color: props.value ? theme.colors.text : theme.colors.muted, fontSize: "var(--fs-body)", lineHeight: 1.65 }}>
          {props.value ? <MarkdownRichText text={props.value} /> : `No ${props.label.toLocaleLowerCase()} yet.`}
        </div>
      )}
    </section>
  );
}

export function BinderCampaignWorkspace(props: { campaign: Campaign; accent: string }) {
  const [story, setStory] = useState(props.campaign.campaignStory ?? null);
  const [notes, setNotes] = useState(props.campaign.campaignNotes ?? null);
  useEffect(() => {
    setStory(props.campaign.campaignStory ?? null);
    setNotes(props.campaign.campaignNotes ?? null);
  }, [props.campaign.id, props.campaign.campaignStory, props.campaign.campaignNotes]);

  return (
    <article style={{ maxWidth: 1180, padding: "6px 4px 60px" }}>
      <div style={{ display: "flex", gap: 13, alignItems: "center", marginBottom: 28 }}>
        <span style={{ display: "grid", color: props.accent }}><IconCampaign size={38} /></span>
        <div>
          <div style={{ color: theme.colors.muted, fontSize: "var(--fs-small)", textTransform: "uppercase", letterSpacing: "0.07em", fontWeight: 750 }}>Campaign</div>
          <div style={{ color: withAlpha(props.accent, 0.85), marginTop: 3 }}>
            {props.campaign.currentDate?.text ? `Current date: ${props.campaign.currentDate.text}` : "No current date set"}
          </div>
        </div>
      </div>
      <div style={{ display: "grid", gap: 34 }}>
        <CampaignRichText label="Campaign Story" value={story} accent={props.accent} onSave={async (campaignStory) => {
          const result = await updateCampaignBinderContent(props.campaign.id, { campaignStory });
          setStory(result.campaignStory);
        }} />
        <CampaignRichText label="Campaign Notes" value={notes} accent={props.accent} onSave={async (campaignNotes) => {
          const result = await updateCampaignBinderContent(props.campaign.id, { campaignNotes });
          setNotes(result.campaignNotes);
        }} />
      </div>
    </article>
  );
}
