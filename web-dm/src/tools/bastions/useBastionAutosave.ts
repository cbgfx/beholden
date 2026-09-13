import React from "react";
import { api, jsonInit } from "@/services/api";
import type { Bastion } from "@/tools/bastions/types";
import { normalizeOrder } from "@/tools/bastions/utils";
import { createDraftSaver } from "./draftSaver";

export function savePayloadForBastion(bastion: Bastion) {
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
}


export function useBastionAutosave(args: {
  campaignId: string | null | undefined;
  isOpen: boolean;
  selectedBastion: Bastion | null;
  setSaving: React.Dispatch<React.SetStateAction<boolean>>;
  setMessage: React.Dispatch<React.SetStateAction<string>>;
}) {
  const { campaignId, isOpen, selectedBastion, setSaving, setMessage } = args;
  const [owner] = React.useState(() => createDraftSaver<Bastion>({
    signature: (b) => JSON.stringify(savePayloadForBastion(b)),
    put: (campaign, b) => api(`/api/campaigns/${campaign}/bastions/${b.id}`, jsonInit("PUT", savePayloadForBastion(b))),
    status: (busy, error) => { setSaving(busy); setMessage(error ?? ""); },
  }));
  React.useEffect(() => {
    return () => { owner.flush(); };
  }, [owner, campaignId, isOpen, selectedBastion?.id]);
  const registerLoadedBastions = React.useCallback((rows: Bastion[], version?: number) =>
    campaignId ? owner.merge(campaignId, rows, version) : rows, [owner, campaignId]);
  const acceptRemote = React.useCallback((row: Bastion, version?: number) =>
    campaignId ? owner.accept(campaignId, row, version) : row, [owner, campaignId]);
  const updateDraft = React.useCallback((row: Bastion) => {
    if (campaignId) owner.edit(campaignId, row);
  }, [owner, campaignId]);
  const forget = React.useCallback((id: string) => {
    if (campaignId) owner.forget(campaignId, id);
  }, [owner, campaignId]);
  return { registerLoadedBastions, acceptRemote, updateDraft, forget, retry: owner.retry, readVersion: owner.version };
}
