import type { ReactElement } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { SafeAreaProvider } from "react-native-safe-area-context";
import i18n from "@/i18n";
import { ThemeProvider } from "@/theme";
import { ToastProvider } from "@/components/ui";
import { SIGN_IN_METHOD_KEY, parseSignInMethod, resolveSignInMethod } from "@/auth/signInMethod";

const mockReplace = jest.fn(); const mockSignIn = jest.fn(); const mockSignInPassport = jest.fn();
jest.mock("expo-router", () => ({ useRouter: () => ({ push: jest.fn(), replace: mockReplace }) }));
jest.mock("@/auth/SessionProvider", () => ({ useSessions: () => ({ signIn: mockSignIn, signInPassport: mockSignInPassport, products: [] }) }));

import SignIn from "../../app/sign-in";

const wrap = (ui: ReactElement) => render(
  <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 800 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } }}><ThemeProvider><ToastProvider>{ui}</ToastProvider></ThemeProvider></SafeAreaProvider>);
const entitled = { entitlement: { enabled: true } };
const selected = (id: string) => screen.getByTestId(id).props.accessibilityState?.selected === true;

const stored = async (k: string, want: string) => { for (let i = 0; i < 40; i++) { const v = await AsyncStorage.getItem(k); if (v === want) return v; await new Promise((r) => setTimeout(r, 10)); } return AsyncStorage.getItem(k); };

beforeEach(async () => { jest.clearAllMocks(); await AsyncStorage.clear(); await act(async () => { await i18n.changeLanguage("en"); }); });

describe("sign-in method: Kiorex Passport is the default, Password is the second option", () => {
  it("offers exactly two options and preselects Kiorex Passport on a fresh device", async () => {
    await wrap(<SignIn />);
    expect(screen.getByTestId("signin-method-passport")).toBeTruthy();
    expect(screen.getByTestId("signin-method-password")).toBeTruthy();
    expect(screen.getAllByRole("tab")).toHaveLength(2);
    expect(screen.getAllByRole("tab")[0]).toBe(screen.getByTestId("signin-method-passport")); // Passport is first
    expect(selected("signin-method-passport")).toBe(true);
    expect(selected("signin-method-password")).toBe(false);
    expect(screen.getByTestId("signin-passport")).toBeTruthy();
    expect(screen.queryByTestId("signin-email")).toBeNull(); // the password form is behind the toggle
  });
  it("the Password toggle swaps the form in on the same screen", async () => {
    await wrap(<SignIn />);
    await fireEvent.press(screen.getByTestId("signin-method-password"));
    expect(selected("signin-method-password")).toBe(true);
    expect(screen.getByTestId("signin-email")).toBeTruthy();
    expect(screen.queryByTestId("signin-passport")).toBeNull();
    await fireEvent.press(screen.getByTestId("signin-method-passport"));
    expect(screen.getByTestId("signin-passport")).toBeTruthy();
  });
  it("remembers the last method used: a password sign-in preselects Password next time", async () => {
    mockSignIn.mockResolvedValueOnce(entitled);
    await wrap(<SignIn />);
    await fireEvent.press(screen.getByTestId("signin-method-password"));
    await fireEvent.changeText(screen.getByTestId("signin-email"), "a@b.test");
    await fireEvent.changeText(screen.getByTestId("signin-password"), "pw");
    await fireEvent.press(screen.getByTestId("signin-submit"));
    await waitFor(() => expect(mockReplace).toHaveBeenCalled());
    expect(await stored(SIGN_IN_METHOD_KEY, "password")).toBe("password");
    await cleanup();
    await wrap(<SignIn />);
    await waitFor(() => expect(selected("signin-method-password")).toBe(true));
    expect(screen.getByTestId("signin-email")).toBeTruthy();
  });
  it("a Passport sign-in is remembered too, and a bogus stored value falls back to Passport", async () => {
    mockSignInPassport.mockResolvedValueOnce(entitled);
    await AsyncStorage.setItem(SIGN_IN_METHOD_KEY, "password");
    await wrap(<SignIn />);
    await waitFor(() => expect(selected("signin-method-password")).toBe(true));
    await fireEvent.press(screen.getByTestId("signin-method-passport"));
    await fireEvent.press(screen.getByTestId("signin-passport"));
    expect(await stored(SIGN_IN_METHOD_KEY, "passport")).toBe("passport");
    await cleanup();
    await AsyncStorage.setItem(SIGN_IN_METHOD_KEY, "sms");
    await wrap(<SignIn />);
    expect(selected("signin-method-passport")).toBe(true);
  });
});

describe("sign-in method resolution (pure)", () => {
  it("falls back to Passport when offered, and to Password only when Passport is not offered", () => {
    expect(resolveSignInMethod(true, null)).toBe("passport");
    expect(resolveSignInMethod(true, "password")).toBe("password");
    expect(resolveSignInMethod(true, "passport")).toBe("passport");
    expect(resolveSignInMethod(true, "x")).toBe("passport");
    expect(resolveSignInMethod(false, "passport")).toBe("password");
    expect(resolveSignInMethod(false, null)).toBe("password");
    expect(parseSignInMethod("password")).toBe("password");
    expect(parseSignInMethod(undefined)).toBeNull();
  });
  it("has Arabic labels for the method toggle", () => {
    for (const k of ["method", "methodPassport", "methodPassword"]) expect(i18n.t(`signIn.${k}`, { lng: "ar" })).not.toBe(`signIn.${k}`);
  });
});

describe("sign-in screen keeps the four entry tiles and adds the two methods", () => {
  it("renders Clinic, Nurse, Pharmacy and Lab tiles plus both methods, Kiorex Passport preselected", async () => {
    await wrap(<SignIn />);
    for (const e of ["clinic", "nurse", "pharmacy", "lab"]) expect(screen.getByTestId(`product-${e}`)).toBeTruthy();
    expect(screen.getByTestId("product-clinic").props.accessibilityState.selected).toBe(true);
    expect(screen.getByTestId("signin-method-passport")).toBeTruthy();
    expect(screen.getByTestId("signin-method-password")).toBeTruthy();
    expect(selected("signin-method-passport")).toBe(true);
    expect(screen.getByText("Sign in with Kiorex Passport")).toBeTruthy();
  });
  it("remembers the last entry tile with the last method", async () => {
    mockSignInPassport.mockResolvedValueOnce(entitled);
    await wrap(<SignIn />);
    await fireEvent.press(screen.getByTestId("product-lab"));
    await fireEvent.press(screen.getByTestId("signin-passport"));
    await waitFor(() => expect(mockSignInPassport).toHaveBeenCalledWith("lab", "en"));
    expect(await stored("kiorly.signin.entry", "lab")).toBe("lab");
    await cleanup();
    await wrap(<SignIn />);
    await waitFor(() => expect(screen.getByTestId("product-lab").props.accessibilityState.selected).toBe(true));
  });
});
