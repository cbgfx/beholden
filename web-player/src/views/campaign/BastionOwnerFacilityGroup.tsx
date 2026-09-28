import { useUiTranslation } from "@beholden/shared/i18n/useUiTranslation";
import { C } from "@/lib/theme";
import { Select } from "@/ui/Select";
import type { BastionSpaceDefinition } from "@beholden/shared/domain/bastionFacilities";
import type { Bastion, BastionFacility, CompendiumFacility } from "./BastionViewShared";
import { accentButtonStyle } from "./BastionViewShared";
import { FacilityRows } from "./BastionFacilityRows";

export function BastionOwnerFacilityGroup({
  ownerId,
  owner,
  rows,
  ownerOptions,
  addKey,
  adding,
  onAddKeyChange,
  onAdd,
  onChangeOrder,
  onCommitNotes,
  onRemove,
  facilitiesByKey,
  spaces,
  selectedFacilityId,
  onSelectFacility,
}: {
  ownerId: string;
  owner: NonNullable<Bastion["assignedPlayers"]>[number] | undefined;
  rows: BastionFacility[];
  ownerOptions: CompendiumFacility[];
  addKey: string;
  /** While an operation is running; Add waits for the server, so it's disabled meanwhile. */
  adding: boolean;
  onAddKeyChange: (value: string) => void;
  onAdd: () => void;
  onChangeOrder: (facilityId: string, order: string | null) => void;
  onCommitNotes: (facilityId: string, notes: string) => Promise<boolean>;
  onRemove: (facilityId: string) => void;
  facilitiesByKey: Map<string, CompendiumFacility>;
  /** Size names from the compendium. */
  spaces: BastionSpaceDefinition[];
  selectedFacilityId: string | null;
  onSelectFacility: (facilityId: string) => void;
}) {
  const translateUi = useUiTranslation("playerUi");
  const t = useUiTranslation("playerUi");
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ marginBottom: 8, fontSize: "var(--fs-small)", fontWeight: 700, color: C.muted }}>
        {owner?.characterName || t("Assigned Character")}
        <span style={{ fontWeight: 400, marginLeft: 6 }}>{t("Lv {{level}}", { level: owner?.level ?? 1 })}</span>
      </div>
      <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
        <Select
          value={addKey}
          onChange={(e) => onAddKeyChange(e.target.value)}
          style={{ flex: 1 }}
        >
          <option value="">{t("Add facility...")}</option>
          {ownerOptions.map((f) => (
            <option key={`${ownerId}:${f.key}`} value={f.key}>
              {f.name} ({f.type}{translateUi(", lvl")} {f.minimumLevel})
            </option>
          ))}
        </Select>
        <button
          onClick={onAdd}
          disabled={!addKey || adding}
          style={accentButtonStyle(Boolean(addKey) && !adding)}
        >
          {t("Add")}
        </button>
      </div>
      <FacilityRows
        rows={rows}
        onChangeOrder={onChangeOrder}
        onCommitNotes={onCommitNotes}
        onRemove={onRemove}
        facilitiesByKey={facilitiesByKey}
        spaces={spaces}
        selectedFacilityId={selectedFacilityId}
        onSelectFacility={onSelectFacility}
      />
    </div>
  );
}
