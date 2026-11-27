import { useState } from "react";
import { View } from "react-native";
import { Stack, useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { Badge, Banner, Button, Card, Chip, Field, Row, Screen, Sheet, T, useToast } from "@/components/ui";
import { QueryView, SectionTitle } from "@/components/kit";
import { ErrorState } from "@/components/states";
import { api } from "@/api/client";
import { ApiError } from "@/api/errors";
import { useRead, usePullRefresh } from "@/hooks/useRead";
import { haptic } from "@/lib/haptics";
import { useLab } from "@/modules/lab/useLab";
import { flagTone, resultValue } from "@/modules/lab/helpers";
import {
  currentResult, defaultInstrument, enterable, entryBody, entryErrorKey, isCritical, mayConfirm, mayEnter, needsSecondEntry, secondBody,
  type EntryAnalyte, type EntryItem, type EntryResult, type EntrySpecimen, type Instrument,
} from "@/modules/lab/entry";

/**
 * Bench result entry for ONE specimen in processing. Needs `results.enter` (first entry) and/or `results.second_entry` (a different person re-keys the value; dual control is the
 * server's rule: manual results cannot be technically validated until then). The server decides ranges, flags, critical limits, delta checks and QC cover and says so in its answer.
 * OFFLINE: never queued. A result is a clinical record that needs the live, audited server decision.
 */
export default function ResultEntry() {
  const { specimenId } = useLocalSearchParams<{ specimenId: string }>();
  const { t, i18n } = useTranslation();
  const ar = i18n.language.startsWith("ar");
  const toast = useToast();
  const qc = useQueryClient();
  const { can } = useLab();
  // `specimenId` makes a current Lab API return exactly this specimen (the plain list is capped at the oldest 200); an older API ignores it and the specimen is found in the list below.
  const list = useRead<EntrySpecimen[]>("lab", "/worklist", { query: { status: "PROCESSING", specimenId } });
  const instruments = useRead<Instrument[]>("lab", "/instruments", { enabled: mayEnter(can) });
  const refresh = usePullRefresh({ refetch: async () => { await Promise.all([list.refetch(), instruments.refetch()]); } });
  const [values, setValues] = useState<Record<string, string>>({});
  const [chosen, setChosen] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [flags, setFlags] = useState<Record<string, string>>({});
  const [second, setSecond] = useState<{ result: EntryResult; analyte: EntryAnalyte } | null>(null);
  const [secondRaw, setSecondRaw] = useState(""); const [secondErr, setSecondErr] = useState<string | null>(null);

  const active = (instruments.data ?? []).filter((i) => i.active);
  const instrumentId = chosen ?? defaultInstrument(instruments.data) ?? "";
  const key = (item: EntryItem, a: EntryAnalyte) => `${item.id}:${a.id}`;
  const reload = () => qc.invalidateQueries({ predicate: (q) => ["/worklist", "/validation-queue", "/mobile/worklist/progress", "/mobile/summary"].includes(String(q.queryKey[1])) });
  const setErr = (k: string, v: string | null) => setErrs((e) => { const n = { ...e }; if (v) n[k] = v; else delete n[k]; return n; });

  const save = async (item: EntryItem, a: EntryAnalyte) => {
    const k = key(item, a); if (busy) return;
    const body = entryBody(a, values[k] ?? "", { orderItemId: item.id, instrumentId });
    if (!body) return;
    setBusy(k); setErr(k, null);
    try {
      const r = await api.post<{ flag?: string }>("lab", "/results", body);
      haptic.success(); toast.show(t("lab.entry.saved")); setFlags((f) => ({ ...f, [k]: r?.flag ?? "" }));
      setValues((v) => { const n = { ...v }; delete n[k]; return n; }); await reload();
    } catch (e) {
      haptic.error(); setErr(k, t(entryErrorKey(e)));
      if (e instanceof ApiError && e.code === "RESULT_EXISTS") await reload();
    } finally { setBusy(null); }
  };
  const confirm = async () => {
    if (!second || busy) return; const body = secondBody(second.analyte, secondRaw); if (!body) return;
    setBusy(`second:${second.result.id}`); setSecondErr(null);
    try { await api.post("lab", `/results/${second.result.id}/second-entry`, body); haptic.success(); toast.show(t("lab.entry.confirmed")); setSecond(null); setSecondRaw(""); await reload(); }
    catch (e) { haptic.error(); setSecondErr(t(entryErrorKey(e))); } finally { setBusy(null); }
  };

  const sp = list.data?.find((s) => s.id === specimenId);
  const name = (a: EntryAnalyte) => (ar ? a.nameAr : null) || a.nameEn;
  return (
    <Screen refresh={refresh} testID="lab-result-entry">
      <Stack.Screen options={{ title: t("lab.entry.title") }} />
      {list.isError && !list.data ? <ErrorState error={list.error} onRetry={() => void list.refetch()} /> : (
        <QueryView q={list} cached={list.fromCache} isEmpty={() => !sp} empty={{ icon: "list", title: t("lab.entry.gone"), hint: t("lab.entry.goneHint") }}>
          {() => sp ? (
            <View style={{ gap: 12 }}>
              <Card style={{ gap: 4 }} testID="entry-specimen">
                <T variant="h2" forceLatin>{sp.accessionNumber}</T>
                <T variant="small" muted>{[sp.order?.orderNumber, sp.specimenType, sp.order?.patient?.fullName].filter(Boolean).join(" · ")}</T>
                {sp.order?.priority && sp.order.priority !== "ROUTINE" ? <Badge tone="danger" label={sp.order.priority} /> : null}
              </Card>
              {!mayEnter(can) && !mayConfirm(can) ? <Banner tone="warning" title={t("common.notAllowed")} testID="entry-not-allowed" /> : null}
              {mayEnter(can) ? (
                <View style={{ gap: 6 }} testID="entry-instrument">
                  <T variant="label">{t("lab.entry.instrument")}</T>
                  {instruments.isError ? <Banner tone="warning" body={t(entryErrorKey(instruments.error))} testID="entry-instrument-error" /> : active.length === 0 && !instruments.isLoading ? <Banner tone="warning" body={t("lab.entry.noInstrument")} testID="entry-no-instrument" /> : (
                    <Row gap={8} style={{ flexWrap: "wrap" }}>{active.map((i) => <Chip key={i.id} label={i.name} selected={i.id === instrumentId} onPress={() => setChosen(i.id)} testID={`instrument-${i.id}`} />)}</Row>
                  )}
                </View>
              ) : null}
              {(sp.items ?? []).map((item) => (
                <View key={item.id} style={{ gap: 8 }} testID={`entry-item-${item.id}`}>
                  <SectionTitle title={item.test.nameEn} />
                  {item.analytes.map((a) => {
                    const k = key(item, a); const r = currentResult(item, a.id); const crit = isCritical(flags[k] || r?.flag);
                    return (
                      <Card key={a.id} style={{ gap: 8 }} testID={`entry-analyte-${a.id}`}>
                        <Row style={{ justifyContent: "space-between" }} gap={8}>
                          <T weight="semibold" style={{ flex: 1 }}>{name(a)}</T>
                          {r ? <Badge tone={flagTone(r.flag)} label={r.flag} testID={`entry-flag-${a.id}`} /> : null}
                        </Row>
                        {r ? (
                          <View style={{ gap: 6 }}>
                            <T testID={`entry-value-${a.id}`}>{resultValue({ valueNumeric: r.valueNumeric, valueText: r.valueText, unit: a.unit ?? null })}</T>
                            {crit ? <Banner tone="danger" body={t("lab.entry.critical")} testID={`entry-critical-${a.id}`} /> : null}
                            {r.deltaCheckFailed ? <Badge tone="warning" label={t("lab.deltaFailed")} /> : null}
                            {needsSecondEntry(r) ? (
                              mayConfirm(can)
                                ? <Button small variant="secondary" title={t("lab.entry.confirm")} onPress={() => { setSecond({ result: r, analyte: a }); setSecondRaw(""); setSecondErr(null); }} testID={`entry-confirm-${a.id}`} />
                                : <T variant="caption" muted>{t("lab.entry.awaitingSecond")}</T>
                            ) : <T variant="caption" muted>{r.status}</T>}
                          </View>
                        ) : a.calculated ? <T variant="caption" muted>{t("lab.entry.calculated")}</T> : !enterable(a) || !mayEnter(can) ? <T variant="caption" muted>{t("lab.entry.pending")}</T> : (
                          <View style={{ gap: 8 }}>
                            {a.valueType === "CHOICE" || a.valueType === "SEMI_QUANT" ? (
                              <Row gap={8} style={{ flexWrap: "wrap" }}>{(a.allowedValues ?? []).map((v) => <Chip key={v} label={v} selected={values[k] === v} onPress={() => setValues((x) => ({ ...x, [k]: v }))} testID={`entry-choice-${a.id}-${v}`} />)}</Row>
                            ) : (
                              <Field label={a.unit ? `${t("lab.result")} (${a.unit})` : t("lab.result")} value={values[k] ?? ""} onChangeText={(v) => setValues((x) => ({ ...x, [k]: v }))} keyboardType={a.valueType === "NUMERIC" ? "decimal-pad" : "default"} testID={`entry-input-${a.id}`} />
                            )}
                            {errs[k] ? <Banner tone="danger" body={errs[k]} testID={`entry-error-${a.id}`} /> : null}
                            <Button small title={t("lab.entry.save")} onPress={() => void save(item, a)} loading={busy === k} disabled={!!busy || !entryBody(a, values[k] ?? "", { orderItemId: item.id, instrumentId })} testID={`entry-save-${a.id}`} />
                          </View>
                        )}
                      </Card>
                    );
                  })}
                </View>
              ))}
            </View>
          ) : null}
        </QueryView>
      )}
      <Sheet visible={!!second} onClose={() => setSecond(null)} title={t("lab.entry.confirmTitle")} testID="entry-second-sheet"
        footer={<Button title={t("lab.entry.confirm")} onPress={() => void confirm()} loading={!!second && busy === `second:${second.result.id}`} disabled={!second || !secondBody(second.analyte, secondRaw)} testID="entry-second-confirm" />}>
        <T variant="small" muted>{t("lab.entry.confirmHint")}</T>
        <Field label={second ? name(second.analyte) : ""} value={secondRaw} onChangeText={setSecondRaw} keyboardType={second?.analyte.valueType === "NUMERIC" ? "decimal-pad" : "default"} testID="entry-second-input" />
        {secondErr ? <Banner tone="danger" body={secondErr} testID="entry-second-error" /> : null}
      </Sheet>
    </Screen>
  );
}
