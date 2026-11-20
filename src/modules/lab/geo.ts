import { Platform } from "react-native";
import * as Location from "expo-location";

export interface Geostamp { lat: number; lng: number; accuracy?: number; at: string }
/** One-shot position for check-in / SOS. Never throws: returns null when permission is denied or unavailable (the server accepts SOS without a fix). */
export async function getGeostamp(): Promise<Geostamp | null> {
  try {
    if (Platform.OS === "web") {
      if (typeof navigator === "undefined" || !navigator.geolocation) return null;
      return await new Promise((res) => navigator.geolocation.getCurrentPosition((p) => res({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy, at: new Date().toISOString() }), () => res(null), { timeout: 6000 }));
    }
    const perm = await Location.requestForegroundPermissionsAsync();
    if (!perm.granted) return null;
    const p = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    return { lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy ?? undefined, at: new Date(p.timestamp).toISOString() };
  } catch { return null; }
}
