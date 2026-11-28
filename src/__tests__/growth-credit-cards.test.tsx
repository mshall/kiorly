import type { ReactElement } from "react";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SafeAreaProvider } from "react-native-safe-area-context";
import i18n from "@/i18n";
import { ThemeProvider } from "@/theme";
import { ToastProvider } from "@/components/ui";
import { ApiError } from "@/api/errors";
import type { GrowthOverview } from "@/modules/clinic/growth";
import type { CreditWallet, PromotionRow } from "@/modules/clinic/growth-credit";

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
const daysFromNow = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString();
const wallet = (over: Partial<CreditWallet> = {}): CreditWallet => ({ balance: "1500.00", currency: "EGP", upcomingExpiries: [{ expiresAt: daysFromNow(12), amount: "300.00", entryId: "e1" }], spendableByUse: { KIOREX_FEES: "1500.00", SUBSCRIPTION: "1000.00", PROMOTIONS: "0.00" }, total: 3, ...over });
const promo = (id: string, status: PromotionRow["status"], over: Partial<PromotionRow> = {}): PromotionRow => ({ id, status, version: { nameAr: "خصم الشتاء", nameEn: "Winter offer", startsAt: "2026-11-01T00:00:00Z", endsAt: "2026-12-31T00:00:00Z" }, budget: { capMinor: 100_000, reservedMinor: 10_000, debitedMinor: 40_000, remainingMinor: 50_000 }, ...over });

beforeEach(() => { mockRequest.mockReset(); [mockShare, mockWa, mockSms, mockWeb, mockCopy].forEach((m) => m.mockReset()); mockShare.mockResolvedValue("shared"); mockCopy.mockResolvedValue(true); });
afterEach(async () => { await setLang("ar"); });

