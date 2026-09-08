import { afterEach, expect, it, vi } from "vitest";
vi.mock("react", () => ({ default: {
  useState: (value: unknown) => [value, vi.fn()],
  useRef: (value: unknown) => ({ current: value }),
  useEffect: () => {},
  useCallback: (fn: unknown) => fn,
} }));
import { useUpdateCheck } from "@beholden/shared/ui/useUpdateCheck";

afterEach(() => vi.unstubAllGlobals());

it("prevents a second update before React rerenders and permits retry after failure", async () => {
  vi.stubGlobal("window", { confirm: vi.fn(() => true) });
  let reject!: (reason: Error) => void;
  const api = vi.fn().mockImplementation(() => new Promise((_, no) => { reject = no; }));
  const { startUpdate } = useUpdateCheck(api, "test");
  const first = startUpdate();
  await startUpdate();
  expect(api).toHaveBeenCalledTimes(1);
  reject(new Error("unavailable"));
  await first;
  api.mockResolvedValue({ message: "started" });
  await startUpdate();
  expect(api).toHaveBeenCalledTimes(2);
});
