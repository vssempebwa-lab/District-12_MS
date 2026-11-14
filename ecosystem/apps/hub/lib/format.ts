const compact = new Intl.NumberFormat("en-UG", {
  notation: "compact",
  maximumFractionDigits: 1,
});

export function formatUgx(value: number): string {
  return `UGX ${compact.format(value)}`;
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-UG").format(value);
}

export function relativeTime(value: string | null, now = Date.now()): string {
  if (!value) return "No events yet";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "No events yet";
  const seconds = Math.max(0, Math.round((now - date.getTime()) / 1000));
  if (seconds < 45) return "Just now";
  if (seconds < 3600) return `${Math.round(seconds / 60)}m ago`;
  if (seconds < 86_400) return `${Math.round(seconds / 3600)}h ago`;
  if (seconds < 604_800) return `${Math.round(seconds / 86_400)}d ago`;
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export function relativeTimeLower(value: string | null): string {
  const text = relativeTime(value);
  return text.charAt(0).toLowerCase() + text.slice(1);
}

export function shortDay(value: string): string {
  const date = new Date(`${value}T12:00:00`);
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}
