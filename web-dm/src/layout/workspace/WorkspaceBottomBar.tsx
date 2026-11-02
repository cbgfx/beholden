import { createContext, useContext, useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";

export const WorkspaceNavigationContext = createContext<{
  target: HTMLDivElement | null;
  setActive: (active: boolean) => void;
} | null>(null);
export function WorkspaceBottomBar({ children }: { children: ReactNode }) {
  const slot = useContext(WorkspaceNavigationContext);
  useEffect(() => {
    slot?.setActive(true);
    return () => slot?.setActive(false);
  }, [slot]);
  return slot?.target ? (
    createPortal(children, slot.target)
  ) : (
    <div style={{ position: "sticky", bottom: 0 }}>{children}</div>
  );
}
