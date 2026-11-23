import { Platform } from "react-native";
import { prefs } from "@/lib/storage";

/**
 * The sign-in screen offers exactly two methods: "Sign in with Kiorex Passport" (the default) and "Password".
 * The last method that actually signed the user in is remembered on this device and preselected next time; without a (valid) memory, or when
 * Passport is not offered, the choice falls back to Passport (when offered) or Password.
 */
export type SignInMethod = "passport" | "password";
export const SIGN_IN_METHOD_KEY = "kiorly.signin.method";
export const parseSignInMethod = (v: unknown): SignInMethod | null => (v === "passport" || v === "password" ? v : null);

/** Passport is the default whenever it is offered; a stored `password` only wins when Passport is offered AND the user last used the password. */
export function resolveSignInMethod(passportOffered: boolean, stored: unknown): SignInMethod {
  if (!passportOffered) return "password";
  return parseSignInMethod(stored) ?? "passport";
}

/** Expo web: AsyncStorage is localStorage, so the memory can be read synchronously and the first paint already shows the right method. */
export function initialSignInMethod(passportOffered: boolean): SignInMethod {
  let stored: unknown = null;
  if (Platform.OS === "web") { try { stored = globalThis.localStorage?.getItem(SIGN_IN_METHOD_KEY); } catch { /* storage blocked */ } }
  return resolveSignInMethod(passportOffered, stored);
}
export async function loadSignInMethod(passportOffered: boolean): Promise<SignInMethod> { return resolveSignInMethod(passportOffered, await prefs.get(SIGN_IN_METHOD_KEY)); }
export async function rememberSignInMethod(method: SignInMethod): Promise<void> { await prefs.set(SIGN_IN_METHOD_KEY, method); }

/** The entry tile (Clinic / Nurse / Pharmacy / Lab) last used to sign in on this device is preselected next time. */
export const SIGN_IN_ENTRY_KEY = "kiorly.signin.entry";
export function initialSignInEntry<E extends string>(entries: readonly E[], fallback: E): E {
  if (Platform.OS === "web") { try { const v = globalThis.localStorage?.getItem(SIGN_IN_ENTRY_KEY); if (v && (entries as readonly string[]).includes(v)) return v as E; } catch { /* storage blocked */ } }
  return fallback;
}
export async function loadSignInEntry<E extends string>(entries: readonly E[], fallback: E): Promise<E> {
  const v = await prefs.get(SIGN_IN_ENTRY_KEY); return v && (entries as readonly string[]).includes(v) ? (v as E) : fallback;
}
export async function rememberSignInEntry(entry: string): Promise<void> { await prefs.set(SIGN_IN_ENTRY_KEY, entry); }
