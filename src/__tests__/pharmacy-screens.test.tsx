import type { ReactElement } from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SafeAreaProvider } from "react-native-safe-area-context";
import i18n from "@/i18n";
import { ThemeProvider } from "@/theme";
import { ToastProvider } from "@/components/ui";

const mockGet = jest.fn(); const mockPost = jest.fn();
let mockParams: Record<string, string> = {};
jest.mock("expo-router", () => ({ Stack: { Screen: () => null }, useRouter: () => ({ push: jest.fn(), back: jest.fn() }), useLocalSearchParams: () => mockParams }));
jest.mock("expo-camera", () => ({ CameraView: () => null, useCameraPermissions: () => [{ granted: false }, jest.fn()] }));
jest.mock("@/api/client", () => ({
  request: (_p: string, _m: string, path: string, o?: { query?: unknown }) => mockGet(path, o?.query),
  api: { get: (_p: string, path: string, o?: { query?: unknown }) => mockGet(path, o?.query), post: (_p: string, path: string, body: unknown) => mockPost(path, body), put: jest.fn(), del: jest.fn() },
}));
jest.mock("@/auth/SessionProvider", () => {
  const boot = { user: { role: "PHARMACIST", branchId: "b1" }, modules: [{ key: "pharmacy.rx", enabled: true, screens: ["rx.queue", "rx.detail", "rx.safety", "rx.override"] }] };
  return { useSessions: () => ({ sessions: { pharmacy: { email: "p@x", bootstrap: boot } }, products: ["pharmacy"] }) };
});

import RxQueue from "../../app/pharmacy/rx/index";
import RxDetail from "../../app/pharmacy/rx/[id]";
import Barcode from "../../app/pharmacy/barcode";
import Expiry from "../../app/pharmacy/expiry";

const wrap = (ui: ReactElement) => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 800 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } }}><QueryClientProvider client={qc}><ThemeProvider><ToastProvider>{ui}</ToastProvider></ThemeProvider></QueryClientProvider></SafeAreaProvider>);
};
beforeEach(async () => { mockGet.mockReset(); mockPost.mockReset(); mockParams = {}; await act(async () => { await i18n.changeLanguage("en"); }); });

