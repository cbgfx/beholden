import { InfoPageLayout as SharedInfoPageLayout } from "@beholden/shared/ui";
import { C } from "@/lib/theme";
import React from "react";

export function InfoPageLayout(props: { title: string; children: React.ReactNode }) {
  return <SharedInfoPageLayout {...props} color={C.text} />;
}
