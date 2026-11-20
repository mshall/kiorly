import { useCallback, useEffect, useRef, useState } from "react";
import { Modal, Platform, Pressable, TextInput, View } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { fontFamily, MIN_TOUCH, radius, useTheme } from "@/theme";
import { haptic } from "@/lib/haptics";
import { Button, Row, T } from "./ui";
import { Icon } from "./Icon";

const TYPES = ["qr", "ean13", "ean8", "code128", "code39", "upc_a", "upc_e", "datamatrix", "itf14", "pdf417"] as const;
/** Debounce identical scans (cameras report the same code many times a second). */
export const shouldAccept = (code: string, last: { code: string; at: number } | null, now: number, windowMs = 1500) => !last || last.code !== code || now - last.at > windowMs;

/** Full-screen scanner. `onCode` may return false to keep scanning (e.g. unknown code) or true/void to close. */
export function ScannerSheet({ visible, onClose, onCode, title, hint }: { visible: boolean; onClose: () => void; onCode: (code: string) => boolean | void | Promise<boolean | void>; title?: string; hint?: string }) {
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const [perm, requestPerm] = useCameraPermissions();
  const [manual, setManual] = useState("");
  const last = useRef<{ code: string; at: number } | null>(null);
  useEffect(() => { if (visible) { last.current = null; setManual(""); } }, [visible]);
  const handle = useCallback(async (raw: string) => {
    const code = raw.trim();
    if (!code || !shouldAccept(code, last.current, Date.now())) return;
    last.current = { code, at: Date.now() };
    haptic.success();
    const keep = await onCode(code);
    if (keep !== false) onClose();
  }, [onCode, onClose]);
  const canCamera = !!perm?.granted;
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={{ flex: 1, backgroundColor: "#0F1024", paddingTop: insets.top }} testID="scanner">
        <Row style={{ padding: 16, justifyContent: "space-between" }}>
          <T variant="h2" color="#fff" accessibilityRole="header">{title ?? t("scan.title")}</T>
          <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel={t("common.close")} style={{ width: MIN_TOUCH, height: MIN_TOUCH, alignItems: "center", justifyContent: "center" }}><Icon name="close" color="#fff" /></Pressable>
        </Row>
        <View style={{ flex: 1, marginHorizontal: 16, borderRadius: 24, overflow: "hidden", backgroundColor: "#1B1C3A", alignItems: "center", justifyContent: "center" }}>
          {canCamera ? (
            <CameraView style={{ flex: 1, alignSelf: "stretch" }} facing="back" barcodeScannerSettings={{ barcodeTypes: [...TYPES] }} onBarcodeScanned={(e) => void handle(e.data)} />
          ) : (
            <View style={{ padding: 24, alignItems: "center", gap: 12 }}>
              <Icon name="scan" size={56} color="#7DD3FC" />
              <T color="#fff" style={{ textAlign: "center" }}>{Platform.OS === "web" && !perm ? t("scan.unsupported") : t("scan.permission")}</T>
              {perm && !perm.granted ? <Button title={t("scan.grant")} onPress={() => void requestPerm()} /> : null}
            </View>
          )}
          {canCamera ? <View pointerEvents="none" style={{ position: "absolute", width: 240, height: 160, borderRadius: 20, borderWidth: 3, borderColor: "#E8735E" }} /> : null}
        </View>
        <View style={{ padding: 16, gap: 10, paddingBottom: insets.bottom + 16 }}>
          <T variant="small" color="#C7CCE6" style={{ textAlign: "center" }}>{hint ?? t("scan.hint")}</T>
          <Row gap={8}>
            <TextInput testID="scanner-manual" value={manual} onChangeText={setManual} onSubmitEditing={() => void handle(manual)} placeholder={t("scan.manual")} placeholderTextColor="#8E94B8" autoCapitalize="none" autoCorrect={false} returnKeyType="go"
              style={{ flex: 1, height: 48, borderRadius: radius, paddingHorizontal: 14, color: "#fff", backgroundColor: "#262850", fontFamily: fontFamily(i18n.language, "regular"), fontSize: 16 }} />
            <Button title={t("scan.go")} onPress={() => void handle(manual)} disabled={!manual.trim()} testID="scanner-go" />
          </Row>
        </View>
      </View>
    </Modal>
  );
}

/** Text field with a scan button: manual entry is always available (hardware scanners type into it too). */
export function ScanField({ onCode, placeholder, hint, testID, autoFocus }: { onCode: (code: string) => boolean | void | Promise<boolean | void>; placeholder?: string; hint?: string; testID?: string; autoFocus?: boolean }) {
  const { colors } = useTheme();
  const { t, i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const [v, setV] = useState("");
  const submit = async () => { const c = v.trim(); if (!c) return; const keep = await onCode(c); if (keep !== false) setV(""); };
  return (
    <>
      <Row gap={8}>
        <TextInput testID={testID ?? "scan-field"} value={v} onChangeText={setV} onSubmitEditing={() => void submit()} placeholder={placeholder ?? t("common.enterCode")} placeholderTextColor={colors.subtleText} autoCapitalize="none" autoCorrect={false} autoFocus={autoFocus} returnKeyType="search"
          style={{ flex: 1, minHeight: 48, borderRadius: radius, paddingHorizontal: 14, color: colors.text, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderStrong, fontFamily: fontFamily(i18n.language, "regular"), fontSize: 16, textAlign: i18n.language.startsWith("ar") ? "right" : "left" }} />
        <Pressable testID="scan-open" onPress={() => setOpen(true)} accessibilityRole="button" accessibilityLabel={t("common.scan")} style={{ width: 48, height: 48, borderRadius: radius, backgroundColor: colors.ink, alignItems: "center", justifyContent: "center" }}><Icon name="scan" size={22} color={colors.onInk} /></Pressable>
      </Row>
      {hint ? <T variant="caption" muted>{hint}</T> : null}
      <ScannerSheet visible={open} onClose={() => setOpen(false)} onCode={onCode} />
    </>
  );
}
