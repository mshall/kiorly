import type { ReactElement } from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SafeAreaProvider } from "react-native-safe-area-context";
import i18n from "@/i18n";
import { ThemeProvider } from "@/theme";
import { ApiError } from "@/api/errors";
import type { Bootstrap } from "@/api/types";

const mockRequest = jest.fn();
jest.mock("@/api/client", () => {
  const request = (...a: unknown[]) => mockRequest(...a);
  return { request, api: { get: (p: string, path: string, o?: unknown) => request(p, "GET", path, o), post: (p: string, path: string, b?: unknown) => request(p, "POST", path, { body: b }), patch: (p: string, path: string, b?: unknown) => request(p, "PATCH", path, { body: b }), put: jest.fn(), del: jest.fn() }, configureClient: jest.fn() };
});
const mockBoot: { current: Bootstrap } = { current: undefined as unknown as Bootstrap };
jest.mock("@/auth/SessionProvider", () => ({ useSessions: () => ({ sessions: { clinic: { email: "doc@x.test", bootstrap: mockBoot.current } }, products: ["clinic"], isEntitled: () => true }) }));
const mockPush = jest.fn();
let mockParams: Record<string, string> = {};
jest.mock("expo-router", () => ({ useRouter: () => ({ push: mockPush, back: jest.fn(), replace: jest.fn() }), useLocalSearchParams: () => mockParams, Stack: { Screen: () => null } }));

import Schedule from "../../app/clinic/schedule";
import Prescriptions from "../../app/clinic/prescriptions";
import QuickVitals from "../../app/clinic/vitals";
import Revenue from "../../app/clinic/revenue";
import LabResults from "../../app/clinic/lab-results";
import { enqueue, getQueue, __resetForTests } from "@/offline/queue";

const bootstrap = (role: string, screens: Record<string, string[]>): Bootstrap => ({ apiVersion: 1, product: "clinic", serverTime: "", user: { id: "u", name: "Dr", email: "e", role, roles: [role] }, org: { id: "o", name: "o", plan: "PRO" }, entitlement: { key: "mobile_staff_app", enabled: true, requiredPlan: "PRO", reason: null }, safetyAlertsOnly: false, device: null, modules: Object.entries(screens).map(([key, s]) => ({ key, enabled: true, screens: s })) });
const DOCTOR = bootstrap("PHYSICIAN", { "clinic.visits": ["start"], "clinic.prescriptions": ["sign"], "clinic.labs": ["approve"], "clinic.vitals": ["entry"] });
const NURSE = bootstrap("NURSE", { "clinic.prescriptions": ["review"], "clinic.vitals": ["entry"] });

const wrap = (ui: ReactElement) => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(<SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 800 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } }}><QueryClientProvider client={qc}><ThemeProvider>{ui}</ThemeProvider></QueryClientProvider></SafeAreaProvider>);
};
const setLang = (l: string) => act(async () => { await i18n.changeLanguage(l); });
const route = (map: Record<string, unknown>) => mockRequest.mockImplementation(async (_p: string, method: string, path: string) => {
  const k = `${method} ${path}`;
  if (k in map) { const v = map[k]; if (v instanceof Error) throw v; return v; }
  throw new ApiError(404, "NOT_FOUND", "nope");
});

beforeEach(() => { mockRequest.mockReset(); mockPush.mockReset(); mockParams = {}; mockBoot.current = DOCTOR; __resetForTests(); });
afterEach(async () => { await setLang("ar"); });

const appt = (over = {}) => ({ id: "a1", startsAt: "2026-11-20T08:00:00Z", endsAt: "2026-11-20T08:30:00Z", status: "CHECKED_IN", queueStage: "WAITING", queueTicketNumber: 7, roomLabel: "Room 1", checkedInAt: new Date(Date.now() - 12 * 60000).toISOString(), isHomeVisit: false, patient: { id: "p1", mrn: "NA-1", name: "Dalia Ibrahim", nameAr: "داليا إبراهيم" }, type: { name: "Consultation", nameAr: "كشف" }, ...over });

