"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  BarChart3,
  Bell,
  BriefcaseBusiness,
  CalendarCheck2,
  CalendarOff,
  ChevronDown,
  Clock3,
  Database,
  FileText,
  GraduationCap,
  IdCard,
  LayoutDashboard,
  ListChecks,
  LogOut,
  Search,
  Settings,
  Target,
  UsersRound,
  Wallet,
  X,
  type LucideIcon,
} from "lucide-react";
import { TENANTS, type AccountView, type HubNotification, type TenantId } from "@d12/contracts";
import { Avatar, cn } from "@d12/ui";
import { relativeTime } from "@/lib/format";

interface NavItem {
  href: string;
  label: string;
  short: string;
  icon: LucideIcon;
  available: boolean;
  permission?: string;
  exact?: boolean;
}

const ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Group overview", short: "Overview", icon: LayoutDashboard, available: true, permission: "iam.read" },
  { href: "/finance", label: "Finance monitoring", short: "Finance", icon: Wallet, available: true, permission: "finance.read" },
  { href: "/warehouse", label: "Data warehouse", short: "Warehouse", icon: Database, available: true, permission: "warehouse.read" },
  { href: "/hr", label: "HR provisioning", short: "HR", icon: IdCard, available: true, permission: "hr.provision" },
  { href: "/team", label: "Team management", short: "Team", icon: UsersRound, available: true, permission: "team.manage" },
  { href: "/shifts", label: "Shift sign-outs", short: "Shifts", icon: Clock3, available: true, permission: "shifts.read" },
  { href: "/analytics", label: "Analytics", short: "Analytics", icon: BarChart3, available: true, permission: "reports.read" },
  { href: "/reports", label: "Subsidiary reports", short: "Reports", icon: FileText, available: true, permission: "reports.read" },
  { href: "/tasks", label: "Tasks", short: "Tasks", icon: ListChecks, available: true, permission: "group.tasks" },
  { href: "/notifications", label: "Notifications", short: "Notifications", icon: Bell, available: true, permission: "notifications.read" },
  { href: "/settings", label: "Settings", short: "Settings", icon: Settings, available: true, permission: "group.settings" },
];

export const HR_ITEMS: NavItem[] = [
  { href: "/hr", label: "Dashboard", short: "Dashboard", icon: LayoutDashboard, available: true, exact: true },
  { href: "/hr/employees", label: "Employees", short: "Employees", icon: UsersRound, available: true },
  { href: "/hr/team", label: "Employment profiles", short: "Profiles", icon: UsersRound, available: true, permission: "team.manage" },
  { href: "/hr/attendance", label: "Attendance", short: "Attendance", icon: CalendarCheck2, available: true, permission: "hr.manage" },
  { href: "/hr/leave", label: "Leave Management", short: "Leave", icon: CalendarOff, available: true, permission: "hr.manage" },
  { href: "/hr/payroll", label: "Payroll", short: "Payroll", icon: Wallet, available: true, permission: "hr.payroll" },
  { href: "/hr/performance", label: "Performance", short: "Performance", icon: Target, available: true, permission: "hr.manage" },
  { href: "/hr/recruitment", label: "Recruitment", short: "Recruitment", icon: BriefcaseBusiness, available: true, permission: "hr.manage" },
  { href: "/hr/training", label: "Training & Development", short: "Training", icon: GraduationCap, available: true, permission: "hr.manage" },
  { href: "/hr/reports", label: "Reports & Analytics", short: "Reports", icon: BarChart3, available: true, permission: "hr.reports" },
  { href: "/reports", label: "Subsidiary reports", short: "Subsidiary reports", icon: FileText, available: true, permission: "hr.reports" },
  { href: "/notifications", label: "Notifications", short: "Inbox", icon: Bell, available: true, permission: "notifications.read" },
  { href: "/hr/settings", label: "Settings", short: "Settings", icon: Settings, available: true, permission: "hr.manage" },
];

export function isHrPath(pathname: string): boolean {
  return pathname === "/hr" || pathname.startsWith("/hr/");
}

