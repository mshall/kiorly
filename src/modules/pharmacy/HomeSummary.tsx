import { useRouter } from "expo-router";
import { View } from "react-native";
import { Row } from "@/components/ui";
import { StatTile } from "@/components/kit";
import { useRead } from "@/hooks/useRead";
import { useTranslation } from "react-i18next";
import type { Session } from "@/api/types";
import { hasScreen, money } from "./lib";

interface Exp { expiry: { expired: { lots: number }; within30: { lots: number } }; lowStock: { count: number } }
interface Shift { open: boolean; report: null | { expectedCash?: string; cashSales: string; salesCount: number } }

/** Home KPIs for Pharmacy, role-aware (queries are enabled only for modules the role has). */
export default function HomeSummary({ session }: { session: Session }) {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const b = session.bootstrap;
  const mod = (k: string) => !!b?.modules.find((m) => m.key === k && m.enabled);
  const rxOn = mod("pharmacy.rx"); const expOn = mod("pharmacy.expiry"); const shiftOn = mod("pharmacy.shift");
  const rx = useRead<{ total: number; urgent: number }>("pharmacy", "/prescriptions/verification-queue", { enabled: rxOn, refetchInterval: 60_000 });
  const ex = useRead<Exp>("pharmacy", "/mobile/pharmacy/expiry-lowstock", { enabled: expOn });
  const sh = useRead<Shift>("pharmacy", "/mobile/pharmacy/shift-summary", { enabled: shiftOn });
  void hasScreen;
  return (
    <View style={{ gap: 10 }} testID="pharmacy-summary">
      <Row gap={10} style={{ alignItems: "stretch" }}>
        {rxOn ? <StatTile testID="kpi-rx" label={t("pharmacy.rx.waiting")} value={rx.data?.total ?? "-"} icon="clipboard" tone={rx.data?.urgent ? "danger" : "ink"} hint={rx.data?.urgent ? `${rx.data.urgent} ${t("pharmacy.rx.urgent")}` : undefined} onPress={() => router.push("/pharmacy/rx" as never)} /> : null}
        {expOn ? <StatTile testID="kpi-expiry" label={t("pharmacy.expiry.soon")} value={ex.data ? ex.data.expiry.expired.lots + ex.data.expiry.within30.lots : "-"} icon="clock" tone="warning" onPress={() => router.push("/pharmacy/expiry" as never)} /> : null}
      </Row>
      <Row gap={10}>
        {expOn ? <StatTile testID="kpi-low" label={t("pharmacy.expiry.lowStock")} value={ex.data?.lowStock.count ?? "-"} icon="box" tone="ocean" onPress={() => router.push("/pharmacy/expiry" as never)} /> : null}
        {shiftOn ? <StatTile testID="kpi-cash" label={t("pharmacy.shift.expectedCash")} value={sh.data?.report ? money(sh.data.report.expectedCash ?? sh.data.report.cashSales, i18n.language) : "-"} icon="receipt" tone="success" onPress={() => router.push("/pharmacy/shift" as never)} /> : null}
      </Row>
    </View>
  );
}
