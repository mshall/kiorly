import { View } from "react-native";
import { Stack } from "expo-router";
import { useTranslation } from "react-i18next";
import { useSessions } from "@/auth/SessionProvider";
import { ApiError } from "@/api/errors";
import { Banner, Row, T } from "@/components/ui";
import { ErrorState } from "@/components/states";
import { Badge } from "@/components/ui";
import { useTheme } from "@/theme";
import { Icon } from "@/components/Icon";
import { Avatar } from "./Avatar";
import { nameOf, type Tone } from "./helpers";
import type { Bootstrap } from "@/api/types";

export const useClinicBoot = (): { boot: Bootstrap | undefined; email: string } => {
  const { sessions } = useSessions();
  return { boot: sessions.clinic?.bootstrap, email: sessions.clinic?.email ?? "" };
};
export const useLang = () => { const { i18n } = useTranslation(); return { lang: i18n.language, ar: i18n.language.startsWith("ar") }; };

/** Title helper: sets the native header title for a clinic route. */
export const Title = ({ k, text }: { k?: string; text?: string }) => { const { t } = useTranslation(); return <Stack.Screen options={{ title: text ?? t(k ?? "") }} />; };

/** Friendly 403 (role) vs the shared ErrorState. */
export function ClinicError({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const { t } = useTranslation();
  if (error instanceof ApiError && error.status === 403 && !error.isFeatureDisabled) return <Banner tone="warning" title={t("common.notAllowed")} testID="not-allowed" />;
  return <ErrorState error={error} onRetry={onRetry} />;
}

export function PatientLine({ p, sub }: { p: { name?: string; nameAr?: string | null; mrn?: string; gender?: string; age?: number | null }; sub?: string }) {
  const { lang } = useLang();
  const n = nameOf(p, lang);
  return (
    <Row gap={12}>
      <Avatar name={n} />
      <View style={{ flex: 1 }}>
        <T weight="semibold" numberOfLines={1}>{n}</T>
        <T variant="caption" muted numberOfLines={1}>{[p.mrn, p.age != null ? `${p.age}${lang.startsWith("ar") ? " سنة" : "y"}` : null, sub].filter(Boolean).join(" · ")}</T>
      </View>
    </Row>
  );
}
export const StatusBadge = ({ label, tone }: { label: string; tone: Tone }) => <Badge label={label} tone={tone} />;
export const Warn = ({ text }: { text: string }) => { const { colors } = useTheme(); return <Row gap={6}><Icon name="alert" size={14} color={colors.danger} /><T variant="caption" color={colors.danger}>{text}</T></Row>; };
