import { useCallback, useEffect, useState } from "react";
import { Stack, useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";
import { Banner, Card, Screen, T } from "@/components/ui";
import { ListRow, SkeletonList } from "@/components/kit";
import { ScanField } from "@/components/scanner";
import { api } from "@/api/client";
import { ApiError } from "@/api/errors";
import { ErrorState } from "@/components/states";
import SpecimenCard from "@/modules/lab/SpecimenCard";
import type { ScanResult } from "@/modules/lab/helpers";
import { statusLabel } from "@/lib/status";

/** Accessioning: scan a specimen barcode / accession / order number -> receive & process. */
export default function Accession() {
  const { t } = useTranslation();
  const { code: initial } = useLocalSearchParams<{ code?: string }>();
  const [code, setCode] = useState<string>(initial ?? "");
  const [scan, setScan] = useState<ScanResult | null>(null);
  const [busy, setBusy] = useState(false); const [err, setErr] = useState<unknown>(null);
  const lookup = useCallback(async (c: string) => {
    setCode(c); setBusy(true); setErr(null);
    try { setScan(await api.get<ScanResult>("lab", "/mobile/scan", { query: { code: c } })); } catch (e) { setScan(null); setErr(e); } finally { setBusy(false); }
  }, []);
  useEffect(() => { if (initial) void lookup(initial); }, [initial, lookup]);
  const notFound = err instanceof ApiError && err.status === 404;
  return (
    <Screen testID="lab-accession">
      <Stack.Screen options={{ title: t("tiles.lab.accession.title") }} />
      <ScanField testID="accession-field" placeholder={t("lab.scanPlaceholder")} onCode={(c) => { void lookup(c); }} autoFocus />
      {busy ? <SkeletonList rows={2} /> : null}
      {notFound ? <Banner tone="warning" body={t("lab.specimenNotFound")} testID="not-found" /> : err ? <ErrorState error={err} onRetry={() => void lookup(code)} /> : null}
      {scan?.type === "SPECIMEN" ? <SpecimenCard key={scan.specimen?.id + String(scan.specimen?.status)} scan={scan} scannedCode={code} onChanged={() => void lookup(code)} /> : null}
      {scan?.type === "ORDER" ? (
        <Card style={{ gap: 8 }} testID="order-scan">
          <T variant="h2">{scan.order?.orderNumber}</T>
          <T variant="small" muted>{scan.order?.patient?.fullName} · {statusLabel(t, scan.order?.status, { scope: "lab" })}</T>
          {(scan.specimens ?? []).map((s) => <ListRow key={s.id} icon="syringe" title={s.accessionNumber} subtitle={statusLabel(t, s.status, { scope: "lab" })} onPress={() => void lookup(s.accessionNumber)} />)}
        </Card>
      ) : null}
      {!scan && !busy && !err ? <T variant="small" muted style={{ textAlign: "center" }}>{t("lab.accessionHint")}</T> : null}
    </Screen>
  );
}
