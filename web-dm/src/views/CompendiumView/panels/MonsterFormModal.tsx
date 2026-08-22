import * as React from "react";

import { api, jsonInit } from "@/services/api";
import { theme } from "@/theme/theme";
import { Button } from "@/ui/Button";
import { IconButton } from "@/ui/IconButton";
import { IconClose } from "@/icons";
import type { MonsterForEdit } from "./MonsterFormParts";
import {
  MonsterAbilityScoresSection,
  MonsterBlocksSection,
  MonsterCombatStatsSection,
  MonsterDamageConditionsSection,
  MonsterIdentitySection,
  MonsterProficienciesSection,
} from "./MonsterFormSections";
import { buildMonsterPayload, MonsterFormState, monsterToForm } from "./monsterFormMapping";

export type { MonsterForEdit } from "./MonsterFormParts";

export function MonsterFormModal(props: {
  monster: MonsterForEdit | null;
  isDuplicate?: boolean;
  onClose: () => void;
  onSaved: (id: string) => void;
}) {
  const onClose = props.onClose;
  const isDuplicate = props.isDuplicate ?? false;
  const isEdit = props.monster != null && !isDuplicate;
  const monster = props.monster;

  const [form, setForm] = React.useState<MonsterFormState>(() => monsterToForm(monster, isDuplicate));
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const setField = React.useCallback(<K extends keyof MonsterFormState>(field: K, value: MonsterFormState[K]) => {
    setForm((current) => ({ ...current, [field]: value }));
  }, []);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!form.name.trim()) {
      setError("Name is required");
      return;
    }

    setBusy(true);
    setError(null);

    try {
      const payload = buildMonsterPayload(form, monster);
      let id: string;
      if (isEdit) {
        await api(`/api/compendium/monsters/${encodeURIComponent(monster!.id)}`, jsonInit("PUT", payload));
        id = monster!.id;
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

  return (
    <div
      onClick={(event) => {
        if (event.target === event.currentTarget) props.onClose();
      }}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        display: "flex",
        alignItems: "stretch",
        justifyContent: "center",
        background: theme.colors.scrim,
        overflowY: "auto",
        padding: 12,
      }}
    >
      <form
        className="monster-form-modal"
        onSubmit={handleSubmit}
        style={{
          width: "min(1440px, 100%)",
          height: "calc(100vh - 24px)",
          margin: "0 auto",
          background: theme.colors.modalBg,
          border: `1px solid ${theme.colors.panelBorder}`,
          borderRadius: 16,
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div
          style={{
            padding: "14px 20px",
            borderBottom: `1px solid ${theme.colors.panelBorder}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexShrink: 0,
          }}
        >
          <span style={{ fontWeight: 700, fontSize: "var(--fs-body)" }}>
            {isEdit ? `Edit: ${monster!.name}` : isDuplicate ? `Duplicate: ${monster!.name}` : "New Monster"}
          </span>
          <IconButton onClick={props.onClose} title="Close" variant="ghost">
            <IconClose />
          </IconButton>
        </div>

        <div className="monster-form-workspace" style={{ display: "grid", gridTemplateColumns: "210px minmax(0, 1fr)", flex: 1, minHeight: 0 }}>
          <nav className="monster-form-nav" style={{ padding: "18px 14px", borderRight: `1px solid ${theme.colors.panelBorder}`, overflowY: "auto" }}>
            <div style={{ color: theme.colors.muted, fontSize: "var(--fs-tiny)", fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 8 }}>Monster sections</div>
            {[
              ["identity", "Identity"], ["combat", "Combat Stats"], ["abilities", "Abilities"],
              ["proficiencies", "Proficiencies"], ["defenses", "Defenses"], ["blocks", "Traits & Actions"],
            ].map(([id, label]) => (
              <a key={id} href={`#monster-form-${id}`} style={{ display: "block", padding: "8px 10px", borderRadius: 7, color: theme.colors.text, textDecoration: "none", fontSize: "var(--fs-small)", fontWeight: 650 }}>{label}</a>
            ))}
            <div style={{ marginTop: 18, color: theme.colors.muted, fontSize: "var(--fs-tiny)", lineHeight: 1.5 }}>
              Fields are saved directly as Grand Monster data. Empty optional fields are omitted.
            </div>
          </nav>
          <div
            className="monster-form-editor"
            style={{
              padding: "20px 26px 32px",
              display: "flex",
              flexDirection: "column",
              gap: 26,
              overflowY: "auto",
              scrollBehavior: "smooth",
            }}
          >
            <section id="monster-form-identity"><MonsterIdentitySection form={form} setField={setField} /></section>
            <section id="monster-form-combat"><MonsterCombatStatsSection form={form} setField={setField} /></section>
            <section id="monster-form-abilities"><MonsterAbilityScoresSection form={form} setField={setField} /></section>
            <section id="monster-form-proficiencies"><MonsterProficienciesSection form={form} setField={setField} /></section>
            <section id="monster-form-defenses"><MonsterDamageConditionsSection form={form} setField={setField} /></section>
            <section id="monster-form-blocks"><MonsterBlocksSection form={form} setField={setField} /></section>

            {error ? <div style={{ color: theme.colors.red, fontSize: "var(--fs-subtitle)" }}>{error}</div> : null}
          </div>
        </div>

        <div
          style={{
            padding: "12px 20px",
            borderTop: `1px solid ${theme.colors.panelBorder}`,
            display: "flex",
            justifyContent: "flex-end",
            gap: 8,
            flexShrink: 0,
          }}
        >
          <Button type="button" variant="ghost" onClick={props.onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={busy}>
            {busy ? "Saving..." : isEdit ? "Save Changes" : isDuplicate ? "Create Duplicate" : "Create Monster"}
          </Button>
        </div>
      </form>
    </div>
  );
}
