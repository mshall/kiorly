import type { ReactElement } from "react";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SafeAreaProvider } from "react-native-safe-area-context";
import i18n from "@/i18n";
import { ThemeProvider } from "@/theme";
import { ToastProvider } from "@/components/ui";
import { ApiError } from "@/api/errors";
import { partnerCapabilities, type PartnerOverview } from "@/modules/partner-growth";
import { pickWording, shiftPeriod } from "@/modules/partner-commission";
import { tilesFor } from "@/modules/registry";

const mockRequest = jest.fn();
jest.mock("@/api/client", () => {
  const request = (...a: unknown[]) => mockRequest(...a);
  return { request, api: { get: (p: string, path: string, o?: unknown) => request(p, "GET", path, o), post: jest.fn(), patch: jest.fn(), put: jest.fn(), del: jest.fn() }, configureClient: jest.fn() };
});
jest.mock("@/auth/SessionProvider", () => ({ useSessions: () => ({ sessions: { pharmacy: { email: "o@x.test", bootstrap: undefined }, lab: { email: "o@x.test", bootstrap: undefined } }, products: ["pharmacy", "lab"], isEntitled: () => true }) }));
jest.mock("expo-router", () => ({ useRouter: () => ({ push: jest.fn(), back: jest.fn(), replace: jest.fn() }), useLocalSearchParams: () => ({}), Stack: { Screen: () => null } }));
const mockShare = jest.fn(); const mockWa = jest.fn(); const mockWeb = jest.fn(); const mockCopy = jest.fn();
jest.mock("@/lib/shareLink", () => ({ shareLink: (...a: unknown[]) => mockShare(...a), openWhatsapp: (...a: unknown[]) => mockWa(...a), openSms: jest.fn(), openWeb: (...a: unknown[]) => mockWeb(...a), copyText: (...a: unknown[]) => mockCopy(...a) }));

import PharmacyGrowth from "../../app/(tabs)/(more)/pharmacy/growth";
import LabGrowth from "../../app/(tabs)/(more)/lab/growth";

const wrap = (ui: ReactElement) => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(<SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 800 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } }}><QueryClientProvider client={qc}><ThemeProvider><ToastProvider>{ui}</ToastProvider></ThemeProvider></QueryClientProvider></SafeAreaProvider>);
};
const setLang = (l: string) => act(async () => { await i18n.changeLanguage(l); });
const SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2 2"><rect width="1" height="1" fill="#000"/></svg>';
const origin = (orders: number, completed: number) => ({ orders, completed, completionRate: orders ? completed / orders : null });
const overview = (product: "PHARMACY" | "LAB", over: Partial<PartnerOverview> = {}): PartnerOverview => ({
  product, level: "admin", can: { view: true, create: true, update: true, revoke: false }, plan: { key: "PRO", maxActiveLinks: 25, linksUsed: 1 }, profileUrl: `http://localhost:5180/ar/eg/${product.toLowerCase()}/nile`,
  links: [{ id: "l1", code: "ABCD2345", label: "Counter card", ownerScope: "DESK", channelKind: "QR_DESK", status: "ACTIVE", shortUrl: "http://localhost:5173/q/ABCD2345", last30: { visits: 40, orders: 10, completed: 6 } }],
  performance: { days: 30, links: { visits: 40, orders: 10, completed: 6, visitToOrder: 0.25, orderToCompleted: 0.6 }, providerOriginated: origin(10, 6), marketplaceOriginated: origin(5, 3), acquisitionPending: false },
  recommendations: [{ id: "PRINT_COUNTER_CARD", severity: "low", params: {}, action: "links" }], statement: { configured: false, note: "none" }, organisation: "Nile", webGrowthPath: "/growth", webGrowthUrl: "http://localhost:5173/growth", ...over,
});
const route = (map: Record<string, unknown>) => mockRequest.mockImplementation(async (_p: string, method: string, path: string) => {
  const k = `${method} ${path}`;
  if (k in map) { const v = map[k]; if (v instanceof Error) throw v; return v; }
  throw new ApiError(404, "NOT_FOUND", "nope");
});
const QR = { "GET /mobile/growth/qr": { url: "http://localhost:5173/q/ABCD2345", svg: SVG, linkId: "l1" } };

beforeEach(() => { mockRequest.mockReset(); [mockShare, mockWa, mockWeb, mockCopy].forEach((m) => m.mockReset()); mockShare.mockResolvedValue("shared"); mockCopy.mockResolvedValue(true); });
afterEach(async () => { await setLang("ar"); });

