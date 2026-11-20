import { useState } from "react";
import { View } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQueryClient } from "@tanstack/react-query";
import { useTheme } from "@/theme";
import { Badge, Button, Card, Field, Row, Screen, Sheet, T, useToast } from "@/components/ui";
import { EmptyState } from "@/components/states";
import { Segmented, SkeletonList, TimeAgo, ListRow } from "@/components/kit";
import { usePullRefresh } from "@/hooks/useRead";
import { useAckAlert, useAlerts, useMessages, type ProductAlert } from "@/hooks/useAlerts";
import { useSessions } from "@/auth/SessionProvider";
import { PRODUCT_META, accentFor } from "@/api/products";
import { api } from "@/api/client";
import { routeForPush } from "@/modules/registry";
import { haptic } from "@/lib/haptics";
import { ApiError } from "@/api/errors";

const sevTone = (s: string) => (s === "CRITICAL" ? "danger" : s === "HIGH" ? "warning" : "muted") as "danger" | "warning" | "muted";

export default function Inbox() {
  const { t, i18n } = useTranslation();
  const { colors, scheme } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();
  const qc = useQueryClient();
  const ar = i18n.language.startsWith("ar");
  const { products, isEntitled } = useSessions();
  const [tab, setTab] = useState<"alerts" | "messages">("alerts");
  const alerts = useAlerts("all");
  const msgs = useMessages();
  const ack = useAckAlert();
  const [sel, setSel] = useState<ProductAlert | null>(null);
  const [note, setNote] = useState(""); const [busy, setBusy] = useState(false);
  const refresh = usePullRefresh({ refetch: () => Promise.all([alerts.refetch(), msgs.refetch()]) });

  const doAck = async () => {
    if (!sel) return; setBusy(true);
    try { await ack(sel, note.trim() || undefined); toast.show(t("inbox.ackSuccess")); setSel(null); setNote(""); }
    catch (e) { toast.show((e as ApiError).message || t("common.failed"), "error"); } finally { setBusy(false); }
  };
  const readAll = async () => { for (const p of msgs.entitled) await api.post(p, "/mobile/inbox/read-all").catch(() => {}); await qc.invalidateQueries({ predicate: (q) => q.queryKey[1] === "/mobile/inbox" }); };
  const sendTest = async () => { const p = msgs.entitled[0]; if (!p) return; try { await api.post(p, "/mobile/push/test"); toast.show(t("inbox.testSent"), "info"); await msgs.refetch(); } catch { toast.show(t("common.failed"), "error"); } };

  const open = alerts.items.filter((a) => !a.ackedAt);
  const done = alerts.items.filter((a) => a.ackedAt);
  return (
    <Screen style={{ paddingTop: insets.top + 8, gap: 12 }} title={t("inbox.title")} refresh={refresh} testID="inbox">
      <Segmented value={tab} onChange={setTab} options={[{ value: "alerts", label: t("inbox.alerts"), count: open.length }, { value: "messages", label: t("inbox.messages"), count: msgs.unread || undefined }]} />
      {tab === "alerts" ? (
        alerts.isLoading ? <SkeletonList rows={4} /> : !alerts.items.length ? (
          <EmptyState icon="shield" title={t("inbox.noAlerts")} hint={t("inbox.noAlertsHint")} />
        ) : (
          <View style={{ gap: 10 }}>
            {[...open, ...done].map((a) => (
              <ListRow key={a.product + a.id} testID={`alert-${a.id}`} icon="alert" iconTone={a.ackedAt ? "muted" : sevTone(a.severity) === "danger" ? "danger" : "warning"}
                title={ar ? a.titleAr ?? a.title : a.title} subtitle={ar ? a.bodyAr ?? a.body : a.body}
                meta={`${t(PRODUCT_META[a.product].nameKey)} · ${a.ackedAt ? t("inbox.ackedBy", { name: a.ackedByName ?? "" }) : a.kind.replaceAll("_", " ").toLowerCase()}`}
                badge={a.ackedAt ? t("inbox.acked") : t(`inbox.${a.severity.toLowerCase()}`)} badgeTone={a.ackedAt ? "success" : sevTone(a.severity)} accent={a.ackedAt ? undefined : sevTone(a.severity) === "danger" ? colors.danger : colors.warning}
                onPress={() => { haptic.tap(); setSel(a); }} />
            ))}
            <T variant="caption" muted style={{ textAlign: "center" }}>{t("inbox.safetyFree")}</T>
          </View>
        )
      ) : !msgs.entitled.length ? (
        <EmptyState icon="lock" title={t("inbox.needsPro")} hint={t("upgrade.body")} action={<Button title={t("home.upgradeCta")} onPress={() => router.push(`/upgrade?product=${products.find((p) => !isEntitled(p)) ?? products[0]}` as never)} />} />
      ) : msgs.isLoading ? <SkeletonList rows={4} /> : (
        <View style={{ gap: 10 }}>
          <Row gap={8}><Button small variant="secondary" title={t("inbox.markAll")} onPress={() => void readAll()} style={{ flex: 1 }} /><Button small variant="secondary" title={t("inbox.sendTest")} onPress={() => void sendTest()} style={{ flex: 1 }} testID="push-test" /></Row>
          {!msgs.items.length ? <EmptyState icon="bell" title={t("inbox.noMessages")} /> : msgs.items.map((m) => {
            const route = routeForPush(m.product, m.data as Record<string, unknown> | null);
            return (
              <Card key={m.product + m.id} testID={`msg-${m.id}`} onPress={async () => { await api.post(m.product, `/mobile/inbox/${m.id}/read`).catch(() => {}); void qc.invalidateQueries({ predicate: (q) => q.queryKey[1] === "/mobile/inbox" }); if (route) router.push(route as never); }} style={{ padding: 12, borderStartWidth: 4, borderStartColor: m.readAt ? "transparent" : accentFor(m.product, scheme) }}>
                <Row style={{ justifyContent: "space-between" }}><Badge tone={m.kind === "SAFETY" ? "danger" : "ink"} label={m.kind} /><TimeAgo iso={m.createdAt} /></Row>
                <T weight={m.readAt ? "regular" : "semibold"} style={{ marginTop: 6 }}>{ar ? m.titleAr ?? m.title : m.title}</T>
                <T variant="small" muted>{ar ? m.bodyAr ?? m.body : m.body}</T>
              </Card>
            );
          })}
        </View>
      )}
      <Sheet visible={!!sel} onClose={() => setSel(null)} title={sel ? (ar ? sel.titleAr ?? sel.title : sel.title) : ""} testID="alert-sheet"
        footer={sel && !sel.ackedAt ? <Button title={t("inbox.ack")} onPress={() => void doAck()} loading={busy} testID="alert-ack" /> : undefined}>
        {sel ? (
          <>
            <Row gap={8}><Badge tone={sevTone(sel.severity)} label={t(`inbox.${sel.severity.toLowerCase()}`)} /><Badge tone="ink" label={t(PRODUCT_META[sel.product].nameKey)} /></Row>
            <T>{ar ? sel.bodyAr ?? sel.body : sel.body}</T>
            {sel.subject ? <T variant="small" muted>{sel.subject.label}</T> : null}
            {sel.ackedAt ? <T variant="small" color={colors.success}>{t("inbox.ackedBy", { name: sel.ackedByName ?? "" })}</T> : <Field label={t("inbox.ackNote")} value={note} onChangeText={setNote} multiline />}
          </>
        ) : null}
      </Sheet>
    </Screen>
  );
}
