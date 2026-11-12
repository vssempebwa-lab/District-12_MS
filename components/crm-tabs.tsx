"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { KanbanSquare, Users } from "lucide-react";
import { cn } from "@/lib/utils";

const tabs = [
  { href: "/crm", label: "Pipeline", icon: KanbanSquare },
  { href: "/crm/contacts", label: "Contacts", icon: Users },
];

export function CrmTabs() {
  const pathname = usePathname();

  return (
    <div className="mb-4 inline-flex items-center gap-1 rounded-lg border border-border bg-card p-1 shadow-sm">
      {tabs.map((tab) => {
        const active =
          tab.href === "/crm"
            ? pathname === "/crm"
            : pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors",
              active
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-secondary hover:text-foreground"
            )}
          >
            <tab.icon className="h-3.5 w-3.5" />
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
