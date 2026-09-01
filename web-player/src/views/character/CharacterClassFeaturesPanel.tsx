import React from "react";
import { EmptyState } from "@beholden/shared/ui";
import { C, withAlpha } from "@/lib/theme";
import type { ClassFeatureEntry } from "@/views/character/CharacterSheetTypes";
import { CollapsiblePanel, ClassFeatureItem, PanelHeaderAddButton } from "@/views/character/CharacterViewParts";
import { PANEL_IDS } from "@/views/character/panelRegistry";

export function ClassFeaturesPanel(props: {
  accentColor: string;
  classFeaturesList: ClassFeatureEntry[];
  classPresentation?: Array<{ classEntryId: string; className: string; classLevel: number; subclassName: string | null; hitDieSize: number | null }>;
  /** id->level map for chosenOptionals (Pact Boon, Fighting Style, ...) and invocation-granted
   * feats -- see characterData.acquisitionLevels. Keyed `optional:<name>` / `extraFeat:<featId>`. */
  acquisitionLevels?: Record<string, number | null>;
  expandedClassFeatureIds: string[];
  onToggleClassFeatureExpanded: (id: string) => void;
  onOpenFeatPicker?: () => void;
  onRemoveExtraFeat?: (featId: string) => Promise<void>;
}) {
  const {
    accentColor,
    classFeaturesList,
    classPresentation = [],
    acquisitionLevels = {},
    expandedClassFeatureIds,
    onToggleClassFeatureExpanded,
    onOpenFeatPicker,
    onRemoveExtraFeat,
  } = props;

  const multiclass = classPresentation.length > 1;
  const classByEntryId = React.useMemo(
    () => new Map(classPresentation.map((entry) => [entry.classEntryId, entry])),
    [classPresentation],
  );
  const classOrder = React.useMemo(
    () => new Map(classPresentation.map((entry, index) => [entry.classEntryId, index])),
    [classPresentation],
  );
  const getClassEntryId = (value: string) => {
    const match = /^class:([^:]+):/.exec(value);
    return match?.[1] ?? null;
  };
  const groupedFeatures = React.useMemo(() => {
    const getGroup = (id: string): "class" | "race" | "background" | "feats" => {
      if (id.startsWith("class:") || id.startsWith("invocation:")) return "class";
      if (id.startsWith("race:") || id.startsWith("race-feat:")) return "race";
      if (id.startsWith("background:") || id.startsWith("background-feat:") || id.startsWith("bg-feat:")) return "background";
      return "feats";
    };
    const groups: Record<"class" | "race" | "background" | "feats", typeof classFeaturesList> = {
      class: [], race: [], background: [], feats: [],
    };
    for (const feature of classFeaturesList) groups[getGroup(feature.id)].push(feature);
    const sort = (arr: typeof classFeaturesList) => arr.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
    groups.class.sort((a, b) => {
      const aOrder = classOrder.get(getClassEntryId(a.id) ?? "") ?? Number.MAX_SAFE_INTEGER;
      const bOrder = classOrder.get(getClassEntryId(b.id) ?? "") ?? Number.MAX_SAFE_INTEGER;
      return aOrder - bOrder || a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
    });
    return { class: groups.class, race: sort(groups.race), background: sort(groups.background), feats: sort(groups.feats) };
  }, [classFeaturesList, classOrder]);

  const totalFeatureCount = classFeaturesList.length;

  return (
    <CollapsiblePanel
      title="Features"
      color={accentColor}
      storageKey={PANEL_IDS.playerFeatures}
      summary={`${totalFeatureCount} features`}
      actions={onOpenFeatPicker ? (
        <PanelHeaderAddButton color={accentColor} onClick={onOpenFeatPicker} title="Add feat" />
      ) : undefined}
    >
      {totalFeatureCount > 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {(["class", "race", "background", "feats"] as const).map((group) => {
            const features = groupedFeatures[group];
            if (features.length === 0) return null;
            const label = group === "class" ? "Class" : group === "race" ? "Race" : group === "background" ? "Background" : "Feats";
            return (
              <div key={group}>
                <div style={{ fontSize: "var(--fs-tiny)", fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 5, opacity: 0.6 }}>{label}</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                  {features.map((feature, featureIndex) => {
                    const owner = group === "class" ? classByEntryId.get(getClassEntryId(feature.id) ?? "") : null;
                    const previousOwner = featureIndex > 0 ? classByEntryId.get(getClassEntryId(features[featureIndex - 1]!.id) ?? "") : null;
                    const showOwner = multiclass && owner && owner.classEntryId !== previousOwner?.classEntryId;
                    const extraFeatId = feature.id.startsWith("extra-feat:") ? feature.id.slice("extra-feat:".length) : null;
                    const acquisitionLevel = extraFeatId != null
                      ? acquisitionLevels[`extraFeat:${extraFeatId}`]
                      : acquisitionLevels[`optional:${feature.name}`];
                    return (
                      <React.Fragment key={feature.id}>
                      {showOwner && <div style={{ color: accentColor, fontSize: "var(--fs-tiny)", fontWeight: 800, marginTop: featureIndex ? 5 : 0 }}>
                        {owner.className} {owner.classLevel}{owner.subclassName ? ` · ${owner.subclassName}` : ""}
                      </div>}
                      <div style={{ position: "relative" }}>
                        <ClassFeatureItem
                          feature={feature}
                          expanded={expandedClassFeatureIds.includes(feature.id)}
                          accentColor={accentColor}
                          onToggle={() => onToggleClassFeatureExpanded(feature.id)}
                          acquisitionLevel={acquisitionLevel}
                        />
                        {extraFeatId && onRemoveExtraFeat && (
                          <button
                            type="button"
                            title="Remove feat"
                            onClick={() => { void onRemoveExtraFeat(extraFeatId); }}
                            style={{ position: "absolute", top: 8, right: 10, border: "none", background: "transparent", cursor: "pointer", color: withAlpha(C.red, 0.6), fontSize: "var(--fs-body)", lineHeight: 1, padding: 0, fontWeight: 700 }}
                          >×</button>
                        )}
                      </div>
                      </React.Fragment>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <EmptyState textColor={C.muted}>No features yet. Add feats with the + button above.</EmptyState>
      )}
    </CollapsiblePanel>
  );
}
