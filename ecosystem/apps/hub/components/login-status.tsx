"use client";

import { useEffect, useState } from "react";
import { Clock3 } from "lucide-react";

function eastAfricaTime(date: Date | null): string {
  if (!date) return "--:--";
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Africa/Kampala",
  }).format(date);
}

export function LoginStatus() {
  const [progress, setProgress] = useState(0);
  const [ready, setReady] = useState(false);
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    setProgress(24);
    const mid = window.setTimeout(() => setProgress(75), 180);
    const done = window.setTimeout(() => {
      setProgress(100);
      setReady(true);
    }, 1000);
    const tick = window.setInterval(() => setNow(new Date()), 15000);
    return () => {
      window.clearTimeout(mid);
      window.clearTimeout(done);
      window.clearInterval(tick);
    };
  }, []);

  return (
    <div className="flex items-center gap-3 sm:gap-4">
      <div className="hidden sm:block">
        <div className="flex items-center justify-between gap-8 text-[9px] font-semibold uppercase tracking-[0.16em]">
          <span className="flex items-center gap-1.5 text-ink-mute">
            <span
              className={
                ready
                  ? "h-1.5 w-1.5 rounded-full bg-emerald-500"
                  : "h-1.5 w-1.5 animate-pulse rounded-full bg-amber-500"
              }
            />
            {ready ? "System ready" : "Loading system"}
          </span>
          <span className="tabular-nums text-ink-soft">{progress}%</span>
        </div>
        <div className="mt-1.5 h-1 w-44 overflow-hidden rounded-full bg-line">
          <div
            className="h-full rounded-full bg-brand transition-[width] duration-700 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <span className="hidden h-7 w-px bg-line sm:block" />

      <div className="flex items-center gap-1.5 text-xs font-semibold tabular-nums text-ink-soft">
        <Clock3 className="h-3.5 w-3.5 text-ink-mute" />
        {eastAfricaTime(now)}
        <span className="text-[9px] font-semibold uppercase tracking-wider text-ink-mute">EAT</span>
      </div>
    </div>
  );
}
