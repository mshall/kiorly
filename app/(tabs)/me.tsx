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
import { setLanguage, type Lang } from "@/i18n";
import { haptic } from "@/lib/haptics";
import { LiteBadge } from "@/components/lite";
import { isLite } from "@/lite/logic";

export default function Me() {
  const { t, i18n } = useTranslation();
  const { colors, scheme, pref, setPref } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();
  const { sessions, products, signOut, signOutAll } = useSessions();
  const lock = useLock();
  const [restart, setRestart] = useState(false);
  const lang = (i18n.language.startsWith("ar") ? "ar" : "en") as Lang;
  const row = (icon: IconName, title: string, sub: string, to: string) => <ListRow icon={icon} title={title} subtitle={sub} onPress={() => router.push(to as never)} testID={`me-${to.slice(1)}`} />;

  return (
    <Screen style={{ paddingTop: insets.top + 8, gap: 12 }} title={t("me.title")} testID="me">
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
            <Button small variant="secondary" title={t("me.signOut")} onPress={() => void signOut(p)} testID={`signout-${p}`} />
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
      {row("device", t("me.devices"), t("me.devicesHint"), "/devices")}

      <SectionTitle title={t("me.preferences")} />
      <Card style={{ gap: 12 }}>
        <T variant="small" weight="semibold">{t("me.language")}</T>
        <Segmented value={lang} onChange={async (l) => { haptic.tap(); setRestart(await setLanguage(l)); }} options={[{ value: "ar", label: t("me.arabic") }, { value: "en", label: t("me.english") }]} />
        {restart ? <Banner tone="ink" body={t("me.restartHint")} /> : null}
        <T variant="small" weight="semibold">{t("me.theme")}</T>
        <Segmented value={pref} onChange={setPref} options={[{ value: "system", label: t("me.system") }, { value: "light", label: t("me.light") }, { value: "dark", label: t("me.dark") }]} />
      </Card>
      <Row style={{ justifyContent: "space-between" }}><T variant="small" weight="semibold">{t("me.sync")}</T><SyncChip onPress={() => router.push("/sync")} /></Row>
      {row("sync", t("me.sync"), t("me.syncHint"), "/sync")}

      <Button title={t("me.signOutAll")} variant="danger" onPress={() => void signOutAll().then(() => router.replace("/sign-in"))} testID="signout-all" />
      <View style={{ alignItems: "center", gap: 4, paddingVertical: 8 }}>
        <T variant="caption" muted>{t("app.name")} · {t("me.version", { v: APP_VERSION })}</T>
        <T variant="caption" muted style={{ textAlign: "center" }}>{t("me.privacy")}</T>
      </View>
    </Screen>
  );
}
