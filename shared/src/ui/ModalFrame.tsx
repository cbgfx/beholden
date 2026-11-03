import { useUiTranslation } from "../i18n/useUiTranslation";
import React, { useEffect, useId, useRef, useState } from "react";
import { PALETTE, withAlpha } from "./colors";

import { createPortal } from "react-dom";
import { useIsNarrow } from "./useIsNarrow";

const openModals: symbol[] = [];
let previousBodyOverflow = "";

/**
 * Lightweight modal overlay.
 * - Click backdrop or press Escape to close.
 * - Intended for tool-style panels (monster picker, etc.)
 */
export function ModalFrame(props: {
  isOpen: boolean;
  title: React.ReactNode;
  onClose: () => void;
  width?: number;
  height?: number | "auto";
  children: React.ReactNode;
  colors?: {
    scrim: string;
    background: string;
    border: string;
    text: string;
    shadow: string;
  };
}) {
  const colors = props.colors ?? {
    scrim: "rgba(0,0,0,.6)",
    background: PALETTE.bg,
    border: PALETTE.panelBorder,
    text: PALETTE.text,
    shadow: "#000000",
  };
  const translateUi = useUiTranslation("sharedUi");
  const { isOpen, onClose } = props;
  const compact = useIsNarrow("(max-width: 1024px)");
  const dialog = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const closeRef = useRef(onClose);
  const [viewport, setViewport] = useState<{
    width: number;
    height: number;
    top: number;
    left: number;
  } | null>(null);
  useEffect(() => {
    if (!isOpen || !window.visualViewport) return;
    const visual = window.visualViewport;
    const update = () =>
      setViewport({
        width: visual.width,
        height: visual.height,
        top: visual.offsetTop,
        left: visual.offsetLeft,
      });
    update();
    visual.addEventListener("resize", update);
    visual.addEventListener("scroll", update);
    return () => {
      visual.removeEventListener("resize", update);
      visual.removeEventListener("scroll", update);
    };
  }, [isOpen]);
  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);
  useEffect(() => {
    if (!isOpen) return;
    const key = Symbol();
    const trigger = document.activeElement as HTMLElement | null;
    if (!openModals.length) {
      previousBodyOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
    }
    openModals.push(key);
    (
      Array.from(
        dialog.current?.querySelectorAll<HTMLElement>(
          "input, textarea, select",
        ) ?? [],
      ).find((node) => !node.closest("[hidden], details:not([open])")) ??
      dialog.current
    )?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || openModals.at(-1) !== key) return;
      if (event.key === "Escape") {
        event.stopImmediatePropagation();
        closeRef.current();
      }
      if (event.key !== "Tab") return;
      const controls = Array.from(
        dialog.current?.querySelectorAll<HTMLElement>(
          'button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled), a[href], summary, [tabindex="0"]',
        ) ?? [],
      ).filter(
        (node) =>
          !node.closest("[hidden]") &&
          (!node.closest("details:not([open])") || node.tagName === "SUMMARY"),
      );
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (
        event.shiftKey &&
        (document.activeElement === first ||
          document.activeElement === dialog.current)
      ) {
        event.preventDefault();
        last?.focus();
      } else if (
        !event.shiftKey &&
        (document.activeElement === last ||
          document.activeElement === dialog.current)
      ) {
        event.preventDefault();
        first?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      openModals.splice(openModals.indexOf(key), 1);
      if (!openModals.length)
        document.body.style.overflow = previousBodyOverflow;
      trigger?.focus();
    };
  }, [isOpen]);

  if (!props.isOpen) return null;

  return createPortal(
    <div
      style={{
        position: "fixed",
        inset: 0,
        ...(viewport
          ? {
              top: viewport.top,
              left: viewport.left,
              width: viewport.width,
              height: viewport.height,
              bottom: "auto",
              right: "auto",
            }
          : {}),
        zIndex: 2000,
        background: colors.scrim,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: compact
          ? "max(8px, env(safe-area-inset-top)) max(8px, env(safe-area-inset-right)) max(8px, env(safe-area-inset-bottom)) max(8px, env(safe-area-inset-left))"
          : 24,
        boxSizing: "border-box",
      }}
      onMouseDown={(e) => {
        // backdrop close
        if (e.target === e.currentTarget) props.onClose();
      }}
    >
      <div
        ref={dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        style={{
          minWidth: 0,
          minHeight: 0,
          boxSizing: "border-box",
          width: props.width ?? 1100,
          height: props.height === "auto" ? undefined : (props.height ?? 720),
          maxWidth: "100%",
          maxHeight: viewport
            ? Math.max(0, viewport.height - (compact ? 16 : 48))
            : compact
              ? "calc(100dvh - 16px)"
              : "calc(100dvh - 48px)",
          background: colors.background,
          border: `1px solid ${colors.border}`,
          borderRadius: 18,
          boxShadow: `0 24px 70px ${withAlpha(colors.shadow, 0.45)}`,
          overflow: "hidden",
          display: "grid",
          gridTemplateRows: "auto minmax(0, 1fr)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            padding: "12px 14px",
            borderBottom: `1px solid ${colors.border}`,
          }}
        >
          <div
            id={titleId}
            style={{
              fontWeight: 900,
              color: colors.text,
              minWidth: 0,
              overflowWrap: "anywhere",
            }}
          >
            {props.title}
          </div>
          <button
            type="button"
            onClick={props.onClose}
            title={translateUi("Close")}
            aria-label={translateUi("Close")}
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              minWidth: 44,
              minHeight: 44,
              borderRadius: 8,
              border: `1px solid ${colors.border}`,
              background: "transparent",
              color: colors.text,
              cursor: "pointer",
            }}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <path d="m6 6 12 12M18 6 6 18" />
            </svg>
          </button>
        </div>

        <div
          style={{
            overflow: "auto",
            minWidth: 0,
            minHeight: 0,
            overscrollBehavior: "contain",
          }}
        >
          {props.children}
        </div>
      </div>
    </div>,
    document.body,
  );
}
