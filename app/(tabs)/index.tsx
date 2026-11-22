import { useCallback, useState } from "react";
import { Pressable, View } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQueryClient } from "@tanstack/react-query";
import { RefreshControl } from "react-native";
import { useTheme, radius } from "@/theme";
import { Badge, Banner, Button, Card, Row, Screen, T } from "@/components/ui";
import { Icon } from "@/components/Icon";
import { KiorexMark } from "@/components/Logo";
import { FadeIn, SectionTitle, SyncChip, greetingKey } from "@/components/kit";
import { useSessions } from "@/auth/SessionProvider";
import { PRODUCT_META, accentFor, type Product } from "@/api/products";
import { tilesFor } from "@/modules/registry";
import { useAlerts } from "@/hooks/useAlerts";
import ClinicSummary from "@/modules/clinic/HomeSummary";
import PharmacySummary from "@/modules/pharmacy/HomeSummary";
import LabSummary from "@/modules/lab/HomeSummary";
import { haptic } from "@/lib/haptics";
import { LiteHomeBlock } from "@/components/lite";
import { isLite } from "@/lite/logic";
import { SignOutSheet } from "@/components/SignOutSheet";
import { pick } from "@/lib/format";

const SUMMARY = { clinic: ClinicSummary, pharmacy: PharmacySummary, lab: LabSummary } as const;

