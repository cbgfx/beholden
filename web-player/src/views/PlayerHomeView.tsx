import React, { useEffect, useState } from "react";
import { api } from "@/services/api";

interface Campaign {
  id: string;
  name: string;
  updatedAt: number;
  playerCount: number;
  imageUrl: string | null;
}

export function PlayerHomeView() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<Campaign[]>("/api/campaigns")
      .then(setCampaigns)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load campaigns"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div style={styles.page}>
      <div style={styles.main}>
        <h2 style={styles.heading}>Your Campaigns</h2>

        {loading && <p style={styles.muted}>Loading…</p>}
        {error && <p style={styles.errorText}>{error}</p>}

        {!loading && !error && campaigns.length === 0 && (
          <p style={styles.muted}>You haven't been added to any campaigns yet.</p>
        )}

        <div style={styles.grid}>
          {campaigns.map((c) => (
            <div key={c.id} style={styles.card}>
              {c.imageUrl && (
                <img src={c.imageUrl} alt={c.name} style={styles.cardImage} />
              )}
              <div style={styles.cardBody}>
                <div style={styles.cardName}>{c.name}</div>
                <div style={styles.cardMeta}>
                  {c.playerCount} player{c.playerCount !== 1 ? "s" : ""}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    height: "100%",
    background: "var(--bg)",
    color: "var(--text)",
    overflowY: "auto",
  },
  main: {
    maxWidth: 900,
    margin: "0 auto",
    padding: "32px 24px",
  },
  heading: {
    margin: "0 0 24px",
    fontSize: 20,
    fontWeight: 700,
  },
  muted: { color: "var(--muted)", fontSize: 14 },
  errorText: { color: "var(--red)", fontSize: 14 },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
    gap: 16,
  },
  card: {
    background: "var(--panel-bg)",
    border: "1px solid var(--panel-border)",
    borderRadius: "var(--radius-panel)",
    overflow: "hidden",
  },
  cardImage: { width: "100%", height: 140, objectFit: "cover", display: "block" },
  cardBody: { padding: "14px 16px" },
  cardName: { fontSize: 15, fontWeight: 700, marginBottom: 4 },
  cardMeta: { fontSize: 12, color: "var(--muted)" },
};