export function HubNav({
  permissions,
  isGroupAdmin = false,
  dark = false,
}: {
  permissions: string[];
  isGroupAdmin?: boolean;
  dark?: boolean;
}) {
  const pathname = usePathname();
  const hr = isHrPath(pathname);
  const items = (hr ? HR_ITEMS : ITEMS).filter((item) =>
    !item.permission || permissions.includes("*") || permissions.includes(item.permission),
  );

  return (
    <nav aria-label={hr ? "HR navigation" : "Main navigation"} className="space-y-1">
      {items.map((item) => {
        const Icon = item.icon;
        const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
        const className = cn(
          "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2",
          dark ? "focus-visible:ring-white" : "focus-visible:ring-navy",
          active
            ? dark ? "bg-royal text-white shadow-sm" : "bg-navy text-white"
            : dark ? "text-slate-200 hover:bg-navy-700 hover:text-white" : "text-ink-soft hover:bg-canvas hover:text-ink",
        );
        const content = (
          <>
            <Icon className="h-[18px] w-[18px] shrink-0" />
            <span className={cn("min-w-0 flex-1", hr ? "leading-5" : "truncate")}>{item.label}</span>
          </>
        );
        return (
          <Link key={item.href} href={item.href} className={className} aria-current={active ? "page" : undefined}>
            {content}
          </Link>
        );
      })}
    </nav>
  );
}

export function HubMobileNav({
  permissions,
  dark = false,
}: {
  permissions: string[];
  dark?: boolean;
}) {
  const pathname = usePathname();
  const hr = isHrPath(pathname);
  const items = (hr ? HR_ITEMS : ITEMS).filter((item) =>
    !item.permission || permissions.includes("*") || permissions.includes(item.permission),
  );
  const active = items.find((item) =>
    item.exact ? pathname === item.href : pathname.startsWith(item.href),
  ) ?? items[0];
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <div className={cn("border-t", dark ? "border-white/10" : "border-line")}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls="hub-sections"
        onClick={() => setOpen((value) => !value)}
        className={cn(
          "flex w-full items-center justify-between gap-3 px-4 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset",
          dark ? "text-slate-100 hover:bg-navy-700 focus-visible:ring-white" : "text-ink hover:bg-canvas focus-visible:ring-navy",
        )}
      >
        <span className="flex min-w-0 items-center gap-2 text-xs font-semibold">
          {active ? (
            <span className={cn("flex h-6 w-6 shrink-0 items-center justify-center rounded-md", dark ? "bg-royal text-white" : "bg-navy text-white")}>
              <active.icon className="h-3.5 w-3.5" />
            </span>
          ) : null}
          <span className="truncate">{active ? active.label : "Sections"}</span>
        </span>
        <span className={cn("flex shrink-0 items-center gap-1 text-[11px] font-medium", dark ? "text-slate-300" : "text-ink-soft")}>
          All sections
          <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-180")} />
        </span>
      </button>
      {open ? (
        <nav id="hub-sections" aria-label={hr ? "HR sections" : "Group sections"} className="max-h-[55vh] overflow-y-auto px-3 pb-3 pt-1">
          <div className="grid grid-cols-2 gap-1 sm:grid-cols-3">
            {items.map((item) => {
              const Icon = item.icon;
              const isActive = item.exact ? pathname === item.href : pathname.startsWith(item.href);
              return (
                <Link
                  key={`${item.href}-${item.label}`}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "flex min-w-0 items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-medium transition-colors",
                    isActive
                      ? dark ? "bg-royal text-white" : "bg-navy text-white"
                      : dark ? "bg-white/5 text-slate-200 hover:bg-white/10" : "bg-canvas text-ink-soft hover:text-ink",
                  )}
                >
                  <Icon className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </Link>
              );
            })}
          </div>
        </nav>
      ) : null}
    </div>
  );
}

interface AuditItem {
  id: string;
  action: string;
  actor: string;
  target: string;
  at: string;
  detail?: string;
}

const AUDIT_LABELS: Record<string, string> = {
  "account.created": "New employee account",
  "account.updated": "Employee record updated",
  "account.deleted": "Employee account removed",
  "account.transferred": "Employee transferred",
  "workspace.bootstrap": "Directory loaded",
};

