import { View } from "react-native";
import { useTranslation } from "react-i18next";
import { Badge, Card, Chip, Row, T } from "@/components/ui";
import { haptic } from "@/lib/haptics";
import type { Product, SignInEntry } from "@/api/products";
import { DEMO_ACCOUNTS } from "./demoAccounts";

/** DEV ONLY "Test users (dev only)" chips on the sign-in screen: tap fills the credentials of a synthetic persona (then press Sign in). Loaded behind `__DEV__` only. */
export function DevTestUsers({ product, entry, onPick }: { product: Product; entry: SignInEntry; onPick: (a: { email: string; password: string; org: string }) => void }) {
  const { i18n } = useTranslation();
  const ar = i18n.language.startsWith("ar");
  return (
    <Card style={{ gap: 10 }} testID="dev-test-users">
      <Row style={{ justifyContent: "space-between" }}>
        <T variant="small" weight="semibold" accessibilityRole="header">{ar ? "مستخدمو الاختبار (للتطوير فقط)" : "Test users (dev only)"}</T>
        <Badge label="DEV" tone="warning" />
      </Row>
      <T variant="caption" muted>{ar ? "للتطوير المحلي فقط: اضغط لملء بيانات مستخدم تجريبي ثم سجّل الدخول." : "Local development only: tap to fill a synthetic user, then Sign in."}</T>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {DEMO_ACCOUNTS[product].filter((d) => (entry === "nurse" ? d.nurse : entry === "clinic" ? !d.nurse : true)).map((d) => (
          <Chip key={d.email} testID={`demo-${d.email}`} label={`${d.label} · ${d.plan}`} onPress={() => { onPick({ email: d.email, password: d.password ?? "", org: d.org ?? "" }); haptic.tap(); }} />
        ))}
      </View>
    </Card>
  );
}
