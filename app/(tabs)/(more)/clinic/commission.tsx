import { View } from "react-native";
import { useTranslation } from "react-i18next";
import { Banner, Screen, T } from "@/components/ui";
import { QueryView } from "@/components/kit";
import { usePullRefresh, useRead } from "@/hooks/useRead";
import { PartnerCommissionCards } from "@/modules/PartnerCommissionCards";
import { ClinicError, Title } from "@/modules/clinic/shared";

/**
 * Clinic Kiorex commission: the rate in force and the monthly settlement statement, read only (Kiorex sets both). The Clinic API decides who may see the figures
 * (`GET /billing/kiorex-commissions/access`: finance, and administrators when the organisation enables it); every other role gets the "your role" notice here.
 */
export default function ClinicCommission() {
  const { t } = useTranslation();
  const access = useRead<{ canView: boolean }>("clinic", "/billing/kiorex-commissions/access");
  const refresh = usePullRefresh(access);
  return (
    <Screen refresh={refresh} testID="clinic-commission" title={t("clinic.settlementPage.title")}>
      <Title k="clinic.settlementPage.title" />
      <View style={{ gap: 12, marginTop: 8 }}>
        <T muted>{t("clinic.settlementPage.intro")}</T>
        {access.isError && !access.data ? <ClinicError error={access.error} onRetry={() => void access.refetch()} /> : (
          <QueryView q={access} cached={access.fromCache} rows={3}>
            {(a) => a.canView ? <PartnerCommissionCards product="clinic" /> : <Banner tone="warning" title={t("common.notAllowed")} body={t("clinic.settlementPage.forbidden")} testID="commission-forbidden" />}
          </QueryView>
        )}
      </View>
    </Screen>
  );
}
