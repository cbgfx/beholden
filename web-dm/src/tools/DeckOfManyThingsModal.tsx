import React, { useEffect, useMemo, useState } from "react";
import { Modal } from "@/components/overlay/Modal";
import { api } from "@/services/api";
import { theme, withAlpha } from "@/theme/theme";

const SUITS = [
  { symbol: "\u2660", name: "Spades", color: "#e8edf5" },
  { symbol: "\u2665", name: "Hearts", color: "#ff5d5d" },
  { symbol: "\u2666", name: "Diamonds", color: "#ff5d5d" },
  { symbol: "\u2663", name: "Clubs", color: "#e8edf5" },
] as const;

const RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];

type Suit = typeof SUITS[number];
type Card = {
  id: string;
  name: string;
  text?: string;
  rank?: string;
  suit?: Suit;
};

function buildStandardDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({
        id: `standard:${rank}:${suit.name}`,
        name: `${rank} of ${suit.name}`,
        rank,
        suit,
      });
    }
  }
  return deck;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function DeckOfManyThingsModal(props: { isOpen: boolean; onClose: () => void }) {
  const [sourceDeck, setSourceDeck] = useState<Card[]>(() => buildStandardDeck());
  const [deck, setDeck] = useState<Card[]>(() => shuffle(buildStandardDeck()));
  const [drawn, setDrawn] = useState<Card[]>([]);
  const [current, setCurrent] = useState<Card | null>(null);
  const [loadingDeck, setLoadingDeck] = useState(false);
  const [deckError, setDeckError] = useState<string | null>(null);

  useEffect(() => {
    if (!props.isOpen) return;
    let alive = true;

    setLoadingDeck(true);
    setDeckError(null);

    api<{ ok: boolean; count: number; cards: Array<{ id: string; name: string; text?: string }> }>("/api/compendium/decks/deck")
      .then((res) => {
        if (!alive) return;
        const imported: Card[] = (res.cards ?? [])
          .map((card) => ({
            id: String(card.id ?? "").trim(),
            name: String(card.name ?? "").trim(),
            text: String(card.text ?? "").trim(),
          }))
          .filter((card) => card.id.length > 0 && card.name.length > 0);

        const next = imported.length > 0 ? imported : buildStandardDeck();
        setSourceDeck(next);
        setDeck(shuffle(next));
        setDrawn([]);
        setCurrent(null);
      })
      .catch(() => {
        if (!alive) return;
        const fallback = buildStandardDeck();
        setSourceDeck(fallback);
        setDeck(shuffle(fallback));
        setDrawn([]);
        setCurrent(null);
        setDeckError("Using standard 52-card deck (no imported Deck found).");
      })
      .finally(() => {
        if (alive) setLoadingDeck(false);
      });

    return () => {
      alive = false;
    };
  }, [props.isOpen]);

  function draw() {
    if (deck.length === 0) return;
    const [card, ...rest] = deck;
    if (!card) return;
    setDeck(rest);
    setDrawn((d) => [...d, card]);
    setCurrent(card);
  }

  function reshuffle() {
    setDeck(shuffle(sourceDeck));
    setDrawn([]);
    setCurrent(null);
  }

  const empty = deck.length === 0;
  const isStandardCard = Boolean(current?.rank && current?.suit);
  const currentColor = useMemo(() => (current?.suit?.color ? current.suit.color : theme.colors.accentPrimary), [current]);

  return (
    <Modal isOpen={props.isOpen} onClose={props.onClose} title="Deck of Many Things" width={460} height={440}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 20, padding: 24 }}>
        <div
          style={{
            width: 140,
            height: 196,
            borderRadius: 14,
            border: `2px solid ${theme.colors.panelBorder}`,
            background: current ? "#1a2438" : withAlpha(theme.colors.panelBg, 0.4),
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: current ? `0 8px 32px ${withAlpha(theme.colors.shadowColor ?? "#000", 0.5)}` : "none",
            position: "relative",
            overflow: "hidden",
          }}
        >
          {current ? (
            isStandardCard ? (
              <>
                <div style={{ position: "absolute", top: 10, left: 12, color: current.suit!.color, fontWeight: 900, fontSize: 16, lineHeight: 1 }}>
                  <div>{current.rank}</div>
                  <div>{current.suit!.symbol}</div>
                </div>
                <div style={{ fontSize: 52, color: current.suit!.color }}>{current.suit!.symbol}</div>
                <div style={{ position: "absolute", bottom: 10, right: 12, color: current.suit!.color, fontWeight: 900, fontSize: 16, lineHeight: 1, transform: "rotate(180deg)" }}>
                  <div>{current.rank}</div>
                  <div>{current.suit!.symbol}</div>
                </div>
              </>
            ) : (
              <div style={{ padding: 14, textAlign: "center", height: "100%", boxSizing: "border-box", display: "flex", flexDirection: "column" }}>
                <div style={{ fontSize: 20, fontWeight: 900, color: theme.colors.text, marginBottom: 8 }}>{current.name}</div>
                <div
                  style={{
                    fontSize: 12,
                    color: theme.colors.muted,
                    lineHeight: 1.35,
                    textAlign: "left",
                    overflowY: "auto",
                    paddingRight: 2,
                    flex: 1,
                  }}
                >
                  {current.text ? current.text : "No description."}
                </div>
              </div>
            )
          ) : (
            <div style={{ color: theme.colors.muted, fontSize: 13, textAlign: "center", padding: 12 }}>
              {loadingDeck ? "Loading deck..." : (empty ? "Deck empty" : "Draw a card")}
            </div>
          )}
        </div>

        {current && (
          <div style={{ fontWeight: 700, fontSize: 18, color: currentColor, textAlign: "center" }}>
            {current.name}
          </div>
        )}

        {deckError && (
          <div style={{ fontSize: 12, color: theme.colors.muted, textAlign: "center" }}>
            {deckError}
          </div>
        )}

        <div style={{ display: "flex", gap: 20, fontSize: 13, color: theme.colors.muted }}>
          <span>{deck.length} remaining</span>
          <span>{drawn.length} drawn</span>
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <button
            onClick={draw}
            disabled={empty || loadingDeck}
            style={{
              background: (empty || loadingDeck) ? withAlpha(theme.colors.text, 0.06) : withAlpha(theme.colors.accentPrimary, 0.15),
              color: (empty || loadingDeck) ? theme.colors.muted : theme.colors.accentPrimary,
              border: `1px solid ${(empty || loadingDeck) ? theme.colors.panelBorder : withAlpha(theme.colors.accentPrimary, 0.4)}`,
              borderRadius: theme.radius.control,
              padding: "10px 28px",
              cursor: (empty || loadingDeck) ? "not-allowed" : "pointer",
              fontWeight: 700,
              fontSize: 14,
            }}
          >
            Draw Card
          </button>
          <button
            onClick={reshuffle}
            disabled={loadingDeck}
            style={{
              background: withAlpha(theme.colors.text, 0.07),
              color: theme.colors.text,
              border: `1px solid ${theme.colors.panelBorder}`,
              borderRadius: theme.radius.control,
              padding: "10px 20px",
              cursor: loadingDeck ? "not-allowed" : "pointer",
              fontWeight: 700,
              fontSize: 14,
              opacity: loadingDeck ? 0.6 : 1,
            }}
          >
            Reshuffle
          </button>
        </div>
      </div>
    </Modal>
  );
}
