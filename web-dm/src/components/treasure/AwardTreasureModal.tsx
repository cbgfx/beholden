import * as React from "react";
import type { CampaignCharacter, TreasureEntry } from "@/domain/types/domain";
import { Modal } from "@/components/overlay/Modal";
import { Button } from "@/ui/Button";
import { Input } from "@/ui/Input";
import { Select } from "@/ui/Select";
import { theme } from "@/theme/theme";

export function AwardTreasureModal(props: {
  treasure: TreasureEntry | null;
  players: CampaignCharacter[];
  busy: boolean;
  error: string | null;
  onClose: () => void;
  onAward: (playerId: string, quantity: number) => void;
}) {
  const eligiblePlayers = React.useMemo(
    () => [...props.players]
      .filter((player) => Boolean(player.characterId))
      .sort((a, b) => a.characterName.localeCompare(b.characterName)),
    [props.players],
  );
  const [playerId, setPlayerId] = React.useState("party");
  const [quantity, setQuantity] = React.useState(1);

  React.useEffect(() => {
    if (!props.treasure) return;
    setPlayerId(eligiblePlayers[0]?.id ?? "party");
    setQuantity(1);
  }, [eligiblePlayers, props.treasure]);

  const maxQuantity = Math.max(1, props.treasure?.qty ?? 1);

  return (
    <Modal
      isOpen={Boolean(props.treasure)}
      title={props.treasure ? `Award ${props.treasure.name}` : "Award treasure"}
      onClose={props.onClose}
      width={480}
      height={310}
    >
      <div style={{ padding: 18, display: "grid", gap: 16, overflowY: "auto" }}>
        <label style={{ display: "grid", gap: 6 }}>
          <span style={{ color: theme.colors.muted, fontWeight: 800 }}>Recipient</span>
          <Select value={playerId} onChange={(event) => setPlayerId(event.target.value)}>
            <option value="party">Party Stash</option>
            {eligiblePlayers.map((player) => (
              <option key={player.id} value={player.id}>
                {player.characterName}{player.playerName ? ` (${player.playerName})` : ""}
              </option>
            ))}
          </Select>
        </label>

        <label style={{ display: "grid", gap: 6 }}>
          <span style={{ color: theme.colors.muted, fontWeight: 800 }}>
            Quantity available: {maxQuantity}
          </span>
          <Input
            type="number"
            min={1}
            max={maxQuantity}
            value={quantity}
            onChange={(event) => {
              const next = Math.floor(Number(event.target.value) || 1);
              setQuantity(Math.max(1, Math.min(maxQuantity, next)));
            }}
          />
        </label>

        {props.error ? <div style={{ color: theme.colors.red }}>{props.error}</div> : null}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <Button variant="ghost" onClick={props.onClose} disabled={props.busy}>Cancel</Button>
          <Button
            onClick={() => props.onAward(playerId, quantity)}
            disabled={props.busy || !playerId}
          >
            {props.busy ? "Awarding..." : "Award"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
