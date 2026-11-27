import type { ReactElement } from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import i18n from "@/i18n";
import { ThemeProvider } from "@/theme";
import { ToastProvider } from "@/components/ui";
import { ApiError } from "@/api/errors";
import AsyncStorage from "@react-native-async-storage/async-storage";

const mockReplace = jest.fn(); const mockSignIn = jest.fn(); const mockSignInPassport = jest.fn();
jest.mock("expo-router", () => ({ useRouter: () => ({ push: jest.fn(), replace: mockReplace }) }));
jest.mock("@/auth/SessionProvider", () => ({ useSessions: () => ({ signIn: mockSignIn, signInPassport: mockSignInPassport, products: [] }) }));

import SignIn from "../../app/sign-in";
import { PassportError } from "@/auth/passport";

const wrap = (ui: ReactElement) => render(
  <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 800 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } }}><ThemeProvider><ToastProvider>{ui}</ToastProvider></ThemeProvider></SafeAreaProvider>);
const entitled = { entitlement: { enabled: true } };

beforeEach(async () => { jest.clearAllMocks(); await AsyncStorage.clear(); await act(async () => { await i18n.changeLanguage("en"); }); });

describe("sign-in screen: Kiorex Passport", () => {
  it("shows an ENABLED Passport button (no 'being enabled' placeholder) next to the dev password login", async () => {
    await wrap(<SignIn />);
    const btn = screen.getByTestId("signin-passport");
    expect(btn.props.accessibilityState?.disabled ?? false).toBe(false);
    await fireEvent.press(screen.getByTestId("signin-method-password")); // the password / chip login is untouched, one tap away
    expect(screen.getByTestId("signin-submit")).toBeTruthy();
    expect(screen.getByTestId("signin-email")).toBeTruthy();
    expect(screen.queryByText(/being enabled/i)).toBeNull();
    await fireEvent.press(screen.getByTestId("signin-method-passport"));
    expect(screen.getByText("Sign in with Kiorex Passport")).toBeTruthy();
  });
  it("signs in through Passport for the selected product and lands in the app", async () => {
    mockSignInPassport.mockResolvedValueOnce(entitled);
    await wrap(<SignIn />);
    await fireEvent.press(screen.getByTestId("product-pharmacy"));
    await fireEvent.press(screen.getByTestId("signin-passport"));
    await waitFor(() => expect(mockSignInPassport).toHaveBeenCalledWith("pharmacy", "en"));
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith("/(tabs)"));
    expect(mockSignIn).not.toHaveBeenCalled();
  });
  it("the Nurse door signs in as the clinic product and opens rounds", async () => {
    mockSignInPassport.mockResolvedValueOnce(entitled);
    await wrap(<SignIn />);
    await fireEvent.press(screen.getByTestId("product-nurse"));
    await fireEvent.press(screen.getByTestId("signin-passport"));
    await waitFor(() => expect(mockSignInPassport).toHaveBeenCalledWith("clinic", "en"));
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith("/clinic/rounds"));
  });
  it("a Basic org lands on the upgrade screen", async () => {
    mockSignInPassport.mockResolvedValueOnce({ entitlement: { enabled: false } });
    await wrap(<SignIn />);
    await fireEvent.press(screen.getByTestId("signin-passport"));
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith("/upgrade?product=clinic"));
  });
  it("a cancelled browser shows no error", async () => {
    mockSignInPassport.mockRejectedValueOnce(new PassportError("cancelled", "x"));
    await wrap(<SignIn />);
    await fireEvent.press(screen.getByTestId("signin-passport"));
    await waitFor(() => expect(mockSignInPassport).toHaveBeenCalled());
    expect(screen.queryByTestId("signin-error")).toBeNull(); expect(mockReplace).not.toHaveBeenCalled();
  });
  it("a dismissed browser (Android Custom Tab closed without a redirect) shows a clear message with Try again and Choose another product", async () => {
    mockSignInPassport.mockRejectedValueOnce(new PassportError("cancelled", "x", "dismiss"));
    await wrap(<SignIn />);
    await fireEvent.press(screen.getByTestId("product-pharmacy"));
    await fireEvent.press(screen.getByTestId("signin-passport"));
    await waitFor(() => expect(screen.getByTestId("signin-dismissed")).toBeTruthy());
    expect(screen.getByText("Sign-in did not finish")).toBeTruthy();
    expect(screen.getByText(/not linked to a Pharmacy staff account/)).toBeTruthy();
    expect(mockReplace).not.toHaveBeenCalled();
    // retry runs the sign-in again for the same product and clears the message
    mockSignInPassport.mockResolvedValueOnce(entitled);
    await fireEvent.press(screen.getByTestId("signin-retry"));
    await waitFor(() => expect(mockSignInPassport).toHaveBeenCalledTimes(2));
    expect(mockSignInPassport).toHaveBeenLastCalledWith("pharmacy", "en");
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith("/(tabs)"));
    expect(screen.queryByTestId("signin-dismissed")).toBeNull();
  });
  it("Choose another product clears the message and keeps the product grid usable", async () => {
    mockSignInPassport.mockRejectedValueOnce(new PassportError("cancelled", "x", "dismiss"));
    await wrap(<SignIn />);
    await fireEvent.press(screen.getByTestId("signin-passport"));
    await waitFor(() => expect(screen.getByTestId("signin-dismissed")).toBeTruthy());
    await fireEvent.press(screen.getByTestId("signin-choose-product"));
    expect(screen.queryByTestId("signin-dismissed")).toBeNull();
    await fireEvent.press(screen.getByTestId("product-lab"));
    expect(screen.getByTestId("product-lab").props.accessibilityState?.selected).toBe(true);
  });
  it("shows the dismissed message in Arabic", async () => {
    await act(async () => { await i18n.changeLanguage("ar"); });
    mockSignInPassport.mockRejectedValueOnce(new PassportError("cancelled", "x", "dismiss"));
    await wrap(<SignIn />);
    await fireEvent.press(screen.getByTestId("signin-passport"));
    await waitFor(() => expect(screen.getByText("لم يكتمل تسجيل الدخول")).toBeTruthy());
    expect(screen.getByText("حاول مرة أخرى")).toBeTruthy(); expect(screen.getByText("اختر منتجًا آخر")).toBeTruthy();
  });
  it("explains an unlinked Passport (403 PASSPORT_NOT_LINKED) with the product name", async () => {
    mockSignInPassport.mockRejectedValueOnce(new ApiError(403, "PASSPORT_NOT_LINKED", "not linked"));
    await wrap(<SignIn />);
    await fireEvent.press(screen.getByTestId("product-lab"));
    await fireEvent.press(screen.getByTestId("signin-passport"));
    await waitFor(() => expect(screen.getByTestId("signin-error")).toBeTruthy());
    expect(screen.getByText(/not linked to a Lab staff account/)).toBeTruthy();
    expect(mockReplace).not.toHaveBeenCalled();
  });
  it("explains a product that does not accept Passport yet (401) and Passport being unreachable", async () => {
    mockSignInPassport.mockRejectedValueOnce(new ApiError(401, "INVALID_TOKEN", "bad"));
    await wrap(<SignIn />);
    await fireEvent.press(screen.getByTestId("signin-passport"));
    await waitFor(() => expect(screen.getByText(/does not accept Kiorex Passport sign-in yet/)).toBeTruthy());
    mockSignInPassport.mockRejectedValueOnce(new PassportError("network", "x"));
    await fireEvent.press(screen.getByTestId("signin-passport"));
    await waitFor(() => expect(screen.getByText(/Cannot reach Kiorex Passport/)).toBeTruthy());
  });
  it("has Arabic strings for every Passport message", async () => {
    await act(async () => { await i18n.changeLanguage("ar"); });
    for (const k of ["passport", "passportHint", "passportCancelled", "passportDismissedTitle", "passportDismissed", "tryAgain", "chooseProduct", "passportFailed", "passportNetwork", "passportNotLinked", "passportUnsupported"]) expect(i18n.t(`signIn.${k}`, { product: "المعمل" })).not.toBe(`signIn.${k}`);
    expect(i18n.t("signIn.passport")).toBe("الدخول عبر كيوريكس باسبورت");
  });
});

describe("app name", () => {
  it("is plain Kiorly / كيورلي everywhere in the app strings (never Team)", async () => {
    expect(i18n.t("app.name", { lng: "en" })).toBe("Kiorly");
    expect(i18n.t("app.name", { lng: "ar" })).toBe("كيورلي");
    expect(i18n.t("app.by", { lng: "en" })).toBe("by Kiorex");
    const en = JSON.stringify(i18n.getResourceBundle("en", "translation")); const ar = JSON.stringify(i18n.getResourceBundle("ar", "translation"));
    expect(en).not.toMatch(/Kiorly Team|Kiorly Work/); expect(ar).not.toMatch(/كيورلي تيم|كيورلي ورك/);
  });
});
