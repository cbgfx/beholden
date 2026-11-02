import * as React from "react";
import { normalizeDescriptionText } from "../../domain/text/normalizeDescriptionText";
import { COMPENDIUM_COLORS as C } from "./compendiumStyle";

/**
 * Building blocks for the spell and item detail columns: a title header, a grid of labelled
 * facts, then the description as the main reading text. The description is what people open an
 * entry for, so it gets the largest body type and the facts above it stay short and scannable.
 */

/** Book-style serif for entry names only; body text keeps the app font. */
const TITLE_FONT = `Georgia, "Iowan Old Style", "Palatino Linotype", "Book Antiqua", serif`;

/** Small uppercase label used above every fact and section. */
const labelStyle: React.CSSProperties = {
  color: C.sectionTitle,
  fontSize: "var(--fs-small)",
  fontWeight: 700,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
};

const divider = <hr style={{ border: 0, borderTop: `1px solid ${C.panelBorder}`, margin: 0 }} />;

export function DetailHeader(props: { name: string; subtitle?: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <header style={{ display: "grid", gap: 6 }}>
      <h2 style={{ margin: 0, fontFamily: TITLE_FONT, fontSize: "var(--fs-hero)", fontWeight: 700, lineHeight: 1.15, overflowWrap: "anywhere" }}>
        {props.name}
      </h2>
      {props.subtitle || props.aside ? (
        <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
          {props.subtitle ? <span style={{ fontFamily: TITLE_FONT, fontStyle: "italic", color: C.muted, fontSize: "var(--fs-large)" }}>{props.subtitle}</span> : null}
          {props.aside}
        </div>
      ) : null}
    </header>
  );
}

export type DetailFact = { label: string; value: React.ReactNode; note?: React.ReactNode };

/** Facts laid out in as many columns as fit; empty values are left out by the caller. */
export function DetailFacts(props: { facts: DetailFact[] }) {
  if (!props.facts.length) return null;
  return (
    <>
      {divider}
      <dl style={{ margin: 0, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "16px 24px" }}>
        {props.facts.map((fact) => (
          <div key={fact.label} style={{ display: "grid", gap: 4, alignContent: "start", minWidth: 0 }}>
            <dt style={labelStyle}>{fact.label}</dt>
            <dd style={{ margin: 0, fontSize: "var(--fs-large)", overflowWrap: "anywhere" }}>
              {fact.value}
              {fact.note ? <div style={{ marginTop: 2, color: C.muted, fontSize: "var(--fs-small)" }}>{fact.note}</div> : null}
            </dd>
          </div>
        ))}
      </dl>
      {divider}
    </>
  );
}

// A paragraph that opens with a short Title Case heading, e.g. "At Higher Levels." or
// "Cantrip Upgrade:". Lower-case joining words are allowed so "Using a Higher-Level Spell Slot"
// counts, but every other word must be capitalised, which keeps ordinary first sentences out.
const LEAD_IN = /^((?:[A-Z][\w'’-]*)(?: (?:[A-Z][\w'’-]*|a|an|and|at|by|for|in|of|on|or|the|to|with)){0,6})([.:])\s+/u;

/** The description, split into paragraphs with any lead-in heading in bold. */
export function DetailProse(props: { label: string; paragraphs: string[]; empty: string }) {
  return (
    <section style={{ display: "grid", gap: 8 }}>
      <div style={labelStyle}>{props.label}</div>
      {props.paragraphs.length ? (
        <div style={{ display: "grid", gap: "0.9em", fontSize: "var(--fs-large)", lineHeight: 1.6, maxWidth: "80ch" }}>
          {props.paragraphs.map((paragraph, index) => {
            const lead = LEAD_IN.exec(paragraph);
            return (
              <p key={index} style={{ margin: 0, whiteSpace: "pre-wrap" }}>
                {lead ? <><strong>{lead[1]}{lead[2]}</strong> {paragraph.slice(lead[0].length)}</> : paragraph}
              </p>
            );
          })}
        </div>
      ) : (
        <span style={{ color: C.muted }}>{props.empty}</span>
      )}
    </section>
  );
}

/** Muted closing line (source, ruleset). */
export function DetailFooter(props: { children: React.ReactNode }) {
  return <div style={{ color: C.muted, fontSize: "var(--fs-small)" }}>{props.children}</div>;
}

/** Scrollable column that holds the whole entry, so long descriptions scroll with their header. */
export function DetailBody(props: { children: React.ReactNode }) {
  return <article style={{ display: "grid", gap: 18, alignContent: "start", padding: "6px 4px 12px" }}>{props.children}</article>;
}

/**
 * Splits compendium text into paragraphs and pulls a closing "Source: …" paragraph out, so it can
 * sit in the footer instead of reading as part of the rules.
 */
export function splitDescription(text: string | string[] | null | undefined): { paragraphs: string[]; source: string | null } {
  const paragraphs = normalizeDescriptionText(text).split(/\n{2,}/u).map((part) => part.trim()).filter(Boolean);
  const last = paragraphs[paragraphs.length - 1];
  const source = last ? /^Source:\s*(.+)$/su.exec(last)?.[1].replace(/\s+/gu, " ").trim() ?? null : null;
  return { paragraphs: source ? paragraphs.slice(0, -1) : paragraphs, source };
}
