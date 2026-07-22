import React from "react";
import { C } from "@/lib/theme";
import { headingStyle } from "../shared/CharacterCreatorStyles";
import type { CharacterCreatorStepRenderContext, StepRenderResult } from "./CharacterCreatorStepContext";

interface CampaignLike {
  id: string;
  name: string;
}

function renderCampaignsStep({
  campaigns,
  selectedCampaignIds,
  toggleCampaign,
  error,
  busy,
  isEditing,
  onBack,
  onSubmit,
  side,
}: {
  campaigns: CampaignLike[];
  selectedCampaignIds: string[];
  toggleCampaign: (id: string, checked: boolean) => void;
  error: string | null;
  busy: boolean;
  isEditing: boolean;
  onBack: () => void;
  onSubmit: () => void;
  side: React.ReactNode;
}): { main: React.ReactNode; side: React.ReactNode } {
  const main = (
    <div>
      <h2 style={headingStyle}>Assign to Campaigns</h2>
      <p style={{ color: C.muted, marginBottom: 16 }}>Optional - you can assign later from your home page.</p>
      {campaigns.length === 0 && <p style={{ color: C.muted }}>You're not a member of any campaigns yet.</p>}
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

      {error && <div style={{ color: C.red, marginBottom: 10 }}>{error}</div>}

      <div style={{ display: "flex", gap: 10, justifyContent: "space-between" }}>
        <button type="button" onClick={onBack} style={{ padding: "9px 22px", borderRadius: 8, fontWeight: 700, cursor: "pointer", border: "1px solid rgba(255,255,255,0.18)", background: "rgba(255,255,255,0.08)", color: C.text, fontSize: "var(--fs-medium)" }}>
          ← Back
        </button>
        <button
          type="button"
          onClick={onSubmit}
          disabled={busy}
          style={{
            padding: "9px 22px",
            borderRadius: 8,
            fontWeight: 700,
            cursor: busy ? "not-allowed" : "pointer",
            border: "none",
            background: busy ? "rgba(255,255,255,0.06)" : C.accentHl,
            color: busy ? "rgba(160,180,220,0.40)" : C.textDark,
            fontSize: "var(--fs-medium)",
          }}
        >
          {busy ? "Saving…" : isEditing ? "Save Changes ✓" : "Create Character ✓"}
        </button>
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
    error: ctx.error,
    busy: ctx.busy,
    isEditing: ctx.isEditing,
    onBack: () => ctx.setStep(10),
    onSubmit: ctx.handleSubmit,
    side: ctx.sideSummary,
  });
}
