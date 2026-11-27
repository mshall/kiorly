/**
 * Mirror of the Kiorly Clinic API module table (clinics-management apps/api/src/mobile/mobile-roles.ts `MODULES`, `modulesFor`), kept as data because that file is bound to Prisma enums.
 * The live server is proven by the workspace e2e suite 16-staff-mobile-clinic; this mirror lets the app tests state, per role, which tiles a person can have. Update both together.
 */
type Role = "GROUP_ADMIN" | "GROUP_SUPERVISOR" | "BRANCH_MANAGER" | "CLINIC_ADMIN" | "PHYSICIAN" | "NURSE" | "CLINIC_ASSISTANT" | "RECEPTIONIST" | "CALL_CENTER" | "FINANCE_OFFICER";
const MANAGER: Role[] = ["GROUP_ADMIN", "GROUP_SUPERVISOR", "BRANCH_MANAGER", "CLINIC_ADMIN"];
const VITALS: Role[] = ["PHYSICIAN", "NURSE", "CLINIC_ASSISTANT", "BRANCH_MANAGER", "GROUP_ADMIN", "GROUP_SUPERVISOR", "CLINIC_ADMIN"];
const REVENUE: Role[] = ["GROUP_ADMIN", "GROUP_SUPERVISOR", "BRANCH_MANAGER", "FINANCE_OFFICER", "CLINIC_ADMIN"];
const GROWTH: Role[] = ["GROUP_ADMIN", "GROUP_SUPERVISOR", "BRANCH_MANAGER", "CLINIC_ADMIN", "CLINIC_ASSISTANT", "PHYSICIAN"];
const SIGNING: Role[] = ["PHYSICIAN", "GROUP_ADMIN", "GROUP_SUPERVISOR"];
export const CLINIC_MODULES: { key: string; allow: Role[]; screens: string[] }[] = [
  { key: "clinic.schedule", allow: ["PHYSICIAN", "NURSE", "RECEPTIONIST", "CALL_CENTER", "CLINIC_ASSISTANT", "BRANCH_MANAGER", "GROUP_ADMIN", "GROUP_SUPERVISOR", "CLINIC_ADMIN", "FINANCE_OFFICER"], screens: ["today", "queue", "detail"] },
  { key: "clinic.patients", allow: ["PHYSICIAN", "NURSE", "RECEPTIONIST", "CALL_CENTER", "CLINIC_ASSISTANT", "BRANCH_MANAGER", "GROUP_ADMIN", "GROUP_SUPERVISOR", "CLINIC_ADMIN"], screens: ["search", "summary"] },
  { key: "clinic.visits", allow: SIGNING, screens: ["start", "notes"] },
  { key: "clinic.prescriptions", allow: SIGNING, screens: ["review", "sign"] },
  { key: "clinic.labs", allow: SIGNING, screens: ["results", "approve"] },
  { key: "clinic.vitals", allow: VITALS, screens: ["entry", "trend"] },
  { key: "clinic.homevisits", allow: ["NURSE", "PHYSICIAN"], screens: ["round", "checkin", "safety", "sample"] },
  { key: "clinic.revenue", allow: REVENUE, screens: ["snapshot"] },
  { key: "clinic.growth", allow: GROWTH, screens: ["share", "links", "performance"] },
];
export const CLINIC_ROLES: Role[] = ["GROUP_ADMIN", "GROUP_SUPERVISOR", "BRANCH_MANAGER", "CLINIC_ADMIN", "PHYSICIAN", "NURSE", "CLINIC_ASSISTANT", "RECEPTIONIST", "CALL_CENTER", "FINANCE_OFFICER"];
/** Modules for a role; the tenant owner gets every table module except home visits (only NURSE, or the Nurse edition); nurses and assistants by profession lose visits and prescriptions, nurses lose lab results. */
export function clinicModulesFor(role: Role, o: { owner?: boolean; edition?: "CLINIC" | "NURSE"; profession?: string } = {}) {
  return CLINIC_MODULES.map((m) => {
    const byRole = !!o.owner || m.allow.includes(role);
    const nurseEdition = o.edition === "NURSE" && ["NURSE", "PHYSICIAN", "BRANCH_MANAGER", "GROUP_ADMIN", "CLINIC_ADMIN", "CLINIC_ASSISTANT", "RECEPTIONIST", "CALL_CENTER"].includes(role);
    const enabled = m.key === "clinic.homevisits" ? nurseEdition || role === "NURSE" : byRole;
    const nonPrescribing = ["NURSE", "ASSISTANT"].includes(o.profession ?? "") && (m.key === "clinic.visits" || m.key === "clinic.prescriptions");
    const noLab = ["NURSE", "ASSISTANT"].includes(o.profession ?? "") && m.key === "clinic.labs";
    const on = enabled && !nonPrescribing && !noLab;
    return { key: m.key, enabled: on, screens: on ? m.screens : [] };
  });
}
export const MANAGER_ROLES = MANAGER;
