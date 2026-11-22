import { useEffect, useState } from "react";
import { View } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { Button, Sheet, T, useToast } from "@/components/ui";
import { useSessions } from "@/auth/SessionProvider";
import { PRODUCT_META, type Product } from "@/api/products";
import { resetPushDiag } from "@/lib/push";
import { haptic } from "@/lib/haptics";

export type SignOutTarget = Product | "all";

/** Sign-out menu + confirm. Opens on a picker (one button per connected product + "everything") or, with `initial`, straight on the confirm step.
 *  Confirming removes the device record on the server (this drops the push token), clears the secure-stored session and caches, and returns to /sign-in once no session is left. */
export function SignOutSheet({ visible, onClose, initial }: { visible: boolean; onClose: () => void; initial?: SignOutTarget }) {
  const { t } = useTranslation();
  const router = useRouter();
  const toast = useToast();
  const { sessions, products, signOut, signOutAll } = useSessions();
  const [target, setTarget] = useState<SignOutTarget | null>(initial ?? null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (visible) { setTarget(initial ?? (products.length === 1 ? products[0] : null)); setBusy(false); } }, [visible, initial]); // eslint-disable-line react-hooks/exhaustive-deps
  const name = (p: Product) => t(PRODUCT_META[p].nameKey);
  const run = async () => {
    if (!target) return;
    setBusy(true);
    try {
      if (target === "all") await signOutAll(); else await signOut(target);
      haptic.success();
      onClose();
      if (target === "all" || products.filter((p) => p !== target).length === 0) { resetPushDiag(); router.replace("/sign-in"); }
    } catch { toast.show(t("signIn.network"), "error"); setBusy(false); }
  };
  const single = products.length === 1;
  return (
    <Sheet visible={visible} onClose={onClose} title={target ? t("signOutDlg.title") : t("signOutDlg.title")} testID="signout-sheet">
      {target === null ? (
        <View style={{ gap: 10 }}>
          <T variant="small" muted>{t("signOutDlg.menuHint")}</T>
          {products.map((p) => <Button key={p} variant="secondary" icon="logout" title={t("upgrade.signOut", { product: name(p) })} onPress={() => setTarget(p)} testID={`signout-pick-${p}`} />)}
          {products.length > 1 ? <Button variant="danger" icon="logout" title={t("me.signOutAll")} onPress={() => setTarget("all")} testID="signout-pick-all" /> : null}
        </View>
      ) : (
        <View style={{ gap: 12 }} testID="signout-confirm">
          <T variant="h2">{target === "all" ? t("signOutDlg.confirmAll") : t("signOutDlg.confirmOne", { product: name(target) })}</T>
          <T muted>{target === "all" ? t("signOutDlg.bodyAll") : t("signOutDlg.bodyOne", { name: sessions[target]?.userName ?? "", product: name(target) })}</T>
          <Button variant="danger" icon="logout" title={t("signOutDlg.confirm")} onPress={() => void run()} loading={busy} testID="signout-confirm-btn" />
          <Button variant="secondary" title={t("common.cancel")} onPress={() => (single || initial ? onClose() : setTarget(null))} testID="signout-cancel" />
        </View>
      )}
    </Sheet>
  );
}
