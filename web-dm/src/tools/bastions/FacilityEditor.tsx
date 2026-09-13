import { useUiTranslation } from "@beholden/shared/i18n/useUiTranslation";
import React from "react";
import { theme } from "@/theme/theme";
import { Button } from "@/ui/Button";
import { Input } from "@/ui/Input";
import { Select } from "@/ui/Select";
import type { BastionFacility, CompendiumFacility } from "@/tools/bastions/types";
import { normalizeOrder, orderListWithMaintain } from "@/tools/bastions/utils";

export function FacilityEditor(props: {
  rows: BastionFacility[];
  label: string;
  source: "player" | "dm_extra";
  ownerPlayerId?: string;
  options: CompendiumFacility[];
  onAdd: (source: "player" | "dm_extra", facilityKey: string, ownerPlayerId?: string) => void;
  onUpdate: (facilityId: string, patch: Partial<BastionFacility>) => void;
  onRemove: (facilityId: string) => void;
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
              onClick={() => {
                if (!addKey) return;
                props.onAdd(props.source, addKey, props.ownerPlayerId);
                setAddKey("");
              }}
              disabled={!addKey}
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
          return (
            <div key={facility.id} style={{ border: `1px solid ${theme.colors.panelBorder}`, borderRadius: 8, padding: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 700, color: theme.colors.text, fontSize: "var(--fs-small)" }}>{definition?.name ?? facility.facilityKey}</div>
                  <div style={{ color: theme.colors.muted, fontSize: "var(--fs-tiny)" }}>
                    {definition?.prerequisite ? translateUi("Prerequisite: {{value1}}", { value1: definition.prerequisite }) : translateUi("No prerequisite")}
                    {definition?.hirelings != null ? translateUi(" - Hirelings: {{value1}}", { value1: definition.hirelings }) : ""}
                  </div>
                </div>
                <Button variant="ghost" onClick={() => props.onRemove(facility.id)}>{translateUi("Remove")}</Button>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", gap: 8, marginTop: 8 }}>
                <Select
                  value={facility.order ?? "Maintain"}
                  onChange={(e) => props.onUpdate(facility.id, { order: normalizeOrder(e.target.value) })}
                >
                  {orders.map((order) => (
                    <option key={`${facility.id}:${order}`} value={order}>{order}</option>
                  ))}
                </Select>
                <Input
                  value={facility.notes}
                  onChange={(e) => props.onUpdate(facility.id, { notes: e.target.value })}
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
