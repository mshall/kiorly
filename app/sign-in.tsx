import { useEffect, useRef, useState } from "react";
import { KeyboardAvoidingView, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { layeredShadow, radii, space, useTheme } from "@/theme";
import { Banner, Button, Field, T } from "@/components/ui";
import { Segmented } from "@/components/kit";
import { Icon } from "@/components/Icon";
import { BrandHeader } from "@/components/BrandHeader";
import { LanguageMenu } from "@/components/LanguageMenu";
import { PRODUCT_META, SIGN_IN_ENTRIES, accentFor, productOf, type Product, type SignInEntry } from "@/api/products";
import { useSessions } from "@/auth/SessionProvider";
import { PASSPORT_ENABLED, PassportError, discover, passportFailureKind } from "@/auth/passport";
import { initialSignInEntry, initialSignInMethod, loadSignInEntry, loadSignInMethod, rememberSignInEntry, rememberSignInMethod, type SignInMethod } from "@/auth/signInMethod";
import { ApiError } from "@/api/errors";
import { haptic } from "@/lib/haptics";


export default function SignIn() {
  const { t, i18n } = useTranslation();
  const { colors, scheme } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { signIn, signInPassport, products } = useSessions();
  const [entry, setEntry] = useState<SignInEntry>(() => initialSignInEntry(SIGN_IN_ENTRIES, "clinic"));
  useEffect(() => { let on = true; void loadSignInEntry(SIGN_IN_ENTRIES, "clinic").then((e) => { if (on) setEntry(e); }); return () => { on = false; }; }, []);
  const product: Product = productOf(entry);
  const [email, setEmail] = useState(""); const [password, setPassword] = useState(""); const [org, setOrg] = useState("");
  const [mfa, setMfa] = useState(""); const [needMfa, setNeedMfa] = useState(false);
  // Android Custom Tab closed without a redirect: shown as a message with Try again / Choose another product (never a silent return to this screen)
  const [dismissed, setDismissed] = useState(false);
  const scrollRef = useRef<{ scrollTo: (o: { y: number; animated?: boolean }) => void } | null>(null); const gridY = useRef(0);
  const [busy, setBusy] = useState(false); const [busyPassport, setBusyPassport] = useState(false); const [error, setError] = useState<string | null>(null);
  const meta = PRODUCT_META[product];
  // Two methods only: Kiorex Passport (default) and Password. The last method that signed this device in is preselected (falls back to Passport).
  const [method, setMethod] = useState<SignInMethod>(() => initialSignInMethod(PASSPORT_ENABLED));
  useEffect(() => { let on = true; void loadSignInMethod(PASSPORT_ENABLED).then((m) => { if (on) setMethod(m); }); return () => { on = false; }; }, []);
  const showPassport = PASSPORT_ENABLED && method === "passport";
  // warm the Passport discovery cache so the browser step opens straight from the tap (web popup blockers want it inside the user gesture)
  useEffect(() => { if (PASSPORT_ENABLED) void discover().catch(() => {}); }, []);

  const submit = async () => {
    setError(null); setBusy(true);
    try {
      const b = await signIn(product, { email, password, org, mfaCode: mfa || undefined });
      haptic.success(); void rememberSignInMethod("password"); void rememberSignInEntry(entry);
      router.replace(b.entitlement.enabled ? (entry === "nurse" ? "/clinic/rounds" : "/(tabs)") as never : (`/upgrade?product=${product}` as never));
    } catch (e) {
      haptic.error();
      const err = e as ApiError;
      if (err.code === "MFA_REQUIRED" || err.code === "MFA_CODE_REQUIRED") { setNeedMfa(true); setError(t("signIn.mfa")); }
      else setError(err.isNetwork ? t("signIn.network") : err.status === 401 || err.status === 400 || err.status === 404 ? t("signIn.invalid") : err.message);
    } finally { setBusy(false); }
  };
  const submitPassport = async () => {
    setError(null); setDismissed(false); setBusyPassport(true);
    try {
      const b = await signInPassport(product, i18n.language);
      haptic.success(); void rememberSignInMethod("passport"); void rememberSignInEntry(entry);
      router.replace(b.entitlement.enabled ? (entry === "nurse" ? "/clinic/rounds" : "/(tabs)") as never : (`/upgrade?product=${product}` as never));
    } catch (e) {
      if (e instanceof PassportError) {
        if (e.code === "cancelled") { setError(null); if (e.detail === "dismiss") setDismissed(true); }
        else { haptic.error(); setError(e.code === "network" ? t("signIn.passportNetwork") : t("signIn.passportFailed")); }
      } else {
        haptic.error();
        const err = e as ApiError; const name = t(PRODUCT_META[product].nameKey);
        if (err.isNetwork) setError(t("signIn.network"));
        else { const k = passportFailureKind(err.status, err.code); setError(k === "not_linked" ? t("signIn.passportNotLinked", { product: name }) : k === "not_supported" ? t("signIn.passportUnsupported", { product: name }) : err.message); }
      }
    } finally { setBusyPassport(false); }
  };
  const valid = meta.login === "devlogin" ? email.includes("@") && org.length > 1 : email.includes("@") && password.length > 0;

  const tint = scheme === "dark" ? "rgba(139,133,240,0.14)" : "rgba(55,48,163,0.07)";
  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.ground }} behavior="padding" /* Android 15 is edge-to-edge: the window no longer resizes for the keyboard, so pad on both platforms */>
      {/* the only decoration: a whisper of indigo at the very top of the screen, fading to the ground colour (no banner) */}
      <LinearGradient pointerEvents="none" aria-hidden colors={[tint, "rgba(0,0,0,0)"]} style={{ position: "absolute", top: 0, left: 0, right: 0, height: 280 }} />
      <ScrollView ref={scrollRef as never} keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1 }} showsVerticalScrollIndicator={false}>
        <BrandHeader testID="signin-header" lockupTestID="brand-lockup"><LanguageMenu testID="language-menu" /></BrandHeader>

        <View style={{ paddingHorizontal: 24, paddingTop: space[5], paddingBottom: space[4], gap: space[2] }}>
          <T variant="display" accessibilityRole="header" testID="signin-title">{t("signIn.title")}</T>
          <T variant="small" color={colors.muted} testID="brand-tagline">{t("app.tagline")}</T>
        </View>

        <View style={{ marginHorizontal: space[4], marginBottom: space[4], padding: space[5], gap: space[4], borderRadius: radii.xl, backgroundColor: colors.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, ...layeredShadow(scheme) }} testID="signin-card">
          <T variant="label" muted>{t("signIn.subtitle")}</T>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }} testID="product-grid" accessibilityRole="radiogroup" onLayout={(ev) => { gridY.current = ev.nativeEvent.layout.y; }}>
            {SIGN_IN_ENTRIES.map((e) => {
              const p = productOf(e); const sel = e === entry; const a = accentFor(p, scheme); const done = products.includes(p);
              return (
                <Pressable key={e} testID={`product-${e}`} onPress={() => { haptic.select(); setEntry(e); setError(null); setDismissed(false); setNeedMfa(false); }} accessibilityRole="radio" accessibilityState={{ selected: sel, checked: sel }}
                  accessibilityLabel={`${t(e === "nurse" ? "product.nurse" : PRODUCT_META[p].nameKey)}${done ? `, ${t("signIn.connected")}` : ""}`}
                  style={({ pressed }) => ({ flexGrow: 1, flexBasis: "45%", minWidth: 120, minHeight: 64, borderRadius: radii.lg, paddingHorizontal: space[3], paddingVertical: space[2], flexDirection: "row", alignItems: "center", gap: space[3], borderWidth: 1.5, borderColor: sel ? colors.ink : colors.border, backgroundColor: sel ? colors.soft : pressed ? colors.raised : colors.surface })}>
                  <Icon name={e === "nurse" ? "heart" : PRODUCT_META[p].icon} size={24} color={a} />
                  <View style={{ flex: 1 }}>
                    <T variant="small" weight="semibold" numberOfLines={1}>{t(e === "nurse" ? "product.nurse" : PRODUCT_META[p].nameKey)}</T>
                    {done ? <T variant="caption" color={colors.success}>{t("signIn.connected")}</T> : null}
                  </View>
                  {sel ? <View aria-hidden style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: colors.ink, alignItems: "center", justifyContent: "center" }}><Icon name="check" size={12} color={colors.onInk} /></View> : null}
                </Pressable>
              );
            })}
          </View>
          {entry === "nurse" ? <T variant="caption" muted testID="nurse-hint">{t("signIn.nurseHint")}</T> : null}
          {PASSPORT_ENABLED ? (
            <Segmented testID="signin-method" accessibilityLabel={t("signIn.method")} value={method} onChange={(m) => { setMethod(m); setError(null); setNeedMfa(false); }}
              options={[{ value: "passport", label: t("signIn.methodPassport") }, { value: "password", label: t("signIn.methodPassword") }]} />
          ) : null}
          {error ? <Banner tone="danger" body={error} testID="signin-error" /> : null}
          {dismissed && !error ? (
            <Banner tone="warning" title={t("signIn.passportDismissedTitle")} body={t("signIn.passportDismissed", { product: t(entry === "nurse" ? "product.nurse" : meta.nameKey) })} testID="signin-dismissed">
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space[2], marginTop: space[2] }}>
                <Button small title={t("signIn.tryAgain")} icon="shield" onPress={() => void submitPassport()} testID="signin-retry" />
                <Button small variant="secondary" title={t("signIn.chooseProduct")} onPress={() => { haptic.select(); setDismissed(false); scrollRef.current?.scrollTo({ y: Math.max(0, gridY.current - 16), animated: true }); }} testID="signin-choose-product" />
              </View>
            </Banner>
          ) : null}
          {showPassport ? (
            <View style={{ gap: space[3] }} testID="signin-passport-panel">
              <Button title={t("signIn.passport")} onPress={() => void submitPassport()} loading={busyPassport} icon="shield" testID="signin-passport" />
              <T variant="caption" muted style={{ textAlign: "center" }}>{t("signIn.passportHint")}</T>
            </View>
          ) : (
            <View style={{ gap: space[4] }} testID="signin-password-panel">
              <Field label={t("signIn.email")} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" testID="signin-email" />
              {meta.login === "devlogin"
                ? <Field label={t("signIn.org")} value={org} onChangeText={setOrg} autoCapitalize="none" placeholder={t("signIn.orgHint")} testID="signin-org" />
                : <Field label={t("signIn.password")} value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" autoComplete="password" testID="signin-password" onSubmitEditing={() => valid && void submit()} />}
              {needMfa ? <Field label={t("signIn.mfa")} value={mfa} onChangeText={setMfa} keyboardType="number-pad" testID="signin-mfa" /> : null}
              <Button title={t("signIn.submit")} onPress={() => void submit()} loading={busy} disabled={!valid} testID="signin-submit" />
            </View>
          )}
        </View>

        <View style={{ height: insets.bottom + space[5] }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
