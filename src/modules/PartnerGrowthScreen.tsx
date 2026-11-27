import { useState } from "react";
import { Pressable, View } from "react-native";
import { SvgXml } from "react-native-svg";
import { stripSvgRootAria } from "@/lib/svgXml";
import { QrSaveButton } from "@/components/QrSaveButton";
import { Stack } from "expo-router";
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
import { formatInt, localizeDigits } from "@/lib/format";
import { copyText, openSms, openWeb, openWhatsapp, shareLink } from "@/lib/shareLink";
import { PartnerCommissionCards } from "@/modules/PartnerCommissionCards";
import { featuredPartnerLink, linkSite, partnerCapabilities, partnerShare, partnerShareMessage, percent, PARTNER_CHANNELS, scopeForChannel, type PartnerLink, type PartnerOverview, type PartnerProduct, type PartnerQr } from "@/modules/partner-growth";

/** Resolves a link to its QR. The Pharmacy and Lab APIs render the SVG on the server (local QR library, no third-party service) and return JSON with `?format=json`. */
function QrCard({ product, linkId, caption, testID }: { product: PartnerProduct; linkId: string; caption: string; testID?: string }) {
  const { t } = useTranslation(); const { colors } = useTheme();
  const q = useRead<PartnerQr>(product, "/mobile/growth/qr", { query: { linkId, format: "json" }, staleTime: 60_000 });
  return (
    <View style={{ alignItems: "center", gap: 8 }} testID={testID}>
      {q.isLoading ? <View accessibilityLabel={t(`${product}.growth.qr.loading`)} style={{ width: 220, height: 220, borderRadius: 16, backgroundColor: colors.subtle }} />
        : q.data ? (
          <View accessible accessibilityRole="image" accessibilityLabel={t(`${product}.growth.qr.forLink`, { name: caption })} style={{ padding: 8, borderRadius: 16, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: colors.border }}>
            <SvgXml xml={stripSvgRootAria(q.data.svg)} width={220} height={220} />
          </View>
        ) : <ErrorState error={q.error} onRetry={() => void q.refetch()} />}
      {q.data ? <T variant="caption" muted selectable style={{ textAlign: "center" }} forceLatin>{q.data.url}</T> : null}
      {q.data ? <QrSaveButton svg={q.data.svg} url={q.data.url} name={caption} testID={testID ? `${testID}-save` : undefined} /> : null}
    </View>
  );
}

/**
 * Pharmacy and Lab Growth tab (GRW-P4-B3), one component for both products (the two route files only pick the product). Same layout as the Clinic tab: profile page link, QR, links with 30-day counts,
 * orders from your links versus orders that found you on Kiorex, five suggestions, a fee-statement placeholder and the web workspace. Counts only: no customer data and no amounts. The role matrix comes from
 * the API (`level`, `can`): bench or counter roles without the module never see the tab (the module key is not in their bootstrap), a read role cannot create or pause.
 */
