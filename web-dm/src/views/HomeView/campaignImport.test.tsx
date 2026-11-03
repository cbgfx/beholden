// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { HomeView } from "../HomeView";

const mocks = vi.hoisted(() => ({ api: vi.fn() }));
vi.mock("@/services/api", () => ({ api: mocks.api }));
vi.mock("@/components/overlay/Modal", () => ({
  Modal: ({ children }: { children: React.ReactNode }) => (
    <div role="dialog">{children}</div>
  ),
}));
vi.mock("@beholden/shared/i18n/useUiTranslation", () => ({
  useUiTranslation: () => (text: string) => text,
  useUiMessages: () => (text: string) => text,
}));

it("reviews before saving, cancels without writes, and explicitly authorizes replacement", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  const refresh = vi.fn();
  mocks.api.mockReset();
  mocks.api.mockResolvedValue({
    campaignId: "campaign",
    name: "Backup",
    existingName: "Saved",
    sameNameCampaigns: [],
    counts: [],
    warnings: [],
  });
  const click = async (label: string) => {
    const button = Array.from(document.querySelectorAll("button")).find(
      (node) => node.textContent === label,
    );
    expect(button, label).toBeDefined();
    await act(async () => button!.click());
  };
  try {
    await act(async () =>
      root.render(
        <HomeView
          campaigns={[]}
          binders={[]}
          onCreateCampaign={vi.fn()}
          onOpenCampaign={vi.fn()}
          onEditCampaign={vi.fn()}
          onDeleteCampaign={vi.fn()}
          onRefresh={refresh}
          onCreateBinder={vi.fn()}
          onOpenBinder={vi.fn()}
          onEditBinder={vi.fn()}
          onDeleteBinder={vi.fn()}
        />,
      ),
    );
    const input = host.querySelector<HTMLInputElement>('input[type="file"]')!;
    Object.defineProperty(input, "files", {
      configurable: true,
      value: [new File(["{}"], "backup.json", { type: "application/json" })],
    });
    await act(async () =>
      input.dispatchEvent(new Event("change", { bubbles: true })),
    );
    await click("Preview import");
    expect(mocks.api.mock.calls[0]?.[0]).toBe("/api/campaigns/import/preview");
    expect(document.querySelector('[role="dialog"]')?.textContent).toContain(
      "This replaces the existing campaign",
    );
    await click("Cancel");
    expect(mocks.api).toHaveBeenCalledTimes(1);
    expect(refresh).not.toHaveBeenCalled();
    await click("Preview import");
    await click("Replace campaign");
    expect(mocks.api.mock.calls[2]?.[0]).toBe("/api/campaigns/import");
    expect(
      (mocks.api.mock.calls[2]?.[1].body as FormData).get("replaceCampaignId"),
    ).toBe("campaign");
    expect(refresh).toHaveBeenCalledOnce();
    expect(document.querySelector('[role="dialog"]')).toBeNull();
  } finally {
    await act(async () => root.unmount());
    host.remove();
    vi.unstubAllGlobals();
  }
});
