import type { Product } from "@/api/products";
import { routeForPush } from "@/modules/registry";

/**
 * One router for every notification, remote or local. The OS hands us `content.data` (the product push `data` object, e.g.
 * `{ template: "order.received", orderId }`); a remote push, a local dev-simulated notification and an in-app inbox tap all end up here.
 */
export type PushData = Record<string, unknown>;

export function routeForNotification(data: PushData | null | undefined, fallbackProduct?: Product): string | null {
  if (!data) return null;
  const s = (k: string) => (typeof data[k] === "string" ? (data[k] as string) : "");
  const tpl = (s("template") || s("templateId")).toLowerCase();
  const p = (["clinic", "pharmacy", "lab"].includes(s("product")) ? s("product") : fallbackProduct) as Product | undefined;
  if (/upgrade/.test(tpl) || (s("requestId") && s("featureKey"))) return p ? `/upgrade?product=${p}` : "/upgrade";
  const direct = p ? routeForPush(p, data) : null;
  if (direct) return direct;
  if (/sos|unsafe|missed|alert|critical|safety/.test(tpl) || s("alertId") || s("kind") === "SAFETY") return "/(tabs)/inbox";
  return null;
}

/** Dedupes the cold-start response against the live listener (the same tap can be reported by both). */
export function makeTapDeduper() {
  let last = "";
  return (id: string | undefined | null): boolean => { if (!id || id === last) return false; last = id; return true; };
}

export interface TestNotification { id: string; titleEn: string; titleAr: string; bodyEn: string; bodyAr: string; data: PushData }
/** Dev-only simulation fixtures. Same shapes the three product APIs send (demo seed values); the files in `e2e-push/` carry the same data as APNs payloads. */
export const TEST_NOTIFICATIONS: TestNotification[] = [
  { id: "lab-critical", titleEn: "Critical value: Potassium 6.9", titleAr: "قيمة حرجة: البوتاسيوم 6.9", bodyEn: "Order LAB-DEMO-0042 needs read-back now.", bodyAr: "الطلب LAB-DEMO-0042 يحتاج إلى تأكيد القراءة الآن.", data: { product: "lab", template: "CRITICAL_VALUE", criticalAlertId: "demo_ca_k_6_9", orderId: "demo_lab_order_42" } },
  { id: "sos", titleEn: "SOS from a home visit", titleAr: "نداء استغاثة من زيارة منزلية", bodyEn: "Nurse Heba pressed SOS at Nasr City.", bodyAr: "الممرضة هبة ضغطت زر الاستغاثة في مدينة نصر.", data: { product: "clinic", template: "sos", homeVisitId: "demo_hv_cp1_7", kind: "SAFETY" } },
  { id: "order-received", titleEn: "New Kiorex order", titleAr: "طلب كيوريكس جديد", bodyEn: "Order KX-1043 arrived. Respond within 15 minutes.", bodyAr: "وصل الطلب KX-1043. يرجى الرد خلال 15 دقيقة.", data: { product: "pharmacy", template: "order.received", orderId: "demo_kx_order_1043" } },
  { id: "upgrade-request", titleEn: "Staff asked to upgrade Kiorly", titleAr: "طلب موظف ترقية كيورلي", bodyEn: "A team member asked for the Kiorly staff app (Pro plan).", bodyAr: "طلب أحد أعضاء الفريق تطبيق كيورلي للموظفين (باقة Pro).", data: { product: "clinic", template: "upgrade.request", requestId: "demo_upg_1", featureKey: "mobile_staff_app", role: "NURSE" } },
];