const cases = [["pharmacy", PharmacyGrowth, "PHARMACY"], ["lab", LabGrowth, "LAB"]] as const;
describe.each(cases)("%s Growth tab", (product, Screen, P) => {
  it("English: profile link, share and copy, links with counts, orders from your links versus Kiorex, suggestions, web workspace", async () => {
    await setLang("en");
    route({ "GET /mobile/growth": overview(P), ...QR });
    await wrap(<Screen />);
    expect(await screen.findByText(`http://localhost:5180/ar/eg/${product}/nile`)).toBeTruthy();
    expect(within(screen.getByTestId("growth-link-l1")).getByText("40", { exact: false })).toBeTruthy();
    expect(within(screen.getByTestId("growth-perf-provider")).getByText("10", { exact: false })).toBeTruthy();
    expect(within(screen.getByTestId("growth-perf-marketplace")).getByText("5", { exact: false })).toBeTruthy();
    expect(screen.getByTestId("growth-statement")).toBeTruthy();
    expect(screen.getByTestId("growth-recs")).toBeTruthy();
    await waitFor(() => expect(mockRequest).toHaveBeenCalledWith(product, "GET", "/mobile/growth/qr", expect.objectContaining({ query: { linkId: "l1", format: "json" } })));
    await fireEvent.press(screen.getByTestId("growth-share"));
    await waitFor(() => expect(mockShare).toHaveBeenCalledWith(expect.stringContaining(`http://localhost:5180/ar/eg/${product}/nile`), `http://localhost:5180/ar/eg/${product}/nile`));
    await fireEvent.press(screen.getByTestId("growth-copy"));
    await waitFor(() => expect(mockCopy).toHaveBeenCalled());
    await fireEvent.press(screen.getByTestId("growth-web"));
    expect(mockWeb).toHaveBeenCalledWith("http://localhost:5173/growth");
  });

  it("Arabic (RTL default): Arabic-Indic digits for the counts", async () => {
    await setLang("ar");
    route({ "GET /mobile/growth": overview(P), ...QR });
    await wrap(<Screen />);
    expect(within(await screen.findByTestId("growth-link-l1")).getByText("٤٠", { exact: false })).toBeTruthy();
  });

  it("empty: no links shows the empty state and no QR card", async () => {
    await setLang("en");
    route({ "GET /mobile/growth": overview(P, { links: [], performance: { ...overview(P).performance, providerOriginated: origin(0, 0), marketplaceOriginated: origin(0, 0) } }) });
    await wrap(<Screen />);
    expect(await screen.findByTestId("growth-links-empty")).toBeTruthy();
    expect(screen.getByTestId("growth-perf-none")).toBeTruthy();
    expect(screen.queryByTestId("growth-qr-card")).toBeNull();
  });

  it("a read role sees the read-only note and no create button", async () => {
    await setLang("en");
    route({ "GET /mobile/growth": overview(P, { level: "read", can: { view: true, create: false, update: false, revoke: false } }), ...QR });
    await wrap(<Screen />);
    expect(await screen.findByTestId("growth-read-only")).toBeTruthy();
    expect(screen.queryByTestId("growth-new-link")).toBeNull();
  });

  it("admin creates a link from the sheet with the DESK scope for a QR channel", async () => {
    await setLang("en");
    const calls: string[] = [];
    mockRequest.mockImplementation(async (_p: string, method: string, path: string, o?: { body?: Record<string, unknown> }) => {
      calls.push(`${method} ${path} ${JSON.stringify(o?.body ?? {})}`);
      if (path === "/mobile/growth") return overview(P);
      if (path === "/mobile/growth/qr") return QR["GET /mobile/growth/qr"];
      if (method === "POST") return { id: "new" };
      return null;
    });
    await wrap(<Screen />);
    await fireEvent.press(await screen.findByTestId("growth-new-link"));
    await fireEvent.changeText(await screen.findByTestId("growth-create-label"), "Front desk");
    await fireEvent.press(screen.getByTestId("growth-channel-QR_DESK"));
    await fireEvent.press(screen.getByTestId("growth-create-save"));
    await waitFor(() => expect(calls.some((c) => c.startsWith("POST /mobile/growth/links") && c.includes('"label":"Front desk"') && c.includes('"ownerScope":"DESK"') && c.includes('"channelKind":"QR_DESK"'))).toBe(true));
  });

  it("offline load with nothing cached: a retryable error state, not a crash", async () => {
    await setLang("en");
    route({ "GET /mobile/growth": new ApiError(0, "NETWORK", "offline") });
    await wrap(<Screen />);
    expect(await screen.findByTestId("error-state")).toBeTruthy();
  });

  it("not connected to Kiorex: a warning banner (no data)", async () => {
    await setLang("en");
    route({ "GET /mobile/growth": new ApiError(403, "KIOREX_NOT_CONNECTED", "no") });
    await wrap(<Screen />);
    expect(await screen.findByTestId("growth-not-connected")).toBeTruthy();
  });

  it("403 for a role without the module shows the not-allowed banner", async () => {
    await setLang("en");
    route({ "GET /mobile/growth": new ApiError(403, "GROWTH_FORBIDDEN", "no") });
    await wrap(<Screen />);
    expect(await screen.findByTestId("not-allowed")).toBeTruthy();
  });

  it("a server error shows the retryable error state", async () => {
    await setLang("en");
    route({ "GET /mobile/growth": new ApiError(500, "HTTP_500", "boom") });
    await wrap(<Screen />);
    expect(await screen.findByTestId("error-state")).toBeTruthy();
  });

  it("403 FEATURE_DISABLED (plan or flag off) shows the unavailable state", async () => {
    await setLang("en");
    route({ "GET /mobile/growth": new ApiError(403, "FEATURE_DISABLED", "off", { key: "mobile_staff_app", scope: "org" }) });
    await wrap(<Screen />);
    expect(await screen.findByTestId("unavailable")).toBeTruthy();
  });
});

