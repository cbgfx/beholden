import { UiText } from "@beholden/shared/i18n/useUiTranslation";
import React from "react";
import { C } from "@/lib/theme";
import { Button } from "@/ui/Button";
import { headingStyle } from "../shared/CharacterCreatorStyles";
import { campaignSelectionHasBinder } from "@/views/character-creator/utils/CharacterCreatorFormUtils";
import type { CharacterCreatorStepRenderContext, StepRenderResult } from "./CharacterCreatorStepContext";

interface CampaignLike {
  id: string;
  name: string;
  binderId: string | null;
}

function renderCampaignsStep({
  campaigns,
  selectedCampaignIds,
  toggleCampaign,
  missingGenderOrAge,
  error,
  busy,
  isEditing,
  onBack,
  onEditIdentity,
  onSubmit,
  side,
}: {
  campaigns: CampaignLike[];
  selectedCampaignIds: string[];
  toggleCampaign: (id: string, checked: boolean) => void;
  missingGenderOrAge: boolean;
  error: string | null;
  busy: boolean;
  isEditing: boolean;
  onBack: () => void;
  onEditIdentity: () => void;
  onSubmit: () => void;
  side: React.ReactNode;
}): { main: React.ReactNode; side: React.ReactNode } {
  const requiresGenderAge = campaignSelectionHasBinder(selectedCampaignIds, campaigns);
  const blockedByIdentity = requiresGenderAge && missingGenderOrAge;
  const main = (
    <div>
      <h2 style={headingStyle}>{<UiText text={"Assign to Campaigns"} namespace="playerUi" />}</h2>
      <p style={{ color: C.muted, marginBottom: 16 }}>{<UiText text={"Optional - you can assign later from your home page."} namespace="playerUi" />}</p>
      {campaigns.length === 0 && <p style={{ color: C.muted }}>{<UiText text={"You're not a member of any campaigns yet."} namespace="playerUi" />}</p>}
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
        {campaigns.map((campaign) => {
          const checked = selectedCampaignIds.includes(campaign.id);
          return (
            <label
              key={campaign.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "11px 15px",
                borderRadius: 8,
                cursor: "pointer",
                border: `2px solid ${checked ? C.accentHl : "rgba(255,255,255,0.12)"}`,
                background: checked ? "rgba(56,182,255,0.15)" : "rgba(255,255,255,0.055)",
                transition: "border-color 0.12s, background 0.12s",
              }}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={(e) => toggleCampaign(campaign.id, e.target.checked)}
                style={{ accentColor: C.accentHl, width: 16, height: 16 }}
              />
              <span style={{ fontWeight: 600 }}>{campaign.name}</span>
            </label>
          );
        })}
      </div>

      {blockedByIdentity && (
        <div style={{ color: C.red, marginBottom: 10 }}>
          {<UiText text={"A campaign you selected uses a Binder, which requires Gender and Age."} namespace="playerUi" />}{" "}
          <button
            type="button"
            onClick={onEditIdentity}
            style={{ color: C.red, textDecoration: "underline", background: "none", border: "none", padding: 0, cursor: "pointer", font: "inherit" }}
          >
            {<UiText text={"Go back and fill those in."} namespace="playerUi" />}
          </button>
        </div>
      )}
      {error && <div style={{ color: C.red, marginBottom: 10 }}>{error}</div>}

      <div style={{ display: "flex", gap: 10, justifyContent: "space-between" }}>
        <Button type="button" variant="ghost" onClick={onBack}>
          {<UiText text={"← Back"} namespace="playerUi" />}
        </Button>
        <Button type="button" variant="primary" onClick={onSubmit} disabled={busy || blockedByIdentity}>
          {busy ? <UiText text={"Saving…"} namespace="playerUi" /> : isEditing ? <UiText text={"Save Changes ✓"} namespace="playerUi" /> : <UiText text={"Create Character ✓"} namespace="playerUi" />}
        </Button>
      </div>
    </div>
  );

  return { main, side };
}

export function renderCampaignsFromContext(ctx: CharacterCreatorStepRenderContext): StepRenderResult {
  return renderCampaignsStep({
    campaigns: ctx.campaigns,
    selectedCampaignIds: ctx.form.campaignIds,
    toggleCampaign: (id, checked) => ctx.setForm((f) => ({
      ...f,
      campaignIds: checked ? [...f.campaignIds, id] : f.campaignIds.filter((campaignId) => campaignId !== id),
    })),
    missingGenderOrAge: !String(ctx.form.gender ?? "") || !Number.isInteger(Number(ctx.form.age)) || Number(ctx.form.age) <= 0,
    error: ctx.error,
    busy: ctx.busy,
    isEditing: ctx.isEditing,
    onBack: () => ctx.setStep(10),
    onEditIdentity: () => ctx.setStep(10),
    onSubmit: ctx.handleSubmit,
    side: ctx.sideSummary,
  });
}
