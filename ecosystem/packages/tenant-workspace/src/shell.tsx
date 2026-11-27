"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import {
  ArrowUpRight,
  BarChart3,
  Bell,
  Building2,
  CalendarDays,
  CheckSquare,
  Clock3,
  FileText,
  Folder,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  PhoneCall,
  Receipt,
  Send,
  Settings,
  UserCog,
  UserRound,
  Users,
  UsersRound,
  Wallet,
  X,
  type LucideIcon,
} from "lucide-react";
import { hubAppUrl, type TenantId, type TenantMeta } from "@d12/contracts";
import { Avatar, BrandMark, cn } from "@d12/ui";
import { allowsAll } from "./permissions";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  permissions?: string[];
  tenants?: TenantId[];
  hiddenFor?: TenantId[];
  labels?: Partial<Record<TenantId, string>>;
}

export interface CohortLink {
  id: string;
  code: string;
  label: string;
}

const TALENT_CLINIC_HIDDEN = ["talent-clinic"] as const;

const ITEMS: NavItem[] = [
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/leads", label: "Leads", icon: Users, permissions: ["leads.read"], hiddenFor: [...TALENT_CLINIC_HIDDEN] },
  { href: "/customers", label: "Customers", icon: Building2, permissions: ["customers.read"], labels: { "talent-clinic": "Participants" } },
  { href: "/sales", label: "Sales", icon: Receipt, permissions: ["sales.read"], hiddenFor: [...TALENT_CLINIC_HIDDEN] },
  { href: "/tasks", label: "Tasks", icon: CheckSquare, permissions: ["tasks.read"], hiddenFor: [...TALENT_CLINIC_HIDDEN] },
  { href: "/meetings", label: "Meetings", icon: CalendarDays, permissions: ["meetings.read"], tenants: ["mariz"], hiddenFor: [...TALENT_CLINIC_HIDDEN] },
  { href: "/calls", label: "Calls", icon: PhoneCall, permissions: ["calls.read"], tenants: ["mariz"], hiddenFor: [...TALENT_CLINIC_HIDDEN] },
  { href: "/projects", label: "Projects", icon: Folder, permissions: ["projects.read"], labels: { "talent-clinic": "Cohorts" } },
  { href: "/inventory", label: "Inventory", icon: Package, permissions: ["inventory.read"], hiddenFor: [...TALENT_CLINIC_HIDDEN] },
  { href: "/transactions", label: "Finance", icon: Wallet, permissions: ["transactions.read"], hiddenFor: [...TALENT_CLINIC_HIDDEN] },
  { href: "/invoices", label: "Invoices", icon: FileText, permissions: ["invoices.read"], hiddenFor: [...TALENT_CLINIC_HIDDEN] },
  { href: "/staff", label: "Staff", icon: UsersRound, permissions: ["staff.read"], hiddenFor: [...TALENT_CLINIC_HIDDEN] },
  { href: "/desk/reports", label: "Reports", icon: Send, permissions: ["reports.submit"], hiddenFor: [...TALENT_CLINIC_HIDDEN] },
  { href: "/desk/team", label: "Team management", icon: UserCog, permissions: ["team.manage"], hiddenFor: [...TALENT_CLINIC_HIDDEN] },
  { href: "/desk/shifts", label: "Shift sign-outs", icon: Clock3, permissions: ["shifts.read"], hiddenFor: [...TALENT_CLINIC_HIDDEN] },
  { href: "/reports", label: "Analytics", icon: BarChart3, permissions: ["reports.read", "sales.read"], hiddenFor: [...TALENT_CLINIC_HIDDEN] },
  { href: "/desk/notifications", label: "Notifications", icon: Bell, permissions: ["notifications.read"], hiddenFor: [...TALENT_CLINIC_HIDDEN] },
  { href: "/desk/settings", label: "Settings", icon: Settings },
  { href: "/desk/profile", label: "Profile", icon: UserRound },
];

