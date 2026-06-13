import React from "react";
import { C } from "@/lib/theme";
import { LEVEL_LABELS } from "@/views/character/CharacterSpellShared";
import { Section } from "@/views/level-up/LevelUpParts";

type FeatureLike = { name: string; text: string };

export function LevelUpFeaturesSection(props: {
  nextLevel: number;
  accentColor: string;
  newFeatures: FeatureLike[];
  expandedFeatures: string[];
  onToggleFeature: (key: string) => void;
}) {
  if (props.newFeatures.length === 0) return null;
  return (
    <Section title={`New Features at Level ${props.nextLevel}`} accent={props.accentColor}>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {props.newFeatures.map((feature) => {
          const key = feature.name;
          const expanded = props.expandedFeatures.includes(key);
          return (
            <div
              key={key}
              style={{
                borderRadius: 8,
                border: "1px solid rgba(255,255,255,0.08)",
                background: "rgba(255,255,255,0.03)",
                overflow: "hidden",
              }}
            >
              <button
                onClick={() => props.onToggleFeature(key)}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "10px 12px",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: C.text,
                  fontWeight: 700,
                  fontSize: "var(--fs-subtitle)",
                  textAlign: "left",
                }}
              >
                <span>{feature.name}</span>
                <span style={{ color: C.muted, fontSize: "var(--fs-small)" }}>{expanded ? "▲" : "▼"}</span>
              </button>
              {expanded ? (
                <div
                  style={{
                    padding: "0 12px 12px",
                    fontSize: "var(--fs-small)",
                    color: C.muted,
                    lineHeight: 1.6,
                    whiteSpace: "pre-wrap",
                  }}
                >
                  {feature.text}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </Section>
  );
}

export function LevelUpSpellSlotsSection(props: {
  nextLevel: number;
  accentColor: string;
  newSlots: number[] | null;
}) {
  if (!props.newSlots || !props.newSlots.some((s, i) => i > 0 && s > 0)) return null;
  return (
    <Section title={`Spell Slots at Level ${props.nextLevel}`} accent={props.accentColor}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {props.newSlots.map((count, i) => {
          if (count === 0) return null;
          return (
            <div
              key={i}
              style={{
                padding: "6px 12px",
                borderRadius: 8,
                border: "1px solid rgba(255,255,255,0.1)",
                background: "rgba(255,255,255,0.04)",
                textAlign: "center",
              }}
            >
              <div style={{ fontSize: "var(--fs-tiny)", color: C.muted }}>{LEVEL_LABELS[i] ?? `L${i}`}</div>
              <div style={{ fontWeight: 800, fontSize: "var(--fs-body)", color: props.accentColor }}>{count}</div>
            </div>
          );
        })}
      </div>
    </Section>
  );
}
