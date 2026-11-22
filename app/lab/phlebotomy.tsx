import { useCallback, useState } from "react";
import { Alert, Platform, View } from "react-native";
import { Stack } from "expo-router";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { Banner, Button, Card, Row, Screen, T, useToast } from "@/components/ui";
import { ActionSheet, ListRow, QueryView, Segmented } from "@/components/kit";
import { ScanField } from "@/components/scanner";
import { api } from "@/api/client";
import { useRead, usePullRefresh } from "@/hooks/useRead";
import { haptic } from "@/lib/haptics";
import { formatTime } from "@/lib/format";
import { getGeostamp } from "@/modules/lab/geo";
import SpecimenCard from "@/modules/lab/SpecimenCard";
import { labErrorKey, type ScanResult } from "@/modules/lab/helpers";
import { useTheme } from "@/theme";
import { statusLabel } from "@/lib/status";

interface Spec { id: string; accessionNumber: string; barcode: string; specimenType: string; container: string; status: string; order?: { orderNumber?: string; priority?: string; patient?: { fullName?: string } } }
interface Stop { id: string; status: string; slotStart: string; slotEnd: string; address?: string; order?: { orderNumber?: string; patient?: { fullName?: string } } }

/** Phlebotomy round: scan label -> collect with chain of custody; home-collection route with the field-visit safety controls. */
export default function Phlebotomy() {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const toast = useToast();
  const qc = useQueryClient();
  const [tab, setTab] = useState<"pending" | "route">("pending");
  const [scan, setScan] = useState<{ r: ScanResult; code: string } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [stop, setStop] = useState<Stop | null>(null);
  const pending = useRead<Spec[]>("lab", "/specimens", { query: { status: "PENDING_COLLECTION", limit: 25 } });
  const route = useRead<Stop[]>("lab", "/home-collections/my-route", { enabled: tab === "route" });
  const refresh = usePullRefresh({ refetch: async () => { await Promise.all([pending.refetch(), route.refetch()]); } });
  const onCode = useCallback(async (code: string) => {
    setErr(null);
    try { setScan({ r: await api.get<ScanResult>("lab", "/mobile/scan", { query: { code } }), code }); haptic.success(); return true; } catch (e) { setErr(t(labErrorKey(e))); haptic.error(); return false; }
  }, [t]);
  const field = async (path: string, body: Record<string, unknown>, ok: string) => {
    try { await api.post("lab", `/home-collections/${stop!.id}/${path}`, body); toast.show(ok); void qc.invalidateQueries({ predicate: (q) => q.queryKey[1] === "/home-collections/my-route" }); }
    catch (e) { toast.show(t(labErrorKey(e)), "error"); }
  };
  const sos = async () => { haptic.error(); const g = await getGeostamp(); await field("safety/sos", g ? { lat: g.lat, lng: g.lng } : {}, t("lab.sosSent")); };
  const confirmUnsafe = () => { const go = () => void field("safety/leave-unsafe", {}, t("lab.leftUnsafe")); if (Platform.OS === "web") { if (window.confirm(t("lab.leaveUnsafeConfirm"))) go(); } else Alert.alert(t("lab.leaveUnsafe"), t("lab.leaveUnsafeConfirm"), [{ text: t("common.cancel") }, { text: t("lab.leaveUnsafe"), style: "destructive", onPress: go }]); };
  const arrive = async () => { const g = await getGeostamp(); if (!g) { toast.show(t("lab.noLocation"), "error"); return; } await field("arrive", { geostamp: g }, t("lab.arrived")); };
  return (
    <Screen refresh={refresh} testID="lab-phlebotomy">
      <Stack.Screen options={{ title: t("tiles.lab.phlebotomy.title") }} />
      <ScanField testID="phleb-field" placeholder={t("lab.scanPlaceholder")} onCode={onCode} />
      {err ? <Banner tone="danger" body={err} testID="phleb-error" /> : null}
      {scan ? <SpecimenCard key={scan.r.specimen?.id + String(scan.r.specimen?.status)} scan={scan.r} scannedCode={scan.code} onChanged={() => { void pending.refetch(); void onCode(scan.code); }} /> : null}
      <Segmented value={tab} onChange={setTab} options={[{ value: "pending", label: t("lab.pendingCollection"), count: pending.data?.length }, { value: "route", label: t("lab.homeRoute") }]} />
      {tab === "pending" ? (
        <QueryView q={pending} cached={pending.fromCache} isEmpty={(d) => !d.length} empty={{ icon: "syringe", title: t("lab.nothingToCollect") }}>
          {(d) => <View style={{ gap: 10 }}>{d.map((s) => <ListRow key={s.id} testID={`spec-${s.accessionNumber}`} icon="syringe" iconTone={s.order?.priority && s.order.priority !== "ROUTINE" ? "danger" : "ocean"} title={s.accessionNumber} subtitle={`${s.order?.patient?.fullName ?? ""} · ${s.specimenType}`} meta={s.container} badge={s.order?.priority !== "ROUTINE" ? statusLabel(t, s.order?.priority, { kind: "priority" }) : undefined} badgeTone="danger" onPress={() => void onCode(s.barcode)} />)}</View>}
        </QueryView>
      ) : (
        <QueryView q={route} isEmpty={(d) => !d.length} empty={{ icon: "navigation", title: t("lab.noRoute") }}>
          {(d) => <View style={{ gap: 10 }}>{d.map((s) => <ListRow key={s.id} testID={`stop-${s.id}`} icon="navigation" title={s.order?.patient?.fullName ?? s.order?.orderNumber ?? s.id} subtitle={s.address} meta={`${formatTime(s.slotStart, i18n.language)} - ${formatTime(s.slotEnd, i18n.language)}`} badge={statusLabel(t, s.status, { scope: "lab" })} badgeTone="ocean" onPress={() => setStop(s)} />)}</View>}
        </QueryView>
      )}
      <ActionSheet visible={!!stop} onClose={() => setStop(null)} title={t("lab.visitActions")} actions={[
        { label: t("lab.startTrip"), icon: "navigation", onPress: () => void field("start", {}, t("lab.tripStarted")) },
        { label: t("lab.arrive"), icon: "pin", onPress: () => void arrive() },
        { label: t("lab.imOk"), icon: "check", onPress: () => void field("safety/answer", {}, t("lab.imOkSent")) },
        { label: t("lab.sos"), icon: "alert", tone: "danger", onPress: () => void sos() },
        { label: t("lab.leaveUnsafe"), icon: "logout", tone: "danger", onPress: confirmUnsafe },
      ]} />
      {tab === "route" ? <Card style={{ borderColor: colors.danger }}><Row gap={10}><T variant="small" muted style={{ flex: 1 }}>{t("lab.sosHint")}</T></Row><Button variant="danger" title={t("lab.sos")} icon="alert" disabled={!stop && !route.data?.length} onPress={() => (stop ? void sos() : setStop(route.data?.[0] ?? null))} testID="sos-button" /></Card> : null}
    </Screen>
  );
}
