import { C } from "@/lib/theme";
import type { CharacterAppearance } from "@/views/character/CharacterSheetTypes";
import {
  BACKGROUND_PATTERN_OPTIONS,
  DEFAULT_BACKGROUND_COLOR,
  DEFAULT_PANEL_BACKGROUND_COLOR,
  DEFAULT_TEXT_COLOR,
} from "@/views/character/characterAppearance";
import { Button } from "@/ui/Button";

const themeInputStyle = {
  padding: "10px 12px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(255,255,255,0.05)", color: C.text, font: "inherit", resize: "vertical" as const,
};

function ColorPickerRow(props: {
  label: string;
  value: string | undefined;
  defaultValue: string;
  onChange: (value: string) => void;
  onReset: () => void;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
      <div style={{ fontSize: "var(--fs-tiny)", color: C.muted, textTransform: "uppercase", letterSpacing: "0.08em" }}>{props.label}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {/* The native color-input swatch renders square with no way to restyle
            it directly; oversizing it inside a circular overflow:hidden wrapper
            crops it into the same round swatch used for Sheet color above. */}
        <div style={{ width: 28, height: 28, borderRadius: "50%", overflow: "hidden", border: "2px solid rgba(255,255,255,0.16)", flexShrink: 0 }}>
          <input
            type="color"
            aria-label={props.label}
            value={props.value ?? props.defaultValue}
            onChange={(event) => props.onChange(event.target.value)}
            style={{ width: "160%", height: "160%", margin: "-30%", padding: 0, border: "none", cursor: "pointer" }}
          />
        </div>
        <button
          type="button"
          title="Reset to default"
          aria-label={`Reset ${props.label} to default`}
          onClick={props.onReset}
          style={{ all: "unset", cursor: "pointer", color: C.muted, fontSize: "var(--fs-tiny)", textDecoration: "underline" }}
        >
          Reset
        </button>
      </div>
    </div>
  );
}

export function CharacterThemeDrawer(props: {
  open: boolean;
  accentColor: string;
  colorDraft: string;
  colorPresets: string[];
  appearanceDraft: CharacterAppearance;
  saving: boolean;
  onClose: () => void;
  onSave: () => void | Promise<void>;
  onColorChange: (value: string) => void;
  onAppearanceChange: (value: CharacterAppearance) => void;
}) {
  if (!props.open) return null;
  return (
    <>
      <div
        onClick={props.onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(7,10,18,0.55)",
          zIndex: 70,
        }}
      />
      <div
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          width: "min(560px, 92vw)",
          bottom: 0,
          height: "100dvh",
          maxHeight: "100dvh",
          background: "#11182a",
          borderLeft: "1px solid rgba(255,255,255,0.08)",
          boxShadow: "-16px 0 40px rgba(0,0,0,0.45)",
          zIndex: 71,
          display: "flex",
          flexDirection: "column",
          minHeight: 0,
          overflow: "hidden",
        }}
      >
        <div style={{ padding: "20px 24px", borderBottom: "1px solid rgba(255,255,255,0.08)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <div>
            <div style={{ fontSize: "var(--fs-hero)", fontWeight: 900, color: C.text, marginBottom: 4 }}>Theme</div>
            <div style={{ fontSize: "var(--fs-subtitle)", color: C.muted }}>Sheet color, panel colors, and background.</div>
          </div>
          <Button variant="ghost" onClick={props.onClose}>
            Close
          </Button>
        </div>

        <div style={{ flex: 1, minHeight: 0, overflowY: "auto", WebkitOverflowScrolling: "touch", padding: 24, display: "flex", flexDirection: "column", gap: 24 }}>
          <div>
            <div style={{ padding: "10px 12px", borderRadius: 12, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
              <div style={{ fontSize: "var(--fs-tiny)", color: C.muted, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.08em" }}>Sheet color</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {Array.from(new Set([...props.colorPresets, props.colorDraft])).map((color) => {
                  const selected = props.colorDraft === color;
                  return (
                    <button
                      key={color}
                      type="button"
                      onClick={() => props.onColorChange(color)}
                      title={color}
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: "50%",
                        cursor: "pointer",
                        padding: 0,
                        background: color,
                        border: `2px solid ${selected ? "#ffffff" : "rgba(255,255,255,0.16)"}`,
                        boxShadow: selected ? `0 0 0 3px ${color}66` : "none",
                      }}
                    />
                  );
                })}
              </div>
            </div>
            <div style={{ marginTop: 12, display: "grid", gap: 12, padding: "12px", borderRadius: 12, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
              <ColorPickerRow
                label="Sheet background"
                value={props.appearanceDraft.backgroundColor}
                defaultValue={DEFAULT_BACKGROUND_COLOR}
                onChange={(value) => props.onAppearanceChange({ ...props.appearanceDraft, backgroundColor: value })}
                onReset={() => props.onAppearanceChange({ ...props.appearanceDraft, backgroundColor: undefined })}
              />
              <ColorPickerRow
                label="Panel background"
                value={props.appearanceDraft.panelBackgroundColor}
                defaultValue={DEFAULT_PANEL_BACKGROUND_COLOR}
                onChange={(value) => props.onAppearanceChange({ ...props.appearanceDraft, panelBackgroundColor: value })}
                onReset={() => props.onAppearanceChange({ ...props.appearanceDraft, panelBackgroundColor: undefined })}
              />
              <ColorPickerRow
                label="Text color"
                value={props.appearanceDraft.textColor}
                defaultValue={DEFAULT_TEXT_COLOR}
                onChange={(value) => props.onAppearanceChange({ ...props.appearanceDraft, textColor: value })}
                onReset={() => props.onAppearanceChange({ ...props.appearanceDraft, textColor: undefined })}
              />
              <div>
                <div style={{ fontSize: "var(--fs-tiny)", color: C.muted, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.08em" }}>Background pattern</div>
                <select value={props.appearanceDraft.backgroundPattern ?? "none"} onChange={(event) => props.onAppearanceChange({ ...props.appearanceDraft, backgroundPattern: event.target.value as CharacterAppearance["backgroundPattern"] })} style={{ ...themeInputStyle, width: "100%" }}>
                  {BACKGROUND_PATTERN_OPTIONS.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
                </select>
                <label style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8, alignItems: "center", marginTop: 10, color: C.muted }}>
                  <input aria-label="Background intensity" type="range" min={0} max={100} value={props.appearanceDraft.backgroundIntensity ?? 0} onChange={(event) => props.onAppearanceChange({ ...props.appearanceDraft, backgroundIntensity: Number(event.target.value) })} />
                  <span>{props.appearanceDraft.backgroundIntensity ?? 0}%</span>
                </label>
              </div>
            </div>
          </div>
        </div>

        <div style={{ padding: "24px 24px calc(24px + env(safe-area-inset-bottom, 0px))", borderTop: "1px solid rgba(255,255,255,0.08)", display: "flex", justifyContent: "flex-end", gap: 12, flexShrink: 0 }}>
          <Button variant="ghost" onClick={props.onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={() => void props.onSave()}
            disabled={props.saving}
          >
            {props.saving ? "Saving..." : "Save"}
          </Button>
        </div>
      </div>
    </>
  );
}
