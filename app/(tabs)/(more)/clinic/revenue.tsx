import { View } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { Button, Card, Row, Screen, T, Badge } from "@/components/ui";
import { BarChart, FadeIn, KV, QueryView, SectionTitle, Sparkline, StatTile } from "@/components/kit";
import { useRead, usePullRefresh } from "@/hooks/useRead";
import { formatMoney } from "@/lib/format";
import { useTheme } from "@/theme";
import { ClinicError, Title, useLang } from "@/modules/clinic/shared";
import { compactMoney, revenueSeries, revenueTrend, type RevenueSnapshot } from "@/modules/clinic/helpers";

export default function Revenue() {
  const { t } = useTranslation();
  const { lang } = useLang();
  const { colors } = useTheme();
  const router = useRouter();
  const q = useRead<RevenueSnapshot>("clinic", "/mobile/revenue/snapshot");
  const refresh = usePullRefresh(q);
  return (
    <Screen refresh={refresh} testID="clinic-revenue" title={t("tiles.clinic.revenue.title")}>
      <Title k="tiles.clinic.revenue.title" />
      <View style={{ gap: 12, marginTop: 8 }}>
        {q.isError && !q.data ? <ClinicError error={q.error} onRetry={() => void q.refetch()} /> : (
          <QueryView q={q} cached={q.fromCache} rows={3}>
            {(s) => {
              const series = revenueSeries(s, lang); const trend = revenueTrend(s.daily); const spark = s.daily.map((d) => d.net);
              return (
                <FadeIn>
                  <View style={{ gap: 12 }}>
                    <Row gap={10} style={{ alignItems: "stretch" }}>
                      <StatTile testID="rev-today" label={t("clinic.revenue.today")} value={compactMoney(s.today.net, lang, s.currency)} icon="receipt" tone="ink" hint={t("clinic.revenue.visitsToday", { count: s.completedVisitsToday })} />
                      <StatTile testID="rev-7" label={t("clinic.revenue.last7")} value={compactMoney(s.last7.net, lang, s.currency)} icon="chart" tone="ocean" spark={spark} />
                    </Row>
                    <Card style={{ gap: 10 }}>
                      <Row style={{ justifyContent: "space-between" }}><SectionTitle title={t("clinic.revenue.daily")} />{trend != null ? <Badge tone={trend >= 0 ? "success" : "warning"} label={`${trend >= 0 ? "+" : ""}${trend}%`} /> : null}</Row>
                      <BarChart data={series} color={colors.ink} format={(n) => compactMoney(n, lang, "").trim()} />
                    </Card>
                    <Card style={{ gap: 8 }}>
                      <KV k={t("clinic.revenue.last30")} v={formatMoney(s.last30.net, lang)} />
                      <KV k={t("clinic.revenue.gross7")} v={formatMoney(s.last7.gross, lang)} />
                      <Sparkline data={spark} color={colors.pulse} height={40} />
                    </Card>
                    <T variant="caption" muted>{t("clinic.revenue.note")}</T>
                    <Button variant="secondary" icon="receipt" title={t("clinic.settlementPage.open")} onPress={() => router.push("/clinic/commission" as never)} testID="revenue-commission" />
                  </View>
                </FadeIn>
              );
            }}
          </QueryView>
        )}
      </View>
    </Screen>
  );
}
