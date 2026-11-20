import { useEffect, useRef, useState } from "react";
import { Linking, Pressable, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { Badge, Banner, Button, Card, Checkbox, Chip, Field, Row, Screen, Sheet, T, useToast } from "@/components/ui";
import { Icon } from "@/components/Icon";
import { KV, ListRow, SectionTitle, SkeletonList } from "@/components/kit";
import { ScanField } from "@/components/scanner";
import { useRead, usePullRefresh } from "@/hooks/useRead";
import { api } from "@/api/client";
import { ApiError } from "@/api/errors";
import { mutate } from "@/offline/mutate";
import { haptic } from "@/lib/haptics";
import { formatTime } from "@/lib/format";
import { useTheme } from "@/theme";
import { ClinicError, Title, useClinicBoot } from "@/modules/clinic/shared";
import { getPosition, type Pos } from "@/modules/clinic/location";
import { IDENTIFIER_KINDS, identifiersOk, roundActions, roundStepIndex, roundTone, safetyPrompt, tubeLabelOk } from "@/modules/clinic/helpers";
import type { RouteItem } from "../rounds";

type Visit = RouteItem & { plannedEndsAt: string };
interface LabOrder { id: string; status: string; labStatus?: string; items: { code: string; nameEn: string; nameAr?: string }[]; sampleCollection?: unknown }
const STEPS = ["CONFIRMED", "ON_MY_WAY", "ARRIVED", "FINISHED"] as const;
const CATS = ["AGGRESSION", "ANIMALS", "INTOXICATION", "THREAT", "OTHER"];

export default function Round() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const toast = useToast();
  const qc = useQueryClient();
  const { email } = useClinicBoot();
  const q = useRead<Visit>("clinic", `/home-visits/${id}`, { refetchInterval: 20_000 });
  const v = q.data;
  const orders = useRead<{ items?: LabOrder[] } | LabOrder[]>("clinic", "/nurse/lab-orders", { query: { appointmentId: v?.appointmentId }, enabled: !!v?.appointmentId });
  const refresh = usePullRefresh({ refetch: () => Promise.all([q.refetch(), orders.refetch()]) });
  const [busy, setBusy] = useState<string | null>(null);
  const [abort, setAbort] = useState(false); const [reason, setReason] = useState(""); const [cat, setCat] = useState("THREAT");
  const [sos, setSos] = useState(0); const sosTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const [order, setOrder] = useState(false); const [collect, setCollect] = useState<LabOrder | null>(null);
  const actions = v ? roundActions(v.state) : [];
  const step = v ? roundStepIndex(v.state) : -1;
  const prompt = v ? safetyPrompt({ id: v.id, state: v.state, plannedEndsAt: v.plannedEndsAt }) === "prompt" : false;
  const list = (Array.isArray(orders.data) ? orders.data : orders.data?.items) ?? [];

  const act = async (kind: "depart" | "arrive" | "finish" | "answer") => {
    if (!v) return; setBusy(kind);
    try {
      let pos: Pos | null = null;
      if (kind !== "answer") pos = await getPosition();
      if (kind === "arrive" && !pos) { if (__DEV__ && v.address?.lat != null) pos = { lat: v.address.lat, lng: v.address.lng! }; else { toast.show(t("clinic.round.needLocation"), "error"); return; } }
      const path = kind === "answer" ? "safety/answer" : kind;
      const r = await mutate("clinic", "POST", `/home-visits/${v.id}/${path}`, pos ? { lat: pos.lat, lng: pos.lng } : {}, { label: `${t(`clinic.round.${kind}`)} · ${v.patient.name}`, owner: email, queueable: kind !== "arrive" });
      haptic.success(); toast.show(r.queued ? t("sync.queuedToast") : t(`clinic.round.done.${kind}`), r.queued ? "info" : "success");
      await qc.invalidateQueries({ queryKey: ["clinic"] });
    } catch (e) { const er = e as ApiError; haptic.error(); toast.show(er.code === "OUTSIDE_COVERAGE" ? t("clinic.round.outside") : er.status === 403 ? t("common.notAllowed") : er.message, "error"); } finally { setBusy(null); }
  };
  const doAbort = async () => {
    if (!v || reason.trim().length < 3) return; setBusy("abort");
    try { const pos = await getPosition(3000); await api.post("clinic", `/home-visits/${v.id}/abort-unsafe`, { reason: reason.trim(), reasonCategory: cat, ...(pos ? { lat: pos.lat, lng: pos.lng } : {}) }); haptic.warn(); toast.show(t("clinic.round.done.abort")); setAbort(false); setReason(""); await qc.invalidateQueries({ queryKey: ["clinic"] }); }
    catch (e) { toast.show((e as ApiError).message, "error"); } finally { setBusy(null); }
  };
  // Safety button: press and hold ~1.2 s so it can't be triggered by accident; never queued (needs the network to reach the safety contact)
  const sosStart = () => {
    haptic.press(); setSos(0);
    sosTimer.current = setInterval(() => setSos((p) => { if (p >= 100) return p; const n = p + 10; if (n >= 100) { if (sosTimer.current) clearInterval(sosTimer.current); void fireSos(); } return n; }), 120);
  };
  const sosStop = () => { if (sosTimer.current) clearInterval(sosTimer.current); setSos((p) => (p >= 100 ? p : 0)); };
  useEffect(() => () => { if (sosTimer.current) clearInterval(sosTimer.current); }, []);
  const fireSos = async () => {
    if (!v) return;
    try { const pos = (await getPosition(4000)) ?? (v.address?.lat != null ? { lat: v.address.lat, lng: v.address.lng! } : null); if (!pos) { toast.show(t("clinic.round.needLocation"), "error"); setSos(0); return; }
      await api.post("clinic", `/home-visits/${v.id}/sos`, { lat: pos.lat, lng: pos.lng }); haptic.error(); toast.show(t("clinic.round.sosSent"), "error"); await qc.invalidateQueries({ queryKey: ["clinic"] }); }
    catch (e) { toast.show((e as ApiError).message, "error"); } finally { setTimeout(() => setSos(0), 1500); }
  };

  if (q.isError && !v) return <Screen><ClinicError error={q.error} onRetry={() => void q.refetch()} /></Screen>;
  return (
    <Screen refresh={refresh} testID="clinic-round">
      <Title text={v?.patient.name ?? t("clinic.round.title")} />
      {!v ? <SkeletonList rows={3} /> : (
        <View style={{ gap: 12 }}>
          <Card style={{ gap: 10 }}>
            <Row style={{ justifyContent: "space-between" }}><T variant="h2">{v.patient.name}</T><Badge tone={roundTone(v.state)} label={t(`clinic.rounds.state.${v.state}`, { defaultValue: v.state })} /></Row>
            <T variant="small" muted>{formatTime(v.plannedStartsAt, i18n.language)} - {formatTime(v.plannedEndsAt, i18n.language)}{v.district ? ` · ${v.district.replace(/-/g, " ")}` : ""}</T>
            {v.address?.masked ? <Banner tone="ink" body={t("clinic.rounds.masked")} /> : (
              <View style={{ gap: 4 }}>
                <Row gap={6}><Icon name="pin" size={16} color={colors.ink} /><T variant="small" weight="medium" style={{ flex: 1 }}>{[v.address?.line1, v.address?.building && `${t("clinic.round.bldg")} ${v.address.building}`, v.address?.floor && `${t("clinic.round.floor")} ${v.address.floor}`].filter(Boolean).join("، ")}</T></Row>
                {v.address?.landmark ? <T variant="caption" muted>{v.address.landmark}</T> : null}
                {v.navigationUrl ? <Button small variant="secondary" icon="navigation" title={t("clinic.round.navigate")} onPress={() => void Linking.openURL(v.navigationUrl!)} /> : null}
              </View>
            )}
            {v.patient.phone ? <Button small variant="ghost" icon="phone" title={v.patient.phone} onPress={() => void Linking.openURL(`tel:${v.patient.phone}`)} /> : null}
            {/* step tracker */}
            <Row gap={4}>{STEPS.map((s, i) => <View key={s} style={{ flex: 1, gap: 4 }}><View style={{ height: 6, borderRadius: 3, backgroundColor: i <= step ? colors.ink2 : colors.subtle }} /><T variant="caption" muted numberOfLines={1}>{t(`clinic.rounds.state.${s}`)}</T></View>)}</Row>
          </Card>

          {prompt ? <Banner tone="warning" testID="safety-prompt" title={t("clinic.round.promptTitle")} body={t("clinic.round.promptBody")}><Button title={t("clinic.round.imOk")} icon="check" onPress={() => void act("answer")} loading={busy === "answer"} testID="safety-ok" /></Banner> : null}
          {v.state === "ABORTED_UNSAFE" ? <Banner tone="danger" title={t("clinic.rounds.state.ABORTED_UNSAFE")} body={v.abortReason ?? undefined} /> : null}

          {actions.includes("depart") ? <Button title={t("clinic.round.depart")} icon="navigation" onPress={() => void act("depart")} loading={busy === "depart"} testID="round-depart" /> : null}
          {actions.includes("arrive") ? <Button title={t("clinic.round.arrive")} icon="pin" onPress={() => void act("arrive")} loading={busy === "arrive"} testID="round-arrive" /> : null}
          {actions.includes("finish") ? <Button title={t("clinic.round.finish")} icon="check" onPress={() => void act("finish")} loading={busy === "finish"} testID="round-finish" /> : null}

          {actions.includes("sos") ? (
            <Card style={{ gap: 8, borderColor: colors.danger }} testID="sos-card">
              <Row gap={8}><Icon name="alert" size={18} color={colors.danger} /><T weight="semibold">{t("clinic.round.safetyTitle")}</T></Row>
              <Pressable testID="sos-button" accessibilityRole="button" accessibilityLabel={t("clinic.round.sos")} accessibilityHint={t("clinic.round.sosHint")} onPressIn={sosStart} onPressOut={sosStop}
                style={{ minHeight: 56, borderRadius: 14, backgroundColor: colors.danger, overflow: "hidden", alignItems: "center", justifyContent: "center" }}>
                <View style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${sos}%`, backgroundColor: "rgba(255,255,255,0.28)" }} />
                <T weight="bold" color={colors.onDanger}>{sos >= 100 ? t("clinic.round.sosSent") : t("clinic.round.sos")}</T>
              </Pressable>
              <T variant="caption" muted>{t("clinic.round.sosHint")}</T>
              <Button small variant="secondary" title={t("clinic.round.abort")} onPress={() => setAbort(true)} testID="round-abort" />
            </Card>
          ) : null}

          {v.state === "ARRIVED" || v.state === "FINISHED" ? (
            <View style={{ gap: 10 }}>
              <Row style={{ justifyContent: "space-between" }}><SectionTitle title={t("clinic.round.samples")} />{v.state === "ARRIVED" ? <Button small variant="secondary" icon="plus" title={t("clinic.round.newOrder")} onPress={() => setOrder(true)} testID="round-new-order" /> : null}</Row>
              {orders.isError ? <ClinicError error={orders.error} /> : !list.length ? <T variant="small" muted>{t("clinic.round.noOrders")}</T> : list.map((o) => (
                <ListRow key={o.id} testID={`lab-order-${o.id}`} icon="syringe" iconTone="ocean" title={o.items.map((i) => i.nameEn).join(", ")} subtitle={o.labStatus ?? o.status} badge={o.sampleCollection ? t("clinic.round.collected") : t("clinic.round.collect")} badgeTone={o.sampleCollection ? "success" : "warning"} onPress={o.sampleCollection ? undefined : () => setCollect(o)} />
              ))}
            </View>
          ) : null}
        </View>
      )}

      <Sheet visible={abort} onClose={() => setAbort(false)} title={t("clinic.round.abortTitle")} testID="abort-sheet" footer={<Button variant="danger" title={t("clinic.round.abortConfirm")} onPress={() => void doAbort()} disabled={reason.trim().length < 3} loading={busy === "abort"} testID="abort-confirm" />}>
        <T variant="small" muted>{t("clinic.round.abortBody")}</T>
        <Row gap={8} style={{ flexWrap: "wrap" }}>{CATS.map((c) => <Chip key={c} label={t(`clinic.round.cat.${c}`)} selected={cat === c} onPress={() => setCat(c)} />)}</Row>
        <Field label={t("common.reason")} value={reason} onChangeText={setReason} multiline testID="abort-reason" />
      </Sheet>

      {v ? <NewOrderSheet visible={order} onClose={() => setOrder(false)} appointmentId={v.appointmentId} onDone={() => { setOrder(false); void orders.refetch(); }} /> : null}
      {v && collect ? <CollectSheet order={collect} patientName={v.patient.name} appointmentId={v.appointmentId} onClose={() => setCollect(null)} onDone={() => { setCollect(null); void orders.refetch(); }} /> : null}
    </Screen>
  );
}

function NewOrderSheet({ visible, onClose, appointmentId, onDone }: { visible: boolean; onClose: () => void; appointmentId: string; onDone: () => void }) {
  const { t } = useTranslation(); const toast = useToast();
  const [code, setCode] = useState(""); const [name, setName] = useState(""); const [doc, setDoc] = useState(""); const [ok, setOk] = useState(false); const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    try { await api.post("clinic", `/nurse/visits/${appointmentId}/lab-orders`, { items: [{ code: code.trim(), nameEn: name.trim() }], prescriber: { name: doc.trim(), orderedOn: new Date().toISOString().slice(0, 10) }, confirmedDoctorOrder: true }); toast.show(t("common.saved")); setCode(""); setName(""); setDoc(""); setOk(false); onDone(); }
    catch (e) { toast.show((e as ApiError).message, "error"); } finally { setBusy(false); }
  };
  return (
    <Sheet visible={visible} onClose={onClose} title={t("clinic.round.newOrder")} testID="order-sheet" footer={<Button title={t("common.save")} onPress={() => void submit()} disabled={!ok || code.trim().length < 1 || name.trim().length < 2 || doc.trim().length < 2} loading={busy} testID="order-save" />}>
      <Field label={t("clinic.round.testCode")} value={code} onChangeText={setCode} autoCapitalize="characters" />
      <Field label={t("clinic.round.testName")} value={name} onChangeText={setName} />
      <Field label={t("clinic.round.doctor")} value={doc} onChangeText={setDoc} />
      <Checkbox checked={ok} onChange={setOk} label={t("clinic.round.confirmOrder")} />
    </Sheet>
  );
}

function CollectSheet({ order, patientName, appointmentId, onClose, onDone }: { order: LabOrder; patientName: string; appointmentId: string; onClose: () => void; onDone: () => void }) {
  const { t } = useTranslation(); const toast = useToast(); const { email } = useClinicBoot();
  const [ids, setIds] = useState<Record<string, string>>({ FULL_NAME: "", DATE_OF_BIRTH: "", PHONE: "" });
  const [tubes, setTubes] = useState<string[]>([]); const [type, setType] = useState("BLOOD"); const [temp, setTemp] = useState(""); const [busy, setBusy] = useState(false);
  const idList = IDENTIFIER_KINDS.map((k) => ({ kind: k, value: ids[k] }));
  const ready = identifiersOk(idList) && tubes.length > 0;
  const custody = useRead<{ status?: string; events?: { type: string; at: string }[] } | { items?: { status: string; at: string }[] }>("clinic", `/nurse/lab-orders/${order.id}/custody`);
  const submit = async () => {
    setBusy(true);
    try {
      const r = await mutate("clinic", "POST", `/nurse/lab-orders/${order.id}/collection`, { appointmentId, identifiers: idList.filter((i) => i.value.trim()), collectedAt: new Date().toISOString(), ...(temp ? { temperatureC: Number(temp) } : {}), tubes: tubes.map((label) => ({ label, specimenType: type })) }, { label: `${t("clinic.round.collect")} · ${patientName}`, owner: email, queueable: false });
      haptic.success(); toast.show(r.queued ? t("sync.queuedToast") : t("clinic.round.handedOff")); onDone();
    } catch (e) { const er = e as ApiError; haptic.error(); toast.show(er.message, "error"); } finally { setBusy(false); }
  };
  return (
    <Sheet visible onClose={onClose} title={t("clinic.round.collect")} testID="collect-sheet" footer={<Button title={t("clinic.round.handOff")} icon="check" onPress={() => void submit()} disabled={!ready} loading={busy} testID="collect-submit" />}>
      <Banner tone="ink" body={t("clinic.round.idHint")} />
      <Field label={t("clinic.round.id.FULL_NAME")} value={ids.FULL_NAME} onChangeText={(x) => setIds((s) => ({ ...s, FULL_NAME: x }))} testID="id-name" />
      <Field label={t("clinic.round.id.DATE_OF_BIRTH")} value={ids.DATE_OF_BIRTH} onChangeText={(x) => setIds((s) => ({ ...s, DATE_OF_BIRTH: x }))} placeholder="YYYY-MM-DD" testID="id-dob" />
      <Field label={t("clinic.round.id.PHONE")} value={ids.PHONE} onChangeText={(x) => setIds((s) => ({ ...s, PHONE: x }))} keyboardType="phone-pad" />
      <T variant="label">{t("clinic.round.tubes")}</T>
      <ScanField placeholder={t("clinic.round.tubeLabel")} testID="tube-input" onCode={(c) => { if (!tubeLabelOk(c)) { toast.show(t("clinic.round.tubeBad"), "error"); return false; } setTubes((s) => (s.includes(c) ? s : [...s, c])); haptic.success(); return true; }} />
      <Row gap={6} style={{ flexWrap: "wrap" }}>{tubes.map((l) => <Chip key={l} label={`${l}  ✕`} selected onPress={() => setTubes((s) => s.filter((x) => x !== l))} />)}</Row>
      <Row gap={6}>{["BLOOD", "URINE", "SWAB"].map((s) => <Chip key={s} label={t(`clinic.round.spec.${s}`)} selected={type === s} onPress={() => setType(s)} />)}</Row>
      <Field label={t("clinic.round.temp")} value={temp} onChangeText={setTemp} keyboardType="decimal-pad" />
      {custody.data ? <KV k={t("clinic.round.custody")} v={(custody.data as { status?: string }).status ?? "-"} /> : null}
    </Sheet>
  );
}
