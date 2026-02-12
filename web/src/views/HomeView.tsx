import React, { useMemo, useState } from "react";
import { theme } from "../app/theme/theme";
import { Button } from "../components/ui/Button";
import { Select } from "../components/ui/Select";

type CampaignSummary = {
  id: string;
  name: string;
};

type Props = {
  campaigns: CampaignSummary[];
  onCreateCampaign: () => void;
  onOpenCampaign: (campaignId: string) => void;
};

export function HomeView({ campaigns, onCreateCampaign, onOpenCampaign }: Props) {
  const sorted = useMemo(() => {
    return [...campaigns].sort((a, b) => a.name.localeCompare(b.name));
  }, [campaigns]);

  const [selectedId, setSelectedId] = useState<string>(sorted[0]?.id ?? "");

  React.useEffect(() => {
    // Keep selection stable when campaigns update
    if (!selectedId && sorted[0]?.id) setSelectedId(sorted[0].id);
    if (selectedId && !sorted.some((c) => c.id === selectedId)) setSelectedId(sorted[0]?.id ?? "");
  }, [sorted, selectedId]);

  const shell: React.CSSProperties = {
    width: "100%",
    height: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  };

  const card: React.CSSProperties = {
    width: 560,
    maxWidth: "100%",
    background: theme.colors.panel,
    border: `1px solid ${theme.colors.panelBorder}`,
    borderRadius: theme.radius.panel,
    padding: 16,
    boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
  };

  const selectStyle: React.CSSProperties = {
    width: "100%",
    padding: "10px 12px",
    borderRadius: theme.radius.control,
    border: `1px solid ${theme.colors.panelBorder}`,
    background: theme.colors.panel2,
    color: theme.colors.text,
    outline: "none",
    fontWeight: 700,
  };

  if (sorted.length === 0) {
    return (
      <div style={shell}>
        <div style={card}>
          <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 8 }}>No campaigns yet</div>
          <div style={{ color: theme.colors.textMuted, marginBottom: 16 }}>
            Create your first campaign to get started.
          </div>
          <Button onClick={onCreateCampaign}>+ Create campaign</Button>
        </div>
      </div>
    );
  }

  return (
    <div style={shell}>
      <div style={card}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 800 }}>Choose a campaign</div>
            <div style={{ color: theme.colors.textMuted, marginTop: 4 }}>Open an existing campaign or create a new one.</div>
          </div>
          <Button onClick={onCreateCampaign}>+ Campaign</Button>
        </div>

        <div style={{ height: 12 }} />

        <Select value={selectedId} onChange={(e) => setSelectedId((e.target as any).value)} style={selectStyle}>
          {sorted.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>

        <div style={{ height: 12 }} />

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <Button variant="ghost" onClick={() => onOpenCampaign(selectedId)} disabled={!selectedId}>
            Open
          </Button>
        </div>
      </div>
    </div>
  );
}