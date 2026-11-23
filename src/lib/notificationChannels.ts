// Android notification channels for Kiorly. The three product APIs name one of these ids per push (FCM android.notification.channel_id / Expo channelId)
// from the message kind: SAFETY -> "safety", CLINICAL -> "clinical", OPS -> "ops", anything else -> "default". Ids must stay in sync with the APIs'
// MobilePushService.channelFor. Safety alerts use MAX importance (heads-up, sound, bypass the quiet list as far as the OS allows); created before the
// Android 13 permission prompt.
export const NOTIFICATION_CHANNELS = [
  { id: "default", nameEn: "General", nameAr: "عام", importance: "DEFAULT" },
  { id: "safety", nameEn: "Safety alerts", nameAr: "تنبيهات السلامة", importance: "MAX" },
  { id: "clinical", nameEn: "Clinical updates", nameAr: "المستجدات السريرية", importance: "HIGH" },
  { id: "ops", nameEn: "Operations", nameAr: "العمليات", importance: "DEFAULT" },
] as const;
export type NotificationChannelId = (typeof NOTIFICATION_CHANNELS)[number]["id"];

type Notif = { setNotificationChannelAsync?: (id: string, c: never) => Promise<unknown>; AndroidImportance?: object };

/** Idempotent; a no-op off Android; never throws. */
export async function ensureNotificationChannels(os: string, Notifications: Notif, lang: "ar" | "en" = "en"): Promise<number> {
  if (os !== "android" || !Notifications.setNotificationChannelAsync) return 0;
  let n = 0;
  for (const c of NOTIFICATION_CHANNELS) {
    try {
      await Notifications.setNotificationChannelAsync(c.id, { name: lang === "ar" ? c.nameAr : c.nameEn, importance: (Notifications.AndroidImportance as Record<string, number> | undefined)?.[c.importance] ?? 3, vibrationPattern: [0, 250, 250, 250], lightColor: "#3730A3", showBadge: true } as never);
      n++;
    } catch { /* best effort */ }
  }
  return n;
}
