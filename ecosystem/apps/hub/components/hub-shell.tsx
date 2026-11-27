"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft, ArrowUpRight, Menu, ShieldCheck, X } from "lucide-react";
import { configuredTenantAppUrl, isTenantId, TENANTS } from "@d12/contracts";
import { Avatar, BrandMark, cn } from "@d12/ui";
import type { SessionClaims } from "@d12/auth";
import { HR_ITEMS, HubNav, HubTopbar, LogoutButton, MAIN_ITEMS, isHrPath } from "./hub-nav";

export function HubShell({
  session,
  roleLabel,
  organizationName = "District 12",
  children,
}: {
  session: SessionClaims;
  roleLabel: string;
  organizationName?: string;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const hr = isHrPath(pathname);
  const tenants = session.tenants.filter(isTenantId);
  const canProvision = session.permissions.includes("*") || session.permissions.includes("hr.provision");
  const isGroupAdmin = session.roles.includes("group_admin");
  const isAccountant = session.roles.includes("group_accountant") && !isGroupAdmin;
  const finance = pathname === "/finance" || isAccountant;
  const dark = isGroupAdmin && !hr;
  const subsidiaryLinks = tenants.map((id) => {
    const tenant = TENANTS[id];
    const href = isAccountant ? `/finance#${id}` : configuredTenantAppUrl(id) ? `/api/auth/handoff?tenant=${id}` : undefined;
    const className = cn("group flex items-center gap-3 rounded-lg px-3 py-2", href ? "transition-colors focus-visible:outline-none focus-visible:ring-2" : "", dark ? "text-slate-200" : "text-ink-soft", href && (dark ? "hover:bg-navy-700 hover:text-white focus-visible:ring-white" : "hover:bg-canvas hover:text-ink focus-visible:ring-navy"));
    const body = (
      <>
        <BrandMark mark={tenant.mark} color={tenant.color} logo={tenant.logo} alt={`${tenant.shortName} logo`} size="xs" className="rounded-lg" />
        <span className="min-w-0 flex-1 truncate text-sm">{tenant.shortName}</span>
        {href ? <ArrowUpRight className="h-3.5 w-3.5 text-slate-400 opacity-0 transition-opacity group-hover:opacity-100" /> : null}
      </>
    );
    return href ? (
      <a key={id} href={href} className={className}>{body}</a>
    ) : (
      <div key={id} className={className}>{body}</div>
    );
  });
  const [drawerOpen, setDrawerOpen] = useState(false);
  useEffect(() => { setDrawerOpen(false); }, [pathname]);
  useEffect(() => {
    if (!drawerOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, [drawerOpen]);
  const sectionItems = hr ? HR_ITEMS : MAIN_ITEMS;
  const activeSection = sectionItems.find((item) => (item.exact ? pathname === item.href : pathname.startsWith(item.href)))?.label;
  const subtitle = hr ? "Human resources" : finance ? "Group finance" : isGroupAdmin ? "Group ecosystem" : "Group reporting";

  return (
    <div className="min-h-screen bg-canvas">
      <aside className={cn("fixed inset-y-0 left-0 z-40 hidden w-64 flex-col lg:flex", dark ? "bg-navy text-white" : "border-r border-line bg-white text-ink")}>
        <div className={cn("flex items-center gap-3 border-b px-6 py-6", dark ? "border-white/10" : "border-line")}>
          <img
            src="/brand/district12-mark.png"
            alt="The District 12 Group of Companies"
            className="h-11 w-11 shrink-0 rounded-xl object-cover ring-1 ring-black/5"
          />
          <div className="min-w-0">
            <p className="truncate text-lg font-semibold tracking-tight" title={organizationName}>{organizationName}</p>
            <p className="mt-0.5 truncate text-[11px] text-slate-400">{subtitle}</p>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-5">
          <p className="mb-3 px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">{hr ? "Dashboard" : finance ? "Finance" : isGroupAdmin ? "Main" : "Group reporting"}</p>
          <HubNav permissions={session.permissions} isGroupAdmin={isGroupAdmin} dark={dark} />
          {!hr ? (
            <div className={cn("mt-6 border-t pt-5", dark ? "border-white/10" : "border-line")}>
              <p className="mb-3 px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">Subsidiaries</p>
              <nav aria-label="Subsidiaries" className="space-y-1">{subsidiaryLinks}</nav>
            </div>
          ) : null}
        </div>
        <div className={cn("border-t px-4 py-4", dark ? "border-white/10" : "border-line")}>
          {hr && isGroupAdmin ? (
            <Link href="/dashboard" className="mb-2 flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-ink-soft hover:bg-canvas hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy">
              <ArrowLeft className="h-4 w-4" />Group overview
            </Link>
          ) : null}
          {!dark ? (
            <div className="mb-3 flex items-center gap-2.5 px-3">
              <Avatar name={session.name} />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-ink">{session.name}</p>
                <p className="text-[11px] text-ink-soft">{roleLabel}</p>
              </div>
            </div>
          ) : null}
          <p className={cn("mb-3 flex items-center gap-2 px-3 text-[11px] font-medium", dark ? "text-emerald-300" : "text-emerald-700")}>
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            <ShieldCheck className="h-3.5 w-3.5" />SSO active
          </p>
          <LogoutButton dark={dark} />
        </div>
      </aside>

      <div className="lg:pl-64">
        <div className={cn("sticky top-0 z-30 border-b lg:hidden", dark ? "border-white/10 bg-navy text-white" : "border-line bg-white text-ink")}>
          <div className="flex h-14 items-center gap-2 px-2">
            <button
              type="button"
              aria-label="Open navigation"
              aria-expanded={drawerOpen}
              aria-controls="hub-drawer"
              onClick={() => setDrawerOpen(true)}
              className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-lg focus-visible:outline-none focus-visible:ring-2", dark ? "hover:bg-navy-700 focus-visible:ring-white" : "hover:bg-canvas focus-visible:ring-navy")}
            >
              <Menu className="h-5 w-5" />
            </button>
            <img
              src="/brand/district12-mark.png"
              alt=""
              className="h-8 w-8 shrink-0 rounded-lg object-cover ring-1 ring-black/5"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold leading-tight" title={organizationName}>{activeSection ?? organizationName}</p>
              <p className={cn("truncate text-[11px] leading-tight", dark ? "text-slate-400" : "text-ink-soft")}>{activeSection ? `${organizationName} · ${subtitle}` : subtitle}</p>
            </div>
            {hr && isGroupAdmin ? (
              <Link href="/dashboard" aria-label="Group overview" className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-lg focus-visible:outline-none focus-visible:ring-2", dark ? "hover:bg-navy-700 focus-visible:ring-white" : "text-ink-soft hover:bg-canvas focus-visible:ring-navy")}><ArrowLeft className="h-5 w-5" /></Link>
            ) : null}
          </div>
        </div>

        {drawerOpen ? (
          <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation" onKeyDown={(event) => { if (event.key === "Escape") setDrawerOpen(false); }}>
            <button type="button" aria-label="Close navigation" tabIndex={-1} onClick={() => setDrawerOpen(false)} className="absolute inset-0 bg-slate-900/50 animate-in fade-in" />
            <aside id="hub-drawer" className={cn("absolute inset-y-0 left-0 flex w-[86%] max-w-xs flex-col shadow-pop animate-in slide-in-from-left duration-200", dark ? "bg-navy text-white" : "bg-white text-ink")}>
              <div className={cn("flex items-center gap-3 border-b px-4 py-4", dark ? "border-white/10" : "border-line")}>
                <img src="/brand/district12-mark.png" alt="The District 12 Group of Companies" className="h-10 w-10 shrink-0 rounded-xl object-cover ring-1 ring-black/5" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-base font-semibold tracking-tight">{organizationName}</p>
                  <p className="truncate text-[11px] text-slate-400">{subtitle}</p>
                </div>
                <button type="button" autoFocus aria-label="Close navigation" onClick={() => setDrawerOpen(false)} className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-lg focus-visible:outline-none focus-visible:ring-2", dark ? "hover:bg-navy-700 focus-visible:ring-white" : "text-ink-soft hover:bg-canvas focus-visible:ring-navy")}>
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-4">
                <HubNav permissions={session.permissions} isGroupAdmin={isGroupAdmin} dark={dark} />
                {!hr ? (
                  <div className={cn("mt-5 border-t pt-4", dark ? "border-white/10" : "border-line")}>
                    <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">Subsidiaries</p>
                    <nav aria-label="Mobile subsidiaries" className="space-y-1">{subsidiaryLinks}</nav>
                  </div>
                ) : null}
              </div>
              <div className={cn("border-t px-4 py-3", dark ? "border-white/10" : "border-line")}>
                <div className="mb-2 flex items-center gap-2.5 px-1">
                  <Avatar name={session.name} className="h-9 w-9 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className={cn("truncate text-sm font-medium", dark ? "text-white" : "text-ink")}>{session.name}</p>
                    <p className={cn("truncate text-[11px]", dark ? "text-slate-400" : "text-ink-soft")}>{roleLabel}</p>
                  </div>
                  <span className={cn("flex shrink-0 items-center gap-1 text-[11px] font-medium", dark ? "text-emerald-300" : "text-emerald-700")}><ShieldCheck className="h-3.5 w-3.5" />SSO</span>
                </div>
                <LogoutButton dark={dark} />
              </div>
            </aside>
          </div>
        ) : null}

        <header className={cn("border-b border-line bg-white lg:sticky lg:top-0 lg:z-30", !dark && "hidden lg:block")}>
          <div className="px-4 py-4 sm:px-6 lg:px-8">
            {dark ? (
              <HubTopbar name={session.name} roleLabel={roleLabel} canProvision={canProvision} tenants={tenants} />
            ) : (
              <div className="flex min-w-0 items-center justify-between gap-3">
                <p className="text-sm font-semibold text-navy">{hr ? "Human resources" : finance ? "Group finance" : "Group reporting"}</p>
                <div className="flex min-w-0 items-center gap-2.5">
                  <Avatar name={session.name} className="h-9 w-9 shrink-0" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink">{session.name}</p>
                    <p className="text-[11px] text-ink-soft">{roleLabel}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </header>
        <main className="mx-auto w-full max-w-[1440px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</main>
      </div>
    </div>
  );
}
