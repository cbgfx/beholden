// @vitest-environment jsdom
import { act } from "react";
import { expect, it, vi } from "vitest";
import { renderHook, deferred } from "@beholden/shared/tests/renderHook";
const h = vi.hoisted(() => ({ api: vi.fn(), dispatch: vi.fn(), state: { selectedCampaignId: "c1", adventures: [], encounters: [] } }));
vi.mock("@/services/api", () => ({ api: h.api, jsonInit: (method: string, body: unknown) => ({ method, body }) }));
vi.mock("@/store", () => ({ useStore: () => ({ state: h.state, dispatch: h.dispatch }) }));
vi.mock("@beholden/shared/i18n/useUiTranslation", () => ({ useUiTranslation: () => (s: string) => s }));
import { RenameDrawer } from "./RenameDrawer";
it.each([false, true])("updates the adventure panel without WebSocket delivery; ignores departed campaign: %s", async leave => {
  h.state.selectedCampaignId = "c1"; h.dispatch.mockClear();
  const request = deferred<unknown>(); h.api.mockReturnValue(request.promise);
  const close = vi.fn();
  const hook = await renderHook(() => RenameDrawer({ drawer: { type: "createAdventure", campaignId: "c1" }, close }));
  const footer = hook.result.footer as React.ReactElement<{ children: React.ReactElement<{ onClick: () => Promise<void> }>[] }>;
  let saving!: Promise<void>;
  act(() => { saving = footer.props.children[1]!.props.onClick(); });
  if (leave) { h.state.selectedCampaignId = "c2"; await hook.rerender(undefined); }
  const adventure = { id: "a1", campaignId: "c1", name: "New Adventure" };
  await act(async () => { request.resolve(adventure); await saving; });
  expect(h.dispatch.mock.calls).toEqual(leave ? [] : [[{ type: "upsertAdventure", adventure }]]);
  expect(close).toHaveBeenCalledOnce();
});
