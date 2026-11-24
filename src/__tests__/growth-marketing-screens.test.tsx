import type { ReactElement } from "react";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SafeAreaProvider } from "react-native-safe-area-context";
import i18n from "@/i18n";
import { ThemeProvider } from "@/theme";
import { ToastProvider } from "@/components/ui";
import { ApiError } from "@/api/errors";

const mockRequest = jest.fn();
jest.mock("@/api/client", () => {
  const request = (...a: unknown[]) => mockRequest(...a);
  return { request, api: { get: (p: string, path: string, o?: unknown) => request(p, "GET", path, o), post: jest.fn(), patch: jest.fn(), put: jest.fn(), del: jest.fn() }, configureClient: jest.fn() };
});
jest.mock("@/auth/SessionProvider", () => ({ useSessions: () => ({ sessions: { clinic: { email: "o@x.test", bootstrap: undefined } }, products: ["clinic"], isEntitled: () => true }) }));
jest.mock("expo-router", () => ({ useRouter: () => ({ push: jest.fn(), back: jest.fn(), replace: jest.fn() }), useLocalSearchParams: () => ({}), Stack: { Screen: () => null } }));
const mockShare = jest.fn(); const mockWa = jest.fn(); const mockSms = jest.fn(); const mockWeb = jest.fn(); const mockCopy = jest.fn();
jest.mock("@/lib/shareLink", () => ({ shareLink: (...a: unknown[]) => mockShare(...a), openWhatsapp: (...a: unknown[]) => mockWa(...a), openSms: (...a: unknown[]) => mockSms(...a), openWeb: (...a: unknown[]) => mockWeb(...a), copyText: (...a: unknown[]) => mockCopy(...a) }));

import Share from "../../app/(tabs)/(more)/clinic/growth-share";
import Slots from "../../app/(tabs)/(more)/clinic/growth-slots";
import Statements from "../../app/(tabs)/(more)/clinic/growth-statements";
import Verification from "../../app/(tabs)/(more)/clinic/growth-verification";

const wrap = (ui: ReactElement) => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(<SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 800 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } }}><QueryClientProvider client={qc}><ThemeProvider><ToastProvider>{ui}</ToastProvider></ThemeProvider></QueryClientProvider></SafeAreaProvider>);
};
const setLang = (l: string) => act(async () => { await i18n.changeLanguage(l); });
const SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2 2"><rect width="1" height="1" fill="#000"/></svg>';
const route = (map: Record<string, unknown>) => mockRequest.mockImplementation(async (_p: string, method: string, path: string, o?: unknown) => {
  const k = `${method} ${path}`;
  const hit = k in map ? map[k] : Object.keys(map).find((m) => k.startsWith(m)) ? map[Object.keys(map).find((m) => k.startsWith(m))!] : undefined;
  if (hit === undefined) throw new ApiError(404, "NOT_FOUND", "nope");
  if (typeof hit === "function") return (hit as (o?: unknown) => unknown)(o);
  if (hit instanceof Error) throw hit;
  return hit;
});
const TEMPLATES = { items: [
  { id: "t1", slug: "booking-open", kind: "POST", locale: "en", title: "Online booking is open", body: "Online booking is open at {clinic}: {link}", protectedFooter: "Appointments depend on availability.", shares30d: 2, needsDoctor: false },
  { id: "t2", slug: "doctor-intro", kind: "POST", locale: "en", title: "Meet the doctor", body: "{doctor} at {clinic}: {link}", protectedFooter: "Appointments depend on availability.", shares30d: 0, needsDoctor: true },
] };
const CARD = { templateId: "t1", locale: "en", caption: "Online booking is open at Maadi: https://kiorly.link/b/maadi?s=ABCD2345\n\nAppointments depend on availability.", link: "https://kiorly.link/b/maadi?s=ABCD2345", linkCode: "ABCD2345", layout: "post", svg: SVG };

beforeEach(() => { mockRequest.mockReset(); [mockShare, mockWa, mockSms, mockWeb, mockCopy].forEach((m) => m.mockReset()); mockShare.mockResolvedValue("shared"); mockCopy.mockResolvedValue(true); });
afterEach(async () => { await setLang("ar"); });

