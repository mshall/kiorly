import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";

/** Tokens: Keychain/Keystore on device (expo-secure-store). On web SecureStore is unavailable, so sessionStorage is used. */
export const secureStore = {
  async get(key: string): Promise<string | null> {
    try {
      if (Platform.OS === "web") return typeof sessionStorage === "undefined" ? null : sessionStorage.getItem(key);
      return await SecureStore.getItemAsync(key);
    } catch { return null; }
  },
  async set(key: string, value: string) {
    try {
      if (Platform.OS === "web") sessionStorage.setItem(key, value);
      else await SecureStore.setItemAsync(key, value);
    } catch { /* ignore */ }
  },
  async remove(key: string) {
    try {
      if (Platform.OS === "web") sessionStorage.removeItem(key);
      else await SecureStore.deleteItemAsync(key);
    } catch { /* ignore */ }
  },
};

/** Non-sensitive preferences (language, theme, recently viewed ids, selected patient). Never PHI. */
export const prefs = {
  async get(key: string) { try { return await AsyncStorage.getItem(key); } catch { return null; } },
  async set(key: string, value: string) { try { await AsyncStorage.setItem(key, value); } catch { /* ignore */ } },
};
