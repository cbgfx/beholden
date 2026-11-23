import type React from "react";
import { C, withAlpha } from "@/lib/theme";
import { IconButton as SharedIconButton, type IconButtonTheme } from "@beholden/shared/ui/IconButton";

type Props = Omit<React.ComponentProps<typeof SharedIconButton>, keyof IconButtonTheme>;

export function IconButton(props: Props) {
  return <SharedIconButton
    {...props}
    borderColor={C.panelBorder}
    accentColor={C.accentHl}
    textColor={C.text}
    textDarkColor={C.textDark}
    hoverBackground={withAlpha(C.panelBorder, 0.30)}
    ghostBackground={withAlpha(C.panelBorder, 0.12)}
  />;
}
