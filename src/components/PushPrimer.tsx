import { useEffect, useState } from "react";
import { View } from "react-native";
import { useSegments } from "expo-router";
import { useTranslation } from "react-i18next";
import { useTheme } from "@/theme";
import { useSessions } from "@/auth/SessionProvider";
import { useLock } from "@/auth/lock";
import { loadPrimer, savePrimer, shouldShowPrimer, snoozePrimer, usePushPermission } from "@/lib/pushPermission";
import { Button, Row, Sheet, T } from "./ui";
import { Icon } from "./Icon";

const DELAY_MS = 2500;

/**
 * Short in-app explainer shown once, after the first useful screen (the tabs), before the OS permission prompt. "Not now" is remembered for 14 days.
 * Never blocks: it is a dismissible bottom sheet, absent when notifications are already allowed/denied, when the app is locked, or on web.
 */
export function PushPrimer() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const segments = useSegments();
  const { products } = useSessions();
  const lock = useLock();
  const { status, enable } = usePushPermission();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const inTabs = (segments as string[])[0] === "(tabs)";
  const eligible = products.length > 0 && inTabs && !lock.locked;

  useEffect(() => {
    if (!eligible || status == null || open) return;
    let live = true;
    const timer = setTimeout(() => { void loadPrimer().then((st) => { if (live && shouldShowPrimer(status, st)) { setOpen(true); void savePrimer({ shownAt: Date.now() }); } }); }, DELAY_MS);
    return () => { live = false; clearTimeout(timer); };
  }, [eligible, status, open]);

  const later = () => { setOpen(false); void snoozePrimer(); };
  const allow = async () => { setBusy(true); try { await enable(); } finally { setBusy(false); setOpen(false); } };
  const point = (icon: "shield" | "pill" | "flask", text: string) => (
    <Row gap={12} style={{ alignItems: "flex-start" }}>
      <View style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: colors.soft, alignItems: "center", justifyContent: "center" }}><Icon name={icon} size={18} color={colors.ink} /></View>
      <T style={{ flex: 1 }}>{text}</T>
    </Row>
  );
  return (
    <Sheet visible={open} onClose={later} title={t("pushPrompt.title")} testID="push-primer"
      footer={<View style={{ gap: 8 }}><Button testID="push-allow" title={t("pushPrompt.allow")} icon="bell" loading={busy} onPress={() => void allow()} /><Button testID="push-later" variant="secondary" title={t("pushPrompt.notNow")} onPress={later} /></View>}>
      <T muted>{t("pushPrompt.body")}</T>
      {point("shield", t("pushPrompt.pointCritical"))}
      {point("pill", t("pushPrompt.pointRx"))}
      {point("flask", t("pushPrompt.pointLab"))}
      <T variant="small" muted>{t("pushPrompt.footnote")}</T>
    </Sheet>
  );
}
