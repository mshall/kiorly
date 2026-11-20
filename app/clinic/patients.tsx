import { useEffect, useState } from "react";
import { TextInput, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { Row, Screen } from "@/components/ui";
import { ListRow, QueryView } from "@/components/kit";
import { ScanField } from "@/components/scanner";
import { useRead, usePullRefresh } from "@/hooks/useRead";
import { fontFamily, radius, useTheme } from "@/theme";
import { Title, ClinicError, useLang } from "@/modules/clinic/shared";
import { patientName } from "@/modules/clinic/helpers";

interface P { id: string; mrn: string; firstNameEn?: string; lastNameEn?: string; firstNameAr?: string; lastNameAr?: string; dob?: string; gender?: string; phone?: string; isVip?: boolean }

export default function Patients() {
  const { t, i18n } = useTranslation();
  const { lang, ar } = useLang();
  const { colors } = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ q?: string }>();
  const [q, setQ] = useState(params.q ?? ""); const [dq, setDq] = useState(q);
  useEffect(() => { const id = setTimeout(() => setDq(q.trim()), 300); return () => clearTimeout(id); }, [q]);
  const res = useRead<{ items: P[]; total: number }>("clinic", "/patients", { query: { search: dq || undefined, pageSize: 30 } });
  const refresh = usePullRefresh(res);
  return (
    <Screen refresh={refresh} testID="clinic-patients" title={t("tiles.clinic.patients.title")}>
      <Title k="tiles.clinic.patients.title" />
      <Row gap={8} style={{ marginVertical: 8 }}>
        <View style={{ flex: 1, justifyContent: "center" }}>
          <TextInput testID="patients-search" value={q} onChangeText={setQ} placeholder={t("clinic.patients.search")} placeholderTextColor={colors.subtleText} autoCapitalize="none"
            style={{ minHeight: 48, borderRadius: radius, paddingHorizontal: 14, color: colors.text, backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.border, fontSize: 16, fontFamily: fontFamily(i18n.language, "regular"), textAlign: ar ? "right" : "left" }} />
        </View>
      </Row>
      <ScanField placeholder={t("clinic.patients.scanMrn")} onCode={(c) => { setQ(c); return true; }} />
      <View style={{ gap: 10, marginTop: 12 }}>
        {res.isError && !res.data ? <ClinicError error={res.error} onRetry={() => void res.refetch()} /> : (
          <QueryView q={res} cached={res.fromCache} isEmpty={(d) => d.items.length === 0} empty={{ icon: "users", title: t("clinic.patients.empty") }}>
            {(d) => <>{d.items.map((p) => (
              <ListRow key={p.id} testID={`patient-${p.id}`} icon="user" title={patientName(p, lang)} subtitle={[p.mrn, p.phone].filter(Boolean).join(" · ")} badge={p.isVip ? "VIP" : undefined} badgeTone="warning" onPress={() => router.push(`/clinic/patient/${p.id}` as never)} />
            ))}</>}
          </QueryView>
        )}
      </View>
    </Screen>
  );
}