describe("Growth share screen", () => {
  it("lists approved templates, renders a card, shows the protected caption and counts each share channel", async () => {
    await setLang("en");
    const calls: string[] = [];
    mockRequest.mockImplementation(async (_p: string, method: string, path: string, o?: { body?: Record<string, unknown> }) => {
      calls.push(`${method} ${path} ${JSON.stringify(o?.body ?? {})}`);
      if (path === "/mobile/growth/templates") return TEMPLATES;
      if (path === "/mobile/growth/share/render") return CARD;
      if (path === "/mobile/growth/share/count") return { ok: true };
      throw new ApiError(404, "NOT_FOUND", "x");
    });
    await wrap(<Share />);
    await fireEvent.press(await screen.findByTestId("share-template-booking-open"));
    await fireEvent.changeText(screen.getByTestId("share-custom"), "Open on Saturdays");
    await fireEvent.press(screen.getByTestId("share-render"));
    expect(await screen.findByTestId("share-caption")).toBeTruthy();
    expect(calls.some((c) => c.startsWith("POST /mobile/growth/share/render") && c.includes('"templateId":"t1"') && c.includes('"customLine":"Open on Saturdays"'))).toBe(true);
    await fireEvent.press(screen.getByTestId("share-whatsapp"));
    expect(mockWa).toHaveBeenCalledWith(CARD.caption);
    await fireEvent.press(screen.getByTestId("share-sms"));
    expect(mockSms).toHaveBeenCalledWith(CARD.caption);
    await fireEvent.press(screen.getByTestId("share-share"));
    await waitFor(() => expect(mockShare).toHaveBeenCalledWith(CARD.caption, CARD.link));
    await waitFor(() => expect(calls.filter((c) => c.startsWith("POST /mobile/growth/share/count")).length).toBe(3));
    expect(calls.some((c) => c.includes('"channel":"WHATSAPP"'))).toBe(true);
    expect(JSON.stringify(calls)).not.toMatch(/phone|patient/i);
  });
  it("a refused wording, a missing link and being offline each say so in plain words", async () => {
    await setLang("en");
    route({ "GET /mobile/growth/templates": TEMPLATES, "POST /mobile/growth/share/render": new ApiError(422, "CONTENT_NOT_ALLOWED", "no") });
    await wrap(<Share />);
    await fireEvent.press(await screen.findByTestId("share-template-booking-open"));
    await fireEvent.press(screen.getByTestId("share-render"));
    expect(await within(await screen.findByTestId("share-error")).findByText(/cannot be published/)).toBeTruthy();
    route({ "GET /mobile/growth/templates": TEMPLATES, "POST /mobile/growth/share/render": new ApiError(409, "SHARE_LINK_REQUIRED", "no") });
    await fireEvent.press(screen.getByTestId("share-render"));
    expect(await screen.findByText(/Ask an administrator to create a link first/)).toBeTruthy();
    route({ "GET /mobile/growth/templates": TEMPLATES, "POST /mobile/growth/share/render": new ApiError(0, "NETWORK", "offline") });
    await fireEvent.press(screen.getByTestId("share-render"));
    expect(await screen.findByText(/Needs a connection/)).toBeTruthy();
  });
  it("Arabic: the screen and the template list render in Arabic", async () => {
    await setLang("ar");
    route({ "GET /mobile/growth/templates": { items: [{ ...TEMPLATES.items[0], locale: "ar", title: "الحجز أونلاين متاح" }] } });
    await wrap(<Share />);
    expect(await screen.findByText("الحجز أونلاين متاح")).toBeTruthy();
    expect(screen.getByText(/نصوص معتمدة فقط/)).toBeTruthy();
  });
  it("empty state", async () => {
    await setLang("en");
    route({ "GET /mobile/growth/templates": { items: [] } });
    await wrap(<Share />);
    expect(await screen.findByTestId("share-empty")).toBeTruthy();
  });
});

