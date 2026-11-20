import { View } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import type { Session } from "@/api/types";
import { useRead } from "@/hooks/useRead";
import { SkeletonList, StatTile } from "@/components/kit";

interface Summary { ordersToday: number | null; awaitingCollection: number | null; inLab: number | null; pendingTechValidation: number | null; pendingMedicalValidation: number | null; openCriticalValues: number | null; openQcBlocks: number | null; tatBreaches24h: number | null; reagents: { lowStock: number; expiringLots: number } | null }

/** Lab KPI tiles (role-aware: counters the role may not see arrive as null and are hidden). */
export default function HomeSummary(_p: { session: Session }) {
  const { t } = useTranslation();
  const router = useRouter();
  const q = useRead<Summary>("lab", "/mobile/summary", { refetchInterval: 60_000 });
  if (q.isLoading) return <SkeletonList rows={1} />;
  const s = q.data; if (!s) return null;
  const go = (r: string) => () => router.push(r as never);
  const tiles = [
    s.openCriticalValues != null && { k: "crit", label: t("lab.home.critical"), value: s.openCriticalValues, tone: s.openCriticalValues ? "danger" : "success", icon: "alert", to: "/lab/critical" },
    s.awaitingCollection != null && { k: "col", label: t("lab.home.awaiting"), value: s.awaitingCollection, tone: "ocean", icon: "syringe", to: "/lab/phlebotomy" },
    s.pendingMedicalValidation != null && { k: "med", label: t("lab.home.medical"), value: s.pendingMedicalValidation, tone: "ink", icon: "award", to: "/lab/validation" },
    s.pendingTechValidation != null && { k: "tech", label: t("lab.home.tech"), value: s.pendingTechValidation, tone: "ink", icon: "check", to: "/lab/validation" },
    s.tatBreaches24h != null && { k: "tat", label: t("lab.home.tat"), value: s.tatBreaches24h, tone: s.tatBreaches24h ? "warning" : "success", icon: "clock", to: "/lab/tat" },
    s.openQcBlocks != null && { k: "qc", label: t("lab.home.qc"), value: s.openQcBlocks, tone: s.openQcBlocks ? "warning" : "success", icon: "activity", to: "/lab/qc" },
  ].filter(Boolean) as { k: string; label: string; value: number; tone: "danger" | "success" | "ocean" | "ink" | "warning"; icon: "alert"; to: string }[];
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }} testID="lab-summary">
      {tiles.slice(0, 4).map((x) => <View key={x.k} style={{ flexBasis: "47%", flexGrow: 1 }}><StatTile testID={`lab-kpi-${x.k}`} label={x.label} value={x.value} tone={x.tone} icon={x.icon} onPress={go(x.to)} /></View>)}
    </View>
  );
}
