import type { ComponentProps } from "react";
import { ModalFrame } from "@beholden/shared/ui/ModalFrame";
import { theme } from "@/theme/theme";

const modalColors = {
  scrim: theme.colors.scrim,
  background: theme.colors.modalBg,
  border: theme.colors.panelBorder,
  text: theme.colors.text,
  shadow: theme.colors.shadowColor,
};

/** DM theme adapter; positioning, keyboard and focus behavior live in shared. */
export function Modal(
  props: Omit<ComponentProps<typeof ModalFrame>, "colors">,
) {
  return <ModalFrame {...props} colors={modalColors} />;
}
