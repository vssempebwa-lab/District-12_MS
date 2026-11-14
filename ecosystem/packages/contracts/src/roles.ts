export const ROLE_IDS = [
  "group_admin",
  "hr_admin",
  "group_accountant",
  "tenant_admin",
  "manager",
  "hr_officer",
  "accountant",
  "account_executive",
  "employee",
] as const;

export type RoleId = (typeof ROLE_IDS)[number];

export interface RoleMeta {
  id: RoleId;
  label: string;
  scope: "global" | "tenant";
  rank: number;
  permissions: string[];
  description: string;
}

export const ROLES: RoleMeta[] = [
  {
    id: "group_admin",
    label: "Group administrator",
    scope: "global",
    rank: 100,
    permissions: ["*"],
    description: "Full control of every subsidiary and every provisioning action.",
  },
  {
    id: "hr_admin",
    label: "HR administrator",
    scope: "global",
    rank: 90,
    permissions: ["hr.provision", "hr.manage", "hr.payroll", "hr.reports", "team.manage", "notifications.read", "iam.read", "warehouse.read", "reports.read", "shifts.read"],
    description: "Provisions accounts, assigns subsidiaries and reads group reporting.",
  },
  {
    id: "group_accountant",
    label: "Group accountant",
    scope: "global",
    rank: 90,
    permissions: ["finance.read", "warehouse.read", "reports.read"],
    description: "Monitors revenue, operating expenses and financial performance across the group. Read-only access.",
  },
  {
    id: "tenant_admin",
    label: "Subsidiary administrator",
    scope: "tenant",
    rank: 60,
    permissions: [
      "leads.read",
      "leads.write",
      "customers.read",
      "customers.write",
      "sales.read",
      "sales.write",
      "tasks.read",
      "tasks.write",
      "projects.read",
      "projects.write",
      "inventory.read",
      "inventory.write",
      "transactions.read",
      "transactions.write",
      "invoices.read",
      "invoices.write",
      "staff.read",
      "staff.write",
      "team.manage",
      "telemetry.write",
      "reports.read",
      "reports.submit",
      "notifications.read",
      "shifts.read",
    ],
    description: "Runs a single subsidiary workspace.",
  },
  {
    id: "manager",
    label: "Manager",
    scope: "tenant",
    rank: 50,
    permissions: [
      "leads.read",
      "leads.write",
      "customers.read",
      "customers.write",
      "sales.read",
      "tasks.read",
      "tasks.write",
      "projects.read",
      "projects.write",
      "inventory.read",
      "transactions.read",
      "invoices.read",
      "staff.read",
      "staff.write",
      "team.manage",
      "reports.read",
      "reports.submit",
      "notifications.read",
      "shifts.read",
    ],
    description: "Owns pipeline, delivery and commercial performance for a team inside one subsidiary.",
  },
  {
    id: "hr_officer",
    label: "HR officer",
    scope: "tenant",
    rank: 45,
    permissions: [
      "staff.read",
      "staff.write",
      "tasks.read",
      "hr.manage",
      "hr.payroll",
      "hr.reports",
      "reports.read",
      "reports.submit",
      "notifications.read",
      "shifts.read",
    ],
    description: "Runs people operations inside one subsidiary: directory, attendance, leave, recruitment, training, performance and payroll preparation.",
  },
  {
    id: "accountant",
    label: "Accountant",
    scope: "tenant",
    rank: 45,
    permissions: [
      "transactions.read",
      "transactions.write",
      "invoices.read",
      "invoices.write",
      "sales.read",
      "inventory.read",
      "staff.read",
      "reports.read",
      "reports.submit",
      "notifications.read",
    ],
    description: "Keeps the books for one subsidiary: expenses, invoices, revenue records and finance reports.",
  },
  {
    id: "account_executive",
    label: "Account executive",
    scope: "tenant",
    rank: 35,
    permissions: [
      "leads.read",
      "leads.write",
      "customers.read",
      "customers.write",
      "sales.read",
      "sales.write",
      "invoices.read",
      "tasks.read",
      "tasks.write",
      "projects.read",
      "reports.read",
      "reports.submit",
    ],
    description: "Owns the sales pipeline and customer relationships inside one subsidiary.",
  },
  {
    id: "employee",
    label: "Employee",
    scope: "tenant",
    rank: 10,
    permissions: [
      "leads.read",
      "leads.write",
      "customers.read",
      "customers.write",
      "sales.read",
      "sales.write",
      "tasks.read",
      "tasks.write",
      "projects.read",
      "projects.write",
      "invoices.read",
      "invoices.write",
      "reports.submit",
    ],
    description: "Read and create access to delivery data inside one subsidiary, plus reports to the subsidiary accountant.",
  },
];

export function roleMeta(id: string): RoleMeta | undefined {
  return ROLES.find((role) => role.id === id);
}

export function isRoleId(id: string): id is RoleId {
  return ROLES.some((role) => role.id === id);
}

export function isGlobalRole(id: string): boolean {
  const meta = roleMeta(id);
  return meta ? meta.scope === "global" : false;
}

export function scopeForRoles(roles: string[]): "group" | "tenant" {
  return roles.some((role) => isGlobalRole(role)) ? "group" : "tenant";
}

export function permissionsForRoles(roles: string[]): string[] {
  const union = new Set<string>();
  for (const role of roles) {
    const meta = roleMeta(role);
    if (!meta) continue;
    for (const permission of meta.permissions) union.add(permission);
  }
  return union.has("*") ? ["*"] : Array.from(union).sort();
}

export function rankForRoles(roles: string[]): number {
  return roles.reduce((rank, role) => Math.max(rank, roleMeta(role)?.rank ?? 0), 0);
}