describe("Growth tab: credit and promotion cards", () => {
  it("shows the credit balance, the next expiry, what it can pay for and the not-cash note (English)", async () => {
    await setLang("en");
    route({ "GET /mobile/growth": overview(), "GET /credits/wallet": wallet(), "GET /promotions": [], ...QR });
    await wrap(<Growth />);
    const card = await screen.findByTestId("growth-credit");
    expect(within(card).getAllByText("1,500.00", { exact: false }).length).toBeGreaterThan(0);
    expect(within(card).getByTestId("growth-credit-expiry").props.children).toContain("12 days");
    expect(within(card).getByText("Kiorex fees")).toBeTruthy();
    expect(within(card).getByText("Subscription")).toBeTruthy();
    expect(within(card).queryByText("Promotions")).toBeNull(); // 0.00 spendable is left out
    expect(within(card).getByText("not cash", { exact: false })).toBeTruthy();
    await fireEvent.press(within(card).getByTestId("growth-credit-web"));
    expect(mockWeb).toHaveBeenCalledWith("http://localhost:5173/kiorex/growth");
  });

  it("renders the credit card in Arabic with Arabic-Indic digits", async () => {
    await setLang("ar");
    route({ "GET /mobile/growth": overview(), "GET /credits/wallet": wallet(), "GET /promotions": [promo("p1", "ACTIVE")], ...QR });
    await wrap(<Growth />);
    const card = await screen.findByTestId("growth-credit");
    expect(within(card).getByText("رصيد كيوريكس")).toBeTruthy();
    expect(within(card).getByText("رسوم كيوريكس")).toBeTruthy();
    expect(within(card).getByText("12", { exact: false })).toBeTruthy();
    expect(within(await screen.findByTestId("growth-promo-p1")).getByText("نشط")).toBeTruthy();
  });

  it("empty wallet says so; no expiry line; no spendable list", async () => {
    await setLang("en");
    route({ "GET /mobile/growth": overview(), "GET /credits/wallet": wallet({ balance: "0.00", upcomingExpiries: [], spendableByUse: {} }), "GET /promotions": [], ...QR });
    await wrap(<Growth />);
    expect(await screen.findByTestId("growth-credit-none")).toBeTruthy();
    expect(screen.queryByTestId("growth-credit-expiry")).toBeNull();
    expect(screen.queryByTestId("growth-credit-uses")).toBeNull();
    expect(await screen.findByTestId("growth-promos-empty")).toBeTruthy();
  });

  it("lists promotions with status, budget left and a pause button only where it applies; pause posts and refreshes", async () => {
    await setLang("en");
    let status: PromotionRow["status"] = "ACTIVE"; const posts: string[] = [];
    mockRequest.mockImplementation(async (_p: string, method: string, path: string) => {
      if (path === "/mobile/growth") return overview();
      if (path === "/mobile/growth/qr") return QR["GET /mobile/growth/qr"].valueOf();
      if (path === "/credits/wallet") return wallet();
      if (path === "/promotions") return [promo("p1", status), promo("p2", "IN_REVIEW", { version: { nameAr: null, nameEn: "Autumn offer", startsAt: null, endsAt: null } }), promo("p3", "ARCHIVED")];
      if (method === "POST") { posts.push(path); status = "PAUSED"; return {}; }
      return null;
    });
    await wrap(<Growth />);
    const p1 = await screen.findByTestId("growth-promo-p1");
    expect(within(p1).getByText("Active")).toBeTruthy();
    expect(within(p1).getByText("Budget left", { exact: false })).toBeTruthy();
    expect(within(p1).getByText("50% used", { exact: false })).toBeTruthy();
    expect(within(screen.getByTestId("growth-promo-p2")).getByText("In review")).toBeTruthy();
    expect(screen.queryByTestId("growth-promo-pause-p2")).toBeNull();
    expect(screen.queryByTestId("growth-promo-p3")).toBeNull(); // archived rows are hidden
    await fireEvent.press(screen.getByTestId("growth-promo-pause-p1"));
    await waitFor(() => expect(posts).toEqual(["/promotions/p1/pause"]));
    expect(await screen.findByTestId("growth-promo-resume-p1")).toBeTruthy();
  });

  it("pause offline tells the user it needs a connection and queues nothing", async () => {
    await setLang("en");
    mockRequest.mockImplementation(async (_p: string, method: string, path: string) => {
      if (path === "/mobile/growth") return overview();
      if (path === "/credits/wallet") throw new ApiError(403, "FORBIDDEN", "no");
      if (path === "/promotions") return [promo("p1", "ACTIVE")];
      if (path === "/mobile/growth/qr") return QR["GET /mobile/growth/qr"];
      if (method === "POST") throw new ApiError(0, "NETWORK", "offline");
      return null;
    });
    await wrap(<Growth />);
    await fireEvent.press(await screen.findByTestId("growth-promo-pause-p1"));
    expect(await screen.findByText("This needs a connection", { exact: false })).toBeTruthy();
    expect(screen.getByTestId("growth-promo-pause-p1")).toBeTruthy(); // still active
  });

  it("403, FEATURE_DISABLED and 404 hide the cards without an error; a doctor never requests them", async () => {
    await setLang("en");
    route({ "GET /mobile/growth": overview(), "GET /credits/wallet": new ApiError(403, "FEATURE_DISABLED", "off"), "GET /promotions": new ApiError(403, "FORBIDDEN", "no"), ...QR });
    await wrap(<Growth />);
    await screen.findByTestId("growth-profile");
    await waitFor(() => expect(screen.queryByTestId("growth-credit-loading")).toBeNull());
    expect(screen.queryByTestId("growth-credit")).toBeNull(); expect(screen.queryByTestId("growth-credit-error")).toBeNull();
    expect(screen.queryByTestId("growth-promos")).toBeNull(); expect(screen.queryByTestId("growth-promos-error")).toBeNull();
    mockRequest.mockClear();
    route({ "GET /mobile/growth": overview({ level: "doctor", can: { create: false, pause: false, widget: false }, performance: null, commission: null, recommendations: [], plan: null }), ...QR });
    await wrap(<Growth />);
    await screen.findAllByTestId("growth-doctor-note");
    expect(mockRequest.mock.calls.some((c) => String(c[2]).startsWith("/credits") || String(c[2]).startsWith("/promotions"))).toBe(false);
  });

  it("a server error shows a retry state, not a blank card", async () => {
    await setLang("en");
    route({ "GET /mobile/growth": overview(), "GET /credits/wallet": new ApiError(500, "INTERNAL", "boom"), "GET /promotions": [], ...QR });
    await wrap(<Growth />);
    expect(await screen.findByTestId("growth-credit-error")).toBeTruthy();
  });
});
