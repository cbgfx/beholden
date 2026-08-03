// web-dm/src/components/iconPicker/EntityIcon.tsx
//
// The only place in the app that should render an Iconify icon directly.
// Deliberately dumb: it knows nothing about Organizations, Positions, POIs,
// or defaults — callers resolve `icon` (falling back to
// entityIconDefaults.getDefaultEntityIcon when null) before passing it in.

import { Icon as IconifyIcon } from "@iconify/react";

export function EntityIcon(props: {
  icon?: string | null;
  size?: number;
  className?: string;
}) {
  const size = props.size ?? 20;

  if (!props.icon) return null;
  return <IconifyIcon icon={props.icon} width={size} height={size} className={props.className} />;
}
