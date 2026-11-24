import { useCallback, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQueryClient } from "@tanstack/react-query";
import { RefreshControl } from "react-native";
import { layout, radii, space, useTheme } from "@/theme";
import { Badge, Banner, Button, Card, IconButton, Row, Screen, T } from "@/components/ui";
import { Icon } from "@/components/Icon";
import { BrandHeader } from "@/components/BrandHeader";
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

  const orgName = (first?.bootstrap?.org ? (pick(first.bootstrap.org as object, "name", i18n.language) as string) : "") || first?.bootstrap?.org.name || "";
  return (
    <View style={{ flex: 1, backgroundColor: colors.ground }}>
    <BrandHeader>
      <IconButton icon="search" label={t("common.search")} testID="open-search" onPress={() => go("/search")} />
      <IconButton icon="logout" mirror label={t("signOutDlg.avatar")} testID="open-account-menu" onPress={() => setMenu(true)} />
    </BrandHeader>
    <Screen padded={false} refresh={<RefreshControl refreshing={false} onRefresh={() => void refresh()} tintColor={colors.ink} />} style={{ paddingTop: space[2], paddingHorizontal: layout.gutter, gap: space[4] }} testID="home">
      <SignOutSheet visible={menu} onClose={() => setMenu(false)} />
      <View style={{ paddingHorizontal: space[1], gap: space[1] }}>
        <T variant="display" numberOfLines={2} accessibilityRole="header" testID="home-greeting">{t(greetingKey(), { name })}</T>
        <Row gap={space[2]} style={{ justifyContent: "space-between", marginTop: space[1] }}>
          {orgName ? <T color={colors.muted} numberOfLines={1} style={{ flex: 1 }}>{orgName}</T> : <View style={{ flex: 1 }} />}
          <SyncChip onPress={() => go("/sync")} />
        </Row>
      </View>

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
                        style={({ pressed }) => ({ flexBasis: "47%", flexGrow: 1, minHeight: 80, borderRadius: radii.lg, backgroundColor: pressed ? colors.soft : colors.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: pressed ? colors.ink : colors.border, padding: space[4], gap: space[2] })}>
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
    </View>
  );
}
