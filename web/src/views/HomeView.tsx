import React, { useMemo, useState } from "react";
import { theme, withAlpha } from "@/theme/theme";
import { Button } from "@/ui/Button";
import { IconButton } from "@/ui/IconButton";
import { IconPencil, IconTrash } from "@/icons";

type CampaignSummary = {
  id: string;
  name: string;
};

type Props = {
  campaigns: CampaignSummary[];
  onCreateCampaign: () => void;
  onOpenCampaign: (campaignId: string) => void;
  onEditCampaign: (campaignId: string) => void;
  onDeleteCampaign: (campaignId: string) => void;
  onExportCampaign: (campaignId: string) => void;
  onImportCampaign: (file: File) => Promise<void>;
};

function CardShell(props: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div
      style={{
        width: 320,
        minWidth: 320,
        maxWidth: 320,
        background: withAlpha(theme.colors.panelBg, 0.9),
        border: `1px solid ${theme.colors.panelBorder}`,
        borderRadius: 16,
        padding: 14,
        boxShadow: "0 24px 60px rgba(0,0,0,0.25)",
        ...props.style,
      }}
    >
      {props.children}
    </div>
  );
}

export function HomeView(props: Props) {
  const sorted = useMemo(() => {
    return [...props.campaigns].sort((a, b) => a.name.localeCompare(b.name));
  }, [props.campaigns]);

  const [importFile, setImportFile] = useState<File | null>(null);
  const [importBusy, setImportBusy] = useState(false);
  const [importMsg, setImportMsg] = useState<string>("");

  async function doImport() {
    if (!importFile || importBusy) return;
    setImportBusy(true);
    setImportMsg("");
    try {
      await props.onImportCampaign(importFile);
      setImportMsg("Campaign imported.");
      setImportFile(null);
    } catch (e: any) {
      setImportMsg(String(e?.message ?? e));
    } finally {
      setImportBusy(false);
    }
  }

  const shell: React.CSSProperties = {
    width: "100%",
    height: "100%",
    padding: 24,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  };

  const rail: React.CSSProperties = {
    width: "min(1180px, 100%)",
    display: "flex",
    flexDirection: "column",
    gap: 14,
  };

  const header: React.CSSProperties = {
    display: "flex",
    alignItems: "end",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap",
  };

  const carousel: React.CSSProperties = {
    display: "flex",
    gap: 14,
    overflowX: "auto",
    paddingBottom: 10,
    scrollbarWidth: "thin",
  };

  const muted = theme.colors.muted;
  const accent = theme.colors.accentPrimary;

  return (
    <div style={shell}>
      <div style={rail}>
        <div style={header}>
          <div>
            <div style={{ fontSize: 26, fontWeight: 950, color: theme.colors.text }}>Campaigns</div>
            <div style={{ color: muted, marginTop: 6 }}>
              Create a new campaign, import one, or jump back into an existing world.
            </div>
          </div>
        </div>

        <div style={carousel}>
          {/* Create / Import card */}
          <CardShell style={{ border: `1px dashed ${withAlpha(accent, 0.7)}` }}>
            <div style={{ fontSize: 18, fontWeight: 950, color: theme.colors.panelBg }}>Create / Import</div>
            <div style={{ color: muted, marginTop: 6, lineHeight: 1.35 }}>
              Campaigns are stored as separate JSON files on disk. Import restores (overwrites) a campaign with the same <code>campaign.id</code>.
            </div>

            <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
              <Button onClick={props.onCreateCampaign}>+ Campaign</Button>
            </div>

            <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
              <input
                type="file"
                accept=".json,application/json"
                onChange={(e) => setImportFile(e.target.files?.[0] ?? null)}
                style={{ color: theme.colors.text }}
              />
              <Button onClick={doImport} disabled={!importFile || importBusy}>
                {importBusy ? "Importing…" : "Import"}
              </Button>
            </div>

            {importMsg ? (
              <div
                style={{
                  marginTop: 10,
                  color:
                    importMsg.toLowerCase().includes("fail") || importMsg.toLowerCase().includes("missing")
                      ? theme.colors.red
                      : theme.colors.text,
                }}
              >
                {importMsg}
              </div>
            ) : null}
          </CardShell>

          {/* Campaign cards */}
          {sorted.map((c) => (
            <CardShell key={c.id}>
              <div style={{ display: "flex", alignItems: "start", justifyContent: "space-between", gap: 10 }}>
                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 18,
                      fontWeight: 950,
                      color: theme.colors.panelBg,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                    title={c.name}
                  >
                    {c.name}
                  </div>
                  <div style={{ color: muted, marginTop: 6, fontSize: 12 }}>Campaign ID: <code>{c.id}</code></div>
                </div>

                <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                  <IconButton onClick={() => props.onEditCampaign(c.id)} title="Edit">
                    <IconPencil />
                  </IconButton>
                  <IconButton onClick={() => props.onDeleteCampaign(c.id)} title="Delete">
                    <IconTrash />
                  </IconButton>
                </div>
              </div>

              <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
                <Button variant="ghost" onClick={() => props.onOpenCampaign(c.id)}>
                  Open
                </Button>
                <Button variant="ghost" onClick={() => props.onExportCampaign(c.id)}>
                  Export
                </Button>
              </div>
            </CardShell>
          ))}
        </div>
      </div>
    </div>
  );
}