describe("Growth slots screen", () => {
  const SLOTS = { clinicId: "c1", clinicianId: "d1", timezone: "Africa/Cairo", days: 3, typeId: "ty", items: [
    { startsAt: "2026-11-25T08:00:00.000Z", endsAt: "2026-11-25T08:30:00.000Z", labelEn: "Wed 25 Nov, 10:00", labelAr: "الأربعاء ٢٥ نوفمبر، ١٠:٠٠ ص" },
    { startsAt: "2026-11-25T08:30:00.000Z", endsAt: "2026-11-25T09:00:00.000Z", labelEn: "Wed 25 Nov, 10:30", labelAr: "الأربعاء ٢٥ نوفمبر، ١٠:٣٠ ص" },
  ] };
  it("choose two times, create the card, share it; the link carries the provider code", async () => {
    await setLang("en");
    const calls: string[] = [];
    mockRequest.mockImplementation(async (_p: string, method: string, path: string, o?: { body?: Record<string, unknown> }) => {
      calls.push(`${method} ${path} ${JSON.stringify(o?.body ?? {})}`);
      if (path === "/mobile/growth/slots") return SLOTS;
      if (path === "/mobile/growth/slots/card") return { link: "https://kiorly.link/b/maadi?s=ABCD2345&slot=2026-11-25T08%3A00%3A00.000Z", caption: "Next available times\n- Wed 25 Nov, 10:00", svg: SVG, slots: ["2026-11-25T08:00:00.000Z"] };
      throw new ApiError(404, "NOT_FOUND", "x");
    });
    await wrap(<Slots />);
    const opts = await screen.findAllByTestId("slots-option");
    expect(opts).toHaveLength(2);
    expect(screen.getByTestId("slots-create").props.accessibilityState?.disabled ?? true).toBeTruthy();
    await fireEvent.press(opts[0]!);
    await fireEvent.press(opts[1]!);
    await fireEvent.press(screen.getByTestId("slots-create"));
    expect(await screen.findByTestId("slots-result")).toBeTruthy();
    expect(calls.some((c) => c.startsWith("POST /mobile/growth/slots/card") && c.includes("2026-11-25T08:00:00.000Z") && c.includes("2026-11-25T08:30:00.000Z"))).toBe(true);
    await fireEvent.press(screen.getByTestId("slots-share"));
    await waitFor(() => expect(mockShare).toHaveBeenCalled());
    expect(screen.getByText(/Times are in the clinic time zone \(Africa\/Cairo\)/)).toBeTruthy();
  });
  it("a slot that was taken clears the selection, says so and refreshes the list", async () => {
    await setLang("en");
    let list = 0;
    mockRequest.mockImplementation(async (_p: string, method: string, path: string) => {
      if (path === "/mobile/growth/slots") { list += 1; return list === 1 ? SLOTS : { ...SLOTS, items: SLOTS.items.slice(1) }; }
      if (path === "/mobile/growth/slots/card") throw new ApiError(409, "SLOT_NO_LONGER_AVAILABLE", "gone");
      throw new ApiError(404, "NOT_FOUND", "x");
    });
    await wrap(<Slots />);
    await fireEvent.press((await screen.findAllByTestId("slots-option"))[0]!);
    await fireEvent.press(screen.getByTestId("slots-create"));
    expect(await screen.findByTestId("slots-msg")).toBeTruthy();
    await waitFor(() => expect(screen.getAllByTestId("slots-option")).toHaveLength(1));
  });
  it("empty state", async () => {
    await setLang("en");
    route({ "GET /mobile/growth/slots": { ...SLOTS, items: [] } });
    await wrap(<Slots />);
    expect(await screen.findByTestId("slots-empty")).toBeTruthy();
  });
  it("Arabic labels", async () => {
    await setLang("ar");
    route({ "GET /mobile/growth/slots": SLOTS });
    await wrap(<Slots />);
    expect(await screen.findByText("الأربعاء ٢٥ نوفمبر، ١٠:٠٠ ص")).toBeTruthy();
  });
});

describe("Growth statements screen", () => {
  const ST = { webUrl: "http://localhost:5173/kiorex/growth?tab=statement", month: "2026-11", zone: "Africa/Cairo", currency: "EGP", lines: [
    { appointmentId: "a1", date: "2026-11-05", origin: "MARKETPLACE", decision: "CHARGE", amount: "40.00", chargeStatus: "CONFIRMED" },
    { appointmentId: "a2", date: "2026-11-06", origin: "PROVIDER_LED", decision: "NO_CHARGE", amount: null, chargeStatus: null },
  ], totals: { active: "40.00", activeCount: 1, reversed: "0.00", waived: "0.00", providerLed: 1 } };
  it("shows totals, one line per visit, shares a text summary and links to the web PDF", async () => {
    await setLang("en");
    route({ "GET /mobile/growth/statements/": ST });
    await wrap(<Statements />);
    expect(await screen.findAllByTestId("statements-line")).toHaveLength(2);
    expect(within(screen.getByTestId("statements-totals")).getByText(/Active charges/)).toBeTruthy();
    await fireEvent.press(screen.getByTestId("statements-share"));
    await waitFor(() => expect(mockShare).toHaveBeenCalledWith(expect.stringContaining("active charges 40.00 EGP, 1 booking(s)"), ""));
    await fireEvent.press(screen.getByTestId("statements-web"));
    expect(mockWeb).toHaveBeenCalledWith(ST.webUrl);
  });
  it("a non-admin gets the admin-only message", async () => {
    await setLang("en");
    route({ "GET /mobile/growth/statements/": new ApiError(403, "MODULE_NOT_ALLOWED", "no") });
    await wrap(<Statements />);
    expect(await screen.findByTestId("statements-forbidden")).toBeTruthy();
  });
  it("an empty month says so", async () => {
    await setLang("en");
    route({ "GET /mobile/growth/statements/": { ...ST, lines: [] } });
    await wrap(<Statements />);
    expect(await screen.findByTestId("statements-empty")).toBeTruthy();
  });
  it("Arabic renders", async () => {
    await setLang("ar");
    route({ "GET /mobile/growth/statements/": ST });
    await wrap(<Statements />);
    expect(await screen.findByText(/بند لكل زيارة لها قرار لدى كيوريكس/)).toBeTruthy();
    expect(await screen.findByTestId("statements-totals")).toBeTruthy();
  });
});

