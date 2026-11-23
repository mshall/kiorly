import type { Product } from "./products";

export type Plan = "BASIC" | "PRO" | "ENTERPRISE";
export interface Entitlement { key: "mobile_staff_app"; enabled: boolean; requiredPlan: "PRO"; reason: null | "PLAN_BELOW_PRO" | "FLAG_OFF" }
export interface ModuleDef { key: string; enabled: boolean; screens: string[] }
/** Basic orgs only (null/absent on Pro): what this role would get on Pro, my latest upgrade request (24h), and open requests for owner/admin. */
/** One staff upgrade request as shown to an approver (owner/admin): display name only, never contact data. */
export interface UpgradeRequestItem { id: string; featureKey: string; requesterRole: string; requesterName: string; requestedAt: string; note?: string }
export interface UpgradeBlock { lockedModules: string[]; myRequest: { featureKey: string; requestedAt: string } | null; openRequests: number | null; /** Newest open requests (max 10), approvers only; absent on an older server. */ openRequestItems?: UpgradeRequestItem[]; canApprove: boolean }
export interface Bootstrap {
  apiVersion: 1;
  product: Product;
  serverTime: string;
  user: { id: string; name: string; email: string; role: string; roles: string[]; locale?: string; isOwner?: boolean; branchId?: string; signatory?: boolean };
  org: { id: string; name: string; nameAr?: string; slug?: string; plan: Plan; rawPlan?: string; edition?: string; mode?: string };
  entitlement: Entitlement;
  safetyAlertsOnly: boolean;
  modules: ModuleDef[];
  upgrade?: UpgradeBlock | null;
  permissions?: string[];
  device: { id: string; status: string } | null;
}

export type Severity = "CRITICAL" | "HIGH" | "MEDIUM";
export interface SafetyAlert {
  id: string; kind: string; severity: Severity; title: string; titleAr?: string; body: string; bodyAr?: string;
  subject: { type: string; id: string; label: string } | null; raisedAt: string; dueAt?: string | null;
  ackedAt: string | null; ackedBy: string | null; ackedByName?: string | null; ackNote?: string | null; escalationLevel?: number;
}
export interface InboxItem { id: string; kind: "GENERAL" | "SAFETY" | "CLINICAL" | "OPS"; title: string; titleAr?: string; body: string; bodyAr?: string; data?: Record<string, unknown> | null; createdAt: string; readAt: string | null }
export interface DeviceRow { id: string; deviceId: string; platform: string; name: string; appVersion?: string; status: string; lastSeenAt?: string | null; createdAt?: string; revokedAt?: string | null; mine?: boolean; staff?: { id: string; name: string }; userName?: string }

export interface Session {
  product: Product;
  token: string;
  refreshToken?: string;
  /** How the session was opened: product login (default) or Kiorex Passport OIDC + PKCE (token = Passport access token, refresh/idToken = Passport's). */
  auth?: "password" | "passport";
  /** Passport id_token, kept only for RP-initiated sign-out (`id_token_hint`). SecureStore only. */
  idToken?: string;
  userName: string;
  email: string;
  deviceId: string;        // client-generated install id
  deviceRecordId?: string; // server device id
  deviceToken?: string;    // device-bound secret (stored in SecureStore only)
  bootstrap?: Bootstrap;
  signedInAt: string;
}
