import { useEffect, useState } from "react";
import { addCollection, Icon } from "@iconify/react";

let ready = false;
let loading: Promise<void> | null = null;

function loadCollection() {
  if (ready) return Promise.resolve();
  loading ??= import("@iconify-json/game-icons").then((module) => {
    addCollection(module.icons);
    ready = true;
  });
  return loading;
}

export function GameIcon({ icon, size = 16 }: { icon: string; size?: number }) {
  const [loaded, setLoaded] = useState(ready);
  useEffect(() => { if (!ready) void loadCollection().then(() => setLoaded(true)); }, []);
  return loaded ? <Icon icon={icon} width={size} height={size} aria-hidden /> : <span aria-hidden style={{ display: "inline-block", width: size, height: size }} />;
}
