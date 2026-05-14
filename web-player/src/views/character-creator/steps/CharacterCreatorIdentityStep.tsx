import React from "react";
import { Select } from "@/ui/Select";
import { C } from "@/lib/theme";
import { NavButtons } from "../shared/CharacterCreatorParts";
import { headingStyle, inputStyle, labelStyle } from "../shared/CharacterCreatorStyles";

export function renderIdentityStep({
  form,
  setField,
  portraitInputRef,
  portraitPreview,
  setPortraitFile,
  setPortraitPreview,
  onBack,
  onNext,
  side,
}: {
  form: Record<string, unknown> & { [key: string]: unknown };
  setField: (key: string, value: string) => void;
  portraitInputRef: React.RefObject<HTMLInputElement | null>;
  portraitPreview: string | null;
  setPortraitFile: (file: File | null) => void;
  setPortraitPreview: (value: string | null) => void;
  onBack: () => void;
  onNext: () => void;
  side: React.ReactNode;
}): { main: React.ReactNode; side: React.ReactNode } {
  const colors = [C.accentHl, C.green, C.accent, C.red, C.colorMagic, C.colorOrange, "#e879f9", "#94a3b8"];
  const ALIGNMENTS = [
    "", "Lawful Good", "Neutral Good", "Chaotic Good",
    "Lawful Neutral", "True Neutral", "Chaotic Neutral",
    "Lawful Evil", "Neutral Evil", "Chaotic Evil",
  ];
  const detailFields: Array<{ key: string; label: string; placeholder: string }> = [
    { key: "hair", label: "Hair", placeholder: "Black, braided" },
    { key: "skin", label: "Skin", placeholder: "Tan, scarred" },
    { key: "heightText", label: "Height", placeholder: "6'2\"" },
    { key: "age", label: "Age", placeholder: "32" },
    { key: "weight", label: "Weight", placeholder: "190 lb" },
    { key: "gender", label: "Gender", placeholder: "Female" },
  ];

  function handlePortraitChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setPortraitFile(file);
    const url = URL.createObjectURL(file);
    setPortraitPreview(url);
  }

  const main = (
    <div>
      <h2 style={headingStyle}>Character Identity</h2>
      <div style={{ display: "flex", gap: 24, flexWrap: "wrap", alignItems: "flex-start" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
          <input ref={portraitInputRef as React.RefObject<HTMLInputElement>} type="file" accept="image/*" onChange={handlePortraitChange} style={{ display: "none" }} />
          <div
            onClick={() => portraitInputRef.current?.click()}
            style={{
              width: 110,
              height: 110,
              borderRadius: 12,
              cursor: "pointer",
              border: `2px dashed ${portraitPreview ? C.accentHl : "rgba(255,255,255,0.25)"}`,
              background: portraitPreview ? "#000" : "rgba(255,255,255,0.04)",
              overflow: "hidden",
              position: "relative",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
            title="Click to set portrait"
          >
            {portraitPreview ? (
              <img src={portraitPreview} alt="Portrait" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            ) : (
              <div style={{ opacity: 0.3 }}>Portrait</div>
            )}
            <div
              style={{
                position: "absolute",
                inset: 0,
                background: "rgba(0,0,0,0)",
                display: "flex",
                alignItems: "flex-end",
                justifyContent: "center",
                paddingBottom: 6,
              }}
            >
              <span style={{ fontSize: "var(--fs-tiny)", color: "rgba(255,255,255,0.55)", background: "rgba(0,0,0,0.55)", padding: "2px 6px", borderRadius: 4 }}>
                {portraitPreview ? "Change" : "Add photo"}
              </span>
            </div>
          </div>
          {portraitPreview && (
            <button type="button" onClick={() => { setPortraitFile(null); setPortraitPreview(null); }} style={{ fontSize: "var(--fs-small)", color: C.muted, background: "none", border: "none", cursor: "pointer" }}>
              Remove
            </button>
          )}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14, flex: 1, minWidth: 220 }}>
          <div>
            <label style={labelStyle}>Character Name *</label>
            <input
              value={String(form.characterName ?? "")}
              onChange={(e) => setField("characterName", e.target.value)}
              placeholder="Thraxil the Destroyer"
              style={{ ...inputStyle, width: "100%" }}
            />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
            <div>
              <label style={labelStyle}>Alignment</label>
              <Select
                value={String(form.alignment ?? "")}
                onChange={(e) => setField("alignment", e.target.value)}
                style={{ width: "100%" }}
              >
                {ALIGNMENTS.map((a) => (
                  <option key={a} value={a}>{a || "— select —"}</option>
                ))}
              </Select>
            </div>
            {detailFields.map(({ key, label, placeholder }) => (
              <div key={key}>
                <label style={labelStyle}>{label}</label>
                <input
                  value={String(form[key] ?? "")}
                  onChange={(e) => setField(key, e.target.value)}
                  placeholder={placeholder}
                  style={{ ...inputStyle, width: "100%" }}
                />
              </div>
            ))}
          </div>
          <div>
            <label style={labelStyle}>Color</label>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {colors.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setField("color", c)}
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: "50%",
                    background: c,
                    border: `3px solid ${form.color === c ? C.text : "transparent"}`,
                    cursor: "pointer",
                    padding: 0,
                    boxShadow: form.color === c ? `0 0 0 1px ${c}` : "none",
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
      <NavButtons step={9} onBack={onBack} onNext={onNext} nextDisabled={!String(form.characterName ?? "").trim()} />
    </div>
  );

  return { main, side };
}
