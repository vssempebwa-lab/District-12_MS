"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import {
  BarChart3,
  Bell,
  Building2,
  FolderKanban,
  Handshake,
  LayoutDashboard,
  Menu,
  Package,
  Plus,
  Settings,
  ShieldCheck,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { TODAY } from "@/lib/data";
import { formatDate } from "@/lib/format";
import { useEntity } from "@/components/entity-provider";
import { useSystem } from "@/components/system-provider";
import { Select } from "@/components/ui/select";

const navigation = [
  { href: "/", label: "Executive overview", icon: LayoutDashboard },
  { href: "/staff", label: "HR & payroll", icon: Users },
  { href: "/finance", label: "Finance & accounting", icon: Wallet },
  { href: "/inventory", label: "Inventory & supply", icon: Package },
  { href: "/crm", label: "CRM & pipeline", icon: Handshake },
  { href: "/projects", label: "Projects & ventures", icon: FolderKanban },
  { href: "/reports", label: "Reports & analytics", icon: BarChart3 },
  { href: "/accounts", label: "Accounts & access", icon: ShieldCheck },
  { href: "/companies", label: "Companies", icon: Building2 },
  { href: "/settings", label: "Settings", icon: Settings },
];

function pageTitle(pathname: string, entityName?: string) {
  if (pathname.startsWith("/companies/")) return "Company profile";
  if (pathname === "/crm") return "CRM";
  if (pathname.startsWith("/crm/contacts/")) return "Contact profile";
  if (pathname === "/crm/contacts") return "CRM contacts";
  if (pathname === "/" && entityName) return `${entityName} overview`;
  const match = navigation.find((item) => item.href === pathname);
  return match?.label ?? "Dashboard";
}

