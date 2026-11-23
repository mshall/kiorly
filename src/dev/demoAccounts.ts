import type { Product } from "@/api/products";

/** DEV ONLY synthetic test users (DEMO_DATA.md; password Demo@12345, Lab dev-login has none). Imported only by ./DevTestUsers, which sign-in loads behind `__DEV__`, so none of this reaches a production bundle. */
export const DEMO_ACCOUNTS: Record<Product, { label: string; plan: "PRO" | "ENTERPRISE" | "BASIC"; email: string; password?: string; org?: string; nurse?: boolean }[]> = {
  clinic: [
    { label: "Doctor (Nile Care)", plan: "PRO", email: "nadia.na@demo.kiorex.test", password: "Demo@12345" },
    { label: "Nurse (Nile Care)", plan: "PRO", email: "nurse.na@demo.kiorex.test", password: "Demo@12345", nurse: true },
    { label: "Owner (Nile Care)", plan: "PRO", email: "owner.na@demo.kiorex.test", password: "Demo@12345" },
    { label: "Solo nurse Mona", plan: "PRO", email: "mona@nurse-demo.kiorly.test", password: "Demo@12345", nurse: true },
    { label: "Agency nurse Heba", plan: "ENTERPRISE", email: "nurse1@nurse-demo.kiorly.test", password: "Demo@12345", nurse: true },
    { label: "Agency aide Aya", plan: "ENTERPRISE", email: "aide@nurse-demo.kiorly.test", password: "Demo@12345", nurse: true },
    { label: "Dispatcher Dina", plan: "ENTERPRISE", email: "dispatch@nurse-demo.kiorly.test", password: "Demo@12345", nurse: true },
    { label: "Agency owner", plan: "ENTERPRISE", email: "owner@nurse-demo.kiorly.test", password: "Demo@12345", nurse: true },
    { label: "Receptionist (Nile Care)", plan: "PRO", email: "frontdesk1.na@demo.kiorex.test", password: "Demo@12345" },
    { label: "Accountant (Nile Care)", plan: "PRO", email: "accountant.na@demo.kiorex.test", password: "Demo@12345" },
    { label: "Owner (Basic clinic)", plan: "BASIC", email: "owner.basic@demo.kiorex.test", password: "Demo@12345" },
    { label: "Doctor (Basic clinic)", plan: "BASIC", email: "doctor.basic@demo.kiorex.test", password: "Demo@12345" },
    { label: "Nurse (Basic clinic)", plan: "BASIC", email: "nurse.basic@demo.kiorex.test", password: "Demo@12345", nurse: true },
  ],
  pharmacy: [
    { label: "Owner", plan: "ENTERPRISE", email: "owner@demo.kiorly.local", password: "Demo@12345" },
    { label: "Pharmacist", plan: "ENTERPRISE", email: "pharmacist@demo.kiorly.local", password: "Demo@12345" },
    { label: "Manager (witness)", plan: "ENTERPRISE", email: "manager@demo.kiorly.local", password: "Demo@12345" },
    { label: "Cashier", plan: "ENTERPRISE", email: "cashier@demo.kiorly.local", password: "Demo@12345" },
    { label: "Solo owner", plan: "PRO", email: "solo.owner@demo.kiorly.local", password: "Demo@12345" },
    { label: "Owner (Basic pharmacy)", plan: "BASIC", email: "owner.basic@demo.kiorly.local", password: "Demo@12345" },
  ],
  lab: [
    { label: "Owner", plan: "PRO", email: "owner@demo-lab.test", org: "demo-lab" },
    { label: "Pathologist", plan: "PRO", email: "signatory@demo-lab.test", org: "demo-lab" },
    { label: "Phlebotomist", plan: "PRO", email: "phleb@demo-lab.test", org: "demo-lab" },
    { label: "Technologist", plan: "PRO", email: "tech@demo-lab.test", org: "demo-lab" },
    { label: "Reception", plan: "PRO", email: "reception@demo-lab.test", org: "demo-lab" },
    { label: "Director (Basic lab)", plan: "BASIC", email: "director@basic-lab.test", org: "basic-lab" },
  ],
};
