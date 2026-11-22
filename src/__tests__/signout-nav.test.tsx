import type { ReactElement } from "react";
import fs from "fs";
import path from "path";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import i18n from "@/i18n";
import { ThemeProvider } from "@/theme";
import { ToastProvider } from "@/components/ui";

const mockReplace = jest.fn(); const mockSignOut = jest.fn(async () => {}); const mockSignOutAll = jest.fn(async () => {});
let mockProducts: string[] = ["clinic", "lab"];
jest.mock("expo-router", () => ({ useRouter: () => ({ push: jest.fn(), replace: mockReplace }) }));
jest.mock("@/auth/SessionProvider", () => ({ useSessions: () => ({ sessions: { clinic: { userName: "Dr Nadia" }, lab: { userName: "Dr Nadia" } }, products: mockProducts, signOut: mockSignOut, signOutAll: mockSignOutAll }) }));

import { SignOutSheet } from "@/components/SignOutSheet";

const wrap = (ui: ReactElement) => render(
  <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 800 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } }}><ThemeProvider><ToastProvider>{ui}</ToastProvider></ThemeProvider></SafeAreaProvider>);

beforeEach(async () => { jest.clearAllMocks(); mockProducts = ["clinic", "lab"]; await act(async () => { await i18n.changeLanguage("en"); }); });

describe("sign-out sheet", () => {
  it("per-product: picker -> confirm -> signs out only that product and stays signed in elsewhere", async () => {
    await wrap(<SignOutSheet visible onClose={jest.fn()} />);
    await fireEvent.press(screen.getByTestId("signout-pick-clinic"));
    expect(screen.getByTestId("signout-confirm")).toBeTruthy();
    await fireEvent.press(screen.getByTestId("signout-confirm-btn"));
    await waitFor(() => expect(mockSignOut).toHaveBeenCalledWith("clinic"));
    expect(mockReplace).not.toHaveBeenCalled();
  });
  it("sign out of everything needs a confirm, clears all and returns to /sign-in", async () => {
    await wrap(<SignOutSheet visible onClose={jest.fn()} />);
    await fireEvent.press(screen.getByTestId("signout-pick-all"));
    expect(mockSignOutAll).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByTestId("signout-confirm-btn"));
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith("/sign-in"));
    expect(mockSignOutAll).toHaveBeenCalled();
  });
  it("cancel on the confirm step signs nothing out; Arabic strings exist", async () => {
    await wrap(<SignOutSheet visible onClose={jest.fn()} />);
    await fireEvent.press(screen.getByTestId("signout-pick-lab"));
    await fireEvent.press(screen.getByTestId("signout-cancel"));
    expect(mockSignOut).not.toHaveBeenCalled();
    expect(screen.getByTestId("signout-pick-lab")).toBeTruthy();
    await act(async () => { await i18n.changeLanguage("ar"); });
    expect(i18n.t("signOutDlg.confirm")).toBe("تسجيل الخروج");
  });
  it("a single connected product skips the picker", async () => {
    mockProducts = ["clinic"];
    await wrap(<SignOutSheet visible onClose={jest.fn()} />);
    await fireEvent.press(screen.getByTestId("signout-confirm-btn"));
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith("/sign-in"));
  });
});

describe("navigation structure", () => {
  const app = path.join(__dirname, "../../app");
  it("pushed screens live inside (tabs)/(more), so the tab bar persists", () => {
    for (const f of ["clinic", "pharmacy", "lab", "devices.tsx", "sync.tsx", "upgrade.tsx", "search.tsx"]) {
      expect(fs.existsSync(path.join(app, f))).toBe(false);
      expect(fs.existsSync(path.join(app, "(tabs)/(more)", f))).toBe(true);
    }
    expect(fs.readFileSync(path.join(app, "(tabs)/_layout.tsx"), "utf8")).toMatch(/name="\(more\)" options=\{\{[^}]*tabBarButton: \(\) => null/);
  });
});