export default function PartnerGrowthScreen({ product }: { product: PartnerProduct }) {
  const { t, i18n } = useTranslation(); const lang = i18n.language; 
  const { colors } = useTheme(); const toast = useToast(); const ns = `${product}.growth`;
  const q = useRead<PartnerOverview>(product, "/mobile/growth");
  const refresh = usePullRefresh(q);
  const [qrFor, setQrFor] = useState<{ id: string; name: string } | null>(null);
  const [actions, setActions] = useState<PartnerLink | null>(null);
  const [creating, setCreating] = useState(false);
  const [label, setLabel] = useState("");
  const [channel, setChannel] = useState<(typeof PARTNER_CHANNELS)[number]>("WHATSAPP_SHARE");
  const [busy, setBusy] = useState(false);

  const share = async (name: string, url: string) => {
    const r = await shareLink(partnerShareMessage(product, name, url, lang), url);
    if (r === "failed") { haptic.error(); toast.show(t(`${ns}.profile.shareFailed`), "error"); } else if (r === "copied") { haptic.success(); toast.show(t(`${ns}.profile.copied`), "success"); } else if (r === "shared") haptic.success();
  };
  const copy = async (url: string) => { if (await copyText(url)) { haptic.success(); toast.show(t(`${ns}.profile.copied`), "success"); } else await share("", url); };
  const failToast = (e: unknown) => {
    haptic.error(); const err = e instanceof ApiError ? e : null;
    toast.show(err?.isNetwork ? t(`${ns}.links.needsOnline`) : err?.code === "GROWTH_LINK_LIMIT_REACHED" ? t(`${ns}.links.limitReached`) : t("states.errorTitle"), "error");
  };
  const setStatus = async (l: PartnerLink) => {
    const status = l.status === "ACTIVE" ? "PAUSED" : "ACTIVE";
    try { await mutate(product, "PATCH", `/mobile/growth/links/${l.id}`, { status }, { label: "growth.link", owner: "growth" }); haptic.success(); toast.show(t(`${ns}.links.${status === "PAUSED" ? "paused" : "resumed"}`), "success"); await q.refetch(); } catch (e) { failToast(e); }
  };
  const create = async () => {
    setBusy(true);
    try {
      await mutate(product, "POST", "/mobile/growth/links", { label: label.trim(), ownerScope: scopeForChannel(channel), channelKind: channel }, { label: "growth.link", owner: "growth" });
      haptic.success(); toast.show(t(`${ns}.links.created`), "success"); setCreating(false); setLabel(""); await q.refetch();
    } catch (e) { failToast(e); } finally { setBusy(false); }
  };

  const err = q.error instanceof ApiError ? q.error : null;
  return (
    <Screen refresh={refresh} testID={`${product}-growth`} title={t(`tiles.${product}.growth.title`)}>
      <Stack.Screen options={{ title: t(`tiles.${product}.growth.title`) }} />
      <View style={{ gap: 12, marginTop: 8 }}>
        {q.isError && !q.data && err?.code === "KIOREX_NOT_CONNECTED" ? <Banner tone="warning" title={t(`${ns}.notConnected.title`)} body={t(`${ns}.notConnected.body`)} testID="growth-not-connected" />
          : q.isError && !q.data && err?.status === 403 && !err.isFeatureDisabled ? <Banner tone="warning" title={t(`${ns}.notAllowed`)} testID="not-allowed" />
          : q.isError && !q.data ? <ErrorState error={q.error} onRetry={() => void q.refetch()} /> : (
          <QueryView q={q} cached={q.fromCache} rows={4}>
            {(o) => {
              const cap = partnerCapabilities(o.level); const featured = featuredPartnerLink(o.links);
              const name = o.organisation || t(`tiles.${product}.growth.title`);
              const n = (v: number) => formatInt(v, lang); const perf = o.performance; const sharePct = partnerShare(perf);
              return (
                <FadeIn>
                  <View style={{ gap: 12 }}>
                    <T muted>{t(`${ns}.intro`)}</T>
                    {!cap.create ? <Banner tone="ink" body={t(`${ns}.readOnly`)} testID="growth-read-only" /> : null}

                    <Card style={{ gap: 12 }} testID="growth-profile">
                      <Row gap={10}><Icon name="link" size={20} color={colors.ink} /><T weight="semibold" style={{ flex: 1 }}>{t(`${ns}.profile.title`)}</T></Row>
                      <T selectable forceLatin testID="growth-profile-url" style={{ color: colors.ink }}>{o.profileUrl}</T>
                      <Row gap={8} style={{ flexWrap: "wrap" }}>
                        <Button small icon="share" title={t(`${ns}.profile.share`)} onPress={() => void share(name, o.profileUrl)} testID="growth-share" />
                        <Button small variant="secondary" title={t(`${ns}.profile.whatsapp`)} onPress={() => void openWhatsapp(partnerShareMessage(product, name, o.profileUrl, lang))} testID="growth-whatsapp" />
                        <Button small variant="secondary" icon="phone" title={t(`${ns}.profile.sms`)} onPress={() => void openSms(partnerShareMessage(product, name, o.profileUrl, lang))} testID="growth-sms" />
                        <Button small variant="secondary" icon="copy" title={t(`${ns}.profile.copy`)} onPress={() => void copy(o.profileUrl)} testID="growth-copy" />
                      </Row>
                    </Card>

                    {featured ? (
                      <Card style={{ gap: 10 }} testID="growth-qr-card">
                        <SectionTitle title={t(`${ns}.qr.title`)} />
                        <QrCard product={product} linkId={featured.id} caption={featured.label} testID="growth-qr" />
                        <T variant="caption" muted style={{ textAlign: "center" }}>{t(`${ns}.qr.hint`)}</T>
                      </Card>
                    ) : null}

                    <Card style={{ gap: 10 }} testID="growth-links">
                      <Row style={{ justifyContent: "space-between" }}>
                        <SectionTitle title={t(`${ns}.links.title`)} />
                        {cap.create && o.can.create ? <Button small variant="secondary" icon="plus" title={t(`${ns}.links.create`)} onPress={() => setCreating(true)} testID="growth-new-link" /> : null}
                      </Row>
                      {o.plan ? <T variant="caption" muted>{t(`${ns}.links.plan`, { used: n(o.plan.linksUsed), max: n(o.plan.maxActiveLinks) })}</T> : null}
                      {o.links.length === 0 ? (
                        <View style={{ gap: 4, paddingVertical: 8 }} testID="growth-links-empty"><T weight="medium">{t(`${ns}.links.empty`)}</T><T variant="small" muted>{t(`${ns}.links.emptyHint`)}</T></View>
                      ) : o.links.map((l) => (
                        <Pressable key={l.id} testID={`growth-link-${l.id}`} accessibilityRole="button" accessibilityLabel={`${l.label}. ${t(`${ns}.links.orders`)} ${n(l.last30.orders)}`} onPress={() => { haptic.select(); setActions(l); }}
                          style={({ pressed }) => ({ minHeight: 56, paddingVertical: 8, gap: 4, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: pressed ? colors.soft : "transparent" })}>
                          <Row style={{ justifyContent: "space-between" }} gap={8}>
                            <T weight="semibold" numberOfLines={1} style={{ flex: 1 }}>{l.label}</T>
                            <Badge tone={l.status === "ACTIVE" ? "success" : "warning"} label={t(`${ns}.links.${l.status === "ACTIVE" ? "active" : "pausedBadge"}`)} />
                          </Row>
                          <T variant="caption" muted numberOfLines={1}>{t(`${ns}.links.channelKind.${l.channelKind}`, { defaultValue: l.channelKind })} · {linkSite(l) ?? t(`${ns}.links.scope.${l.ownerScope}`, { defaultValue: l.ownerScope })}</T>
                          <Row gap={14}>
                            <T variant="caption">{t(`${ns}.links.visits`)}: <T variant="caption" weight="semibold">{n(l.last30.visits)}</T></T>
                            <T variant="caption">{t(`${ns}.links.orders`)}: <T variant="caption" weight="semibold">{n(l.last30.orders)}</T></T>
                            <T variant="caption">{t(`${ns}.links.completed`)}: <T variant="caption" weight="semibold">{n(l.last30.completed)}</T></T>
                          </Row>
                        </Pressable>
                      ))}
                    </Card>

                    <Row gap={10} style={{ alignItems: "stretch" }}>
                      <StatTile testID="growth-visits" label={t(`${ns}.links.visits`)} value={n(perf.links.visits)} icon="eye" tone="ink" hint={t(`${ns}.links.last30`)} />
                      <StatTile testID="growth-orders" label={t(`${ns}.links.orders`)} value={n(perf.links.orders)} icon="cart" tone="ocean" hint={percent(perf.links.visitToOrder) != null ? `${t(`${ns}.perf.conversion`)} ${localizeDigits(percent(perf.links.visitToOrder)!, lang)}%` : undefined} />
                    </Row>

                    <Card style={{ gap: 10 }} testID="growth-perf">
                      <SectionTitle title={t(`${ns}.perf.title`)} />
                      {perf.providerOriginated.orders + perf.marketplaceOriginated.orders === 0 ? <T muted testID="growth-perf-none">{t(`${ns}.perf.none`)}</T> : (
                        <>
                          {sharePct != null ? <T weight="medium">{t(`${ns}.perf.share`, { percent: localizeDigits(sharePct, lang) })}</T> : null}
                          <Row gap={10} style={{ alignItems: "stretch" }}>
                            <View style={{ flex: 1, gap: 4, padding: 10, borderRadius: 12, backgroundColor: colors.soft }} testID="growth-perf-provider">
                              <T variant="small" weight="semibold">{t(`${ns}.perf.fromLinks`)}</T>
                              <KV k={t(`${ns}.perf.orders`)} v={n(perf.providerOriginated.orders)} /><KV k={t(`${ns}.perf.completed`)} v={n(perf.providerOriginated.completed)} />
                            </View>
                            <View style={{ flex: 1, gap: 4, padding: 10, borderRadius: 12, backgroundColor: colors.infoSoft }} testID="growth-perf-marketplace">
                              <T variant="small" weight="semibold">{t(`${ns}.perf.fromKiorex`)}</T>
                              <KV k={t(`${ns}.perf.orders`)} v={n(perf.marketplaceOriginated.orders)} /><KV k={t(`${ns}.perf.completed`)} v={n(perf.marketplaceOriginated.completed)} />
                            </View>
                          </Row>
                        </>
                      )}
                      {perf.acquisitionPending ? <T variant="caption" muted testID="growth-perf-pending">{t(`${ns}.perf.pending`)}</T> : null}
                      <T variant="caption" muted>{t(`${ns}.perf.note`)}</T>
                    </Card>

                    {o.recommendations.length ? (
                      <Card style={{ gap: 8 }} testID="growth-recs">
                        <SectionTitle title={t(`${ns}.recs.title`)} />
                        {o.recommendations.map((r) => (
                          <Row key={r.id} gap={8} style={{ alignItems: "flex-start" }}>
                            <Icon name={r.severity === "high" ? "alert" : "info"} size={18} color={r.severity === "high" ? colors.warning : colors.ink} />
                            <T variant="small" style={{ flex: 1 }}>{t(`${ns}.recs.${r.id}`, Object.fromEntries(Object.entries(r.params).map(([k, v]) => [k, localizeDigits(v, lang)])))}</T>
                          </Row>
                        ))}
                      </Card>
                    ) : null}

                    {o.can.commission ? <PartnerCommissionCards product={product} /> : (
                      <Card style={{ gap: 6 }} testID="growth-statement">
                        <SectionTitle title={t(`${ns}.statement.title`)} />
                        <T muted>{t(`${ns}.statement.none`)}</T>
                      </Card>
                    )}

                    <Card style={{ gap: 8 }} testID="growth-web-card">
                      <T variant="small" muted>{t(`${ns}.web.hint`)}</T>
                      {o.webGrowthUrl ? <Button variant="secondary" icon="globe" title={t(`${ns}.web.open`)} onPress={() => void openWeb(o.webGrowthUrl!)} testID="growth-web" /> : null}
                    </Card>

                    <ActionSheet visible={!!actions} onClose={() => setActions(null)} title={actions?.label ?? t(`${ns}.links.actionsTitle`)}
                      actions={actions ? [
                        { label: t(`${ns}.profile.share`), icon: "share", onPress: () => void share(name, actions.shortUrl) },
                        { label: t(`${ns}.profile.whatsapp`), icon: "phone", onPress: () => void openWhatsapp(partnerShareMessage(product, name, actions.shortUrl, lang)) },
                        { label: t(`${ns}.profile.sms`), icon: "phone", onPress: () => void openSms(partnerShareMessage(product, name, actions.shortUrl, lang)) },
                        { label: t(`${ns}.profile.copy`), icon: "copy", onPress: () => void copy(actions.shortUrl) },
                        { label: t(`${ns}.profile.qr`), icon: "scan", onPress: () => setQrFor({ id: actions.id, name: actions.label }), disabled: actions.status !== "ACTIVE" },
                        ...(cap.pause && o.can.update ? [{ label: t(`${ns}.links.${actions.status === "ACTIVE" ? "pause" : "resume"}`), icon: "clock" as const, onPress: () => void setStatus(actions) }] : []),
                      ] : []} />
                    <Sheet visible={!!qrFor} onClose={() => setQrFor(null)} title={t(`${ns}.qr.title`)} testID="growth-qr-sheet">
                      {qrFor ? <QrCard product={product} linkId={qrFor.id} caption={qrFor.name} testID="growth-qr-link" /> : null}
                    </Sheet>
                    <Sheet visible={creating} onClose={() => setCreating(false)} title={t(`${ns}.links.createTitle`)} testID="growth-create-sheet"
                      footer={<Button title={t(`${ns}.links.save`)} onPress={() => void create()} loading={busy} disabled={label.trim().length < 2} testID="growth-create-save" />}>
                      <Field label={t(`${ns}.links.label`)} placeholder={t(`${ns}.links.labelHint`)} value={label} onChangeText={setLabel} maxLength={80} testID="growth-create-label" />
                      <T variant="small" weight="semibold">{t(`${ns}.links.channel`)}</T>
                      <Row gap={8} style={{ flexWrap: "wrap" }}>
                        {PARTNER_CHANNELS.map((c) => <Chip key={c} label={t(`${ns}.links.channelKind.${c}`)} selected={channel === c} onPress={() => { haptic.select(); setChannel(c); }} testID={`growth-channel-${c}`} />)}
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
