import { act, render, screen } from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import i18n from "@/i18n";
import { ThemeProvider } from "@/theme";
import { ToastProvider } from "@/components/ui";
import { AnimatedSplash } from "@/components/AnimatedSplash";

const wrap = (ui: React.ReactElement) => render(
  <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 800 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } }}><ThemeProvider><ToastProvider>{ui}</ToastProvider></ThemeProvider></SafeAreaProvider>);

describe("'by Kiorex'", () => {
  it("is on the splash screen in English and Arabic", async () => {
    await act(async () => { await i18n.changeLanguage("en"); });
    await wrap(<AnimatedSplash onDone={() => {}} hold />);
    expect(screen.getByTestId("splash-by", { includeHiddenElements: true })).toBeTruthy();
    expect(screen.getByText("by Kiorex", { includeHiddenElements: true })).toBeTruthy();
    await act(async () => { await i18n.changeLanguage("ar"); });
    expect(screen.getByText("من كيوريكس", { includeHiddenElements: true })).toBeTruthy();
  });
});
