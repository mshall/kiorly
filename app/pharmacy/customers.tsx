import { useEffect, useState } from "react";
import { Stack, useLocalSearchParams } from "expo-router";
import { TextInput, View } from "react-native";
import { Badge, Card, Row, Screen, T } from "@/components/ui";
import { Icon } from "@/components/Icon";
import { KV, QueryView, SkeletonList } from "@/components/kit";
import { EmptyState } from "@/components/states";
import { useRead } from "@/hooks/useRead";
import { fontFamily, radius, useTheme } from "@/theme";
import { usePh } from "@/modules/pharmacy/hooks";
import { Sheet } from "@/components/ui";

interface Cust { id: string; customerNo: string; displayName: string; phone?: string; allergies: string[]; chronicConditions: string[]; pregnant?: boolean; lactating?: boolean; renalImpairment?: boolean; hepaticImpairment?: boolean; loyaltyTier?: string; loyaltyPoints?: number; medicalNotes?: string | null }

/** Quick customer lookup. PHI (allergies / conditions) is shown but never logged or cached outside the offline read cache. */
export default function Customers() {
  const { q: initial } = useLocalSearchParams<{ q?: string }>();
  const { t, i18n } = (() => { const p = usePh(); return { t: p.t, i18n: { language: p.lang } }; })();
  const { colors } = useTheme();
  const [q, setQ] = useState(initial ? String(initial) : ""); const [dq, setDq] = useState(q);
  const [sel, setSel] = useState<Cust | null>(null);
  useEffect(() => { const id = setTimeout(() => setDq(q.trim()), 300); return () => clearTimeout(id); }, [q]);
  const res = useRead<{ total: number; items: Cust[] }>("pharmacy", "/customers", { query: { q: dq, pageSize: 25 }, enabled: dq.length >= 2 });
  return (
    <Screen testID="customers">
      <Stack.Screen options={{ title: t("pharmacy.tile.customers") }} />
      <Row gap={8}>
        <TextInput testID="customer-search" value={q} onChangeText={setQ} autoFocus={!initial} placeholder={t("pharmacy.customers.placeholder")} placeholderTextColor={colors.subtleText} autoCapitalize="none"
          style={{ flex: 1, minHeight: 48, borderRadius: radius, paddingHorizontal: 14, color: colors.text, backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.ink, fontSize: 16, fontFamily: fontFamily(i18n.language, "regular"), textAlign: i18n.language.startsWith("ar") ? "right" : "left" }} />
      </Row>
      {dq.length < 2 ? <EmptyState icon="users" title={t("pharmacy.customers.hint")} /> : res.isLoading ? <SkeletonList rows={4} /> : (
        <QueryView q={res} isEmpty={(d) => !d.items.length} empty={{ icon: "search", title: t("search.noResults") }}>
          {(d) => <View style={{ gap: 10 }}>{d.items.map((c) => (
            <Card key={c.id} testID={`cust-${c.id}`} onPress={() => setSel(c)} style={{ gap: 6, padding: 12 }}>
              <Row style={{ justifyContent: "space-between" }}><T weight="semibold">{c.displayName}</T><T variant="caption" muted>{c.customerNo}</T></Row>
              <T variant="small" muted>{c.phone}</T>
              <Row gap={6} style={{ flexWrap: "wrap" }}>
                {c.allergies.map((a) => <Badge key={a} tone="danger" label={a} icon="alert" />)}
                {c.chronicConditions.map((a) => <Badge key={a} tone="ocean" label={a} />)}
                {c.pregnant ? <Badge tone="warning" label={t("pharmacy.customers.pregnant")} /> : null}
                {c.lactating ? <Badge tone="warning" label={t("pharmacy.customers.lactating")} /> : null}
              </Row>
            </Card>))}</View>}
        </QueryView>
      )}
      <Sheet visible={!!sel} onClose={() => setSel(null)} title={sel?.displayName ?? ""}>
        {sel ? (<>
          <KV k={t("common.phone")} v={sel.phone} /><KV k="#" v={sel.customerNo} />
          <KV k={t("pharmacy.customers.loyalty")} v={`${sel.loyaltyTier ?? "-"} · ${sel.loyaltyPoints ?? 0}`} />
          <KV k={t("pharmacy.rx.allergies")} v={sel.allergies.join(", ") || t("common.none")} tone={sel.allergies.length ? "danger" : undefined} />
          <KV k={t("pharmacy.customers.conditions")} v={sel.chronicConditions.join(", ") || t("common.none")} />
          {sel.renalImpairment || sel.hepaticImpairment ? <Row gap={6}><Icon name="alert" size={14} color={colors.warning} /><T variant="small">{[sel.renalImpairment && t("pharmacy.customers.renal"), sel.hepaticImpairment && t("pharmacy.customers.hepatic")].filter(Boolean).join(" · ")}</T></Row> : null}
          {sel.medicalNotes ? <T variant="small" muted>{sel.medicalNotes}</T> : null}
        </>) : null}
      </Sheet>
    </Screen>
  );
}
