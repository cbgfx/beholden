import { useCallback, useEffect, useState } from "react";
import { api } from "@/services/api";
import { useWs, useWsStatus } from "@/services/ws";

type ActiveBastion = { id: string; name: string; campaignId: string };
type InitiativePrompt = { encounterId: string; combatantId: string };

export function useCharacterLiveUpdates(
  characterId: string | undefined,
  onXpAwarded: () => void,
) {
  const [activeBastion, setActiveBastion] = useState<ActiveBastion | null>(null);
  const [initiativePrompt, setInitiativePrompt] = useState<InitiativePrompt | null>(null);
  const connected = useWsStatus();

  const refreshActiveBastion = useCallback(async () => {
    if (!characterId) {
      setActiveBastion(null);
      return;
    }
    try {
      const data = await api<{
        bastions?: Array<{ id: string; name: string; active?: boolean; campaignId?: string | null }>;
      }>(`/api/me/characters/${encodeURIComponent(characterId)}/bastions`);
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
    try {
      const data = await api<{ prompt: InitiativePrompt | null }>(
        `/api/me/characters/${encodeURIComponent(characterId)}/initiative-prompt`,
      );
      setInitiativePrompt(data.prompt);
    } catch {
      // A live prompt event can still populate state after a transient failure.
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
      const payload = message.payload as { combatantId: string };
      setInitiativePrompt((current) => current?.combatantId === payload.combatantId ? null : current);
      void refreshInitiativePrompt();
    } else if (message.type === "bastions:delta" || message.type === "players:delta") {
      void refreshActiveBastion();
    } else if (message.type === "xp:awarded") {
      const payload = message.payload as { characterId: string };
      if (payload.characterId === characterId) onXpAwarded();
    }
  }, [characterId, onXpAwarded, refreshActiveBastion, refreshInitiativePrompt]));

  useEffect(() => {
    void refreshActiveBastion();
    void refreshInitiativePrompt();
  }, [refreshActiveBastion, refreshInitiativePrompt]);

  useEffect(() => {
    if (!connected) return;
    void refreshActiveBastion();
    void refreshInitiativePrompt();
  }, [connected, refreshActiveBastion, refreshInitiativePrompt]);

  return {
    activeBastion,
    initiativePrompt,
    setInitiativePrompt,
    refreshInitiativePrompt,
  };
}
