"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import {
  ArrowUpRight,
  BarChart3,
  Bell,
  Building2,
  CheckSquare,
  ChevronDown,
  Clock3,
  FileText,
  Folder,
  LayoutDashboard,
  LogOut,
  Package,
  Receipt,
  Send,
  Settings,
  UserCog,
  UserRound,
  Users,
  UsersRound,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { hubAppUrl, type TenantMeta } from "@d12/contracts";
import { Avatar, BrandMark, cn } from "@d12/ui";
import { allowsAll } from "./permissions";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  permissions?: string[];
}

const ITEMS: NavItem[] = [
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/leads", label: "Leads", icon: Users, permissions: ["leads.read"] },
  { href: "/customers", label: "Customers", icon: Building2, permissions: ["customers.read"] },
  { href: "/sales", label: "Sales", icon: Receipt, permissions: ["sales.read"] },
  { href: "/tasks", label: "Tasks", icon: CheckSquare, permissions: ["tasks.read"] },
  { href: "/projects", label: "Projects", icon: Folder, permissions: ["projects.read"] },
  { href: "/inventory", label: "Inventory", icon: Package, permissions: ["inventory.read"] },
  { href: "/transactions", label: "Finance", icon: Wallet, permissions: ["transactions.read"] },
  { href: "/invoices", label: "Invoices", icon: FileText, permissions: ["invoices.read"] },
  { href: "/staff", label: "Staff", icon: UsersRound, permissions: ["staff.read"] },
  { href: "/desk/reports", label: "Reports", icon: Send, permissions: ["reports.submit"] },
  { href: "/desk/team", label: "Team management", icon: UserCog, permissions: ["team.manage"] },
  { href: "/desk/shifts", label: "Shift sign-outs", icon: Clock3, permissions: ["shifts.read"] },
  { href: "/reports", label: "Analytics", icon: BarChart3, permissions: ["reports.read", "sales.read"] },
  { href: "/desk/notifications", label: "Notifications", icon: Bell, permissions: ["notifications.read"] },
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
  children,
}: {
  tenant: TenantMeta;
  userName: string;
  roleLabel: string;
  permissions: string[];
  shiftStartedAt?: string;
  accent?: string;
  density?: "compact" | "comfortable";
  children: ReactNode;
}) {
  const pathname = usePathname();
  const [pending, setPending] = useState(false);
  const [shiftPending, setShiftPending] = useState(false);
  const [shiftNote, setShiftNote] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const items = ITEMS.filter((item) => allowsAll(permissions, item.permissions));
  const activeItem = items.find((item) => isActive(pathname, item.href)) ?? items[0];
  const activeColor = accent || tenant.color;
  const compact = density === "compact";

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

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
          {items.map((item) => {
            const Icon = item.icon;
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-2.5 rounded-lg px-3 text-sm font-medium transition-colors",
                  compact ? "py-1.5" : "py-2",
                  active ? "text-white" : "text-ink-soft hover:bg-canvas hover:text-ink",
                )}
                style={active ? { backgroundColor: activeColor } : undefined}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
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
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex min-w-0 items-center gap-2">
            <BrandMark
              mark={tenant.mark}
              color={tenant.color}
              logo={tenant.logo}
              alt={`${tenant.shortName} logo`}
              size="sm"
            />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold leading-none text-ink">{tenant.shortName}</p>
              <p className="mt-1 truncate text-[11px] leading-none text-ink-mute">{roleLabel}</p>
            </div>
          </div>
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              onClick={onEndShift}
              disabled={shiftPending}
              aria-label="End shift"
              title="End shift"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-mute hover:bg-canvas hover:text-ink disabled:opacity-50"
            >
              <Clock3 className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={logout}
              disabled={pending}
              aria-label="Sign out"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-mute hover:bg-canvas hover:text-ink disabled:opacity-50"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
        <button
          type="button"
          aria-expanded={menuOpen}
          aria-controls="tenant-sections"
          onClick={() => setMenuOpen((open) => !open)}
          className="flex w-full items-center justify-between gap-3 border-t border-line px-4 py-2 text-left transition-colors hover:bg-canvas focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-navy"
        >
          <span className="flex min-w-0 items-center gap-2 text-xs font-semibold text-ink">
            {activeItem ? (
              <span
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-white"
                style={{ backgroundColor: activeColor }}
              >
                <activeItem.icon className="h-3.5 w-3.5" />
              </span>
            ) : null}
            <span className="truncate">{activeItem?.label ?? "Sections"}</span>
          </span>
          <span className="flex shrink-0 items-center gap-1 text-[11px] font-medium text-ink-soft">
            All sections
            <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", menuOpen && "rotate-180")} />
          </span>
        </button>
        {menuOpen ? (
          <nav id="tenant-sections" aria-label="Workspace sections" className="max-h-[60vh] overflow-y-auto border-t border-line px-3 pb-3 pt-2">
            <div className="grid grid-cols-2 gap-1 sm:grid-cols-3 md:grid-cols-4">
              {items.map((item) => {
                const Icon = item.icon;
                const active = isActive(pathname, item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMenuOpen(false)}
                    className={cn(
                      "flex min-w-0 items-center gap-2 rounded-lg px-2.5 text-xs font-medium",
                      compact ? "py-1.5" : "py-2",
                      active ? "text-white" : "bg-canvas text-ink-soft hover:text-ink",
                    )}
                    style={active ? { backgroundColor: activeColor } : undefined}
                  >
                    <Icon className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </nav>
        ) : null}
      </header>

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
