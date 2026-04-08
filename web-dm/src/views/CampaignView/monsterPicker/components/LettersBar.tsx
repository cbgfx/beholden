import * as React from "react";
import { theme } from "@/theme/theme";

export function LettersBar(props: { letters: string[]; onJump: (letter: string) => void }) {
  return (
    <div
      style={{
        position: "absolute",
        top: 8,
        right: 4,
        bottom: 8,
        width: 16,
        display: "flex",
        flexDirection: "column",
        gap: 2,
        alignItems: "center",
        justifyContent: "flex-start",
        userSelect: "none",
        pointerEvents: "auto"
      }}
    >
      {props.letters.map((L) => (
        <button
          key={L}
          type="button"
          onClick={() => props.onJump(L)}
          style={{
            border: 0,
            background: "transparent",
            color: theme.colors.muted,
            fontSize: "var(--fs-tiny)",
            fontWeight: 900,
            cursor: "pointer",
            padding: 0,
            lineHeight: "12px"
          }}
          title={L}
        >
          {L}
        </button>
      ))}
    </div>
  );
}
