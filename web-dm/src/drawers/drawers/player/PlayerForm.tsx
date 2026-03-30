import React from "react";
import { Input } from "@/ui/Input";
import { theme } from "@/theme/theme";
import { IconCamera } from "@/icons";

export type PlayerFormState = {
  playerName: string;
  characterName: string;
  clazz: string;
  species: string;
  lvl: string;
  ac: string;
  speed: string;
  pStr: string;
  pDex: string;
  pCon: string;
  pInt: string;
  pWis: string;
  pCha: string;
  hpMax: string;
  hpCur: string;
};

export type PlayerFormHandlers = {
  setPlayerName: (v: string) => void;
  setCharacterName: (v: string) => void;
  setClazz: (v: string) => void;
  setSpecies: (v: string) => void;
  setLvl: (v: string) => void;
  setAc: (v: string) => void;
  setSpeed: (v: string) => void;
  setPStr: (v: string) => void;
  setPDex: (v: string) => void;
  setPCon: (v: string) => void;
  setPInt: (v: string) => void;
  setPWis: (v: string) => void;
  setPCha: (v: string) => void;
  setHpMax: (v: string) => void;
  setHpCur: (v: string) => void;
};

function digitsOnly(v: string) {
  return v.replace(/[^0-9]/g, "");
}

export function PlayerForm(props: {
  mode: "create" | "edit";
  state: PlayerFormState;
  handlers: PlayerFormHandlers;
  imageUrl?: string | null;
  onImageClick?: () => void;
  onImageRemove?: () => void;
}) {
  const s = props.state;
  const h = props.handlers;

  return (
    <div style={{ display: "grid", gap: 10 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <div
          onClick={props.onImageClick}
          title={props.imageUrl ? "Change photo" : "Add photo"}
          style={{
            width: 72, height: 72, borderRadius: 8, flexShrink: 0,
            background: props.imageUrl ? "transparent" : theme.colors.inputBg,
            border: `1px solid ${theme.colors.panelBorder}`,
            overflow: "hidden", cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >
          {props.imageUrl
            ? <img src={props.imageUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            : <IconCamera size={22} style={{ opacity: 0.35 }} />}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <button
            type="button" onClick={props.onImageClick}
            style={{ background: "none", border: "none", cursor: "pointer", color: theme.colors.text, fontSize: "var(--fs-medium)", textAlign: "left", padding: 0 }}
          >
            {props.imageUrl ? "Change photo" : "Add photo"}
          </button>
          {props.imageUrl && (
            <button
              type="button" onClick={props.onImageRemove}
              style={{ background: "none", border: "none", cursor: "pointer", color: theme.colors.muted, fontSize: "var(--fs-medium)", textAlign: "left", padding: 0 }}
            >
              Remove
            </button>
          )}
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <div>
          <div style={{ color: theme.colors.muted, marginBottom: 6 }}>Player name</div>
          <Input value={s.playerName} onChange={(e) => h.setPlayerName(e.target.value)} />
        </div>
        <div>
          <div style={{ color: theme.colors.muted, marginBottom: 6 }}>Character name</div>
          <Input value={s.characterName} onChange={(e) => h.setCharacterName(e.target.value)} />
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <div>
          <div style={{ color: theme.colors.muted, marginBottom: 6 }}>Class</div>
          <Input value={s.clazz} onChange={(e) => h.setClazz(e.target.value)} />
        </div>
        <div>
          <div style={{ color: theme.colors.muted, marginBottom: 6 }}>Species</div>
          <Input value={s.species} onChange={(e) => h.setSpecies(e.target.value)} />
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <div>
          <div style={{ color: theme.colors.muted, marginBottom: 6 }}>Level</div>
          <Input value={s.lvl} onChange={(e) => h.setLvl(digitsOnly(e.target.value))} inputMode="numeric" />
        </div>
        <div>
          <div style={{ color: theme.colors.muted, marginBottom: 6 }}>AC</div>
          <Input value={s.ac} onChange={(e) => h.setAc(digitsOnly(e.target.value))} inputMode="numeric" />
        </div>
      </div>

      <div>
        <div style={{ color: theme.colors.muted, marginBottom: 6 }}>Speed</div>
        <Input value={s.speed} onChange={(e) => h.setSpeed(digitsOnly(e.target.value))} placeholder="30" inputMode="numeric" />
      </div>

      <div>
        <div style={{ color: theme.colors.muted, marginBottom: 6 }}>Ability scores</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
          <Score label="STR" value={s.pStr} onChange={h.setPStr} />
          <Score label="DEX" value={s.pDex} onChange={h.setPDex} />
          <Score label="CON" value={s.pCon} onChange={h.setPCon} />
          <Score label="INT" value={s.pInt} onChange={h.setPInt} />
          <Score label="WIS" value={s.pWis} onChange={h.setPWis} />
          <Score label="CHA" value={s.pCha} onChange={h.setPCha} />
        </div>
      </div>

      <div>
        <div style={{ color: theme.colors.muted, marginBottom: 6 }}>HP</div>
        <Input
          value={s.hpMax}
          onChange={(e) => {
            const v = digitsOnly(e.target.value);
            h.setHpMax(v);
            if (props.mode === "create") h.setHpCur(v);
          }}
          inputMode="numeric"
        />

        {props.mode === "edit" ? (
          <div style={{ marginTop: 8, display: "grid", gridTemplateColumns: "1fr", gap: 6 }}>
            <div style={{ color: theme.colors.muted }}>Current HP</div>
            <Input value={s.hpCur} onChange={(e) => h.setHpCur(digitsOnly(e.target.value))} inputMode="numeric" />
          </div>
        ) : null}
      </div>
    </div>
  );
}

function Score(props: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <div style={{ fontSize: "var(--fs-medium)", color: theme.colors.muted, marginBottom: 4 }}>{props.label}</div>
      <Input value={props.value} onChange={(e) => props.onChange(e.target.value.replace(/[^0-9]/g, ""))} inputMode="numeric" />
    </div>
  );
}
