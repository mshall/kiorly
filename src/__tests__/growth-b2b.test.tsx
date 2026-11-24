import type { ReactElement } from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SafeAreaProvider } from "react-native-safe-area-context";
import i18n from "@/i18n";
import { ThemeProvider } from "@/theme";
import { ToastProvider } from "@/components/ui";
import { ApiError } from "@/api/errors";
import { b2bProblem, looksPersonal, SIZE_BUCKETS } from "@/modules/clinic/growth-b2b";
import { clinicB2bStrings } from "@/i18n/modules/clinic-b2b";

const mockRequest = jest.fn();
jest.mock("@/api/client", () => {
  const request = (...a: unknown[]) => mockRequest(...a);
  return { request, api: { get: (p: string, path: string, o?: unknown) => request(p, "GET", path, o), post: jest.fn(), patch: jest.fn(), put: jest.fn(), del: jest.fn() }, configureClient: jest.fn() };
});
jest.mock("@/auth/SessionProvider", () => ({ useSessions: () => ({ sessions: { clinic: { email: "o@x.test", bootstrap: undefined } }, products: ["clinic"], isEntitled: () => true }) }));
jest.mock("expo-router", () => ({ useRouter: () => ({ push: jest.fn(), back: jest.fn(), replace: jest.fn() }), useLocalSearchParams: () => ({}), Stack: { Screen: () => null } }));
import B2b from "../../app/(tabs)/(more)/clinic/growth-b2b";

/** GRW-P4-C staff app "Refer a company": company data only, tracking only, AR and EN. */
const wrap = (ui: ReactElement) => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(<SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 800 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } }}><QueryClientProvider client={qc}><ThemeProvider><ToastProvider>{ui}</ToastProvider></ThemeProvider></QueryClientProvider></SafeAreaProvider>);
};
const setLang = (l: string) => act(async () => { await i18n.changeLanguage(l); });
const flat = (o: unknown, p = ""): string[] => (o && typeof o === "object" ? Object.entries(o as Record<string, unknown>).flatMap(([k, v]) => flat(v, p ? `${p}.${k}` : k)) : [p]);
const LIST = { items: [{ id: "r1", companyName: "Delta Pharma", sizeBucket: "200_999", contactRef: "ref-1", status: "SUBMITTED", createdAt: "2027-02-01T10:00:00Z" }], note: { reward: "NONE", message: "x" } };
beforeEach(() => mockRequest.mockReset());
afterEach(async () => { await setLang("ar"); });

describe("corporate referral wording and rules", () => {
  it("English and Arabic carry the same keys and nothing promises money", () => {
    const en = clinicB2bStrings.en.clinic as Record<string, unknown>; const ar = clinicB2bStrings.ar.clinic as Record<string, unknown>;
    expect(flat(en).sort()).toEqual(flat(ar).sort());
    expect(JSON.stringify(en).replace(/no reward, credit or fee share/, "")).not.toMatch(/earn |commission|bonus|payout|discount|price|EGP/i);
    for (const s of SIZE_BUCKETS) expect(JSON.stringify(en)).toContain(`"${s}"`);
  });
  it("refuses a person before anything is sent", () => {
    for (const bad of ["sara@acme.com", "+20 100 000 0001", "01000000001", "29004020101234", "٠١٠٠٠٠٠٠٠٠١"]) { expect(looksPersonal(bad)).toBe(true); expect(b2bProblem({ companyName: "Acme", contactRef: bad })).toBe("PERSONAL"); }
    expect(b2bProblem({ companyName: "a", contactRef: "" })).toBe("NAME"); expect(b2bProblem({ companyName: "Nile Logistics", contactRef: "ref-1" })).toBeNull();
  });
});

describe("Refer a company screen", () => {
  it("lists the referrals, says there is no reward, and sends only the company name, size and reference (no clinic, no person)", async () => {
    await setLang("en"); const calls: string[] = [];
    mockRequest.mockImplementation(async (_p: string, method: string, path: string, o?: { body?: Record<string, unknown> }) => { calls.push(`${method} ${path} ${JSON.stringify(o?.body ?? {})}`); if (method === "GET") return LIST; if (method === "POST") return { id: "r2" }; throw new ApiError(404, "NOT_FOUND", "x"); });
    await wrap(<B2b />);
    expect(await screen.findByText("Delta Pharma")).toBeTruthy(); expect(screen.getByTestId("b2b-no-reward")).toBeTruthy(); expect(screen.getByTestId("b2b-send").props.accessibilityState?.disabled).toBe(true);
    await fireEvent.changeText(screen.getByTestId("b2b-name"), "Omega Foods"); await fireEvent.press(screen.getByTestId("b2b-size-50_199")); await fireEvent.changeText(screen.getByTestId("b2b-ref"), "ref-9");
    await fireEvent.press(screen.getByTestId("b2b-send"));
    await waitFor(() => expect(calls).toContain('POST /mobile/growth/b2b-referrals {"companyName":"Omega Foods","sizeBucket":"50_199","contactRef":"ref-9"}'));
  });
  it("a person's contact data in the reference is stopped on the device and never posted", async () => {
    await setLang("en"); mockRequest.mockImplementation(async (_p: string, method: string) => { if (method === "GET") return LIST; throw new Error("must not post"); });
    await wrap(<B2b />); await screen.findByText("Delta Pharma");
    await fireEvent.changeText(screen.getByTestId("b2b-name"), "Omega Foods"); await fireEvent.changeText(screen.getByTestId("b2b-ref"), "sara@omega.com"); await fireEvent.press(screen.getByTestId("b2b-send"));
    expect(await screen.findByText(/Refer a company, not a person/)).toBeTruthy(); expect(mockRequest.mock.calls.filter((c) => c[1] === "POST")).toHaveLength(0);
  });
  it("a duplicate and a missing connection get plain messages", async () => {
    await setLang("en");
    mockRequest.mockImplementation(async (_p: string, method: string) => { if (method === "GET") return LIST; throw new ApiError(409, "B2B_DUPLICATE", "dup"); });
    await wrap(<B2b />); await screen.findByText("Delta Pharma");
    await fireEvent.changeText(screen.getByTestId("b2b-name"), "Delta Pharma"); await fireEvent.press(screen.getByTestId("b2b-send"));
    expect(await screen.findByText("You already referred this company recently.")).toBeTruthy();
    mockRequest.mockImplementation(async (_p: string, method: string) => { if (method === "GET") return LIST; throw new ApiError(0, "NETWORK", "offline"); });
    await fireEvent.press(screen.getByTestId("b2b-send")); expect(await screen.findByText("This needs a connection.")).toBeTruthy();
  });
  it("a role that cannot refer sees the plain notice, not the form", async () => {
    await setLang("en"); mockRequest.mockImplementation(async () => { throw new ApiError(403, "GROWTH_FORBIDDEN", "no"); });
    await wrap(<B2b />); expect(await screen.findByTestId("b2b-forbidden")).toBeTruthy(); expect(screen.queryByTestId("b2b-form")).toBeNull();
  });
  it("renders in Arabic with Arabic text and a left-to-right reference field", async () => {
    await setLang("ar"); mockRequest.mockImplementation(async () => LIST);
    await wrap(<B2b />); expect(await screen.findByText("الشركات التي أحلتها")).toBeTruthy(); expect(screen.getByTestId("b2b-ref").props.style).toEqual(expect.arrayContaining([expect.objectContaining({ writingDirection: "ltr" })]));
  });
});
