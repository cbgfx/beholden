import type { ReactNode } from "react";
import { useIsNarrow } from "../../ui/useIsNarrow";
import { useUiTranslation } from "../../i18n/useUiTranslation";
import { plainPillStyle } from "./compendiumStyle";

/** Keep long filter bars from consuming the compact list's viewport. */
export function BrowserFilters({ children }: { children: ReactNode }) {
  const compact = useIsNarrow("(max-width: 1024px)");
  const translateUi = useUiTranslation("sharedUi");
  if (!compact) return <>{children}</>;
  return <details style={{ minWidth: 0, flexShrink: 0 }}>
    <summary style={{ ...plainPillStyle, minHeight: 44, cursor: "pointer", alignContent: "center" }}>{translateUi("Search and filters")}</summary>
    <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: "40dvh", overflow: "auto", paddingTop: 8 }}>{children}</div>
  </details>;
}
