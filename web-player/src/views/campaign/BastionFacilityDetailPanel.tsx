import { useTranslation } from "react-i18next";
import { C } from "@/lib/theme";
import { Panel, SubsectionLabel } from "@beholden/shared/ui";
import type { Bastion, BastionFacility, CompendiumFacility } from "./BastionViewShared";
import { orderListWithMaintain } from "./BastionViewShared";

export function BastionFacilityDetailPanel({
  selectedFacility,
  facilitiesByKey,
  assignedPlayers,
}: {
  selectedFacility: BastionFacility | null;
  facilitiesByKey: Map<string, CompendiumFacility>;
  assignedPlayers: Bastion["assignedPlayers"];
}) {
  const { t } = useTranslation();
  return (
    <Panel style={{ padding: "10px 12px", minHeight: 220 }}>
      <SubsectionLabel>{t("bastionView.facilityDetailsHeading")}</SubsectionLabel>
      {selectedFacility ? (
        (() => {
          const definition = selectedFacility.definition ?? facilitiesByKey.get(selectedFacility.facilityKey) ?? null;
          const owner = selectedFacility.ownerPlayerId
            ? assignedPlayers?.find((entry) => entry.id === selectedFacility.ownerPlayerId)
            : null;
          return (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ fontSize: "var(--fs-medium)", fontWeight: 800, color: C.text }}>
                {definition?.name ?? selectedFacility.facilityKey}
              </div>
              <div style={{ fontSize: "var(--fs-small)", color: C.muted }}>
                {definition ? (definition.type === "special" ? t("bastionView.facilityTypeSpecial") : t("bastionView.facilityTypeBasic")) : t("bastionView.facilityFallback")}
                {definition ? ` ${t("bastionView.minLevelSuffix", { level: definition.minimumLevel })}` : ""}
              </div>
              {owner ? (
                <div style={{ fontSize: "var(--fs-small)", color: C.muted }}>
                  {t("bastionView.ownerLabel", { name: owner.characterName, level: owner.level })}
                </div>
              ) : null}
              {definition?.prerequisite ? (
                <div style={{ fontSize: "var(--fs-small)", color: C.muted }}>
                  {t("bastionView.prerequisiteLabel", { prerequisite: definition.prerequisite })}
                </div>
              ) : null}
              {definition?.hirelings != null ? (
                <div style={{ fontSize: "var(--fs-small)", color: C.muted }}>
                  {t("bastionView.hirelingsFullLabel", { count: definition.hirelings })}
                </div>
              ) : null}
              {definition?.orders?.length ? (
                <div style={{ fontSize: "var(--fs-small)", color: C.muted }}>
                  {t("bastionView.ordersLabel", { orders: orderListWithMaintain(definition.orders).join(", ") })}
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
                {definition?.description?.trim() || t("bastionView.noDescription")}
              </div>
            </div>
          );
        })()
      ) : (
        <div style={{ fontSize: "var(--fs-small)", color: C.muted, opacity: 0.75 }}>
          {t("bastionView.selectFacilityPrompt")}
        </div>
      )}
    </Panel>
  );
}
