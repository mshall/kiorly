import { useEffect, useState } from "react";
import { TextInput, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";
import { Badge, Banner, Button, Card, Field, Row, Screen, T, useToast } from "@/components/ui";
import { ListRow, Sparkline } from "@/components/kit";
import { Icon } from "@/components/Icon";
import { useRead } from "@/hooks/useRead";
import { mutate } from "@/offline/mutate";
import { ApiError } from "@/api/errors";
import { haptic } from "@/lib/haptics";
import { fontFamily, radius, useTheme } from "@/theme";
import { Title, useClinicBoot, useLang } from "@/modules/clinic/shared";
import { emptyVitals, nameOf, validateVitals, vitalsHints, type VitalsDraft } from "@/modules/clinic/helpers";

interface Hit { id: string; mrn: string; name: string; nameAr?: string }
interface Result { id?: string; flags?: string[]; critical?: boolean; escalation?: unknown }
const FIELDS: { k: keyof VitalsDraft; label: string; unit: string; kb: "number-pad" | "decimal-pad" }[] = [
  { k: "systolic", label: "clinic.vitals.sys", unit: "mmHg", kb: "number-pad" }, { k: "diastolic", label: "clinic.vitals.dia", unit: "mmHg", kb: "number-pad" },
  { k: "pulse", label: "clinic.vitals.pulse", unit: "bpm", kb: "number-pad" }, { k: "spo2", label: "SpO2", unit: "%", kb: "number-pad" },
  { k: "temperatureC", label: "clinic.vitals.temp", unit: "°C", kb: "decimal-pad" }, { k: "respiratoryRate", label: "clinic.vitals.rr", unit: "/min", kb: "number-pad" },
  { k: "glucoseMgDl", label: "clinic.vitals.glucose", unit: "mg/dL", kb: "number-pad" }, { k: "painScore", label: "clinic.vitals.pain", unit: "0-10", kb: "number-pad" },
];

export default function QuickVitals() {
  const { patientId } = useLocalSearchParams<{ patientId?: string }>();
  const { t, i18n } = useTranslation();
  const { lang, ar } = useLang();
  const { colors } = useTheme();
  const toast = useToast();
  const { email } = useClinicBoot();
  const [pid, setPid] = useState<string | null>(patientId ?? null);
  const [picked, setPicked] = useState<Hit | null>(null);
  const [q, setQ] = useState(""); const [dq, setDq] = useState("");
  useEffect(() => { const id = setTimeout(() => setDq(q.trim()), 300); return () => clearTimeout(id); }, [q]);
  const search = useRead<{ patients: Hit[] }>("clinic", "/mobile/search", { query: { q: dq }, enabled: !pid && dq.length >= 2 });
  const pat = useRead<{ id: string; mrn: string; firstNameEn?: string; lastNameEn?: string; firstNameAr?: string; lastNameAr?: string }>("clinic", `/patients/${pid}`, { enabled: !!pid && !picked });
  const trend = useRead<{ items: { recordedAt: string; pulse?: number; systolic?: number }[] }>("clinic", `/nurse/patients/${pid}/vitals/trend`, { enabled: !!pid });
  const [d, setD] = useState<VitalsDraft>(emptyVitals());
  const [busy, setBusy] = useState(false); const [result, setResult] = useState<Result | null>(null); const [queued, setQueued] = useState(false);
  const v = validateVitals(d); const hints = vitalsHints(v.body);
  const label = picked ? nameOf(picked, lang) : pat.data ? (ar ? `${pat.data.firstNameAr ?? ""} ${pat.data.lastNameAr ?? ""}` : `${pat.data.firstNameEn ?? ""} ${pat.data.lastNameEn ?? ""}`).trim() : "";

  const submit = async () => {
    if (!pid || !v.ok) return; setBusy(true); setResult(null);
    try {
      const r = await mutate<Result>("clinic", "POST", "/mobile/vitals", { patientId: pid, ...v.body }, { label: `${t("clinic.vitals.title")} · ${label}`, owner: email, queueable: true });
      if (r.queued) { setQueued(true); toast.show(t("sync.queuedToast"), "info"); } else { setQueued(false); setResult(r.data); (r.data.critical ? haptic.error : haptic.success)(); toast.show(t("clinic.vitals.recorded")); }
      setD(emptyVitals());
    } catch (e) { const er = e as ApiError; haptic.error(); toast.show(er.status === 403 ? t("common.notAllowed") : er.message, "error"); } finally { setBusy(false); }
  };
  const series = (trend.data?.items ?? []).map((x) => x.systolic ?? x.pulse).filter((n): n is number => typeof n === "number").slice(-10);

  return (
    <Screen testID="clinic-vitals" title={t("tiles.clinic.vitals.title")}>
      <Title k="tiles.clinic.vitals.title" />
      {!pid ? (
        <View style={{ gap: 10, marginTop: 8 }}>
          <T muted>{t("clinic.vitals.pick")}</T>
          <TextInput testID="vitals-patient-search" value={q} onChangeText={setQ} placeholder={t("clinic.patients.search")} placeholderTextColor={colors.subtleText} autoCapitalize="none"
            style={{ minHeight: 48, borderRadius: radius, paddingHorizontal: 14, color: colors.text, backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.border, fontSize: 16, fontFamily: fontFamily(i18n.language, "regular"), textAlign: ar ? "right" : "left" }} />
          {(search.data?.patients ?? []).map((p) => <ListRow key={p.id} testID={`pick-${p.id}`} icon="user" title={nameOf(p, lang)} subtitle={p.mrn} onPress={() => { setPid(p.id); setPicked(p); haptic.select(); }} />)}
          {search.data && !search.data.patients.length ? <T variant="small" muted>{t("clinic.patients.empty")}</T> : null}
        </View>
      ) : (
        <View style={{ gap: 12, marginTop: 8 }}>
          <Card style={{ gap: 4 }}><Row style={{ justifyContent: "space-between" }}><Row gap={8}><Icon name="user" size={18} color={colors.ink} /><T weight="semibold" testID="vitals-patient">{label || "…"}</T></Row><Button small variant="ghost" title={t("clinic.vitals.change")} onPress={() => { setPid(null); setPicked(null); setResult(null); }} /></Row></Card>
          {series.length > 1 ? <Card style={{ gap: 6 }}><T variant="caption" muted>{t("clinic.vitals.trend")}</T><Sparkline data={series} color={colors.ink2} height={36} /></Card> : null}
          {result ? (
            <Banner tone={result.critical ? "danger" : "success"} testID="vitals-result" title={result.critical ? t("clinic.vitals.criticalTitle") : t("clinic.vitals.recorded")} body={result.critical ? t("clinic.vitals.criticalBody") : result.flags?.length ? `${t("clinic.vitals.flags")}: ${result.flags.join(", ")}` : t("clinic.vitals.normal")} />
          ) : null}
          {queued ? <Banner tone="ink" testID="vitals-queued" body={t("common.offlineSaved")} /> : null}
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
            {FIELDS.map((f) => {
              const err = v.errors[f.k];
              return (
                <View key={f.k} style={{ flexBasis: "47%", flexGrow: 1 }}>
                  <Field testID={`vital-${f.k}`} label={`${f.label.startsWith("clinic") ? t(f.label) : f.label} (${f.unit})`} value={d[f.k]} onChangeText={(x) => setD((s) => ({ ...s, [f.k]: x }))} keyboardType={f.kb} style={err ? { borderColor: colors.danger } : undefined} />
                  {err ? <T variant="caption" color={colors.danger}>{t(`clinic.vitals.err.${err}`)}</T> : null}
                </View>
              );
            })}
          </View>
          {hints.length ? <Banner tone="warning" testID="vitals-hint" body={`${t("clinic.vitals.hint")}: ${hints.map((h) => t(`clinic.vitals.h.${h}`)).join("، ")}`} /> : null}
          <Button title={t("clinic.vitals.record")} icon="check" onPress={() => void submit()} loading={busy} disabled={!v.ok} testID="vitals-submit" />
          <Badge tone="muted" label={t("clinic.vitals.thresholdNote")} />
        </View>
      )}
    </Screen>
  );
}
