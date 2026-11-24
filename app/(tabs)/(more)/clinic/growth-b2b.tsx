import { useState } from "react";
import { View } from "react-native";
import { useTranslation } from "react-i18next";
import { Badge, Banner, Button, Card, Chip, Field, Row, Screen, T, useToast } from "@/components/ui";
import { FadeIn, QueryView, SectionTitle } from "@/components/kit";
import { ApiError } from "@/api/errors";
import { mutate } from "@/offline/mutate";
import { useRead, usePullRefresh } from "@/hooks/useRead";
import { haptic } from "@/lib/haptics";
import { ClinicError, Title } from "@/modules/clinic/shared";
import { b2bProblem, SIZE_BUCKETS, type B2bList } from "@/modules/clinic/growth-b2b";

/** GRW-P4-C: refer a company to Kiorex (organisation admin and marketing). Company data only; tracking only, no reward. Sending needs a connection (it is never queued: a lead should not be sent twice). */
export default function GrowthB2b() {
  const { t, i18n } = useTranslation();
  const toast = useToast();
  const q = useRead<B2bList>("clinic", "/mobile/growth/b2b-referrals");
  const refresh = usePullRefresh(q);
  const [name, setName] = useState(""); const [size, setSize] = useState<string>("UNKNOWN"); const [ref, setRef] = useState(""); const [busy, setBusy] = useState(false); const [msg, setMsg] = useState<string | null>(null);
  const forbidden = q.error instanceof ApiError && q.error.status === 403 && !q.error.isFeatureDisabled;
  const lang = i18n.language;

  const submit = async () => {
    const p = b2bProblem({ companyName: name, contactRef: ref });
    if (p) { setMsg(t(`clinic.growth.b2b.problem.${p}`)); return; }
    setBusy(true); setMsg(null);
    try {
      await mutate("clinic", "POST", "/mobile/growth/b2b-referrals", { companyName: name.trim(), sizeBucket: size, ...(ref.trim() ? { contactRef: ref.trim() } : {}) }, { label: "growth.b2b", owner: "growth" });
      haptic.success(); toast.show(t("clinic.growth.b2b.sent"), "success"); setName(""); setRef(""); await q.refetch();
    } catch (e) {
      haptic.error();
      const code = e instanceof ApiError ? e.code : "";
      setMsg(e instanceof ApiError && e.isNetwork ? t("clinic.growth.b2b.needsConnection") : i18n.exists(`clinic.growth.b2b.error.${code}`) ? t(`clinic.growth.b2b.error.${code}`) : t("clinic.growth.b2b.error.GENERIC"));
    } finally { setBusy(false); }
  };

  return (
    <Screen refresh={refresh} testID="clinic-growth-b2b" title={t("clinic.growth.b2b.title")}>
      <Title k="clinic.growth.b2b.title" />
      <View style={{ gap: 12, marginTop: 8 }}>
        <T muted>{t("clinic.growth.b2b.intro")}</T>
        <Banner tone="ink" body={t("clinic.growth.b2b.noReward")} testID="b2b-no-reward" />
        {forbidden ? <Banner tone="warning" title={t("clinic.growth.b2b.error.GROWTH_FORBIDDEN")} testID="b2b-forbidden" /> : q.isError && !q.data ? <ClinicError error={q.error} onRetry={() => void q.refetch()} /> : (
          <QueryView q={q} cached={q.fromCache} rows={3}>
            {(d) => (
              <FadeIn>
                <View style={{ gap: 12 }}>
                  <Card style={{ gap: 10 }} testID="b2b-form">
                    <Field label={t("clinic.growth.b2b.name")} value={name} onChangeText={setName} maxLength={120} testID="b2b-name" />
                    <T variant="label">{t("clinic.growth.b2b.size")}</T>
                    <Row gap={8} style={{ flexWrap: "wrap" }}>{SIZE_BUCKETS.map((s) => <Chip key={s} label={t(`clinic.growth.b2b.sizes.${s}`)} selected={size === s} onPress={() => setSize(s)} testID={`b2b-size-${s}`} />)}</Row>
                    <Field label={t("clinic.growth.b2b.contactRef")} value={ref} onChangeText={setRef} maxLength={80} autoCapitalize="none" testID="b2b-ref" style={{ writingDirection: "ltr", textAlign: "left" }} />
                    <T variant="caption" muted>{t("clinic.growth.b2b.contactHint")}</T>
                    <Button title={t("clinic.growth.b2b.send")} onPress={() => void submit()} loading={busy} disabled={name.trim().length < 2} testID="b2b-send" />
                    {msg ? <Banner tone="warning" body={msg} testID="b2b-msg" /> : null}
                  </Card>
                  {d.items.length === 0 ? <T muted testID="b2b-empty">{t("clinic.growth.b2b.empty")}</T> : (
                    <Card style={{ gap: 8 }} testID="b2b-list">
                      <SectionTitle title={t("clinic.growth.b2b.listTitle")} />
                      {d.items.map((r) => (
                        <View key={r.id} style={{ gap: 2, paddingVertical: 6 }} testID={`b2b-${r.id}`}>
                          <Row style={{ justifyContent: "space-between" }}><T weight="semibold">{r.companyName}</T><Badge tone="success" label={t(`clinic.growth.b2b.status.${r.status}`)} /></Row>
                          <T variant="caption" muted>{t(`clinic.growth.b2b.sizes.${r.sizeBucket}`)} · {new Date(r.createdAt).toLocaleDateString(lang.startsWith("ar") ? "ar-EG" : "en")}</T>
                        </View>
                      ))}
                    </Card>
                  )}
                </View>
              </FadeIn>
            )}
          </QueryView>
        )}
      </View>
    </Screen>
  );
}
