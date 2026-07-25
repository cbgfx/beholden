import { C } from "@/lib/theme";
import { ChoiceBtn, Section } from "@/views/level-up/LevelUpParts";
import { cleanFeatureText } from "@/views/level-up/LevelUpHelpers";

type SubclassOverview = { name: string; text: string } | null;
type FeatureLike = { name: string; text: string };

export function LevelUpSubclassSection(props: {
  show: boolean;
  nextLevel: number;
  accentColor: string;
  subclass: string;
  subclassOptions: string[];
  subclassOverview: SubclassOverview;
  selectedSubclassFeatures: FeatureLike[];
  onSelectSubclass: (value: string) => void;
}) {
  if (!props.show) return null;
  return (
    <Section title={`Subclass at Level ${props.nextLevel}`} accent={props.accentColor}>
      <div style={{ fontSize: "var(--fs-small)", color: C.muted, marginBottom: 12 }}>
        {props.subclass.trim() ? "Subclass selected. You can change it before confirming level-up." : "Choose your subclass."}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 14, alignItems: "start" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 8 }}>
          {props.subclassOptions.map((option) => (
            <ChoiceBtn key={option} active={props.subclass === option} onClick={() => props.onSelectSubclass(option)}>
              {option}
            </ChoiceBtn>
          ))}
        </div>
        <div
          style={{
            padding: "12px 14px",
            borderRadius: 10,
            border: "1px solid rgba(255,255,255,0.08)",
            background: "rgba(255,255,255,0.03)",
            minHeight: 120,
          }}
        >
          {props.subclassOverview ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <div style={{ fontSize: "var(--fs-large)", fontWeight: 900, color: "#fff", marginBottom: 6 }}>
                  {props.subclass}
                </div>
                <div style={{ fontSize: "var(--fs-small)", color: C.muted, lineHeight: 1.65, whiteSpace: "pre-wrap" }}>
                  {cleanFeatureText(props.subclassOverview.text)}
                </div>
              </div>
              {props.selectedSubclassFeatures.length > 0 ? (
                <div>
                  <div
                    style={{
                      fontSize: "var(--fs-tiny)",
                      color: props.accentColor,
                      fontWeight: 800,
                      textTransform: "uppercase",
                      letterSpacing: 0.8,
                      marginBottom: 8,
                    }}
                  >
                    Features Gained Now
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {props.selectedSubclassFeatures.map((feature) => (
                      <div key={feature.name}>
                        <div style={{ fontSize: "var(--fs-body)", color: "#fff", fontWeight: 800, marginBottom: 4 }}>
                          {feature.name}
                        </div>
                        <div style={{ fontSize: "var(--fs-small)", color: C.muted, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
                          {cleanFeatureText(feature.text)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ) : (
            <div style={{ fontSize: "var(--fs-small)", color: C.muted, lineHeight: 1.6 }}>
              Pick a subclass to see its description and the features you gain at this level.
            </div>
          )}
        </div>
      </div>
    </Section>
  );
}
