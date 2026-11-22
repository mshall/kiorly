import { useState } from "react";
import { KeyboardAvoidingView, Pressable, ScrollView, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme, radius } from "@/theme";
import { Banner, Button, Card, Chip, Field, Row, T } from "@/components/ui";
import { Icon } from "@/components/Icon";
import { BrandLockup } from "@/components/BrandLockup";
import { DEMO_ACCOUNTS, PRODUCT_META, SIGN_IN_ENTRIES, accentFor, productOf, type Product, type SignInEntry } from "@/api/products";
import { useSessions } from "@/auth/SessionProvider";
import { ApiError } from "@/api/errors";
import { haptic } from "@/lib/haptics";
import { setLanguage, type Lang } from "@/i18n";

export default function SignIn() {
  const { t, i18n } = useTranslation();
  const { colors, scheme } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { signIn, products } = useSessions();
  const [entry, setEntry] = useState<SignInEntry>("clinic");
  const product: Product = productOf(entry);
  const [email, setEmail] = useState(""); const [password, setPassword] = useState(""); const [org, setOrg] = useState("");
  const [mfa, setMfa] = useState(""); const [needMfa, setNeedMfa] = useState(false);
  const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null);
  const meta = PRODUCT_META[product]; const accent = accentFor(product, scheme);
  const isAr = i18n.language.startsWith("ar");

  const submit = async () => {
    setError(null); setBusy(true);
    try {
      const b = await signIn(product, { email, password, org, mfaCode: mfa || undefined });
      haptic.success();
      router.replace(b.entitlement.enabled ? (entry === "nurse" ? "/clinic/rounds" : "/(tabs)") as never : (`/upgrade?product=${product}` as never));
    } catch (e) {
      haptic.error();
      const err = e as ApiError;
      if (err.code === "MFA_REQUIRED" || err.code === "MFA_CODE_REQUIRED") { setNeedMfa(true); setError(t("signIn.mfa")); }
      else setError(err.isNetwork ? t("signIn.network") : err.status === 401 || err.status === 400 || err.status === 404 ? t("signIn.invalid") : err.message);
    } finally { setBusy(false); }
  };
  const valid = meta.login === "devlogin" ? email.includes("@") && org.length > 1 : email.includes("@") && password.length > 0;

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.ground }} behavior="padding" /* Android 15 is edge-to-edge: the window no longer resizes for the keyboard, so pad on both platforms */>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1 }} showsVerticalScrollIndicator={false}>
        <LinearGradient colors={scheme === "dark" ? ["#1B1A4E", "#0A3A57"] : ["#3730A3", "#0369A1"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ paddingTop: insets.top + 20, paddingBottom: 60, paddingHorizontal: 24 }}>
          <Row gap={12} style={{ justifyContent: "space-between", alignItems: "flex-start" }} testID="signin-header">
            <BrandLockup testID="brand-lockup" tagline={false} />
            <Row gap={6}>
              {(["ar", "en"] as Lang[]).map((l) => (
                <Pressable key={l} onPress={() => void setLanguage(l)} accessibilityRole="button" accessibilityLabel={l === "ar" ? "العربية" : "English"} style={{ paddingHorizontal: 12, height: 34, borderRadius: 17, justifyContent: "center", backgroundColor: i18n.language === l ? "#FFFFFF" : "rgba(255,255,255,0.16)" }}>
                  <T variant="small" weight="semibold" color={i18n.language === l ? "#3730A3" : "#FFFFFF"}>{l === "ar" ? "ع" : "EN"}</T>
                </Pressable>
              ))}
            </Row>
          </Row>
          <View style={{ height: 1, backgroundColor: "rgba(255,255,255,0.22)", marginTop: 18, marginBottom: 10 }} aria-hidden />
          <T variant="small" color="#D6DBFF" testID="brand-tagline">{t("app.tagline")}</T>
        </LinearGradient>

        <View style={{ marginTop: -32, paddingHorizontal: 16, paddingBottom: insets.bottom + 24, gap: 14 }}>
          <Card style={{ gap: 14 }}>
            <T variant="h2">{t("signIn.title")}</T>
            <T variant="small" muted>{t("signIn.subtitle")}</T>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }} testID="product-grid">
              {SIGN_IN_ENTRIES.map((e) => {
                const p = productOf(e); const sel = e === entry; const a = accentFor(p, scheme); const done = products.includes(p);
                return (
                  <Pressable key={e} testID={`product-${e}`} onPress={() => { haptic.select(); setEntry(e); setError(null); setNeedMfa(false); }} accessibilityRole="radio" accessibilityState={{ selected: sel }}
                    accessibilityLabel={`${t(e === "nurse" ? "product.nurse" : PRODUCT_META[p].nameKey)}${done ? `, ${t("signIn.connected")}` : ""}`}
                    style={{ flexGrow: 1, flexBasis: "46%", minWidth: 120, minHeight: 56, borderRadius: radius, paddingHorizontal: 12, paddingVertical: 8, flexDirection: "row", alignItems: "center", gap: 10, borderWidth: sel ? 2 : 1, borderColor: sel ? a : colors.border, backgroundColor: sel ? colors.subtle : colors.surface }}>
                    <Icon name={e === "nurse" ? "heart" : PRODUCT_META[p].icon} size={24} color={a} />
                    <View style={{ flex: 1 }}>
                      <T variant="small" weight="semibold">{t(e === "nurse" ? "product.nurse" : PRODUCT_META[p].nameKey)}</T>
                      {done ? <T variant="caption" color={colors.success}>{t("signIn.connected")}</T> : null}
                    </View>
                  </Pressable>
                );
              })}
            </View>
            {entry === "nurse" ? <T variant="caption" muted testID="nurse-hint">{t("signIn.nurseHint")}</T> : null}
            {error ? <Banner tone="danger" body={error} testID="signin-error" /> : null}
            <Field label={t("signIn.email")} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" testID="signin-email" />
            {meta.login === "devlogin"
              ? <Field label={t("signIn.org")} value={org} onChangeText={setOrg} autoCapitalize="none" placeholder={t("signIn.orgHint")} testID="signin-org" />
              : <Field label={t("signIn.password")} value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" autoComplete="password" testID="signin-password" onSubmitEditing={() => valid && void submit()} />}
            {needMfa ? <Field label={t("signIn.mfa")} value={mfa} onChangeText={setMfa} keyboardType="number-pad" testID="signin-mfa" /> : null}
            <Button title={t("signIn.submit")} onPress={() => void submit()} loading={busy} disabled={!valid} testID="signin-submit" />
            <Button title={t("signIn.passport")} variant="secondary" disabled onPress={() => {}} icon="shield" />
            <T variant="caption" muted style={{ textAlign: "center" }}>{t("signIn.passportSoon")}</T>
          </Card>

          {__DEV__ ? (
            <Card style={{ gap: 10 }}>
              <Row style={{ justifyContent: "space-between" }}><T variant="small" weight="semibold">{t("signIn.demo")}</T><T variant="caption" muted>{t("signIn.demoHint")}</T></Row>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {DEMO_ACCOUNTS[product].filter((d) => (entry === "nurse" ? d.nurse : entry === "clinic" ? !d.nurse : true)).map((d) => (
                  <Chip key={d.email} testID={`demo-${d.email}`} label={`${d.label} · ${d.plan}`} onPress={() => { setEmail(d.email); setPassword(d.password ?? ""); setOrg(d.org ?? ""); haptic.tap(); }} />
                ))}
              </View>
            </Card>
          ) : null}
          <T variant="caption" muted style={{ textAlign: "center", color: accent }}>{isAr ? "كيورلي من كيوريكس" : "Kiorly by Kiorex"}</T>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