describe("role matrix and tile registry (per partner)", () => {
  it("capabilities per level mirror the API matrix: admin creates and pauses, read views only, none sees nothing; revoke is web only", () => {
    expect(partnerCapabilities("admin")).toEqual({ view: true, create: true, pause: true, revoke: false });
    expect(partnerCapabilities("read")).toEqual({ view: true, create: false, pause: false, revoke: false });
    expect(partnerCapabilities("none")).toEqual({ view: false, create: false, pause: false, revoke: false });
  });
  it("the Growth tile shows only when the bootstrap module is enabled (bench roles never see it)", () => {
    for (const p of ["pharmacy", "lab"] as const) {
      expect(tilesFor(p, [{ key: `${p}.growth`, enabled: true }]).some((t) => t.key === `${p}.growth`)).toBe(true);
      expect(tilesFor(p, [{ key: `${p}.growth`, enabled: false }]).some((t) => t.key === `${p}.growth`)).toBe(false);
      expect(tilesFor(p, undefined).some((t) => t.key === `${p}.growth`)).toBe(false);
    }
  });
  it("the clinic Refer a company tile (clinic.b2b) is registered with its route", () => {
    expect(tilesFor("clinic", [{ key: "clinic.b2b", enabled: true }]).find((t) => t.key === "clinic.b2b")?.route).toBe("/clinic/growth-b2b");
  });
});

