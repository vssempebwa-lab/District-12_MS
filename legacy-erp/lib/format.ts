export function formatUGX(
  value: number,
  options: { compact?: boolean; signed?: boolean } = {}
) {
  const { compact = true, signed = false } = options;
  const sign = value < 0 ? "-" : signed ? "+" : "";
  const abs = Math.abs(value);

  if (!compact) {
    return `${sign}UGX ${new Intl.NumberFormat("en-UG").format(Math.round(abs))}`;
  }
  if (abs >= 1e9) return `${sign}UGX ${(abs / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${sign}UGX ${(abs / 1e6).toFixed(abs >= 1e8 ? 0 : 1)}M`;
  if (abs >= 1e3) return `${sign}UGX ${Math.round(abs / 1e3)}K`;
  return `${sign}UGX ${abs}`;
}

export function formatNumber(value: number) {
  return new Intl.NumberFormat("en-UG").format(value);
}

export function formatDate(iso: string) {
  const date = new Date(`${iso}T00:00:00Z`);
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

export function formatPercent(value: number, digits = 1) {
  return `${value.toFixed(digits)}%`;
}

export function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}
