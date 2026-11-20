import { useEffect } from "react";
import { AppState } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import { useSessions } from "@/auth/SessionProvider";
import { loadQueue } from "./queue";
import { syncNow } from "./mutate";
import { useOnline } from "./network";

/** Replays the offline queue when connectivity returns, on foreground and every 60 s while online. */
export function SyncDriver() {
  const { sessions } = useSessions();
  const online = useOnline();
  const qc = useQueryClient();
  const owners = Object.values(sessions).map((s) => s!.email).join(",");
  useEffect(() => {
    if (!online || !owners) return;
    let stop = false;
    const run = async () => {
      await loadQueue();
      for (const o of owners.split(",")) {
        const r = await syncNow(o);
        if (!stop && r.sent) void qc.invalidateQueries();
      }
    };
    void run();
    const id = setInterval(() => void run(), 60_000);
    const sub = AppState.addEventListener("change", (s) => { if (s === "active") void run(); });
    return () => { stop = true; clearInterval(id); sub.remove(); };
  }, [online, owners, qc]);
  return null;
}
