import { Stack } from "expo-router";
import { useTranslation } from "react-i18next";
import { Alert, Platform, View } from "react-native";
import { useQueries, useQueryClient } from "@tanstack/react-query";
import { Badge, Card, Row, Screen, T, Button, useToast } from "@/components/ui";
import { SectionTitle, SkeletonList } from "@/components/kit";
import { EmptyState } from "@/components/states";
import { useSessions } from "@/auth/SessionProvider";
import { api } from "@/api/client";
import { PRODUCT_META } from "@/api/products";
import type { DeviceRow } from "@/api/types";
import { usePullRefresh } from "@/hooks/useRead";
import { formatTime, formatDay } from "@/lib/format";

/** Device-bound sessions: see every device and remote sign-out (owner/admin sees the team). */
export default function Devices() {
  const { t, i18n } = useTranslation();
  const qc = useQueryClient();
  const toast = useToast();
  const { products, sessions } = useSessions();
  const results = useQueries({ queries: products.filter((p) => sessions[p]?.deviceRecordId).map((p) => ({ queryKey: [p, "/mobile/devices"], queryFn: async () => ({ p, items: (await api.get<{ items: DeviceRow[] }>(p, "/mobile/devices")).items }) })) });
  const refresh = usePullRefresh({ refetch: () => Promise.all(results.map((r) => r.refetch())) });
  const confirm = (msg: string) => new Promise<boolean>((res) => {
    if (Platform.OS === "web") res(typeof window !== "undefined" ? window.confirm(msg) : true);
    else Alert.alert(t("devices.revoke"), msg, [{ text: t("common.cancel"), style: "cancel", onPress: () => res(false) }, { text: t("devices.revoke"), style: "destructive", onPress: () => res(true) }]);
  });
  const revoke = async (p: (typeof products)[number], d: DeviceRow) => {
    if (!(await confirm(t("devices.revokeConfirm", { product: t(PRODUCT_META[p].nameKey) })))) return;
    try { await api.del(p, `/mobile/devices/${d.id}`); toast.show(t("devices.revoked")); await qc.invalidateQueries({ queryKey: [p, "/mobile/devices"] }); } catch { toast.show(t("common.failed"), "error"); }
  };
  return (
    <Screen refresh={refresh} testID="devices">
      <Stack.Screen options={{ title: t("devices.title") }} />
      {results.some((r) => r.isLoading) ? <SkeletonList rows={3} /> : null}
      {!results.length ? <EmptyState icon="device" title={t("devices.empty")} /> : null}
      {results.map((r) => r.data ? (
        <View key={r.data.p} style={{ gap: 10 }}>
          <SectionTitle title={t(PRODUCT_META[r.data.p].nameKey)} />
          {r.data.items.filter((d) => d.status === "ACTIVE" || d.status === "REVOKED").map((d) => {
            const mine = sessions[r.data!.p]?.deviceRecordId === d.id;
            return (
              <Card key={d.id} testID={`device-${d.id}`} style={{ gap: 8 }}>
                <Row style={{ justifyContent: "space-between" }}><T weight="semibold">{d.name} · {d.platform}</T>{mine ? <Badge tone="ink" label={t("devices.thisDevice")} /> : <Badge tone={d.status === "ACTIVE" ? "success" : "muted"} label={d.status === "ACTIVE" ? t("devices.active") : t("devices.revoked")} />}</Row>
                {d.staff?.name || d.userName ? <T variant="small" muted>{d.staff?.name ?? d.userName}</T> : null}
                {d.lastSeenAt ? <T variant="caption" muted>{t("devices.lastSeen", { time: `${formatDay(d.lastSeenAt, i18n.language)} ${formatTime(d.lastSeenAt, i18n.language)}` })}</T> : null}
                {d.status === "ACTIVE" && !mine ? <Button small variant="danger" title={t("devices.revoke")} onPress={() => void revoke(r.data!.p, d)} testID={`revoke-${d.id}`} /> : null}
              </Card>
            );
          })}
        </View>
      ) : null)}
    </Screen>
  );
}
