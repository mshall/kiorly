import type { ReactElement } from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import i18n from "@/i18n";
import { ThemeProvider } from "@/theme";
import { ApiError } from "@/api/errors";
import { __resetLiteForTests } from "@/lite/store";
import { __resetForTests as resetQueue, enqueue, resolve as resolveOp } from "@/offline/queue";

const mockMutate = jest.fn();
jest.mock("@/offline/mutate", () => ({ mutate: (...a: unknown[]) => mockMutate(...a) }));
jest.mock("expo-router", () => ({ useRouter: () => ({ push: jest.fn() }) }));
const mockBoot: { current: Record<string, unknown> } = { current: {} };
const mockRefresh = jest.fn();
jest.mock("@/auth/SessionProvider", () => ({ useSessions: () => ({ sessions: { clinic: { email: "nurse.basic@demo.kiorex.test", bootstrap: mockBoot.current } }, products: ["clinic"], isEntitled: () => false, refreshBootstrap: mockRefresh }) }));

import { LockedTile, UpgradeRequestButton, UpgradeSheet } from "@/components/lite";
import { tileByKey } from "@/modules/registry";

const boot = (user: Record<string, unknown>, upgrade: Record<string, unknown> = {}) => ({
  user: { id: "u", name: "n", email: "e", role: "NURSE", roles: ["NURSE"], ...user }, org: { id: "o", name: "Corner", plan: "BASIC" },
  entitlement: { key: "mobile_staff_app", enabled: false, requiredPlan: "PRO", reason: "PLAN_BELOW_PRO" }, modules: [],
  upgrade: { lockedModules: ["clinic.vitals"], myRequest: null, openRequests: null, canApprove: false, ...upgrade },
});
const wrap = (ui: ReactElement) => render(
  <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 800 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } }}><ThemeProvider>{ui}</ThemeProvider></SafeAreaProvider>);
const tap = async (id: string) => { await fireEvent.press(screen.getByTestId(id)); };

beforeEach(async () => {
  mockMutate.mockReset(); mockRefresh.mockReset(); __resetLiteForTests(); resetQueue();
  mockBoot.current = boot({});
  await act(async () => { await i18n.changeLanguage("en"); });
});

