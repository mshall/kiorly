import { useTranslation } from "react-i18next";
import { Button, useToast } from "@/components/ui";
import { haptic } from "@/lib/haptics";
import { saveQrImage } from "@/lib/qrImage";
import { shareLink } from "@/lib/shareLink";

/** G-16: saves or shares the QR as an image. Android (no file share without a media module) falls back to sharing the link. */
export function QrSaveButton({ svg, url, name, testID }: { svg: string; url: string; name: string; testID?: string }) {
  const { t } = useTranslation();
  const toast = useToast();
  const press = async () => {
    const r = await saveQrImage(svg, name);
    if (r === "shared") { haptic.success(); toast.show(t("qrSave.shared"), "success"); }
    else if (r === "downloaded") { haptic.success(); toast.show(t("qrSave.downloaded"), "success"); }
    else if (r === "unsupported") { toast.show(t("qrSave.androidFallback"), "info"); await shareLink(url, url); }
    else if (r === "failed") { haptic.error(); toast.show(t("qrSave.failed"), "error"); }
  };
  return <Button small variant="secondary" icon="share" title={t("qrSave.label")} onPress={() => void press()} testID={testID ?? "qr-save"} />;
}
