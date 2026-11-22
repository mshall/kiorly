import { Pressable, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/theme";
import { Badge, Banner, Button, Card, Row, Screen, T } from "@/components/ui";
import { Icon, type IconName } from "@/components/Icon";
import { FadeIn } from "@/components/kit";
import { useSessions } from "@/auth/SessionProvider";
import { PRODUCT_META, accentFor, type Product } from "@/api/products";
import { useAlerts } from "@/hooks/useAlerts";
import { UpgradeRequestButton, UpgradeRequestsSection, UpgradeSheet } from "@/components/lite";
import { benefitKeys, isFeatureKey, isLite, lockedTilesFor, roleGroup } from "@/lite/logic";
import { tileByKey } from "@/modules/registry";
import { noteTapped } from "@/lite/useUpgradeRequest";
import { useState } from "react";
import { localizeDigits } from "@/lib/format";

const FEATS: [IconName, string][] = [["list", "upgrade.feat1"], ["scan", "upgrade.feat2"], ["sync", "upgrade.feat3"], ["bell", "upgrade.feat4"], ["fingerprint", "upgrade.feat5"]];

/** Upgrade path for Basic (or flag-off) orgs. Safety alerts stay reachable (ADR-025). */
export default function Upgrade() {
  const { product, feature } = useLocalSearchParams<{ product: Product; feature?: string }>();
  const p: Product = (product as Product) ?? "clinic";
  const { t, i18n } = useTranslation();
  const { colors, scheme } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { sessions, signOut } = useSessions();
  const alerts = useAlerts("open");
  const b = sessions[p]?.bootstrap;
  const name = t(PRODUCT_META[p].nameKey);
  const flagOff = b?.entitlement.reason === "FLAG_OFF";
  const planLabel = b?.org.plan === "BASIC" ? t("signIn.planBasic") : b?.org.plan ?? "";
  const lite = isLite(b);
  const featureKey = isFeatureKey(feature) ? feature : "general";
  const tile = featureKey === "general" ? undefined : tileByKey(featureKey);
  const group = roleGroup(p, b?.user.role, b?.user.isOwner);
  const [roleKey, defKey] = benefitKeys(featureKey, group);
  const benefit = tile ? (i18n.exists(roleKey) ? t(roleKey) : t(defKey, { defaultValue: "" })) : t("upgrade.body");
  const locked = lockedTilesFor(p, b);
  const [sheet, setSheet] = useState<string | null>(null);
  const mine = alerts.items.filter((a) => a.product === p && !a.ackedAt).length;
  return (
    <Screen padded={false} testID="upgrade" style={{ paddingBottom: 32 }}>
      <LinearGradient colors={scheme === "dark" ? ["#1B1A4E", "#0A3A57"] : ["#3730A3", "#0369A1"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ paddingTop: insets.top + 12, paddingBottom: 60, paddingHorizontal: 20 }}>
        <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace("/(tabs)"))} accessibilityRole="button" accessibilityLabel={t("common.back")} style={{ width: 44, height: 44, justifyContent: "center" }}><Icon name="back" color="#fff" mirror /></Pressable>
        <View style={{ width: 64, height: 64, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.18)", alignItems: "center", justifyContent: "center", marginTop: 8 }}><Icon name="award" size={32} color="#fff" /></View>
        <T variant="display" color="#fff" style={{ marginTop: 14 }} testID="upgrade-title">{t("upgrade.title")}</T>
        <T color="#D6DBFF" style={{ marginTop: 4 }}>{t("upgrade.subtitle", { product: name, org: (i18n.language.startsWith("ar") && b?.org.nameAr) || b?.org.name || "", plan: planLabel })}</T>
      </LinearGradient>
      <View style={{ marginTop: -36, paddingHorizontal: 16, gap: 14 }}>
        <FadeIn>
          <Card style={{ gap: 12 }} testID="upgrade-feature">
            {flagOff ? <Banner tone="warning" body={t("upgrade.flagOff")} testID="upgrade-flagoff" /> : (
              <>
                {tile ? <Row gap={10}><View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: colors.soft, alignItems: "center", justifyContent: "center" }}><Icon name={tile.icon} size={20} color={accentFor(p, scheme)} /></View><T variant="h2" style={{ flex: 1 }}>{t(`tiles.${tile.key}.title`)}</T><Badge tone="ocean" label={t("lite.pro")} /></Row> : null}
                {tile ? <T variant="small" weight="semibold" color={colors.muted}>{t("lite.forYou")}</T> : null}
                <T testID="upgrade-benefit">{benefit}</T>
                <Row gap={8} style={{ flexWrap: "wrap" }}><Badge tone="warning" label={`${name} · ${planLabel}`} /><Badge tone="muted" label={t(`lite.roles.${group}`)} /><Badge tone="ocean" label={t("lite.planBadge")} /></Row>
                {lite ? <UpgradeRequestButton product={p} featureKey={featureKey} /> : null}
              </>
            )}
          </Card>
        </FadeIn>
        {lite ? <UpgradeRequestsSection product={p} limit={10} /> : null}
        {lite && locked.length ? (
          <Card style={{ gap: 6 }} testID="upgrade-role-tools">
            <T variant="small" weight="semibold" color={colors.muted} accessibilityRole="header">{t("lite.lockedTitle", { count: locked.length })}</T>
            {locked.map((x) => (
              <Pressable key={x.key} testID={`upgrade-tool-${x.key}`} onPress={() => { noteTapped(p, sessions[p]?.email ?? "", x.key); setSheet(x.key); }} accessibilityRole="button" accessibilityLabel={t("lite.tileA11y", { title: t(`tiles.${x.key}.title`), desc: t(`tiles.${x.key}.desc`) })}
                style={{ minHeight: 48, flexDirection: "row", alignItems: "center", gap: 12 }}>
                <Icon name="lock" size={18} color={accentFor(p, scheme)} /><View style={{ flex: 1 }}><T weight="medium" numberOfLines={1}>{t(`tiles.${x.key}.title`)}</T><T variant="caption" muted numberOfLines={1}>{t(`tiles.${x.key}.desc`)}</T></View><Icon name="chevron" size={16} color={colors.subtleText} mirror />
              </Pressable>
            ))}
          </Card>
        ) : null}
        <Card style={{ gap: 12 }}>
          <T variant="small" weight="semibold" color={colors.muted}>{t("upgrade.included")}</T>
          {FEATS.map(([ic, k]) => (
            <Row key={k} gap={12}><View style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: colors.soft, alignItems: "center", justifyContent: "center" }}><Icon name={ic} size={18} color={accentFor(p, scheme)} /></View><T style={{ flex: 1 }}>{t(k)}</T></Row>
          ))}
        </Card>
        <Card style={{ gap: 10, borderColor: colors.success }} testID="upgrade-safety">
          <Row gap={10}><Icon name="shield" size={22} color={colors.success} /><T weight="semibold" style={{ flex: 1 }}>{t("upgrade.safetyTitle")}</T></Row>
          <T variant="small" muted>{t("upgrade.safetyBody")}</T>
          <Button title={`${t("upgrade.viewAlerts")}${mine ? ` (${localizeDigits(mine, i18n.language)})` : ""}`} variant="secondary" icon="alert" onPress={() => router.replace("/(tabs)/inbox")} testID="upgrade-alerts" />
        </Card>
        <UpgradeSheet product={p} featureKey={sheet} onClose={() => setSheet(null)} />
        <Button title={t("upgrade.signOut", { product: name })} variant="ghost" onPress={() => void signOut(p).then(() => router.replace(Object.keys(sessions).length > 1 ? "/(tabs)" : "/sign-in"))} />
      </View>
    </Screen>
  );
}
