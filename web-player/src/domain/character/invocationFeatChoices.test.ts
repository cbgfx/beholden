import { describe, expect, it } from "vitest";
import { getInvocationFeatChoices, reconcileInvocationExtraFeatIds, selectedInvocationFeatIds } from "./invocationFeatChoices";

const lessons = {
  id: "ct_lessons_of_the_first_ones",
  name: "Invocation: Lessons of the First Ones",
  effects: [{ type: "feat_choice", mode: "learn", choiceId: "lessons_origin_feat", count: { kind: "fixed", value: 1 }, category: "origin" }],
};

describe("Invocation Feat choices", () => {
  it("offers only Origin Feats under the stable Invocation choice key", () => {
    expect(getInvocationFeatChoices([lessons], [lessons.id], [
      { id: "f_alert", name: "Alert", category: "Origin" },
      { id: "f_actor", name: "Actor", category: "General" },
    ])).toEqual([{
      key: "invocation:lessons_origin_feat",
      title: "Invocation Feat",
      sourceLabel: "Lessons of the First Ones",
      count: 1,
      options: [{ id: "f_alert", name: "Alert", category: "Origin" }],
    }]);
  });

  it("promotes only eligible persisted IDs into applied Feats", () => {
    const choices = getInvocationFeatChoices([lessons], [lessons.id], [
      { id: "f_alert", name: "Alert", category: "O" },
    ]);
    expect(selectedInvocationFeatIds(choices, { "invocation:lessons_origin_feat": ["f_actor", "f_alert"] })).toEqual(["f_alert"]);
  });

  it("has no choice when the Invocation is not selected", () => {
    expect(getInvocationFeatChoices([lessons], [], [{ id: "f_alert", name: "Alert", category: "Origin" }])).toEqual([]);
  });

  it("deduplicates Origin-prefixed catalog variants by display name", () => {
    const [choice] = getInvocationFeatChoices([lessons], [lessons.id], [
      { id: "f_origin:_skilled", name: "Origin: Skilled", category: "O" },
      { id: "f_skilled", name: "Skilled", category: "O" },
    ]);
    expect(choice.options).toEqual([{ id: "f_skilled", name: "Skilled", category: "O" }]);
  });

  it("requires one distinct Feat selection per repeated Lessons copy", () => {
    const [choice] = getInvocationFeatChoices([lessons], [lessons.id, lessons.id], [
      { id: "f_alert", name: "Alert", category: "O" },
      { id: "f_tough", name: "Tough", category: "O" },
    ]);
    expect(choice.count).toBe(2);
    expect(selectedInvocationFeatIds([choice], { [choice.key]: ["f_alert", "f_tough"] })).toEqual(["f_alert", "f_tough"]);
  });

  it("replaces edit-owned Invocation Feats without deleting unrelated extra Feats", () => {
    expect(reconcileInvocationExtraFeatIds(
      ["f_manual_reward", "f_old_lesson"],
      ["f_old_lesson"],
      ["f_new_lesson"],
    )).toEqual(["f_manual_reward", "f_new_lesson"]);
  });
});
