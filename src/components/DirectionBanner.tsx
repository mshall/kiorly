import { Pressable, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme, radius, MIN_TOUCH } from "@/theme";
import { dismissDirectionBanner, useDirectionBanner } from "@/i18n/restart";
import { Icon } from "./Icon";
import { T } from "./ui";

/** One-time notice (Expo Go, where the app cannot reload itself): the layout direction flips after the app is closed and reopened. Dismissible; never blocks. */
export function DirectionBanner() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const visible = useDirectionBanner();
  if (!visible) return null;
  return (
    <View pointerEvents="box-none" style={{ position: "absolute", top: insets.top + 8, left: 12, right: 12, zIndex: 50 }}>
      <Pressable testID="direction-banner" onPress={dismissDirectionBanner} accessibilityRole="alert" accessibilityLiveRegion="polite" accessibilityHint={t("direction.gotIt")}
        style={{ flexDirection: "row", alignItems: "center", gap: 10, padding: 12, borderRadius: radius, backgroundColor: colors.soft, borderWidth: 1, borderColor: colors.ink }}>
        <Icon name="info" size={20} color={colors.ink} />
        <T variant="small" style={{ flex: 1 }}>{t("direction.restart")}</T>
        <View testID="direction-banner-dismiss" style={{ minHeight: MIN_TOUCH, justifyContent: "center", paddingHorizontal: 8 }}>
          <T variant="small" weight="semibold" color={colors.ink2}>{t("direction.gotIt")}</T>
        </View>
      </Pressable>
    </View>
  );
}
