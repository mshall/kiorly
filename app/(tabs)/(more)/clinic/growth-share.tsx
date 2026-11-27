import { useState } from "react";
import { Pressable, View } from "react-native";
import { SvgXml } from "react-native-svg";
import { stripSvgRootAria } from "@/lib/svgXml";
import { useTranslation } from "react-i18next";
import { Banner, Button, Card, Field, Row, Screen, T, useToast } from "@/components/ui";
import { FadeIn, QueryView, SectionTitle } from "@/components/kit";
import { ApiError } from "@/api/errors";
import { request } from "@/api/client";
import { useRead, usePullRefresh } from "@/hooks/useRead";
import { useTheme } from "@/theme";
import { haptic } from "@/lib/haptics";
import { copyText, openSms, openWhatsapp, shareLink } from "@/lib/shareLink";
import { ClinicError, Title, useLang } from "@/modules/clinic/shared";
import { codeOf, isNetwork, type RenderedCard, type ShareTemplate } from "@/modules/clinic/growth-marketing";

/** GRW-P2-C: approved social templates. The server renders the card and appends the protected footer; writes need a connection. */
export default function GrowthShare() {
  const { t } = useTranslation();
  const { ar } = useLang();
  const { colors } = useTheme();
  const toast = useToast();
  const q = useRead<{ items: ShareTemplate[] }>("clinic", "/mobile/growth/templates", { query: { locale: ar ? "ar" : "en" } });
  const refresh = usePullRefresh(q);
  const [picked, setPicked] = useState<ShareTemplate | null>(null);
  const [custom, setCustom] = useState("");
  const [card, setCard] = useState<RenderedCard | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fail = (e: unknown) => {
    haptic.error();
    if (isNetwork(e)) return setError(t("clinic.growth.common.needsConnection"));
    const code = codeOf(e);
    if (code === "CONTENT_NOT_ALLOWED") return setError(t("clinic.growth.share.refused"));
    if (code === "SHARE_LINK_REQUIRED") return setError(t("clinic.growth.share.noLink"));
    if (code === "FEATURE_DISABLED") return setError(t("clinic.growth.common.disabled"));
    if (e instanceof ApiError && e.status === 403) return setError(t("clinic.growth.common.forbidden"));
    setError(t("states.errorTitle"));
  };
  const render = async () => {
    if (!picked) return;
    setBusy(true); setError(null); setCard(null);
    try {
      setCard(await request<RenderedCard>("clinic", "POST", "/mobile/growth/share/render", { body: { templateId: picked.id, customLine: custom.trim() || undefined } }));
      haptic.success();
    } catch (e) { fail(e); } finally { setBusy(false); }
  };
  const count = (channel: string) => { if (picked) void request("clinic", "POST", "/mobile/growth/share/count", { body: { templateId: picked.id, channel } }).catch(() => undefined); };
  const share = async () => { if (!card) return; const r = await shareLink(card.caption, card.link); if (r === "shared" || r === "copied") count("SHARE_SHEET"); };
  const copy = async () => { if (card && (await copyText(card.caption))) { haptic.success(); toast.show(t("clinic.growth.share.copied"), "success"); count("COPY"); } else await share(); };

  return (
    <Screen refresh={refresh} testID="clinic-growth-share" title={t("clinic.growth.share.title")}>
      <Title k="clinic.growth.share.title" />
      <View style={{ gap: 12, marginTop: 8 }}>
        <T muted>{t("clinic.growth.share.intro")}</T>
        {q.isError && !q.data ? <ClinicError error={q.error} onRetry={() => void q.refetch()} /> : (
          <QueryView q={q} cached={q.fromCache} rows={3}>
            {(d) => (
              <FadeIn>
                <View style={{ gap: 12 }}>
                  {q.fromCache ? <Banner tone="ink" body={t("clinic.growth.common.offlineShowing")} testID="share-offline" /> : null}
                  {d.items.length === 0 ? <T muted testID="share-empty">{t("clinic.growth.share.empty")}</T> : d.items.map((tpl) => (
                    <Pressable key={tpl.id} testID={`share-template-${tpl.slug}`} accessibilityRole="button" accessibilityState={{ selected: picked?.id === tpl.id }} onPress={() => { haptic.select(); setPicked(tpl); setCard(null); setError(null); }}
                      style={{ minHeight: 56, padding: 12, borderRadius: 14, borderWidth: 1, borderColor: picked?.id === tpl.id ? colors.ink : colors.border, gap: 2 }}>
                      <T variant="caption" muted>{t(`clinic.growth.share.kind.${tpl.kind}`)}{tpl.needsDoctor ? ` · ${t("clinic.growth.share.needsDoctor")}` : ""}</T>
                      <T weight="semibold">{tpl.title}</T>
                      <T variant="caption" muted>{tpl.shares30d ? t("clinic.growth.share.shared", { count: tpl.shares30d }) : ""}</T>
                    </Pressable>
                  ))}
                  {picked ? (
                    <Card style={{ gap: 10 }} testID="share-editor">
                      <T variant="small">{picked.body}</T>
                      <Field label={t("clinic.growth.share.custom")} value={custom} onChangeText={setCustom} maxLength={140} testID="share-custom" />
                      <T variant="caption" muted>{t("clinic.growth.share.customHint")}</T>
                      <T variant="caption" muted>{t("clinic.growth.share.footer")}: {picked.protectedFooter}</T>
                      <Button title={t("clinic.growth.share.create")} onPress={() => void render()} loading={busy} testID="share-render" />
                      {error ? <Banner tone="warning" body={error} testID="share-error" /> : null}
                    </Card>
                  ) : null}
                  {card ? (
                    <Card style={{ gap: 10 }} testID="share-result">
                      <SectionTitle title={t("clinic.growth.share.preview")} />
                      <View accessible accessibilityRole="image" accessibilityLabel={picked?.title} style={{ alignItems: "center", backgroundColor: "#FFFFFF", borderRadius: 12, borderWidth: 1, borderColor: colors.border, padding: 6 }}>
                        <SvgXml xml={stripSvgRootAria(card.svg)} width={260} height={260} />
                      </View>
                      <T variant="small" weight="semibold">{t("clinic.growth.share.caption")}</T>
                      <T selectable testID="share-caption">{card.caption}</T>
                      <Row gap={8} style={{ flexWrap: "wrap" }}>
                        <Button small icon="share" title={t("clinic.growth.share.share")} onPress={() => void share()} testID="share-share" />
                        <Button small variant="secondary" title={t("clinic.growth.share.whatsapp")} onPress={() => { count("WHATSAPP"); void openWhatsapp(card.caption); }} testID="share-whatsapp" />
                        <Button small variant="secondary" icon="phone" title={t("clinic.growth.share.sms")} onPress={() => { count("SMS"); void openSms(card.caption); }} testID="share-sms" />
                        <Button small variant="secondary" icon="copy" title={t("clinic.growth.share.copy")} onPress={() => void copy()} testID="share-copy" />
                      </Row>
                    </Card>
                  ) : null}
                </View>
              </FadeIn>
            )}
          </QueryView>
        )}
      </View>
    </Screen>
  );
}
