import { useState } from "react";
import { Pressable, View } from "react-native";
import { SvgXml } from "react-native-svg";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { Badge, Banner, Button, Card, Chip, Field, Row, Screen, Sheet, T, useToast } from "@/components/ui";
import { ActionSheet, FadeIn, KV, QueryView, SectionTitle, StatTile } from "@/components/kit";
import { Icon } from "@/components/Icon";
import { ErrorState } from "@/components/states";
import { ApiError } from "@/api/errors";
import { useRead, usePullRefresh } from "@/hooks/useRead";
import { mutate } from "@/offline/mutate";
import { useTheme } from "@/theme";
import { haptic } from "@/lib/haptics";
import { formatInt, formatMoney, localizeDigits } from "@/lib/format";
import { copyText, openSms, openWeb, openWhatsapp, shareLink } from "@/lib/shareLink";
import { ClinicError, Title, useClinicBoot, useLang } from "@/modules/clinic/shared";
import { CreditCard, PromotionsCard } from "@/modules/clinic/CreditPromoCards";
import { conversion, featuredLink, isNurseEdition, linkName, nextLinkQuota, pct, providerShare, shareMessage, type GrowthLink, type GrowthOverview, type GrowthQr } from "@/modules/clinic/growth";

const CHANNELS = ["WHATSAPP_SHARE", "QR_DESK", "SOCIAL", "WEB_LINK"] as const;

/** Resolves a shareable URL to its QR (the server renders the SVG with the platform's local QR library; no third-party QR service). */
function QrCard({ linkId, caption, testID }: { linkId?: string; caption: string; testID?: string }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const q = useRead<GrowthQr>("clinic", "/mobile/growth/qr", { query: { linkId }, staleTime: 60_000 });
  return (
    <View style={{ alignItems: "center", gap: 8 }} testID={testID}>
      {q.isLoading ? <View accessibilityLabel={t("clinic.growth.qr.loading")} style={{ width: 220, height: 220, borderRadius: 16, backgroundColor: colors.subtle }} />
        : q.data ? (
          <View accessible accessibilityRole="image" accessibilityLabel={t("clinic.growth.qr.forLink", { name: caption })} style={{ padding: 8, borderRadius: 16, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: colors.border }}>
            <SvgXml xml={q.data.svg} width={220} height={220} />
          </View>
        ) : <ErrorState error={q.error} onRetry={() => void q.refetch()} />}
      {q.data ? <T variant="caption" muted selectable style={{ textAlign: "center" }} forceLatin>{q.data.url}</T> : null}
    </View>
  );
}

