import type { ReactElement } from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import i18n from "@/i18n";
import { ThemeProvider } from "@/theme";
import { ToastProvider } from "@/components/ui";
import { LanguageMenu, LANGUAGES } from "@/components/LanguageMenu";

const wrap = (ui: ReactElement) => render(
  <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 800 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } }}><ThemeProvider><ToastProvider>{ui}</ToastProvider></ThemeProvider></SafeAreaProvider>);

beforeEach(async () => { await act(async () => { await i18n.changeLanguage("en"); }); });
afterAll(async () => { await act(async () => { await i18n.changeLanguage("en"); }); });

describe("language control: ONE menu button (globe + code), never two pills", () => {
  it("renders a single trigger that names the current language, with no language options until it is opened", async () => {
    await wrap(<LanguageMenu />);
    const trigger = screen.getByTestId("language-menu");
    expect(trigger.props.accessibilityRole).toBe("button");
    expect(trigger.props.accessibilityLabel).toBe("Language: English");
    expect(trigger.props.accessibilityState?.expanded).toBe(false);
    expect(screen.getByText("EN")).toBeTruthy();
    expect(screen.queryByTestId("language-menu-ar")).toBeNull();
    expect(screen.queryByTestId("language-menu-en")).toBeNull();
  });
  it("opens a sheet with العربية and English, each in its own script, the current one checked", async () => {
    await wrap(<LanguageMenu />);
    await fireEvent.press(screen.getByTestId("language-menu"));
    const ar = await screen.findByTestId("language-menu-ar"); const en = screen.getByTestId("language-menu-en");
    expect(ar.props.accessibilityLabel).toBe("العربية"); expect(en.props.accessibilityLabel).toBe("English");
    expect(ar.props.accessibilityRole).toBe("radio"); expect(en.props.accessibilityState).toMatchObject({ selected: true, checked: true });
    expect(ar.props.accessibilityState).toMatchObject({ selected: false, checked: false });
    expect(LANGUAGES.map((l) => l.name)).toEqual(["العربية", "English"]);
  });
  it("picking the other language switches i18n and closes the sheet", async () => {
    await wrap(<LanguageMenu />);
    await fireEvent.press(screen.getByTestId("language-menu"));
    await fireEvent.press(await screen.findByTestId("language-menu-ar"));
    await waitFor(() => expect(i18n.language).toBe("ar"));
    await waitFor(() => expect(screen.getByTestId("language-menu").props.accessibilityLabel).toBe("اللغة: العربية"));
  });
});
