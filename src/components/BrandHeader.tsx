import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { layout, useTheme } from "@/theme";
import { KiorlyLockup } from "@/components/Logo";

/** Quiet brand bar: Kiorly lockup on the leading edge, controls on the trailing edge, on the plain screen surface (no banner, no gradient). Respects the top safe area; 56 pt tall below it.
 *  `bordered` adds a hairline underneath (use when content scrolls under it). */
export function BrandHeader({ children, bordered = false, testID = "brand-header", lockupTestID = "brand-lockup" }: { children?: ReactNode; bordered?: boolean; testID?: string; lockupTestID?: string }) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  return (
    <View testID={testID} style={{ paddingTop: insets.top, paddingHorizontal: layout.gutter + 4, borderBottomWidth: bordered ? StyleSheet.hairlineWidth : 0, borderBottomColor: colors.border }}>
      <View style={{ height: layout.headerH, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <View testID={lockupTestID} accessible accessibilityRole="header" accessibilityLabel={t("app.name")} style={{ flexShrink: 1 }}><KiorlyLockup height={44} /></View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexShrink: 0 }}>{children}</View>
      </View>
    </View>
  );
}
