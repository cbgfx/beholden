import { Icon } from "@iconify/react";

export function GameIcon({ icon, size = 16 }: { icon: string; size?: number }) {
  return <Icon icon={icon} width={size} height={size} aria-hidden />;
}
