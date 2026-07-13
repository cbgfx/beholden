import React, { useState } from "react";
import { useMatch } from "react-router-dom";
import { theme, withAlpha } from "@/theme/theme";
import { IconNameGenerator, IconDice, IconDeckOfManyThings, IconBastions } from "@/icons";

const NameGeneratorModal = React.lazy(() =>
  import("@/tools/NameGeneratorModal").then((module) => ({ default: module.NameGeneratorModal })),
);
const DiceCalculatorModal = React.lazy(() =>
  import("@/tools/DiceCalculatorModal").then((module) => ({ default: module.DiceCalculatorModal })),
);
const DeckOfManyThingsModal = React.lazy(() =>
  import("@/tools/DeckOfManyThingsModal").then((module) => ({ default: module.DeckOfManyThingsModal })),
);
const BastionsModal = React.lazy(() =>
  import("@/tools/BastionsModal").then((module) => ({ default: module.BastionsModal })),
);

type ToolId = "nameGenerator" | "diceCalc" | "deck" | "bastions";

const TOOLS: { id: ToolId; label: string; Icon: React.ComponentType<{ size?: number; title?: string }> }[] = [
  { id: "nameGenerator", label: "Name Generator",      Icon: IconNameGenerator },
  { id: "diceCalc",      label: "Dice Calculator",     Icon: IconDice },
  { id: "deck",          label: "Deck of Many Things", Icon: IconDeckOfManyThings },
  { id: "bastions",      label: "Bastions",            Icon: IconBastions },
];

export function ToolsBar() {
  const [open, setOpen] = useState<ToolId | null>(null);
  const campaignExact = useMatch("/campaign/:campaignId");
  const campaignNested = useMatch("/campaign/:campaignId/*");
  const isInsideCampaign = Boolean(campaignExact || campaignNested);
  const visibleTools = React.useMemo(
    () => TOOLS.filter((tool) => tool.id !== "bastions" || isInsideCampaign),
    [isInsideCampaign],
  );

  React.useEffect(() => {
    if (!isInsideCampaign && open === "bastions") setOpen(null);
  }, [isInsideCampaign, open]);

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
        {visibleTools.map(({ id, label, Icon }) => {
          const active = open === id;
          return (
            <button
              type="button"
              key={id}
              title={label}
              onClick={() => toggle(id)}
              style={{
                width: 36,
                height: 36,
                background: active ? withAlpha(theme.colors.accentPrimary, 0.14) : "rgba(255,255,255,0.04)",
                border: `1px solid ${active ? withAlpha(theme.colors.accentPrimary, 0.55) : theme.colors.panelBorder}`,
                borderRadius: 9,
                padding: 0,
                cursor: "pointer",
                color: active ? theme.colors.accentPrimary : theme.colors.muted,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                transition: "color 150ms, background 150ms, border-color 150ms",
              }}
            >
              <Icon size={22} title={label} />
            </button>
          );
        })}
      </div>

      <React.Suspense fallback={null}>
        {open === "nameGenerator" && <NameGeneratorModal isOpen onClose={() => setOpen(null)} />}
        {open === "diceCalc" && <DiceCalculatorModal isOpen onClose={() => setOpen(null)} />}
        {open === "deck" && <DeckOfManyThingsModal isOpen onClose={() => setOpen(null)} />}
        {open === "bastions" && <BastionsModal isOpen onClose={() => setOpen(null)} />}
      </React.Suspense>
    </>
  );
}
