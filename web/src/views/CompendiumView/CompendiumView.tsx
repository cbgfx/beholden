import React from "react";
import { Panel } from "../../components/ui/Panel";
import { Button } from "../../components/ui/Button";
import { theme } from "../../app/theme/theme";
import { api } from "../../app/services/api";
import { Select } from "../../components/ui/Select";

import { SpellsPanel } from "./panels/SpellsPanel";
import { RulesReferencePanel } from "./panels/RulesReferencePanel";

type CampaignRow = { id: string; name: string };

export function CompendiumView() {
  // --- RIGHT: existing import/export tools ---
  const [file, setFile] = React.useState<File | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [msg, setMsg] = React.useState<string>("");

  const [campaigns, setCampaigns] = React.useState<CampaignRow[]>([]);
  const [selectedCampaignId, setSelectedCampaignId] = React.useState<string>("");

  const [campaignImportFile, setCampaignImportFile] = React.useState<File | null>(null);
  const [campaignBusy, setCampaignBusy] = React.useState(false);
  const [campaignMsg, setCampaignMsg] = React.useState<string>("");

  React.useEffect(() => {
    (async () => {
      try {
        const rows = await api<CampaignRow[]>("/api/campaigns");
        setCampaigns(rows);
        if (!selectedCampaignId && rows.length) setSelectedCampaignId(rows[0].id);
      } catch {
        // ignore
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function uploadCompendium() {
    if (!file) return;
    setBusy(true);
    setMsg("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/compendium/import/xml", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.message ?? "Import failed");
      setMsg(`Imported.`);
      await api<unknown>("/api/meta");
    } catch (e: any) {
      setMsg(String(e?.message ?? e));
    } finally {
      setBusy(false);
    }
  }

  async function deleteCompendium() {
    setBusy(true);
    setMsg("");
    try {
      const res = await fetch("/api/compendium", { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.message ?? "Delete failed");
      setMsg("Compendium deleted.");
      await api<unknown>("/api/meta");
    } catch (e: any) {
      setMsg(String(e?.message ?? e));
    } finally {
      setBusy(false);
    }
  }

  function exportCampaign() {
    if (!selectedCampaignId) return;
    window.location.href = `/api/campaigns/${selectedCampaignId}/export`;
  }

  async function importCampaign() {
    if (!campaignImportFile) return;
    setCampaignBusy(true);
    setCampaignMsg("");
    try {
      const fd = new FormData();
      fd.append("file", campaignImportFile);
      const res = await fetch("/api/campaigns/import", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.message ?? "Import failed");
      setCampaignMsg("Campaign imported.");
      const rows = await api<CampaignRow[]>("/api/campaigns");
      setCampaigns(rows);

      if (json?.campaignId) setSelectedCampaignId(String(json.campaignId));
    } catch (e: any) {
      setCampaignMsg(String(e?.message ?? e));
    } finally {
      setCampaignBusy(false);
    }
  }

  return (
    <div style={{ height: "100%", padding: 12, boxSizing: "border-box" }}>
      <div
        style={{
          height: "100%",
          display: "grid",
          gridTemplateColumns: "340px 1fr 420px",
          gap: 14,
          alignItems: "stretch",
          minHeight: 0,
        }}
      >
        {/* LEFT */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14, minWidth: 0, minHeight: 0 }}>
          <SpellsPanel />
        </div>

        {/* MIDDLE */}
        <div style={{ minWidth: 0, minHeight: 0 }}>
          <RulesReferencePanel />
        </div>

        {/* RIGHT (existing tool panels) */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14, minWidth: 0, minHeight: 0, overflow: "auto" }}>
          <Panel title="Compendium import (XML)">
            <div style={{ color: theme.colors.muted, lineHeight: 1.4 }}>
              Upload a Fight Club–style compendium XML. The server converts it to JSON and stores it in{" "}
              <code>server/data/compendium.json</code>. Re-importing a monster or spell with the same name (case-insensitive, ignoring trailing
              <code>[...]</code>) will replace the existing entry.
              <br />
              <code>
                I recommend:{" "}
                <a target="blank" href="https://github.com/vidalvanbergen/FightClub5eXML">
                  Vianna's Compendium
                </a>
              </code>
            </div>

            <div style={{ marginTop: 14, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <input
                type="file"
                accept=".xml,text/xml,application/xml"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                style={{ color: theme.colors.text }}
              />
              <Button onClick={uploadCompendium} disabled={!file || busy}>
                {busy ? "Importing…" : "Import XML"}
              </Button>
              <Button variant="ghost" onClick={deleteCompendium} disabled={busy}>
                Delete Compendium
              </Button>
            </div>

            {msg ? (
              <div style={{ marginTop: 12, color: msg.toLowerCase().includes("fail") ? theme.colors.danger : theme.colors.text }}>{msg}</div>
            ) : null}
          </Panel>

          <Panel title="Import / Export Campaign">
            <div style={{ color: theme.colors.muted, lineHeight: 1.4 }}>
              Campaigns are stored as separate JSON files on disk for smaller saves and easy backups. Export downloads a single campaign JSON.
              Import restores (overwrites) a campaign with the same <code>campaign.id</code>.
            </div>

            <div style={{ marginTop: 14, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <Select value={selectedCampaignId} onChange={(e) => setSelectedCampaignId((e.target as any).value)} style={{
                  colorScheme: "dark",
                  background: theme.colors.panelBg,
                  color: theme.colors.text,
                  border: `1px solid ${theme.colors.panelBorder}`,
                  borderRadius: 10,
                  padding: "8px 10px",
                  minWidth: 260,
                }}>
                {campaigns.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>

              <Button onClick={exportCampaign} disabled={!selectedCampaignId}>
                Export
              </Button>
            </div>

            <div style={{ marginTop: 14, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <input
                type="file"
                accept=".json,application/json"
                onChange={(e) => setCampaignImportFile(e.target.files?.[0] ?? null)}
                style={{ color: theme.colors.text }}
              />
              <Button onClick={importCampaign} disabled={!campaignImportFile || campaignBusy}>
                {campaignBusy ? "Importing…" : "Import"}
              </Button>
            </div>

            {campaignMsg ? (
              <div
                style={{
                  marginTop: 12,
                  color:
                    campaignMsg.toLowerCase().includes("fail") || campaignMsg.toLowerCase().includes("missing")
                      ? theme.colors.danger
                      : theme.colors.text,
                }}
              >
                {campaignMsg}
              </div>
            ) : null}
          </Panel>
        </div>
      </div>
    </div>
  );
}