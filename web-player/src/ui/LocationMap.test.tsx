// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { LocationMap } from "@beholden/shared/ui/LocationMap";

const mocks = vi.hoisted(() => ({
  blob: vi.fn(),
  translate: (text: string) => text,
}));
vi.mock("@beholden/shared/api/browserClient", () => ({ apiBlob: mocks.blob }));
vi.mock("@beholden/shared/i18n/useUiTranslation", () => ({
  useUiTranslation: () => mocks.translate,
}));
vi.mock("@beholden/shared/ui/ModalFrame", () => ({
  ModalFrame: ({
    isOpen,
    children,
    onClose,
  }: {
    isOpen: boolean;
    children: React.ReactNode;
    onClose: () => void;
  }) =>
    isOpen ? (
      <div role="dialog">
        <button onClick={onClose}>Close</button>
        {children}
      </div>
    ) : null,
}));

let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("URL", {
    createObjectURL: vi.fn(() => "blob:map"),
    revokeObjectURL: vi.fn(),
  });
  mocks.blob
    .mockReset()
    .mockResolvedValue(new Blob(["map"], { type: "image/webp" }));
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});
async function click(label: string) {
  const button = [...host.querySelectorAll("button")].find(
    (node) => (node.getAttribute("aria-label") ?? node.textContent) === label,
  );
  expect(button, label).toBeDefined();
  await act(async () => button!.click());
}

it("downloads only on open, zooms, resets, and releases the image on close", async () => {
  await act(async () =>
    root.render(<LocationMap name="City" endpoint="/api/map" updatedAt={1} />),
  );
  expect(mocks.blob).not.toHaveBeenCalled();
  await click("Open map");
  expect(mocks.blob).toHaveBeenCalledWith("/api/map");
  expect(host.querySelector("img")?.src).toBe("blob:map");
  await click("Zoom in");
  expect(host.querySelector("img")?.style.width).toBe("150%");
  await click("Reset zoom");
  expect(host.querySelector("img")?.style.width).toBe("100%");
  await click("Close");
  expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:map");
  expect(host.querySelector('[role="dialog"]')).toBeNull();
});

it("keeps the saved map when upload fails and requires removal confirmation", async () => {
  const upload = vi.fn().mockRejectedValue(new Error("Invalid map"));
  const remove = vi.fn().mockResolvedValue(undefined);
  await act(async () =>
    root.render(
      <LocationMap
        name="City"
        endpoint="/api/map"
        updatedAt={1}
        onUpload={upload}
        onRemove={remove}
      />,
    ),
  );
  const input = host.querySelector("input")!;
  const file = new File(["bad"], "map.png", { type: "image/png" });
  Object.defineProperty(input, "files", { value: [file] });
  await act(async () =>
    input.dispatchEvent(new Event("change", { bubbles: true })),
  );
  expect(upload).toHaveBeenCalledWith(file);
  expect(host.querySelector('[role="alert"]')?.textContent).toBe("Invalid map");
  await click("Remove map");
  expect(remove).not.toHaveBeenCalled();
  await click("Cancel");
  expect(remove).not.toHaveBeenCalled();
  await click("Remove map");
  await click("Remove");
  expect(remove).toHaveBeenCalledOnce();
});

it("shows a retry after a denied or failed map read", async () => {
  mocks.blob.mockRejectedValueOnce(new Error("Forbidden"));
  await act(async () =>
    root.render(<LocationMap name="City" endpoint="/api/map" updatedAt={1} />),
  );
  await click("Open map");
  expect(host.querySelector('[role="alert"]')?.textContent).toContain(
    "Could not load map.",
  );
  await click("Retry");
  expect(host.querySelector("img")).not.toBeNull();
});
