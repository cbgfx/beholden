import React from "react";
import { api, jsonInit } from "@/services/api";
import type { Bastion } from "@/tools/bastions/types";
import { normalizeOrder } from "@/tools/bastions/utils";

export function useBastionAutosave(args: {
  campaignId: string | null | undefined;
  isOpen: boolean;
  selectedBastion: Bastion | null;
  setSaving: React.Dispatch<React.SetStateAction<boolean>>;
  setMessage: React.Dispatch<React.SetStateAction<string>>;
}) {
  const { campaignId, isOpen, selectedBastion, setSaving, setMessage } = args;
  const autosaveTimerRef = React.useRef<number | null>(null);
  const autosaveInFlightRef = React.useRef(false);
  const queuedAutosaveRef = React.useRef<{ bastion: Bastion; sig: string } | null>(null);
  const savedSignaturesRef = React.useRef<Map<string, string>>(new Map());
  const selectedBastionRef = React.useRef<Bastion | null>(null);

  const savePayloadForBastion = React.useCallback((bastion: Bastion) => {
    return {
      name: bastion.name,
      active: bastion.active,
      walled: bastion.walled,
      defendersArmed: Math.max(0, Math.floor(Number(bastion.defendersArmed ?? 0))),
      defendersUnarmed: Math.max(0, Math.floor(Number(bastion.defendersUnarmed ?? 0))),
      assignedPlayerIds: bastion.assignedPlayerIds,
      assignedCharacterIds: bastion.assignedCharacterIds,
      notes: bastion.notes,
      maintainOrder: bastion.maintainOrder,
      facilities: bastion.facilities.map((facility) => ({
        id: facility.id,
        facilityKey: facility.facilityKey,
        source: facility.source,
        ownerPlayerId: facility.ownerPlayerId,
        order: normalizeOrder(facility.order),
        notes: facility.notes,
      })),
    };
  }, []);

  const saveSignatureForBastion = React.useCallback(
    (bastion: Bastion): string => JSON.stringify(savePayloadForBastion(bastion)),
    [savePayloadForBastion],
  );

  const registerLoadedBastions = React.useCallback(
    (bastions: Bastion[]) => {
      savedSignaturesRef.current = new Map(
        bastions.map((bastion) => [bastion.id, saveSignatureForBastion(bastion)]),
      );
    },
    [saveSignatureForBastion],
  );

  const persistBastion = React.useCallback(
    async (bastion: Bastion, sig: string) => {
      if (!campaignId) return;
      if (autosaveInFlightRef.current) {
        queuedAutosaveRef.current = { bastion, sig };
        return;
      }
      autosaveInFlightRef.current = true;
      setSaving(true);
      setMessage("");
      try {
        await api(
          `/api/campaigns/${campaignId}/bastions/${bastion.id}`,
          jsonInit("PUT", savePayloadForBastion(bastion)),
        );
        savedSignaturesRef.current.set(bastion.id, sig);
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Failed to save Bastion.");
      } finally {
        autosaveInFlightRef.current = false;
        const queued = queuedAutosaveRef.current;
        queuedAutosaveRef.current = null;
        if (queued) {
          void persistBastion(queued.bastion, queued.sig);
        } else {
          setSaving(false);
        }
      }
    },
    [campaignId, savePayloadForBastion, setMessage, setSaving],
  );

  React.useEffect(() => {
    selectedBastionRef.current = selectedBastion;
  }, [selectedBastion]);

  React.useEffect(() => {
    if (!isOpen || !campaignId || !selectedBastion) return;
    const sig = saveSignatureForBastion(selectedBastion);
    if (savedSignaturesRef.current.get(selectedBastion.id) === sig) return;
    if (autosaveTimerRef.current) window.clearTimeout(autosaveTimerRef.current);
    autosaveTimerRef.current = window.setTimeout(() => {
      autosaveTimerRef.current = null;
      void persistBastion(selectedBastion, sig);
    }, 350);
    return () => {
      if (autosaveTimerRef.current) {
        window.clearTimeout(autosaveTimerRef.current);
        autosaveTimerRef.current = null;
      }
    };
  }, [campaignId, isOpen, persistBastion, saveSignatureForBastion, selectedBastion]);

  React.useEffect(() => {
    return () => {
      if (autosaveTimerRef.current) {
        window.clearTimeout(autosaveTimerRef.current);
        autosaveTimerRef.current = null;
      }
      const current = selectedBastionRef.current;
      if (!current) return;
      const sig = saveSignatureForBastion(current);
      if (savedSignaturesRef.current.get(current.id) === sig) return;
      void persistBastion(current, sig);
    };
  }, [persistBastion, saveSignatureForBastion]);

  return {
    registerLoadedBastions,
    persistBastion,
  };
}
