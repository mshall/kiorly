import type { ReactElement } from "react";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SafeAreaProvider } from "react-native-safe-area-context";
import i18n from "@/i18n";
import { ThemeProvider } from "@/theme";
import { ToastProvider } from "@/components/ui";
import { ApiError } from "@/api/errors";
import type { GrowthOverview } from "@/modules/clinic/growth";

const mockRequest = jest.fn();
jest.mock("@/api/client", () => {
  const request = (...a: unknown[]) => mockRequest(...a);
  return { request, api: { get: (p: string, path: string, o?: unknown) => request(p, "GET", path, o), post: jest.fn(), patch: jest.fn(), put: jest.fn(), del: jest.fn() }, configureClient: jest.fn() };
});
jest.mock("@/auth/SessionProvider", () => ({ useSessions: () => ({ sessions: { clinic: { email: "o@x.test", bootstrap: undefined } }, products: ["clinic"], isEntitled: () => true }) }));
jest.mock("expo-router", () => ({ useRouter: () => ({ push: jest.fn(), back: jest.fn(), replace: jest.fn() }), useLocalSearchParams: () => ({}), Stack: { Screen: () => null } }));
const mockShare = jest.fn(); const mockWa = jest.fn(); const mockSms = jest.fn(); const mockWeb = jest.fn(); const mockCopy = jest.fn();
jest.mock("@/lib/shareLink", () => ({ shareLink: (...a: unknown[]) => mockShare(...a), openWhatsapp: (...a: unknown[]) => mockWa(...a), openSms: (...a: unknown[]) => mockSms(...a), openWeb: (...a: unknown[]) => mockWeb(...a), copyText: (...a: unknown[]) => mockCopy(...a) }));

import Growth from "../../app/(tabs)/(more)/clinic/growth";

const wrap = (ui: ReactElement) => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(<SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 800 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } }}><QueryClientProvider client={qc}><ThemeProvider><ToastProvider>{ui}</ToastProvider></ThemeProvider></QueryClientProvider></SafeAreaProvider>);
};
const setLang = (l: string) => act(async () => { await i18n.changeLanguage(l); });
const SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2 2"><rect width="1" height="1" fill="#000"/></svg>';
const stats = (b: number, a: number, n: number) => ({ bookings: b, attended: a, cancelledOrNoShow: 0, newPatients: n, attendedRate: null, cancellationRate: null });
const overview = (over: Partial<GrowthOverview> = {}): GrowthOverview => ({
  level: "admin", can: { create: true, pause: true, widget: false }, plan: { key: "PRO", maxActiveLinks: 25, linksUsed: 1 }, clinic: { id: "c1", nameEn: "Maadi Clinic", nameAr: "عيادة المعادي" },
  profile: { kind: "clinic", kiorexUrl: "http://localhost:5180/ar/eg/clinic/maadi", pageUrl: null, ready: true },
  links: [{ id: "l1", code: "ABCD2345", label: "Reception desk", ownerScope: "DESK", channelKind: "QR_DESK", status: "ACTIVE", shortUrl: "http://localhost:5173/q/ABCD2345", targetNameEn: "Maadi Clinic", targetNameAr: "عيادة المعادي", last30: { visits: 40, bookings: 10, attended: 6 } }],
  summary: { days: 30, totals: { visits: 40, bookings: 10, attended: 6 }, links: 1 },
  performance: { days: 30, providerOriginated: stats(10, 6, 4), marketplaceOriginated: stats(5, 3, 3), links: { visits: 40, bookings: 10, attended: 6, visitToBooking: 0.25, bookingToAttended: 0.6 }, incrementalMarketplaceRevenue: 900, commission: { currency: "EGP", total: 120, incrementalRevenueNet: 780 } },
  recommendations: [{ id: "PRINT_RECEPTION_QR", severity: "low", params: {}, action: "links" }],
  commission: { period: "2026-11", currency: "EGP", chargesByStatus: {}, providerLedBookings: 10, byDecision: {}, totals: { expectedFromDecisions: "120.00", activeCharges: "120.00", reversedOrWaived: "0.00" }, reconciled: true, statement: "s" },
  webGrowthUrl: "http://localhost:5173/kiorex/growth", promise: "Bookings through your links never carry a Kiorex fee.", serverTime: "2026-11-24T10:00:00Z", ...over,
});
const route = (map: Record<string, unknown>) => mockRequest.mockImplementation(async (_p: string, method: string, path: string) => {
  const k = `${method} ${path}`;
  if (k in map) { const v = map[k]; if (v instanceof Error) throw v; return v; }
  throw new ApiError(404, "NOT_FOUND", "nope");
});
const QR = { "GET /mobile/growth/qr": { url: "http://localhost:5173/q/ABCD2345", svg: SVG, linkId: "l1" } };