describe("clinic schedule", () => {
  it("shows the live queue with ticket, wait time and status in Arabic, and opens the action sheet", async () => {
    const a = appt();
    route({ "GET /mobile/schedule": { date: "2026-11-20", items: [a], queue: [a] } });
    await wrap(<Schedule />);
    expect(await screen.findByText(/#7 · داليا إبراهيم/)).toBeTruthy();
    expect(screen.getAllByText("في الانتظار").length).toBeGreaterThan(0);
    expect(screen.getByText("ينتظر ١٢ د")).toBeTruthy();
    await fireEvent.press(screen.getByTestId("appt-a1"));
    expect(await screen.findByText("بدء / متابعة الزيارة")).toBeTruthy();
    await fireEvent.press(screen.getByText("بدء / متابعة الزيارة"));
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/clinic/visit/a1"));
  });
  it("hides 'start visit' for a nurse and renders English", async () => {
    mockBoot.current = NURSE; await setLang("en");
    const a = appt();
    route({ "GET /mobile/schedule": { date: "2026-11-20", items: [a], queue: [a] } });
    await wrap(<Schedule />);
    await fireEvent.press(await screen.findByTestId("appt-a1"));
    expect(await screen.findByText("Open patient")).toBeTruthy();
    expect(screen.queryByText("Start / continue visit")).toBeNull();
  });
  it("shows an empty state", async () => {
    route({ "GET /mobile/schedule": { date: "2026-11-20", items: [], queue: [] } });
    await wrap(<Schedule />);
    expect(await screen.findByText("لا توجد مواعيد اليوم")).toBeTruthy();
  });
  it("shows a friendly not-allowed message on 403", async () => {
    route({ "GET /mobile/schedule": new ApiError(403, "FORBIDDEN", "no") });
    await wrap(<Schedule />);
    expect(await screen.findByTestId("not-allowed")).toBeTruthy();
  });
});

describe("clinic prescriptions", () => {
  const rx = { encounterId: "e1", status: "DRAFT", visitType: "Consultation", updatedAt: "2026-11-20T10:00:00Z", patient: { id: "p1", mrn: "NA-1", name: "Hoda Mahmoud", nameAr: "هدى محمود" }, diagnoses: [], medications: [{ id: "m1", drugName: "Cetirizine 10 mg", dosage: "10 mg", route: "PO" }] };
  it("signs after a confirm step", async () => {
    await setLang("en");
    route({ "GET /mobile/prescriptions": { items: [rx] }, "POST /mobile/prescriptions/e1/sign": { ok: true } });
    await wrap(<Prescriptions />);
    await fireEvent.press(await screen.findByTestId("rx-e1"));
    await fireEvent.press(await screen.findByTestId("rx-sign"));
    await fireEvent.press(await screen.findByTestId("rx-confirm-yes"));
    await waitFor(() => expect(mockRequest).toHaveBeenCalledWith("clinic", "POST", "/mobile/prescriptions/e1/sign", { body: {} }));
  });
  it("is read-only for a nurse", async () => {
    mockBoot.current = NURSE; await setLang("en");
    route({ "GET /mobile/prescriptions": { items: [rx] } });
    await wrap(<Prescriptions />);
    await fireEvent.press(await screen.findByTestId("rx-e1"));
    expect(await screen.findByText("Your role can view this but not sign.")).toBeTruthy();
    expect(screen.queryByTestId("rx-sign")).toBeNull();
  });
});

describe("clinic vitals (offline-first)", () => {
  it("validates, then queues the reading when the network is down", async () => {
    await setLang("en"); mockParams = { patientId: "p1" };
    mockRequest.mockImplementation(async (_p: string, method: string, path: string) => {
      if (method === "POST") throw new ApiError(0, "NETWORK", "offline");
      if (path === "/patients/p1") return { id: "p1", mrn: "NA-1", firstNameEn: "Hoda", lastNameEn: "Mahmoud" };
      throw new ApiError(404, "NOT_FOUND", "x");
    });
    await wrap(<QuickVitals />);
    expect(screen.getByTestId("vitals-submit").props.accessibilityState?.disabled).toBe(true);
    await fireEvent.changeText(screen.getByTestId("vital-systolic"), "120");
    await fireEvent.changeText(screen.getByTestId("vital-diastolic"), "80");
    await fireEvent.changeText(screen.getByTestId("vital-spo2"), "97");
    await fireEvent.press(screen.getByTestId("vitals-submit"));
    expect(await screen.findByTestId("vitals-queued")).toBeTruthy();
    expect(getQueue()).toHaveLength(1);
    expect(getQueue()[0]).toMatchObject({ method: "POST", path: "/mobile/vitals", body: { patientId: "p1", systolic: 120, diastolic: 80, spo2: 97 } });
  });
  it("shows a critical banner from the server result", async () => {
    await setLang("en"); mockParams = { patientId: "p1" };
    mockRequest.mockImplementation(async (_p: string, method: string, path: string) => {
      if (method === "POST") return { id: "v1", flags: ["SPO2_LOW"], critical: true };
      if (path === "/patients/p1") return { id: "p1", mrn: "NA-1", firstNameEn: "Hoda", lastNameEn: "Mahmoud" };
      throw new ApiError(404, "NOT_FOUND", "x");
    });
    await wrap(<QuickVitals />);
    await fireEvent.changeText(screen.getByTestId("vital-spo2"), "85");
    expect(await screen.findByTestId("vitals-hint")).toBeTruthy();
    await fireEvent.press(screen.getByTestId("vitals-submit"));
    expect(await screen.findByText("Critical reading")).toBeTruthy();
  });
});

describe("clinic revenue and lab results", () => {
  it("renders the owner snapshot", async () => {
    await setLang("en");
    route({ "GET /mobile/revenue/snapshot": { currency: "EGP", today: { net: 0, gross: 0 }, last7: { net: 40907, gross: 46634 }, last30: { net: 171730, gross: 195772 }, completedVisitsToday: 2, daily: [{ date: "2026-11-18", net: 5473, gross: 6240 }, { date: "2026-11-19", net: 6845, gross: 7804 }, { date: "2026-11-20", net: 7000, gross: 8000 }] } });
    await wrap(<Revenue />);
    expect(await screen.findByTestId("rev-7")).toBeTruthy();
    expect(screen.getByText("2 visits completed today")).toBeTruthy();
  });
  it("highlights critical lab results first and lets a doctor approve", async () => {
    await setLang("en");
    const pat = { id: "p1", mrn: "NA-1", name: "Hoda Mahmoud" };
    route({ "GET /mobile/lab-results": { items: [{ orderId: "o1", resultsReadyAt: "2026-11-20T10:00:00Z", critical: false, patient: pat, items: [{ code: "HB", name: "Haemoglobin", value: "13.2", unit: "g/dL", flag: "N" }], review: null }, { orderId: "o2", resultsReadyAt: "2026-11-20T10:00:00Z", critical: true, patient: pat, items: [{ code: "K", name: "Potassium", value: "6.9", unit: "mmol/L", flag: "CRITICAL_HIGH" }], review: null }] }, "POST /mobile/lab-results/o2/approve": { ok: true } });
    await wrap(<LabResults />);
    const rows = await screen.findAllByText("Hoda Mahmoud");
    expect(rows).toHaveLength(2);
    expect(screen.getAllByText("Critical")[0]).toBeTruthy();
    await fireEvent.press(screen.getByTestId("lab-o2"));
    await fireEvent.press(await screen.findByTestId("lab-approve"));
    await waitFor(() => expect(mockRequest).toHaveBeenCalledWith("clinic", "POST", "/mobile/lab-results/o2/approve", { body: {} }));
  });
});

void enqueue;
