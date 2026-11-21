const mockExec = { env: "storeClient", go: false };
jest.mock("expo-constants", () => ({ __esModule: true, default: { get executionEnvironment() { return mockExec.env; }, appOwnership: null } }));
const mockStore = new Map<string, string>();
jest.mock("@/lib/storage", () => ({ prefs: { get: async (k: string) => mockStore.get(k) ?? null, set: async (k: string, v: string) => { mockStore.set(k, v); } } }));
const mockReload = jest.fn(async (_r?: string) => {});
jest.mock("expo", () => ({ reloadAppAsync: (r?: string) => mockReload(r), isRunningInExpoGo: () => mockExec.go }));

import { __resetRestartForTests, canAutoReload, handleRestart } from "@/i18n/restart";
import { prefs } from "@/lib/storage";

beforeEach(async () => { mockReload.mockClear(); __resetRestartForTests(); mockExec.env = "storeClient"; mockExec.go = false; await prefs.set("kw-rtl-reload-at", ""); await prefs.set("kw-rtl-banner-seen", ""); });

describe("direction restart", () => {
  it("Expo Go: never reloads, shows the banner once", async () => {
    expect(await handleRestart()).toBe("manual");
    expect(mockReload).not.toHaveBeenCalled();
    expect(await prefs.get("kw-rtl-banner-seen")).toBe("1");
  });
  it("Expo Go that reports a 'bare' environment is still detected through the expo core module", async () => {
    mockExec.env = "bare"; mockExec.go = true;
    expect(await handleRestart()).toBe("manual");
    expect(mockReload).not.toHaveBeenCalled();
  });
  it("real build: reloads in place", async () => {
    mockExec.env = "standalone";
    expect(await handleRestart()).toBe("reloaded");
    expect(mockReload).toHaveBeenCalledTimes(1);
  });
  it("real build: does not loop (second reload within a minute falls back to the banner)", async () => {
    mockExec.env = "standalone";
    await handleRestart();
    expect(await handleRestart()).toBe("manual");
    expect(mockReload).toHaveBeenCalledTimes(1);
  });
  it("guard rule", () => {
    expect(canAutoReload(null)).toBe(true);
    expect(canAutoReload(1000, 1000 + 30_000)).toBe(false);
    expect(canAutoReload(1000, 1000 + 61_000)).toBe(true);
  });
});
