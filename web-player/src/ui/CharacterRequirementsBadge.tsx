import { lazy, Suspense } from "react";

// Load the same evaluator used by Edit, including its compendium-backed choices.
const RequirementCheck = lazy(() => import("@/views/character-creator/CharacterCreatorView").then((module) => ({ default: module.CharacterCreatorView })));

export function CharacterRequirementsBadge({ characterId }: { characterId: string }) {
  return <Suspense fallback={null}><RequirementCheck key={characterId} requirementBadgeFor={characterId} /></Suspense>;
}
