import { ensureNotificationChannels, NOTIFICATION_CHANNELS } from "@/lib/notificationChannels";

describe("Android notification channels", () => {
  const mk = () => { const calls: Array<[string, Record<string, unknown>]> = []; return { calls, n: { AndroidImportance: { DEFAULT: 3, HIGH: 4, MAX: 5 }, setNotificationChannelAsync: async (id: string, c: Record<string, unknown>) => { calls.push([id, c]); } } }; };
  it("creates default / safety / clinical / ops on Android (safety is MAX), nothing elsewhere", async () => {
    const { calls, n } = mk();
    expect(await ensureNotificationChannels("android", n as never, "ar")).toBe(NOTIFICATION_CHANNELS.length);
    expect(calls.map((c) => c[0])).toEqual(["default", "safety", "clinical", "ops"]);
    expect(calls[1][1]).toMatchObject({ name: "تنبيهات السلامة", importance: 5 });
    const ios = mk();
    expect(await ensureNotificationChannels("ios", ios.n as never)).toBe(0);
  });
  it("never throws", async () => {
    await expect(ensureNotificationChannels("android", { setNotificationChannelAsync: async () => { throw new Error("x"); } })).resolves.toBe(0);
  });
});
