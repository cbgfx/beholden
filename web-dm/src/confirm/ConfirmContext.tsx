import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";

import { ConfirmDialog } from "@/components/overlay/ConfirmDialog";

export type ConfirmOptions = {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Visual intent only (no behavior). */
  intent?: "danger" | "default";
};

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext);
  // Safety fallback:
  // If something is rendered outside <ConfirmProvider /> (or the provider fails to mount)
  // we still want destructive actions to work instead of silently doing nothing.
  // This mirrors the old window.confirm behaviour.
  if (!ctx) {
    return async ({ title, message }) => {
      const prompt = message?.trim() ? message : title;
      return window.confirm(prompt);
    };
  }
  return ctx;
}

type Pending = {
  resolve: (value: boolean) => void;
};

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const pendingRef = useRef<Pending | null>(null);
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<ConfirmOptions>({
    title: "Confirm",
    message: "Are you sure?",
    confirmLabel: "Delete",
    cancelLabel: "Cancel",
    intent: "danger",
  });

  const confirm = useCallback<ConfirmFn>((opts: ConfirmOptions) => {
    // If a confirm is already open, resolve it as cancelled.
    if (pendingRef.current) {
      pendingRef.current.resolve(false);
      pendingRef.current = null;
    }

    setOptions({
      title: opts.title ?? "Confirm",
      message: opts.message,
      confirmLabel: opts.confirmLabel ?? "Delete",
      cancelLabel: opts.cancelLabel ?? "Cancel",
      intent: opts.intent ?? "danger",
    });
    setOpen(true);

    return new Promise<boolean>((resolve) => {
      pendingRef.current = { resolve };
    });
  }, []);

  const closeWith = useCallback((value: boolean) => {
    setOpen(false);
    const pending = pendingRef.current;
    pendingRef.current = null;
    pending?.resolve(value);
  }, []);

  const value = useMemo(() => confirm, [confirm]);

  return (
    <ConfirmContext.Provider value={value}>
      {children}
      <ConfirmDialog
        open={open}
        title={options.title ?? "Confirm"}
        message={options.message}
        confirmLabel={options.confirmLabel ?? "Delete"}
        cancelLabel={options.cancelLabel ?? "Cancel"}
        intent={options.intent ?? "danger"}
        onConfirm={() => closeWith(true)}
        onCancel={() => closeWith(false)}
      />
    </ConfirmContext.Provider>
  );
}
