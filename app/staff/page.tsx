"use client";

import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Building2,
  ChevronRight,
  Lock,
  Network,
  Plus,
  Search,
  ShieldCheck,
  UserCheck,
  UserCog,
  UserMinus,
  Users,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { CompanyMark, StaffStatusBadge } from "@/components/entities";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useEntity } from "@/components/entity-provider";
import { useSystem } from "@/components/system-provider";
import { cn } from "@/lib/utils";
import { formatDate, initials } from "@/lib/format";
import type { StaffMember } from "@/lib/data";

const emptyForm = {
  name: "",
  role: "",
  department: "",
  companyId: "passito",
  email: "",
  phone: "",
};

type HrTier = "lead" | "manager" | "employee";

const tierMeta: Record<HrTier, { label: string; chip: string }> = {
  lead: { label: "HR lead", chip: "bg-violet-50 text-violet-700" },
  manager: { label: "Manager", chip: "bg-blue-50 text-blue-700" },
  employee: { label: "Employee", chip: "bg-secondary text-secondary-foreground" },
};

function hrTier(member: StaffMember): HrTier {
  const department = member.department.toLowerCase();
  const role = member.role.toLowerCase();
  if (department.includes("people") || department.includes("human resource")) {
    return "lead";
  }
  if (role.startsWith("hr ") || role.endsWith(" hr")) return "lead";
  if (/\b(manager|director|supervisor|head|lead)\b/.test(role)) return "manager";
  return "employee";
}

