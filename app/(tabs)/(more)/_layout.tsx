import { Pressable } from "react-native";
import { Stack, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { fontFamily, useTheme } from "@/theme";
import { Icon } from "@/components/Icon";

/** Every pushed screen (clinic/*, pharmacy/*, lab/*, devices, sync, upgrade, search) lives here, inside the `(tabs)` group as ONE hidden tab (button hidden; `href: null` tabs redirect in expo-router 58),
 *  so the bottom tab bar stays visible. Route groups do not change URLs: `/clinic/visits`, `/lab/critical`, `/upgrade?product=` etc. are unchanged. */
export default function MoreLayout() {
  const { i18n, t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const back = () => (router.canGoBack() ? router.back() : router.replace("/(tabs)" as never));
  return (
    <Stack screenOptions={{
      headerStyle: { backgroundColor: colors.surface }, headerShadowVisible: false, animation: "slide_from_right", headerTintColor: colors.ink,
      headerTitleStyle: { fontFamily: fontFamily(i18n.language, "semibold"), color: colors.text }, contentStyle: { backgroundColor: colors.ground },
      // always show a back button (deep links / push taps open these screens with no history: fall back to Home)
      headerBackVisible: false,
      headerLeft: () => (
        <Pressable onPress={back} testID="header-back" accessibilityRole="button" accessibilityLabel={t("common.back")} hitSlop={8} style={{ width: 44, height: 44, justifyContent: "center", alignItems: "center" }}>
          <Icon name="back" color={colors.ink} mirror />
        </Pressable>
      ),
    }}>
      <Stack.Screen name="upgrade" options={{ headerShown: false }} />
      <Stack.Screen name="search" options={{ headerShown: false, animation: "fade_from_bottom" }} />
    </Stack>
  );
}
