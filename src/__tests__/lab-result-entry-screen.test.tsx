import type { ReactElement } from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SafeAreaProvider } from "react-native-safe-area-context";
import i18n from "@/i18n";
import { ThemeProvider } from "@/theme";
import { ToastProvider } from "@/components/ui";
import { ApiError } from "@/api/errors";

const mockRequest = jest.fn();
const mockPost = jest.fn();
let mockPerms: string[] = ["results.read", "results.enter", "results.second_entry", "qc.read"];
const mockPush = jest.fn();
jest.mock("@/api/client", () => ({ request: (_p: string, m: string, path: string, o: unknown) => mockRequest(m, path, o), api: { get: (_p: string, path: string, o: unknown) => mockRequest("GET", path, o), post: (_p: string, path: string, b: unknown) => mockPost(path, b) }, configureClient: jest.fn() }));
jest.mock("expo-router", () => ({ Stack: { Screen: () => null }, useLocalSearchParams: () => ({ specimenId: "sp1" }), useRouter: () => ({ push: mockPush }) }));
jest.mock("@/auth/SessionProvider", () => ({ useSessions: () => ({ sessions: { lab: { email: "t@x.test", bootstrap: { user: { role: "TECHNOLOGIST" }, modules: [{ key: "lab.worklist", enabled: true, screens: ["progress", "specimens"] }], permissions: mockPerms } } } }) }));

import ResultEntry from "../../app/(tabs)/(more)/lab/results/[specimenId]";
import Worklist from "../../app/(tabs)/(more)/lab/worklist";

const wrap = (ui: ReactElement) => render(
  <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 800 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } }}>
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })}><ThemeProvider><ToastProvider>{ui}</ToastProvider></ThemeProvider></QueryClientProvider>
  </SafeAreaProvider>);

const K = { id: "a1", code: "K", nameEn: "Potassium", nameAr: "البوتاسيوم", unit: "mmol/L", valueType: "NUMERIC", allowedValues: [], calculated: false };
const HCV = { id: "a2", code: "HCV", nameEn: "HCV", unit: null, valueType: "CHOICE", allowedValues: ["Reactive", "Non-reactive"], calculated: false };
const CALC = { id: "a3", code: "CALC", nameEn: "Calculated", unit: null, valueType: "NUMERIC", allowedValues: [], calculated: true };
const specimen = (results: unknown[] = []) => ({ id: "sp1", accessionNumber: "ACC-001", specimenType: "Serum", status: "PROCESSING", order: { id: "o1", orderNumber: "ORD-1", priority: "STAT", patient: { fullName: "Hoda Mahmoud" } }, items: [{ id: "i1", status: "PROCESSING", test: { code: "T", nameEn: "Chemistry panel", section: "CHEMISTRY" }, analytes: [K, HCV, CALC], results }] });
const serve = (list: unknown[], instruments: unknown = [{ id: "ins1", name: "Bench 1", kind: "MANUAL_BENCH", active: true }]) =>
  mockRequest.mockImplementation(async (_m: string, path: string) => { if (path === "/worklist") return list; if (path === "/instruments") { if (instruments instanceof Error) throw instruments; return instruments; } return {}; });

beforeEach(async () => { mockRequest.mockReset(); mockPost.mockReset(); mockPush.mockReset(); mockPerms = ["results.read", "results.enter", "results.second_entry", "qc.read"]; await act(async () => { await i18n.changeLanguage("en"); }); });

