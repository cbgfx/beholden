// web-dm/src/views/AdminView/CampaignsAdminPanel.tsx
// Admin panel for managing campaign memberships (who is DM / player per campaign).

import React, { useEffect, useState } from "react";
import { api } from "@/services/api";
import { theme } from "@/theme/theme";
import type { Campaign } from "./adminTypes";
import { CampaignCard } from "./CampaignCard";

export function CampaignsAdminPanel() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<Campaign[]>("/api/campaigns")
      .then(setCampaigns)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ margin: "0 0 4px", fontSize: "var(--fs-title)", fontWeight: 700 }}>Campaign Memberships</h2>
        <p style={{ margin: 0, fontSize: "var(--fs-subtitle)", color: theme.colors.muted }}>
          Assign users to campaigns as Dungeon Master or Player.
        </p>
      </div>

      {loading ? (
        <div style={{ color: theme.colors.muted, padding: 20 }}>Loading…</div>
      ) : campaigns.length === 0 ? (
        <div style={{
          padding: "32px 20px", textAlign: "center",
          color: theme.colors.muted, fontSize: "var(--fs-medium)",
          background: theme.colors.panelBg,
          border: `1px solid ${theme.colors.panelBorder}`,
          borderRadius: theme.radius.panel,
        }}>
          No campaigns yet. Create a campaign in the main app first.
        </div>
      ) : (
        campaigns.map((c) => <CampaignCard key={c.id} campaign={c} />)
      )}
    </div>
  );
}
