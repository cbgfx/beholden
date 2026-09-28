import React from "react";
import { buildClassLevelReduction } from "@beholden/shared/domain/progressionReduction";
import { api, jsonInit } from "@/services/api";
import { C } from "@/lib/theme";
import { Button } from "@/ui/Button";
import { buildLevelDownPreview, formatLevelDownPreview } from "@/domain/character/progressionLevelDown";
import { ChoiceBtn, Section } from "./LevelUpParts";
import type { LevelUpCharacter, LevelUpClassDetail } from "./LevelUpTypes";

const labels: Record<string, string> = {
  "extra-feat": "Feat", invocation: "Invocation", optional: "Choice", maneuver: "Maneuver",
  metamagic: "Metamagic", infusion: "Infusion", plan: "Plan",
};

export function LevelDownClassSection(props: {
  char: LevelUpCharacter;
  onDone: () => void;
  onError: (message: string) => void;
  onCancel: () => void;
  classDetails: Record<string, LevelUpClassDetail>;
}) {
  const classes = props.char.characterData?.classes ?? [];
  const [classEntryId, setClassEntryId] = React.useState(classes.at(-1)?.id ?? classes[0]?.id ?? "");
  const [saving, setSaving] = React.useState(false);
  const selected = classes.find((entry) => entry.id === classEntryId);
  const transition = buildClassLevelReduction({
    classEntryId, classes, characterData: props.char.characterData ?? {}, level: props.char.level,
    hpMax: props.char.hpMax, hpCurrent: props.char.hpCurrent,
    abilityScores: { str: props.char.strScore, dex: props.char.dexScore, con: props.char.conScore, int: props.char.intScore, wis: props.char.wisScore, cha: props.char.chaScore },
  });

  const preview = React.useMemo(() => {
    if (!selected || "error" in transition) return null;
    const before = props.char.characterData ?? {};
    const after = transition.characterData as Record<string, any>;
    const targetLevel = selected.level - 1;
    const occurrences = Array.isArray(before.progressionSelectionOccurrences) ? before.progressionSelectionOccurrences : [];
    const retainedOccurrenceIds = new Set((Array.isArray(after.progressionSelectionOccurrences) ? after.progressionSelectionOccurrences : []).map((entry: any) => entry.occurrenceId));
    const removedGrants = occurrences
      .filter((entry: any) => entry.classEntryId === selected.id && !retainedOccurrenceIds.has(entry.occurrenceId))
      .map((entry: any) => `Level ${Number(entry.classLevel) || selected.level}: ${labels[entry.kind] ?? "Choice"}: ${entry.valueId}`);
    if (targetLevel === 0) {
      const scoped = before.classSpellSelections?.[selected.id] ?? {};
      for (const [kind, values] of [["Cantrip", scoped.chosenCantrips], ["Spell", scoped.chosenSpells], ["Invocation", scoped.chosenInvocations]] as const) {
        for (const value of Array.isArray(values) ? values : []) {
          removedGrants.push(`Level ${selected.level}: ${kind}: ${String(value)}`);
        }
      }
    }
    const removedProficiencies: string[] = [];
    for (const [kind, values] of Object.entries(before.proficiencies ?? {})) {
      const remaining = Array.isArray(after.proficiencies?.[kind]) ? after.proficiencies[kind] : [];
      const remainingKeys = new Set(remaining.map((entry: any) => `${entry?.name ?? entry?.id ?? entry}|${entry?.sourceKey ?? ""}`));
      for (const entry of Array.isArray(values) ? values : []) {
        const key = `${entry?.name ?? entry?.id ?? entry}|${entry?.sourceKey ?? ""}`;
        if (!remainingKeys.has(key)) removedProficiencies.push(`${kind}: ${entry?.name ?? entry?.id ?? entry}`);
      }
    }
    const abilityChanges = Object.entries(transition.abilityScores).flatMap(([ability, score]) => {
      const beforeScore = props.char[`${ability}Score` as keyof LevelUpCharacter];
      return typeof beforeScore === "number" && beforeScore !== score ? [`${ability.toUpperCase()}: ${beforeScore} → ${score}`] : [];
    });
    const levelUpChoices = (Array.isArray(before.chosenLevelUpFeats) ? before.chosenLevelUpFeats : [])
      .filter((entry: any) => entry.classEntryId === selected.id)
      .map((entry: any) => ({ ...entry, level: Number(entry.classLevel ?? entry.level) }));
    return buildLevelDownPreview({
      fromLevel: selected.level, toLevel: targetLevel,
      classDefinition: props.classDetails[selected.id], subclass: selected.subclass,
      levelUpChoices, removedGrants, removedProficiencies, abilityChanges,
      hpChange: { before: props.char.hpMax, after: transition.hpMax },
    });
  }, [props.char, props.classDetails, selected, transition]);

  const confirm = async () => {
    if (!selected || "error" in transition || saving) return;
    if (!window.confirm(preview ? formatLevelDownPreview(preview) : `Reduce ${selected.className ?? "this class"}?`)) return;
    setSaving(true);
    try {
      await api(`/api/me/characters/${props.char.id}`, jsonInit("PUT", {
        progressionClassEntryId: classEntryId,
        expectedCharacterRevision: props.char.updatedAt,
        level: transition.level, hpMax: transition.hpMax, hpCurrent: transition.hpCurrent,
        ...(transition.className ? { className: transition.className } : {}),
        ...Object.fromEntries(Object.entries(transition.abilityScores).map(([ability, score]) => [`${ability}Score`, score])),
        characterData: transition.characterData,
      }));
      props.onDone();
    } catch (error) {
      props.onError(String(error));
      setSaving(false);
    }
  };

  return <>
    <Section title="Reduce a class level" accent={C.accentHl}>
      <p style={{ color: C.muted, marginTop: 0 }}>Choose the class level you want to remove. A level 1 secondary class is removed completely.</p>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {classes.map((entry) => <ChoiceBtn key={entry.id} active={classEntryId === entry.id} onClick={() => setClassEntryId(entry.id)} accent={C.accentHl}>
          {entry.className ?? "Class"} {entry.level} → {entry.level - 1}
        </ChoiceBtn>)}
      </div>
      {"error" in transition && <p role="alert" style={{ color: C.red }}>{transition.error}</p>}
      {!("error" in transition) && selected && <div style={{ marginTop: 14, color: C.muted }}>
        Character level {props.char.level} → {transition.level} · HP Max {props.char.hpMax} → {transition.hpMax}
      </div>}
      {preview && <div style={{ marginTop: 16, display: "grid", gap: 10, color: C.muted }}>
        {preview.removedFeatures.length > 0 && <div><strong style={{ color: C.text }}>Class features removed</strong>{preview.removedFeatures.map((value) => <div key={value}>• {value}</div>)}</div>}
        {preview.removedRecordedChoices.length > 0 && <div><strong style={{ color: C.text }}>Grants and choices removed</strong>{preview.removedRecordedChoices.map((value) => <div key={value}>• {value}</div>)}</div>}
        {preview.abilityChanges?.length ? <div><strong style={{ color: C.text }}>Ability scores</strong>{preview.abilityChanges.map((value) => <div key={value}>• {value}</div>)}</div> : null}
        {preview.removedProficiencies?.length ? <div><strong style={{ color: C.text }}>Proficiencies removed</strong>{preview.removedProficiencies.map((value) => <div key={value}>• {value}</div>)}</div> : null}
      </div>}
    </Section>
    <div style={{ display: "flex", gap: 10 }}>
      <Button variant="ghost" onClick={props.onCancel}>Cancel</Button>
      <Button onClick={confirm} disabled={saving || "error" in transition}>{saving ? "Saving…" : selected?.level === 1 ? "Remove class" : "Reduce level"}</Button>
    </div>
  </>;
}
