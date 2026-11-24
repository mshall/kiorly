import { View } from "react-native";
import { useTranslation } from "react-i18next";
import { T } from "@/components/ui";
import { KiorlyLockup } from "@/components/Logo";

/** App lockup on a plain light/dark surface: the Kiorly lockup (mark | coral rule | KIORLY, artwork from _brand), optionally with the tagline underneath.
 *  Row order follows the layout direction, so Arabic mirrors correctly (the Arabic lockup draws the mark on the right). */
export function BrandLockup({ tagline = false, height = 30, light = false, testID }: { tagline?: boolean; height?: number; light?: boolean; testID?: string }) {
  const { t } = useTranslation();
  return (
    <View testID={testID} accessible accessibilityRole="header" accessibilityLabel={t("app.name")} style={{ flexShrink: 1, gap: 6, alignItems: "flex-start" }}>
      <KiorlyLockup height={height} light={light} />
      {tagline ? <T variant="caption" muted numberOfLines={2} testID="brand-tagline">{t("app.tagline")}</T> : null}
    </View>
  );
}
