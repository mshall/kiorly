import { useState } from "react";
import { View } from "react-native";
import { useTranslation } from "react-i18next";
import { Banner, Button, Card, Chip, Row, Screen, T } from "@/components/ui";
import { FadeIn, KV, QueryView, SectionTitle } from "@/components/kit";
import { ApiError } from "@/api/errors";
import { useRead, usePullRefresh } from "@/hooks/useRead";
import { formatMoney, localizeDigits } from "@/lib/format";
import { openWeb, shareLink } from "@/lib/shareLink";
import { ClinicError, Title, useLang } from "@/modules/clinic/shared";
import { recentMonths, statementSummary, type StatementDto } from "@/modules/clinic/growth-marketing";

/** GRW-P2-C: the monthly Kiorex fee statement (admin only; a doctor never sees fees). PDF and CSV live on the web workspace; the app shares a text summary. */
export default function GrowthStatements() {
  const { t } = useTranslation();
  const { lang } = useLang();
  const months = recentMonths(6);
  const [month, setMonth] = useState(months[0]!);
  const q = useRead<StatementDto>("clinic", `/mobile/growth/statements/${month}`);
  const refresh = usePullRefresh(q);
  const n = (v: number) => localizeDigits(v, lang);
  const forbidden = q.error instanceof ApiError && q.error.status === 403 && !q.error.isFeatureDisabled;
  return (
    <Screen refresh={refresh} testID="clinic-growth-statements" title={t("clinic.growth.statements.title")}>
      <Title k="clinic.growth.statements.title" />
      <View style={{ gap: 12, marginTop: 8 }}>
        <T muted>{t("clinic.growth.statements.intro")}</T>
        <Row gap={8} style={{ flexWrap: "wrap" }}>
          {months.map((m) => <Chip key={m} label={localizeDigits(m, lang)} selected={m === month} onPress={() => setMonth(m)} testID={`statement-month-${m}`} />)}
        </Row>
        {forbidden ? <Banner tone="warning" title={t("clinic.growth.statements.adminOnly")} testID="statements-forbidden" /> : q.isError && !q.data ? <ClinicError error={q.error} onRetry={() => void q.refetch()} /> : (
          <QueryView q={q} cached={q.fromCache} rows={4}>
            {(s) => (
              <FadeIn>
                <View style={{ gap: 12 }}>
                  <Card style={{ gap: 8 }} testID="statements-totals">
                    <KV k={`${t("clinic.growth.statements.active")} (${n(s.totals.activeCount)})`} v={formatMoney(Number(s.totals.active), lang, 2)} />
                    <KV k={t("clinic.growth.statements.reversed")} v={formatMoney(Number(s.totals.reversed), lang, 2)} />
                    <KV k={t("clinic.growth.statements.waived")} v={formatMoney(Number(s.totals.waived), lang, 2)} />
                    <KV k={t("clinic.growth.statements.providerLed")} v={n(s.totals.providerLed)} tone="success" />
                  </Card>
                  {s.lines.length === 0 ? <T muted testID="statements-empty">{t("clinic.growth.statements.empty")}</T> : (
                    <Card style={{ gap: 6 }} testID="statements-lines">
                      <SectionTitle title={t("clinic.growth.statements.month")} />
                      {s.lines.map((l) => (
                        <View key={l.appointmentId} style={{ paddingVertical: 6, gap: 2 }} testID="statements-line">
                          <Row style={{ justifyContent: "space-between" }}>
                            <T variant="small" forceLatin>{l.date}</T>
                            <T variant="small" weight="semibold">{l.amount ? formatMoney(Number(l.amount), lang, 2) : "-"}</T>
                          </Row>
                          <T variant="caption" muted>{t(`clinic.growth.statements.origins.${l.origin}`, { defaultValue: l.origin })} · {t(`clinic.growth.statements.decisions.${l.decision}`)}</T>
                        </View>
                      ))}
                    </Card>
                  )}
                  <Button variant="secondary" icon="share" title={t("clinic.growth.statements.shareSummary")} testID="statements-share"
                    onPress={() => void shareLink(statementSummary(s, t("clinic.growth.statements.summaryText")), "")} />
                  <Button variant="secondary" icon="globe" title={t("clinic.growth.statements.openPdf")} testID="statements-web" onPress={() => void openWeb(s.webUrl)} />
                </View>
              </FadeIn>
            )}
          </QueryView>
        )}
      </View>
    </Screen>
  );
}
