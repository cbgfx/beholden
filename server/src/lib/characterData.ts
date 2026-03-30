export function normalizeCharacterData(value: Record<string, unknown> | null | undefined): Record<string, unknown> | null {
  if (value == null || typeof value !== "object") return null;
  const next = { ...value } as Record<string, unknown>;
  const classFeatures = Array.isArray(next.classFeatures) ? next.classFeatures : [];
  const selectedFeatureNames = Array.isArray(next.selectedFeatureNames) ? next.selectedFeatureNames : [];
  if (selectedFeatureNames.length === 0 && classFeatures.length > 0) {
    next.selectedFeatureNames = classFeatures
      .map((feature) => {
        if (feature && typeof feature === "object" && typeof (feature as { name?: unknown }).name === "string") {
          return ((feature as { name: string }).name).trim();
        }
        return "";
      })
      .filter(Boolean);
  }
  delete next.classFeatures;
  return next;
}
