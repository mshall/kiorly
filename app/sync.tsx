import { useState } from "react";
import { Stack } from "expo-router";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import { Badge, Banner, Button, Card, Row, Screen, Sheet, T, useToast } from "@/components/ui";
import { KV, SectionTitle, StatTile } from "@/components/kit";
import { EmptyState } from "@/components/states";
import { useQueue, useSyncStatus } from "@/hooks/useRead";
import { useOnline } from "@/offline/network";
import { resolve, type QueuedOp } from "@/offline/queue";
import { syncNow } from "@/offline/mutate";
import { useSessions } from "@/auth/SessionProvider";
import { PRODUCT_META } from "@/api/products";
import { formatDay, formatTime } from "@/lib/format";

export default function SyncCentre() {
  const { t, i18n } = useTranslation();
  const toast = useToast();
  const qc = useQueryClient();
  const online = useOnline();
  const s = useSyncStatus();
  const ops = useQueue();
  const { sessions } = useSessions();
  const [sel, setSel] = useState<QueuedOp | null>(null);
  const [busy, setBusy] = useState(false);
  const run = async () => { setBusy(true); try { for (const sess of Object.values(sessions)) await syncNow(sess!.email); await qc.invalidateQueries(); } finally { setBusy(false); } };
  const act = async (a: "keepMine" | "retry" | "discard") => { if (!sel) return; await resolve(sel.id, a); setSel(null); if (a !== "discard") void run(); toast.show(a === "discard" ? t("sync.discard") : t("sync.keepMine")); };
  return (
    <Screen testID="sync-centre">
      <Stack.Screen options={{ title: t("sync.title") }} />
      <Row gap={10}>
        <StatTile label={t("sync.online")} value={online ? "●" : "○"} tone={online ? "success" : "warning"} icon={online ? "check" : "wifiOff"} />
        <StatTile label={t("sync.queue")} value={s.total} tone={s.total ? "warning" : "success"} icon="sync" />
      </Row>
      <T variant="caption" muted>{t("sync.lastSync", { time: s.lastSyncAt ? `${formatDay(s.lastSyncAt, i18n.language)} ${formatTime(s.lastSyncAt, i18n.language)}` : t("sync.never") })}</T>
      <Button title={t("sync.syncNow")} icon="sync" onPress={() => void run()} loading={busy} disabled={!online} testID="sync-now" />
      <SectionTitle title={t("sync.queue")} />
      {!ops.length ? <EmptyState icon="check" title={t("sync.emptyQueue")} /> : ops.map((o) => (
        <Card key={o.id} testID={`op-${o.id}`} onPress={o.status !== "pending" ? () => setSel(o) : undefined} style={{ gap: 6 }}>
          <Row style={{ justifyContent: "space-between" }}><T weight="semibold">{o.label}</T><Badge tone={o.status === "conflict" ? "danger" : o.status === "failed" ? "warning" : "ocean"} label={o.status} /></Row>
          <T variant="caption" muted>{t(PRODUCT_META[o.product].nameKey)} · {o.method} {o.path}</T>
          {o.error ? <T variant="caption" muted>{o.error}</T> : null}
        </Card>
      ))}
      <Sheet visible={!!sel} onClose={() => setSel(null)} title={sel?.status === "conflict" ? t("sync.conflictTitle") : sel?.label ?? ""} testID="conflict-sheet"
        footer={<View style={{ gap: 8 }}><Button title={sel?.status === "conflict" ? t("sync.keepMine") : t("sync.retry")} onPress={() => void act(sel?.status === "conflict" ? "keepMine" : "retry")} testID="conflict-keep" /><Button variant="secondary" title={t("sync.discard")} onPress={() => void act("discard")} testID="conflict-discard" /></View>}>
        {sel?.status === "conflict" ? <Banner tone="warning" body={t("sync.conflictBody")} /> : null}
        {sel ? (
          <>
            <KV k="API" v={`${sel.method} ${sel.path}`} />
            <KV k={t("sync.queue")} v={sel.label} />
            {sel.serverState ? <View><T variant="caption" muted>Server</T><T variant="caption" style={{ fontFamily: "monospace" }}>{JSON.stringify(sel.serverState, null, 1).slice(0, 600)}</T></View> : null}
            {sel.body ? <View><T variant="caption" muted>Mine</T><T variant="caption" style={{ fontFamily: "monospace" }}>{JSON.stringify(sel.body, null, 1).slice(0, 600)}</T></View> : null}
          </>
        ) : null}
      </Sheet>
    </Screen>
  );
}
