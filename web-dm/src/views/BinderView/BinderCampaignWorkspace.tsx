import { useUiTranslation } from "@beholden/shared/i18n/useUiTranslation";
import { useRichTextDraft } from "./useRichTextDraft";
import { useEffect, useState } from "react";
import { IconCampaign, IconPencil } from "@/icons";
import { Button } from "@/ui/Button";
import { theme, withAlpha } from "@/theme/theme";
import type { Campaign } from "@/domain/types/domain";
import { updateCampaignBinderContent } from "@/services/binderApi";
import { MarkdownRichText, WysiwygNoteEditor } from "@beholden/shared/ui";
import { fetchBinderRecordOptions, type BinderRecordOption } from "@/services/binderLoreApi";

function CampaignRichText(props: {
  label: string;
  value: string | null;
  accent: string;
  mentions: Array<{ id: string; label: string; href: string; type?: string }>;
  binderId: string;
  onSave: (value: string | null) => Promise<void>;
}) {
  const translateUi = useUiTranslation("dmUi");
  const { editing, draft, saving, error, setDraft, startEditing, cancel, save } = useRichTextDraft(props.value, props.onSave);

  return (
    <section style={{ paddingTop: 20, borderTop: `1px solid ${withAlpha(props.accent, 0.18)}` }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 10 }}>
        <h2 style={{ margin: 0, color: theme.colors.text, fontSize: "var(--fs-title)" }}>{props.label}</h2>
        {!editing ? <button type="button" onClick={startEditing} title={translateUi("Edit {{value1}}", { value1: props.label.toLocaleLowerCase() })} style={{ display: "inline-flex", alignItems: "center", gap: 5, border: 0, background: "transparent", color: theme.colors.muted, cursor: "pointer", padding: "2px 4px", font: "inherit", fontSize: "var(--fs-small)", fontWeight: 750 }}>
          <IconPencil size={13} /> {translateUi("Edit")}
        </button> : null}
      </div>
      {editing ? (
        <div style={{ display: "grid", gap: 10 }}>
          <WysiwygNoteEditor
            value={draft}
            onChange={setDraft}
            mentions={props.mentions}
            placeholder={translateUi("Add {{value1}}…", { value1: props.label.toLocaleLowerCase() })}
            minHeight={300}
            theme={{ radius: theme.radius.control, panelBorder: theme.colors.panelBorder, inputBg: theme.colors.inputBg, text: theme.colors.text }}
          />
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <Button variant="ghost" disabled={saving} onClick={cancel}>{translateUi("Cancel")}</Button>
            <Button disabled={saving} onClick={save}>{saving ? translateUi("Saving…") : translateUi("Save")}</Button>
            {error ? <div role="alert">{error}</div> : null}
          </div>
        </div>
      ) : (
        <div style={{ minHeight: 90, padding: "8px 2px", color: props.value ? theme.colors.text : theme.colors.muted, fontSize: "var(--fs-body)", lineHeight: 1.65 }}>
          {props.value ? <MarkdownRichText text={props.value} binderId={props.binderId} /> : translateUi("No {{value1}} yet.", { value1: props.label.toLocaleLowerCase() })}
        </div>
      )}
    </section>
  );
}

export function BinderCampaignWorkspace(props: { binderId: string; campaign: Campaign; binderCurrentDate: string | null; accent: string }) {
  return <CampaignWorkspaceContent key={JSON.stringify([props.binderId, props.campaign.id])} {...props} />;
}

function CampaignWorkspaceContent(props: { binderId: string; campaign: Campaign; binderCurrentDate: string | null; accent: string }) {
  const translateUi = useUiTranslation("dmUi");
  const [story, setStory] = useState(props.campaign.campaignStory ?? null);
  const [notes, setNotes] = useState(props.campaign.campaignNotes ?? null);
  const [records, setRecords] = useState<BinderRecordOption[]>([]);
  useEffect(() => {
    setStory(props.campaign.campaignStory ?? null);
    setNotes(props.campaign.campaignNotes ?? null);
  }, [props.campaign.id, props.campaign.campaignStory, props.campaign.campaignNotes]);
  useEffect(() => {
    let cancelled = false;
    void fetchBinderRecordOptions(props.binderId)
      .then((value) => { if (!cancelled) setRecords(value); })
      .catch(() => { if (!cancelled) setRecords([]); });
    return () => { cancelled = true; };
  }, [props.binderId]);
  const mentions = records.map((record) => ({ id: record.id, label: record.name, href: record.route, type: record.type }));

  return (
    <article style={{ maxWidth: 1180, padding: "6px 4px 60px" }}>
      <div style={{ display: "flex", gap: 13, alignItems: "center", marginBottom: 28 }}>
        <span style={{ display: "grid", color: props.accent }}><IconCampaign size={38} /></span>
        <div>
          <div style={{ color: theme.colors.muted, fontSize: "var(--fs-small)", textTransform: "uppercase", letterSpacing: "0.07em", fontWeight: 750 }}>{translateUi("Campaign")}</div>
          <div style={{ color: withAlpha(props.accent, 0.85), marginTop: 3 }}>
            {props.campaign.currentDate?.text || props.binderCurrentDate ? translateUi("Current date: {{value1}}", { value1: props.campaign.currentDate?.text ?? props.binderCurrentDate }) : translateUi("Current Date")}
          </div>
        </div>
      </div>
      <div style={{ display: "grid", gap: 34 }}>
        <CampaignRichText binderId={props.binderId} label={translateUi("Campaign Story")} value={story} accent={props.accent} mentions={mentions} onSave={async (campaignStory) => {
          const result = await updateCampaignBinderContent(props.campaign.id, { campaignStory });
          setStory(result.campaignStory);
        }} />
        <CampaignRichText binderId={props.binderId} label={translateUi("Campaign Notes")} value={notes} accent={props.accent} mentions={mentions} onSave={async (campaignNotes) => {
          const result = await updateCampaignBinderContent(props.campaign.id, { campaignNotes });
          setNotes(result.campaignNotes);
        }} />
      </div>
    </article>
  );
}
