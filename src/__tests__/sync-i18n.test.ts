import ar from "@/i18n/locales/ar.json";
import en from "@/i18n/locales/en.json";

// The sync screen showed raw "pending / conflict / failed" and the English words "Server" / "Mine" in the Arabic UI.
describe("sync screen strings exist in both languages", () => {
  for (const [name, d] of [["en", en], ["ar", ar]] as const) {
    it(`${name}: op statuses and the conflict-sheet labels`, () => {
      const s = (d as unknown as { sync: { serverCopy: string; mine: string; opStatus: Record<string, string> } }).sync;
      expect(s.serverCopy).toBeTruthy(); expect(s.mine).toBeTruthy();
      for (const k of ["pending", "conflict", "failed"]) expect(s.opStatus[k]).toBeTruthy();
    });
  }
  it("Arabic differs from English (not left untranslated)", () => {
    expect((ar as { sync: { opStatus: { pending: string } } }).sync.opStatus.pending).not.toBe((en as { sync: { opStatus: { pending: string } } }).sync.opStatus.pending);
  });
});