describe("Growth verification screen", () => {
  const LIST = { badge: "UPDATE_UNDER_REVIEW", items: [{ id: "r1", field: "LICENSE_NUMBER", status: "NEEDS_INFO", evidenceCount: 1, decisionNote: "Please add a utility bill", createdAt: "2026-11-24T10:00:00Z" }] };
  it("shows the badge and requests with the Kiorex note; sends a request with evidence references; photo needs evidence", async () => {
    await setLang("en");
    const calls: string[] = [];
    mockRequest.mockImplementation(async (_p: string, method: string, path: string, o?: { body?: Record<string, unknown> }) => {
      calls.push(`${method} ${path} ${JSON.stringify(o?.body ?? {})}`);
      if (path === "/mobile/growth/verification" && method === "GET") return LIST;
      if (path === "/mobile/growth/verification" && method === "POST") return { id: "r2" };
      throw new ApiError(404, "NOT_FOUND", "x");
    });
    await wrap(<Verification />);
    expect(await screen.findByText("Update under review")).toBeTruthy();
    expect(within(screen.getByTestId("verification-r1")).getByText(/Please add a utility bill/)).toBeTruthy();
    expect(screen.getByTestId("verification-submit").props.accessibilityState?.disabled ?? true).toBeTruthy();
    await fireEvent.press(screen.getByTestId("verification-field-PHOTO"));
    await fireEvent.changeText(screen.getByTestId("verification-value"), "new photo");
    expect(screen.getByTestId("verification-submit").props.accessibilityState?.disabled).toBe(true);
    await fireEvent.changeText(screen.getByTestId("verification-evidence"), "uploads/photo.png");
    await fireEvent.press(screen.getByTestId("verification-submit"));
    await waitFor(() => expect(calls.some((c) => c.startsWith("POST /mobile/growth/verification") && c.includes('"field":"PHOTO"') && c.includes('"evidenceFileRefs":["uploads/photo.png"]'))).toBe(true));
  });
  it("a duplicate open request gets a plain message", async () => {
    await setLang("en");
    route({ "GET /mobile/growth/verification": { badge: "VERIFIED", items: [] }, "POST /mobile/growth/verification": new ApiError(409, "VERIFICATION_REQUEST_STATE", "dup") });
    await wrap(<Verification />);
    expect(await screen.findByTestId("verification-empty")).toBeTruthy();
    await fireEvent.changeText(screen.getByTestId("verification-value"), "EG-1");
    await fireEvent.press(screen.getByTestId("verification-submit"));
    expect(await screen.findByText(/already an open request/)).toBeTruthy();
  });
  it("a non-admin gets the admin-only message", async () => {
    await setLang("en");
    route({ "GET /mobile/growth/verification": new ApiError(403, "MODULE_NOT_ALLOWED", "no") });
    await wrap(<Verification />);
    expect(await screen.findByTestId("verification-forbidden")).toBeTruthy();
  });
  it("Arabic renders the badge and fields", async () => {
    await setLang("ar");
    route({ "GET /mobile/growth/verification": LIST });
    await wrap(<Verification />);
    expect(await screen.findByText("التحديث قيد المراجعة")).toBeTruthy();
    expect(screen.getAllByText("رقم الترخيص").length).toBeGreaterThan(0);
  });
});

// Last on purpose: a failing read leaves react-query in an error state that the other suites in this file must not inherit.
describe("Growth screens: load errors", () => {
  it("a failing templates read shows the retryable error state", async () => {
    await setLang("en");
    route({ "GET /mobile/growth/templates": new ApiError(500, "HTTP_500", "boom") });
    await wrap(<Share />);
    expect(await screen.findByTestId("error-state")).toBeTruthy();
  });
});
