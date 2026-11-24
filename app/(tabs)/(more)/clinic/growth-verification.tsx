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
import { codeOf, isNetwork, parseEvidence, VERIFICATION_FIELDS, verificationReady, type VerificationField, type VerificationList } from "@/modules/clinic/growth-marketing";

/** GRW-P2-C: ask Kiorex to update a verified profile field (admin only). The value is encrypted by the server; evidence files are referenced, not uploaded here. */
export default function GrowthVerification() {
  const { t } = useTranslation();
  const toast = useToast();
  const q = useRead<VerificationList>("clinic", "/mobile/growth/verification");
  const refresh = usePullRefresh(q);
  const [field, setField] = useState<VerificationField>("LICENSE_NUMBER");
  const [value, setValue] = useState("");
  const [evidence, setEvidence] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const forbidden = q.error instanceof ApiError && q.error.status === 403 && !q.error.isFeatureDisabled;

  const submit = async () => {
    setBusy(true); setMsg(null);
    try {
      await mutate("clinic", "POST", "/mobile/growth/verification", { field, newValue: value.trim(), evidenceFileRefs: parseEvidence(evidence).refs }, { label: "growth.verification", owner: "growth" });
      haptic.success(); toast.show(t("clinic.growth.verification.sent"), "success"); setValue(""); setEvidence(""); await q.refetch();
    } catch (e) {
      haptic.error();
      setMsg(isNetwork(e) ? t("clinic.growth.common.needsConnection") : codeOf(e) === "VERIFICATION_REQUEST_STATE" ? t("clinic.growth.verification.open") : t("clinic.growth.verification.invalid"));
    } finally { setBusy(false); }
  };

  return (
    <Screen refresh={refresh} testID="clinic-growth-verification" title={t("clinic.growth.verification.title")}>
      <Title k="clinic.growth.verification.title" />
      <View style={{ gap: 12, marginTop: 8 }}>
        <T muted>{t("clinic.growth.verification.intro")}</T>
        {forbidden ? <Banner tone="warning" title={t("clinic.growth.verification.adminOnly")} testID="verification-forbidden" /> : q.isError && !q.data ? <ClinicError error={q.error} onRetry={() => void q.refetch()} /> : (
          <QueryView q={q} cached={q.fromCache} rows={3}>
            {(d) => (
              <FadeIn>
                <View style={{ gap: 12 }}>
                  <Badge tone={d.badge === "VERIFIED" ? "success" : "warning"} label={t(`clinic.growth.verification.badge.${d.badge}`)} />
                  <Card style={{ gap: 10 }} testID="verification-form">
                    <Row gap={8} style={{ flexWrap: "wrap" }}>
                      {VERIFICATION_FIELDS.map((f) => <Chip key={f} label={t(`clinic.growth.verification.field.${f}`)} selected={field === f} onPress={() => setField(f)} testID={`verification-field-${f}`} />)}
                    </Row>
                    <Field label={t("clinic.growth.verification.newValue")} value={value} onChangeText={setValue} maxLength={300} testID="verification-value" />
                    <Field label={t("clinic.growth.verification.evidence")} value={evidence} onChangeText={setEvidence} multiline testID="verification-evidence" />
                    <T variant="caption" muted>{t("clinic.growth.verification.evidenceHint")}</T>
                    <Button title={t("clinic.growth.verification.submit")} onPress={() => void submit()} loading={busy} disabled={!verificationReady(field, value, evidence)} testID="verification-submit" />
                    {msg ? <Banner tone="warning" body={msg} testID="verification-msg" /> : null}
                  </Card>
                  {d.items.length === 0 ? <T muted testID="verification-empty">{t("clinic.growth.verification.empty")}</T> : (
                    <Card style={{ gap: 8 }} testID="verification-list">
                      <SectionTitle title={t("clinic.growth.verification.title")} />
                      {d.items.map((r) => (
                        <View key={r.id} style={{ gap: 2, paddingVertical: 6 }} testID={`verification-${r.id}`}>
                          <Row style={{ justifyContent: "space-between" }}>
                            <T weight="semibold">{t(`clinic.growth.verification.field.${r.field}`)}</T>
                            <Badge tone={r.status === "APPROVED" ? "success" : r.status === "REJECTED" ? "danger" : "warning"} label={t(`clinic.growth.verification.status.${r.status}`)} />
                          </Row>
                          <T variant="caption" muted>{t("clinic.growth.verification.count", { count: r.evidenceCount })}</T>
                          {r.decisionNote ? <T variant="small">{t("clinic.growth.verification.note")}: {r.decisionNote}</T> : null}
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
