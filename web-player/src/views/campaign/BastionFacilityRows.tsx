import { C } from "@/lib/theme";
import { Select } from "@/ui/Select";
import type { BastionFacility, CompendiumFacility } from "./BastionViewShared";
import { ghostButtonStyle, inputStyle, normalizeOrder, orderListWithMaintain } from "./BastionViewShared";

export function FacilityRows(props: {
  rows: BastionFacility[];
  facilitiesByKey: Map<string, CompendiumFacility>;
  onUpdate?: (facilityId: string, patch: Partial<BastionFacility>) => void;
  onRemove?: (facilityId: string) => void;
  selectedFacilityId?: string | null;
  onSelectFacility?: (facilityId: string) => void;
}) {
  if (props.rows.length === 0) {
    return <div style={{ fontSize: "var(--fs-small)", color: C.muted, opacity: 0.5 }}>None</div>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {props.rows.map((facility) => {
        const definition = facility.definition ?? props.facilitiesByKey.get(facility.facilityKey) ?? null;
        const orders = orderListWithMaintain(definition?.orders ?? []);
        const selected = props.selectedFacilityId === facility.id;
        return (
          <div
            key={facility.id}
            style={{
              border: `1px solid ${selected ? `${C.accentHl}66` : C.panelBorder}`,
              borderRadius: 10,
              padding: "10px 12px",
              background: selected ? "rgba(56,182,255,0.08)" : "rgba(255,255,255,0.02)",
              cursor: props.onSelectFacility ? "pointer" : "default",
            }}
            onClick={() => props.onSelectFacility?.(facility.id)}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, marginBottom: 8 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: "var(--fs-small)", color: C.text }}>
                  {definition?.name ?? facility.facilityKey}
                </div>
                <div style={{ marginTop: 2, fontSize: "var(--fs-tiny)", color: C.muted }}>
                  {definition?.prerequisite ? `Prerequisite: ${definition.prerequisite}` : "No prerequisite"}
                  {definition?.hirelings != null ? ` - Hirelings: ${definition.hirelings}` : ""}
                </div>
              </div>
              {props.onRemove && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    props.onRemove?.(facility.id);
                  }}
                  style={ghostButtonStyle()}
                >
                  Remove
                </button>
              )}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: orders.length > 0 ? "180px 1fr" : "1fr", gap: 8 }}>
              {orders.length > 0 && (
                <Select
                  value={facility.order ?? "Maintain"}
                  onChange={(e) => props.onUpdate?.(facility.id, { order: normalizeOrder(e.target.value) })}
                  onClick={(e) => e.stopPropagation()}
                  disabled={!props.onUpdate}
                >
                  {orders.map((order) => (
                    <option key={`${facility.id}:${order}`} value={order}>{order}</option>
                  ))}
                </Select>
              )}
              <input
                value={facility.notes}
                onChange={(e) => props.onUpdate?.(facility.id, { notes: e.target.value })}
                onClick={(e) => e.stopPropagation()}
                style={inputStyle}
                placeholder="Facility notes..."
                disabled={!props.onUpdate}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
