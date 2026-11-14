"use client";

import { useEffect, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";
import { buttonStyles, cn } from "@d12/ui";

export interface SyncOutcome {
  ok: boolean;
  sent: number;
  accepted: number;
  duplicates: number;
  error?: string;
}

export async function syncTelemetry(): Promise<SyncOutcome> {
  try {
    const response = await fetch("/api/telemetry/flush", { method: "POST" });
    const body = (await response.json().catch(() => null)) as SyncOutcome | null;
    if (!response.ok || !body?.ok) {
      return {
        ok: false,
        sent: body?.sent ?? 0,
        accepted: 0,
        duplicates: 0,
        error: body?.error ?? "The hub did not accept the batch",
      };
    }
    return body;
  } catch {
    return { ok: false, sent: 0, accepted: 0, duplicates: 0, error: "Network error" };
  }
}

type SyncState = "idle" | "syncing" | "done" | "error";

export function SyncButton({
  pending = 0,
  compact = false,
  className,
}: {
  pending?: number;
  compact?: boolean;
  className?: string;
}) {
  const [state, setState] = useState<SyncState>("idle");
  const [detail, setDetail] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  async function run(): Promise<void> {
    if (state === "syncing") return;
    setState("syncing");
    setDetail(null);
    const result = await syncTelemetry();
    if (result.ok) {
      setState("done");
      setDetail(
        result.sent > 0
          ? `${result.accepted} event${result.accepted === 1 ? "" : "s"} sent`
          : "Already up to date",
      );
    } else {
      setState("error");
      setDetail(result.error ?? "Sync failed");
    }
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setState("idle"), 2600);
  }

  const label =
    state === "syncing"
      ? "Syncing"
      : state === "error"
        ? "Retry sync"
        : pending > 0
          ? `Sync ${pending}`
          : "Sync now";

  return (
    <button
      type="button"
      onClick={run}
      disabled={state === "syncing"}
      title={detail ?? "Send queued changes to the group warehouse"}
      className={cn(
        buttonStyles("secondary", compact ? "sm" : "md"),
        state === "error" && "border-red-200 text-red-700",
        className,
      )}
    >
      <RefreshCw className={cn("h-3.5 w-3.5", state === "syncing" && "animate-spin")} />
      {label}
    </button>
  );
}
