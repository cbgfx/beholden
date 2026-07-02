import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/services/api";
import { useWs, useWsStatus } from "@/services/ws";

type ActiveBastion = { id: string; name: string; campaignId: string };
type InitiativePrompt = { encounterId: string; combatantId: string };

export function useCharacterLiveUpdates(
  characterId: string | undefined,
  onXpAwarded: () => void,
  setConcentrationAlert: (alert: { dc: number } | null) => void,
) {
  const [activeBastion, setActiveBastion] = useState<ActiveBastion | null>(null);
  const [initiativePrompt, setInitiativePrompt] = useState<InitiativePrompt | null>(null);
  const connected = useWsStatus();
  const mountedRef = useRef(true);
  const characterIdRef = useRef(characterId);
  characterIdRef.current = characterId;

  useEffect(() => {
    setActiveBastion(null);
    setInitiativePrompt(null);
  }, [characterId]);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const refreshActiveBastion = useCallback(async () => {
    if (!characterId) {
      setActiveBastion(null);
      return;
    }
    const resolvedFor = characterId;
    try {
      const data = await api<{
        bastions?: Array<{ id: string; name: string; active?: boolean; campaignId?: string | null }>;
      }>(`/api/me/characters/${encodeURIComponent(characterId)}/bastions`);
      if (!mountedRef.current || characterIdRef.current !== resolvedFor) return;
      const bastion = (data.bastions ?? []).find(
        (entry): entry is typeof entry & { campaignId: string } =>
          Boolean(entry.active) && typeof entry.campaignId === "string",
      );
      setActiveBastion(bastion
        ? { id: bastion.id, name: bastion.name, campaignId: bastion.campaignId }
        : null);
    } catch {
      // Preserve the last known value across transient refresh failures.
    }
  }, [characterId]);

  const refreshInitiativePrompt = useCallback(async () => {
    if (!characterId) {
      setInitiativePrompt(null);
      return;
    }
    const resolvedFor = characterId;
    try {
      const data = await api<{ prompt: InitiativePrompt | null }>(
        `/api/me/characters/${encodeURIComponent(characterId)}/initiative-prompt`,
      );
      if (!mountedRef.current || characterIdRef.current !== resolvedFor) return;
      setInitiativePrompt(data.prompt);
    } catch {
      // A live prompt event can still populate state after a transient failure.
    }
  }, [characterId]);

  const dismissInitiativePrompt = useCallback(async (combatantId: string) => {
    setInitiativePrompt(null);
    if (!characterId) return;
    try {
      await api(`/api/me/characters/${encodeURIComponent(characterId)}/initiative-prompt`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ combatantId }),
      });
    } catch {
      // Prompt stays dismissed for this session even if the server call fails.
    }
  }, [characterId]);

  useWs(useCallback((message) => {
    if (message.type === "initiative:prompt") {
      const payload = message.payload as {
        encounterId: string;
        prompts: Array<{ characterId: string; combatantId: string }>;
      };
      const match = payload.prompts?.find((prompt) => prompt.characterId === characterId);
      if (match) {
        setInitiativePrompt({ encounterId: payload.encounterId, combatantId: match.combatantId });
      }
    } else if (message.type === "initiative:fulfilled") {
      const payload = message.payload as { combatantId: string; characterId: string };
      setInitiativePrompt((current) => current?.combatantId === payload.combatantId ? null : current);
      // Only poll for a follow-up prompt when it was our character's initiative that was fulfilled.
      if (payload.characterId === characterId) void refreshInitiativePrompt();
    } else if (message.type === "concentration:check") {
      const payload = message.payload as { characterId: string; dc: number };
      if (payload.characterId === characterId) {
        setConcentrationAlert({ dc: payload.dc });
      }
    } else if (message.type === "bastions:delta" || message.type === "players:delta") {
      void refreshActiveBastion();
    } else if (message.type === "xp:awarded") {
      const payload = message.payload as { characterId: string };
      if (payload.characterId === characterId) onXpAwarded();
    }
  }, [characterId, onXpAwarded, setConcentrationAlert, refreshActiveBastion, refreshInitiativePrompt]));

  // Single effect: fire on mount and on every reconnect.
  // When already connected at mount, fires once; on reconnect, fires again.
  useEffect(() => {
    void refreshActiveBastion();
    void refreshInitiativePrompt();
  }, [connected, refreshActiveBastion, refreshInitiativePrompt]);

  return {
    activeBastion,
    initiativePrompt,
    setInitiativePrompt,
    refreshInitiativePrompt,
    dismissInitiativePrompt,
  };
}
