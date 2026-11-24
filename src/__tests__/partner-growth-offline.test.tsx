import type { ReactElement } from "react";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SafeAreaProvider } from "react-native-safe-area-context";
import i18n from "@/i18n";
import { ThemeProvider } from "@/theme";
import { ToastProvider } from "@/components/ui";
import { ApiError } from "@/api/errors";
import type { PartnerOverview } from "@/modules/partner-growth";

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
/** Own file: a failed write is queued by the offline layer and would leak into later tests in the same module registry. */
describe.each(cases)("%s Growth tab offline", (_product, Screen, P) => {
  it("offline pause: a network failure tells the user it needs a connection", async () => {
    await setLang("en");
    mockRequest.mockImplementation(async (_p: string, method: string, path: string) => {
      if (path === "/mobile/growth") return overview(P);
      if (path === "/mobile/growth/qr") return QR["GET /mobile/growth/qr"];
      if (method === "PATCH") throw new ApiError(0, "NETWORK", "offline");
      return null;
    });
    await wrap(<Screen />);
    await fireEvent.press(await screen.findByTestId("growth-link-l1"));
    await fireEvent.press(await screen.findByText("Pause link"));
    expect(await screen.findByText("This needs a connection.")).toBeTruthy();
  });
});
