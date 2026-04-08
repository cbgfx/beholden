export function CombatantTraits({ traits }: { traits: string[] }) {
  return (
    <div>
      <div style={{ fontWeight: 600, marginBottom: 4 }}>Traits</div>
      {traits.map((t) => (
        <div key={t}>{t}</div>
      ))}
    </div>
  );
}
