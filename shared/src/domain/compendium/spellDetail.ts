export type CompendiumSpellDetail = {
  id: string;
  name: string;
  level: number | null;
  school: string | null;
  time: string | null;
  range: string | null;
  components: string | null;
  duration: string | null;
  classes: string | null;
  text: string[];
};

export function spellLevelLabel(level: number | null): string {
  if (level == null) return "Level ?";
  return level === 0 ? "Cantrip" : `Level ${level}`;
}