export default function Growth() {
  const { t } = useTranslation();
  const router = useRouter();
  const { lang, ar } = useLang();
  const { colors } = useTheme();
  const toast = useToast();
  const { boot } = useClinicBoot();
  const [payloadNurse, setPayloadNurse] = useState(false);
  const nurse = isNurseEdition(boot?.org.edition) || payloadNurse;
  const q = useRead<GrowthOverview>("clinic", "/mobile/growth");
  const refresh = usePullRefresh(q);
  const [qrFor, setQrFor] = useState<{ id?: string; name: string } | null>(null);
  const [actions, setActions] = useState<GrowthLink | null>(null);
  const [creating, setCreating] = useState(false);
  const [label, setLabel] = useState("");
  const [channel, setChannel] = useState<(typeof CHANNELS)[number]>("WHATSAPP_SHARE");
  const [busy, setBusy] = useState(false);

  const nm = (o: GrowthOverview) => (ar ? o.clinic?.nameAr : o.clinic?.nameEn) ?? "";
  const share = async (name: string, url: string) => {
    const r = await shareLink(shareMessage(name, url, lang, nurse), url);
    if (r === "failed") { haptic.error(); toast.show(t("clinic.growth.profile.shareFailed"), "error"); }
    else if (r === "copied") { haptic.success(); toast.show(t("clinic.growth.profile.copied"), "success"); }
    else if (r === "shared") haptic.success();
  };
  const copy = async (url: string) => {
    if (await copyText(url)) { haptic.success(); toast.show(t("clinic.growth.profile.copied"), "success"); } else await share("", url);
  };
  const failToast = (e: unknown) => {
    haptic.error();
    const err = e instanceof ApiError ? e : null;
    toast.show(err?.isNetwork ? t("clinic.growth.links.needsOnline") : err?.code === "GROWTH_LINK_LIMIT_REACHED" ? t("clinic.growth.links.limitReached") : t("states.errorTitle"), "error");
  };
  const setStatus = async (l: GrowthLink) => {
    const status = l.status === "ACTIVE" ? "PAUSED" : "ACTIVE";
    try {
      await mutate("clinic", "PATCH", `/mobile/growth/links/${l.id}`, { status }, { label: "growth.link", owner: "growth" });
      haptic.success(); toast.show(t(status === "PAUSED" ? "clinic.growth.links.paused" : "clinic.growth.links.resumed"), "success"); await q.refetch();
    } catch (e) { failToast(e); }
  };
  const create = async (o: GrowthOverview) => {
    setBusy(true);
    try {
      await mutate("clinic", "POST", "/mobile/growth/links", { label: label.trim(), ownerScope: channel === "QR_DESK" ? "DESK" : "CLINIC", ...(channel === "QR_DESK" ? { deskLabel: label.trim() } : {}), channelKind: channel, clinicId: o.clinic?.id }, { label: "growth.link", owner: "growth" });
      haptic.success(); toast.show(t("clinic.growth.links.created"), "success"); setCreating(false); setLabel(""); await q.refetch();
    } catch (e) { failToast(e); } finally { setBusy(false); }
  };

  return (
    <Screen refresh={refresh} testID="clinic-growth" title={t("tiles.clinic.growth.title")}>
      <Title k="tiles.clinic.growth.title" />
      <View style={{ gap: 12, marginTop: 8 }}>
        {q.isError && !q.data ? <ClinicError error={q.error} onRetry={() => void q.refetch()} /> : (
          <QueryView q={q} cached={q.fromCache} rows={4}>
            {(o) => {
              const featured = featuredLink(o.links);
              const name = nm(o) || t("tiles.clinic.growth.title");
              const url = o.profile.kiorexUrl;
              const perf = o.performance;
              const conv = conversion(o.summary.totals.visits, o.summary.totals.bookings);
              const quota = nextLinkQuota(o.plan);
              const n = (v: number) => formatInt(v, lang);
              return (
                <FadeIn>
                  <View style={{ gap: 12 }}>
                    <T muted testID="growth-intro">{t(isNurseEdition(boot?.org.edition, o.product) ? "clinic.growth.introNurse" : "clinic.growth.intro")}</T>
                    {o.level === "doctor" ? <Banner tone="ink" body={t("clinic.growth.doctorNote")} testID="growth-doctor-note" /> : null}

                    <Card style={{ gap: 12 }} testID="growth-profile">
                      <Row gap={10}><Icon name="link" size={20} color={colors.ink} /><T weight="semibold" style={{ flex: 1 }}>{t("clinic.growth.profile.title")}</T></Row>
                      {url ? (
                        <>
                          <T selectable forceLatin testID="growth-profile-url" style={{ color: colors.ink }}>{url}</T>
                          <Row gap={8} style={{ flexWrap: "wrap" }}>
                            <Button small icon="share" title={t("clinic.growth.profile.share")} onPress={() => void share(name, url)} testID="growth-share" />
                            <Button small variant="secondary" title={t("clinic.growth.profile.whatsapp")} onPress={() => void openWhatsapp(shareMessage(name, url, lang, nurse))} testID="growth-whatsapp" />
                            <Button small variant="secondary" icon="phone" title={t("clinic.growth.profile.sms")} onPress={() => void openSms(shareMessage(name, url, lang, nurse))} testID="growth-sms" />
                            <Button small variant="secondary" icon="copy" title={t("clinic.growth.profile.copy")} onPress={() => void copy(url)} testID="growth-copy" />
                          </Row>
                        </>
                      ) : (
                        <View style={{ gap: 4 }} testID="growth-profile-notready"><T weight="medium">{t("clinic.growth.profile.notReady")}</T><T variant="small" muted>{t("clinic.growth.profile.notReadyHint")}</T></View>
                      )}
                    </Card>

                    {url || featured ? (
                      <Card style={{ gap: 10, alignItems: "stretch" }} testID="growth-qr-card">
                        <SectionTitle title={t("clinic.growth.qr.title")} />
                        <QrCard linkId={featured?.id} caption={featured ? linkName(featured, lang) : name} testID="growth-qr" />
                        <T variant="caption" muted style={{ textAlign: "center" }}>{t("clinic.growth.qr.hint")}</T>
                      </Card>
                    ) : null}

                    <Card style={{ gap: 4 }} testID="growth-hub">
                      {([
                        ["share", "/clinic/growth-share", o.level !== "read"],
                        ["slots", "/clinic/growth-slots", o.level !== "read"],
                        ["statements", "/clinic/growth-statements", o.level === "admin"],
                        ["verification", "/clinic/growth-verification", o.level === "admin"],
                        ["b2b", "/clinic/growth-b2b", o.level === "admin"],
                      ] as const).filter(([, , show]) => show).map(([k, path]) => (
                        <Pressable key={k} testID={`growth-hub-${k}`} accessibilityRole="button" accessibilityLabel={t(`clinic.growth.hub.${k}`)} onPress={() => { haptic.select(); router.push(path as never); }}
                          style={({ pressed }) => ({ minHeight: 56, justifyContent: "center", gap: 2, paddingVertical: 6, backgroundColor: pressed ? colors.soft : "transparent" })}>
                          <T weight="semibold">{t(`clinic.growth.hub.${k}`)}</T>
                          <T variant="caption" muted>{t(`clinic.growth.hub.${k}Hint`)}</T>
                        </Pressable>
                      ))}
                    </Card>

                    <Card style={{ gap: 10 }} testID="growth-links">
                      <Row style={{ justifyContent: "space-between" }}>
                        <SectionTitle title={t("clinic.growth.links.title")} />
                        {o.can.create ? <Button small variant="secondary" icon="plus" title={t("clinic.growth.links.create")} onPress={() => setCreating(true)} testID="growth-new-link" /> : null}
                      </Row>
                      {quota != null && o.plan ? <T variant="caption" muted>{t("clinic.growth.links.plan", { used: n(o.plan.linksUsed), max: n(o.plan.maxActiveLinks) })}</T> : null}
                      {o.links.length === 0 ? (
                        <View style={{ gap: 4, paddingVertical: 8 }} testID="growth-links-empty"><T weight="medium">{t("clinic.growth.links.empty")}</T><T variant="small" muted>{t("clinic.growth.links.emptyHint")}</T></View>
                      ) : o.links.map((l) => (
                        <Pressable key={l.id} testID={`growth-link-${l.id}`} accessibilityRole="button" accessibilityLabel={`${l.label}. ${t("clinic.growth.links.bookings")} ${n(l.last30.bookings)}`} onPress={() => { haptic.select(); setActions(l); }}
                          style={({ pressed }) => ({ minHeight: 56, paddingVertical: 8, gap: 4, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: pressed ? colors.soft : "transparent" })}>
                          <Row style={{ justifyContent: "space-between" }} gap={8}>
                            <T weight="semibold" numberOfLines={1} style={{ flex: 1 }}>{l.label}</T>
                            <Badge tone={l.status === "ACTIVE" ? "success" : "warning"} label={t(l.status === "ACTIVE" ? "clinic.growth.links.active" : "clinic.growth.links.pausedBadge")} />
                          </Row>
                          <T variant="caption" muted numberOfLines={1}>{t(`clinic.growth.links.channelKind.${l.channelKind}`, { defaultValue: l.channelKind })} · {t(`clinic.growth.links.scope.${l.ownerScope}`, { defaultValue: l.ownerScope })}</T>
                          <Row gap={14}>
                            <T variant="caption">{t("clinic.growth.links.visits")}: <T variant="caption" weight="semibold">{n(l.last30.visits)}</T></T>
                            <T variant="caption">{t("clinic.growth.links.bookings")}: <T variant="caption" weight="semibold">{n(l.last30.bookings)}</T></T>
                            <T variant="caption">{t("clinic.growth.links.attended")}: <T variant="caption" weight="semibold">{n(l.last30.attended)}</T></T>
                          </Row>
                        </Pressable>
                      ))}
                    </Card>

                    <Row gap={10} style={{ alignItems: "stretch" }}>
                      <StatTile testID="growth-visits" label={t("clinic.growth.links.visits")} value={n(o.summary.totals.visits)} icon="eye" tone="ink" hint={t("clinic.growth.links.last30")} />
                      <StatTile testID="growth-bookings" label={t("clinic.growth.links.bookings")} value={n(o.summary.totals.bookings)} icon="calendar" tone="ocean" hint={conv != null ? `${t("clinic.growth.perf.conversion")} ${localizeDigits(conv, lang)}%` : undefined} />
                    </Row>

                    {perf ? (
                      <Card style={{ gap: 10 }} testID="growth-perf">
                        <SectionTitle title={t("clinic.growth.perf.title")} />
                        {perf.providerOriginated.bookings + perf.marketplaceOriginated.bookings === 0 ? <T muted testID="growth-perf-none">{t("clinic.growth.perf.none")}</T> : (
                          <>
                            {providerShare(perf) != null ? <T weight="medium">{t("clinic.growth.perf.providerShare", { percent: localizeDigits(providerShare(perf)!, lang) })}</T> : null}
                            <Row gap={10} style={{ alignItems: "stretch" }}>
                              <View style={{ flex: 1, gap: 4, padding: 10, borderRadius: 12, backgroundColor: colors.soft }} testID="growth-perf-provider">
                                <T variant="small" weight="semibold">{t("clinic.growth.perf.provider")}</T>
                                <KV k={t("clinic.growth.perf.bookings")} v={n(perf.providerOriginated.bookings)} />
                                <KV k={t("clinic.growth.perf.attended")} v={n(perf.providerOriginated.attended)} />
                                <KV k={t("clinic.growth.perf.newPatients")} v={n(perf.providerOriginated.newPatients)} />
                                <T variant="caption" color={colors.success}>{t("clinic.growth.perf.noFee")}</T>
                              </View>
                              <View style={{ flex: 1, gap: 4, padding: 10, borderRadius: 12, backgroundColor: colors.infoSoft }} testID="growth-perf-marketplace">
                                <T variant="small" weight="semibold">{t("clinic.growth.perf.marketplace")}</T>
                                <KV k={t("clinic.growth.perf.bookings")} v={n(perf.marketplaceOriginated.bookings)} />
                                <KV k={t("clinic.growth.perf.attended")} v={n(perf.marketplaceOriginated.attended)} />
                                <KV k={t("clinic.growth.perf.newPatients")} v={n(perf.marketplaceOriginated.newPatients)} />
                              </View>
                            </Row>
                            {pct(perf.links.visitToBooking) != null ? <KV k={t("clinic.growth.perf.conversion")} v={`${localizeDigits(pct(perf.links.visitToBooking)!, lang)}%`} /> : null}
                            <KV k={t("clinic.growth.perf.incremental")} v={formatMoney(perf.incrementalMarketplaceRevenue, lang)} />
                          </>
                        )}
                      </Card>
                    ) : null}

                    {o.recommendations.length ? (
                      <Card style={{ gap: 8 }} testID="growth-recs">
                        <SectionTitle title={t("clinic.growth.recs.title")} />
                        {o.recommendations.map((r) => (
                          <Row key={r.id} gap={8} style={{ alignItems: "flex-start" }}>
                            <Icon name={r.severity === "high" ? "alert" : "info"} size={18} color={r.severity === "high" ? colors.warning : colors.ink} />
                            <T variant="small" style={{ flex: 1 }}>{t(`clinic.growth.recs.${r.id}`, Object.fromEntries(Object.entries(r.params).map(([k, v]) => [k, localizeDigits(v, lang)])))}</T>
                          </Row>
                        ))}
                      </Card>
                    ) : null}

                    {o.commission ? (
                      <Card style={{ gap: 8 }} testID="growth-commission">
                        <SectionTitle title={t("clinic.growth.commission.title")} />
                        <KV k={t("clinic.growth.commission.period")} v={localizeDigits(o.commission.period, lang)} />
                        <KV k={t("clinic.growth.commission.fees")} v={formatMoney(Number(o.commission.totals.activeCharges), lang, 2)} />
                        <KV k={t("clinic.growth.commission.providerLed")} v={`${n(o.commission.providerLedBookings)} · ${t("clinic.growth.commission.providerLedHint")}`} tone="success" />
                        <Row gap={6}><Icon name={o.commission.reconciled ? "check" : "alert"} size={16} color={o.commission.reconciled ? colors.success : colors.warning} /><T variant="caption" color={o.commission.reconciled ? colors.success : colors.warning}>{t(o.commission.reconciled ? "clinic.growth.commission.reconciled" : "clinic.growth.commission.mismatch")}</T></Row>
                        <T variant="caption" muted>{t("clinic.growth.commission.note")}</T>
                      </Card>
                    ) : null}

                    {o.level === "admin" ? <CreditCard webUrl={o.webGrowthUrl} /> : null}
                    {o.level === "admin" ? <PromotionsCard webUrl={o.webGrowthUrl} /> : null}

                    <Card style={{ gap: 8 }} testID="growth-web-card">
                      <T variant="small" muted>{t("clinic.growth.web.hint")}</T>
                      <Button variant="secondary" icon="globe" title={t("clinic.growth.web.open")} onPress={() => void openWeb(o.webGrowthUrl)} testID="growth-web" />
                    </Card>
                    <T variant="caption" muted style={{ textAlign: "center" }}>{o.promise}</T>

                    <ActionSheet visible={!!actions} onClose={() => setActions(null)} title={actions?.label ?? t("clinic.growth.links.actionsTitle")}
                      actions={actions ? [
                        { label: t("clinic.growth.profile.share"), icon: "share", onPress: () => void share(name, actions.shortUrl) },
                        { label: t("clinic.growth.profile.whatsapp"), icon: "phone", onPress: () => void openWhatsapp(shareMessage(name, actions.shortUrl, lang, nurse)) },
                        { label: t("clinic.growth.profile.sms"), icon: "phone", onPress: () => void openSms(shareMessage(name, actions.shortUrl, lang, nurse)) },
                        { label: t("clinic.growth.profile.copy"), icon: "copy", onPress: () => void copy(actions.shortUrl) },
                        { label: t("clinic.growth.profile.qr"), icon: "scan", onPress: () => setQrFor({ id: actions.id, name: actions.label }), disabled: actions.status !== "ACTIVE" },
                        ...(o.can.pause ? [{ label: t(actions.status === "ACTIVE" ? "clinic.growth.links.pause" : "clinic.growth.links.resume"), icon: "clock" as const, onPress: () => void setStatus(actions) }] : []),
                      ] : []} />
                    <Sheet visible={!!qrFor} onClose={() => setQrFor(null)} title={t("clinic.growth.qr.title")} testID="growth-qr-sheet">
                      {qrFor ? <QrCard linkId={qrFor.id} caption={qrFor.name} testID="growth-qr-link" /> : null}
                    </Sheet>
                    <Sheet visible={creating} onClose={() => setCreating(false)} title={t("clinic.growth.links.createTitle")} testID="growth-create-sheet"
                      footer={<Button title={t("clinic.growth.links.save")} onPress={() => void create(o)} loading={busy} disabled={label.trim().length < 2} testID="growth-create-save" />}>
                      <Field label={t("clinic.growth.links.label")} placeholder={t("clinic.growth.links.labelHint")} value={label} onChangeText={setLabel} maxLength={80} testID="growth-create-label" />
                      <T variant="small" weight="semibold">{t("clinic.growth.links.channel")}</T>
                      <Row gap={8} style={{ flexWrap: "wrap" }}>
                        {CHANNELS.map((c) => <Chip key={c} label={t(`clinic.growth.links.channelKind.${c}`)} selected={channel === c} onPress={() => { haptic.select(); setChannel(c); }} testID={`growth-channel-${c}`} />)}
                      </Row>
                    </Sheet>
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