beforeEach(() => { mockRequest.mockReset(); [mockShare, mockWa, mockSms, mockWeb, mockCopy].forEach((m) => m.mockReset()); mockShare.mockResolvedValue("shared"); mockCopy.mockResolvedValue(true); });
afterEach(async () => { await setLang("ar"); });

describe("Growth tab", () => {
  it("shows the profile link, share actions, links with counts, performance, recommendations and the fee statement (English)", async () => {
    await setLang("en");
    route({ "GET /mobile/growth": overview(), ...QR });
    await wrap(<Growth />);
    expect(await screen.findByText("http://localhost:5180/ar/eg/clinic/maadi")).toBeTruthy();
    expect(screen.getByText("Reception desk")).toBeTruthy();
    expect(screen.getAllByText("40").length).toBeGreaterThan(0);
    expect(within(screen.getByTestId("growth-perf-provider")).getByText("10", { exact: false })).toBeTruthy();
    expect(within(screen.getByTestId("growth-perf-marketplace")).getByText("5", { exact: false })).toBeTruthy();
    expect(within(screen.getByTestId("growth-perf")).getByText("67%", { exact: false })).toBeTruthy();
    expect(within(screen.getByTestId("growth-recs")).getByText("Print a QR card", { exact: false })).toBeTruthy();
    expect(within(screen.getByTestId("growth-commission")).getByText("The statement matches every decision", { exact: false })).toBeTruthy();
    await fireEvent.press(screen.getByTestId("growth-share"));
    await waitFor(() => expect(mockShare).toHaveBeenCalledWith("Book with Maadi Clinic on Kiorex: http://localhost:5180/ar/eg/clinic/maadi", "http://localhost:5180/ar/eg/clinic/maadi"));
    await fireEvent.press(screen.getByTestId("growth-whatsapp"));
    expect(mockWa).toHaveBeenCalledWith(expect.stringContaining("http://localhost:5180/ar/eg/clinic/maadi"));
    await fireEvent.press(screen.getByTestId("growth-sms"));
    expect(mockSms).toHaveBeenCalled();
    await fireEvent.press(screen.getByTestId("growth-copy"));
    await waitFor(() => expect(mockCopy).toHaveBeenCalledWith("http://localhost:5180/ar/eg/clinic/maadi"));
    await fireEvent.press(screen.getByTestId("growth-web"));
    expect(mockWeb).toHaveBeenCalledWith("http://localhost:5173/kiorex/growth");
  });

  it("renders in Arabic with Arabic-Indic digits and the no-fee promise", async () => {
    await setLang("ar");
    route({ "GET /mobile/growth": overview(), ...QR });
    await wrap(<Growth />);
    expect(within(await screen.findByTestId("growth-profile")).getByText("ملفك العام على كيوريكس", { exact: false })).toBeTruthy();
    expect(within(screen.getByTestId("growth-link-l1")).getByText("٤٠", { exact: false })).toBeTruthy();
    expect(within(screen.getByTestId("growth-perf")).getByText("٦٧٪", { exact: false })).toBeTruthy();
    expect(within(screen.getByTestId("growth-commission")).getByText("بدون رسوم", { exact: false })).toBeTruthy();
  });

  it("a doctor sees the own-link note, no performance, no commission and no create button", async () => {
    await setLang("en");
    route({ "GET /mobile/growth": overview({ level: "doctor", can: { create: false, pause: false, widget: false }, performance: null, commission: null, recommendations: [], plan: null }), ...QR });
    await wrap(<Growth />);
    expect(await screen.findByTestId("growth-doctor-note")).toBeTruthy();
    expect(screen.queryByTestId("growth-perf")).toBeNull();
    expect(screen.queryByTestId("growth-commission")).toBeNull();
    expect(screen.queryByTestId("growth-new-link")).toBeNull();
  });

  it("empty states: no profile yet and no links", async () => {
    await setLang("en");
    route({ "GET /mobile/growth": overview({ links: [], profile: { kind: "clinic", kiorexUrl: null, pageUrl: null, ready: false }, performance: { ...overview().performance!, providerOriginated: stats(0, 0, 0), marketplaceOriginated: stats(0, 0, 0) } }) });
    await wrap(<Growth />);
    expect(await screen.findByTestId("growth-profile-notready")).toBeTruthy();
    expect(screen.getByTestId("growth-links-empty")).toBeTruthy();
    expect(screen.getByTestId("growth-perf-none")).toBeTruthy();
    expect(screen.queryByTestId("growth-qr-card")).toBeNull();
  });

  it("creates a link from the sheet, pauses one, and tells the user when offline", async () => {
    await setLang("en");
    const calls: string[] = [];
    mockRequest.mockImplementation(async (_p: string, method: string, path: string, o?: { body?: Record<string, unknown> }) => {
      calls.push(`${method} ${path} ${JSON.stringify(o?.body ?? {})}`);
      if (path === "/mobile/growth") return overview();
      if (path === "/mobile/growth/qr") return QR["GET /mobile/growth/qr"];
      if (method === "POST") return { id: "new" };
      if (method === "PATCH") throw new ApiError(0, "NETWORK", "offline");
      return null;
    });
    await wrap(<Growth />);
    await fireEvent.press(await screen.findByTestId("growth-new-link"));
    const save = await screen.findByTestId("growth-create-save");
    await fireEvent.changeText(screen.getByTestId("growth-create-label"), "WhatsApp status");
    await fireEvent.press(screen.getByTestId("growth-channel-WHATSAPP_SHARE"));
    await fireEvent.press(save);
    await waitFor(() => expect(calls.some((c) => c.startsWith("POST /mobile/growth/links") && c.includes('"label":"WhatsApp status"') && c.includes('"channelKind":"WHATSAPP_SHARE"') && c.includes('"ownerScope":"CLINIC"'))).toBe(true));
    await fireEvent.press(screen.getByTestId("growth-link-l1"));
    await fireEvent.press(await screen.findByText("Pause"));
    expect(await screen.findByText("This needs a connection. Try again when you are online.")).toBeTruthy();
  });

  it("a front-desk 403 shows the not-allowed banner", async () => {
    await setLang("en");
    route({ "GET /mobile/growth": new ApiError(403, "MODULE_NOT_ALLOWED", "no") });
    await wrap(<Growth />);
    expect(await screen.findByTestId("not-allowed")).toBeTruthy();
  });

  it("shows the retryable error state when the API fails, and the unavailable state for FEATURE_DISABLED", async () => {
    await setLang("en");
    route({ "GET /mobile/growth": new ApiError(500, "HTTP_500", "boom") });
    const first = await wrap(<Growth />);
    expect(await screen.findByTestId("error-state")).toBeTruthy();
    first.unmount();
    route({ "GET /mobile/growth": new ApiError(403, "FEATURE_DISABLED", "off", { key: "mobile_staff_app", scope: "org" }) });
    await wrap(<Growth />);
    expect(await screen.findByTestId("unavailable")).toBeTruthy();
  });

});
