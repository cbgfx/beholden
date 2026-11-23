import type React from "react";
import { theme, withAlpha } from "@/theme/theme";
import { IconButton as SharedIconButton, type IconButtonTheme } from "@beholden/shared/ui/IconButton";

type Props = Omit<React.ComponentProps<typeof SharedIconButton>, keyof IconButtonTheme>;

export function IconButton(props: Props) {
  return <SharedIconButton
    {...props}
    borderColor={theme.colors.panelBorder}
    accentColor={"var(--campaign-accent, #a78bfa)"}
    textColor={theme.colors.text}
    textDarkColor={theme.colors.textDark}
    hoverBackground={withAlpha(theme.colors.panelBorder, 0.30)}
    ghostBackground={withAlpha(theme.colors.panelBorder, 0.12)}
  />;
}
