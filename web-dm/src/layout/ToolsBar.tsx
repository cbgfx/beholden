import React, { useState } from "react";
import { theme, withAlpha } from "@/theme/theme";
import { IconNameGenerator, IconDiceCalc, IconDeckOfManyThings, IconBastions } from "@/icons";
import { NameGeneratorModal } from "@/tools/NameGeneratorModal";
import { DiceCalculatorModal } from "@/tools/DiceCalculatorModal";
import { DeckOfManyThingsModal } from "@/tools/DeckOfManyThingsModal";
import { BastionsModal } from "@/tools/BastionsModal";

type ToolId = "nameGenerator" | "diceCalc" | "deck" | "bastions";

const TOOLS: { id: ToolId; label: string; Icon: React.ComponentType<{ size?: number; title?: string }> }[] = [
  { id: "nameGenerator", label: "Name Generator",      Icon: IconNameGenerator },
  { id: "diceCalc",      label: "Dice Calculator",     Icon: IconDiceCalc },
  { id: "deck",          label: "Deck of Many Things", Icon: IconDeckOfManyThings },
  { id: "bastions",      label: "Bastions",            Icon: IconBastions },
];

export function ToolsBar() {
  const [open, setOpen] = useState<ToolId | null>(null);

  function toggle(id: ToolId) {
    setOpen((prev) => (prev === id ? null : id));
  }

  return (
    <>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 2,
          padding: "0 8px",
          borderLeft: `1px solid ${theme.colors.panelBorder}`,
          borderRight: `1px solid ${theme.colors.panelBorder}`,
        }}
      >
        {TOOLS.map(({ id, label, Icon }) => {
          const active = open === id;
          return (
            <button
              key={id}
              title={label}
              onClick={() => toggle(id)}
              style={{
                background: active ? withAlpha(theme.colors.accentPrimary, 0.15) : "transparent",
                border: `1px solid ${active ? withAlpha(theme.colors.accentPrimary, 0.5) : "transparent"}`,
                borderRadius: theme.radius.control,
                padding: 6,
                cursor: "pointer",
                color: active ? theme.colors.accentPrimary : theme.colors.muted,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "color 150ms, background 150ms, border-color 150ms",
              }}
            >
              <Icon size={20} title={label} />
            </button>
          );
        })}
      </div>

      <NameGeneratorModal    isOpen={open === "nameGenerator"} onClose={() => setOpen(null)} />
      <DiceCalculatorModal   isOpen={open === "diceCalc"}      onClose={() => setOpen(null)} />
      <DeckOfManyThingsModal isOpen={open === "deck"}          onClose={() => setOpen(null)} />
      <BastionsModal         isOpen={open === "bastions"}      onClose={() => setOpen(null)} />
    </>
  );
}
