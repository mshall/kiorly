import { useEffect, useState } from "react";
import { Pressable, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useQueries } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { fontFamily, radius, useTheme } from "@/theme";
import { Row, Screen, T } from "@/components/ui";
import { Icon } from "@/components/Icon";
import { EmptyState } from "@/components/states";
import { ListRow, SectionTitle, SkeletonList } from "@/components/kit";
import { useSessions } from "@/auth/SessionProvider";
import { api } from "@/api/client";
import { PRODUCT_META, type Product } from "@/api/products";
import { buildHits, searchPath, type Hit } from "@/lib/search";

/** Global search across every connected product the user is entitled to. */
export default function Search() {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { products, isEntitled } = useSessions();
  const [q, setQ] = useState(""); const [dq, setDq] = useState("");
  useEffect(() => { const id = setTimeout(() => setDq(q.trim()), 300); return () => clearTimeout(id); }, [q]);
  const active = products.filter((p) => isEntitled(p));
  const results = useQueries({ queries: active.map((p) => ({ queryKey: [p, "search", dq], enabled: dq.length >= 2, queryFn: async () => buildHits(p, await api.get(p, searchPath(p), { query: { q: dq } })), retry: 0 })) });
  const hits: Hit[] = results.flatMap((r) => r.data ?? []);
  const ar = i18n.language.startsWith("ar");
  const loading = dq.length >= 2 && results.some((r) => r.isLoading);
  const groups = (["patients", "drugs", "customers", "prescriptions", "orders", "specimens", "appointments"] as const).map((g) => [g, hits.filter((h) => h.group === g)] as const).filter(([, a]) => a.length);
  return (
    <Screen scroll style={{ paddingTop: insets.top + 8, gap: 12 }} testID="search">
      <Row gap={8}>
        <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel={t("common.back")} style={{ width: 44, height: 44, justifyContent: "center" }}><Icon name="back" color={colors.ink} mirror /></Pressable>
        <TextInput testID="search-input" autoFocus value={q} onChangeText={setQ} placeholder={t("search.placeholder")} placeholderTextColor={colors.subtleText} returnKeyType="search" autoCapitalize="none"
          style={{ flex: 1, minHeight: 48, borderRadius: radius, paddingHorizontal: 14, color: colors.text, backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.ink, fontSize: 16, fontFamily: fontFamily(i18n.language, "regular"), textAlign: ar ? "right" : "left" }} />
      </Row>
      {dq.length < 2 ? <T variant="small" muted style={{ textAlign: "center", marginTop: 24 }}>{t("search.hint")}</T> : loading && !hits.length ? <SkeletonList rows={4} /> : !hits.length ? <EmptyState title={t("search.noResults")} /> : groups.map(([g, arr]) => (
        <View key={g} style={{ gap: 8 }}>
          <SectionTitle title={t(`search.${g}`)} />
          {arr.map((h) => <ListRow key={h.product + h.id} testID={`hit-${h.id}`} icon={h.icon} title={h.title} subtitle={h.subtitle} meta={t(PRODUCT_META[h.product as Product].nameKey)} onPress={() => router.push(h.route as never)} />)}
        </View>
      ))}
    </Screen>
  );
}
