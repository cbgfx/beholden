import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/services/api";
import { useWs, useWsStatus } from "@/services/ws";

type ActiveBastion = { id: string; name: string; campaignId: string };
type InitiativePrompt = { encounterId: string; combatantId: string };
type CombatStatus = { encounterId: string; combatantId: string; usedReaction: boolean };

export function useCharacterLiveUpdates(
  characterId: string | undefined,
  onXpAwarded: () => void,
  setConcentrationAlert: (alert: { dc: number } | null) => void,
) {
  const [activeBastion, setActiveBastion] = useState<ActiveBastion | null>(null);
  const [initiativePrompt, setInitiativePrompt] = useState<InitiativePrompt | null>(null);
  const [combatStatus, setCombatStatus] = useState<CombatStatus | null>(null);
  const connected = useWsStatus();
  const mountedRef = useRef(true);
  const characterIdRef = useRef(characterId);
  characterIdRef.current = characterId;
  const combatStatusRef = useRef(combatStatus);
  combatStatusRef.current = combatStatus;

  useEffect(() => {
    setActiveBastion(null);
    setInitiativePrompt(null);
    setCombatStatus(null);
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

  const refreshCombatStatus = useCallback(async () => {
    if (!characterId) {
      setCombatStatus(null);
      return;
    }
    const resolvedFor = characterId;
    try {
      const data = await api<{ combat: CombatStatus | null }>(
        `/api/me/characters/${encodeURIComponent(characterId)}/combat-status`,
      );
      if (!mountedRef.current || characterIdRef.current !== resolvedFor) return;
      setCombatStatus(data.combat);
    } catch {
      // Preserve the last known value across transient refresh failures.
    }
  }, [characterId]);

  const toggleReaction = useCallback(async () => {
    const current = combatStatusRef.current;
    if (!current) return;
    const { encounterId, combatantId, usedReaction } = current;
    const next = !usedReaction;
    setCombatStatus((prev) => prev ? { ...prev, usedReaction: next } : prev);
    try {
      await api(`/api/encounters/${encodeURIComponent(encounterId)}/combatants/${encodeURIComponent(combatantId)}/reaction`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usedReaction: next }),
      });
    } catch {
      // Revert the optimistic flip on failure; a subsequent broadcast/refetch will also self-correct.
      setCombatStatus((prev) =>
        prev && prev.combatantId === combatantId ? { ...prev, usedReaction } : prev);
    }
  }, []);

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
      if (payload.characterId === characterId) {
        void refreshInitiativePrompt();
        // This is the moment combat becomes active for our character.
        void refreshCombatStatus();
      }
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
    } else if (message.type === "encounter:combatantsDelta") {
      const payload = message.payload as { combatantId?: string };
      if (combatStatusRef.current && payload.combatantId === combatStatusRef.current.combatantId) {
        void refreshCombatStatus();
      }
    } else if (message.type === "encounters:delta") {
      const payload = message.payload as { encounterId?: string };
      if (combatStatusRef.current && payload.encounterId === combatStatusRef.current.encounterId) {
        void refreshCombatStatus();
      }
    }
  }, [characterId, onXpAwarded, setConcentrationAlert, refreshActiveBastion, refreshInitiativePrompt, refreshCombatStatus]));

  // Single effect: fire on mount and on every reconnect.
  // When already connected at mount, fires once; on reconnect, fires again.
  useEffect(() => {
    void refreshActiveBastion();
    void refreshInitiativePrompt();
    void refreshCombatStatus();
  }, [connected, refreshActiveBastion, refreshInitiativePrompt, refreshCombatStatus]);

  return {
    activeBastion,
    initiativePrompt,
    setInitiativePrompt,
    refreshInitiativePrompt,
    dismissInitiativePrompt,
    combatStatus,
    toggleReaction,
  };
}
