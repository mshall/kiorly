import { Pressable, View } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme, radius } from "@/theme";
import { Card, Row, Screen, T } from "@/components/ui";
import { Icon } from "@/components/Icon";
import { EmptyState } from "@/components/states";
import { FadeIn } from "@/components/kit";
import { useSessions } from "@/auth/SessionProvider";
import { PRODUCT_META, accentFor, type Product } from "@/api/products";
import { tilesFor } from "@/modules/registry";
import { haptic } from "@/lib/haptics";
import { LiteBadge, LockedTile, UpgradeSheet, useLockedTap } from "@/components/lite";
import { isLite, lockedTilesFor } from "@/lite/logic";
import { useAlerts } from "@/hooks/useAlerts";
import { useState } from "react";
import { localizeDigits } from "@/lib/format";

/** Lite (below Pro): what the slice includes, then every Pro tool for THIS role as a visible locked tile (tap = what it does for you + one request action). */
function LiteSlice({ product }: { product: Product }) {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const { sessions } = useSessions();
  const alerts = useAlerts("open");
  const b = sessions[product]?.bootstrap;
  const locked = lockedTilesFor(product, b);
  const [feature, setFeature] = useState<string | null>(null);
  const tap = useLockedTap(product, setFeature);
  const mine = alerts.items.filter((a) => a.product === product && !a.ackedAt).length;
  return (
    <View style={{ gap: 10 }} testID={`lite-${product}`}>
      <Card testID={`lite-included-${product}`} style={{ gap: 10, borderColor: colors.success }}>
        <Row gap={10}><Icon name="shield" size={22} color={colors.success} /><T weight="semibold" style={{ flex: 1 }}>{t("lite.includedTitle")}</T></Row>
        <T variant="small" muted>{t("lite.includedBody")}</T>
        <Pressable testID={`lite-alerts-${product}`} onPress={() => { haptic.tap(); router.push("/(tabs)/inbox" as never); }} accessibilityRole="button" accessibilityLabel={t("upgrade.viewAlerts") + (mine ? ` (${localizeDigits(mine, i18n.language)})` : "")}
          style={{ minHeight: 48, borderRadius: radius, backgroundColor: colors.successSoft, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", gap: 10 }}>
          <Icon name="alert" size={20} color={colors.success} /><T weight="semibold" style={{ flex: 1 }}>{t("upgrade.viewAlerts")}{mine ? ` (${localizeDigits(mine, i18n.language)})` : ""}</T><Icon name="chevron" size={18} color={colors.subtleText} mirror />
        </Pressable>
      </Card>
      {locked.length ? (
        <>
          <T variant="small" weight="semibold" color={colors.muted} accessibilityRole="header">{t("lite.lockedTitle", { count: locked.length })}</T>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>{locked.map((x) => <LockedTile key={x.key} tile={x} onPress={() => tap(x.key)} />)}</View>
        </>
      ) : null}
      <UpgradeSheet product={product} featureKey={feature} onClose={() => setFeature(null)} />
    </View>
  );
}

export default function Work() {
  const { t } = useTranslation();
  const { colors, scheme } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { sessions, products, isEntitled } = useSessions();
  const anyTiles = products.some((p) => tilesFor(p, sessions[p]?.bootstrap?.modules).length);
  return (
    <Screen style={{ paddingTop: insets.top + 8 }} title={t("work.title")} testID="work">
      {!anyTiles && !products.some((p) => !isEntitled(p)) ? <EmptyState icon="list" title={t("work.empty")} hint={t("work.emptyHint")} /> : null}
      {products.map((p, i) => {
        const accent = accentFor(p, scheme); const b = sessions[p]?.bootstrap; const tiles = tilesFor(p, b?.modules); const entitled = isEntitled(p);
        return (
          <FadeIn key={p} delay={60 * i}>
            <View style={{ gap: 10, marginTop: 14 }} testID={`work-${p}`}>
              <Row gap={8}><Icon name={PRODUCT_META[p].icon} size={20} color={accent} /><T variant="h2">{t(PRODUCT_META[p].nameKey)}</T>{!entitled && isLite(b) ? <LiteBadge product={p} /> : null}</Row>
              {entitled ? (
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
                  {tiles.map((x) => (
                    <Pressable key={x.key} testID={`tile-${x.key}`} onPress={() => { haptic.tap(); router.push(x.route as never); }} accessibilityRole="button" accessibilityLabel={t(`tiles.${x.key}.title`)}
                      style={({ pressed }) => ({ flexBasis: "47%", flexGrow: 1, borderRadius: radius + 2, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, padding: 14, gap: 10, minHeight: 112, opacity: pressed ? 0.85 : 1 })}>
                      <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: colors.subtle, alignItems: "center", justifyContent: "center" }}><Icon name={x.icon} size={20} color={accent} /></View>
                      <View style={{ gap: 2 }}>
                        <T weight="semibold" numberOfLines={1}>{t(`tiles.${x.key}.title`)}</T>
                        <T variant="caption" muted numberOfLines={2}>{t(`tiles.${x.key}.desc`)}</T>
                      </View>
                    </Pressable>
                  ))}
                </View>
              ) : isLite(b) ? <LiteSlice product={p} /> : (
                <Pressable onPress={() => router.push(`/upgrade?product=${p}` as never)} accessibilityRole="button" style={{ minHeight: 44, justifyContent: "center" }}><T variant="small" color={colors.ink2} weight="semibold">{t("upgrade.flagOff")} →</T></Pressable>
              )}
            </View>
          </FadeIn>
        );
      })}
    </Screen>
  );
}
