import * as React from "react";
import { api } from "@/services/api";
import { theme } from "@/theme/theme";
import { Modal } from "@/components/overlay/Modal";
import { Button } from "@/ui/Button";
import type { CampaignCharacter, EncounterActor } from "@/domain/types/domain";
import type { MonsterDetail } from "@/domain/types/compendium";
import { MonsterCarriedLoot } from "@/views/CombatView/components/MonsterCarriedLoot";

function fmtXp(n: number): string {
  return n.toLocaleString();
}

function XpAwardSection(props: {
  encounterId: string;
  totalXp: number;
  playerCount: number;
}) {
  const { encounterId, totalXp, playerCount } = props;
  const defaultPerPlayer = playerCount > 0 ? Math.floor(totalXp / playerCount) : totalXp;
  const [xpInput, setXpInput] = React.useState(String(defaultPerPlayer));
  const [awarding, setAwarding] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [awarded, setAwarded] = React.useState(false);
  const awardedTimerRef = React.useRef<number | null>(null);

  React.useEffect(() => () => {
    if (awardedTimerRef.current != null) window.clearTimeout(awardedTimerRef.current);
  }, []);

  const xpValue = parseInt(xpInput, 10);
  const valid = !isNaN(xpValue) && xpValue > 0;

  const award = async () => {
    if (!valid || awarding) return;
    setAwarding(true);
    setError(null);
    try {
      await api(`/api/encounters/${encounterId}/award-xp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ xpPerCharacter: xpValue }),
      });
      setAwarded(true);
      setAwarding(false);
      // Flash a confirmation, then return to the form — the Rewards modal no longer auto-closes
      // (it also hosts the loot section below), so the form must stay reachable for a follow-up
      // award instead of permanently swapping to a static "XP awarded!" message.
      awardedTimerRef.current = window.setTimeout(() => setAwarded(false), 1500);
    } catch {
      setError("Failed to award XP. Try again.");
      setAwarding(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {awarded ? (
        <div style={{ textAlign: "center", color: theme.colors.green, fontWeight: 800, fontSize: "var(--fs-large)", padding: "20px 0" }}>
          XP awarded!
        </div>
      ) : (
        <>
          <div style={{ display: "flex", gap: 12 }}>
            <div style={{ flex: 1, padding: "10px 14px", borderRadius: 10, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", textAlign: "center" }}>
              <div style={{ fontSize: "var(--fs-tiny)", color: theme.colors.muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>Total XP</div>
              <div style={{ fontSize: "var(--fs-large)", fontWeight: 900, color: theme.colors.text }}>{fmtXp(totalXp)}</div>
            </div>
            <div style={{ flex: 1, padding: "10px 14px", borderRadius: 10, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", textAlign: "center" }}>
              <div style={{ fontSize: "var(--fs-tiny)", color: theme.colors.muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>Players</div>
              <div style={{ fontSize: "var(--fs-large)", fontWeight: 900, color: theme.colors.text }}>{playerCount}</div>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <label style={{ fontSize: "var(--fs-tiny)", fontWeight: 700, color: theme.colors.muted, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              XP per player
            </label>
            <input
              type="text"
              inputMode="numeric"
              value={xpInput}
              onChange={(e) => setXpInput(e.target.value.replace(/[^0-9]/g, ""))}
              onKeyDown={(e) => { if (e.key === "Enter") void award(); }}
              style={{
                padding: "10px 14px", borderRadius: 8, textAlign: "center",
                border: `1px solid ${valid ? "rgba(255,255,255,0.2)" : "rgba(220,38,38,0.5)"}`,
                background: "rgba(255,255,255,0.05)",
                color: theme.colors.text, fontSize: "var(--fs-large)", fontWeight: 900,
                outline: "none", width: "100%", boxSizing: "border-box", fontFamily: "inherit",
              }}
            />
          </div>

          {error && <div style={{ fontSize: "var(--fs-small)", color: theme.colors.red }}>{error}</div>}

          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <Button variant="primary" onClick={() => void award()} disabled={!valid || awarding}>
              {awarding ? "Awarding…" : `Award ${valid ? fmtXp(xpValue) : ""} XP`}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

export function RewardsModal(props: {
  encounterId: string;
  totalXp: number;
  playerCount: number;
  orderedCombatants: EncounterActor[];
  monsterCache: Record<string, MonsterDetail>;
  resolveMonsterId: (c: EncounterActor | null) => string | null;
  ensureMonster: (id: string) => Promise<void>;
  players: CampaignCharacter[];
  onClose: () => void;
}) {
  return (
    <Modal isOpen title="Rewards" onClose={props.onClose} width={520} height="auto">
      <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 24, maxHeight: "calc(100vh - 140px)", overflowY: "auto" }}>
        <XpAwardSection
          encounterId={props.encounterId}
          totalXp={props.totalXp}
          playerCount={props.playerCount}
        />

        <div style={{ borderTop: `1px solid ${theme.colors.panelBorder}`, paddingTop: 18 }}>
          <MonsterCarriedLoot
            encounterId={props.encounterId}
            orderedCombatants={props.orderedCombatants}
            monsterCache={props.monsterCache}
            resolveMonsterId={props.resolveMonsterId}
            ensureMonster={props.ensureMonster}
            players={props.players}
          />
        </div>
      </div>
    </Modal>
  );
}
