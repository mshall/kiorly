import { useSessions } from "@/auth/SessionProvider";

/** Lab session + role facts for screens. */
export function useLab() {
  const { sessions } = useSessions();
  const session = sessions.lab;
  const b = session?.bootstrap;
  const mod = (k: string) => b?.modules.find((m) => m.key === k);
  return {
    session, bootstrap: b, owner: session?.email ?? "",
    role: b?.user.role ?? "",
    /** Sign-off is offered only when the server says so (signatory role + licence); `user.signatory` alone is a licence flag and would also light up the owner. */
    canSign: !!mod("lab.validation")?.screens.includes("sign-off"),
    can: (perm: string) => !!b?.permissions?.includes(perm),
    screens: (k: string) => mod(k)?.screens ?? [],
  };
}
