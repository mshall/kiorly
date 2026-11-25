/** G-16 strings of the "Save QR image" button (keys under `qrSave`), shared by the Clinic, Pharmacy and Lab Growth tabs. */
const en = { label: "Save QR image", shared: "QR image ready: choose Save Image", downloaded: "QR image downloaded", androidFallback: "Saving an image is not available here. Sharing the link instead.", failed: "Could not make the QR image. Try again." };
const ar: typeof en = { label: "حفظ صورة QR", shared: "صورة QR جاهزة: اختر حفظ الصورة", downloaded: "تم تنزيل صورة QR", androidFallback: "حفظ الصورة غير متاح هنا. سنشارك الرابط بدلًا من ذلك.", failed: "تعذر إنشاء صورة QR. حاول مرة أخرى." };
export const qrSaveStrings = { en: { qrSave: en } as Record<string, unknown>, ar: { qrSave: ar } as Record<string, unknown> };
