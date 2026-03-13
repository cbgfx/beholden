/**
 * persistence.ts
 *
 * Debounced, crash-safe save scheduler for UserData.
 * Extracted from createServer.ts to keep orchestration slim.
 */

import type { Paths, UserData } from "./context.js";
import { persistCampaignStorageFromUserData } from "../services/campaignStorage.js";

export function createSaveScheduler(
  paths: Paths,
  userData: UserData,
  callbacks?: { onPending?: () => void; onSaved?: () => void }
) {
  let saveTimer: NodeJS.Timeout | null = null;
  let dirty = false;
  let saving = false;

  function flushSave() {
    if (saveTimer) {
      clearTimeout(saveTimer);
      saveTimer = null;
    }

    if (saving) {
      dirty = true;
      return;
    }

    saving = true;
    try {
      persistCampaignStorageFromUserData(paths, userData);
      callbacks?.onSaved?.();
    } finally {
      saving = false;
    }

    if (dirty) {
      dirty = false;
      // Coalesce any additional changes that happened during the write.
      saveTimer = setTimeout(flushSave, 0);
    }
  }

  function scheduleSave() {
    dirty = true;
    if (saveTimer) return;
    callbacks?.onPending?.();
    saveTimer = setTimeout(flushSave, 150);
  }

  return { scheduleSave, flushSave };
}
