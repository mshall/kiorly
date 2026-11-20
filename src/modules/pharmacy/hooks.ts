import { useTranslation } from "react-i18next";
import { useSessions } from "@/auth/SessionProvider";

export function usePh() {
  const { sessions } = useSessions();
  const { t, i18n } = useTranslation();
  const session = sessions.pharmacy;
  const boot = session?.bootstrap;
  return { session, boot, t, lang: i18n.language, ar: i18n.language.startsWith("ar"), owner: session?.email ?? "", branchId: boot?.user.branchId };
}
