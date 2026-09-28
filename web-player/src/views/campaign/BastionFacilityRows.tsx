import { useCommittedText } from "@beholden/shared/ui";
import { facilitySizeName, isFacilityUpgraded, type BastionSpaceDefinition } from "@beholden/shared/domain/bastionFacilities";
import { C } from "@/lib/theme";
import { Select } from "@/ui/Select";
import type { BastionFacility, CompendiumFacility } from "./BastionViewShared";
import { ghostButtonStyle, inputStyle, normalizeOrder, orderListWithMaintain } from "./BastionViewShared";
import { useUiTranslation } from "@beholden/shared/i18n";

/** A facility's notes, saved when typing pauses or the field loses focus rather than per keystroke. */
function FacilityNotesInput(props: {
  value: string;
  placeholder: string;
  onCommit?: (notes: string) => Promise<boolean> | void;
}) {
  const notes = useCommittedText(props.value, (next) => props.onCommit?.(next));
  return (
    <input
      value={notes.text}
      onChange={(e) => notes.onChange(e.target.value)}
      onBlur={notes.onBlur}
      onClick={(e) => e.stopPropagation()}
      style={inputStyle}
      placeholder={props.placeholder}
      disabled={!props.onCommit}
    />
  );
}

export function FacilityRows(props: {
  rows: BastionFacility[];
  facilitiesByKey: Map<string, CompendiumFacility>;
  /** Omitted for read-only rows, such as facilities the DM granted. */
  onChangeOrder?: (facilityId: string, order: string | null) => void;
  onCommitNotes?: (facilityId: string, notes: string) => Promise<boolean> | void;
  onRemove?: (facilityId: string) => void;
  /** Size names from the compendium. */
  spaces?: BastionSpaceDefinition[];
  selectedFacilityId?: string | null;
  onSelectFacility?: (facilityId: string) => void;
}) {
  const t = useUiTranslation("playerUi");
  if (props.rows.length === 0) {
    return <div style={{ fontSize: "var(--fs-small)", color: C.muted, opacity: 0.5 }}>{t("None")}</div>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {props.rows.map((facility) => {
        const definition = facility.definition ?? props.facilitiesByKey.get(facility.facilityKey) ?? null;
        const orders = orderListWithMaintain(definition?.orders ?? []);
        const selected = props.selectedFacilityId === facility.id;
        const hirelings = facility.hirelings ?? definition?.hirelings ?? null;
        const upgradeSummary = definition && isFacilityUpgraded(definition, facility.size) ? definition.upgrade?.summary : null;
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
                  {definition?.prerequisite ? t("Prerequisite: {{prerequisite}}", { prerequisite: definition.prerequisite }) : t("No prerequisite")}
                  {hirelings != null ? ` ${t("- Hirelings: {{count}}", { count: hirelings })}` : ""}
                </div>
                {facility.size ? (
                  <div style={{ marginTop: 2, fontSize: "var(--fs-tiny)", color: C.muted }}>
                    {t("Size: {{size}}", { size: facilitySizeName(facility.size, props.spaces ?? []) })}
                    {upgradeSummary ? ` - ${upgradeSummary}` : ""}
                  </div>
                ) : null}
              </div>
              {props.onRemove && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    props.onRemove?.(facility.id);
                  }}
                  style={ghostButtonStyle()}
                >
                  {t("Remove")}
                </button>
              )}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: orders.length > 0 ? "180px 1fr" : "1fr", gap: 8 }}>
              {orders.length > 0 && (
                <Select
                  value={facility.order ?? "Maintain"}
                  onChange={(e) => props.onChangeOrder?.(facility.id, normalizeOrder(e.target.value))}
                  onClick={(e) => e.stopPropagation()}
                  disabled={!props.onChangeOrder}
                >
                  {orders.map((order) => (
                    <option key={`${facility.id}:${order}`} value={order}>{order}</option>
                  ))}
                </Select>
              )}
              <FacilityNotesInput
                value={facility.notes}
                placeholder={t("Facility notes...")}
                onCommit={props.onCommitNotes ? (notes) => props.onCommitNotes?.(facility.id, notes) : undefined}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
