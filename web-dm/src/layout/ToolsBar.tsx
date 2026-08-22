import React, { useState } from "react";
import { useMatch } from "react-router-dom";
import { theme } from "@/theme/theme";
import { IconNameGenerator, IconDice, IconDeckOfManyThings, IconBastions } from "@/icons";
import { IconButton } from "@/ui/IconButton";

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
  // Once a tool has been opened, keep its component mounted (never unmount it again) so its
  // own internal state (dice expression, drawn cards, generated name, etc.) survives close/reopen
  // exactly like it did before these were lazy-loaded. Only the FIRST open triggers the dynamic
  // import; every open after that just toggles the already-mounted component's `isOpen` prop.
  const [everOpened, setEverOpened] = useState<ReadonlySet<ToolId>>(() => new Set());
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

  React.useEffect(() => {
    if (open && !everOpened.has(open)) {
      setEverOpened((prev) => new Set(prev).add(open));
    }
  }, [open, everOpened]);

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
            <IconButton
              key={id}
              title={label}
              onClick={() => toggle(id)}
              variant={active ? "accent" : "ghost"}
            >
              <Icon size={22} title={label} />
            </IconButton>
          );
        })}
      </div>

      <React.Suspense fallback={null}>
        {everOpened.has("nameGenerator") && <NameGeneratorModal isOpen={open === "nameGenerator"} onClose={() => setOpen(null)} />}
        {everOpened.has("diceCalc") && <DiceCalculatorModal isOpen={open === "diceCalc"} onClose={() => setOpen(null)} />}
        {everOpened.has("deck") && <DeckOfManyThingsModal isOpen={open === "deck"} onClose={() => setOpen(null)} />}
        {everOpened.has("bastions") && <BastionsModal isOpen={open === "bastions"} onClose={() => setOpen(null)} />}
      </React.Suspense>
    </>
  );
}
