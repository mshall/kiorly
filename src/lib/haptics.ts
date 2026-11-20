// Haptic feedback (expo-haptics). No-op on web and never throws; respects nothing but the platform setting.
import { Platform } from "react-native";
import * as Haptics from "expo-haptics";

const on = Platform.OS === "ios" || Platform.OS === "android";
const safe = (fn: () => Promise<void>) => { if (!on) return; try { void fn().catch(() => {}); } catch { /* ignore */ } };

export const haptic = {
  tap: () => safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
  press: () => safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)),
  select: () => safe(() => Haptics.selectionAsync()),
  success: () => safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
  warn: () => safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)),
  error: () => safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)),
};
