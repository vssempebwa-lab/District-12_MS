import { TENANT_IDS, type RoleId, type TenantId } from "@d12/contracts";
import type { SessionUser } from "./session";

export const DEMO_PASSWORD = "district12";

export interface DemoAccount extends SessionUser {
  title: string;
}

function allTenants(): TenantId[] {
  return [...TENANT_IDS];
}

export const DEMO_ACCOUNTS: DemoAccount[] = [
  {
    id: "usr_marvin",
    name: "Marvin",
    email: "marvin@district12.co.ug",
    title: "Group administrator",
    roles: ["group_admin"],
    tenants: allTenants(),
    homeTenant: null,
  },
  {
    id: "usr_hr",
    name: "HR Desk",
    email: "hr@district12.co.ug",
    title: "HR administrator",
    roles: ["hr_admin"],
    tenants: allTenants(),
    homeTenant: null,
  },
  {
    id: "usr_accountant",
    name: "Finance Desk",
    email: "accountant@district12.co.ug",
    title: "Group accountant",
    roles: ["group_accountant"],
    tenants: allTenants(),
    homeTenant: null,
  },
  {
    id: "usr_sarah",
    name: "Sarah Nakato",
    email: "sarah@passito.ug",
    title: "Passito administrator",
    roles: ["tenant_admin"],
    tenants: ["passito"],
    homeTenant: "passito",
  },
  {
    id: "usr_joseph",
    name: "Joseph Okello",
    email: "joseph@mariz.ug",
    title: "Mariz administrator",
    roles: ["tenant_admin"],
    tenants: ["mariz"],
    homeTenant: "mariz",
  },
  {
    id: "usr_patricia",
    name: "Patricia Namusoke",
    email: "patricia@rubshoots.ug",
    title: "Rub Shoots administrator",
    roles: ["tenant_admin"],
    tenants: ["rub-shoots"],
    homeTenant: "rub-shoots",
  },
  {
    id: "usr_andrew",
    name: "Andrew Ochieng",
    email: "andrew@shopforme.ug",
    title: "Shop For Me administrator",
    roles: ["tenant_admin"],
    tenants: ["shop-for-me"],
    homeTenant: "shop-for-me",
  },
  {
    id: "usr_hadijah",
    name: "Hadijah Nakimuli",
    email: "hadijah@expresso.ug",
    title: "Expresso Point administrator",
    roles: ["tenant_admin"],
    tenants: ["expresso-point"],
    homeTenant: "expresso-point",
  },
  {
    id: "usr_talent_clinic",
    name: "Talent Clinic",
    email: "talentclinic@district12.co.ug",
    title: "Talent Clinic administrator",
    roles: ["tenant_admin"],
    tenants: ["talent-clinic"],
    homeTenant: "talent-clinic",
  },
  {
    id: "usr_brian",
    name: "Brian Ssemakula",
    email: "brian@passito.ug",
    title: "Passito manager",
    roles: ["manager"],
    tenants: ["passito"],
    homeTenant: "passito",
  },
  {
    id: "usr_mariz_hr",
    name: "Grace Atim",
    email: "hr@mariz.ug",
    title: "Mariz HR officer",
    roles: ["hr_officer"],
    tenants: ["mariz"],
    homeTenant: "mariz",
  },
  {
    id: "usr_mariz_accountant",
    name: "Peter Mugisha",
    email: "finance@mariz.ug",
    title: "Mariz accountant",
    roles: ["accountant"],
    tenants: ["mariz"],
    homeTenant: "mariz",
  },
  {
    id: "usr_passito_staff1",
    name: "Grace Nalwoga",
    email: "staff1@passito.ug",
    title: "Passito employee",
    roles: ["employee"],
    tenants: ["passito"],
    homeTenant: "passito",
  },
  {
    id: "usr_passito_staff2",
    name: "Ivan Kato",
    email: "staff2@passito.ug",
    title: "Passito employee",
    roles: ["employee"],
    tenants: ["passito"],
    homeTenant: "passito",
  },
  {
    id: "usr_mariz_staff1",
    name: "Milly Adongo",
    email: "staff1@mariz.ug",
    title: "Mariz employee",
    roles: ["employee"],
    tenants: ["mariz"],
    homeTenant: "mariz",
  },
  {
    id: "usr_mariz_staff2",
    name: "Patrick Ojok",
    email: "staff2@mariz.ug",
    title: "Mariz employee",
    roles: ["employee"],
    tenants: ["mariz"],
    homeTenant: "mariz",
  },
  {
    id: "usr_rub_staff1",
    name: "Joan Nakabuye",
    email: "staff1@rubshoots.ug",
    title: "Rub Shoots employee",
    roles: ["employee"],
    tenants: ["rub-shoots"],
    homeTenant: "rub-shoots",
  },
  {
    id: "usr_rub_staff2",
    name: "Emmanuel Mwesigwa",
    email: "staff2@rubshoots.ug",
    title: "Rub Shoots employee",
    roles: ["employee"],
    tenants: ["rub-shoots"],
    homeTenant: "rub-shoots",
  },
  {
    id: "usr_shop_staff1",
    name: "Fiona Namutebi",
    email: "staff1@shopforme.ug",
    title: "Shop For Me employee",
    roles: ["employee"],
    tenants: ["shop-for-me"],
    homeTenant: "shop-for-me",
  },
  {
    id: "usr_shop_staff2",
    name: "Samuel Bwire",
    email: "staff2@shopforme.ug",
    title: "Shop For Me employee",
    roles: ["employee"],
    tenants: ["shop-for-me"],
    homeTenant: "shop-for-me",
  },
  {
    id: "usr_expresso_staff1",
    name: "Aisha Nabukeera",
    email: "staff1@expresso.ug",
    title: "Expresso Point employee",
    roles: ["employee"],
    tenants: ["expresso-point"],
    homeTenant: "expresso-point",
  },
  {
    id: "usr_expresso_staff2",
    name: "Martin Ssekandi",
    email: "staff2@expresso.ug",
    title: "Expresso Point employee",
    roles: ["employee"],
    tenants: ["expresso-point"],
    homeTenant: "expresso-point",
  },
];

export function findDemoAccount(email: string): DemoAccount | undefined {
  const needle = email.trim().toLowerCase();
  return DEMO_ACCOUNTS.find((account) => account.email.toLowerCase() === needle);
}

export function demoUser(email: string): SessionUser | null {
  const account = findDemoAccount(email);
  if (!account) return null;
  return {
    id: account.id,
    email: account.email,
    name: account.name,
    roles: account.roles,
    tenants: account.tenants,
    homeTenant: account.homeTenant,
  };
}
