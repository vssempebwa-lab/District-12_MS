"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { HubNotification } from "@d12/contracts";
import { Badge, Button, Card, Select } from "@d12/ui";
import { relativeTime } from "@/lib/format";

export function NotificationInbox({ initialNotifications, now, mode }: { initialNotifications: HubNotification[]; now: number; mode: "demo" | "supabase" }) {
  const router = useRouter();
  const [notifications, setNotifications] = useState(initialNotifications);
  const [filter, setFilter] = useState("all");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  useEffect(() => setNotifications(initialNotifications), [initialNotifications]);
  async function update(entry: HubNotification, action: "read" | "unread" | "archive") {
    setBusy(entry.id); setError("");
    try {
      const response = await fetch(`/api/hub/notifications/${entry.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error?.message ?? "Could not update notification");
      setNotifications((items) => items.map((item) => item.id === entry.id ? body.notification : item));
      window.dispatchEvent(new Event("d12:workflow-changed")); router.refresh();
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Could not update notification"); }
    finally { setBusy(null); }
  }
  const shown = notifications.filter((entry) => filter === "archived" ? !!entry.archivedAt : !entry.archivedAt && (filter !== "unread" || !entry.readAt));
  const unread = notifications.filter((entry) => !entry.archivedAt && !entry.readAt).length;
  return <div className="space-y-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-2xl font-semibold text-navy">Notifications</h1><p className="mt-1 text-sm text-ink-soft">Your inbox · {unread} unread · read status is saved for your account.</p></div><Badge tone={mode === "demo" ? "warning" : "success"}>{mode === "demo" ? "Demo · process memory" : "Database live"}</Badge></div>
    <Select aria-label="Notification filter" className="max-w-xs" value={filter} onChange={(event) => setFilter(event.target.value)}><option value="all">Active inbox</option><option value="unread">Unread</option><option value="archived">Archived</option></Select>
    {error ? <p role="alert" className="text-sm text-red-700">{error}</p> : null}
    <Card className="divide-y divide-line">{shown.map((entry) => <article key={entry.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><div className="flex items-center gap-2">{!entry.readAt ? <span className="h-2 w-2 shrink-0 rounded-full bg-royal" /> : null}<Link href={entry.href} className="text-sm font-semibold text-navy hover:underline">{entry.title}</Link></div><p className="mt-1 text-xs text-ink-soft">{relativeTime(entry.createdAt, now)}</p></div><div className="flex shrink-0 flex-wrap gap-2"><Button size="sm" variant="secondary" disabled={busy !== null} onClick={() => update(entry, entry.readAt ? "unread" : "read")}>{entry.readAt ? "Mark unread" : "Mark read"}</Button>{!entry.archivedAt ? <Button size="sm" variant="ghost" disabled={busy !== null} onClick={() => update(entry, "archive")}>Archive</Button> : <Badge>Archived</Badge>}</div></article>)}{!shown.length ? <div className="p-8 text-center"><h2 className="text-sm font-semibold text-navy">No notifications in this view</h2><p className="mt-1 text-xs text-ink-soft">Saved group and HR workflow activity will appear here.</p></div> : null}</Card>
  </div>;
}
