/** Shared builder of the Pharmacy and Lab Growth strings (GRW-P4-B3). Each product file passes its own nouns; Arabic is the default language of the app. Plain Kiorly wording: never a price, a discount, a health claim or a promise of fees. */
type Nouns = { en: { unit: string; units: string; place: string; counter: string }; ar: { unit: string; units: string; place: string; counter: string } };
type Dict = Record<string, unknown>;

export function partnerGrowthStrings(n: Nouns): { en: Dict; ar: Dict } {
  const en = {
    title: "Growth",
    intro: `Share your own Kiorex link and QR code, and see how many ${n.en.units} it brings. Counts only.`,
    readOnly: "Your role can view links and share them. Creating or pausing links is for owners and managers.",
    profile: { title: "Your Kiorex page", share: "Share", whatsapp: "WhatsApp", sms: "SMS", copy: "Copy", qr: "Show QR", copied: "Copied", shareFailed: "Could not share. Copy the link instead.", none: "Create your first link below to get a shareable page." },
    qr: { title: "QR code", hint: `Print it for your ${n.en.counter} or show it on the phone.`, loading: "Loading the QR code", forLink: "QR code for {{name}}" },
    links: {
      title: "Your links", create: "New link", createTitle: "Create a link", label: "Name", labelHint: `For example: ${n.en.counter}`, channel: "Where will you use it?", save: "Create",
      channelKind: { WHATSAPP_SHARE: "WhatsApp", QR_DESK: `QR for the ${n.en.counter}`, SOCIAL: "Social media", WEB_LINK: "Website", QR_POSTER: "Poster", SMS: "SMS", EMAIL_SIG: "E-mail", GOOGLE_PROFILE: "Google profile" },
      scope: { ORG: "Whole organisation", BRANCH: n.en.place, DESK: n.en.counter },
      empty: "No links yet.", emptyHint: "Create one to start counting visits and orders.", plan: "{{used}} of {{max}} active links used", visits: "Visits", orders: n.en.units[0].toUpperCase() + n.en.units.slice(1), completed: "Completed",
      last30: "Last 30 days", active: "Active", pausedBadge: "Paused", pause: "Pause link", resume: "Resume link", paused: "Link paused", resumed: "Link resumed", created: "Link created",
      limitReached: "Your plan's link limit is reached. Pause a link or ask Kiorly about a larger plan.", needsOnline: "This needs a connection.", actionsTitle: "Link",
    },
    perf: {
      title: "Last 30 days", none: `No ${n.en.units} from Kiorex yet.`, fromLinks: "From your links", fromKiorex: "Found you on Kiorex", orders: n.en.units[0].toUpperCase() + n.en.units.slice(1), completed: "Completed",
      share: `{{percent}}% of your Kiorex ${n.en.units} came from your own links.`, conversion: `Visit to ${n.en.unit}`, pending: `${n.en.units[0].toUpperCase() + n.en.units.slice(1)} from your links appear here once Kiorex sends the source of each one.`,
      note: "Counts only. No customer names, no amounts.",
    },
    recs: {
      title: "Suggestions", CREATE_FIRST_LINK: "Create your first link and share it with your customers.", PRINT_COUNTER_CARD: `Print the QR card for your ${n.en.counter}.`,
      BRANCH_NOT_LISTED: "{{count}} of your places are not listed on Kiorex yet. Connect them from the web workspace.", LINKS_UNUSED: "{{count}} links had no visits. Share them again or pause them.",
      HIGH_REJECTION: "About {{percent}}% of your Kiorex orders were rejected or cancelled. Check stock and opening hours on the web workspace.",
    },
    statement: { title: "Fee statement", none: "No commission configured." },
    commission: {
      rate: {
        title: "Your commission rate", hint: "Kiorex sets this rate. You can see it here but not change it. Each Kiorex order keeps the rate that applied when it was recorded.",
        notSet: "Rate not set", notSetHint: "No rate is configured yet, so no Kiorex commission is charged. Kiorex finance sets the rate.",
        sourceOVERRIDE: "Own rate agreed for you", sourceDEFAULT: "Default rate",
        counselLabel: "Kiorex funds-flow review", counsel: { NOT_REVIEWED: "Not reviewed yet", APPROVED_WITH_CONDITIONS: "Approved with conditions", APPROVED: "Approved", REJECTED: "Not approved" },
        rateDisclosure: "Rate disclosure", termsSummary: "Commission terms summary",
      },
      percentOf: "{{pct}} of the fee", flatPer: "{{amount}} per charge", min: "min", max: "max",
      stmt: {
        title: "Settlement statement", prev: "Previous month", next: "Next month",
        notConnected: "The Kiorex statement is not connected in this environment.",
        source: "These are the same figures Kiorex finance sees for your organization.",
        bankOnly: "Payouts are made by bank transfer to your bank account only. Kiorex never holds or pays out cash: any commission on a cash payment is accrued and netted in your next settlement.",
        reconciliation: "Reconciliation", recon: { MATCHED: "Matched", UNMATCHED: "Unmatched", DISPUTED: "Disputed", NO_PAYOUT: "No payout in this month" },
        cOnline: "Online collections", cCashAccrued: "Cash commission accrued", cCashNetted: "Cash commission netted", cCashOpen: "Cash commission still open",
        cDedCommission: "Deduction: commission", cDedFees: "Deduction: fees", cDedRefunds: "Deduction: refunds", cDedChargebacks: "Deduction: chargebacks", cNet: "Net payable", cPaid: "Paid by bank transfer",
        payouts: "Payouts", noPayouts: "No payout in this month.", colDeducted: "Commission kept",
      },
    },
    notConnected: { title: "Not connected to Kiorex", body: "Connect your account to Kiorex from the web workspace to use links and QR codes." },
    notAllowed: "Your role does not have the Growth tab.",
    web: { hint: "Posters, printable cards and the full workspace are on the web.", open: "Open the web workspace" },
    offline: "Showing the last saved copy.",
  };
  const ar = {
    title: "النمو",
    intro: `شارك رابطك ورمز QR الخاصين بك على كيوريكس، وشاهد عدد ${n.ar.units} التي يجلبها. أعداد فقط.`,
    readOnly: "دورك يتيح عرض الروابط ومشاركتها. إنشاء الروابط أو إيقافها للمالك والمديرين.",
    profile: { title: "صفحتك على كيوريكس", share: "مشاركة", whatsapp: "واتساب", sms: "رسالة", copy: "نسخ", qr: "عرض QR", copied: "تم النسخ", shareFailed: "تعذرت المشاركة. انسخ الرابط بدلًا من ذلك.", none: "أنشئ أول رابط أدناه للحصول على صفحة قابلة للمشاركة." },
    qr: { title: "رمز QR", hint: `اطبعه لـ${n.ar.counter} أو اعرضه على الهاتف.`, loading: "جارٍ تحميل رمز QR", forLink: "رمز QR لـ {{name}}" },
    links: {
      title: "روابطك", create: "رابط جديد", createTitle: "إنشاء رابط", label: "الاسم", labelHint: `مثال: ${n.ar.counter}`, channel: "أين ستستخدمه؟", save: "إنشاء",
      channelKind: { WHATSAPP_SHARE: "واتساب", QR_DESK: `QR لـ${n.ar.counter}`, SOCIAL: "وسائل التواصل", WEB_LINK: "الموقع", QR_POSTER: "ملصق", SMS: "رسالة", EMAIL_SIG: "البريد الإلكتروني", GOOGLE_PROFILE: "ملف جوجل" },
      scope: { ORG: "المؤسسة كلها", BRANCH: n.ar.place, DESK: n.ar.counter },
      empty: "لا توجد روابط بعد.", emptyHint: "أنشئ رابطًا لبدء عدّ الزيارات والطلبات.", plan: "تم استخدام {{used}} من {{max}} رابط نشط", visits: "الزيارات", orders: n.ar.units, completed: "المكتملة",
      last30: "آخر 30 يومًا", active: "نشط", pausedBadge: "موقوف", pause: "إيقاف الرابط", resume: "استئناف الرابط", paused: "تم إيقاف الرابط", resumed: "تم استئناف الرابط", created: "تم إنشاء الرابط",
      limitReached: "وصلت إلى حد الروابط في باقتك. أوقف رابطًا أو اسأل كيورلي عن باقة أكبر.", needsOnline: "يتطلب هذا اتصالًا بالإنترنت.", actionsTitle: "الرابط",
    },
    perf: {
      title: "آخر 30 يومًا", none: `لا ${n.ar.units} عبر كيوريكس بعد.`, fromLinks: "من روابطك", fromKiorex: "وجدك على كيوريكس", orders: n.ar.units, completed: "المكتملة",
      share: `{{percent}}% من ${n.ar.units} كيوريكس جاءت من روابطك.`, conversion: `من الزيارة إلى ${n.ar.unit}`, pending: `تظهر هنا ${n.ar.units} روابطك عندما يرسل كيوريكس مصدر كل واحد منها.`,
      note: "أعداد فقط. لا أسماء عملاء ولا مبالغ.",
    },
    recs: {
      title: "اقتراحات", CREATE_FIRST_LINK: "أنشئ أول رابط وشاركه مع عملائك.", PRINT_COUNTER_CARD: `اطبع بطاقة QR لـ${n.ar.counter}.`,
      BRANCH_NOT_LISTED: "{{count}} من أماكنك غير مدرجة على كيوريكس بعد. اربطها من مساحة الويب.", LINKS_UNUSED: "{{count}} روابط بلا زيارات. شاركها مجددًا أو أوقفها.",
      HIGH_REJECTION: "نحو {{percent}}% من طلباتك على كيوريكس رُفضت أو أُلغيت. راجع المخزون وساعات العمل على مساحة الويب.",
    },
    statement: { title: "كشف الرسوم", none: "لا توجد عمولة مضبوطة." },
    commission: {
      rate: {
        title: "نسبة العمولة الخاصة بك", hint: "تحدد كيوريكس هذه النسبة. يمكنك رؤيتها هنا دون تعديلها. كل طلب عبر كيوريكس يحتفظ بالنسبة التي كانت سارية عند تسجيله.",
        notSet: "النسبة غير مضبوطة", notSetHint: "لم تُضبط نسبة بعد، لذلك لا تُحتسب عمولة كيوريكس. مالية كيوريكس هي التي تحدد النسبة.",
        sourceOVERRIDE: "نسبة خاصة متفق عليها لك", sourceDEFAULT: "النسبة الافتراضية",
        counselLabel: "مراجعة كيوريكس لتدفق الأموال", counsel: { NOT_REVIEWED: "لم تتم المراجعة بعد", APPROVED_WITH_CONDITIONS: "معتمدة بشروط", APPROVED: "معتمدة", REJECTED: "غير معتمدة" },
        rateDisclosure: "الإفصاح عن النسبة", termsSummary: "ملخص شروط العمولة",
      },
      percentOf: "{{pct}} من الرسم", flatPer: "{{amount}} لكل رسم", min: "حد أدنى", max: "حد أقصى",
      stmt: {
        title: "كشف التسوية", prev: "الشهر السابق", next: "الشهر التالي",
        notConnected: "كشف كيوريكس غير موصول في هذه البيئة.",
        source: "هذه هي الأرقام نفسها التي تراها المالية في كيوريكس لمنشأتك.",
        bankOnly: "تُدفع المستحقات بتحويل بنكي إلى حسابك البنكي فقط. لا تحتفظ كيوريكس بأي أموال نقدية ولا تدفعها: تُحتسب أي عمولة على دفعة نقدية وتُخصم في تسويتك القادمة.",
        reconciliation: "المطابقة", recon: { MATCHED: "مطابق", UNMATCHED: "غير مطابق", DISPUTED: "محل اعتراض", NO_PAYOUT: "لا توجد مدفوعات في هذا الشهر" },
        cOnline: "التحصيلات الإلكترونية", cCashAccrued: "عمولة نقدية مستحقة", cCashNetted: "عمولة نقدية مخصومة", cCashOpen: "عمولة نقدية متبقية",
        cDedCommission: "خصم: العمولة", cDedFees: "خصم: الرسوم", cDedRefunds: "خصم: المبالغ المستردة", cDedChargebacks: "خصم: المطالبات المرتدة", cNet: "صافي المستحق", cPaid: "المدفوع بتحويل بنكي",
        payouts: "المدفوعات", noPayouts: "لا توجد مدفوعات في هذا الشهر.", colDeducted: "العمولة المخصومة",
      },
    },
    notConnected: { title: "غير مرتبط بكيوريكس", body: "اربط حسابك بكيوريكس من مساحة الويب لاستخدام الروابط ورموز QR." },
    notAllowed: "دورك لا يتضمن تبويب النمو.",
    web: { hint: "الملصقات والبطاقات القابلة للطباعة ومساحة العمل الكاملة على الويب.", open: "فتح مساحة الويب" },
    offline: "عرض آخر نسخة محفوظة.",
  };
  return { en, ar };
}
