import { useState } from "react";
import { Pressable, View } from "react-native";
import { SvgXml } from "react-native-svg";
import { useTranslation } from "react-i18next";
import { Banner, Button, Card, Row, Screen, T } from "@/components/ui";
import { FadeIn, QueryView, SectionTitle } from "@/components/kit";
import { request } from "@/api/client";
import { useRead, usePullRefresh } from "@/hooks/useRead";
import { useTheme } from "@/theme";
import { haptic } from "@/lib/haptics";
import { copyText, openWhatsapp, shareLink } from "@/lib/shareLink";
import { ClinicError, Title, useLang } from "@/modules/clinic/shared";
import { codeOf, isNetwork, slotLabel, toggleSlot, type SlotCardDto, type SlotsDto } from "@/modules/clinic/growth-marketing";

/** GRW-P2-C: the next free times as a card. Nothing is held; a taken time is refused again when the card is created. */
export default function GrowthSlots() {
  const { t } = useTranslation();
  const { lang } = useLang();
  const { colors } = useTheme();
  const q = useRead<SlotsDto>("clinic", "/mobile/growth/slots", { query: { days: 3 } });
  const refresh = usePullRefresh(q);
  const [chosen, setChosen] = useState<string[]>([]);
  const [card, setCard] = useState<SlotCardDto | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const create = async () => {
    setBusy(true); setMsg(null); setCard(null);
    try {
      setCard(await request<SlotCardDto>("clinic", "POST", "/mobile/growth/slots/card", { body: { startsAt: chosen, locale: lang.startsWith("ar") ? "ar" : "en" } }));
      haptic.success();
    } catch (e) {
      haptic.error();
      if (codeOf(e) === "SLOT_NO_LONGER_AVAILABLE") { setMsg(t("clinic.growth.slots.gone")); setChosen([]); void q.refetch(); }
      else if (isNetwork(e)) setMsg(t("clinic.growth.common.needsConnection"));
      else if (codeOf(e) === "SHARE_LINK_REQUIRED") setMsg(t("clinic.growth.share.noLink"));
      else setMsg(t("states.errorTitle"));
    } finally { setBusy(false); }
  };

  return (
    <Screen refresh={refresh} testID="clinic-growth-slots" title={t("clinic.growth.slots.title")}>
      <Title k="clinic.growth.slots.title" />
      <View style={{ gap: 12, marginTop: 8 }}>
        <T muted>{t("clinic.growth.slots.intro")}</T>
        {q.isError && !q.data ? <ClinicError error={q.error} onRetry={() => void q.refetch()} /> : (
          <QueryView q={q} cached={q.fromCache} rows={3}>
            {(d) => (
              <FadeIn>
                <View style={{ gap: 12 }}>
                  {q.fromCache ? <Banner tone="ink" body={t("clinic.growth.common.offlineShowing")} /> : null}
                  {msg ? <Banner tone="warning" body={msg} testID="slots-msg" /> : null}
                  {d.items.length === 0 ? <T muted testID="slots-empty">{t("clinic.growth.slots.none")}</T> : (
                    <Card style={{ gap: 8 }} testID="slots-list">
                      <SectionTitle title={`${t("clinic.growth.slots.choose")} (${t("clinic.growth.slots.chosen", { count: chosen.length })})`} />
                      {d.items.map((s) => {
                        const on = chosen.includes(s.startsAt);
                        return (
                          <Pressable key={s.startsAt} testID="slots-option" accessibilityRole="checkbox" accessibilityState={{ checked: on }} onPress={() => { haptic.select(); setChosen((c) => toggleSlot(c, s.startsAt)); }}
                            style={{ minHeight: 48, justifyContent: "center", paddingHorizontal: 12, borderRadius: 12, borderWidth: 1, borderColor: on ? colors.ink : colors.border, backgroundColor: on ? colors.soft : "transparent" }}>
                            <T weight={on ? "semibold" : "regular"} forceLatin>{slotLabel(s, lang)}</T>
                          </Pressable>
                        );
                      })}
                      <T variant="caption" muted>{t("clinic.growth.slots.zone", { zone: d.timezone })}</T>
                      <Button title={t("clinic.growth.slots.create")} onPress={() => void create()} loading={busy} disabled={chosen.length === 0} testID="slots-create" />
                    </Card>
                  )}
                  {card ? (
                    <Card style={{ gap: 10 }} testID="slots-result">
                      <View accessible accessibilityRole="image" style={{ alignItems: "center", backgroundColor: "#FFFFFF", borderRadius: 12, borderWidth: 1, borderColor: colors.border, padding: 6 }}>
                        <SvgXml xml={card.svg} width={260} height={325} />
                      </View>
                      <T variant="caption" muted>{t("clinic.growth.slots.link")}</T>
                      <T selectable forceLatin variant="small">{card.link}</T>
                      <T selectable testID="slots-caption">{card.caption}</T>
                      <Row gap={8} style={{ flexWrap: "wrap" }}>
                        <Button small icon="share" title={t("clinic.growth.share.share")} onPress={() => void shareLink(card.caption, card.link)} testID="slots-share" />
                        <Button small variant="secondary" title={t("clinic.growth.share.whatsapp")} onPress={() => void openWhatsapp(card.caption)} testID="slots-whatsapp" />
                        <Button small variant="secondary" icon="copy" title={t("clinic.growth.share.copy")} onPress={() => void copyText(card.caption)} testID="slots-copy" />
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
