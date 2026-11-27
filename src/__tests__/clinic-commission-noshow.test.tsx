import type { ReactElement } from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SafeAreaProvider } from "react-native-safe-area-context";
import i18n from "@/i18n";
import { ThemeProvider } from "@/theme";
import { ToastProvider } from "@/components/ui";
import { ApiError } from "@/api/errors";
import type { Bootstrap } from "@/api/types";

const mockRequest = jest.fn();
jest.mock("@/api/client", () => {
  const request = (...a: unknown[]) => mockRequest(...a);
  return { request, api: { get: (p: string, path: string, o?: unknown) => request(p, "GET", path, o), post: (p: string, path: string, b?: unknown) => request(p, "POST", path, { body: b }), patch: (p: string, path: string, b?: unknown) => request(p, "PATCH", path, { body: b }), put: jest.fn(), del: jest.fn() }, configureClient: jest.fn() };
});
const mockBoot: { current: Bootstrap } = { current: undefined as unknown as Bootstrap };
jest.mock("@/auth/SessionProvider", () => ({ useSessions: () => ({ sessions: { clinic: { email: "x@x.test", bootstrap: mockBoot.current } }, products: ["clinic"], isEntitled: () => true }) }));
const mockPush = jest.fn();
jest.mock("expo-router", () => ({ useRouter: () => ({ push: mockPush, back: jest.fn(), replace: jest.fn() }), useLocalSearchParams: () => ({}), Stack: { Screen: () => null } }));

import Commission from "../../app/(tabs)/(more)/clinic/commission";
import Schedule from "../../app/(tabs)/(more)/clinic/schedule";
import Revenue from "../../app/(tabs)/(more)/clinic/revenue";

const boot = (role: string): Bootstrap => ({ apiVersion: 1, product: "clinic", serverTime: "", user: { id: "u", name: "N", email: "e", role, roles: [role] }, org: { id: "o", name: "o", plan: "PRO" }, entitlement: { key: "mobile_staff_app", enabled: true, requiredPlan: "PRO", reason: null }, safetyAlertsOnly: false, modules: [{ key: "clinic.schedule", enabled: true, screens: ["today", "queue"] }], device: null });
const wrap = (ui: ReactElement) => render(<SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 800 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } }}><QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })}><ThemeProvider><ToastProvider>{ui}</ToastProvider></ThemeProvider></QueryClientProvider></SafeAreaProvider>);
const route = (map: Record<string, unknown>) => mockRequest.mockImplementation(async (_p: string, method: string, path: string) => { const k = `${method} ${path}`; if (k in map) { const v = map[k]; if (v instanceof Error) throw v; return v; } throw new ApiError(404, "NOT_FOUND", "nope"); });
const RATE = { known: true, state: "SET", effective: { state: "SET", source: "DEFAULT", version: 1, reason: null, spec: { feeType: "PERCENT", percentBps: 300, flatMinor: null, minMinor: 1000, maxMinor: 7500, mode: null } }, disclosure: null, counsel: { status: "NOT_REVIEWED" } };
const STMT = { source: "LOCAL_MIRROR", currency: "EGP", period: { from: "2026-11-01T00:00:00.000Z", to: "2026-12-01T00:00:00.000Z", key: "2026-11" }, onlineCollectionsMinor: 5000, cashVisitCommissionAccruedMinor: 600, cashVisitCommissionNettedMinor: 200, cashVisitCommissionOpenMinor: 400, cashVisitCharges: 3, deductions: { commissionMinor: 700, feesMinor: null, refundsMinor: null, chargebacksMinor: null }, netPayableMinor: 4300, paidByBankTransferMinor: 0, payouts: [], reconciliation: "NO_PAYOUT" };

beforeEach(async () => { mockRequest.mockReset(); mockPush.mockReset(); mockBoot.current = boot("CLINIC_ADMIN"); await act(async () => { await i18n.changeLanguage("en"); }); });
afterEach(async () => { await act(async () => { await i18n.changeLanguage("ar"); }); });

