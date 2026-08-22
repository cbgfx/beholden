import * as React from "react";
import { theme, withAlpha } from "@/theme";
import { Button } from "@/ui/Button";

type State = { error: Error | null };

const DYNAMIC_IMPORT_RELOAD_KEY = "beholden:dm:dynamic-import-reload";
const DYNAMIC_IMPORT_RELOAD_WINDOW_MS = 10 * 60 * 1000;

function isDynamicImportError(error: Error): boolean {
  const message = `${error.name} ${error.message}`.toLowerCase();
  return (
    message.includes("dynamically imported module")
    || message.includes("failed to fetch dynamically imported module")
    || message.includes("loading chunk")
    || message.includes("importing a module script failed")
  );
}

function shouldReloadForDynamicImportError(error: Error): boolean {
  if (typeof window === "undefined" || !isDynamicImportError(error)) return false;

  const now = Date.now();
  const lastReload = Number(window.sessionStorage.getItem(DYNAMIC_IMPORT_RELOAD_KEY) ?? "0");
  if (Number.isFinite(lastReload) && now - lastReload < DYNAMIC_IMPORT_RELOAD_WINDOW_MS) return false;

  window.sessionStorage.setItem(DYNAMIC_IMPORT_RELOAD_KEY, String(now));
  return true;
}

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
    console.error("Beholden render error:", error);
    if (shouldReloadForDynamicImportError(error)) {
      window.location.reload();
    }
  }

  render() {
    if (!this.state.error) return this.props.children;
    const dynamicImportError = isDynamicImportError(this.state.error);

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
          <div style={{ fontWeight: 900, color: theme.colors.red, fontSize: "var(--fs-title)", marginBottom: 10 }}>
            Something crashed.
          </div>
          <div style={{ color: theme.colors.text, opacity: 0.9, marginBottom: 10 }}>
            {dynamicImportError
              ? "The app could not load one of its JavaScript files. This usually means the page is from an older deploy."
              : "Open DevTools -> Console for the full stack trace."}
          </div>
          {dynamicImportError ? (
            <div style={{ marginBottom: 12 }}>
              <Button type="button" variant="danger" onClick={() => window.location.reload()}>
                Reload app
              </Button>
            </div>
          ) : null}
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
