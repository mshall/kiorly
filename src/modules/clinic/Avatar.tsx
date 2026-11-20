import { View } from "react-native";
import { useTheme } from "@/theme";
import { T } from "@/components/ui";

export function Avatar({ name, size = 40 }: { name: string; size?: number }) {
  const { colors } = useTheme();
  const initial = name.replace(/^(د\.|Dr\.?)\s*/i, "").trim().charAt(0) || "K";
  return (
    <View aria-hidden style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: colors.soft, alignItems: "center", justifyContent: "center" }}>
      <T weight="bold" color={colors.ink} style={{ fontSize: size * 0.4, lineHeight: size * 0.55 }}>{initial}</T>
    </View>
  );
}
