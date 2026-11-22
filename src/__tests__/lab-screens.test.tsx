import type { ReactElement } from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SafeAreaProvider } from "react-native-safe-area-context";
import i18n from "@/i18n";
import { ThemeProvider } from "@/theme";
import { ToastProvider } from "@/components/ui";

const mockRequest = jest.fn();
jest.mock("@/api/client", () => ({ request: (_p: string, m: string, path: string, o: unknown) => mockRequest(m, path, o), api: { get: (_p: string, path: string, o: unknown) => mockRequest("GET", path, o), post: (_p: string, path: string, b: unknown) => mockRequest("POST", path, b) } }));
jest.mock("expo-router", () => ({ Stack: { Screen: () => null }, useLocalSearchParams: () => ({}), useRouter: () => ({ push: jest.fn() }) }));
jest.mock("@/components/scanner", () => {
  const { TextInput } = require("react-native");
  return { ScanField: ({ onCode, testID }: { onCode: (c: string) => void; testID?: string }) => <TextInput testID={testID ?? "scan"} onSubmitEditing={(e: { nativeEvent: { text: string } }) => onCode(e.nativeEvent.text)} /> };
});
const mockAck = jest.fn();
jest.mock("@/hooks/useAlerts", () => ({
  useAckAlert: () => mockAck,
  useAlerts: () => ({ isLoading: false, isError: false, refetch: async () => [], openCount: 1, items: [
    { id: "crit_1", product: "lab", kind: "CRITICAL_VALUE", severity: "CRITICAL", title: "Escalated critical K", titleAr: "تصعيد", body: "ORD-1 potassium critical", subject: null, raisedAt: new Date().toISOString(), dueAt: new Date(Date.now() + 3600_000).toISOString(), ackedAt: null, ackedBy: null, escalationLevel: 1 },
    { id: "qc_1", product: "lab", kind: "QC_FAILURE", severity: "HIGH", title: "QC fail", body: "x", subject: null, raisedAt: new Date().toISOString(), ackedAt: null, ackedBy: null },
  ] }),
}));
jest.mock("@/auth/SessionProvider", () => ({ useSessions: () => ({ sessions: { lab: { email: "sig@demo-lab.test", bootstrap: { user: { role: "AUTHORIZED_SIGNATORY", signatory: true }, modules: [{ key: "lab.validation", enabled: true, screens: ["sign-off"] }], permissions: ["results.medical_validate"] } } } }) }));

import Critical from "../../app/(tabs)/(more)/lab/critical";
import Validation from "../../app/(tabs)/(more)/lab/validation";
import Accession from "../../app/(tabs)/(more)/lab/accession";
import TatScreen from "../../app/(tabs)/(more)/lab/tat";

const wrap = (ui: ReactElement) => render(
  <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 800 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } }}>
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><ThemeProvider><ToastProvider>{ui}</ToastProvider></ThemeProvider></QueryClientProvider>
  </SafeAreaProvider>);

beforeEach(async () => { mockRequest.mockReset(); mockAck.mockReset(); await act(async () => { await i18n.changeLanguage("en"); }); });

describe("lab screens", () => {
  it("critical: lists only critical kinds and acknowledges with a note", async () => {
    await wrap(<Critical />);
    expect(screen.getByTestId("crit-crit_1")).toBeTruthy();
    expect(screen.queryByTestId("crit-qc_1")).toBeNull();
    await fireEvent.press(screen.getByTestId("crit-crit_1"));
    await fireEvent.changeText(screen.getByTestId("crit-note"), "called Dr Amr");
    await fireEvent.press(screen.getByTestId("crit-ack"));
    await waitFor(() => expect(mockAck).toHaveBeenCalledWith(expect.objectContaining({ id: "crit_1" }), "called Dr Amr"));
  });

  it("validation: delta-check failure blocks tech validation until acknowledged", async () => {
    const row = { id: "r1", status: "TECH_VALIDATED", valueNumeric: 7.9, valueText: null, unit: "mmol/L", flag: "HIGH", refLow: 3.5, refHigh: 5.1, deltaPercent: 40, deltaCheckFailed: true, analyte: { code: "K", nameEn: "Potassium" }, specimen: { accessionNumber: "CAI1" }, orderItem: { order: { id: "o1", orderNumber: "ORD-9", patient: { fullName: "Test Patient" } } } };
    mockRequest.mockImplementation(async (m: string, p: string) => (p === "/validation-queue" ? [row] : {}));
    await wrap(<Validation />);
    await waitFor(() => expect(screen.getByTestId("res-r1")).toBeTruthy());
    await fireEvent.press(screen.getByTestId("res-r1"));
    expect(screen.getByTestId("validate-confirm").props.accessibilityState.disabled).toBe(true);
    await fireEvent.press(screen.getByTestId("delta-ack"));
    expect(screen.getByTestId("validate-confirm").props.accessibilityState.disabled).toBe(false);
    await fireEvent.press(screen.getByTestId("validate-confirm"));
    await waitFor(() => expect(mockRequest).toHaveBeenCalledWith("POST", "/results/r1/tech-validate", expect.anything()));
  });

  it("accession: shows API-allowed actions only and maps a label mismatch to a clear error", async () => {
    mockRequest.mockImplementation(async (m: string, p: string) => {
      if (p === "/mobile/scan") return { type: "SPECIMEN", specimen: { id: "s1", accessionNumber: "CAI9", barcode: "CAI9", specimenType: "Serum", container: "Gel", status: "PENDING_COLLECTION", collectedAt: null }, order: { id: "o", orderNumber: "ORD-1", priority: "ROUTINE", status: "AWAITING_COLLECTION", patient: { fullName: "P" } }, tests: ["CBC"], custody: [], nextActions: [{ action: "collect", to: "COLLECTED", requiresScan: true, allowed: true }, { action: "reject", to: "REJECTED", requiresScan: false, allowed: false }] };
      if (p === "/specimens/s1/custody") return [];
      throw Object.assign(new (require("@/api/errors").ApiError)(400, "LABEL_MISMATCH", "barcode does not match"));
    });
    await wrap(<Accession />);
    await fireEvent(screen.getByTestId("accession-field"), "submitEditing", { nativeEvent: { text: "CAI9" } });
    await waitFor(() => expect(screen.getByTestId("specimen-card")).toBeTruthy());
    expect(screen.getByTestId("act-collect")).toBeTruthy();
    expect(screen.queryByTestId("act-reject")).toBeNull();
    await fireEvent.press(screen.getByTestId("act-collect"));
    await waitFor(() => expect(screen.getByTestId("specimen-error")).toBeTruthy());
    expect(screen.getByText(/does not match this specimen/)).toBeTruthy();
  });

  it("tat: summary tiles and breached rows", async () => {
    mockRequest.mockResolvedValue({ summary: { total: 3, ok: 1, atRisk: 0, breached: 2, doneOnTime: 0, doneLate: 0 }, rows: [{ orderItemId: "i1", orderNumber: "ORD-5", priority: "STAT", test: "CBC", targetMinutes: 60, status: "BREACHED", elapsedMinutes: 90, percent: 100 }] });
    await wrap(<TatScreen />);
    await waitFor(() => expect(screen.getByTestId("tat-i1")).toBeTruthy());
  });
});
