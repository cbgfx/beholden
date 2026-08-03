import { useMemo, useRef, useState } from "react";
import { theme } from "@/theme/theme";
import { Button } from "@/ui/Button";
import { IconBinder, IconCampaign, IconPlus } from "@/icons";
import { api } from "@/services/api";
import { CampaignCard } from "@/views/HomeView/CampaignCard";
import { BinderCard } from "@/views/HomeView/BinderCard";
import type { CampaignSummary } from "@/views/HomeView/CampaignCard";
import type { BinderSummary } from "@/services/binderApi";
import { importBinder, previewBinderImport, type BinderImportPreview } from "@/services/binderApi";

type HomeBinderSummary = BinderSummary & { canEdit: boolean };

type Props = {
  campaigns: CampaignSummary[];
  binders: HomeBinderSummary[];
  onCreateCampaign: () => void;
  onOpenCampaign: (campaignId: string) => void;
  onEditCampaign: (campaignId: string) => void;
  onDeleteCampaign: (campaignId: string) => Promise<void> | void;
  onRefresh: () => Promise<void> | void;
  onCreateBinder: () => void;
  onOpenBinder: (binderId: string) => void;
  onEditBinder: (binderId: string) => void;
  onDeleteBinder: (binderId: string) => Promise<void> | void;
};

function SectionHeading({
  icon,
  title,
  count,
  subtitle,
}: {
  icon: React.ReactNode;
  title: string;
  count: number;
  subtitle: string;
}) {
  return (
    <div>
      <div
        style={{
          fontSize: "var(--fs-hero)",
          fontWeight: 900,
          margin: 0,
          color: theme.colors.text,
          display: "flex",
          alignItems: "center",
          gap: 13,
        }}
      >
        {icon}
        <span>
          {title}&nbsp;
          {count > 0 ? <span style={{ color: theme.colors.muted }}>({count})</span> : null}
        </span>
      </div>
      <div style={{ marginTop: 2, color: theme.colors.muted, fontSize: "var(--fs-subtitle)" }}>
        {subtitle}
      </div>
    </div>
  );
}