describe("UpgradeRequestButton", () => {
  it("staff see 'Ask your admin to upgrade'; owners/admins see 'Upgrade plan'", async () => {
    await wrap(<UpgradeRequestButton product="clinic" featureKey="clinic.vitals" />);
    expect(screen.getByText("Ask your admin to upgrade")).toBeTruthy();
    expect(screen.queryByText("Upgrade plan")).toBeNull();
    mockBoot.current = boot({ role: "CLINIC_ADMIN" }, { canApprove: true });
    await screen.unmount();
    await wrap(<UpgradeRequestButton product="clinic" featureKey="clinic.vitals" />);
    expect(screen.getByText("Upgrade plan")).toBeTruthy();
  });

  it("idle -> sending -> requested with the date, posts the feature key, and cannot be sent twice", async () => {
    let resolve!: (v: unknown) => void;
    mockMutate.mockReturnValue(new Promise((r) => { resolve = r; }));
    await wrap(<UpgradeRequestButton product="clinic" featureKey="clinic.vitals" />);
    await tap("upgrade-request");
    expect(screen.getByText("Sending…")).toBeTruthy();
    expect(screen.getByTestId("upgrade-request").props.accessibilityState.disabled).toBe(true);
    await act(async () => { resolve({ queued: false, data: { status: "REQUESTED", requestedAt: "2026-11-21T10:00:00.000Z" } }); });
    await waitFor(() => expect(screen.getByTestId("upgrade-request-done")).toBeTruthy());
    expect(screen.getByText(/Requested on/)).toBeTruthy();
    expect(mockMutate).toHaveBeenCalledTimes(1);
    expect(mockMutate).toHaveBeenCalledWith("clinic", "POST", "/mobile/upgrade-request", { featureKey: "clinic.vitals" }, expect.objectContaining({ queueable: true, owner: "nurse.basic@demo.kiorex.test" }));
  });

  it("optional note: capped at 500 chars, trimmed, sent with the request; omitted when empty", async () => {
    mockMutate.mockResolvedValue({ queued: false, data: { status: "REQUESTED", requestedAt: "2026-11-21T10:00:00.000Z" } });
    await wrap(<UpgradeRequestButton product="clinic" featureKey="clinic.vitals" />);
    const field = screen.getByTestId("upgrade-note");
    expect(field.props.maxLength).toBe(500);
    await fireEvent.changeText(field, "x".repeat(600));
    expect(screen.getByTestId("upgrade-note").props.value.length).toBe(500);
    expect(screen.getByTestId("upgrade-note-count").props.children).toBe("500/500");
    await tap("upgrade-request");
    await waitFor(() => expect(screen.getByTestId("upgrade-request-done")).toBeTruthy());
    expect(mockMutate).toHaveBeenCalledWith("clinic", "POST", "/mobile/upgrade-request", { featureKey: "clinic.vitals", note: "x".repeat(500) }, expect.objectContaining({ queueable: true }));
  });

  it("optional note: queued offline together with the request body", async () => {
    const op = await enqueue({ product: "clinic", owner: "nurse.basic@demo.kiorex.test", method: "POST", path: "/mobile/upgrade-request", body: {}, label: "upgrade:clinic.vitals" });
    mockMutate.mockResolvedValue({ queued: true, opId: op.id });
    await wrap(<UpgradeRequestButton product="clinic" featureKey="clinic.vitals" />);
    await fireEvent.changeText(screen.getByTestId("upgrade-note"), "I take vitals for every walk-in");
    await tap("upgrade-request");
    await waitFor(() => expect(screen.getByText(/Saved offline/)).toBeTruthy());
    expect(mockMutate.mock.calls[0][3]).toEqual({ featureKey: "clinic.vitals", note: "I take vitals for every walk-in" });
    expect(mockMutate.mock.calls[0][4]).toEqual(expect.objectContaining({ queueable: true }));
    expect(screen.queryByTestId("upgrade-note")).toBeNull(); // note box gives way to the queued state
  });

  it("optional note: shown in Arabic", async () => {
    await act(async () => { await i18n.changeLanguage("ar"); });
    await wrap(<UpgradeRequestButton product="clinic" featureKey="clinic.vitals" />);
    expect(screen.getByText("أضف ملاحظة (اختياري)")).toBeTruthy();
  });

  it("offline: goes through the offline queue and shows the queued state", async () => {
    const op = await enqueue({ product: "clinic", owner: "nurse.basic@demo.kiorex.test", method: "POST", path: "/mobile/upgrade-request", body: {}, label: "upgrade:clinic.vitals" });
    mockMutate.mockResolvedValue({ queued: true, opId: op.id });
    await wrap(<UpgradeRequestButton product="clinic" featureKey="clinic.vitals" />);
    await tap("upgrade-request");
    await waitFor(() => expect(screen.getByText(/Saved offline/)).toBeTruthy());
    // the sync driver delivers it and drops it from the queue -> requested
    await act(async () => { await resolveOp(op.id, "discard"); });
    await waitFor(() => expect(screen.getByText(/Requested on/)).toBeTruthy());
  });

  it("error: shows a retry that works", async () => {
    mockMutate.mockRejectedValueOnce(new ApiError(500, "HTTP_500", "boom"));
    await wrap(<UpgradeRequestButton product="clinic" featureKey="clinic.vitals" />);
    await tap("upgrade-request");
    await waitFor(() => expect(screen.getByTestId("upgrade-request-error")).toBeTruthy());
    expect(screen.getByText("Try again")).toBeTruthy();
    mockMutate.mockResolvedValueOnce({ queued: false, data: { status: "REQUESTED", requestedAt: new Date().toISOString() } });
    await tap("upgrade-request");
    await waitFor(() => expect(screen.getByTestId("upgrade-request-done")).toBeTruthy());
  });

  it("starts as requested when the server already has my request for this feature (new device)", async () => {
    mockBoot.current = boot({}, { myRequest: { featureKey: "clinic.vitals", requestedAt: new Date().toISOString() } });
    await wrap(<UpgradeRequestButton product="clinic" featureKey="clinic.vitals" />);
    await waitFor(() => expect(screen.getByTestId("upgrade-request-done")).toBeTruthy());
    expect(mockMutate).not.toHaveBeenCalled();
  });

  it("works in Arabic", async () => {
    await act(async () => { await i18n.changeLanguage("ar"); });
    await wrap(<UpgradeRequestButton product="clinic" featureKey="clinic.vitals" />);
    expect(screen.getByText("اطلب من مسؤولك الترقية")).toBeTruthy();
  });
});

describe("locked tile + sheet", () => {
  it("tile is a labelled 44px+ button with a lock and a Pro pill", async () => {
    const onPress = jest.fn();
    await wrap(<LockedTile tile={tileByKey("clinic.vitals")!} onPress={onPress} />);
    const el = screen.getByTestId("locked-clinic.vitals");
    expect(el.props.accessibilityLabel).toMatch(/Quick vitals.*Pro feature, locked/);
    expect(screen.getByText("Pro")).toBeTruthy();
    await fireEvent.press(el);
    expect(onPress).toHaveBeenCalled();
  });
  it("sheet shows the benefit for THIS role (nurse vs doctor) and the plan needed", async () => {
    await wrap(<UpgradeSheet product="clinic" featureKey="clinic.vitals" onClose={() => {}} />);
    expect(screen.getByTestId("upgrade-benefit").props.children).toMatch(/critical/);
    expect(screen.getByText(/Pro or Enterprise\. You are on Basic/)).toBeTruthy();
    await screen.unmount();
    mockBoot.current = boot({ role: "PHYSICIAN", roles: ["PHYSICIAN"] });
    await wrap(<UpgradeSheet product="clinic" featureKey="clinic.vitals" onClose={() => {}} />);
    expect(screen.getByTestId("upgrade-benefit").props.children).toMatch(/during the visit/);
  });
});
