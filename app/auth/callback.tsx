import { useEffect } from "react";
import { ActivityIndicator, Platform, View } from "react-native";
import { useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";

/**
 * Landing route of the Passport redirects (`kiorly://auth/callback`, `kiorly://auth/logout`, `<web origin>/auth/callback`).
 * The auth session normally consumes the redirect itself (native: the in-app browser hands the URL back; web: the popup posts it to the
 * opener and closes, see `maybeCompleteAuthSession` in app/_layout.tsx). This screen only exists so that a redirect that reaches the router
 * (Android intent, web full-page return) never shows "unmatched route": it goes home, where the session guard routes to sign-in or the app.
 */
export default function AuthCallback() {
  const router = useRouter();
  useEffect(() => {
    WebBrowser.maybeCompleteAuthSession();
    const t = setTimeout(() => router.replace("/"), Platform.OS === "web" ? 1200 : 0);
    return () => clearTimeout(t);
  }, [router]);
  return <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }} testID="auth-callback"><ActivityIndicator /></View>;
}
