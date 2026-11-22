import { useState } from "react";
import { View } from "react-native";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { Badge, Banner, Button, Field, Row, Screen, Sheet, T, useToast } from "@/components/ui";
import { FadeIn, ListRow, QueryView, Segmented } from "@/components/kit";
import { useRead, usePullRefresh } from "@/hooks/useRead";
import { api } from "@/api/client";
import { ApiError } from "@/api/errors";
import { haptic } from "@/lib/haptics";
import { formatDay, formatTime } from "@/lib/format";
import { useTheme } from "@/theme";
import { ClinicError, Title, useClinicBoot, useLang } from "@/modules/clinic/shared";
import { canApproveLab, isAbnormalFlag, nameOf } from "@/modules/clinic/helpers";

interface Item { code: string; name: string; nameAr?: string; value: string; unit?: string; flag?: string }
interface LabRes { orderId: string; resultsReadyAt: string; critical: boolean; patient: { id: string; mrn: string; name: string; nameAr?: string }; items: Item[]; review: { reviewedAt?: string; note?: string } | null }

export default function LabResults() {
  const { t, i18n } = useTranslation();
  const { lang, ar } = useLang();
  const { colors } = useTheme();
  const toast = useToast();
  const qc = useQueryClient();
  const { boot } = useClinicBoot();
  const [tab, setTab] = useState<"pending" | "reviewed">("pending");
  const q = useRead<{ items: LabRes[] }>("clinic", "/mobile/lab-results", { query: { status: tab } });
  const refresh = usePullRefresh(q);
  const [sel, setSel] = useState<LabRes | null>(null); const [note, setNote] = useState(""); const [busy, setBusy] = useState(false);
  const approve = async () => {
    if (!sel) return; setBusy(true);
    try { await api.post("clinic", `/mobile/lab-results/${sel.orderId}/approve`, note.trim() ? { note: note.trim() } : {}); haptic.success(); toast.show(t("clinic.labs.approved")); setSel(null); setNote(""); await qc.invalidateQueries({ queryKey: ["clinic"] }); }
    catch (e) { const er = e as ApiError; toast.show(er.status === 403 ? t("common.notAllowed") : er.message, "error"); } finally { setBusy(false); }
  };
  const sorted = [...(q.data?.items ?? [])].sort((a, b) => Number(b.critical) - Number(a.critical));
  return (
    <Screen refresh={refresh} testID="clinic-labs" title={t("tiles.clinic.labs.title")}>
      <Title k="tiles.clinic.labs.title" />
      <Segmented value={tab} onChange={setTab} options={[{ value: "pending", label: t("clinic.rx.pending") }, { value: "reviewed", label: t("clinic.labs.reviewed") }]} />
      <View style={{ gap: 10, marginTop: 12 }}>
        {q.isError && !q.data ? <ClinicError error={q.error} onRetry={() => void q.refetch()} /> : (
          <QueryView q={q} cached={q.fromCache} isEmpty={(d) => d.items.length === 0} empty={{ icon: "flask", title: t("clinic.labs.empty") }}>
            {() => <>{sorted.map((r, i) => (
              <FadeIn key={r.orderId} delay={Math.min(i, 5) * 40}>
                <ListRow testID={`lab-${r.orderId}`} icon={r.critical ? "alert" : "flask"} iconTone={r.critical ? "danger" : "ocean"} accent={r.critical ? colors.danger : undefined}
                  title={nameOf(r.patient, lang)} subtitle={r.items.map((x) => (ar ? x.nameAr ?? x.name : x.name)).join("، ")} meta={`${formatDay(r.resultsReadyAt, i18n.language)} ${formatTime(r.resultsReadyAt, i18n.language)}`}
                  badge={r.critical ? t("inbox.critical") : r.items.some((x) => isAbnormalFlag(x.flag)) ? t("clinic.labs.abnormal") : t("clinic.labs.normal")} badgeTone={r.critical ? "danger" : r.items.some((x) => isAbnormalFlag(x.flag)) ? "warning" : "success"}
                  onPress={() => { haptic.tap(); setSel(r); }} />
              </FadeIn>
            ))}</>}
          </QueryView>
        )}
      </View>
      <Sheet visible={!!sel} onClose={() => setSel(null)} title={sel ? nameOf(sel.patient, lang) : ""} testID="lab-sheet"
        footer={sel && !sel.review && canApproveLab(boot) ? <Button title={t("clinic.labs.approve")} icon="check" onPress={() => void approve()} loading={busy} testID="lab-approve" /> : undefined}>
        {sel ? (<>
          {sel.critical ? <Banner tone="danger" title={t("clinic.labs.criticalTitle")} body={t("clinic.labs.criticalBody")} /> : null}
          {sel.items.map((x) => (
            <Row key={x.code} style={{ justifyContent: "space-between" }}>
              <T style={{ flex: 1 }}>{ar ? x.nameAr ?? x.name : x.name}</T>
              <Row gap={6}><T weight="bold" color={isAbnormalFlag(x.flag) ? colors.danger : colors.text}>{x.value} {x.unit}</T>{isAbnormalFlag(x.flag) ? <Badge tone="danger" label={x.flag!.replace("CRITICAL_", "").slice(0, 4)} /> : null}</Row>
            </Row>
          ))}
          {sel.review ? <Banner tone="success" body={t("clinic.labs.reviewedNote")} /> : canApproveLab(boot) ? <Field label={t("inbox.ackNote")} value={note} onChangeText={setNote} multiline /> : <Banner tone="ink" body={t("clinic.rx.readOnly")} />}
        </>) : null}
      </Sheet>
    </Screen>
  );
}
