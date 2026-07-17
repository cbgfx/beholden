import type { PlayerNote } from "@/views/character/CharacterSheetTypes";

export interface FeatureNoteTemplate {
  id: string;
  title: string;
  text: string;
}

export function appendMissingFeatureNotes(
  existing: PlayerNote[] | null | undefined,
  templates: Array<FeatureNoteTemplate | null | undefined>,
): PlayerNote[] {
  const notes = Array.isArray(existing) ? [...existing] : [];
  const ids = new Set(notes.map((note) => note.id));
  for (const template of templates) {
    if (!template || ids.has(template.id)) continue;
    notes.push({ id: template.id, title: template.title, text: template.text });
    ids.add(template.id);
  }
  return notes;
}
