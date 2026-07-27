// web-dm/src/components/iconPicker/EntityIcon.tsx
//
// The only place in the app that should render an Iconify icon directly.
// Deliberately dumb: it knows nothing about Organizations, Positions, POIs,
// or defaults — callers resolve `icon` (falling back to
// entityIconDefaults.getDefaultEntityIcon when null) before passing it in.

import { Icon as IconifyIcon } from "@iconify/react";
import { useGameIconsReady } from "./gameIconsCollection";

export function EntityIcon(props: {
  icon?: string | null;
  size?: number;
  className?: string;
}) {
  const ready = useGameIconsReady();
  const size = props.size ?? 20;

  if (!props.icon) return null;
  // Render an inert placeholder of the same footprint until the offline
  // collection is registered, rather than letting Iconify attempt a network fetch.
  if (!ready) {
    return <span aria-hidden className={props.className} style={{ display: "inline-block", width: size, height: size }} />;
  }
  return <IconifyIcon icon={props.icon} width={size} height={size} className={props.className} />;
}
