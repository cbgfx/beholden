import { InfoPageLayout as SharedInfoPageLayout } from "@beholden/shared/ui";
import { theme } from "@/theme/theme";
import React from "react";

export function InfoPageLayout(props: { title: string; children: React.ReactNode }) {
  return <SharedInfoPageLayout {...props} color={theme.colors.text} />;
}