export function HomeView({
  campaigns,
  binders,
  onCreateCampaign,
  onOpenCampaign,
  onEditCampaign,
  onDeleteCampaign,
  onRefresh,
  onCreateBinder,
  onOpenBinder,
  onEditBinder,
  onDeleteBinder,
}: Props) {
  const [campaignTab, setCampaignTab] = useState<"active" | "archived">("active");
  const sortedCampaigns = useMemo(() => {
    return campaigns.filter((campaign) => campaign.isActive === (campaignTab === "active")).sort((a, b) => {
      const ta = a.updatedAt ?? 0;
      const tb = b.updatedAt ?? 0;
      if (tb !== ta) return tb - ta;
      return a.name.localeCompare(b.name);
    });
  }, [campaigns, campaignTab]);
  const sortedBinders = useMemo(
    () => [...binders].sort((a, b) => b.updatedAt - a.updatedAt || a.name.localeCompare(b.name)),
    [binders],
  );

  const [importFile, setImportFile] = useState<File | null>(null);
  const [importBusy, setImportBusy] = useState(false);
  const [importMsg, setImportMsg] = useState("");
  const [importFailed, setImportFailed] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [binderImportFile, setBinderImportFile] = useState<File | null>(null);
  const [binderImportBusy, setBinderImportBusy] = useState(false);
  const [binderImportMsg, setBinderImportMsg] = useState("");
  const [binderImportFailed, setBinderImportFailed] = useState(false);
  const [binderPreview, setBinderPreview] = useState<BinderImportPreview | null>(null);
  const binderFileInputRef = useRef<HTMLInputElement>(null);

  async function importCampaign() {
    if (!importFile) return;
    setImportBusy(true);
    setImportMsg("");
    setImportFailed(false);
    try {
      const fd = new FormData();
      fd.append("file", importFile);
      await api<unknown>("/api/campaigns/import", { method: "POST", body: fd });
      setImportMsg("Campaign imported — it now appears below.");
      setImportFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      await onRefresh();
    } catch (error: unknown) {
      setImportFailed(true);
      setImportMsg(error instanceof Error ? error.message : String(error));
    } finally {
      setImportBusy(false);
    }
  }

  async function handleBinderImport() {
    if (!binderImportFile) return;
    setBinderImportBusy(true);
    setBinderImportMsg("");
    setBinderImportFailed(false);
    try {
      const result = await importBinder(binderImportFile);
      setBinderImportMsg(`${result.name} imported with ${result.recordCount} records.`);
      setBinderImportFile(null);
      setBinderPreview(null);
      if (binderFileInputRef.current) binderFileInputRef.current.value = "";
      await onRefresh();
    } catch (error: unknown) {
      setBinderImportFailed(true);
      setBinderImportMsg(error instanceof Error ? error.message : String(error));
    } finally {
      setBinderImportBusy(false);
    }
  }

  return (
    <div
      style={{
        width: "100%",
        minHeight: "100%",
        display: "grid",
        justifyItems: "center",
        alignContent: "start",
        padding: "20px 28px 36px",
      }}
    >
      <div style={{ width: "100%", maxWidth: 1040, display: "grid", gap: 14 }}>
        <SectionHeading
          icon={<IconCampaign size={34} />}
          title="Campaigns"
          count={campaigns.length}
          subtitle="Jump back into an existing campaign, or start a new one."
        />
        <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: "var(--fs-small)" }}>
          {(["active", "archived"] as const).map((tab) => {
            const count = campaigns.filter((campaign) => campaign.isActive === (tab === "active")).length;
            return (
              <a
                key={tab}
                href={`#campaigns-${tab}`}
                onClick={(event) => {
                  event.preventDefault();
                  setCampaignTab(tab);
                }}
                style={{
                  color: campaignTab === tab ? theme.colors.text : theme.colors.muted,
                  textDecoration: campaignTab === tab ? "underline" : "none",
                  textUnderlineOffset: 3,
                  cursor: "pointer",
                }}
              >
                {tab === "active" ? "Active" : "Archived"} ({count})
              </a>
            );
          })}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <Button onClick={onCreateCampaign} title="Create a new campaign">
            <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
              <IconPlus size={14} />
              New Campaign
            </span>
          </Button>

          <div style={{ width: 1, height: 24, background: theme.colors.panelBorder, margin: "0 4px" }} />

          <label
            style={{
              padding: "7px 14px",
              borderRadius: theme.radius.control,
              border: `1px solid ${theme.colors.panelBorder}`,
              background: theme.colors.inputBg,
              color: importFile ? theme.colors.text : theme.colors.muted,
              fontSize: "var(--fs-subtitle)",
              cursor: "pointer",
              whiteSpace: "nowrap",
              overflow: "hidden",
              maxWidth: 200,
              textOverflow: "ellipsis",
              display: "block",
            }}
            title={importFile ? importFile.name : "Choose a campaign JSON file"}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              onChange={(event) => {
                setImportFile(event.target.files?.[0] ?? null);
                setImportMsg("");
                setImportFailed(false);
              }}
              style={{ display: "none" }}
            />
            {importFile ? importFile.name : "Choose file…"}
          </label>

          <Button
            variant="ghost"
            onClick={importCampaign}
            disabled={!importFile || importBusy}
            title="Import selected campaign file"
          >
            {importBusy ? "Importing…" : "Import"}
          </Button>

          {importMsg ? (
            <span style={{ fontSize: "var(--fs-small)", color: importFailed ? theme.colors.red : theme.colors.green }}>
              {importMsg}
            </span>
          ) : null}
        </div>

        {sortedCampaigns.length > 0 ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(290px, 1fr))", gap: 16 }}>
            {sortedCampaigns.map((campaign) => (
              <CampaignCard
                key={campaign.id}
                campaign={campaign}
                onOpen={() => onOpenCampaign(campaign.id)}
                onEdit={() => onEditCampaign(campaign.id)}
                onDelete={() => onDeleteCampaign(campaign.id)}
                onRefresh={onRefresh}
              />
            ))}
          </div>
        ) : (
          <div style={{ color: theme.colors.muted, fontSize: "var(--fs-body)", padding: "48px 0", textAlign: "center" }}>
            {campaignTab === "active" ? "No active campaigns yet — create one above to get started." : "No archived campaigns."}
          </div>
        )}

        <div style={{ height: 1, background: theme.colors.panelBorder, margin: "8px 0 2px" }} />

        <div style={{ display: "grid", justifyItems: "start", gap: 10 }}>
          <SectionHeading
            icon={<IconBinder size={34} />}
            title="Binders"
            count={binders.length}
            subtitle="Build and organize the shared setting lore behind your campaigns."
          />
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <Button onClick={onCreateBinder} title="Create a new Binder">
              <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
                <IconPlus size={14} />
                New Binder
              </span>
            </Button>
            <div style={{ width: 1, height: 24, background: theme.colors.panelBorder, margin: "0 4px" }} />
            <label
              style={{
                padding: "7px 14px",
                borderRadius: theme.radius.control,
                border: `1px solid ${theme.colors.panelBorder}`,
                background: theme.colors.inputBg,
                color: binderImportFile ? theme.colors.text : theme.colors.muted,
                fontSize: "var(--fs-subtitle)",
                cursor: "pointer",
                whiteSpace: "nowrap",
                overflow: "hidden",
                maxWidth: 200,
                textOverflow: "ellipsis",
              }}
              title={binderImportFile?.name ?? "Choose a Binder JSON file"}
            >
              <input
                ref={binderFileInputRef}
                type="file"
                accept=".json,application/json"
                onChange={(event) => {
                  const file = event.target.files?.[0] ?? null;
                  setBinderImportFile(file);
                  setBinderPreview(null);
                  setBinderImportMsg("");
                  setBinderImportFailed(false);
                  if (file) {
                    setBinderImportBusy(true);
                    void previewBinderImport(file).then((preview) => {
                      setBinderPreview(preview);
                      setBinderImportMsg(`Preview: ${preview.name}, ${preview.recordCount} records${preview.warnings.length ? ` — ${preview.warnings.length} warning(s)` : ""}.`);
                    }).catch((error: unknown) => {
                      setBinderImportFailed(true);
                      setBinderImportMsg(error instanceof Error ? error.message : String(error));
                    }).finally(() => setBinderImportBusy(false));
                  }
                }}
                style={{ display: "none" }}
              />
              {binderImportFile?.name ?? "Choose file…"}
            </label>
            <Button
              variant="ghost"
              onClick={handleBinderImport}
              disabled={!binderImportFile || !binderPreview || binderImportBusy}
              title="Import selected Binder file"
            >
              {binderImportBusy ? "Importing…" : "Import"}
            </Button>
            {binderImportMsg ? (
              <span style={{ fontSize: "var(--fs-small)", color: binderImportFailed ? theme.colors.red : theme.colors.green }}>
                {binderImportMsg}
              </span>
            ) : null}
            {binderPreview?.warnings.length ? <span title={binderPreview.warnings.join("\n")} style={{ color: theme.colors.accentWarning, fontSize: "var(--fs-small)" }}>Review warnings</span> : null}
          </div>
        </div>

        {sortedBinders.length > 0 ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(290px, 1fr))", gap: 16 }}>
            {sortedBinders.map((binder) => (
              <BinderCard
                key={binder.id}
                binder={binder}
                canEdit={binder.canEdit}
                onOpen={() => onOpenBinder(binder.id)}
                onEdit={() => onEditBinder(binder.id)}
                onDelete={() => onDeleteBinder(binder.id)}
              />
            ))}
          </div>
        ) : (
          <div style={{ color: theme.colors.muted, fontSize: "var(--fs-body)", padding: "38px 0", textAlign: "center" }}>
            No Binders yet — create one above to start organizing your setting.
          </div>
        )}
      </div>
    </div>
  );
}