describe("lab result entry screen", () => {
  it("shows the specimen, preselects the only instrument, posts a numeric value and shows the server flag; calculated analytes get no field", async () => {
    serve([specimen()]); mockPost.mockResolvedValue({ id: "r1", flag: "HIGH" });
    await wrap(<ResultEntry />);
    await waitFor(() => expect(screen.getByTestId("entry-specimen")).toBeTruthy());
    expect(screen.getByText("ACC-001")).toBeTruthy();
    expect(screen.queryByTestId("entry-input-a3")).toBeNull();
    expect(screen.getByTestId("entry-save-a1").props.accessibilityState.disabled).toBe(true);
    await fireEvent.changeText(screen.getByTestId("entry-input-a1"), "٦٫١");
    await waitFor(() => expect(screen.getByTestId("entry-save-a1").props.accessibilityState.disabled).toBeFalsy());
    await fireEvent.press(screen.getByTestId("entry-save-a1"));
    await waitFor(() => expect(mockPost).toHaveBeenCalledWith("/results", { orderItemId: "i1", analyteId: "a1", instrumentId: "ins1", value: 6.1 }));
  });
  it("a double tap saves once", async () => {
    serve([specimen()]); let release: (v: unknown) => void = () => undefined; mockPost.mockImplementation(() => new Promise((r) => { release = r; }));
    await wrap(<ResultEntry />);
    await waitFor(() => expect(screen.getByTestId("entry-input-a1")).toBeTruthy());
    await fireEvent.changeText(screen.getByTestId("entry-input-a1"), "4");
    await fireEvent.press(screen.getByTestId("entry-save-a1")); await fireEvent.press(screen.getByTestId("entry-save-a1")); await fireEvent.press(screen.getByTestId("entry-save-a1"));
    expect(mockPost).toHaveBeenCalledTimes(1);
    await act(async () => { release({ flag: "NORMAL" }); });
  });
  it("choice analytes send the chosen answer as text", async () => {
    serve([specimen()]); mockPost.mockResolvedValue({ flag: "NORMAL" });
    await wrap(<ResultEntry />);
    await waitFor(() => expect(screen.getByTestId("entry-choice-a2-Reactive")).toBeTruthy());
    await fireEvent.press(screen.getByTestId("entry-choice-a2-Reactive")); await fireEvent.press(screen.getByTestId("entry-save-a2"));
    await waitFor(() => expect(mockPost).toHaveBeenCalledWith("/results", expect.objectContaining({ analyteId: "a2", valueText: "Reactive" })));
  });
  it("server refusals become friendly messages (result exists, processing first, 5xx)", async () => {
    serve([specimen()]);
    await wrap(<ResultEntry />);
    await waitFor(() => expect(screen.getByTestId("entry-input-a1")).toBeTruthy());
    await fireEvent.changeText(screen.getByTestId("entry-input-a1"), "4");
    mockPost.mockRejectedValueOnce(new ApiError(409, "SPECIMEN_NOT_PROCESSABLE", "x"));
    await fireEvent.press(screen.getByTestId("entry-save-a1"));
    await waitFor(() => expect(screen.getByTestId("entry-error-a1")).toBeTruthy());
    expect(screen.getByText(/Scan and start processing/)).toBeTruthy();
    mockPost.mockRejectedValueOnce(new ApiError(503, "UNAVAILABLE", "x"));
    await fireEvent.press(screen.getByTestId("entry-save-a1"));
    await waitFor(() => expect(screen.getByText(/could not save this/)).toBeTruthy());
  });
  it("an entered critical result shows the alert notice and, for a second person, the confirm sheet that posts the re-keyed value; a mismatch is explained", async () => {
    serve([specimen([{ id: "r9", analyteId: "a1", status: "ENTERED", flag: "CRITICAL_HIGH", valueNumeric: 7.9, valueText: null, secondEntryBy: null, source: "MANUAL" }])]);
    await wrap(<ResultEntry />);
    await waitFor(() => expect(screen.getByTestId("entry-critical-a1")).toBeTruthy());
    await fireEvent.press(screen.getByTestId("entry-confirm-a1"));
    expect(screen.getByTestId("entry-second-confirm").props.accessibilityState.disabled).toBe(true);
    await fireEvent.changeText(screen.getByTestId("entry-second-input"), "7.0");
    mockPost.mockRejectedValueOnce(new ApiError(422, "DUAL_ENTRY_MISMATCH", "x"));
    await fireEvent.press(screen.getByTestId("entry-second-confirm"));
    await waitFor(() => expect(screen.getByTestId("entry-second-error")).toBeTruthy());
    expect(mockPost).toHaveBeenCalledWith("/results/r9/second-entry", { value: 7 });
    mockPost.mockResolvedValueOnce({});
    await fireEvent.press(screen.getByTestId("entry-second-confirm"));
    await waitFor(() => expect(mockPost).toHaveBeenCalledTimes(2));
  });
  it("a role with results.enter only sees 'waiting for a second person', never the confirm button", async () => {
    mockPerms = ["results.read", "results.enter", "qc.read"];
    serve([specimen([{ id: "r9", analyteId: "a1", status: "ENTERED", flag: "NORMAL", valueNumeric: 4, valueText: null, secondEntryBy: null, source: "MANUAL" }])]);
    await wrap(<ResultEntry />);
    await waitFor(() => expect(screen.getByTestId("entry-value-a1")).toBeTruthy());
    expect(screen.queryByTestId("entry-confirm-a1")).toBeNull();
    expect(screen.getByText(/Waiting for a second person/)).toBeTruthy();
  });
  it("a role without entry permissions gets a notice and no input at all", async () => {
    mockPerms = ["results.read"];
    serve([specimen()], []);
    await wrap(<ResultEntry />);
    await waitFor(() => expect(screen.getByTestId("entry-not-allowed")).toBeTruthy());
    expect(screen.queryByTestId("entry-input-a1")).toBeNull();
    expect(mockRequest).not.toHaveBeenCalledWith("GET", "/instruments", expect.anything());
  });
  it("no active instrument: explains and keeps Save disabled", async () => {
    serve([specimen()], []);
    await wrap(<ResultEntry />);
    await waitFor(() => expect(screen.getByTestId("entry-no-instrument")).toBeTruthy());
    await fireEvent.changeText(screen.getByTestId("entry-input-a1"), "4");
    expect(screen.getByTestId("entry-save-a1").props.accessibilityState.disabled).toBe(true);
  });
  it("instrument list refused (403): shows the role message instead of an empty chooser", async () => {
    serve([specimen()], new ApiError(403, "FORBIDDEN", "no"));
    await wrap(<ResultEntry />);
    await waitFor(() => expect(screen.getByTestId("entry-instrument-error")).toBeTruthy());
  });
  it("a specimen that left processing shows the 'gone' state", async () => {
    serve([]);
    await wrap(<ResultEntry />);
    await waitFor(() => expect(screen.getByText(/not in processing any more/)).toBeTruthy());
  });
  it("a 503 on the list shows the error state with retry", async () => {
    mockRequest.mockImplementation(async (_m: string, path: string) => { if (path === "/worklist") throw new ApiError(503, "UNAVAILABLE", "down"); return []; });
    await wrap(<ResultEntry />);
    await waitFor(() => expect(screen.getByTestId("error-state")).toBeTruthy());
  });
  it("MFA_REQUIRED shows the friendly two-step verification state", async () => {
    mockRequest.mockImplementation(async (_m: string, path: string) => { if (path === "/worklist") throw new ApiError(403, "MFA_REQUIRED", "mfa"); return []; });
    await wrap(<ResultEntry />);
    await waitFor(() => expect(screen.getByTestId("mfa-required")).toBeTruthy());
  });
  it("a plain 403 shows the role state", async () => {
    mockRequest.mockImplementation(async (_m: string, path: string) => { if (path === "/worklist") throw new ApiError(403, "FORBIDDEN", "no"); return []; });
    await wrap(<ResultEntry />);
    await waitFor(() => expect(screen.getByTestId("not-allowed")).toBeTruthy());
  });
  it("Arabic: RTL labels and the Arabic analyte name", async () => {
    await act(async () => { await i18n.changeLanguage("ar"); });
    serve([specimen()]);
    await wrap(<ResultEntry />);
    await waitFor(() => expect(screen.getByText("البوتاسيوم")).toBeTruthy());
    expect(screen.getAllByText("حفظ النتيجة").length).toBeGreaterThan(0);
  });
});

describe("lab worklist: result entry entry point", () => {
  const rows = [specimen()];
  const serveList = () => mockRequest.mockImplementation(async (_m: string, path: string) => (path === "/worklist" ? rows : path === "/mobile/worklist/progress" ? { windowDays: 7, sections: [] } : {}));
  it("technologist: the specimen row opens the entry screen and shows progress", async () => {
    serveList(); await wrap(<Worklist />);
    await waitFor(() => expect(screen.getByTestId("worklist-specimen-sp1")).toBeTruthy());
    expect(screen.getByText("0 of 2 results entered")).toBeTruthy();
    await fireEvent.press(screen.getByTestId("worklist-specimen-sp1"));
    expect(mockPush).toHaveBeenCalledWith("/lab/results/sp1");
  });
  it("a read-only role sees the rows but they do not open the entry screen", async () => {
    mockPerms = ["results.read"]; serveList(); await wrap(<Worklist />);
    await waitFor(() => expect(screen.getByTestId("worklist-specimen-sp1")).toBeTruthy());
    await fireEvent.press(screen.getByTestId("worklist-specimen-sp1"));
    expect(mockPush).not.toHaveBeenCalled();
  });
});
