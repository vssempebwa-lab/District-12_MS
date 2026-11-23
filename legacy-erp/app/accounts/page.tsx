"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Link2,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
  UserCheck,
  UserCog,
  UserX,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { CompanyMark } from "@/components/entities";
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
import { formatDate, initials } from "@/lib/format";
import type { Account, AccountRole } from "@/lib/data";

function RoleBadge({ role }: { role: AccountRole }) {
  if (role === "admin") return <Badge variant="brand">Group admin</Badge>;
  if (role === "manager") return <Badge variant="warning">Manager</Badge>;
  return <Badge variant="outline">Staff user</Badge>;
}

function StatusBadge({ status }: { status: Account["status"] }) {
  return status === "active" ? (
    <Badge variant="success">Active</Badge>
  ) : (
    <Badge variant="danger">Suspended</Badge>
  );
}

export default function AccountsPage() {
  const { companies, staff, accounts, addAccount, setAccountStatus, removeAccount } =
    useSystem();
  const { entity, setEntityId } = useEntity();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [companyFilter, setCompanyFilter] = useState<string | null>(null);
  const [roleFilter, setRoleFilter] = useState("all");
  const [open, setOpen] = useState(false);
  const [linksOpen, setLinksOpen] = useState(false);
  const [origin, setOrigin] = useState("");
  const [form, setForm] = useState({
    name: "",
    email: "",
    role: "staff" as AccountRole,
    companyId: "passito",
  });

  const activeCompany = companyFilter ?? entity?.id ?? "all";

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  useEffect(() => {
    setCompanyFilter(null);
  }, [entity?.id]);

  const scoped = useMemo(
    () =>
      activeCompany === "all"
        ? accounts
        : accounts.filter(
            (account) => account.companyId === activeCompany || account.companyId === ""
          ),
    [accounts, activeCompany]
  );

  const filtered = useMemo(
    () =>
      scoped
        .filter((account) => {
          const company = companies.find((item) => item.id === account.companyId);
          const haystack = `${account.name} ${account.email} ${company?.name ?? "group office"}`;
          return (
            haystack.toLowerCase().includes(query.toLowerCase()) &&
            (roleFilter === "all" || account.role === roleFilter)
          );
        })
        .sort((a, b) => a.name.localeCompare(b.name)),
    [scoped, companies, query, roleFilter]
  );

  const totals = {
    total: scoped.length,
    active: scoped.filter((account) => account.status === "active").length,
    admins: scoped.filter((account) => account.role === "admin").length,
    suspended: scoped.filter((account) => account.status === "suspended").length,
  };

  const dashboardLinks = useMemo(
    () =>
      accounts
        .slice()
        .sort(
          (a, b) =>
            (a.companyId || "~").localeCompare(b.companyId || "~") ||
            a.name.localeCompare(b.name)
        )
        .map((account) => ({
          account,
          company: companies.find((company) => company.id === account.companyId),
          href: `${origin}/?entity=${account.companyId || "group"}`,
        })),
    [accounts, companies, origin]
  );

  function openCreate() {
    setForm({
      name: "",
      email: "",
      role: "staff",
      companyId: activeCompany === "all" ? companies[0]?.id ?? "passito" : activeCompany,
    });
    setOpen(true);
  }

  function linkStaff(staffId: string) {
    const member = staff.find((entry) => entry.id === staffId);
    if (!member) return;
    setForm({
      name: member.name,
      email: member.email ?? "",
      role: "staff",
      companyId: member.companyId,
    });
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const email = form.email.trim().toLowerCase();
    if (!form.name.trim() || !email) {
      toast.error("Name and email are required");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error("Enter a valid email address");
      return;
    }
    if (accounts.some((account) => account.email.toLowerCase() === email)) {
      toast.error("An account with this email already exists");
      return;
    }
    addAccount({
      name: form.name.trim(),
      email,
      role: form.role,
      companyId: form.role === "admin" && form.companyId === "" ? "" : form.companyId,
    });
    toast.success(`${form.name.trim()} can now sign in`);
    setOpen(false);
  }

  function handleDelete(account: Account) {
    if (!window.confirm(`Delete the account for “${account.name}”? This cannot be undone.`)) {
      return;
    }
    removeAccount(account.id);
    toast.success(`${account.name}'s account removed`);
  }

  function openDashboard(account: Account) {
    const scope = account.companyId || "group";
    setEntityId(scope);
    router.push(scope === "group" ? "/" : `/?entity=${scope}`);
  }

  function dashboardLink(account: Account) {
    const scope = account.companyId || "group";
    return `${window.location.origin}/?entity=${scope}`;
  }

  function copyText(text: string) {
    try {
      const field = document.createElement("textarea");
      field.value = text;
      field.style.position = "fixed";
      field.style.opacity = "0";
      document.body.appendChild(field);
      field.select();
      const copied = document.execCommand("copy");
      document.body.removeChild(field);
      return copied;
    } catch {
      return false;
    }
  }

  async function copyDashboardLink(account: Account) {
    const link = dashboardLink(account);
    try {
      await navigator.clipboard.writeText(link);
      toast.success(`Dashboard link copied for ${account.name}`);
    } catch {
      if (copyText(link)) {
        toast.success(`Dashboard link copied for ${account.name}`);
      } else {
        window.prompt("Copy this dashboard link", link);
      }
    }
  }

  return (
    <div>
      <PageHeader
        title="Accounts & access"
        description={
          entity
            ? `Sign-in accounts provisioned for ${entity.name}.`
            : "Every user account is created by the group admin and tied to a subsidiary dashboard."
        }
      >
        <Dialog open={linksOpen} onOpenChange={setLinksOpen}>
          <DialogTrigger asChild>
            <Button variant="outline">
              <Link2 className="h-3.5 w-3.5" />
              Dashboard links
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Employee dashboard links</DialogTitle>
              <DialogDescription>
                Each link opens directly into that account&apos;s subsidiary dashboard.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-1.5">
              {dashboardLinks.map(({ account, company, href }) => (
                <div
                  key={account.id}
                  className="rounded-md border border-border px-2.5 py-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="min-w-0 truncate text-xs font-semibold text-foreground">
                      {account.name}
                    </span>
                    <span className="shrink-0 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                      {company ? company.shortName : "Group office"} · {account.role}
                    </span>
                  </div>
                  <a
                    href={href}
                    className="mt-0.5 block break-all text-[10px] text-primary underline"
                  >
                    {href}
                  </a>
                </div>
              ))}
            </div>
          </DialogContent>
        </Dialog>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreate}>
              <Plus className="h-3.5 w-3.5" />
              Create account
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create user account</DialogTitle>
              <DialogDescription>
                Provision a dashboard for a staff member in the subsidiary they belong to.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <Label htmlFor="account-staff">Link to staff member (optional)</Label>
                <Select
                  id="account-staff"
                  value=""
                  onChange={(event) => linkStaff(event.target.value)}
                >
                  <option value="">Enter details manually</option>
                  {staff
                    .slice()
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .map((member) => (
                      <option key={member.id} value={member.id}>
                        {member.name} — {member.role}
                      </option>
                    ))}
                </Select>
              </div>
              <div>
                <Label htmlFor="account-name">Full name</Label>
                <Input
                  id="account-name"
                  value={form.name}
                  onChange={(event) => setForm({ ...form, name: event.target.value })}
                  placeholder="e.g. Esther Nakato"
                />
              </div>
              <div>
                <Label htmlFor="account-email">Work email</Label>
                <Input
                  id="account-email"
                  type="email"
                  value={form.email}
                  onChange={(event) => setForm({ ...form, email: event.target.value })}
                  placeholder="name@district12.co.ug"
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label htmlFor="account-role">Access level</Label>
                  <Select
                    id="account-role"
                    value={form.role}
                    onChange={(event) =>
                      setForm({ ...form, role: event.target.value as AccountRole })
                    }
                  >
                    <option value="staff">Staff user</option>
                    <option value="manager">Subsidiary manager</option>
                    <option value="admin">Group admin</option>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="account-company">Subsidiary</Label>
                  <Select
                    id="account-company"
                    value={form.companyId}
                    onChange={(event) => setForm({ ...form, companyId: event.target.value })}
                  >
                    {form.role === "admin" ? (
                      <option value="">Group office (all entities)</option>
                    ) : null}
                    {companies.map((company) => (
                      <option key={company.id} value={company.id}>
                        {company.name}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">Create account</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </PageHeader>

      <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Accounts", value: totals.total, icon: UserCog, chip: "bg-blue-50 text-blue-700" },
          { label: "Active", value: totals.active, icon: UserCheck, chip: "bg-emerald-50 text-emerald-700" },
          { label: "Group admins", value: totals.admins, icon: ShieldCheck, chip: "bg-violet-50 text-violet-700" },
          { label: "Suspended", value: totals.suspended, icon: UserX, chip: "bg-red-50 text-red-700" },
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

      <Card>
        <CardContent className="p-0">
          <div className="flex flex-col gap-2 border-b border-border p-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search name, email or subsidiary"
                className="pl-8"
                aria-label="Search accounts"
              />
            </div>
            <Select
              value={activeCompany}
              onChange={(event) => setCompanyFilter(event.target.value)}
              className="sm:w-48"
              aria-label="Filter by subsidiary"
            >
              <option value="all">All subsidiaries</option>
              {companies.map((company) => (
                <option key={company.id} value={company.id}>
                  {company.shortName}
                </option>
              ))}
            </Select>
            <Select
              value={roleFilter}
              onChange={(event) => setRoleFilter(event.target.value)}
              className="sm:w-44"
              aria-label="Filter by access level"
            >
              <option value="all">All access levels</option>
              <option value="admin">Group admin</option>
              <option value="manager">Subsidiary manager</option>
              <option value="staff">Staff user</option>
            </Select>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead className="hidden md:table-cell">Subsidiary</TableHead>
                <TableHead>Access</TableHead>
                <TableHead className="hidden lg:table-cell">Created</TableHead>
                <TableHead className="hidden xl:table-cell">Last active</TableHead>
                <TableHead className="text-right">Status</TableHead>
                <TableHead className="w-24" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((account) => {
                const company = companies.find((item) => item.id === account.companyId);
                return (
                  <TableRow key={account.id}>
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#131313] text-[10px] font-bold text-white">
                          {initials(account.name)}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-xs font-semibold text-foreground">
                            {account.name}
                          </p>
                          <p className="truncate text-[11px] text-muted-foreground">
                            {account.email}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {company ? (
                        <span className="flex items-center gap-2">
                          <CompanyMark company={company} size="sm" />
                          <span className="text-xs text-muted-foreground">
                            {company.shortName}
                          </span>
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">Group office</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <RoleBadge role={account.role} />
                    </TableCell>
                    <TableCell className="hidden text-xs text-muted-foreground lg:table-cell">
                      {formatDate(account.createdAt)}
                    </TableCell>
                    <TableCell className="hidden text-xs text-muted-foreground xl:table-cell">
                      {formatDate(account.lastActive)}
                    </TableCell>
                    <TableCell className="text-right">
                      <StatusBadge status={account.status} />
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="flex items-center justify-end gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => openDashboard(account)}
                          title="Open dashboard"
                          aria-label={`Open ${account.name}'s dashboard`}
                        >
                          <LayoutDashboard className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => copyDashboardLink(account)}
                          title="Copy dashboard link"
                          aria-label={`Copy dashboard link for ${account.name}`}
                        >
                          <Link2 className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() =>
                            setAccountStatus(
                              account.id,
                              account.status === "active" ? "suspended" : "active"
                            )
                          }
                          title={account.status === "active" ? "Suspend account" : "Activate account"}
                          aria-label={
                            account.status === "active"
                              ? `Suspend ${account.name}`
                              : `Activate ${account.name}`
                          }
                        >
                          {account.status === "active" ? (
                            <UserX className="h-3.5 w-3.5" />
                          ) : (
                            <UserCheck className="h-3.5 w-3.5" />
                          )}
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleDelete(account)}
                          title="Delete account"
                          aria-label={`Delete ${account.name}'s account`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </span>
                    </TableCell>
                  </TableRow>
                );
              })}
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-10 text-center">
                    <p className="text-sm font-semibold text-foreground">No accounts found</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Adjust the filters or create an account for this subsidiary.
                    </p>
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <p className="mt-3 text-[11px] text-muted-foreground">
        Showing {filtered.length} of {scoped.length} accounts
        {activeCompany === "all" ? " across the group." : " for the selected subsidiary."}{" "}
        Group admins control every subsidiary; managers and staff see only their own.
      </p>
    </div>
  );
}
