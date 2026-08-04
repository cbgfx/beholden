// web-dm/src/app/useBinderActions.ts
// Global refresh (meta + campaigns + binders) plus Binder create/rename/delete handlers and the
// Binder list/modal state they operate on.
import { useCallback, useState } from "react";
import type { Dispatch } from "react";
import { api } from "@/services/api";
import type { Campaign, Meta } from "@/domain/types/domain";
import type { Action } from "@/store/actions";
import type { ConfirmOptions } from "@/confirm/ConfirmContext";
import { createBinder, deleteBinder, fetchBinders, updateBinderIdentity, type BinderSummary } from "@/services/binderApi";

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

export type BinderModalState = { mode: "create" } | { mode: "rename"; binder: BinderSummary } | null;

export function useBinderActions(dispatch: Dispatch<Action>, confirm: ConfirmFn) {
  const [binders, setBinders] = useState<BinderSummary[]>([]);
  const [bindersLoaded, setBindersLoaded] = useState(false);
  const [binderModal, setBinderModal] = useState<BinderModalState>(null);

  const refreshAll = useCallback(async () => {
    const [m, c, binderRows] = await Promise.all([
      api<Meta>("/api/meta"),
      api<Campaign[]>("/api/campaigns"),
      fetchBinders(),
    ]);
    dispatch({ type: "setMeta", meta: m });
    dispatch({ type: "setCampaigns", campaigns: c });
    dispatch({ type: "autoSelectFirstCampaign", campaigns: c });
    setBinders(binderRows);
    setBindersLoaded(true);
  }, [dispatch]);

  const handleCreateBinder = useCallback(async (name: string, color: string, currentDate: number) => {
    const created = await createBinder(name, color, currentDate);
    setBinders((current) => [created, ...current.filter((item) => item.id !== created.id)]);
  }, []);

  const handleEditBinder = useCallback(async (binderId: string, name: string, color: string, currentDate: number) => {
    const updated = await updateBinderIdentity(binderId, name, color, currentDate);
    setBinders((current) => current.map((item) => item.id === updated.id ? updated : item));
  }, []);

  const handleDeleteBinder = useCallback(async (binderId: string) => {
    const binder = binders.find((item) => item.id === binderId);
    if (!binder) return;
    if (!(await confirm({
      title: "Delete Binder",
      message: `Delete “${binder.name}”? Attached campaigns will be kept and detached.`,
      confirmLabel: "Delete Binder",
      intent: "danger",
    }))) return;
    await deleteBinder(binderId);
    setBinders((current) => current.filter((item) => item.id !== binderId));
    await refreshAll();
  }, [binders, confirm, refreshAll]);

  return {
    binders,
    bindersLoaded,
    binderModal,
    setBinderModal,
    refreshAll,
    handleCreateBinder,
    handleEditBinder,
    handleDeleteBinder,
  };
}
