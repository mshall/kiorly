import { Pressable, View } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme, radius } from "@/theme";
import { Badge, Row, Screen, T } from "@/components/ui";
import { Icon } from "@/components/Icon";
import { EmptyState } from "@/components/states";
import { FadeIn } from "@/components/kit";
import { useSessions } from "@/auth/SessionProvider";
import { PRODUCT_META, accentFor } from "@/api/products";
import { TILES, tilesFor } from "@/modules/registry";
import { haptic } from "@/lib/haptics";

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
        const accent = accentFor(p, scheme); const tiles = tilesFor(p, sessions[p]?.bootstrap?.modules); const entitled = isEntitled(p);
        const locked = TILES.filter((x) => x.product === p);
        return (
          <FadeIn key={p} delay={60 * i}>
            <View style={{ gap: 10, marginTop: 14 }} testID={`work-${p}`}>
              <Row gap={8}><Icon name={PRODUCT_META[p].icon} size={20} color={accent} /><T variant="h2">{t(PRODUCT_META[p].nameKey)}</T></Row>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
                {(entitled ? tiles : locked.slice(0, 4)).map((x) => (
                  <Pressable key={x.key} testID={`tile-${x.key}`} disabled={!entitled} onPress={() => { haptic.tap(); router.push(x.route as never); }} accessibilityRole="button" accessibilityLabel={t(`tiles.${x.key}.title`)}
                    style={({ pressed }) => ({ flexBasis: "47%", flexGrow: 1, borderRadius: radius + 2, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, padding: 14, gap: 10, minHeight: 112, opacity: entitled ? (pressed ? 0.85 : 1) : 0.55 })}>
                    <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: colors.subtle, alignItems: "center", justifyContent: "center" }}><Icon name={entitled ? x.icon : "lock"} size={20} color={accent} /></View>
                    <View style={{ gap: 2 }}>
                      <T weight="semibold" numberOfLines={1}>{t(`tiles.${x.key}.title`)}</T>
                      <T variant="caption" muted numberOfLines={2}>{t(`tiles.${x.key}.desc`)}</T>
                    </View>
                    {!entitled ? <Badge tone="warning" label={t("work.locked")} /> : null}
                  </Pressable>
                ))}
              </View>
              {!entitled ? <Pressable onPress={() => router.push(`/upgrade?product=${p}` as never)}><T variant="small" color={colors.ink2} weight="semibold">{t("work.proOnly")} →</T></Pressable> : null}
            </View>
          </FadeIn>
        );
      })}
    </Screen>
  );
}
