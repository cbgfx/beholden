import React, { useState } from "react";
import { Modal } from "@/components/overlay/Modal";
import { theme, withAlpha } from "@/theme/theme";

const SUITS = [
  { symbol: "♠", name: "Spades",   color: "#e8edf5" },
  { symbol: "♥", name: "Hearts",   color: "#ff5d5d" },
  { symbol: "♦", name: "Diamonds", color: "#ff5d5d" },
  { symbol: "♣", name: "Clubs",    color: "#e8edf5" },
];

const RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];

type Card = { rank: string; suit: typeof SUITS[number] };

function buildDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ rank, suit });
    }
  }
  return deck;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function DeckOfManyThingsModal(props: { isOpen: boolean; onClose: () => void }) {
  const [deck, setDeck] = useState<Card[]>(() => shuffle(buildDeck()));
  const [drawn, setDrawn] = useState<Card[]>([]);
  const [current, setCurrent] = useState<Card | null>(null);

  function draw() {
    if (deck.length === 0) return;
    const [card, ...rest] = deck;
    setDeck(rest);
    setDrawn((d) => [...d, card]);
    setCurrent(card);
  }

  function reshuffle() {
    const fresh = shuffle(buildDeck());
    setDeck(fresh);
    setDrawn([]);
    setCurrent(null);
  }

  const empty = deck.length === 0;

  return (
    <Modal isOpen={props.isOpen} onClose={props.onClose} title="Deck of Many Things" width={460} height={440}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 20, padding: 24 }}>
        {/* Card display */}
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
            <>
              {/* Top rank + suit */}
              <div style={{ position: "absolute", top: 10, left: 12, color: current.suit.color, fontWeight: 900, fontSize: 16, lineHeight: 1 }}>
                <div>{current.rank}</div>
                <div>{current.suit.symbol}</div>
              </div>
              {/* Center suit */}
              <div style={{ fontSize: 52, color: current.suit.color }}>{current.suit.symbol}</div>
              {/* Bottom rank + suit (rotated) */}
              <div style={{ position: "absolute", bottom: 10, right: 12, color: current.suit.color, fontWeight: 900, fontSize: 16, lineHeight: 1, transform: "rotate(180deg)" }}>
                <div>{current.rank}</div>
                <div>{current.suit.symbol}</div>
              </div>
            </>
          ) : (
            <div style={{ color: theme.colors.muted, fontSize: 13, textAlign: "center", padding: 12 }}>
              {empty ? "Deck empty" : "Draw a card"}
            </div>
          )}
        </div>

        {/* Card name */}
        {current && (
          <div style={{ fontWeight: 700, fontSize: 18, color: current.suit.color }}>
            {current.rank} of {current.suit.name}
          </div>
        )}

        {/* Counters */}
        <div style={{ display: "flex", gap: 20, fontSize: 13, color: theme.colors.muted }}>
          <span>{deck.length} remaining</span>
          <span>{drawn.length} drawn</span>
        </div>

        {/* Actions */}
        <div style={{ display: "flex", gap: 10 }}>
          <button
            onClick={draw}
            disabled={empty}
            style={{
              background: empty ? withAlpha(theme.colors.text, 0.06) : withAlpha(theme.colors.accentPrimary, 0.15),
              color: empty ? theme.colors.muted : theme.colors.accentPrimary,
              border: `1px solid ${empty ? theme.colors.panelBorder : withAlpha(theme.colors.accentPrimary, 0.4)}`,
              borderRadius: theme.radius.control,
              padding: "10px 28px",
              cursor: empty ? "not-allowed" : "pointer",
              fontWeight: 700,
              fontSize: 14,
            }}
          >
            Draw Card
          </button>
          <button
            onClick={reshuffle}
            style={{
              background: withAlpha(theme.colors.text, 0.07),
              color: theme.colors.text,
              border: `1px solid ${theme.colors.panelBorder}`,
              borderRadius: theme.radius.control,
              padding: "10px 20px",
              cursor: "pointer",
              fontWeight: 700,
              fontSize: 14,
            }}
          >
            Reshuffle
          </button>
        </div>
      </div>
    </Modal>
  );
}
