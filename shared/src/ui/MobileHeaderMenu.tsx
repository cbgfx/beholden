import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
  type CSSProperties,
} from "react";
import { createPortal } from "react-dom";
import { useLocation } from "react-router-dom";
import { useUiTranslation } from "../i18n/useUiTranslation";

export const mobileMenuItemStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  minHeight: 44,
  width: "100%",
  boxSizing: "border-box",
  padding: "10px 12px",
  borderRadius: 9,
  border: 0,
  background: "transparent",
  color: "inherit",
  textDecoration: "none",
  textAlign: "left",
  font: "inherit",
  cursor: "pointer",
  overflowWrap: "anywhere",
};

/** One-row mobile chrome with a scrollable, keyboard-accessible navigation sheet. */
export function MobileHeaderMenu(props: {
  brand: ReactNode;
  status?: ReactNode;
  children: (close: () => void) => ReactNode;
  text: string;
  background: string;
  border: string;
  accent: string;
}) {
  const t = useUiTranslation("sharedUi");
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const id = useId();
  const location = useLocation();
  useEffect(() => close(), [location.key, close]);
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const menuTrigger = trigger.current;
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusable = () =>
      [
        ...panel.current!.querySelectorAll<HTMLElement>(
          'a[href],button:not(:disabled),input:not(:disabled),select:not(:disabled),[tabindex="0"]',
        ),
      ].filter((node) => !node.closest("[hidden]"));
    focusable()[0]?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
      }
      if (event.key === "Tab") {
        const nodes = focusable();
        const first = nodes[0];
        const last = nodes.at(-1);
        if (
          event.shiftKey &&
          (document.activeElement === first ||
            !panel.current?.contains(document.activeElement))
        ) {
          event.preventDefault();
          last?.focus();
        } else if (
          !event.shiftKey &&
          (document.activeElement === last ||
            !panel.current?.contains(document.activeElement))
        ) {
          event.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", keydown);
    return () => {
      document.body.style.overflow = oldOverflow;
      document.removeEventListener("keydown", keydown);
      (previous?.isConnected ? previous : menuTrigger)?.focus();
    };
  }, [open, close]);
  return (
    <>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          width: "100%",
          minWidth: 0,
          height: 44,
          color: props.text,
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>{props.brand}</div>
        {props.status}
        <button
          ref={trigger}
          type="button"
          aria-label={t("Open navigation menu")}
          aria-expanded={open}
          aria-controls={id}
          onClick={() => setOpen((value) => !value)}
          style={{
            width: 44,
            height: 44,
            flexShrink: 0,
            display: "grid",
            placeItems: "center",
            borderRadius: 10,
            border: `1px solid ${props.border}`,
            background: "rgba(255,255,255,.04)",
            color: props.accent,
            cursor: "pointer",
          }}
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden="true"
          >
            <path d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      </div>
      {createPortal(
        <div
          hidden={!open}
          style={{
            display: open ? "block" : "none",
            position: "fixed",
            inset: 0,
            zIndex: 10000,
          }}
        >
          <div
            onClick={close}
            style={{
              position: "absolute",
              inset: 0,
              background: "rgba(0,0,0,.6)",
              touchAction: "none",
            }}
          />
          <div
            id={id}
            ref={panel}
            role="dialog"
            aria-modal="true"
            aria-label={t("Navigation")}
            onClick={(event) => {
              if ((event.target as HTMLElement).closest("a[href]")) close();
            }}
            style={{
              position: "absolute",
              inset: "0 0 0 auto",
              width: "min(360px, 100%)",
              boxSizing: "border-box",
              overflowY: "auto",
              overscrollBehavior: "contain",
              padding:
                "max(12px, env(safe-area-inset-top)) 16px max(16px, env(safe-area-inset-bottom))",
              color: props.text,
              background: props.background,
              borderLeft: `1px solid ${props.border}`,
              boxShadow: "-12px 0 40px rgba(0,0,0,.4)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                marginBottom: 14,
              }}
            >
              <strong>{t("Navigation")}</strong>
              <button
                type="button"
                onClick={close}
                aria-label={t("Close navigation menu")}
                style={{
                  ...mobileMenuItemStyle,
                  width: 44,
                  height: 44,
                  justifyContent: "center",
                  fontSize: 24,
                }}
              >
                ×
              </button>
            </div>
            {props.children(close)}
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
