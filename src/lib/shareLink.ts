import { Linking, Platform, Share } from "react-native";
import { smsUrl, whatsappUrl } from "@/modules/clinic/growth";

/** Copy to the clipboard where the platform allows it without a native module (web). On iOS/Android the share sheet carries "Copy". */
export async function copyText(text: string): Promise<boolean> {
  if (Platform.OS !== "web") return false;
  try {
    const nav = (globalThis as { navigator?: { clipboard?: { writeText(t: string): Promise<void> } } }).navigator;
    if (!nav?.clipboard) return false;
    await nav.clipboard.writeText(text);
    return true;
  } catch { return false; }
}

export type ShareOutcome = "shared" | "copied" | "dismissed" | "failed";

/** Native share sheet (WhatsApp, SMS, Copy, ... are in it). On web: Web Share when present, otherwise the clipboard. */
export async function shareLink(message: string, url: string): Promise<ShareOutcome> {
  try {
    if (Platform.OS === "web") {
      const nav = (globalThis as { navigator?: { share?: (d: { text: string; url: string }) => Promise<void> } }).navigator;
      if (nav?.share) { await nav.share(url ? { text: message, url } : ({ text: message } as { text: string; url: string })); return "shared"; }
      return (await copyText(url || message)) ? "copied" : "failed";
    }
    const r = await Share.share({ message });
    return r.action === Share.dismissedAction ? "dismissed" : "shared";
  } catch { return "failed"; }
}

async function open(url: string): Promise<boolean> {
  try {
    if (Platform.OS === "web") { (globalThis as { open?: (u: string, t: string, f: string) => unknown }).open?.(url, "_blank", "noopener,noreferrer"); return true; }
    await Linking.openURL(url);
    return true;
  } catch { return false; }
}
export const openWhatsapp = (message: string) => open(whatsappUrl(message));
export const openSms = (message: string) => open(smsUrl(message));
export const openWeb = (url: string) => open(url);