const RATE = { known: true, state: "SET", effective: { state: "SET", source: "OVERRIDE", version: 2, reason: null, spec: { feeType: "PERCENT", percentBps: 500, flatMinor: null, minMinor: 200, maxMinor: null, mode: null } }, disclosure: { rateDisclosure: { en: "TEST disclosure", ar: "" }, termsSummary: { en: "", ar: "" } }, counsel: { status: "NOT_REVIEWED" } };
const STMT = { currency: "EGP", period: { from: "2026-12-01T00:00:00.000Z", to: "2027-01-01T00:00:00.000Z", key: "2026-12" }, onlineCollectionsMinor: 9000, cashVisitCommissionAccruedMinor: 400, cashVisitCommissionNettedMinor: 100, cashVisitCommissionOpenMinor: 300, deductions: { commissionMinor: 900, feesMinor: 1334, refundsMinor: null, chargebacksMinor: 0 }, netPayableMinor: 8000, paidByBankTransferMinor: 8000, payouts: [{ payoutRef: "po1", paidAt: "2026-12-04T00:00:00.000Z", cashMinor: 8000, commissionDeductedMinor: 900, bankReference: "BK-1", reconciliation: "MATCHED" }], reconciliation: "MATCHED" };
describe.each(cases)("%s commission rate and settlement statement cards", (product, Screen, P) => {
  it("English: rate, counsel status, disclosure as Kiorex wrote it, statement figures with feesMinor, payout and reconciliation; read only", async () => {
    await setLang("en");
    route({ "GET /mobile/growth": overview(P, { can: { view: true, create: true, update: true, revoke: false, commission: true } }), "GET /mobile/growth/commission-rate": RATE, "GET /mobile/growth/commission-statement": STMT, ...QR });
    await wrap(<Screen />);
    expect(await screen.findByTestId("growth-rate-effective")).toBeTruthy();
    expect(within(screen.getByTestId("growth-rate-card")).getByText("5% of the fee (min EGP 2.00)", { exact: false })).toBeTruthy();
    expect(screen.getByTestId("growth-counsel")).toBeTruthy();
    expect(within(screen.getByTestId("growth-disclosure-rateDisclosure")).getByText("TEST disclosure")).toBeTruthy();
    expect(screen.queryByTestId("growth-disclosure-termsSummary")).toBeNull();
    const fig = await screen.findByTestId("growth-stmt-figures");
    expect(within(fig).getByText("Deduction: fees")).toBeTruthy(); expect(within(fig).getByText("EGP 13.34", { exact: false })).toBeTruthy(); expect(within(fig).getByText("—")).toBeTruthy(); // refunds unknown stays a dash
    expect(within(screen.getByTestId("growth-stmt-payout-po1")).getByText("BK-1", { exact: false })).toBeTruthy();
    expect(screen.getByTestId("growth-stmt-recon")).toBeTruthy();
    expect(screen.queryByTestId("growth-statement")).toBeNull(); // the placeholder is replaced
    await fireEvent.press(screen.getByTestId("growth-stmt-prev"));
    await waitFor(() => expect(mockRequest).toHaveBeenCalledWith(product, "GET", "/mobile/growth/commission-statement", expect.objectContaining({ query: { period: shiftPeriod(new Date().toISOString().slice(0, 7), -1) } })));
  });
  it("Arabic: Arabic-Indic digits and wording; rate not set says nothing is charged", async () => {
    await setLang("ar");
    route({ "GET /mobile/growth": overview(P, { can: { view: true, create: true, update: true, revoke: false, commission: true } }), "GET /mobile/growth/commission-rate": { ...RATE, state: "NOT_SET", effective: { state: "NOT_SET", source: null, version: null, reason: null, spec: null }, disclosure: null, counsel: null }, "GET /mobile/growth/commission-statement": STMT, ...QR });
    await wrap(<Screen />);
    expect(await screen.findByTestId("growth-rate-not-set")).toBeTruthy();
    expect(within(await screen.findByTestId("growth-stmt-figures")).getByText("خصم: الرسوم")).toBeTruthy();
  });
  it("roles without access to the figures keep the plain placeholder and never call the money routes", async () => {
    await setLang("en");
    route({ "GET /mobile/growth": overview(P), ...QR });
    await wrap(<Screen />);
    expect(await screen.findByTestId("growth-statement")).toBeTruthy();
    expect(mockRequest.mock.calls.some((c) => String(c[2]).includes("commission"))).toBe(false);
  });
  it("the statement is not connected yet: one neutral line, not an invented figure", async () => {
    await setLang("en");
    route({ "GET /mobile/growth": overview(P, { can: { view: true, create: true, update: true, revoke: false, commission: true } }), "GET /mobile/growth/commission-rate": RATE, "GET /mobile/growth/commission-statement": new ApiError(503, "STATEMENT_NOT_CONNECTED", "no") });
    await wrap(<Screen />);
    expect(await screen.findByTestId("growth-stmt-unavailable")).toBeTruthy(); expect(screen.queryByTestId("growth-stmt-figures")).toBeNull();
  });
});
describe("commission card helpers", () => {
  it("months move back and never past the current month; wording falls back to the other language only when set", () => {
    const now = new Date("2026-12-15T10:00:00Z");
    expect([shiftPeriod("2026-12", -1, now), shiftPeriod("2026-01", -1, now), shiftPeriod("2026-12", 1, now), shiftPeriod("2026-10", 1, now)]).toEqual(["2026-11", "2025-12", "2026-12", "2026-11"]);
    expect(pickWording({ en: "A", ar: "" }, "ar")).toEqual({ text: "A", lang: "en" }); expect(pickWording({ en: " ", ar: "" }, "en")).toBeNull();
  });
});
