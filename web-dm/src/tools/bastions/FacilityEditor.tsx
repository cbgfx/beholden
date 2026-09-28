import { useUiTranslation } from "@beholden/shared/i18n/useUiTranslation";
import React from "react";
import {
  facilitySizeName,
  facilitySizePill,
  formatGp,
  isFacilityUpgraded,
  type BastionSpaceDefinition,
} from "@beholden/shared/domain/bastionFacilities";
import { theme } from "@/theme/theme";
import { Button } from "@/ui/Button";
import { Select } from "@/ui/Select";
import type { BastionFacility, CompendiumFacility } from "@/tools/bastions/types";
import { normalizeOrder, orderListWithMaintain } from "@/tools/bastions/utils";
import { CommittedInput } from "@/tools/bastions/CommittedFields";
import { chipButtonStyle } from "@/tools/bastions/styles";

export function FacilityEditor(props: {
  rows: BastionFacility[];
  label: string;
  source: "player" | "dm_extra";
  ownerPlayerId?: string;
  options: CompendiumFacility[];
  /** Sizes with their compendium costs, which the upgrade pill reads. */
  spaces: BastionSpaceDefinition[];
  /** Resolves to whether the server added it; the picker keeps its choice if not. */
  onAdd: (source: "player" | "dm_extra", facilityKey: string, ownerPlayerId?: string) => Promise<boolean>;
  onChangeOrder: (facilityId: string, order: string | null) => void;
  onCommitNotes: (facilityId: string, notes: string) => Promise<boolean>;
  /** The upgrade pill: sets a facility's size. Gold is handled at the table. */
  onSetSize: (facilityId: string, size: string) => void;
  onRemove: (facilityId: string) => void;
  /** An operation is running. Adding waits for the server, so it's disabled meanwhile. */
  busy?: boolean;
  showAddControls?: boolean;
  children?: React.ReactNode;
}) {
  const translateUi = useUiTranslation("dmUi");
  const [addKey, setAddKey] = React.useState("");
  const rows = props.rows;
  const showAddControls = props.showAddControls !== false;

  return (
    <div style={{ border: `1px solid ${theme.colors.panelBorder}`, borderRadius: 10, padding: 10 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <div style={{ fontSize: "var(--fs-small)", color: theme.colors.muted, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em" }}>
          {props.label}
        </div>
        {showAddControls ? (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Select
              value={addKey}
              onChange={(e) => setAddKey(e.target.value)}
              style={{ minWidth: 260 }}
            >
              <option value="">{translateUi("Add facility...")}</option>
              {props.options.map((facility) => (
                <option key={facility.key} value={facility.key}>
                  {facility.name} ({facility.type}{translateUi(", lvl")} {facility.minimumLevel})
                </option>
              ))}
            </Select>
            <Button
              onClick={async () => {
                if (!addKey) return;
                if (await props.onAdd(props.source, addKey, props.ownerPlayerId)) setAddKey("");
              }}
              disabled={!addKey || props.busy}
            >
              {translateUi("Add")}
            </Button>
          </div>
        ) : null}
      </div>
      {props.children ? <div style={{ marginTop: 8 }}>{props.children}</div> : null}

      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
        {rows.length === 0 ? <div style={{ color: theme.colors.muted, fontSize: "var(--fs-small)" }}>{translateUi("None")}</div> : null}
        {rows.map((facility) => {
          const definition = facility.definition;
          const orders = orderListWithMaintain(definition?.orders ?? []);
          const hirelings = facility.hirelings ?? definition?.hirelings ?? null;
          const pill = definition ? facilitySizePill(definition, facility.size, props.spaces) : null;
          const upgradeSummary = definition && isFacilityUpgraded(definition, facility.size) ? definition.upgrade?.summary : null;
          return (
            <div key={facility.id} style={{ border: `1px solid ${theme.colors.panelBorder}`, borderRadius: 8, padding: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 700, color: theme.colors.text, fontSize: "var(--fs-small)" }}>{definition?.name ?? facility.facilityKey}</div>
                  <div style={{ color: theme.colors.muted, fontSize: "var(--fs-tiny)" }}>
                    {definition?.prerequisite ? translateUi("Prerequisite: {{value1}}", { value1: definition.prerequisite }) : translateUi("No prerequisite")}
                    {hirelings != null ? translateUi(" - Hirelings: {{value1}}", { value1: hirelings }) : ""}
                  </div>
                  {facility.size ? (
                    <div style={{ color: theme.colors.muted, fontSize: "var(--fs-tiny)" }}>
                      {facilitySizeName(facility.size, props.spaces)}
                      {upgradeSummary ? ` - ${upgradeSummary}` : ""}
                    </div>
                  ) : null}
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
                  {pill ? (
                    // Like the Walled pill: highlighted once upgraded. It shows the next upgrade's
                    // cost while there is one; at the top it shows the size, and clicking goes back down.
                    <button
                      type="button"
                      style={chipButtonStyle(pill.active)}
                      onClick={() => props.onSetSize(facility.id, pill.nextSize)}
                    >
                      {pill.upgradeCostGp !== null
                        ? translateUi("Upgrade: {{value1}} GP", { value1: formatGp(pill.upgradeCostGp) })
                        : pill.resets ? pill.sizeName : translateUi("Upgrade")}
                    </button>
                  ) : null}
                  <Button variant="ghost" onClick={() => props.onRemove(facility.id)}>{translateUi("Remove")}</Button>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", gap: 8, marginTop: 8 }}>
                <Select
                  value={facility.order ?? "Maintain"}
                  onChange={(e) => props.onChangeOrder(facility.id, normalizeOrder(e.target.value))}
                >
                  {orders.map((order) => (
                    <option key={`${facility.id}:${order}`} value={order}>{order}</option>
                  ))}
                </Select>
                <CommittedInput
                  value={facility.notes}
                  onCommit={(notes) => props.onCommitNotes(facility.id, notes)}
                  placeholder={translateUi("Facility notes")}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
