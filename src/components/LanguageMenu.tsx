import { useState } from "react";
import { Platform, Pressable, View } from "react-native";
import { useTranslation } from "react-i18next";
import { layout, radii, useTheme } from "@/theme";
import { Sheet, T } from "@/components/ui";
import { Icon } from "@/components/Icon";
import { haptic } from "@/lib/haptics";
import { setLanguage, type Lang } from "@/i18n";
import { handleRestart } from "@/i18n/restart";

/** Each language is named in its OWN script (never translated), so a person who cannot read the current UI language can still find theirs. */
export const LANGUAGES: ReadonlyArray<{ code: Lang; name: string; short: string }> = [
  { code: "ar", name: "العربية", short: "AR" },
  { code: "en", name: "English", short: "EN" },
];

/** ONE compact language control: a globe button with the current code that opens a bottom sheet (native feel, thumb reachable) listing العربية and English with a check on the current one.
 *  Selecting applies the language immediately; when the layout direction has to flip on a native build the app restarts through the shared restart helper.
 *  `variant="row"` renders the same control as a settings row trigger (label left, current language and chevron right). */
export function LanguageMenu({ variant = "button", onChanged, testID = "language-menu" }: { variant?: "button" | "row"; onChanged?: (restartNeeded: boolean) => void; testID?: string }) {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  const cur: Lang = i18n.language.startsWith("ar") ? "ar" : "en";
  const info = LANGUAGES.find((l) => l.code === cur)!;
  const label = `${t("me.language")}: ${info.name}`;
  const pick = async (l: Lang) => {
    setOpen(false);
    if (l === cur) return;
    haptic.select();
    const flip = await setLanguage(l);
    const restart = flip ? (await handleRestart({ force: false })) === "manual" : false;
    onChanged?.(restart);
  };
  return (
    <>
      {variant === "row" ? (
        <Pressable testID={testID} onPress={() => { haptic.tap(); setOpen(true); }} accessibilityRole="button" accessibilityLabel={label} accessibilityHint={t("me.language")} accessibilityState={{ expanded: open }}
          style={({ pressed }) => ({ minHeight: layout.touch, flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 4, borderRadius: radii.md, backgroundColor: pressed ? colors.soft : "transparent" })}>
          <Icon name="globe" size={22} color={colors.ink} />
          <T weight="semibold" style={{ flex: 1 }}>{t("me.language")}</T>
          <T variant="small" muted>{info.name}</T>
          <Icon name="chevronDown" size={18} color={colors.subtleText} />
        </Pressable>
      ) : (
        <Pressable testID={testID} onPress={() => { haptic.tap(); setOpen(true); }} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ expanded: open }} hitSlop={4}
          style={({ pressed }) => ({ height: layout.touch, minWidth: layout.touch, paddingHorizontal: 12, borderRadius: radii.full, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, borderWidth: 1, borderColor: pressed ? colors.ink : colors.border, backgroundColor: pressed ? colors.soft : colors.surface })}>
          <Icon name="globe" size={18} color={colors.ink} />
          <T variant="caption" weight="semibold" forceLatin color={colors.text} style={{ letterSpacing: 0.6 }}>{info.short}</T>
          <Icon name="chevronDown" size={14} color={colors.subtleText} />
        </Pressable>
      )}
      <Sheet visible={open} onClose={() => setOpen(false)} title={t("me.language")} testID={`${testID}-sheet`}>
        <View accessibilityRole={Platform.OS === "web" ? undefined : "radiogroup"} style={{ gap: 8 }}>
          {LANGUAGES.map((l) => {
            const sel = l.code === cur;
            return (
              <Pressable key={l.code} testID={`${testID}-${l.code}`} onPress={() => void pick(l.code)} accessibilityRole="radio" accessibilityState={{ selected: sel, checked: sel }} accessibilityLabel={l.name}
                style={({ pressed }) => ({ minHeight: 56, borderRadius: radii.md, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderWidth: sel ? 2 : 1, borderColor: sel ? colors.ink : colors.border, backgroundColor: sel ? colors.soft : pressed ? colors.raised : colors.surface })}>
                <T weight={sel ? "semibold" : "medium"} style={{ fontSize: 17 }} {...({ lang: l.code } as object)}>{l.name}</T>
                {sel ? <Icon name="check" size={20} color={colors.ink} /> : null}
              </Pressable>
            );
          })}
        </View>
      </Sheet>
    </>
  );
}
