import { useEffect, useState } from "react";
import { Linking, View } from "react-native";
import { Stack } from "expo-router";
import { useTranslation } from "react-i18next";
import { Badge, Banner, Button, Field, Row, Screen, Sheet, T, useToast } from "@/components/ui";
import { ListRow, QueryView } from "@/components/kit";
import { useAlerts, useAckAlert, type ProductAlert } from "@/hooks/useAlerts";
import { usePullRefresh } from "@/hooks/useRead";
import { haptic } from "@/lib/haptics";
import { useTheme } from "@/theme";
import { countdownLabel, isCriticalKind, minutesLeft, labErrorKey } from "@/modules/lab/helpers";

/** Critical values: ack + escalation. Reads /mobile/alerts so it works on every plan (ADR-025). */
export default function Critical() {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const toast = useToast();
  const ar = i18n.language.startsWith("ar");
  const alerts = useAlerts("all");
  const ack = useAckAlert();
  const [sel, setSel] = useState<ProductAlert | null>(null);
  const [note, setNote] = useState(""); const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 30_000); return () => clearInterval(id); }, []);
  const refresh = usePullRefresh({ refetch: () => alerts.refetch() });
  const items = alerts.items.filter((a) => a.product === "lab" && isCriticalKind(a.kind));
  const open = items.filter((a) => !a.ackedAt);
  const phone = (a: ProductAlert) => (a as unknown as { clinicianPhone?: string }).clinicianPhone;
  const doAck = async () => {
    if (!sel) return; setBusy(true);
    try { await ack(sel, note.trim() || undefined); haptic.success(); toast.show(t("inbox.ackSuccess")); setSel(null); setNote(""); } catch (e) { toast.show(t(labErrorKey(e)), "error"); } finally { setBusy(false); }
  };
  return (
    <Screen refresh={refresh} testID="lab-critical">
      <Stack.Screen options={{ title: t("tiles.lab.critical.title") }} />
      <Banner tone="ink" body={t("inbox.safetyFree")} />
      <QueryView q={{ data: items, isLoading: alerts.isLoading, isError: alerts.isError, error: null, refetch: alerts.refetch as never }} isEmpty={(d) => !d.length} empty={{ icon: "shield", title: t("inbox.noAlerts"), hint: t("lab.critEmptyHint") }}>
        {(d) => (
          <View style={{ gap: 10 }}>
            {[...open, ...d.filter((a) => a.ackedAt)].map((a) => {
              const m = minutesLeft(a.dueAt, now);
              return (
                <ListRow key={a.id} testID={`crit-${a.id}`} icon="alert" iconTone={a.ackedAt ? "muted" : a.severity === "CRITICAL" ? "danger" : "warning"} accent={a.ackedAt ? undefined : colors.danger}
                  title={ar ? a.titleAr ?? a.title : a.title} subtitle={ar ? a.bodyAr ?? a.body : a.body}
                  meta={!a.ackedAt && m != null ? `${m < 0 ? t("lab.overdue") : t("lab.dueIn")} ${countdownLabel(m)}${a.escalationLevel ? ` · ${t("lab.escalationLevel", { level: a.escalationLevel })}` : ""}` : a.ackedAt ? t("inbox.ackedBy", { name: a.ackedByName ?? "" }) : undefined}
                  badge={a.ackedAt ? t("inbox.acked") : t("inbox.critical")} badgeTone={a.ackedAt ? "success" : "danger"} onPress={() => { haptic.tap(); setSel(a); }} />
              );
            })}
          </View>
        )}
      </QueryView>
      <Sheet visible={!!sel} onClose={() => setSel(null)} title={sel ? (ar ? sel.titleAr ?? sel.title : sel.title) : ""} testID="crit-sheet"
        footer={sel && !sel.ackedAt ? <Button title={t("inbox.ack")} onPress={() => void doAck()} loading={busy} testID="crit-ack" /> : undefined}>
        {sel ? (<>
          <Row gap={8}><Badge tone="danger" label={t("inbox.critical")} />{sel.escalationLevel ? <Badge tone="warning" label={t("lab.escalationLevel", { level: sel.escalationLevel })} /> : null}</Row>
          <T>{ar ? sel.bodyAr ?? sel.body : sel.body}</T>
          {phone(sel) ? <Button variant="secondary" icon="phone" title={t("lab.callClinician")} onPress={() => void Linking.openURL(`tel:${phone(sel)}`)} /> : <T variant="small" muted>{t("lab.callHint")}</T>}
          {!sel.ackedAt ? <Field label={t("inbox.ackNote")} value={note} onChangeText={setNote} multiline testID="crit-note" /> : null}
        </>) : null}
      </Sheet>
    </Screen>
  );
}
