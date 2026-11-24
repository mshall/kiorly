import { useEffect } from "react";
import { useRouter } from "expo-router";
import { useSessions } from "@/auth/SessionProvider";
import { takePendingRoute } from "@/lib/pendingRoute";

/** Replays a held `/open/<key>:<id>` link once a session exists (GRW-P1-H). Mount in the Shell. */
export function useDeepLinkReplay() {
  const router = useRouter();
  const { ready, products } = useSessions();
  const signedIn = ready && products.length > 0;
  useEffect(() => { if (!signedIn) return; const p = takePendingRoute(); if (p) router.push(p as never); }, [signedIn]); // eslint-disable-line react-hooks/exhaustive-deps
}
