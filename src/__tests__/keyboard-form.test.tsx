import type { ReactElement } from "react";
import { Keyboard, TextInput } from "react-native";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ThemeProvider } from "@/theme";
import { KeyboardForm } from "@/components/KeyboardForm";
import { Field, Screen, Sheet } from "@/components/ui";

// Record the props every KeyboardAvoidingView is rendered with.
const kavProps: Array<Record<string, unknown>> = [];
jest.mock("react-native/Libraries/Components/Keyboard/KeyboardAvoidingView", () => {
  const { View } = require("react-native");
  return { __esModule: true, default: (p: Record<string, unknown>) => { kavProps.push(p); return <View testID={p.testID as string}>{p.children as never}</View>; } };
});
const hasProp = (n: unknown, k: string, v: unknown): boolean => {
  if (!n || typeof n !== "object") return false;
  if (Array.isArray(n)) return n.some((c) => hasProp(c, k, v));
  const node = n as { props?: Record<string, unknown>; children?: unknown };
  return node.props?.[k] === v || hasProp(node.children, k, v);
};
const lastKav = () => kavProps[kavProps.length - 1];

const wrap = (ui: ReactElement) => render(<SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 800 }, insets: { top: 0, left: 0, right: 0, bottom: 34 } }}><ThemeProvider>{ui}</ThemeProvider></SafeAreaProvider>);

describe("keyboard avoidance", () => {
  beforeEach(() => { kavProps.length = 0; });
  afterEach(() => { jest.restoreAllMocks(); });
  it("Screen pads for the keyboard on both platforms and keeps taps working", async () => {
    for (const os of ["ios", "android"] as const) {
      jest.replaceProperty(require("react-native").Platform, "OS", os);
      await wrap(<Screen testID="s"><Field testID="f" label="Name" value="" onChangeText={() => {}} /></Screen>);
      expect(lastKav().behavior).toBe("padding");
      expect(hasProp(screen.toJSON(), "keyboardShouldPersistTaps", "handled")).toBe(true);
      await screen.unmount();
    }
  });

  it("KeyboardForm wraps content in an avoider + ScrollView with a footer outside the scroll area", async () => {
    await wrap(<KeyboardForm testID="kf" footer={<TextInput testID="footer-input" />}><Field testID="f" label="Name" value="" onChangeText={() => {}} /></KeyboardForm>);
    expect(lastKav().behavior).toBe("padding");
    expect(hasProp(screen.toJSON(), "keyboardShouldPersistTaps", "handled")).toBe(true);
    expect(screen.getByTestId("footer-input")).toBeTruthy();
  });

  it("Field asks its scroll container to bring it into view when focused", async () => {
    const listeners: Array<() => void> = [];
    const add = jest.spyOn(Keyboard, "addListener").mockImplementation(((_e: string, cb: () => void) => { listeners.push(cb); return { remove: () => {} }; }) as never);
    await wrap(<Screen><Field testID="f" label="Name" value="" onChangeText={() => {}} /></Screen>);
    const shown = () => add.mock.calls.filter((c) => c[0] === "keyboardDidShow").length;
    const before = shown();
    await act(async () => { fireEvent(screen.getByTestId("f"), "focus"); });
    // focus registers a one-shot keyboardDidShow listener to scroll after the keyboard lands
    expect(shown()).toBeGreaterThan(before);
    add.mockRestore();
  });

  it("Sheet content is keyboard-aware too", async () => {
    await wrap(<Sheet visible onClose={() => {}} title="Add"><Field testID="sf" label="Title" value="" onChangeText={() => {}} /></Sheet>);
    expect(lastKav().behavior).toBe("padding");
    expect(screen.getByTestId("sf")).toBeTruthy();
  });
});
