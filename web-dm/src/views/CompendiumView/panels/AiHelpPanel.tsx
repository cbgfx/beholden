import React from "react";
import { Panel } from "@/ui/Panel";
import { Button } from "@/ui/Button";
import { theme } from "@/theme/theme";
import guideContent from "../../../../../BEHOLDEN_AI_CONTENT_GUIDE.md?raw";

function downloadMd() {
  const blob = new Blob([guideContent], { type: "text/markdown" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "BEHOLDEN_AI_CONTENT_GUIDE.md";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function AiHelpPanel() {
  const [copied, setCopied] = React.useState(false);
  const [previewOpen, setPreviewOpen] = React.useState(false);

  const handleCopy = React.useCallback(async () => {
    await navigator.clipboard.writeText(guideContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, []);

  return (
    <Panel
      title="AI Content Guide"
      style={{ height: "100%", minHeight: 0, display: "flex", flexDirection: "column" }}
      bodyStyle={{ flex: 1, minHeight: 0, overflow: "auto" }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 20, paddingBottom: 8 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, lineHeight: 1.5 }}>
          <p style={{ margin: 0, color: theme.colors.text }}>
            Give this guide to any AI assistant to generate valid Beholden import files — adventures, characters, monsters, items, spells, and more. The guide tells the AI exactly what fields, formats, and rules Beholden expects.
          </p>
          <p style={{ margin: 0, color: theme.colors.muted, fontSize: "var(--fs-small)" }}>
            Start a new AI conversation, paste the guide, then describe what you want to create. The AI will produce JSON you can import directly into Beholden.
          </p>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Button onClick={() => void handleCopy()} variant="primary">
            {copied ? "Copied!" : "Copy to Clipboard"}
          </Button>
          <Button onClick={downloadMd} variant="ghost">
            Download .md
          </Button>
        </div>

        <details
          open={previewOpen}
          onToggle={(e) => setPreviewOpen((e.currentTarget as HTMLDetailsElement).open)}
          style={{
            border: `1px solid ${theme.colors.panelBorder}`,
            borderRadius: 12,
            overflow: "hidden",
            flexShrink: 0,
          }}
        >
          <summary
            style={{
              listStyle: "none",
              cursor: "pointer",
              padding: "10px 12px",
              fontWeight: 800,
              color: theme.colors.text,
              background: theme.colors.panelBg,
              userSelect: "none",
            }}
          >
            {previewOpen ? "Hide guide content" : "Preview guide content"}
          </summary>
          <div style={{ padding: "10px 12px" }}>
            <pre
              style={{
                margin: 0,
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
                fontSize: "var(--fs-small)",
                color: theme.colors.muted,
                fontFamily: "monospace",
                lineHeight: 1.5,
                maxHeight: 480,
                overflowY: "auto",
              }}
            >
              {guideContent}
            </pre>
          </div>
        </details>
      </div>
    </Panel>
  );
}
