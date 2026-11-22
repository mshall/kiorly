import { useState } from "react";
import { View } from "react-native";
import { useTranslation } from "react-i18next";
import { Button, Card, T, useToast } from "@/components/ui";
import { TEST_NOTIFICATIONS } from "@/lib/notifications";
import { scheduleTestNotification, useLastSeen, usePushDiag } from "@/lib/push";
import { readPushStatus, requestPushPermission } from "@/lib/pushPermission";

/** DEV BUILDS ONLY (rendered under `__DEV__` in Me > Notifications). English on purpose: it is a developer tool, not product copy. */
export function DevPushPanel() {
  const { i18n } = useTranslation();
  const toast = useToast();
  const diag = usePushDiag();
  const seen = useLastSeen();
  const [busy, setBusy] = useState(false);
  const send = async (idx: number) => {
    setBusy(true);
    try {
      if ((await readPushStatus()) !== "granted" && (await requestPushPermission()) !== "granted") { toast.show("Notification permission is needed first", "error"); return; }
      await scheduleTestNotification(TEST_NOTIFICATIONS[idx], i18n.language, 3);
      toast.show("Scheduled in 3 s: background the app or stay here, then tap it", "info");
    } catch (e) { toast.show(String((e as Error)?.message ?? e), "error"); } finally { setBusy(false); }
  };
  return (
    <Card style={{ gap: 8 }} testID="dev-push-panel">
      <T variant="small" weight="semibold">Dev: send test notification (local)</T>
      {TEST_NOTIFICATIONS.map((n, i) => <Button key={n.id} small variant="secondary" title={n.titleEn} disabled={busy} onPress={() => void send(i)} testID={`dev-push-${n.id}`} />)}
      <T variant="caption" muted testID="dev-push-token">{`token: ${diag.provider} ${diag.reason}${diag.token ? ` ${diag.token}` : ""}`}</T>
      {diag.message ? <T variant="caption" muted testID="dev-push-message">{diag.message}</T> : null}
      {seen ? <View><T variant="caption" muted testID="dev-push-last">{`last ${seen.kind}: ${seen.route ?? "no route"} ${JSON.stringify(seen.data ?? {})}`}</T></View> : null}
    </Card>
  );
}
