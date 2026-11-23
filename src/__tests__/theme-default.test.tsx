import { Text } from "react-native";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { DEFAULT_THEME_PREF, THEME_KEY, ThemeProvider, parseThemePref, useTheme } from "@/theme";

function Probe() {
  const { scheme, pref, setPref } = useTheme();
  return <><Text testID="scheme">{scheme}</Text><Text testID="pref">{pref}</Text><Text testID="dark" onPress={() => setPref("dark")}>d</Text><Text testID="system" onPress={() => setPref("system")}>s</Text></>;
}
const mount = () => render(<ThemeProvider><Probe /></ThemeProvider>);

const stored = async (k: string, want: string) => { for (let i = 0; i < 40; i++) { const v = await AsyncStorage.getItem(k); if (v === want) return v; await new Promise((r) => setTimeout(r, 10)); } return AsyncStorage.getItem(k); };

beforeEach(async () => { await AsyncStorage.clear(); });

describe("theme: LIGHT is the default, an explicit choice is persisted", () => {
  it("is light (not 'system') on a fresh install, even when the OS is dark", async () => {
    expect(DEFAULT_THEME_PREF).toBe("light");
    jest.spyOn(require("react-native"), "useColorScheme").mockReturnValue("dark");
    await mount();
    expect(screen.getByTestId("pref").props.children).toBe("light");
    expect(screen.getByTestId("scheme").props.children).toBe("light");
    jest.restoreAllMocks();
  });
  it("restores a stored dark choice on the next launch and persists a new explicit choice", async () => {
    await AsyncStorage.setItem(THEME_KEY, "dark");
    await mount();
    await waitFor(() => expect(screen.getByTestId("scheme").props.children).toBe("dark"));
    await cleanup();
    await AsyncStorage.clear();
    await mount();
    expect(screen.getByTestId("scheme").props.children).toBe("light");
    await fireEvent.press(screen.getByTestId("dark"));
    expect(await stored(THEME_KEY, "dark")).toBe("dark");
    await fireEvent.press(screen.getByTestId("system"));
    expect(await stored(THEME_KEY, "system")).toBe("system");
  });
  it("ignores garbage in storage", async () => {
    await AsyncStorage.setItem(THEME_KEY, "purple");
    await mount();
    expect(screen.getByTestId("pref").props.children).toBe("light");
    expect(parseThemePref("purple")).toBeNull();
  });
});
