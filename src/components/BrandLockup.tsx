import { View } from "react-native";
import { useTranslation } from "react-i18next";
import { T } from "@/components/ui";
import { KiorexMark } from "@/components/Logo";
import { useTheme } from "@/theme";

/** App lockup: Kiorex mark | hairline | "Kiorly" bold + "Team" light coral (the name comes from i18n `app.name`, split on the first space, so a rename lands by itself),
 *  with an optional tagline underneath. For use on the indigo/ocean gradient (`light`) or on a plain surface. Row order follows the layout direction, so Arabic mirrors correctly. */
export function BrandLockup({ light = true, tagline = true, markWidth = 52, testID }: { light?: boolean; tagline?: boolean; markWidth?: number; testID?: string }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const full = t("app.name"); const i = full.indexOf(" ");
  const first = i < 0 ? full : full.slice(0, i); const rest = i < 0 ? "" : full.slice(i + 1);
  const main = light ? "#FFFFFF" : colors.text;
  return (
    <View testID={testID} accessible accessibilityRole="header" accessibilityLabel={full} style={{ flexDirection: "row", alignItems: "center", gap: 12, flexShrink: 1 }}>
      <KiorexMark width={markWidth} light={light} />
      <View aria-hidden style={{ width: 1, alignSelf: "stretch", marginVertical: 4, backgroundColor: light ? "rgba(255,255,255,0.35)" : colors.border }} />
      <View style={{ flexShrink: 1, gap: 2 }}>
        <T variant="title" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} color={main} style={{ lineHeight: 30, ...{} }}>
          <T variant="title" weight="bold" color={main}>{first}</T>{rest ? <T variant="title" weight="regular" color={light ? "#FFB4A0" : colors.pulse}>{` ${rest}`}</T> : null}
        </T>
        {tagline ? <T variant="caption" numberOfLines={2} color={light ? "#D6DBFF" : colors.muted}>{t("app.tagline")}</T> : null}
      </View>
    </View>
  );
}
