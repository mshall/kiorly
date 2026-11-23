# Store listing (DRAFT, rewritten 23 Nov 2026)

> DRAFT. Arabic text was rewritten for the Egyptian market in Modern Standard Arabic but has **not** had a native-speaker review (NEEDS_HUMAN, see [NEEDS_HUMAN.md](NEEDS_HUMAN.md)). Source of truth for every string below is [store-copy.json](store-copy.json); `node Docs/scripts/check-store-limits.mjs` checks store length limits and that this file matches the JSON.

Final name: **Kiorly** (founder decision 23 Nov 2026, ADR-037). Registration with Apple and Google is NEEDS_HUMAN.

## Fields

| Field | English | Arabic |
|---|---|---|
| Display name (icon label) | Kiorly | كيورلي |
| Store title (max 30, both stores) | Kiorly: Clinic, Pharmacy & Lab | كيورلي: عيادة وصيدلية ومعمل |
| iOS subtitle (max 30) | For clinics, pharmacies & labs | للعيادات والصيدليات والمعامل |
| Play short description (max 80) | Staff app for clinics, pharmacies and labs: schedules, scans and safety alerts. | تطبيق موظفي العيادات والصيدليات والمعامل: جدول العمل والمسح وتنبيهات السلامة. |
| iOS keywords (max 100, comma separated) | nurse,doctor,staff,patients,prescription,scanner,barcode,home visit,dispense,results,medical,alerts | تمريض,طبيب,موظفين,مرضى,وصفة طبية,باركود,زيارة منزلية,صرف,نتائج,تحاليل,تنبيهات,طبي |
| Bundle id / package | `com.kiorly.app` | |
| Category | Medical (primary), Business (secondary) | |
| Marketing URL | https://kiorly.com/app | |
| Support URL / email | https://kiorly.com/support, support@kiorly.com | |
| Privacy policy URL | https://kiorly.com/privacy | |

Notes:
- **Subtitle change.** The earlier subtitle "For clinics, pharmacies and labs" is 32 characters, over the 30 limit. "&" replaces "and" so it fits exactly (30). The Arabic subtitle fits as is.
- **Arabic title.** The earlier Arabic title with the definite articles is 33 characters, over the limit; the indefinite form is 27.
- Play uses its own short description (80) because the 30-character subtitle is too tight for it.
- Keywords leave out words already in the title (clinic, pharmacy, lab and the Arabic equivalents) because both stores index the title. Google Play has no keyword field.
- "by Kiorex" appears only on the splash screen and the About card inside the app, never in the icon label, store name, subtitle or keywords (the check script enforces this for those fields).

## Description (English)

Kiorly is the staff app for clinics, pharmacies and labs that run on Kiorly. One sign-in, four workplaces: Clinic, Nurse, Pharmacy and Lab.

CLINIC
- Today's schedule and your patients
- Vitals, visit notes and prescriptions
- Check-in and billing summaries

NURSE
- Home-visit rounds and check-in at the door
- Vitals recorded at the bedside
- A safety button that alerts your team

PHARMACY
- Verify and dispense prescriptions
- Scan stock and watch expiry dates and recalled lots
- Countersign controlled drugs as the second witness

LAB
- Sample collection rounds with barcode scanning
- Results awaiting validation
- Critical-value and turnaround alerts

BUILT FOR WORK ON THE MOVE
- Safety alerts reach everyone on every plan
- Sign in with Kiorex Passport or your workplace login
- Lock the app with Face ID or fingerprint
- Keep working offline and sync when you are back online
- Sign out any device remotely
- Arabic and English with full right-to-left support

WHO IT IS FOR
Kiorly is for staff of organisations that already use Kiorly Clinic, Kiorly Pharmacy or Kiorly Lab. The staff app is included from the Pro plan. Accounts are created by your organisation's owner, so there is no public sign-up. Questions: support@kiorly.com

## الوصف (Arabic)

كيورلي هو تطبيق الموظفين للعيادات والصيدليات والمعامل التي تعمل بنظام كيورلي. تسجيل دخول واحد يفتح لك أربع بيئات عمل: العيادة والتمريض والصيدلية والمعمل.

العيادة
- جدول اليوم ومرضاك
- العلامات الحيوية وملاحظات الزيارة والوصفات الطبية
- تسجيل وصول المرضى وملخصات الفواتير

التمريض
- جولات الزيارات المنزلية وتسجيل الوصول عند الباب
- تسجيل العلامات الحيوية بجانب المريض
- زر أمان ينبّه فريقك فورًا

الصيدلية
- مراجعة الوصفات الطبية وصرفها
- مسح المخزون ومتابعة تواريخ الصلاحية والدفعات المسحوبة
- التوقيع كشاهد ثانٍ على صرف الأدوية المراقبة

المعمل
- جولات سحب العينات مع مسح الباركود
- النتائج المنتظرة للاعتماد
- تنبيهات القيم الحرجة وزمن إنجاز التحاليل

مصمم للعمل أثناء التنقل
- تنبيهات السلامة تصل إلى الجميع في كل الباقات
- سجّل الدخول عبر كيوريكس باسبورت أو بحساب مكان عملك
- أقفل التطبيق ببصمة الوجه أو بصمة الإصبع
- واصل عملك دون اتصال، وتتم المزامنة عند عودة الإنترنت
- سجّل خروج أي جهاز عن بُعد
- متوفر بالعربية والإنجليزية مع دعم كامل للكتابة من اليمين إلى اليسار

لمن هذا التطبيق؟
كيورلي مخصص لموظفي المؤسسات التي تستخدم كيورلي للعيادات أو كيورلي للصيدليات أو كيورلي للمعامل. تطبيق الموظفين مشمول ابتداءً من الباقة الاحترافية. يُنشئ مالك مؤسستك الحسابات، ولذلك لا يوجد تسجيل عام. للاستفسار: support@kiorly.com

## What is new (1.0)

EN: First release of Kiorly: the staff app for clinics, pharmacies and labs, in Arabic and English.

AR: الإصدار الأول من كيورلي: تطبيق الموظفين للعيادات والصيدليات والمعامل، بالعربية والإنجليزية.

## Review notes
See [STORE_RELEASE.md](STORE_RELEASE.md) (demo accounts, permissions) and [STORE_DECLARATIONS.md](STORE_DECLARATIONS.md) (privacy, data safety, rating, screenshots). Legal pages: [store-pages/](store-pages/index.html), all marked DRAFT - counsel review required.
