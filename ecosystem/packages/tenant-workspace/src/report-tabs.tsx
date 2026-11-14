"use client";

import { usePathname, useRouter } from "next/navigation";
import { cn } from "@d12/ui";

const WINDOWS = [
  { days: 30, label: "30 days" },
  { days: 90, label: "90 days" },
  { days: 365, label: "12 months" },
];

export function ReportPeriodTabs({ windowDays }: { windowDays: number }) {
  const router = useRouter();
  const pathname = usePathname();

  return (
    <div className="inline-flex items-center rounded-lg border border-line bg-white p-0.5">
      {WINDOWS.map((option) => (
        <button
          key={option.days}
          type="button"
          onClick={() => router.push(`${pathname}?window=${option.days}`)}
          className={cn(
            "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
            option.days === windowDays
              ? "bg-navy text-white"
              : "text-ink-soft hover:bg-canvas hover:text-ink",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
