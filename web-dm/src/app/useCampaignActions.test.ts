// @vitest-environment jsdom
import { act } from "react";
import { expect, it, vi } from "vitest";
import { renderHook, deferred } from "@beholden/shared/tests/renderHook";
import type { State } from "@/store/state";
const h=vi.hoisted(()=>({api:vi.fn()}));
vi.mock("@/services/api",()=>({api:h.api,jsonInit:vi.fn()}));
vi.mock("@beholden/shared/i18n/useUiTranslation",()=>({useUiMessages:()=>(s:string)=>s}));
import { useCampaignActions } from "./useCampaignActions";
it("Full Rest refreshes the roster without depending on a WebSocket notification",async()=>{
  h.api.mockResolvedValue({ok:true});
  const refreshed=deferred<void>(); const refreshCampaign=vi.fn(()=>refreshed.promise);
  const hook=await renderHook(()=>useCampaignActions({selectedCampaignId:"camp"} as State,vi.fn(),vi.fn(),{refreshCampaign,refreshAll:vi.fn(),refreshAdventure:vi.fn(),refreshEncounter:vi.fn()}));
  let pending!:Promise<void>; let done=false;
  await act(async()=>{pending=hook.result.fullRestPlayers().then(()=>{done=true;});});
  expect(h.api).toHaveBeenCalledWith("/api/campaigns/camp/fullRest",{method:"POST"});
  expect(refreshCampaign).toHaveBeenCalledWith("camp"); expect(done).toBe(false);
  await act(async()=>{refreshed.resolve();await pending;}); expect(done).toBe(true);
});