describe("Pharmacy screens", () => {
  it("Rx queue lists urgent first with allergy flag", async () => {
    mockGet.mockResolvedValue({ total: 2, urgent: 1, items: [
      { id: "a", status: "RECEIVED", priority: "NORMAL", source: "X", ageMinutes: 900, patient: { displayName: "Hassan Demo", allergies: ["sulfa"] }, prescriberName: "Dr A", lines: 2, controlled: false, hasAllergyOnFile: true },
      { id: "b", status: "RECEIVED", priority: "URGENT", source: "X", ageMinutes: 10, patient: { displayName: "Mona", allergies: [] }, prescriberName: "Dr B", lines: 1, controlled: false, hasAllergyOnFile: false }] });
    await wrap(<RxQueue />);
    await waitFor(() => expect(screen.getByTestId("rx-b")).toBeTruthy());
    expect(screen.getAllByText("Urgent").length).toBeGreaterThan(0);
    expect(screen.getByText(/allergy on file/)).toBeTruthy();
  });

  it("Rx detail: runs checks, shows locked BLOCK and lets a pharmacist override a WARN with a reason", async () => {
    mockParams = { id: "rx1" };
    mockGet.mockImplementation(async (path: string) => path.startsWith("/dispensings/") ? { id: "d1", status: "DRAFT", safetyChecks: [] } : { id: "rx1", status: "RECEIVED", priority: "NORMAL", prescriberName: "Dr A", patient: { id: "p", displayName: "Hassan", allergies: ["sulfa"] }, lines: [{ id: "l1", drugId: "dr1", drugName: "Amoxirex", drug: { id: "dr1", brandName: "Amoxirex" }, quantity: 2 }] });
    mockPost.mockImplementation(async (path: string) => path === "/dispensings" ? { id: "d1", status: "DRAFT", safetyChecks: [{ id: "c1", kind: "ALLERGY", outcome: "WARN", detail: "Sulfa", overridable: true }, { id: "c2", kind: "INTERACTION", outcome: "BLOCK", detail: "x", overridable: false }] } : {});
    await wrap(<RxDetail />);
    await waitFor(() => expect(screen.getByTestId("rx-run-checks")).toBeTruthy());
    expect(screen.getByTestId("rx-allergies")).toBeTruthy();
    await fireEvent.press(screen.getByTestId("rx-run-checks"));
    await waitFor(() => expect(screen.getByTestId("check-ALLERGY")).toBeTruthy());
    expect(screen.getByText("Contraindicated. Cannot be overridden.")).toBeTruthy();
    expect(screen.queryByTestId("override-INTERACTION")).toBeNull();
    expect(screen.getByTestId("rx-signoff").props.accessibilityState.disabled).toBe(true);
    await fireEvent.press(screen.getByTestId("override-ALLERGY"));
    await waitFor(() => expect(screen.getByTestId("override-reason")).toBeTruthy());
    expect(screen.getByTestId("override-confirm").props.accessibilityState.disabled).toBe(true);
    await fireEvent.changeText(screen.getByTestId("override-reason"), "Tolerated before, counselled");
    await fireEvent.press(screen.getByTestId("override-confirm"));
    await waitFor(() => expect(mockPost).toHaveBeenCalledWith("/dispensings/d1/override/c1", { reason: "Tolerated before, counselled" }));
  });

  it("Barcode lookup shows price, stock and FEFO lots", async () => {
    mockParams = { code: "62200000010077" };
    mockGet.mockResolvedValue({ found: true, code: "62200000010077", drug: { id: "d", brandName: "Amoxirex 500mg", rxOnly: true }, price: "70.00", requiresPrescription: true, stock: { onHand: 14, available: 12, nearestExpiry: "2028-01-13T00:00:00.000Z" },
      lots: [{ id: "2", lotNumber: "L21", expiryDate: "2028-07-11T00:00:00.000Z", status: "AVAILABLE", qtyOnHand: 12, daysToExpiry: 599 }, { id: "1", lotNumber: "L22", expiryDate: "2028-01-13T00:00:00.000Z", status: "AVAILABLE", qtyOnHand: 2, daysToExpiry: 419 }] });
    await wrap(<Barcode />);
    await waitFor(() => expect(screen.getByTestId("barcode-result")).toBeTruthy());
    expect(screen.getByText("Amoxirex 500mg")).toBeTruthy();
    expect(screen.getByText("Use first")).toBeTruthy();
    expect(screen.getByTestId("lot-L22")).toBeTruthy();
    expect(mockGet).toHaveBeenCalledWith("/mobile/pharmacy/barcode/62200000010077", undefined);
  });

  it("Expiry dashboard renders buckets and low stock in Arabic", async () => {
    await act(async () => { await i18n.changeLanguage("ar"); });
    mockGet.mockResolvedValue({ expiry: { expired: { lots: 4, units: 56 }, within30: { lots: 46, units: 1 }, within60: { lots: 44, units: 1 }, within90: { lots: 0, units: 0 }, items: [{ lotId: "x", drugId: "d", brandName: "Medixmeto", brandNameAr: "ميتوبرولول", lotNumber: "L1", expiryDate: "2026-10-29T00:00:00.000Z", daysToExpiry: -22, qtyOnHand: 22, status: "EXPIRED" }] }, lowStock: { count: 1, items: [{ drugId: "z", brandName: "Zora", minQty: 7, onHand: 0, suggestedOrder: 27 }] } });
    await wrap(<Expiry />);
    await waitFor(() => expect(screen.getByTestId("exp-x")).toBeTruthy());
    expect(screen.getByText("ميتوبرولول")).toBeTruthy();
    expect(screen.getByTestId("low-z")).toBeTruthy();
  });
});
