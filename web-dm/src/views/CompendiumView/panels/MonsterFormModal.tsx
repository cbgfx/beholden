import * as React from "react";
import { theme, withAlpha } from "@/theme/theme";
import { Input } from "@/ui/Input";
import { Select } from "@/ui/Select";
import { api, jsonInit } from "@/services/api";
import {
  MonsterForEdit, MonsterBlock,
  SIZES, TYPES, baseInput,
  normalizeSize, toStr, normalizeBlocks,
  SectionHeader, FieldRow, Field, AbilityInput, BlockEditor,
} from "./MonsterFormParts";

export type { MonsterBlock, MonsterForEdit };

export function MonsterFormModal(props: {
  monster: MonsterForEdit | null;
  isDuplicate?: boolean;
  onClose: () => void;
  onSaved: (id: string) => void;
}) {
  const isDuplicate = props.isDuplicate ?? false;
  const isEdit = props.monster != null && !isDuplicate;
  const m = props.monster;

  const [name, setName]               = React.useState(isDuplicate ? `${m?.name ?? ""} (Copy)` : (m?.name ?? ""));
  const [cr, setCr]                   = React.useState(toStr(m?.cr));
  const [typeFull, setTypeFull]       = React.useState(toStr(m?.typeFull ?? (m as any)?.typeKey));
  const [size, setSize]               = React.useState(normalizeSize(m?.size) || "Medium");
  const [environment, setEnvironment] = React.useState(toStr(m?.environment));
  const [ac, setAc]                   = React.useState(toStr(m?.ac));
  const [hp, setHp]                   = React.useState(toStr(m?.hp));
  const [speed, setSpeed]             = React.useState(toStr(m?.speed));
  const [str, setStr]                 = React.useState(m?.str != null ? String(m.str) : "");
  const [dex, setDex]                 = React.useState(m?.dex != null ? String(m.dex) : "");
  const [con, setCon]                 = React.useState(m?.con != null ? String(m.con) : "");
  const [int_, setInt]                = React.useState(m?.int != null ? String(m.int) : "");
  const [wis, setWis]                 = React.useState(m?.wis != null ? String(m.wis) : "");
  const [cha, setCha]                 = React.useState(m?.cha != null ? String(m.cha) : "");
  const [save, setSave]               = React.useState(toStr(m?.save));
  const [skill, setSkill]             = React.useState(toStr(m?.skill));
  const [senses, setSenses]           = React.useState(toStr(m?.senses));
  const [languages, setLanguages]     = React.useState(toStr(m?.languages));
  const [immune, setImmune]           = React.useState(toStr(m?.immune));
  const [resist, setResist]           = React.useState(toStr(m?.resist));
  const [vulnerable, setVulnerable]   = React.useState(toStr(m?.vulnerable));
  const [condImm, setCondImm]         = React.useState(toStr(m?.conditionImmune));
  const [traits, setTraits]           = React.useState<MonsterBlock[]>(normalizeBlocks(m?.trait));
  const [actions, setActions]         = React.useState<MonsterBlock[]>(normalizeBlocks(m?.action));
  const [reactions, setReactions]     = React.useState<MonsterBlock[]>(normalizeBlocks(m?.reaction));
  const [legendary, setLegendary]     = React.useState<MonsterBlock[]>(normalizeBlocks(m?.legendary));
  const [busy, setBusy]               = React.useState(false);
  const [error, setError]             = React.useState<string | null>(null);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") props.onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [props.onClose]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setError("Name is required"); return; }
    setBusy(true); setError(null);

    const payload = {
      name: name.trim(),
      cr: cr.trim() || null,
      typeFull: typeFull.trim() || null,
      size: size || null,
      environment: environment.trim() || null,
      ac: ac.trim() || null,
      hp: hp.trim() || null,
      speed: speed.trim() || null,
      str: str.trim() ? Number(str.trim()) : null, dex: dex.trim() ? Number(dex.trim()) : null, con: con.trim() ? Number(con.trim()) : null,
      int: int_.trim() ? Number(int_.trim()) : null, wis: wis.trim() ? Number(wis.trim()) : null, cha: cha.trim() ? Number(cha.trim()) : null,
      save: save.trim() || null, skill: skill.trim() || null,
      senses: senses.trim() || null, languages: languages.trim() || null,
      immune: immune.trim() || null, resist: resist.trim() || null,
      vulnerable: vulnerable.trim() || null, conditionImmune: condImm.trim() || null,
      trait:     traits.filter((b) => b.name || b.text),
      action:    actions.filter((b) => b.name || b.text),
      reaction:  reactions.filter((b) => b.name || b.text),
      legendary: legendary.filter((b) => b.name || b.text),
    };

    try {
      let id: string;
      if (isEdit) {
        await api(`/api/compendium/monsters/${encodeURIComponent(m!.id)}`, jsonInit("PUT", payload));
        id = m!.id;
      } else {
        const result = await api<{ id: string }>("/api/compendium/monsters", jsonInit("POST", payload));
        id = result.id;
      }
      props.onSaved(id);
    } catch (err: unknown) {
      setError(String((err as Error)?.message ?? err));
    } finally {
      setBusy(false);
    }
  }

  const btnBase: React.CSSProperties = {
    padding: "7px 16px", borderRadius: 8, fontWeight: 700, cursor: "pointer", fontSize: "var(--fs-subtitle)",
    border: "none",
  };

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) props.onClose(); }}
      style={{
        position: "fixed", inset: 0, zIndex: 1000,
        display: "flex", alignItems: "flex-start", justifyContent: "center",
        background: theme.colors.scrim, overflowY: "auto",
        padding: "40px 16px",
      }}
    >
      <form
        onSubmit={handleSubmit}
        style={{
          width: "min(800px, 100%)", background: theme.colors.modalBg,
          border: `1px solid ${theme.colors.panelBorder}`, borderRadius: 16,
          display: "flex", flexDirection: "column",
        }}
      >
        {/* Header */}
        <div style={{
          padding: "14px 20px", borderBottom: `1px solid ${theme.colors.panelBorder}`,
          display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0,
        }}>
          <span style={{ fontWeight: 700, fontSize: "var(--fs-body)" }}>
            {isEdit ? `Edit: ${m!.name}` : isDuplicate ? `Duplicate: ${m!.name}` : "New Monster"}
          </span>
          <button type="button" onClick={props.onClose}
            style={{ background: "none", border: "none", color: theme.colors.muted, cursor: "pointer", fontSize: "var(--fs-hero)", lineHeight: 1 }}>
            ×
          </button>
        </div>

        {/* Scrollable body */}
        <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 20, overflowY: "auto", maxHeight: "calc(90vh - 120px)" }}>

          {/* Identity */}
          <div>
            <SectionHeader title="Identity" />
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <FieldRow>
                <Field label="Name *" grow>
                  <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Ancient Red Dragon" required />
                </Field>
                <Field label="CR" style={{ minWidth: 90 }}>
                  <Input value={cr} onChange={(e) => setCr(e.target.value)} placeholder="e.g. 17 or 1/4" />
                </Field>
              </FieldRow>
              <FieldRow>
                <Field label="Type" grow>
                  <input
                    value={typeFull} onChange={(e) => setTypeFull(e.target.value)}
                    placeholder="e.g. humanoid (goblinoid)"
                    list="mfm-type-list"
                    style={baseInput}
                  />
                  <datalist id="mfm-type-list">
                    {TYPES.map((t) => <option key={t} value={t} />)}
                  </datalist>
                </Field>
                <Field label="Size" style={{ minWidth: 130 }}>
                  <Select value={size} onChange={(e) => setSize(e.target.value)} style={{ width: "100%" }}>
                    <option value="">—</option>
                    {SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </Select>
                </Field>
                <Field label="Environment" grow>
                  <Input value={environment} onChange={(e) => setEnvironment(e.target.value)} placeholder="e.g. forest, mountain" />
                </Field>
              </FieldRow>
            </div>
          </div>

          {/* Combat stats */}
          <div>
            <SectionHeader title="Combat Stats" />
            <FieldRow>
              <Field label="AC" grow>
                <Input value={ac} onChange={(e) => setAc(e.target.value)} placeholder="e.g. 17 (natural armor)" />
              </Field>
              <Field label="HP" grow>
                <Input value={hp} onChange={(e) => setHp(e.target.value)} placeholder="e.g. 256 (19d20 + 57)" />
              </Field>
              <Field label="Speed" grow>
                <Input value={speed} onChange={(e) => setSpeed(e.target.value)} placeholder="e.g. 40 ft., fly 80 ft." />
              </Field>
            </FieldRow>
          </div>

          {/* Ability scores */}
          <div>
            <SectionHeader title="Ability Scores" />
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {([["STR", str, setStr], ["DEX", dex, setDex], ["CON", con, setCon],
                 ["INT", int_, setInt], ["WIS", wis, setWis], ["CHA", cha, setCha]] as const).map(
                ([label, val, setter]) => (
                  <AbilityInput key={label} label={label} value={val as string} onChange={setter as (v: string) => void} />
                )
              )}
            </div>
          </div>

          {/* Proficiencies */}
          <div>
            <SectionHeader title="Proficiencies &amp; Senses" />
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <FieldRow>
                <Field label="Saving Throws" grow>
                  <Input value={save} onChange={(e) => setSave(e.target.value)} placeholder="e.g. STR +9, CON +9" />
                </Field>
                <Field label="Skills" grow>
                  <Input value={skill} onChange={(e) => setSkill(e.target.value)} placeholder="e.g. Perception +5, Stealth +4" />
                </Field>
              </FieldRow>
              <FieldRow>
                <Field label="Senses" grow>
                  <Input value={senses} onChange={(e) => setSenses(e.target.value)} placeholder="e.g. darkvision 60 ft., passive Perception 14" />
                </Field>
                <Field label="Languages" grow>
                  <Input value={languages} onChange={(e) => setLanguages(e.target.value)} placeholder="e.g. Common, Draconic" />
                </Field>
              </FieldRow>
            </div>
          </div>

          {/* Damage & conditions */}
          <div>
            <SectionHeader title="Damage &amp; Conditions" />
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <FieldRow>
                <Field label="Immunities" grow>
                  <Input value={immune} onChange={(e) => setImmune(e.target.value)} placeholder="e.g. fire, poison" />
                </Field>
                <Field label="Resistances" grow>
                  <Input value={resist} onChange={(e) => setResist(e.target.value)} placeholder="e.g. cold, lightning" />
                </Field>
              </FieldRow>
              <FieldRow>
                <Field label="Vulnerabilities" grow>
                  <Input value={vulnerable} onChange={(e) => setVulnerable(e.target.value)} placeholder="e.g. thunder" />
                </Field>
                <Field label="Condition Immunities" grow>
                  <Input value={condImm} onChange={(e) => setCondImm(e.target.value)} placeholder="e.g. charmed, frightened" />
                </Field>
              </FieldRow>
            </div>
          </div>

          {/* Block lists */}
          <BlockEditor label="Traits" blocks={traits} onChange={setTraits} />
          <BlockEditor label="Actions" blocks={actions} onChange={setActions} />
          <BlockEditor label="Reactions" blocks={reactions} onChange={setReactions} />
          <BlockEditor label="Legendary Actions" blocks={legendary} onChange={setLegendary} />

          {error && (
            <div style={{ color: theme.colors.red, fontSize: "var(--fs-subtitle)" }}>{error}</div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: "12px 20px", borderTop: `1px solid ${theme.colors.panelBorder}`,
          display: "flex", justifyContent: "flex-end", gap: 8, flexShrink: 0,
        }}>
          <button type="button" onClick={props.onClose}
            style={{ ...btnBase, background: withAlpha(theme.colors.panelBorder, 0.4), color: theme.colors.text }}>
            Cancel
          </button>
          <button type="submit" disabled={busy}
            style={{ ...btnBase, background: theme.colors.accentPrimary, color: theme.colors.textDark, opacity: busy ? 0.6 : 1 }}>
            {busy ? "Saving…" : isEdit ? "Save Changes" : isDuplicate ? "Create Duplicate" : "Create Monster"}
          </button>
        </div>
      </form>
    </div>
  );
}
