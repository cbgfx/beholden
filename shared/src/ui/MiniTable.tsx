export function MiniTable(props: {
  cols: string[];
  rows: Array<Array<string | number>>;
  borderColor?: string;
  headerBg?: string;
  mutedColor?: string;
  textColor?: string;
}) {
  const {
    cols,
    rows,
    borderColor = "rgba(255,255,255,0.13)",
    headerBg = "rgba(255,255,255,0.055)",
    mutedColor = "rgba(160,180,220,0.75)",
    textColor = "#e8edf5",
  } = props;

  return (
    <div style={{ border: `1px solid ${borderColor}`, borderRadius: 12, overflow: "hidden" }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${cols.length}, 1fr)`,
          background: headerBg,
          borderBottom: `1px solid ${borderColor}`,
        }}
      >
        {cols.map((c) => (
          <div key={c} style={{ padding: "8px 10px", fontWeight: 800, fontSize: "var(--fs-small)", color: mutedColor }}>{c}</div>
        ))}
      </div>
      {rows.map((r, idx) => (
        <div
          key={idx}
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${cols.length}, 1fr)`,
            borderBottom: idx === rows.length - 1 ? "none" : `1px solid ${borderColor}`,
          }}
        >
          {r.map((cell, i) => (
            <div key={i} style={{ padding: "8px 10px", fontSize: "var(--fs-subtitle)", color: textColor }}>{cell}</div>
          ))}
        </div>
      ))}
    </div>
  );
}
