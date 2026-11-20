import { Platform } from "react-native";
import * as Location from "expo-location";

export interface Pos { lat: number; lng: number; accuracy?: number }
/** One-shot position for geostamps / SOS. Resolves null when permission is denied or the platform has no GPS (web without HTTPS, simulators). */
export async function getPosition(timeoutMs = 8000): Promise<Pos | null> {
  try {
    if (Platform.OS === "web") {
      if (typeof navigator === "undefined" || !navigator.geolocation) return null;
      return await new Promise<Pos | null>((res) => navigator.geolocation.getCurrentPosition((p) => res({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy }), () => res(null), { timeout: timeoutMs, maximumAge: 30_000 }));
    }
    const perm = await Location.requestForegroundPermissionsAsync();
    if (!perm.granted) return null;
    const p = await Promise.race([Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }), new Promise<null>((r) => setTimeout(() => r(null), timeoutMs))]);
    return p ? { lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy ?? undefined } : null;
  } catch { return null; }
}