function ParentRole({
  icon: Icon,
  title,
  subtitle,
  bullets,
  people,
  status,
  children,
}: {
  icon: LucideIcon;
  title: string;
  subtitle: string;
  bullets: string[];
  people: { name: string; email: string }[];
  status: { label: string; tone: "success" | "warning" | "brand" };
  children?: ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2">
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-accent text-accent-foreground">
            <Icon className="h-3.5 w-3.5" />
          </span>
          <div>
            <p className="text-xs font-bold text-foreground">{title}</p>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              {subtitle}
            </p>
          </div>
        </div>
        <Badge variant={status.tone}>{status.label}</Badge>
      </div>

      <ul className="mt-2.5 space-y-1">
        {bullets.map((bullet) => (
          <li key={bullet} className="flex gap-1.5 text-[11px] leading-snug text-muted-foreground">
            <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-primary" />
            {bullet}
          </li>
        ))}
      </ul>

      <div className="mt-3 space-y-1.5 border-t border-border pt-2.5">
        {people.length ? (
          people.slice(0, 2).map((person) => (
            <div key={person.email} className="flex items-center gap-2">
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[#131313] text-[9px] font-bold text-white">
                {initials(person.name)}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-[11px] font-semibold text-foreground">
                  {person.name}
                </span>
                <span className="block truncate text-[10px] text-muted-foreground">
                  {person.email}
                </span>
              </span>
            </div>
          ))
        ) : (
          <p className="text-[11px] text-muted-foreground">
            Seat open — assign from Accounts.
          </p>
        )}
        {children}
      </div>
    </div>
  );
}

function TierRow({
  tier,
  count,
  names,
  fallback,
  detail,
}: {
  tier: HrTier;
  count: number;
  names: string[];
  fallback: string;
  detail: string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <span
          className={cn(
            "inline-flex items-center rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide",
            tierMeta[tier].chip
          )}
        >
          {tierMeta[tier].label}
        </span>
        <span className="text-[10px] font-semibold text-muted-foreground">{count}</span>
      </div>
      <p
        className={cn(
          "mt-1 truncate text-xs font-semibold",
          names.length ? "text-foreground" : "text-muted-foreground"
        )}
      >
        {names.length ? names.join(", ") : fallback}
      </p>
      <p className="mt-0.5 text-[10px] leading-snug text-muted-foreground">{detail}</p>
    </div>
  );
}

export default function StaffPage() {
  const { companies, staff, accounts, addStaff } = useSystem();
  const { entity } = useEntity();
  const [query, setQuery] = useState("");
  const [companyFilter, setCompanyFilter] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const activeCompany = companyFilter ?? entity?.id ?? "all";

  useEffect(() => {
    setCompanyFilter(null);
  }, [entity?.id]);

  const scopedStaff =
    activeCompany === "all"
      ? staff
      : staff.filter((member) => member.companyId === activeCompany);

  const filtered = useMemo(
    () =>
      staff
        .filter((member) => {
          const company = companies.find((item) => item.id === member.companyId);
          const haystack = `${member.name} ${member.role} ${member.department} ${member.email} ${company?.name ?? ""}`;
          return (
            haystack.toLowerCase().includes(query.toLowerCase()) &&
            (activeCompany === "all" || member.companyId === activeCompany) &&
            (statusFilter === "all" || member.status === statusFilter)
          );
        })
        .sort((a, b) => a.name.localeCompare(b.name)),
    [staff, companies, query, activeCompany, statusFilter]
  );

  const counts = {
    total: scopedStaff.length,
    active: scopedStaff.filter((member) => member.status === "active").length,
    away: scopedStaff.filter((member) => member.status !== "active").length,
  };

  const groupAdmins = useMemo(
    () =>
      accounts
        .filter((account) => account.companyId === "" && account.role === "admin")
        .map((account) => ({ name: account.name, email: account.email })),
    [accounts]
  );
  const provisionedAccounts = accounts.filter((account) => account.companyId !== "");

  const partitions = useMemo(
    () =>
      companies.map((company) => {
        const members = staff.filter((member) => member.companyId === company.id);
        const peopleLead = members.find((member) => hrTier(member) === "lead");
        const fallbackLead = members.find((member) => member.name === company.md);
        const lead = peopleLead ?? fallbackLead;
        const remaining = members.filter((member) => member.id !== lead?.id);
        return {
          company,
          members,
          lead,
          leadIsInterim: !peopleLead && Boolean(fallbackLead),
          managers: remaining.filter((member) => hrTier(member) === "manager"),
          employees: remaining.filter((member) => hrTier(member) === "employee"),
          accounts: accounts.filter((account) => account.companyId === company.id),
        };
      }),
    [companies, staff, accounts]
  );

  const visiblePartitions = entity
    ? partitions.filter((partition) => partition.company.id === entity.id)
    : partitions;

  function openDialog(nextOpen: boolean) {
    setOpen(nextOpen);
    if (nextOpen) {
      setForm({ ...emptyForm, companyId: entity?.id ?? emptyForm.companyId });
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form.name.trim() || !form.role.trim() || !form.email.trim()) {
      toast.error("Name, role and email are required");
      return;
    }
    addStaff(form);
    toast.success(`${form.name} added to the staff directory`);
    setForm({ ...emptyForm, companyId: entity?.id ?? emptyForm.companyId });
    setOpen(false);
  }

  return (
    <div>
      <PageHeader
        title={entity ? `${entity.shortName} — HR` : "Human resources"}
        description={
          entity
            ? `${entity.name} people partition, provisioned and governed by District 12 group HR.`
            : "District 12 group HR — one policy, isolated people partitions for every subsidiary."
        }
      >
        <Dialog open={open} onOpenChange={openDialog}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-3.5 w-3.5" />
              Add staff
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add staff member</DialogTitle>
              <DialogDescription>
                Create a new record in the group staff directory.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <Label htmlFor="staff-name">Full name</Label>
                <Input
                  id="staff-name"
                  value={form.name}
                  onChange={(event) => setForm({ ...form, name: event.target.value })}
                  placeholder="e.g. Esther Nakato"
                  autoFocus
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label htmlFor="staff-role">Role</Label>
                  <Input
                    id="staff-role"
                    value={form.role}
                    onChange={(event) => setForm({ ...form, role: event.target.value })}
                    placeholder="e.g. Accountant"
                  />
                </div>
                <div>
                  <Label htmlFor="staff-department">Department</Label>
                  <Input
                    id="staff-department"
                    value={form.department}
                    onChange={(event) =>
                      setForm({ ...form, department: event.target.value })
                    }
                    placeholder="e.g. Finance"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="staff-company">Company</Label>
                <Select
                  id="staff-company"
                  value={form.companyId}
                  onChange={(event) => setForm({ ...form, companyId: event.target.value })}
                >
                  {companies.map((company) => (
                    <option key={company.id} value={company.id}>
                      {company.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label htmlFor="staff-email">Email</Label>
                  <Input
                    id="staff-email"
                    type="email"
                    value={form.email}
                    onChange={(event) => setForm({ ...form, email: event.target.value })}
                    placeholder="name@district12.co.ug"
                  />
                </div>
                <div>
                  <Label htmlFor="staff-phone">Phone</Label>
                  <Input
                    id="staff-phone"
                    value={form.phone}
                    onChange={(event) => setForm({ ...form, phone: event.target.value })}
                    placeholder="+256 7xx xxx xxx"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">Save staff member</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </PageHeader>

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        {[
          { label: "Total staff", value: counts.total, icon: Users, chip: "bg-blue-50 text-blue-700" },
          { label: "Active", value: counts.active, icon: UserCheck, chip: "bg-emerald-50 text-emerald-700" },
          { label: "On leave or contract", value: counts.away, icon: UserMinus, chip: "bg-amber-50 text-amber-700" },
        ].map((stat) => (
          <Card key={stat.label}>
            <CardContent className="flex items-center justify-between p-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {stat.label}
                </p>
                <p className="mt-1 text-lg font-bold text-foreground">{stat.value}</p>
              </div>
              <span className={`grid h-8 w-8 place-items-center rounded-md ${stat.chip}`}>
                <stat.icon className="h-4 w-4" />
              </span>
            </CardContent>
          </Card>
        ))}
      </div>

      {!entity && (
        <>
          <Card className="overflow-hidden">
        <div className="flex flex-col gap-2 border-b border-border bg-secondary/50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2.5">
            <span className="grid h-8 w-8 place-items-center rounded-md bg-[#131313] text-white">
              <Building2 className="h-4 w-4" />
            </span>
            <div>
              <p className="text-sm font-bold text-foreground">District 12</p>
              <p className="text-[11px] text-muted-foreground">
                Parent / holding company · group HR governance
              </p>
            </div>
          </div>
          <Badge variant="brand">Group layer</Badge>
        </div>
        <CardContent className="grid gap-3 p-3 md:grid-cols-2">
          <ParentRole
            icon={ShieldCheck}
            title="Global HR Super Admin"
            subtitle="Group HR Director"
            bullets={[
              "Full visibility across District 12 and all subsidiaries",
              "Provisions accounts and assigns each subsidiary ID",
              "Transfers employees between entities and revokes access",
            ]}
            people={groupAdmins}
            status={
              groupAdmins.length
                ? { label: "Assigned", tone: "success" }
                : { label: "Unassigned", tone: "warning" }
            }
          />
          <ParentRole
            icon={UserCog}
            title="HR Operations"
            subtitle="Provisioning Officer"
            bullets={[
              "Creates employee accounts and maps subsidiary roles",
              "Manages global HR policy, compliance and the master directory",
              "Scopes every provisioning action by subsidiary ID",
            ]}
            people={[]}
            status={{ label: "Unassigned", tone: "warning" }}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] text-muted-foreground">
                {provisionedAccounts.length} accounts across {companies.length} subsidiaries
              </span>
              <Link
                href="/accounts"
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline"
              >
                Manage
                <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </ParentRole>
        </CardContent>
      </Card>

          <div className="relative my-3 flex items-center justify-center">
            <span className="absolute inset-x-6 top-1/2 h-px bg-border" />
            <span className="relative inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-[10px] font-semibold text-foreground shadow-sm">
              <Network className="h-3.5 w-3.5 text-primary" />
              Provisioning &amp; role assignment · scoped by subsidiary ID
            </span>
          </div>
        </>
      )}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {visiblePartitions.map((partition) => {
          const { company, lead, managers, employees, accounts: companyAccounts } =
            partition;
          return (
            <Card key={company.id} className="flex flex-col overflow-hidden">
              <div
                className="border-b border-border px-3 py-2.5"
                style={{ borderTop: `3px solid ${company.color}` }}
              >
                <div className="flex items-center gap-2">
                  <CompanyMark company={company} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-bold text-foreground">
                      {company.shortName}
                    </p>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Isolated data partition · {company.staff} headcount
                    </p>
                  </div>
                  <Badge variant="outline">{partition.members.length} in directory</Badge>
                </div>
              </div>

              <CardContent className="flex-1 space-y-3 p-3">
                <TierRow
                  tier="lead"
                  count={lead ? 1 : 0}
                  names={lead ? [lead.name] : []}
                  fallback="No HR lead assigned"
                  detail={
                    lead
                      ? partition.leadIsInterim
                        ? `Interim cover — ${lead.role}, scoped to ${company.shortName}`
                        : `Views only ${company.shortName} staff — leave and performance`
                      : "Group HR must provision a subsidiary HR lead"
                  }
                />
                <TierRow
                  tier="manager"
                  count={managers.length}
                  names={managers.slice(0, 2).map((member) => member.name)}
                  fallback="No department managers"
                  detail={`Supervises ${company.shortName} teams — no access to sibling entities`}
                />
                <TierRow
                  tier="employee"
                  count={employees.length}
                  names={employees.slice(0, 2).map((member) => member.name)}
                  fallback="No employee records"
                  detail={`Portal access isolated to ${company.shortName}`}
                />
              </CardContent>

              <div className="flex items-center justify-between gap-2 border-t border-border px-3 py-2">
                <span className="inline-flex items-center gap-1 text-[10px] font-medium text-muted-foreground">
                  <Lock className="h-3 w-3" />
                  Blocked from other partitions
                </span>
                <span className="text-[10px] font-semibold text-muted-foreground">
                  {companyAccounts.length}{" "}
                  {companyAccounts.length === 1 ? "account" : "accounts"}
                </span>
              </div>
            </Card>
          );
        })}
      </div>

      <div className="mb-2 mt-5 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h3 className="text-sm font-bold text-foreground">Master employee directory</h3>
          <p className="text-xs text-muted-foreground">
            {entity
              ? `${entity.name} rows only — other subsidiaries stay hidden.`
              : "Group-wide record set — each subsidiary only sees its own rows."}
          </p>
        </div>
        <Link
          href="/accounts"
          className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
        >
          Provision access
          <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      <Card id="directory">
        <CardContent className="p-0">
          <div className="flex flex-col gap-2 border-b border-border p-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search name, role or email"
                className="pl-8"
                aria-label="Search staff"
              />
            </div>
            <Select
              value={activeCompany}
              onChange={(event) => setCompanyFilter(event.target.value)}
              className="sm:w-48"
              aria-label="Filter by company"
            >
              <option value="all">All companies</option>
              {companies.map((company) => (
                <option key={company.id} value={company.id}>
                  {company.shortName}
                </option>
              ))}
            </Select>
            <Select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="sm:w-40"
              aria-label="Filter by status"
            >
              <option value="all">All statuses</option>
              <option value="active">Active</option>
              <option value="on-leave">On leave</option>
              <option value="contract">Contract</option>
            </Select>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Staff member</TableHead>
                <TableHead className="hidden md:table-cell">Role</TableHead>
                <TableHead>Company</TableHead>
                <TableHead className="hidden lg:table-cell">Joined</TableHead>
                <TableHead className="text-right">Status</TableHead>
                <TableHead className="w-8" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((member: StaffMember) => {
                const company = companies.find((item) => item.id === member.companyId);
                const tier = tierMeta[hrTier(member)];
                return (
                  <TableRow key={member.id}>
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#131313] text-[10px] font-bold text-white">
                          {initials(member.name)}
                        </span>
                        <div className="min-w-0">
                          <Link
                            href={`/staff/${member.id}`}
                            className="block truncate text-xs font-semibold text-foreground hover:text-primary"
                          >
                            {member.name}
                          </Link>
                          <p className="truncate text-[11px] text-muted-foreground">
                            {member.email}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <p className="text-xs font-medium text-foreground">{member.role}</p>
                      <span className="mt-1 flex items-center gap-1.5">
                        <span
                          className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${tier.chip}`}
                        >
                          {tier.label}
                        </span>
                        <span className="text-[11px] text-muted-foreground">
                          {member.department}
                        </span>
                      </span>
                    </TableCell>
                    <TableCell>
                      {company ? (
                        <span className="flex items-center gap-2">
                          <CompanyMark company={company} size="sm" />
                          <span className="hidden text-xs text-muted-foreground sm:inline">
                            {company.shortName}
                          </span>
                        </span>
                      ) : (
                        <Badge variant="outline">Unassigned</Badge>
                      )}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      <span className="text-xs text-muted-foreground">
                        {formatDate(member.joined)}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <StaffStatusBadge status={member.status} />
                    </TableCell>
                    <TableCell className="text-right">
                      <Link
                        href={`/staff/${member.id}`}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground"
                        aria-label={`Open ${member.name}`}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Link>
                    </TableCell>
                  </TableRow>
                );
              })}
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-10 text-center">
                    <p className="text-sm font-semibold text-foreground">No staff found</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Adjust your filters or add a new staff member.
                    </p>
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <p className="mt-3 text-[11px] text-muted-foreground">
        Showing {filtered.length} of {scopedStaff.length} staff records.
      </p>
    </div>
  );
}
