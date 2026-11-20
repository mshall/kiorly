import { useEffect, useState } from "react";
import { Platform } from "react-native";

type L = (online: boolean) => void;
const ls = new Set<L>();
let online = true;
let started = false;

function set(v: boolean) { if (v !== online) { online = v; ls.forEach((l) => l(v)); } }
export const isOnline = () => online;
/** Lets the API layer and tests flip connectivity (a failed fetch marks us offline; a success marks us online). */
export const markOnline = (v: boolean) => set(v);

export function startNetworkWatcher() {
  if (started) return; started = true;
  if (Platform.OS === "web") {
    if (typeof window === "undefined") return;
    online = typeof navigator === "undefined" ? true : navigator.onLine !== false;
    window.addEventListener("online", () => set(true));
    window.addEventListener("offline", () => set(false));
    return;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const NetInfo = require("@react-native-community/netinfo").default;
    NetInfo.addEventListener((s: { isConnected: boolean | null; isInternetReachable: boolean | null }) => set(!!s.isConnected && s.isInternetReachable !== false));
  } catch { /* netinfo unavailable: stay optimistic, failed requests still mark offline */ }
}
export function useOnline(): boolean {
  const [v, setV] = useState(online);
  useEffect(() => { startNetworkWatcher(); setV(online); ls.add(setV); return () => { ls.delete(setV); }; }, []);
  return v;
}
