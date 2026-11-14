export interface WorkspaceProfile {
  displayName: string;
  title: string;
  phone: string;
  bio: string;
  accent: string;
  density: "compact" | "comfortable";
  notifyReports: boolean;
  notifyShifts: boolean;
  notifyWeekly: boolean;
}

export const ACCENTS: { id: string; label: string; value: string }[] = [
  { id: "tenant", label: "Subsidiary", value: "" },
  { id: "navy", label: "Navy", value: "#0f2a4a" },
  { id: "royal", label: "Royal", value: "#1d4ed8" },
  { id: "emerald", label: "Emerald", value: "#047857" },
  { id: "amber", label: "Amber", value: "#b45309" },
  { id: "violet", label: "Violet", value: "#6d28d9" },
  { id: "rose", label: "Rose", value: "#be123c" },
];

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  status: string;
  role: string;
  roleLabel: string;
  joinedOn: string;
  lastActive: string | null;
  department: string;
  title: string;
}

export interface TenantShift {
  id: string;
  name: string;
  email: string;
  roleLabel: string;
  startedAt: string;
  endedAt: string;
  minutes: number;
  endedVia: "shift" | "signout";
  note?: string;
}
