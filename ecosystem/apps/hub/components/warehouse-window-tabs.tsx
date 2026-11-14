"use client";

import { usePathname, useRouter } from "next/navigation";
import { cn } from "@d12/ui";

const WINDOWS = [
  { days: 14, label: "14d" },
  { days: 30, label: "30d" },
  { days: 90, label: "90d" },
];

export function WarehouseWindowTabs({ windowDays }: { windowDays: number }) {
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
            "rounded-md px-2 py-0.5 text-[11px] font-medium transition-colors",
            option.days === windowDays
              ? "bg-royal text-white"
              : "text-ink-soft hover:bg-canvas hover:text-ink",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
