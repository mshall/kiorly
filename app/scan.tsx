import { useState } from "react";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { ScannerSheet } from "@/components/scanner";
import { useSessions } from "@/auth/SessionProvider";
import { useToast } from "@/components/ui";
import { routeForScan } from "@/lib/scanRoute";

/** Universal scanner: routes a code to the right module (specimen -> Lab accessioning, GTIN -> Pharmacy lookup, MRN/QR -> Clinic search). */
export default function Scan() {
  const router = useRouter();
  const { t } = useTranslation();
  const toast = useToast();
  const { products, sessions } = useSessions();
  const [open, setOpen] = useState(true);
  const entitled = products.filter((p) => sessions[p]?.bootstrap?.entitlement.enabled);
  return (
    <ScannerSheet visible={open} onClose={() => { setOpen(false); if (router.canGoBack()) router.back(); else router.replace("/(tabs)"); }}
      onCode={(code) => {
        const r = routeForScan(code, entitled);
        if (!r) { toast.show(t("scan.unknown"), "error"); return false; }
        setOpen(false); router.replace(r as never); return true;
      }} />
  );
}