function isActive(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

function shiftStartLabel(iso?: string): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Kampala",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

function durationLabel(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours}h ${rest}m` : `${hours}h`;
}

interface ShiftEndBody {
  recorded?: boolean;
  minutes?: number;
  message?: string;
  error?: { message?: string };
}

export function TenantShell({
  tenant,
  userName,
  roleLabel,
  permissions,
  shiftStartedAt,
  accent,
  density = "comfortable",
  cohortLinks,
  children,
}: {
  tenant: TenantMeta;
  userName: string;
  roleLabel: string;
  permissions: string[];
  shiftStartedAt?: string;
  accent?: string;
  density?: "compact" | "comfortable";
  cohortLinks?: CohortLink[];
  children: ReactNode;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeCohortId = searchParams.get("cohort") || "all";
  const [pending, setPending] = useState(false);
  const [shiftPending, setShiftPending] = useState(false);
  const [shiftNote, setShiftNote] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const items = ITEMS.filter(
    (item) =>
      allowsAll(permissions, item.permissions) &&
      (!item.tenants || item.tenants.includes(tenant.id)) &&
      !(item.hiddenFor ?? []).includes(tenant.id),
  ).map((item) => ({
    ...item,
    label: item.labels?.[tenant.id] ?? item.label,
  }));
  const activeItem = items.find((item) => isActive(pathname, item.href)) ?? items[0];
  const activeColor = accent || tenant.color;
  const compact = density === "compact";

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!menuOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, [menuOpen]);

  useEffect(() => {
    if (!shiftNote) return;
    const timer = window.setTimeout(() => setShiftNote(null), 5000);
    return () => window.clearTimeout(timer);
  }, [shiftNote]);

  async function endShift(via: "shift" | "signout"): Promise<boolean> {
    try {
      const response = await fetch("/api/shifts/end", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ via }),
      });
      const body = (await response.json().catch(() => null)) as ShiftEndBody | null;
      if (!response.ok) {
        if (via === "shift") {
          setShiftNote({
            tone: "error",
            text: body?.error?.message ?? "Could not end the shift.",
          });
        }
        return false;
      }
      if (via === "shift") {
        setShiftNote(
          body?.recorded
            ? { tone: "ok", text: `Shift ended · ${durationLabel(body.minutes ?? 0)} recorded.` }
            : { tone: "ok", text: body?.message ?? "Shift ended." },
        );
      }
      return true;
    } catch {
      if (via === "shift") {
        setShiftNote({ tone: "error", text: "Could not reach the group hub." });
      }
      return false;
    }
  }

  async function logout(): Promise<void> {
    setPending(true);
    try {
      await endShift("signout");
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      window.location.assign(`${hubAppUrl()}/login`);
    }
  }

  async function onEndShift(): Promise<void> {
    setShiftPending(true);
    try {
      await endShift("shift");
    } finally {
      setShiftPending(false);
    }
  }

  const startedAt = shiftStartLabel(shiftStartedAt);

  function renderNav(mobile: boolean): ReactNode {
    return (
      <>
          {items.map((item) => {
            const Icon = item.icon;
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={mobile ? () => setMenuOpen(false) : undefined}
                className={cn(
                  "flex items-center gap-2.5 rounded-lg px-3 text-sm font-medium transition-colors",
                  mobile ? "py-2.5" : compact ? "py-1.5" : "py-2",
                  active ? "text-white" : "text-ink-soft hover:bg-canvas hover:text-ink",
                )}
                style={active ? { backgroundColor: activeColor } : undefined}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
          {cohortLinks?.length ? (
            <div className="mt-3 border-t border-line pt-3">
              <p className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-ink-mute">
                Cohort selector
              </p>
              <div className="space-y-0.5">
                <Link
                  href="/?cohort=all"
                  onClick={mobile ? () => setMenuOpen(false) : undefined}
                  className={cn(
                    "flex items-center gap-2 rounded-lg px-3 text-xs font-medium transition-colors",
                    pathname === "/" && activeCohortId === "all"
                      ? "bg-emerald-50 text-emerald-800"
                      : "text-ink-soft hover:bg-canvas hover:text-ink",
                    mobile ? "py-2.5" : compact ? "py-1.5" : "py-2",
                  )}
                >
                  <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded bg-slate-100 text-[9px] font-bold text-slate-600">
                    ALL
                  </span>
                  All Cohorts
                </Link>
                {cohortLinks.map((cohort) => {
                  const active = pathname === "/" && activeCohortId === cohort.id;
                  return (
                    <Link
                      key={cohort.id}
                      href={`/?cohort=${encodeURIComponent(cohort.id)}`}
                      onClick={mobile ? () => setMenuOpen(false) : undefined}
                      title={cohort.label}
                      className={cn(
                        "flex items-center gap-2 rounded-lg px-3 text-xs font-medium transition-colors",
                        mobile ? "py-2.5" : compact ? "py-1.5" : "py-2",
                        active ? "bg-emerald-50 text-emerald-800" : "text-ink-soft hover:bg-canvas hover:text-ink",
                      )}
                    >
                      <span
                        className={cn(
                          "flex h-4 w-4 shrink-0 items-center justify-center rounded text-[9px] font-bold",
                          active ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-600",
                        )}
                      >
                        {cohort.code.slice(-2) || "•"}
                      </span>
                      <span className="truncate">{cohort.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ) : null}
      </>
    );
  }

  return (
    <div className="min-h-screen bg-canvas">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col border-r border-line bg-white lg:flex">
        <div className="flex shrink-0 items-center gap-2.5 px-5 pb-4 pt-6">
          <BrandMark
            mark={tenant.mark}
            color={tenant.color}
            logo={tenant.logo}
            alt={`${tenant.shortName} logo`}
          />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold tracking-tight text-ink">{tenant.shortName}</p>
            <p className="truncate text-[11px] text-ink-mute">{tenant.sector}</p>
          </div>
        </div>

        <nav className="min-h-0 flex-1 space-y-0.5 overflow-y-auto px-3 pb-3">
          {renderNav(false)}
        </nav>

        <div className="shrink-0 space-y-3 border-t border-line px-3 pb-4 pt-3">
          <a
            href={`${hubAppUrl()}/dashboard`}
            className="group flex items-center justify-between gap-2 rounded-lg border border-line px-3 py-2 text-xs font-medium text-ink-soft transition-colors hover:border-navy/30 hover:text-ink"
          >
            Group hub
            <ArrowUpRight className="h-3.5 w-3.5 text-ink-mute" />
          </a>
          <div className="border-t border-line px-1 pt-3">
            <div className="flex items-center gap-2.5">
              <Avatar name={userName} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-ink">{userName}</p>
                <p className="truncate text-[11px] text-ink-mute">{roleLabel}</p>
              </div>
            </div>
            {startedAt ? (
              <p className="mt-2 flex items-center gap-1 text-[11px] text-ink-mute">
                <Clock3 className="h-3 w-3" />
                On shift since {startedAt}
              </p>
            ) : null}
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={onEndShift}
                disabled={shiftPending}
                className="inline-flex items-center gap-1.5 rounded-lg border border-line px-2 py-1.5 text-xs font-medium text-ink-soft transition-colors hover:border-navy/30 hover:text-ink disabled:opacity-50"
              >
                <Clock3 className="h-3.5 w-3.5" />
                {shiftPending ? "Ending shift" : "End shift"}
              </button>
              <button
                type="button"
                onClick={logout}
                disabled={pending}
                className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium text-ink-soft transition-colors hover:bg-canvas hover:text-ink disabled:opacity-50"
              >
                <LogOut className="h-3.5 w-3.5" />
                {pending ? "Signing out" : "Sign out"}
              </button>
            </div>
          </div>
        </div>
      </aside>

      <header className="sticky top-0 z-30 border-b border-line bg-white lg:hidden">
        <div className="flex h-14 items-center gap-2 px-2">
          <button
            type="button"
            aria-label="Open navigation"
            aria-expanded={menuOpen}
            aria-controls="tenant-drawer"
            onClick={() => setMenuOpen(true)}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-ink hover:bg-canvas focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy"
          >
            <Menu className="h-5 w-5" />
          </button>
          <BrandMark
            mark={tenant.mark}
            color={tenant.color}
            logo={tenant.logo}
            alt={`${tenant.shortName} logo`}
            size="sm"
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold leading-tight text-ink">{activeItem?.label ?? tenant.shortName}</p>
            <p className="truncate text-[11px] leading-tight text-ink-mute">{activeItem ? tenant.shortName : roleLabel}</p>
          </div>
          <button
            type="button"
            onClick={onEndShift}
            disabled={shiftPending}
            aria-label="End shift"
            title="End shift"
            className="flex h-10 w-10 items-center justify-center rounded-lg text-ink-soft hover:bg-canvas hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy disabled:opacity-50"
          >
            <Clock3 className="h-[18px] w-[18px]" />
          </button>
          <button
            type="button"
            onClick={logout}
            disabled={pending}
            aria-label="Sign out"
            title="Sign out"
            className="flex h-10 w-10 items-center justify-center rounded-lg text-ink-soft hover:bg-canvas hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy disabled:opacity-50"
          >
            <LogOut className="h-[18px] w-[18px]" />
          </button>
        </div>
      </header>

      {menuOpen ? (
        <div
          className="fixed inset-0 z-50 lg:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Workspace navigation"
          onKeyDown={(event) => { if (event.key === "Escape") setMenuOpen(false); }}
        >
          <button
            type="button"
            aria-label="Close navigation"
            tabIndex={-1}
            onClick={() => setMenuOpen(false)}
            className="absolute inset-0 bg-slate-900/50 animate-in fade-in"
          />
          <aside id="tenant-drawer" className="absolute inset-y-0 left-0 flex w-[86%] max-w-xs flex-col bg-white shadow-pop animate-in slide-in-from-left duration-200">
            <div className="flex shrink-0 items-center gap-2.5 border-b border-line px-4 py-4">
              <BrandMark mark={tenant.mark} color={tenant.color} logo={tenant.logo} alt={`${tenant.shortName} logo`} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold tracking-tight text-ink">{tenant.shortName}</p>
                <p className="truncate text-[11px] text-ink-mute">{tenant.sector}</p>
              </div>
              <button
                type="button"
                autoFocus
                aria-label="Close navigation"
                onClick={() => setMenuOpen(false)}
                className="flex h-10 w-10 items-center justify-center rounded-lg text-ink-soft hover:bg-canvas hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy disabled:opacity-50 shrink-0"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav id="tenant-sections" aria-label="Workspace sections" className="min-h-0 flex-1 space-y-0.5 overflow-y-auto overscroll-contain px-3 py-3">
              {renderNav(true)}
            </nav>
            <div className="shrink-0 space-y-3 border-t border-line px-4 py-3">
              <div className="flex items-center gap-2.5">
                <Avatar name={userName} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink">{userName}</p>
                  <p className="truncate text-[11px] text-ink-mute">
                    {roleLabel}{startedAt ? ` · on shift since ${startedAt}` : ""}
                  </p>
                </div>
              </div>
              <a
                href={`${hubAppUrl()}/dashboard`}
                className="flex h-10 items-center justify-between gap-2 rounded-lg border border-line px-3 text-sm font-medium text-ink-soft hover:border-navy/30 hover:text-ink"
              >
                Group hub
                <ArrowUpRight className="h-4 w-4 text-ink-mute" />
              </a>
            </div>
          </aside>
        </div>
      ) : null}

      <main className="lg:pl-60">
        <div className={cn("mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8", compact ? "py-4" : "py-5")}>{children}</div>
      </main>

      {shiftNote ? (
        <div
          role="status"
          aria-live="polite"
          className={cn(
            "fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-lg px-4 py-2 text-xs font-medium text-white shadow-pop",
            shiftNote.tone === "ok" ? "bg-navy" : "bg-red-600",
          )}
        >
          {shiftNote.text}
        </div>
      ) : null}
    </div>
  );
}
