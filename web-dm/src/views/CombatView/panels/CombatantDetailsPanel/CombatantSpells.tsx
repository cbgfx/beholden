export function CombatantSpells({ spells }: { spells: string[] }) {
  return (
    <div>
      <div style={{ fontWeight: 600, marginBottom: 4 }}>Spells</div>
      {spells.map((s) => (
        <div key={s}>{s}</div>
      ))}
    </div>
  );
}
