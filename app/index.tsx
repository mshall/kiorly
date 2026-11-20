import { Redirect } from "expo-router";
import { useSessions } from "@/auth/SessionProvider";

export default function Index() {
  const { ready, products } = useSessions();
  if (!ready) return null;
  return <Redirect href={products.length ? "/(tabs)" : "/sign-in"} />;
}
