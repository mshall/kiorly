import fs from "fs";
import path from "path";
import type { ReactElement } from "react";
import { act, render, screen } from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import i18n from "@/i18n";
import { ThemeProvider } from "@/theme";
import { ToastProvider } from "@/components/ui";
import { BrandHeader } from "@/components/BrandHeader";
import { PALETTE, buildScene } from "@/brand/components/shared/logo-scene";

const root = path.resolve(__dirname, "../..");
const wrap = (ui: ReactElement) => render(
  <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 800 }, insets: { top: 47, left: 0, right: 0, bottom: 34 } }}><ThemeProvider><ToastProvider>{ui}</ToastProvider></ThemeProvider></SafeAreaProvider>);

describe("brand header: a quiet bar, not a gradient banner", () => {
  it("shows the Kiorly lockup (named for assistive tech) and the controls passed in", async () => {
    await act(async () => { await i18n.changeLanguage("en"); });
    await wrap(<BrandHeader><></></BrandHeader>);
    expect(screen.getByTestId("brand-header")).toBeTruthy();
    expect(screen.getByTestId("brand-lockup").props.accessibilityLabel).toBe("Kiorly");
  });
  it("no screen draws the old indigo-to-ocean gradient banner", () => {
    for (const f of ["app/sign-in.tsx", "app/(tabs)/index.tsx", "app/(tabs)/me.tsx", "app/(tabs)/(more)/upgrade.tsx"]) {
      const src = fs.readFileSync(path.join(root, f), "utf8");
      expect(src).not.toMatch(/#0369A1|#3730A3", "#|colors=\{scheme === "dark" \? \["#1B1A4E"/);
    }
  });
});

describe("Kiorly mark colours (founder, 24 Nov 2026)", () => {
  it("on light surfaces: Indigo left chevron, Periwinkle right chevron, coral pulse; the inverse is white + light periwinkle", () => {
    const polys = buildScene("mark", "staff").nodes.filter((n) => n.k === "poly");
    expect(polys.map((n) => PALETTE.color[n.role])).toEqual(["#3730A3", "#818CF8"]);
    expect(polys.map((n) => PALETTE.inverse[n.role])).toEqual(["#FFFFFF", "#A5B4FC"]);
    const pulse = buildScene("mark", "staff").nodes.find((n) => n.k === "pulse")!;
    expect(PALETTE.color[pulse.role]).toBe("#E8735E");
  });
  it("the Kiorex mark keeps Indigo + Ocean (distinct from Kiorly)", () => {
    const polys = buildScene("mark", "kiorex").nodes.filter((n) => n.k === "poly");
    expect(polys.map((n) => PALETTE.color[n.role])).toEqual(["#3730A3", "#0369A1"]);
  });
  it("the Kiorly wordmark colours the final letter only (Y / ي), no sub-line", () => {
    const g = buildScene("wordmark", "staff").nodes.filter((n) => n.k === "glyph");
    expect(g.filter((n) => n.role === "peri")).toHaveLength(1);
    expect(g.filter((n) => n.role === "indigo").length).toBeGreaterThanOrEqual(5);
    const ar = buildScene("wordmark", "staff", "ar").nodes.filter((n) => n.k === "glyph");
    expect(ar.filter((n) => n.role === "peri")).toHaveLength(1);
  });
});
