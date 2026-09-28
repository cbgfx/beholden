import { C } from "@/lib/theme";
import { Panel, SubsectionLabel } from "@beholden/shared/ui";
import { facilitySizeName, isFacilityUpgraded, type BastionSpaceDefinition } from "@beholden/shared/domain/bastionFacilities";
import type { Bastion, BastionFacility, CompendiumFacility } from "./BastionViewShared";
import { orderListWithMaintain } from "./BastionViewShared";
import { useUiTranslation } from "@beholden/shared/i18n";

export function BastionFacilityDetailPanel({
  selectedFacility,
  facilitiesByKey,
  assignedPlayers,
  spaces,
}: {
  selectedFacility: BastionFacility | null;
  facilitiesByKey: Map<string, CompendiumFacility>;
  assignedPlayers: Bastion["assignedPlayers"];
  /** Size names from the compendium. */
  spaces?: BastionSpaceDefinition[];
}) {
  const t = useUiTranslation("playerUi");
  return (
    <Panel style={{ padding: "10px 12px", minHeight: 220 }}>
      <SubsectionLabel>{t("Facility Details")}</SubsectionLabel>
      {selectedFacility ? (
        (() => {
          const definition = selectedFacility.definition ?? facilitiesByKey.get(selectedFacility.facilityKey) ?? null;
          const owner = selectedFacility.ownerPlayerId
            ? assignedPlayers?.find((entry) => entry.id === selectedFacility.ownerPlayerId)
            : null;
          const hirelings = selectedFacility.hirelings ?? definition?.hirelings ?? null;
          const upgradeSummary = definition && isFacilityUpgraded(definition, selectedFacility.size) ? definition.upgrade?.summary : null;
          return (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ fontSize: "var(--fs-medium)", fontWeight: 800, color: C.text }}>
                {definition?.name ?? selectedFacility.facilityKey}
              </div>
              <div style={{ fontSize: "var(--fs-small)", color: C.muted }}>
                {definition ? (definition.type === "special" ? t("Special facility") : t("Basic facility")) : t("Facility")}
                {definition ? ` ${t("- Min level {{level}}", { level: definition.minimumLevel })}` : ""}
              </div>
              {owner ? (
                <div style={{ fontSize: "var(--fs-small)", color: C.muted }}>
                  {t("Owner: {{name}} (Lv {{level}})", { name: owner.characterName, level: owner.level })}
                </div>
              ) : null}
              {selectedFacility.size ? (
                <div style={{ fontSize: "var(--fs-small)", color: C.muted }}>
                  {t("Size: {{size}}", { size: facilitySizeName(selectedFacility.size, spaces ?? []) })}
                  {upgradeSummary ? ` - ${upgradeSummary}` : ""}
                </div>
              ) : null}
              {definition?.prerequisite ? (
                <div style={{ fontSize: "var(--fs-small)", color: C.muted }}>
                  {t("Prerequisite: {{prerequisite}}", { prerequisite: definition.prerequisite })}
                </div>
              ) : null}
              {hirelings != null ? (
                <div style={{ fontSize: "var(--fs-small)", color: C.muted }}>
                  {t("Hirelings: {{count}}", { count: hirelings })}
                </div>
              ) : null}
              {definition?.orders?.length ? (
                <div style={{ fontSize: "var(--fs-small)", color: C.muted }}>
                  {t("Orders: {{orders}}", { orders: orderListWithMaintain(definition.orders).join(", ") })}
                </div>
              ) : null}
              <div
                style={{
                  marginTop: 4,
                  border: `1px solid ${C.panelBorder}`,
                  borderRadius: 8,
                  padding: "10px 12px",
                  background: "rgba(255,255,255,0.02)",
                  fontSize: "var(--fs-small)",
                  color: C.muted,
                  lineHeight: 1.6,
                  whiteSpace: "pre-wrap",
                }}
              >
                {definition?.description?.trim() || t("No compendium description available for this facility.")}
              </div>
            </div>
          );
        })()
      ) : (
        <div style={{ fontSize: "var(--fs-small)", color: C.muted, opacity: 0.75 }}>
          {t("Select a facility on the left to view its description and details.")}
        </div>
      )}
    </Panel>
  );
}
