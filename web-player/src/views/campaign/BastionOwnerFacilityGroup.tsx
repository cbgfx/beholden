import { C } from "@/lib/theme";
import { Select } from "@/ui/Select";
import type { Bastion, BastionFacility, CompendiumFacility } from "./BastionViewShared";
import { accentButtonStyle } from "./BastionViewShared";
import { FacilityRows } from "./BastionFacilityRows";

export function BastionOwnerFacilityGroup({
  ownerId,
  owner,
  rows,
  ownerOptions,
  addKey,
  onAddKeyChange,
  onAdd,
  onUpdate,
  onRemove,
  facilitiesByKey,
  selectedFacilityId,
  onSelectFacility,
}: {
  ownerId: string;
  owner: NonNullable<Bastion["assignedPlayers"]>[number] | undefined;
  rows: BastionFacility[];
  ownerOptions: CompendiumFacility[];
  addKey: string;
  onAddKeyChange: (value: string) => void;
  onAdd: () => void;
  onUpdate: (facilityId: string, patch: Partial<BastionFacility>) => void;
  onRemove: (facilityId: string) => void;
  facilitiesByKey: Map<string, CompendiumFacility>;
  selectedFacilityId: string | null;
  onSelectFacility: (facilityId: string) => void;
}) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ marginBottom: 8, fontSize: "var(--fs-small)", fontWeight: 700, color: C.muted }}>
        {owner?.characterName || "Assigned Character"}
        <span style={{ fontWeight: 400, marginLeft: 6 }}>Lv {owner?.level ?? 1}</span>
      </div>
      <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
        <Select
          value={addKey}
          onChange={(e) => onAddKeyChange(e.target.value)}
          style={{ flex: 1 }}
        >
          <option value="">Add facility...</option>
          {ownerOptions.map((f) => (
            <option key={`${ownerId}:${f.key}`} value={f.key}>
              {f.name} ({f.type}, lvl {f.minimumLevel})
            </option>
          ))}
        </Select>
        <button
          onClick={onAdd}
          disabled={!addKey}
          style={accentButtonStyle(Boolean(addKey))}
        >
          Add
        </button>
      </div>
      <FacilityRows
        rows={rows}
        onUpdate={onUpdate}
        onRemove={onRemove}
        facilitiesByKey={facilitiesByKey}
        selectedFacilityId={selectedFacilityId}
        onSelectFacility={onSelectFacility}
      />
    </div>
  );
}
