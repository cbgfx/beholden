import React from "react";
import { C } from "@/lib/theme";
import type { PreparedSpellProgressionTable } from "@/types/preparedSpellProgression";
import { parseSkillList } from "../utils/CharacterCreatorUtils";
import { NavButtons } from "../shared/CharacterCreatorParts";
import { collectPreparedSpellProgressionTables } from "./CharacterCreatorPanelHelpers";
import {
  detailBoxStyle,
  headingStyle,
  inputStyle,
  statLabelStyle,
  statValueStyle,
} from "../shared/CharacterCreatorStyles";
import { PreparedSpellProgressionBlock } from "@/views/character/CharacterViewParts";

interface ClassSummaryLike {
  id: string;
  name: string;
  hd: number | null;
}

interface ClassDetailLike {
  name: string;
  hd: number | null;
  numSkills: number;
  proficiency: string;
  slotsReset: string;
  armor: string;
  weapons: string;
  description: string;
  primaryAbility?: string | { any?: string[]; all?: string[] } | null;
  autolevels: Array<{
    level: number;
    features: Array<{ name: string; text: string; optional: boolean; preparedSpellProgression?: PreparedSpellProgressionTable[] }>;
  }>;
}

function getPrimaryAbilityKeys(classDetail: ClassDetailLike | null): string[] {
  if (!classDetail) return [];
  const fact = classDetail.primaryAbility;
  if (typeof fact === "string") return [fact];
  return fact?.any ?? fact?.all ?? [];
}

export function renderClassStep({
  classes,
  classSearch,
  setClassSearch,
  form,
  onSelectClass,
  onNext,
  classDetail,
  abilityLabels,
}: {
  classes: ClassSummaryLike[];
  classSearch: string;
  setClassSearch: (value: string) => void;
  form: { classId: string };
  onSelectClass: (id: string) => void;
  onNext: () => void;
  classDetail: ClassDetailLike | null;
  abilityLabels: Record<string, string>;
}): { main: React.ReactNode; side: React.ReactNode } {
  const classPreparedSpellProgression = classDetail
    ? collectPreparedSpellProgressionTables(
        classDetail.autolevels.flatMap((autolevel) =>
          autolevel.features.filter((feature) => !feature.optional)
        )
      )
    : [];
  const filtered = classSearch
    ? classes.filter((c) => c.name.toLowerCase().includes(classSearch.toLowerCase()))
    : classes;

  const main = (
    <div>
      <h2 style={headingStyle}>Choose a Class</h2>

      {classes.length === 0 ? (
        <p style={{ color: C.muted }}>No classes found. Ask your DM to upload a class compendium XML.</p>
      ) : (
        <>
          <input
            value={classSearch}
            onChange={(e) => setClassSearch(e.target.value)}
            placeholder="Search classes…"
            style={{ ...inputStyle, width: "100%", marginBottom: 12 }}
          />
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 6,
              maxHeight: 340,
              overflowY: "auto",
              paddingRight: 4,
              marginBottom: 4,
            }}
          >
            {filtered.length === 0 && <p style={{ color: C.muted, gridColumn: "1 / -1" }}>No matches.</p>}
            {filtered.map((c) => {
              const sel = form.classId === c.id;
              return (
                <button
                  type="button"
                  key={c.id}
                  onClick={() => onSelectClass(c.id)}
                  style={{
                    padding: "10px 13px",
                    borderRadius: 8,
                    textAlign: "left",
                    border: `2px solid ${sel ? C.accentHl : "rgba(255,255,255,0.12)"}`,
                    background: sel ? "rgba(56,182,255,0.15)" : "rgba(255,255,255,0.055)",
                    color: sel ? C.accentHl : C.text,
                    cursor: "pointer",
                    fontWeight: sel ? 700 : 500,
                    fontSize: "var(--fs-subtitle)",
                    transition: "border-color 0.12s, background 0.12s",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {c.name}
                  {c.hd && <span style={{ color: "rgba(160,180,220,0.5)", fontSize: "var(--fs-small)", marginLeft: 6 }}>d{c.hd}</span>}
                </button>
              );
            })}
          </div>
        </>
      )}

      <NavButtons step={1} onBack={() => {}} onNext={onNext} nextDisabled={!form.classId} />
    </div>
  );

  const side = classDetail ? (
    <div style={detailBoxStyle}>
      <div style={{ fontWeight: 700, fontSize: "var(--fs-body)", color: C.accentHl, marginBottom: 12 }}>{classDetail.name}</div>
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 12 }}>
        {classDetail.hd && (
          <div>
            <div style={statLabelStyle}>Hit Die</div>
            <div style={statValueStyle}>d{classDetail.hd}</div>
          </div>
        )}
        {(() => {
          const keys = getPrimaryAbilityKeys(classDetail);
          return keys.length > 0 ? (
            <div>
              <div style={statLabelStyle}>Primary</div>
              <div style={statValueStyle}>{keys.map((k) => abilityLabels[k]).join(" / ")}</div>
            </div>
          ) : null;
        })()}
        {classDetail.slotsReset && (
          <div>
            <div style={statLabelStyle}>Spell Reset</div>
            <div style={statValueStyle}>
              {classDetail.slotsReset === "L" ? "Long Rest" : classDetail.slotsReset === "S" ? "Short Rest" : classDetail.slotsReset}
            </div>
          </div>
        )}
      </div>
      {classDetail.armor && (
        <div style={{ marginBottom: 6 }}>
          <span style={{ color: C.muted, fontSize: "var(--fs-small)", fontWeight: 600 }}>Armor </span>
          <span style={{ fontSize: "var(--fs-small)" }}>{classDetail.armor}</span>
        </div>
      )}
      {classDetail.weapons && (
        <div style={{ marginBottom: 6 }}>
          <span style={{ color: C.muted, fontSize: "var(--fs-small)", fontWeight: 600 }}>Weapons </span>
          <span style={{ fontSize: "var(--fs-small)" }}>{classDetail.weapons}</span>
        </div>
      )}
      {classDetail.numSkills > 0 && (
        <div style={{ marginBottom: 10 }}>
          <span style={{ color: C.muted, fontSize: "var(--fs-small)", fontWeight: 600 }}>Skills </span>
          <span style={{ fontSize: "var(--fs-small)" }}>Choose {classDetail.numSkills} from: {parseSkillList(classDetail.proficiency).join(", ")}</span>
        </div>
      )}
      {classDetail.description && (
        <div style={{ color: "rgba(160,180,220,0.65)", fontSize: "var(--fs-small)", lineHeight: 1.6, marginTop: 8, borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: 8 }}>
          {classDetail.description.slice(0, 500)}
          {classDetail.description.length > 500 ? "…" : ""}
        </div>
      )}
      {classPreparedSpellProgression.length > 0 && (
        <div style={{ marginTop: 12, borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: 10 }}>
          <div style={{ color: C.muted, fontSize: "var(--fs-small)", fontWeight: 700, marginBottom: 8 }}>Prepared Spell Progression</div>
          <PreparedSpellProgressionBlock tables={classPreparedSpellProgression} compact accentColor={C.accentHl} />
        </div>
      )}
    </div>
  ) : (
    <div style={{ color: C.muted, fontSize: "var(--fs-subtitle)", padding: "12px 0" }}>Select a class to see its details.</div>
  );

  return { main, side };
}
