import { useState } from "react";
import { Switch, View } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/theme";
import { Badge, Banner, Button, Card, Row, Screen, T, useToast } from "@/components/ui";
import { Icon, type IconName } from "@/components/Icon";
import { ListRow, Segmented, SectionTitle, SyncChip } from "@/components/kit";
import { useSessions } from "@/auth/SessionProvider";
import { useLock } from "@/auth/lock";
import { PRODUCT_META, APP_VERSION, accentFor } from "@/api/products";
import { LanguageMenu } from "@/components/LanguageMenu";
import { BrandLockup } from "@/components/BrandLockup";
import { DevPushPanel } from "@/components/DevPushPanel";
import { usePushPermission } from "@/lib/pushPermission";
import { haptic } from "@/lib/haptics";
import { SignOutSheet, type SignOutTarget } from "@/components/SignOutSheet";
import { LiteBadge } from "@/components/lite";
import { isLite } from "@/lite/logic";

export default function Me() {
  const { t, i18n } = useTranslation();
  const { colors, scheme, pref, setPref } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();
  const { sessions, products } = useSessions();
  const lock = useLock();
  const [restart, setRestart] = useState(false);
  const [so, setSo] = useState<{ open: boolean; initial?: SignOutTarget }>({ open: false });
  const push = usePushPermission();
  const row = (icon: IconName, title: string, sub: string, to: string) => <ListRow icon={icon} title={title} subtitle={sub} onPress={() => router.push(to as never)} testID={`me-${to.slice(1)}`} />;

  return (
    <Screen style={{ paddingTop: insets.top + 8, gap: 12 }} title={t("me.title")} testID="me">
      <Button title={t("signOutDlg.open")} variant="secondary" icon="logout" onPress={() => setSo({ open: true })} testID="signout-top" accessibilityLabel={t("signOutDlg.open")} />
      <SectionTitle title={t("me.accounts")} />
      {products.map((p) => {
        const s = sessions[p]!; const b = s.bootstrap;
        return (
          <Card key={p} testID={`account-${p}`} style={{ gap: 10 }}>
            <Row gap={12}>
              <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: colors.subtle, alignItems: "center", justifyContent: "center" }}><Icon name={PRODUCT_META[p].icon} size={22} color={accentFor(p, scheme)} /></View>
              <View style={{ flex: 1 }}>
                <T weight="semibold">{s.userName}</T>
                <T variant="small" muted numberOfLines={1}>{t(PRODUCT_META[p].nameKey)} · {(i18n.language.startsWith("ar") && b?.org.nameAr) || b?.org.name} · {b?.user.role}</T>
              </View>
              <View style={{ alignItems: "flex-end", gap: 4 }}><Badge tone={b?.entitlement.enabled ? "success" : "warning"} label={b?.org.plan ?? "-"} /><LiteBadge product={p} /></View>
            </Row>
            {isLite(b) ? <Button small variant="secondary" icon="award" title={t("lite.meSee")} onPress={() => router.push(`/upgrade?product=${p}` as never)} testID={`lite-see-${p}`} /> : null}
            <Button small variant="secondary" title={t("me.signOut")} icon="logout" onPress={() => setSo({ open: true, initial: p })} testID={`signout-${p}`} />
          </Card>
        );
      })}
      <Button title={t("signIn.addAccount")} variant="secondary" icon="plus" onPress={() => router.push("/sign-in")} />

      <SectionTitle title={t("me.security")} />
      <Card style={{ gap: 12 }}>
        <Row style={{ justifyContent: "space-between" }} gap={12}>
          <Row gap={12} style={{ flex: 1 }}><Icon name="fingerprint" size={22} color={colors.ink} /><View style={{ flex: 1 }}><T weight="semibold">{t("me.lock")}</T><T variant="caption" muted>{lock.available ? t("me.lockHint") : t("me.lockUnavailable")}</T></View></Row>
          <Switch testID="lock-switch" value={lock.enabled} disabled={!lock.available} trackColor={{ true: colors.ink, false: colors.border }} onValueChange={async (v) => { const ok = await lock.setEnabled(v); if (!ok) toast.show(t("me.lockUnavailable"), "error"); }} />
        </Row>
        {lock.enabled ? (
          <Segmented value={String(lock.graceS)} onChange={(v) => lock.setGrace(Number(v))} options={[{ value: "0", label: t("me.immediately") }, { value: "30", label: t("me.seconds", { count: 30 }) }, { value: "300", label: t("me.seconds", { count: 300 }) }]} />
        ) : null}
      </Card>
      <SectionTitle title={t("pushPrompt.settingsTitle")} />
      <Card style={{ gap: 8 }} testID="me-notifications">
        <Row style={{ justifyContent: "space-between" }} gap={12}>
          <Row gap={12} style={{ flex: 1 }}>
            <Icon name="bell" size={22} color={colors.ink} />
            <View style={{ flex: 1 }}>
              <T weight="semibold">{t("pushPrompt.settingsRow")}</T>
              <T variant="caption" muted>{push.status === "granted" ? t("pushPrompt.stateOn") : push.status === "denied" ? t("pushPrompt.stateDenied") : push.status === "unsupported" ? t("pushPrompt.stateUnsupported") : t("pushPrompt.stateOff")}</T>
            </View>
          </Row>
          <Switch testID="push-switch" value={push.status === "granted"} disabled={push.status == null || push.status === "unsupported"} trackColor={{ true: colors.ink, false: colors.border }}
            onValueChange={async () => { await push.enable(); void push.refresh(); }} accessibilityLabel={t("pushPrompt.settingsRow")} />
        </Row>
        {push.status === "granted" || push.status === "denied" ? <Button small variant="secondary" title={t("pushPrompt.openSettings")} onPress={() => void push.openSettings()} testID="push-open-settings" /> : null}
      </Card>
      {__DEV__ ? <DevPushPanel /> : null}
      {row("device", t("me.devices"), t("me.devicesHint"), "/devices")}

      <SectionTitle title={t("me.preferences")} />
      <Card style={{ gap: 12 }}>
        <LanguageMenu variant="row" onChanged={setRestart} testID="me-language" />
        {restart ? <Banner tone="ink" body={t("me.restartHint")} /> : null}
        <T variant="small" weight="semibold">{t("me.theme")}</T>
        <Segmented value={pref} onChange={setPref} options={[{ value: "light", label: t("me.light") }, { value: "dark", label: t("me.dark") }, { value: "system", label: t("me.system") }]} testID="theme" accessibilityLabel={t("me.theme")} />
      </Card>
      <Row style={{ justifyContent: "space-between" }}><T variant="small" weight="semibold">{t("me.sync")}</T><SyncChip onPress={() => router.push("/sync")} /></Row>
      {row("sync", t("me.sync"), t("me.syncHint"), "/sync")}

      <Button title={products.length > 1 ? t("me.signOutAll") : t("signOutDlg.open")} variant="danger" icon="logout" onPress={() => setSo({ open: true, initial: products.length > 1 ? "all" : products[0] })} testID="signout-all" />
      <SignOutSheet visible={so.open} initial={so.initial} onClose={() => setSo({ open: false })} />
      <SectionTitle title={t("me.about")} />
      <Card style={{ gap: 4 }} testID="me-about">
        <View style={{ marginBottom: 8 }}><BrandLockup height={40} /></View>
        <T weight="semibold" testID="about-name">{t("app.name")}</T>
        <T variant="caption" muted testID="about-by">{t("app.by")}</T>
        <T variant="caption" muted>{t("me.version", { v: APP_VERSION })}</T>
      </Card>
      <View style={{ alignItems: "center", gap: 4, paddingVertical: 8 }}>
        <T variant="caption" muted style={{ textAlign: "center" }}>{t("me.privacy")}</T>
      </View>
    </Screen>
  );
}
