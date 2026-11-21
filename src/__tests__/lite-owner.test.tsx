import type { ReactElement } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import i18n from "@/i18n";
import { ThemeProvider } from "@/theme";
import { __resetLiteForTests } from "@/lite/store";

const mockPush = jest.fn();
jest.mock("expo-router", () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock("@/offline/mutate", () => ({ mutate: jest.fn() }));
const mockBoot: { current: Record<string, unknown> } = { current: {} };
jest.mock("@/auth/SessionProvider", () => ({ useSessions: () => ({ sessions: { clinic: { email: "owner.basic@demo.kiorex.test", bootstrap: mockBoot.current } }, products: ["clinic"], isEntitled: () => false, refreshBootstrap: jest.fn() }) }));

import { T } from "@/components/ui";
import { LiteBadge, LiteHomeBlock, UpgradeRequestsSection, useOpenRequestTotal } from "@/components/lite";

const items = [
  { id: "r1", featureKey: "clinic.vitals", requesterRole: "NURSE", requesterName: "Nadia Ali", requestedAt: "2026-11-21T10:00:00.000Z", note: "need it on rounds" },
  { id: "r2", featureKey: "general", requesterRole: "RECEPTIONIST", requesterName: "Omar Khaled", requestedAt: "2026-11-20T10:00:00.000Z" },
  { id: "r3", featureKey: "clinic.revenue", requesterRole: "BRANCH_MANAGER", requesterName: "Sara Fathy", requestedAt: "2026-11-19T10:00:00.000Z" },
  { id: "r4", featureKey: "clinic.visits", requesterRole: "PHYSICIAN", requesterName: "Dr Hana", requestedAt: "2026-11-18T10:00:00.000Z" },
];
const boot = (upgrade: Record<string, unknown>, role = "CLINIC_ADMIN") => ({
  user: { id: "u", name: "n", email: "e", role, roles: [role] }, org: { id: "o", name: "Corner", plan: "BASIC" },
  entitlement: { key: "mobile_staff_app", enabled: false, requiredPlan: "PRO", reason: "PLAN_BELOW_PRO" }, modules: [],
  upgrade: { lockedModules: ["clinic.vitals"], myRequest: null, openRequests: 4, openRequestItems: items, canApprove: true, ...upgrade },
});
const wrap = (ui: ReactElement) => render(
  <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 800 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } }}><ThemeProvider>{ui}</ThemeProvider></SafeAreaProvider>);
const Total = () => { const n = useOpenRequestTotal(); return <T>{`total:${n}`}</T>; };

beforeEach(async () => {
  mockPush.mockReset(); __resetLiteForTests();
  mockBoot.current = boot({});
  await act(async () => { await i18n.changeLanguage("en"); });
});

describe("Home upgrade requests (owner on Lite)", () => {
  it("shows who asked for what and when, with a count badge, and caps the list", async () => {
    await wrap(<LiteHomeBlock product="clinic" />);
    expect(screen.getByText("Upgrade requests")).toBeTruthy();
    expect(screen.getByTestId("upgrade-requests-count-clinic")).toBeTruthy();
    expect(screen.getByText("Nadia Ali asked for Quick vitals")).toBeTruthy();
    expect(screen.getByText("Omar Khaled asked for the Pro plan")).toBeTruthy();
    expect(screen.getByText(/need it on rounds/)).toBeTruthy();
    expect(screen.queryByText(/Dr Hana/)).toBeNull(); // 4th row is behind "more"
    expect(screen.getByTestId("upgrade-requests-more-clinic")).toBeTruthy();
  });
  it("tapping a row opens the plan page for that feature (and general has no feature)", async () => {
    await wrap(<LiteHomeBlock product="clinic" />);
    await fireEvent.press(screen.getByTestId("upgrade-request-r1"));
    expect(mockPush).toHaveBeenLastCalledWith("/upgrade?product=clinic&feature=clinic.vitals");
    await fireEvent.press(screen.getByTestId("upgrade-request-r2"));
    expect(mockPush).toHaveBeenLastCalledWith("/upgrade?product=clinic");
  });
  it("rows are labelled buttons with at least a 44px target", async () => {
    await wrap(<UpgradeRequestsSection product="clinic" />);
    const row = screen.getByTestId("upgrade-request-r1");
    expect(row.props.accessibilityRole).toBe("button");
    expect(row.props.accessibilityLabel).toMatch(/Nadia Ali asked for Quick vitals\. Nurse/);
    const style = typeof row.props.style === "function" ? row.props.style({ pressed: false }) : row.props.style;
    expect((Array.isArray(style) ? Object.assign({}, ...style) : style).minHeight).toBeGreaterThanOrEqual(44);
  });
  it("staff roles keep the existing state: no requests section", async () => {
    mockBoot.current = boot({ canApprove: false, openRequests: null, openRequestItems: [] }, "NURSE");
    await wrap(<LiteHomeBlock product="clinic" />);
    expect(screen.queryByText("Upgrade requests")).toBeNull();
    expect(screen.getByTestId("upgrade-card-clinic")).toBeTruthy();
  });
  it("older server with only a count still shows a single count row", async () => {
    mockBoot.current = boot({ openRequests: 3, openRequestItems: undefined });
    await wrap(<UpgradeRequestsSection product="clinic" />);
    expect(screen.getByTestId("upgrade-requests-countonly-clinic")).toBeTruthy();
    expect(screen.getByText("3")).toBeTruthy();
  });
  it("renders nothing for an approver with no open requests", async () => {
    mockBoot.current = boot({ openRequests: 0, openRequestItems: [] });
    await wrap(<UpgradeRequestsSection product="clinic" />);
    expect(screen.queryByText("Upgrade requests")).toBeNull();
  });
  it("works in Arabic", async () => {
    await act(async () => { await i18n.changeLanguage("ar"); });
    await wrap(<UpgradeRequestsSection product="clinic" />);
    expect(screen.getByText("طلبات الترقية")).toBeTruthy();
    expect(screen.getByText(/Nadia Ali طلب/)).toBeTruthy();
  });
});

describe("Me badge / tab total", () => {
  it("LiteBadge carries the count for approvers and total is summed for the tab", async () => {
    await wrap(<><LiteBadge product="clinic" /><Total /></>);
    expect(screen.getByTestId("lite-badge-clinic")).toBeTruthy();
    expect(screen.getByTestId("lite-badge-count-clinic")).toBeTruthy();
    expect(screen.getByText("total:4")).toBeTruthy();
  });
  it("no count badge for staff", async () => {
    mockBoot.current = boot({ canApprove: false, openRequests: null, openRequestItems: [] }, "NURSE");
    await wrap(<><LiteBadge product="clinic" /><Total /></>);
    expect(screen.queryByTestId("lite-badge-count-clinic")).toBeNull();
    expect(screen.getByText("total:0")).toBeTruthy();
  });
});
