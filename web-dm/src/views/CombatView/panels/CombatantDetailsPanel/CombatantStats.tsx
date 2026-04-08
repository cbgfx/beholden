export function CombatantStats({
  abilities,
}: {
  abilities: {
    key: string;
    score: number | null;
    mod: number | null;
  }[];
}) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6 }}>
      {abilities.map((a) => (
        <div key={a.key}>
          {a.key.toUpperCase()}:{" "}
          {a.score !== null
            ? `${a.score} (${a.mod! >= 0 ? "+" : ""}${a.mod})`
            : "—"}
        </div>
      ))}
    </div>
  );
}