export function auditLabel(action: string): string {
  return AUDIT_LABELS[action] ?? action;
}

export function HubTopbar({
  name,
  roleLabel,
  canProvision,
  tenants,
}: {
  name: string;
  roleLabel: string;
  canProvision: boolean;
  tenants: TenantId[];
}) {
  const pathname = usePathname();
  const [search, setSearch] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [people, setPeople] = useState<AccountView[] | null>(null);
  const [notifications, setNotifications] = useState<HubNotification[]>([]);
  const [notificationError, setNotificationError] = useState("");

  useEffect(() => {
    if (!canProvision) return;
    const load = () => {
      fetch("/api/hub/notifications", { cache: "no-store" })
        .then(async (response) => { const body = await response.json(); if (!response.ok) throw new Error(body.error?.message ?? "Cannot load notifications"); return body; })
        .then((body: { notifications: HubNotification[] }) => { setNotifications(body.notifications.filter((entry) => !entry.archivedAt)); setNotificationError(""); })
        .catch((error: Error) => setNotificationError(error.message));
    };
    load();
    window.addEventListener("d12:workflow-changed", load);
    return () => window.removeEventListener("d12:workflow-changed", load);
  }, [canProvision, pathname, showNotifications]);

  function loadPeople(): void {
    if (!canProvision || people) return;
    setPeople([]);
    fetch("/api/hr/accounts", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((body: { accounts?: AccountView[] } | null) => setPeople(body?.accounts ?? []))
      .catch(() => undefined);
  }

  function toggleNotifications(): void {
    setShowNotifications((value) => !value);
  }

  const unread = notifications.filter((entry) => !entry.readAt).length;
  const needle = search.trim().toLowerCase();
  const pageIndex = [
    ...ITEMS.filter((item) => item.available && (item.href !== "/hr" || canProvision)),
    ...(canProvision ? HR_ITEMS.filter((item) => item.available && item.href !== "/hr") : []),
  ];
  const pages = pageIndex.filter((item) => item.label.toLowerCase().includes(needle));
  const subsidiaries = tenants.filter((id) => TENANTS[id].shortName.toLowerCase().includes(needle));
  const matches = needle
    ? (people ?? []).filter((person) => `${person.name} ${person.email} ${person.roleLabel}`.toLowerCase().includes(needle)).slice(0, 6)
    : [];
  const close = () => { setShowSearch(false); setSearch(""); };

  return (
    <div className="flex min-w-0 items-center justify-between gap-3">
      <div className="relative w-full max-w-md">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          type="search"
          aria-label="Search pages, employees and subsidiaries"
          placeholder="Search anything..."
          value={search}
          onChange={(event) => { setSearch(event.target.value); setShowSearch(true); }}
          onFocus={() => { setShowSearch(true); loadPeople(); }}
          onBlur={(event) => { if (!event.currentTarget.parentElement?.contains(event.relatedTarget)) setShowSearch(false); }}
          onKeyDown={(event) => { if (event.key === "Escape") setShowSearch(false); }}
          className="h-10 w-full rounded-full border border-slate-200 bg-canvas pl-11 pr-4 text-sm text-navy outline-none placeholder:text-slate-400 focus:border-royal focus:ring-2 focus:ring-royal/10"
        />
        {showSearch ? (
          <div className="absolute left-0 right-0 top-12 z-50 max-h-96 overflow-y-auto rounded-xl border border-line bg-white p-2 shadow-pop" onBlur={(event) => { if (!event.currentTarget.parentElement?.contains(event.relatedTarget)) setShowSearch(false); }}>
            {matches.length ? (
              <>
                <p className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-ink-soft">Employees</p>
                {matches.map((person) => (
                  <Link key={person.id} href={`/hr/employees?q=${encodeURIComponent(person.email)}`} onClick={close} className="flex items-center gap-2.5 rounded-lg px-3 py-2 hover:bg-royal-50 focus:bg-royal-50 focus:outline-none">
                    <Avatar name={person.name} className="h-7 w-7 text-[10px]" />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-navy">{person.name}</span>
                      <span className="block truncate text-[11px] text-ink-soft">{person.roleLabel} · {person.email}</span>
                    </span>
                  </Link>
                ))}
              </>
            ) : null}
            <p className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-ink-soft">Pages & subsidiaries</p>
            {pages.map((item) => (
              <Link key={item.href} href={item.href} onClick={close} className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-navy hover:bg-royal-50 focus:bg-royal-50 focus:outline-none">
                <item.icon className="h-4 w-4 text-royal" />{item.label}
              </Link>
            ))}
            {subsidiaries.map((id) => (
              <a key={id} href={`/api/auth/handoff?tenant=${id}`} className="block rounded-lg px-3 py-2 text-sm text-navy hover:bg-royal-50">{TENANTS[id].shortName}</a>
            ))}
            {!pages.length && !subsidiaries.length && !matches.length ? <p className="px-3 py-3 text-sm text-ink-soft">No matches for “{search.trim()}”.</p> : null}
          </div>
        ) : null}
      </div>
      <div className="flex shrink-0 items-center gap-3 sm:gap-5">
        <div className="relative">
          <button type="button" aria-label={`Notifications, ${unread} unread`} aria-expanded={showNotifications} onClick={toggleNotifications} className="relative flex h-9 w-9 items-center justify-center rounded-full text-navy hover:bg-canvas focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-royal">
            <Bell className="h-5 w-5" />
            {unread ? (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white ring-2 ring-white">{unread > 9 ? "9+" : unread}</span>
            ) : null}
          </button>
          {showNotifications ? (
            <div className="absolute right-0 top-12 z-50 w-80 max-w-[calc(100vw-2rem)] rounded-xl border border-line bg-white shadow-pop" onKeyDown={(event) => { if (event.key === "Escape") setShowNotifications(false); }}>
              <div className="flex items-center justify-between border-b border-line px-4 py-3">
                <p className="text-sm font-semibold text-navy">Notifications</p>
                <button type="button" aria-label="Close notifications" onClick={() => setShowNotifications(false)} className="rounded p-1 text-ink-soft hover:bg-canvas"><X className="h-4 w-4" /></button>
              </div>
              {notifications.length ? (
                <ul className="max-h-80 divide-y divide-line overflow-y-auto">
                  {notifications.slice(0, 8).map((entry) => (
                    <li key={entry.id} className="px-4 py-2.5">
                      <Link href={entry.href} onClick={() => setShowNotifications(false)} className="text-xs font-semibold text-navy hover:underline">{entry.title}</Link>
                      <p className="mt-0.5 text-[10px] text-slate-400">{relativeTime(entry.createdAt)}</p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="px-4 py-4 text-xs text-ink-soft">{notificationError || "No notifications yet."}</p>
              )}
              <Link href="/notifications" onClick={() => setShowNotifications(false)} className="block border-t border-line px-4 py-3 text-xs font-semibold text-royal hover:bg-canvas">Open notification inbox</Link>
            </div>
          ) : null}
        </div>
        <div className="flex items-center gap-2.5 border-l border-line pl-3 sm:pl-5">
          <Avatar name={name} className="h-10 w-10 bg-royal-50 text-royal" />
          <div className="hidden min-w-0 sm:block">
            <p className="text-sm font-semibold text-navy">{name}</p>
            <p className="text-[11px] text-ink-soft">{roleLabel}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export function LogoutButton({ compact = false, dark = false }: { compact?: boolean; dark?: boolean }) {
  const [pending, setPending] = useState(false);

  async function logout(): Promise<void> {
    setPending(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      window.location.assign("/login");
    }
  }

  return (
    <button type="button" onClick={logout} disabled={pending} className={cn(
      "inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-royal disabled:opacity-50",
      dark ? "text-slate-200 hover:bg-navy-700 hover:text-white" : "text-ink-soft hover:bg-canvas hover:text-ink",
      compact && "px-1.5",
    )}>
      <LogOut className="h-4 w-4" />
      {pending ? "Signing out" : "Sign out"}
    </button>
  );
}
