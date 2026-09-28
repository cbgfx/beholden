export type InvocationFeatChoiceEntry = {
  key: string;
  title: string;
  sourceLabel: string;
  count: number;
  options: Array<{ id: string; name: string }>;
};

type InvocationLike = {
  id: string;
  name: string;
  effects?: unknown[];
};

type FeatSummaryLike = {
  id: string;
  name: string;
  category?: string | null;
};

function categoryMatches(actual: string | null | undefined, wanted: unknown): boolean {
  const normalized = String(actual ?? "").trim().toLowerCase();
  if (wanted === "origin") return normalized === "origin" || normalized === "o";
  if (wanted === "general") return normalized === "general" || normalized === "g" || normalized === "";
  if (wanted === "fighting_style") return normalized === "fighting style" || normalized === "f";
  if (wanted === "epic_boon") return normalized === "epic boon" || normalized === "e";
  return true;
}

export function getInvocationFeatChoices(
  invocations: InvocationLike[],
  selectedInvocationIds: string[],
  feats: FeatSummaryLike[],
): InvocationFeatChoiceEntry[] {
  const selectedCounts = new Map<string, number>();
  for (const id of selectedInvocationIds) selectedCounts.set(id, (selectedCounts.get(id) ?? 0) + 1);
  return invocations.flatMap((invocation) => {
    const copies = selectedCounts.get(invocation.id) ?? 0;
    if (copies === 0) return [];
    return (invocation.effects ?? []).flatMap((rawEffect) => {
      const effect = rawEffect as Record<string, unknown>;
      if (effect?.type !== "feat_choice" || effect.mode !== "learn") return [];
      const countRecord = effect.count as Record<string, unknown> | undefined;
      if (countRecord?.kind !== "fixed" || !Number.isInteger(countRecord.value) || Number(countRecord.value) < 1) return [];
      const choiceId = String(effect.choiceId ?? "").trim();
      if (!choiceId) return [];
      const matchingFeats = feats.filter((feat) => categoryMatches(feat.category, effect.category));
      const byDisplayName = new Map<string, FeatSummaryLike>();
      for (const feat of matchingFeats) {
        const key = feat.name.replace(/^Origin:\s*/i, "").trim().toLowerCase();
        const current = byDisplayName.get(key);
        if (!current || (/^Origin:\s*/i.test(current.name) && !/^Origin:\s*/i.test(feat.name))) byDisplayName.set(key, feat);
      }
      return [{
        key: `invocation:${choiceId}`,
        title: "Invocation Feat",
        sourceLabel: invocation.name.replace(/^Invocation:\s*/i, "").trim(),
        count: Number(countRecord.value) * copies,
        options: Array.from(byDisplayName.values()).sort((a, b) => a.name.replace(/^Origin:\s*/i, "").localeCompare(b.name.replace(/^Origin:\s*/i, ""))),
      }];
    });
  });
}

export function selectedInvocationFeatIds(
  choices: InvocationFeatChoiceEntry[],
  selectedOptions: Record<string, string[]>,
): string[] {
  const allowed = new Map(choices.map((choice) => [choice.key, new Set(choice.options.map((option) => option.id))]));
  return Array.from(new Set(choices.flatMap((choice) =>
    (selectedOptions[choice.key] ?? []).filter((id) => allowed.get(choice.key)?.has(id)).slice(0, choice.count)
  )));
}

export function reconcileInvocationExtraFeatIds(
  existingExtraFeatIds: string[],
  formerlyInvocationOwnedIds: string[],
  selectedInvocationOwnedIds: string[],
): string[] {
  const formerlyOwned = new Set(formerlyInvocationOwnedIds);
  return Array.from(new Set([
    ...existingExtraFeatIds.filter((id) => !formerlyOwned.has(id)),
    ...selectedInvocationOwnedIds,
  ]));
}
