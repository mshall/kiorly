import { useEffect, useState } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useFonts } from "expo-font";
import { Jost_400Regular, Jost_500Medium, Jost_600SemiBold, Jost_700Bold } from "@expo-google-fonts/jost";
import { IBMPlexSansArabic_400Regular, IBMPlexSansArabic_500Medium, IBMPlexSansArabic_600SemiBold, IBMPlexSansArabic_700Bold } from "@expo-google-fonts/ibm-plex-sans-arabic";
import { View } from "react-native";
import { useTranslation } from "react-i18next";
import { bootstrapI18n } from "@/i18n";
import { handleRestart } from "@/i18n/restart";
import { DirectionBanner } from "@/components/DirectionBanner";
import { PushPrimer } from "@/components/PushPrimer";
import { ThemeProvider, fontFamily, useTheme } from "@/theme";
import { ToastProvider } from "@/components/ui";
import { AnimatedSplash } from "@/components/AnimatedSplash";
import { SessionProvider, useSessions } from "@/auth/SessionProvider";
import { LockProvider, LockScreen } from "@/auth/lock";
import { ApiError } from "@/api/errors";
import { startNetworkWatcher } from "@/offline/network";
import { SyncDriver } from "@/offline/SyncDriver";
import { NotificationDriver } from "@/hooks/NotificationDriver";

void SplashScreen.preventAutoHideAsync();
startNetworkWatcher();

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 15_000, retry: (n, e) => !(e instanceof ApiError && (e.status < 500 && e.status !== 0)) && n < 2 } },
});

function Shell() {
  const { i18n } = useTranslation();
  const { colors, scheme } = useTheme();
  const { products, ready } = useSessions();
  const common = {
    headerStyle: { backgroundColor: colors.surface }, headerShadowVisible: false, animation: "slide_from_right" as const, headerTintColor: colors.ink,
    headerTitleStyle: { fontFamily: fontFamily(i18n.language, "semibold"), color: colors.text }, contentStyle: { backgroundColor: colors.ground }, headerBackButtonDisplayMode: "minimal" as const,
  };
  if (!ready) return null; // wait for stored sessions so first requests carry the token
  return (
    <LockProvider signedIn={products.length > 0}>
      <View style={{ flex: 1 }}>
        <StatusBar style={scheme === "dark" ? "light" : "dark"} />
        <SyncDriver />
        <NotificationDriver />
        <Stack screenOptions={common}>
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="sign-in" options={{ headerShown: false, animation: "fade" }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="upgrade" options={{ headerShown: false, presentation: "card" }} />
          <Stack.Screen name="search" options={{ headerShown: false, animation: "fade_from_bottom" }} />
          <Stack.Screen name="scan" options={{ headerShown: false, presentation: "fullScreenModal" }} />
        </Stack>
        <PushPrimer />
        <DirectionBanner />
        <LockScreen />
      </View>
    </LockProvider>
  );
}

/** AnimatedSplash that stays on screen until the stored sessions have loaded (Shell renders nothing before that). */
function SplashGate({ onDone, onShown }: { onDone: () => void; onShown: () => void }) {
  const { ready } = useSessions();
  return <AnimatedSplash hold={!ready} onDone={onDone} onShown={onShown} />;
}

export default function RootLayout() {
  const [i18nReady, setI18nReady] = useState(false);
  const [fontsLoaded, fontError] = useFonts({ Jost_400Regular, Jost_500Medium, Jost_600SemiBold, Jost_700Bold, IBMPlexSansArabic_400Regular, IBMPlexSansArabic_500Medium, IBMPlexSansArabic_600SemiBold, IBMPlexSansArabic_700Bold });
  useEffect(() => {
    // `needsRestart`: RTL was just forced and only applies after a JS reload. Reload in a real build; in Expo Go raise a one-time "close and reopen" banner.
    void bootstrapI18n().then((r) => { if (r.needsRestart) void handleRestart(); }).catch(() => {}).finally(() => setI18nReady(true));
  }, []);
  const ready = i18nReady && (fontsLoaded || !!fontError);
  const [splash, setSplash] = useState(true);
  // The native splash is only the flat brand ground (assets/splash-blank.png on #3730A3 / #0F1024, same as AnimatedSplash). It is hidden once the
  // AnimatedSplash has laid out over it (onShown), so there is never a frame of the bare window between the two; the 3 s fallback guards a missed layout.
  const hideNative = () => { void SplashScreen.hideAsync(); };
  useEffect(() => { if (!ready) return; const t = setTimeout(hideNative, 3000); return () => clearTimeout(t); }, [ready]);
  if (!ready) return null;
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <SessionProvider>
            <ToastProvider>
              <Shell />
            </ToastProvider>
            {splash ? <SplashGate onDone={() => { setSplash(false); hideNative(); }} onShown={hideNative} /> : null}
          </SessionProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
