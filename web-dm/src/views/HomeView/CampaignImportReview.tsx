import type { CampaignImportPreview } from "@beholden/shared/api/campaignImport.ts";
import { useUiTranslation } from "@beholden/shared/i18n/useUiTranslation";
import { Modal } from "@/components/overlay/Modal";
import { Button } from "@/ui/Button";

export function CampaignImportReview({
  preview,
  busy,
  error,
  onClose,
  onConfirm,
}: {
  preview: CampaignImportPreview;
  busy: boolean;
  error: string;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const t = useUiTranslation("dmUi");
  const replacing = preview.existingName !== null;
  return (
    <Modal
      isOpen
      title={t("Preview campaign import")}
      onClose={() => {
        if (!busy) onClose();
      }}
      width={620}
    >
      <div style={{ padding: 16, display: "grid", gap: 16 }}>
        <strong style={{ overflowWrap: "anywhere" }}>{preview.name}</strong>
        <p>
          {t(
            replacing
              ? "This replaces the existing campaign and its contents, including records absent from this file. Local campaign memberships are preserved."
              : "This creates a new campaign. Existing campaigns are kept.",
          )}
        </p>
        {replacing && (
          <p>
            {t("Existing campaign")}: {preview.existingName}
          </p>
        )}
        {preview.sameNameCampaigns.length > 0 && (
          <p>
            {t(
              "A different campaign has the same name. It will be kept; matching uses IDs.",
            )}
          </p>
        )}
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th scope="col" style={{ textAlign: "left" }}>
                {t("Contents")}
              </th>
              <th scope="col">{t("In file")}</th>
              {replacing && <th scope="col">{t("Currently saved")}</th>}
            </tr>
          </thead>
          <tbody>
            {preview.counts.map((row) => (
              <tr key={row.collection}>
                <th scope="row" style={{ textAlign: "left", padding: "5px 0" }}>
                  {t(labels[row.collection] ?? row.collection)}
                </th>
                <td style={{ textAlign: "center" }}>{row.incoming}</td>
                {replacing && (
                  <td style={{ textAlign: "center" }}>{row.existing}</td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        {preview.warnings.length > 0 && (
          <ul>
            {preview.warnings.map((warning, index) => (
              <li key={index}>{warning}</li>
            ))}
          </ul>
        )}
        {error && <p role="alert">{error}</p>}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 12,
            justifyContent: "flex-end",
          }}
        >
          <Button variant="ghost" disabled={busy} onClick={onClose}>
            {t("Cancel")}
          </Button>
          <Button disabled={busy} onClick={onConfirm}>
            {t(
              busy
                ? "Importing…"
                : replacing
                  ? "Replace campaign"
                  : "Create campaign",
            )}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

const labels: Record<string, string> = {
  adventures: "Adventures",
  encounters: "Encounters",
  players: "Players",
  inpcs: "Party NPCs",
  notes: "Notes",
  partyInventory: "Party inventory",
  treasure: "Treasure",
  conditions: "Conditions",
  bastions: "Bastions",
};
