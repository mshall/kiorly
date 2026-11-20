import { Redirect, Tabs } from "expo-router";
import { View } from "react-native";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { fontFamily, useTheme } from "@/theme";
import { Icon, type IconName } from "@/components/Icon";
import { useSessions } from "@/auth/SessionProvider";
import { useUnreadBadge } from "@/hooks/useAlerts";
import { OfflineBanner } from "@/components/kit";
import { haptic } from "@/lib/haptics";

const TabIcon = ({ name, color, focused, ink }: { name: IconName; color: unknown; focused: boolean; ink: string }) => (
  <View style={{ alignItems: "center" }}>
    <Icon name={name} size={24} color={String(color)} />
    <View style={{ width: 5, height: 5, borderRadius: 3, marginTop: 3, backgroundColor: focused ? ink : "transparent" }} />
  </View>
);

export default function TabsLayout() {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { ready, products } = useSessions();
  const badge = useUnreadBadge();
  if (ready && !products.length) return <Redirect href="/sign-in" />;
  return (
    <View style={{ flex: 1 }}>
      <Tabs
        screenListeners={{ tabPress: () => haptic.select() }}
        screenOptions={{
          headerShown: false, tabBarActiveTintColor: colors.ink, tabBarInactiveTintColor: colors.subtleText, tabBarShowLabel: true,
          tabBarLabelStyle: { fontFamily: fontFamily(i18n.language, "medium"), fontSize: 11 },
          tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border, height: 62 + insets.bottom, paddingTop: 8, paddingBottom: insets.bottom },
        }}>
        <Tabs.Screen name="index" options={{ title: t("tabs.home"), tabBarIcon: (p) => <TabIcon name="home" ink={colors.ink} {...p} /> }} />
        <Tabs.Screen name="work" options={{ title: t("tabs.work"), tabBarIcon: (p) => <TabIcon name="list" ink={colors.ink} {...p} /> }} />
        <Tabs.Screen name="inbox" options={{ title: t("tabs.inbox"), tabBarBadge: badge > 0 ? badge : undefined, tabBarBadgeStyle: { backgroundColor: colors.pulse, color: "#fff", fontSize: 10 }, tabBarIcon: (p) => <TabIcon name="bell" ink={colors.ink} {...p} /> }} />
        <Tabs.Screen name="me" options={{ title: t("tabs.me"), tabBarIcon: (p) => <TabIcon name="user" ink={colors.ink} {...p} /> }} />
      </Tabs>
      <View style={{ position: "absolute", top: 0, left: 0, right: 0 }} pointerEvents="none"><View style={{ paddingTop: insets.top }}><OfflineBanner /></View></View>
    </View>
  );
}
