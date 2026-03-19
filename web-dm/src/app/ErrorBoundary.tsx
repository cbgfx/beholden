import * as React from "react";
import { theme, withAlpha } from "@/theme";

type State = { error: Error | null };

/**
 * Prevents "blank screen" when something throws at render-time.
 * This is intentionally minimal and DM-friendly.
 */
export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  State
> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error) {
    // Keep a breadcrumb in the dev console.
    // eslint-disable-next-line no-console
    console.error("Beholden render error:", error);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div style={{ minHeight: "100vh", background: theme.colors.bg, padding: 24 }}>
        <div
          style={{
            maxWidth: 900,
            margin: "0 auto",
            borderRadius: 16,
            border: `1px solid ${theme.colors.panelBorder}`,
            background: withAlpha(theme.colors.shadowColor, 0.18),
            padding: 18
          }}
        >
          <div style={{ fontWeight: 900, color: theme.colors.red, fontSize: 18, marginBottom: 10 }}>
            Something crashed.
          </div>
          <div style={{ color: theme.colors.text, opacity: 0.9, marginBottom: 10 }}>
            Open DevTools → Console for the full stack trace.
          </div>
          <pre
            style={{
              margin: 0,
              padding: 12,
              borderRadius: 12,
              overflow: "auto",
              background: withAlpha(theme.colors.shadowColor, 0.22),
              border: `1px solid ${theme.colors.panelBorder}`,
              color: theme.colors.text
            }}
          >
            {this.state.error.message}
          </pre>
        </div>
      </div>
    );
  }
}
