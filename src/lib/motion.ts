// Motion helpers: reduced-motion awareness and a jest guard so looping animations never keep a test worker alive.
import { useEffect, useState } from "react";
import { AccessibilityInfo, Platform } from "react-native";

export const animationsEnabled = !process.env.JEST_WORKER_ID;
/** Native driver is unavailable on web (it warns and falls back); use it everywhere else. */
export const nativeDriver = Platform.OS !== "web";

export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(!animationsEnabled);
  useEffect(() => {
    if (!animationsEnabled) return;
    let live = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((v) => { if (live) setReduced(!!v); }).catch(() => {});
    const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", (v) => setReduced(!!v));
    return () => { live = false; sub?.remove?.(); };
  }, []);
  return reduced;
}
