import { View } from "react-native";
import { useTranslation } from "react-i18next";
import { Badge, Button, Card, Row, T, useToast } from "@/components/ui";
import { KV, SectionTitle } from "@/components/kit";
import { ErrorState } from "@/components/states";
import { ApiError } from "@/api/errors";
import { useRead } from "@/hooks/useRead";
import { mutate } from "@/offline/mutate";
import { useTheme } from "@/theme";
import { haptic } from "@/lib/haptics";
import { formatDay, formatInt, formatMoney, localizeDigits } from "@/lib/format";
import { openWeb } from "@/lib/shareLink";
import { useLang } from "@/modules/clinic/shared";
import {
  amountOf, budgetUsedPct, canPause, canResume, daysUntil, hasCredit, minorToMajor, nextExpiry, promotionTone, sortPromotions, spendableUses,
  type CreditWallet, type PromotionRow,
} from "@/modules/clinic/growth-credit";

/** A role without access (403), a switched-off flag (FEATURE_DISABLED) or an old server (404) hides the card: it is never an error for the person looking at Growth. */
const hiddenFor = (e: unknown) => e instanceof ApiError && (e.status === 403 || e.status === 404);

/** Kiorex credit on the organisation's account (owner and finance). Read only: grants come from Kiorex and spending is by invoice. */
export function CreditCard({ webUrl }: { webUrl?: string }) {
  const { t } = useTranslation();
  const { lang } = useLang();
  const { colors } = useTheme();
  const q = useRead<CreditWallet>("clinic", "/credits/wallet", { query: { pageSize: 1 }, staleTime: 60_000 });
  if (q.isLoading) return <Card testID="growth-credit-loading" style={{ minHeight: 96, backgroundColor: colors.subtle }} accessibilityLabel={t("clinic.growth.common.loading")}><View /></Card>;
  if (q.isError && !q.data) return hiddenFor(q.error) ? null : <Card testID="growth-credit-error"><ErrorState error={q.error} onRetry={() => void q.refetch()} /></Card>;
  const w = q.data;
  if (!w) return null;
  const exp = nextExpiry(w);
  const uses = spendableUses(w);
  const money = (n: number) => `${formatMoney(n, lang, 2)} ${w.currency === "EGP" ? "" : w.currency}`.trim();
  return (
    <Card style={{ gap: 8 }} testID="growth-credit">
      <SectionTitle title={t("clinic.growth.credit.title")} />
      {hasCredit(w) ? (
        <>
          <KV k={t("clinic.growth.credit.balance")} v={money(amountOf(w.balance))} />
          {exp ? <T variant="small" color={colors.warning} testID="growth-credit-expiry">{t("clinic.growth.credit.expires", { amount: money(exp.amount), days: localizeDigits(String(daysUntil(exp.expiresAt)), lang) })}</T> : null}
          {uses.length ? (
            <View style={{ gap: 2 }} testID="growth-credit-uses">
              <T variant="caption" muted>{t("clinic.growth.credit.spendable")}</T>
              {uses.map((u) => <KV key={u.use} k={t(`clinic.growth.credit.uses.${u.use}`)} v={money(u.amount)} />)}
            </View>
          ) : null}
        </>
      ) : <T muted testID="growth-credit-none">{t("clinic.growth.credit.none")}</T>}
      <T variant="caption" muted>{t("clinic.growth.credit.hint")}</T>
      {webUrl ? <Button small variant="secondary" icon="globe" title={t("clinic.growth.credit.web")} onPress={() => void openWeb(webUrl)} testID="growth-credit-web" /> : null}
    </Card>
  );
}

/** Sponsored promotions funded by the organisation (owner and finance read; the owner and administrators pause and resume). Creating and editing stay on the web workspace. */
export function PromotionsCard({ webUrl }: { webUrl?: string }) {
  const { t } = useTranslation();
  const { lang } = useLang();
  const { colors } = useTheme();
  const toast = useToast();
  const q = useRead<PromotionRow[]>("clinic", "/promotions", { staleTime: 60_000 });
  if (q.isLoading) return <Card testID="growth-promos-loading" style={{ minHeight: 96, backgroundColor: colors.subtle }} accessibilityLabel={t("clinic.growth.common.loading")}><View /></Card>;
  if (q.isError && !q.data) return hiddenFor(q.error) ? null : <Card testID="growth-promos-error"><ErrorState error={q.error} onRetry={() => void q.refetch()} /></Card>;
  const rows = sortPromotions(Array.isArray(q.data) ? q.data : []).filter((p) => p.status !== "ARCHIVED").slice(0, 5);
  const act = async (p: PromotionRow, verb: "pause" | "resume") => {
    try {
      await mutate("clinic", "POST", `/promotions/${p.id}/${verb}`, {}, { label: "growth.promotion", owner: "growth" });
      haptic.success(); toast.show(t(verb === "pause" ? "clinic.growth.promo.paused" : "clinic.growth.promo.resumed"), "success"); await q.refetch();
    } catch (e) {
      haptic.error();
      toast.show(e instanceof ApiError && e.isNetwork ? t("clinic.growth.promo.needsOnline") : t("clinic.growth.promo.failed"), "error");
    }
  };
  const name = (p: PromotionRow) => (lang.startsWith("ar") ? p.version.nameAr ?? p.version.nameEn : p.version.nameEn ?? p.version.nameAr) ?? "";
  return (
    <Card style={{ gap: 10 }} testID="growth-promos">
      <SectionTitle title={t("clinic.growth.promo.title")} />
      <T variant="caption" muted>{t("clinic.growth.promo.hint")}</T>
      {rows.length === 0 ? <T muted testID="growth-promos-empty">{t("clinic.growth.promo.empty")}</T> : rows.map((p) => {
        const used = budgetUsedPct(p.budget);
        return (
          <View key={p.id} testID={`growth-promo-${p.id}`} style={{ gap: 4, paddingTop: 8, borderTopWidth: 1, borderTopColor: colors.border }}>
            <Row style={{ justifyContent: "space-between" }} gap={8}>
              <T weight="semibold" numberOfLines={1} style={{ flex: 1 }}>{name(p)}</T>
              <Badge tone={promotionTone(p.status)} label={t(`clinic.growth.promo.status.${p.status}`)} />
            </Row>
            <T variant="caption" muted>{t("clinic.growth.promo.budget", { left: formatMoney(minorToMajor(p.budget.remainingMinor), lang, 2), cap: formatMoney(minorToMajor(p.budget.capMinor), lang, 2) })}{used != null ? ` · ${t("clinic.growth.promo.used", { percent: formatInt(used, lang) })}` : ""}</T>
            {p.version.startsAt && p.version.endsAt ? <T variant="caption" muted>{t("clinic.growth.promo.window", { from: formatDay(p.version.startsAt, lang), to: formatDay(p.version.endsAt, lang) })}</T> : null}
            {canPause(p.status) ? <Button small variant="secondary" title={t("clinic.growth.promo.pause")} onPress={() => void act(p, "pause")} testID={`growth-promo-pause-${p.id}`} /> : null}
            {canResume(p.status) ? <Button small variant="secondary" title={t("clinic.growth.promo.resume")} onPress={() => void act(p, "resume")} testID={`growth-promo-resume-${p.id}`} /> : null}
          </View>
        );
      })}
      {webUrl ? <Button small variant="secondary" icon="globe" title={t("clinic.growth.promo.web")} onPress={() => void openWeb(webUrl)} testID="growth-promos-web" /> : null}
    </Card>
  );
}
