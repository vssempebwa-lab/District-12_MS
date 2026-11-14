const compact = new Intl.NumberFormat("en-UG", {
  notation: "compact",
  maximumFractionDigits: 1,
});

export function formatUgx(value: number | null | undefined): string {
  return `UGX ${compact.format(Number(value ?? 0))}`;
}

export function formatNumber(value: number | null | undefined): string {
  return new Intl.NumberFormat("en-UG").format(Number(value ?? 0));
}

export function shortDate(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value.length <= 10 ? `${value}T12:00:00` : value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export function relativeTime(value: string | null | undefined): string {
  if (!value) return "No activity yet";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "No activity yet";
  const seconds = Math.max(0, Math.round((Date.now() - date.getTime()) / 1000));
  if (seconds < 45) return "Just now";
  if (seconds < 3600) return `${Math.round(seconds / 60)}m ago`;
  if (seconds < 86_400) return `${Math.round(seconds / 3600)}h ago`;
  if (seconds < 604_800) return `${Math.round(seconds / 86_400)}d ago`;
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export function titleCase(value: string): string {
  return value.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}