export default function Home() {
  const { t, i18n } = useTranslation();
  const { colors, scheme } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const qc = useQueryClient();
  const { sessions, products, notice, dismissNotice, refreshBootstrap, isEntitled } = useSessions();
  const alerts = useAlerts("open");
  const first = sessions[products[0]];
  const name = (first?.userName ?? "").split("@")[0].split(" ").find((w) => w && !/^(dr|prof|mr|mrs|ms|eng)\.?$/i.test(w)) ?? ""; // skip honorifics ("Dr Nadia" -> "Nadia")
  const refresh = useCallback(async () => { await Promise.all([...products.map((p) => refreshBootstrap(p)), qc.invalidateQueries()]); }, [products, refreshBootstrap, qc]);
  const critical = alerts.items.filter((a) => !a.ackedAt && a.severity === "CRITICAL").length;
  const open = alerts.openCount;
  const firstOpen = alerts.items.find((a) => !a.ackedAt);
  const ar = i18n.language.startsWith("ar");
  const [menu, setMenu] = useState(false);
  const go = (r: string) => { haptic.tap(); router.push(r as never); };

  return (
    <Screen padded={false} refresh={<RefreshControl refreshing={false} onRefresh={() => void refresh()} tintColor={colors.ink} />} style={{ paddingTop: insets.top + 8, paddingHorizontal: 16, gap: 14 }} testID="home">
      <SignOutSheet visible={menu} onClose={() => setMenu(false)} />
      <Row style={{ justifyContent: "space-between" }}>
        <Row gap={10} style={{ flex: 1, minWidth: 0 }}><KiorexMark width={40} /><View style={{ flex: 1, minWidth: 0 }}><T variant="caption" muted numberOfLines={1}>{t("app.name")}</T><T variant="h2" numberOfLines={2} testID="home-greeting">{t(greetingKey(), { name })}</T></View></Row>
        <Row gap={8} style={{ flexShrink: 0 }}>
          <SyncChip onPress={() => go("/sync")} />
          <Pressable onPress={() => go("/search")} testID="open-search" accessibilityRole="button" accessibilityLabel={t("common.search")} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" }}><Icon name="search" size={20} color={colors.ink} /></Pressable>
          <Pressable onPress={() => { haptic.tap(); setMenu(true); }} testID="open-account-menu" accessibilityRole="button" accessibilityLabel={t("signOutDlg.avatar")} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" }}><Icon name="logout" size={20} color={colors.ink} mirror /></Pressable>
        </Row>
      </Row>

      {notice ? (
        <Banner tone="warning" testID="session-notice" body={t(`notice.${notice.reason}`, { product: t(PRODUCT_META[notice.product].nameKey) })}><Button small variant="secondary" title={t("common.done")} onPress={dismissNotice} /></Banner>
      ) : null}

      <FadeIn>
        <Card onPress={() => go("/(tabs)/inbox")} testID="attention-card" style={{ backgroundColor: critical ? colors.dangerSoft : open ? colors.warningSoft : colors.successSoft, borderColor: critical ? colors.danger : open ? colors.warning : colors.success }}>
          <Row gap={12}>
            <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" }}><Icon name={open ? "alert" : "shield"} size={22} color={critical ? colors.danger : open ? colors.warning : colors.success} /></View>
            <View style={{ flex: 1 }}>
              <T weight="semibold">{open ? t("inbox.open", { count: open }) + " · " + t("inbox.alerts") : t("home.allClear")}</T>
              {firstOpen ? <T variant="small" muted numberOfLines={1}>{ar ? firstOpen.titleAr ?? firstOpen.title : firstOpen.title}</T> : <T variant="small" muted>{t("inbox.safetyFree")}</T>}
            </View>
            <Icon name="chevron" size={18} color={colors.subtleText} mirror />
          </Row>
        </Card>
      </FadeIn>

      {products.map((p, idx) => {
        const s = sessions[p]!; const b = s.bootstrap; const entitled = isEntitled(p); const accent = accentFor(p, scheme);
        const tiles = tilesFor(p, b?.modules);
        const Summary = SUMMARY[p];
        return (
          <FadeIn key={p} delay={80 * (idx + 1)}>
            <View style={{ gap: 10 }} testID={`home-${p}`}>
              <Row style={{ justifyContent: "space-between" }}>
                <Row gap={8}><View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: accent }} /><T variant="h2">{t(PRODUCT_META[p].nameKey)}</T></Row>
                <Badge tone={entitled ? "success" : "warning"} label={b ? `${b.org.plan === "BASIC" ? t("signIn.planBasic") : b.org.plan === "PRO" ? t("signIn.planPro") : t("signIn.planEnterprise")} · ${pick(b.org as object, "name", i18n.language) || b.org.name}` : "-"} />
              </Row>
              {entitled ? (
                <>
                  <Summary session={s} />
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
                    {tiles.filter((x) => x.quick).map((x) => (
                      <Pressable key={x.key} testID={`quick-${x.key}`} onPress={() => go(x.route)} accessibilityRole="button" accessibilityLabel={t(`tiles.${x.key}.title`)}
                        style={{ flexBasis: "47%", flexGrow: 1, minHeight: 72, borderRadius: radius + 2, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, padding: 12, gap: 8, borderTopWidth: 3, borderTopColor: accent }}>
                        <Icon name={x.icon} size={22} color={accent} />
                        <T variant="small" weight="semibold" numberOfLines={2}>{t(`tiles.${x.key}.title`)}</T>
                      </Pressable>
                    ))}
                  </View>
                </>
              ) : (
                isLite(b) ? <LiteHomeBlock product={p} /> : (
                  <Card onPress={() => go(`/upgrade?product=${p}`)} testID={`upgrade-card-${p}`} style={{ borderColor: colors.pulse }}>
                    <Row gap={12}><Icon name="lock" size={22} color={colors.pulse} /><T style={{ flex: 1 }}>{t("upgrade.flagOff")}</T><Icon name="chevron" size={18} color={colors.subtleText} mirror /></Row>
                  </Card>
                )
              )}
            </View>
          </FadeIn>
        );
      })}
      <SectionTitle title={t("home.quick")} />
      <Button title={t("home.searchAll")} variant="secondary" icon="search" onPress={() => go("/search")} />
      <Button title={t("scan.title")} variant="secondary" icon="scan" onPress={() => go("/scan")} testID="home-scan" />
    </Screen>
  );
}
