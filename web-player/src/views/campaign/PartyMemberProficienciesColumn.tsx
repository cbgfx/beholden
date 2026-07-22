import { C } from "@/lib/theme";
import { NoteRow, Panel, SubsectionLabel, Tag } from "@beholden/shared/ui";
import type { FeatureEntry, NoteEntry, Proficiencies } from "./PartyMemberView";

export function PartyMemberProficienciesColumn({
  prof,
  color,
  classFeatures,
  allNotes,
  expandedFeatureIds,
  onToggleFeature,
  expandedNoteIds,
  onToggleNote,
}: {
  prof: Proficiencies | undefined;
  color: string;
  classFeatures: FeatureEntry[];
  allNotes: NoteEntry[];
  expandedFeatureIds: Record<string, boolean>;
  onToggleFeature: (id: string) => void;
  expandedNoteIds: Record<string, boolean>;
  onToggleNote: (id: string) => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {(prof?.armor?.length || prof?.weapons?.length || prof?.tools?.length || prof?.languages?.length) ? (
        <Panel>
          <SubsectionLabel>Proficiencies</SubsectionLabel>
          {[
            { label: "Armor", items: prof?.armor },
            { label: "Weapons", items: prof?.weapons },
            { label: "Tools", items: prof?.tools },
            { label: "Languages", items: prof?.languages },
          ].map(({ label, items }) => (items && items.length > 0 ? (
            <div key={label} style={{ marginBottom: 12 }}>
              <div style={{ fontSize: "var(--fs-tiny)", fontWeight: 700, color: "rgba(160,180,220,0.4)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 5 }}>
                {label}
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                {items.map((item) => <Tag key={`${label}:${item.name}`} label={item.name} color={color} />)}
              </div>
            </div>
          ) : null))}
        </Panel>
      ) : null}

      {classFeatures.length > 0 ? (
        <Panel>
          <SubsectionLabel>Class Features</SubsectionLabel>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {classFeatures.map((feature, index) => {
              const id = `feature:${index}:${feature.name}`;
              const expanded = Boolean(expandedFeatureIds[id]);
              return (
                <NoteRow
                  key={id}
                  title={feature.name}
                  text={feature.text ?? ""}
                  expanded={expanded}
                  accentColor={color}
                  textColor={C.text}
                  mutedColor={C.muted}
                  deleteColor={C.colorPinkRed}
                  onToggle={() => onToggleFeature(id)}
                />
              );
            })}
          </div>
        </Panel>
      ) : null}

      {allNotes.length > 0 ? (
        <Panel>
          <SubsectionLabel>Notes</SubsectionLabel>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {allNotes.map((note) => {
              const expanded = Boolean(expandedNoteIds[note.id]);
              return (
                <NoteRow
                  key={note.id}
                  title={note.title || "Untitled"}
                  text={note.text}
                  expanded={expanded}
                  accentColor={color}
                  textColor={C.text}
                  mutedColor={C.muted}
                  deleteColor={C.colorPinkRed}
                  onToggle={() => onToggleNote(note.id)}
                />
              );
            })}
          </div>
        </Panel>
      ) : null}
    </div>
  );
}
