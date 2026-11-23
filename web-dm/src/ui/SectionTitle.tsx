import type React from "react";
import { SectionTitle as SharedSectionTitle } from "@beholden/shared/ui";

type Props = Omit<React.ComponentProps<typeof SharedSectionTitle>, "fontSize" | "fontWeight" | "marginBottom" | "color"> & { color?: string };

export function SectionTitle({ color = "var(--campaign-accent, #a78bfa)", ...props }: Props) {
  return <SharedSectionTitle {...props} color={color} fontSize="var(--fs-tiny)" fontWeight={700} />;
}