function BrandLockup() {
  return (
    <Link href="/" className="flex flex-col leading-none" aria-label="District 12 home">
      <span className="text-[9px] font-bold tracking-[0.38em] text-[#d6d6d6]">THE</span>
      <span className="mt-1 bg-primary px-1.5 py-[3px] text-[17px] font-black tracking-tight text-white">
        DISTRICT 12
      </span>
      <span className="mt-1 text-[8px] font-semibold tracking-[0.24em] text-[#cfcfcf]">
        GROUP OF COMPANIES
      </span>
    </Link>
  );
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const { companies } = useSystem();
  const { entityId, setEntityId } = useEntity();

  function openEntity(id: string) {
    setEntityId(id);
    router.push("/");
    onNavigate?.();
  }

  return (
    <div className="flex h-full flex-col bg-[#131313] text-white">
      <div className="flex h-20 items-center justify-between px-5">
        <BrandLockup />
        {onNavigate ? (
          <button
            type="button"
            onClick={onNavigate}
            className="rounded-md p-1.5 text-[#d6d6d6] hover:bg-white/10 hover:text-white md:hidden"
            aria-label="Close menu"
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>

      <nav
        className="scrollbar-thin flex-1 space-y-1 overflow-y-auto px-3 py-4"
        aria-label="Main"
      >
        <p className="px-2 pb-2 text-[10px] font-bold uppercase tracking-widest text-[#a3a3a3]">
          Core modules
        </p>
        {navigation.map((item) => {
          const active =
            item.href === "/"
              ? pathname === "/"
              : pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-[13px] font-medium transition-colors",
                active
                  ? "bg-primary text-white shadow-sm"
                  : "text-[#e8e8e8] hover:bg-white/10 hover:text-white"
              )}
              aria-current={active ? "page" : undefined}
            >
              <item.icon className="h-4 w-4 shrink-0" strokeWidth={2} />
              {item.label}
            </Link>
          );
        })}

        <p className="px-2 pb-2 pt-4 text-[10px] font-bold uppercase tracking-widest text-[#a3a3a3]">
          Subsidiaries
        </p>
        <button
          type="button"
          onClick={() => openEntity("group")}
          className={cn(
            "flex w-full items-center gap-2.5 rounded-md px-3 py-1.5 text-left text-xs font-medium transition-colors",
            entityId === "group"
              ? "bg-white/10 text-white"
              : "text-[#d6d6d6] hover:bg-white/10 hover:text-white"
          )}
        >
          <span className="grid h-5 w-5 shrink-0 place-items-center rounded bg-white/15 text-[9px] font-bold">
            D12
          </span>
          <span className="truncate">Group (all entities)</span>
        </button>
        {companies.map((company) => (
          <button
            key={company.id}
            type="button"
            onClick={() => openEntity(company.id)}
            className={cn(
              "flex w-full items-center gap-2.5 rounded-md px-3 py-1.5 text-left text-xs font-medium transition-colors",
              entityId === company.id
                ? "bg-white/10 text-white"
                : "text-[#d6d6d6] hover:bg-white/10 hover:text-white"
            )}
            aria-current={entityId === company.id ? "true" : undefined}
          >
            <span
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ backgroundColor: company.color }}
            />
            <span className="truncate">{company.name}</span>
          </button>
        ))}
      </nav>

      <div className="border-t border-white/10 px-4 py-4">
        <div className="flex items-center gap-3">
          <span className="grid h-9 w-9 place-items-center rounded-full bg-primary text-xs font-bold text-white">
            MS
          </span>
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold text-white">Marvin Ssempebwa</p>
            <p className="truncate text-[11px] text-[#bdbdbd]">Group administrator</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { companies } = useSystem();
  const { entityId, entity, setEntityId } = useEntity();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  return (
    <div className="min-h-screen bg-background">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[236px] md:block">
        <SidebarContent />
      </aside>

      {mobileOpen ? (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/60"
            aria-label="Close menu"
            onClick={() => setMobileOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 z-10 w-[260px] border-r border-white/10 shadow-2xl">
            <SidebarContent onNavigate={() => setMobileOpen(false)} />
          </div>
        </div>
      ) : null}

      <div className="md:pl-[236px]">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b border-border bg-card px-4 md:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="rounded-md border border-border p-1.5 text-foreground md:hidden"
              aria-label="Open menu"
            >
              <Menu className="h-4 w-4" />
            </button>
            <div className="min-w-0">
              <p className="truncate text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                {entity ? entity.name : "District 12 Group"}
              </p>
              <h1 className="truncate text-sm font-bold leading-tight text-foreground">
                {pageTitle(pathname, entity?.shortName)}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Select
              aria-label="Select entity"
              value={entityId}
              onChange={(event) => {
                setEntityId(event.target.value);
                router.push("/");
              }}
              className="w-[7.5rem] text-xs sm:w-44"
            >
              <option value="group">All entities</option>
              {companies.map((company) => (
                <option key={company.id} value={company.id}>
                  {company.shortName}
                </option>
              ))}
            </Select>
            <span className="hidden rounded-md border border-border bg-background px-2.5 py-1 text-xs font-medium text-muted-foreground lg:inline">
              {formatDate(TODAY)}
            </span>
            <Link
              href="/finance"
              className="hidden h-9 items-center gap-1.5 rounded-md bg-primary px-3 text-xs font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 sm:inline-flex"
            >
              <Plus className="h-3.5 w-3.5" />
              Record entry
            </Link>
            <button
              type="button"
              onClick={() =>
                toast("3 notifications", {
                  description: "2 invoices pending approval · 1 project at risk",
                })
              }
              className="relative rounded-md border border-border p-2 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              aria-label="Notifications"
            >
              <Bell className="h-4 w-4" />
              <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-primary" />
            </button>
            <span className="grid h-8 w-8 place-items-center rounded-full bg-[#131313] text-[11px] font-bold text-white">
              MS
            </span>
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1400px] px-4 py-6 md:px-8 md:py-7">
          {children}
        </main>
      </div>
    </div>
  );
}