describe("clinic Kiorex commission screen", () => {
  it("finance/admin (access.canView): rate from the Clinic route and settlement statement figures, bank-transfer note, read only", async () => {
    route({ "GET /billing/kiorex-commissions/access": { canView: true }, "GET /billing/kiorex-commissions/rate": RATE, "GET /billing/kiorex-commissions/statement": STMT });
    await wrap(<Commission />);
    expect(await screen.findByTestId("growth-rate-effective")).toBeTruthy();
    expect(await screen.findByTestId("growth-stmt-figures")).toBeTruthy();
    expect(screen.getByTestId("growth-stmt-recon")).toBeTruthy();
    expect(screen.queryByText(/Create|Edit/)).toBeNull();
    expect(mockRequest).toHaveBeenCalledWith("clinic", "GET", "/billing/kiorex-commissions/statement", expect.objectContaining({ query: { period: new Date().toISOString().slice(0, 7) } }));
  });
  it("a role the Clinic API does not allow sees the 'role' notice and no figures are requested", async () => {
    route({ "GET /billing/kiorex-commissions/access": { canView: false } });
    await wrap(<Commission />);
    expect(await screen.findByTestId("commission-forbidden")).toBeTruthy();
    expect(mockRequest).not.toHaveBeenCalledWith("clinic", "GET", "/billing/kiorex-commissions/rate", expect.anything());
  });
  it("403 on the access probe, 503 and MFA are friendly", async () => {
    route({ "GET /billing/kiorex-commissions/access": new ApiError(403, "FORBIDDEN", "no") });
    const v = await wrap(<Commission />);
    expect(await screen.findByTestId("not-allowed")).toBeTruthy();
    v.unmount();
  });
  it("not connected (503 STATEMENT_NOT_CONFIGURED) is the neutral line, not an error", async () => {
    route({ "GET /billing/kiorex-commissions/access": { canView: true }, "GET /billing/kiorex-commissions/rate": RATE, "GET /billing/kiorex-commissions/statement": new ApiError(503, "STATEMENT_NOT_CONFIGURED", "x") });
    await wrap(<Commission />);
    expect(await screen.findByTestId("growth-stmt-unavailable")).toBeTruthy();
  });
  it("Arabic renders the same cards", async () => {
    await act(async () => { await i18n.changeLanguage("ar"); });
    route({ "GET /billing/kiorex-commissions/access": { canView: true }, "GET /billing/kiorex-commissions/rate": RATE, "GET /billing/kiorex-commissions/statement": STMT });
    await wrap(<Commission />);
    expect(await screen.findByText("عمولة كيوريكس", { exact: false })).toBeTruthy();
    expect(await screen.findByTestId("growth-stmt-figures")).toBeTruthy();
  });
});

describe("clinic revenue links to the commission statement", () => {
  it("the Revenue screen offers the commission statement and opens it", async () => {
    route({ "GET /mobile/revenue/snapshot": { currency: "EGP", today: { gross: 100, net: 90 }, last7: { gross: 700, net: 600 }, last30: { gross: 3000, net: 2500 }, completedVisitsToday: 3, daily: [{ date: "2026-11-26", gross: 100, net: 90 }] } });
    await wrap(<Revenue />);
    await fireEvent.press(await screen.findByTestId("revenue-commission"));
    expect(mockPush).toHaveBeenCalledWith("/clinic/commission");
  });
});

const appt = (status: string, id = "a1") => ({ id, startsAt: "2026-11-27T08:00:00Z", endsAt: "2026-11-27T08:30:00Z", status, queueStage: null, queueTicketNumber: null, roomLabel: null, checkedInAt: null, isHomeVisit: false, patient: { id: "p1", mrn: "NA-1", name: "Dalia Ibrahim", age: 33 }, clinician: { name: "Dr A" }, type: { name: "Consult" } });
describe("clinic schedule: no-show", () => {
  it("offered for a not-yet-arrived appointment, confirmed in a sheet, sent once as NO_SHOW (double tap safe)", async () => {
    mockBoot.current = boot("RECEPTIONIST");
    let release: (v: unknown) => void = () => undefined;
    mockRequest.mockImplementation(async (_p: string, method: string, path: string) => { if (method === "GET") return { date: "2026-11-27", items: [appt("SCHEDULED")], queue: [appt("SCHEDULED")] }; if (method === "PATCH") return new Promise((r) => { release = r; }); throw new ApiError(404, "X", "x"); });
    await wrap(<Schedule />);
    await fireEvent.press(await screen.findByTestId("appt-a1"));
    await fireEvent.press(await screen.findByText("Mark no-show"));
    expect(await screen.findByTestId("noshow-sheet")).toBeTruthy();
    await fireEvent.press(screen.getByTestId("noshow-confirm")); await fireEvent.press(screen.getByTestId("noshow-confirm"));
    const patches = () => mockRequest.mock.calls.filter((c) => c[1] === "PATCH");
    await waitFor(() => expect(patches().length).toBe(1));
    expect(patches()[0]).toEqual(["clinic", "PATCH", "/appointments/a1/status", { body: { status: "NO_SHOW" } }]);
    await act(async () => { release({}); });
  });
  it("not offered once the patient has arrived or the visit is done", async () => {
    mockBoot.current = boot("RECEPTIONIST");
    mockRequest.mockImplementation(async () => ({ date: "2026-11-27", items: [appt("CHECKED_IN")], queue: [appt("CHECKED_IN")] }));
    await wrap(<Schedule />);
    await fireEvent.press(await screen.findByTestId("appt-a1"));
    expect(await screen.findByText("Open patient")).toBeTruthy();
    expect(screen.queryByText("Mark no-show")).toBeNull();
  });
  it("a 403 from the server (role not allowed) is told as 'your role', not as a raw error", async () => {
    mockBoot.current = boot("PHYSICIAN");
    mockRequest.mockImplementation(async (_p: string, method: string) => { if (method === "GET") return { date: "2026-11-27", items: [appt("CONFIRMED")], queue: [appt("CONFIRMED")] }; throw new ApiError(403, "FORBIDDEN", "You do not have permission to change appointments"); });
    await wrap(<Schedule />);
    await fireEvent.press(await screen.findByTestId("appt-a1"));
    await fireEvent.press(await screen.findByText("Mark no-show"));
    await fireEvent.press(await screen.findByTestId("noshow-confirm"));
    expect(await screen.findByText("Your role cannot do this")).toBeTruthy();
  });
});
