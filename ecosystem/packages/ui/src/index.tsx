import type {
  ButtonHTMLAttributes,
  HTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TdHTMLAttributes,
  TextareaHTMLAttributes,
  ThHTMLAttributes,
} from "react";
import { cn } from "./cn";

export { cn };

export type Tone = "neutral" | "success" | "warning" | "danger" | "info" | "brand";
export type Accent = "navy" | "blue" | "green" | "amber" | "violet" | "red";

const badgeTones: Record<Tone, string> = {
  neutral: "bg-slate-100 text-slate-600",
  success: "bg-emerald-50 text-emerald-700",
  warning: "bg-amber-50 text-amber-700",
  danger: "bg-red-50 text-red-700",
  info: "bg-sky-50 text-sky-700",
  brand: "bg-pink-50 text-pink-700",
};

const iconAccents: Record<Accent, string> = {
  navy: "bg-navy text-white",
  blue: "bg-blue-600 text-white",
  green: "bg-emerald-600 text-white",
  amber: "bg-amber-500 text-white",
  violet: "bg-violet-600 text-white",
  red: "bg-red-600 text-white",
};

export function Badge({
  tone = "neutral",
  className,
  children,
}: {
  tone?: Tone;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold",
        badgeTones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Card({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("rounded-xl border border-line bg-white shadow-card", className)} {...props}>
      {children}
    </div>
  );
}

export function Panel({
  title,
  subtitle,
  action,
  children,
  className,
  bodyClassName,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={cn("overflow-hidden rounded-xl border border-line bg-white shadow-card", className)}>
      <header className="flex items-start justify-between gap-3 border-b border-line px-4 py-3">
        <div className="min-w-0">
          <h2 className="truncate text-sm font-semibold text-ink">{title}</h2>
          {subtitle ? <p className="mt-0.5 text-xs text-ink-soft">{subtitle}</p> : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </header>
      <div className={cn("p-4", bodyClassName)}>{children}</div>
    </section>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  className,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between", className)}>
      <div className="min-w-0">
        {eyebrow ? (
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-mute">{eyebrow}</p>
        ) : null}
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-ink">{title}</h1>
        {description ? <p className="mt-1 text-sm text-ink-soft">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
  icon,
  accent = "navy",
  className,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: ReactNode;
  accent?: Accent;
  className?: string;
}) {
  return (
    <Card className={cn("p-4", className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-medium text-ink-soft">{label}</p>
          <p className="mt-1 text-2xl font-semibold leading-none tracking-tight text-ink">{value}</p>
          {hint ? <p className="mt-2 text-[11px] leading-snug text-ink-mute">{hint}</p> : null}
        </div>
        {icon ? (
          <span
            className={cn(
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
              iconAccents[accent],
            )}
          >
            {icon}
          </span>
        ) : null}
      </div>
    </Card>
  );
}

const buttonVariants = {
  primary: "bg-navy text-white hover:bg-navy-700",
  secondary: "border border-line bg-white text-ink hover:bg-canvas",
  ghost: "text-ink-soft hover:bg-slate-100 hover:text-ink",
  danger: "bg-red-600 text-white hover:bg-red-700",
} as const;

const buttonSizes = {
  sm: "h-8 px-3 text-xs",
  md: "h-9 px-4 text-sm",
} as const;

export type ButtonVariant = keyof typeof buttonVariants;

export function buttonStyles(variant: ButtonVariant = "primary", size: keyof typeof buttonSizes = "md"): string {
  return cn(
    "inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-navy/30 disabled:cursor-not-allowed disabled:opacity-50",
    buttonVariants[variant],
    buttonSizes[size],
  );
}

export function Button({
  variant = "primary",
  size = "md",
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: keyof typeof buttonSizes;
}) {
  return (
    <button className={cn(buttonStyles(variant, size), className)} {...props}>
      {children}
    </button>
  );
}

export const inputClass =
  "h-9 w-full rounded-lg border border-line bg-white px-3 text-sm text-ink placeholder:text-ink-mute focus:border-navy focus:outline-none focus:ring-2 focus:ring-navy/10";

export function Field({
  label,
  hint,
  className,
  children,
}: {
  label: string;
  hint?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <label className={cn("block space-y-1", className)}>
      <span className="block text-[11px] font-semibold uppercase tracking-wide text-ink-soft">{label}</span>
      {children}
      {hint ? <span className="block text-[11px] text-ink-mute">{hint}</span> : null}
    </label>
  );
}

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(inputClass, className)} {...props} />;
}

export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cn(inputClass, "pr-8", className)} {...props}>
      {children}
    </select>
  );
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(inputClass, "h-auto min-h-[72px] py-2", className)} {...props} />;
}

export function BrandMark({
  mark,
  color,
  logo,
  alt,
  size = "md",
  className,
}: {
  mark: string;
  color: string;
  logo?: string;
  alt?: string;
  size?: "xs" | "sm" | "md" | "lg";
  className?: string;
}) {
  const sizes = {
    xs: "h-7 w-7 text-[9px]",
    sm: "h-8 w-8 text-[11px]",
    md: "h-10 w-10 text-xs",
    lg: "h-12 w-12 text-sm",
  };
  if (logo) {
    return (
      <span
        className={cn(
          "inline-flex shrink-0 items-center justify-center overflow-hidden rounded-xl border border-line bg-white",
          sizes[size],
          className,
        )}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logo} alt={alt ?? mark} className="h-full w-full object-contain p-0.5" />
      </span>
    );
  }
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-xl font-bold tracking-wide text-white",
        sizes[size],
        className,
      )}
      style={{ backgroundColor: color }}
    >
      {mark}
    </span>
  );
}

export function ProgressBar({
  value,
  color = "#16233B",
  className,
}: {
  value: number;
  color?: string;
  className?: string;
}) {
  const width = Math.max(0, Math.min(100, value));
  return (
    <div className={cn("h-1.5 w-full overflow-hidden rounded-full bg-slate-100", className)}>
      <div className="h-full rounded-full" style={{ width: `${width}%`, backgroundColor: color }} />
    </div>
  );
}

export function MiniBars({
  values,
  color = "#16233B",
  className,
  height = 64,
}: {
  values: number[];
  color?: string;
  className?: string;
  height?: number;
}) {
  const max = Math.max(1, ...values);
  return (
    <div className={cn("flex items-end gap-1.5", className)} style={{ height }}>
      {values.map((value, index) => (
        <div
          key={index}
          className="flex-1 rounded-t-sm"
          style={{
            height: `${Math.max(6, Math.round((value / max) * 100))}%`,
            backgroundColor: color,
            opacity: 0.28 + (0.72 * value) / max,
          }}
        />
      ))}
    </div>
  );
}

export function TableShell({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("overflow-x-auto rounded-xl border border-line bg-white", className)}>
      <table className="w-full min-w-[560px] border-collapse text-left text-sm">{children}</table>
    </div>
  );
}

export function Th({ className, children, ...props }: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={cn(
        "bg-canvas px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-ink-soft",
        className,
      )}
      {...props}
    >
      {children}
    </th>
  );
}

export function Td({ className, children, ...props }: TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td className={cn("px-4 py-3 align-middle text-ink", className)} {...props}>
      {children}
    </td>
  );
}

export const rowClass = "border-t border-line/80 transition-colors hover:bg-canvas/60";

export function EmptyState({
  title,
  description,
  action,
  className,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-2 px-6 py-12 text-center", className)}>
      <p className="text-sm font-semibold text-ink">{title}</p>
      {description ? <p className="max-w-sm text-xs text-ink-soft">{description}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

export function Alert({
  tone = "info",
  children,
  className,
}: {
  tone?: Tone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      role="status"
      className={cn(
        "rounded-lg border px-3 py-2 text-xs",
        tone === "danger" && "border-red-200 bg-red-50 text-red-700",
        tone === "warning" && "border-amber-200 bg-amber-50 text-amber-700",
        tone === "success" && "border-emerald-200 bg-emerald-50 text-emerald-700",
        tone === "info" && "border-sky-200 bg-sky-50 text-sky-700",
        tone === "brand" && "border-pink-200 bg-pink-50 text-pink-700",
        tone === "neutral" && "border-line bg-canvas text-ink-soft",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function Modal({
  open,
  title,
  description,
  onClose,
  children,
  footer,
  size = "md",
}: {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  size?: "md" | "lg";
}) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-navy/40 p-3 sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className={cn(
          "max-h-[90vh] w-full overflow-hidden rounded-2xl border border-line bg-white shadow-pop",
          size === "lg" ? "max-w-2xl" : "max-w-lg",
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-ink">{title}</h2>
            {description ? <p className="mt-0.5 text-xs text-ink-soft">{description}</p> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-7 w-7 items-center justify-center rounded-lg text-lg leading-none text-ink-mute hover:bg-canvas hover:text-ink"
          >
            ×
          </button>
        </div>
        <div className="max-h-[65vh] overflow-y-auto px-5 py-4">{children}</div>
        {footer ? (
          <div className="flex flex-wrap justify-end gap-2 border-t border-line px-5 py-3">{footer}</div>
        ) : null}
      </div>
    </div>
  );
}

export function Avatar({
  name,
  size = "md",
  className,
}: {
  name: string;
  size?: "sm" | "md";
  className?: string;
}) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full bg-slate-200 font-semibold text-slate-700",
        size === "sm" ? "h-7 w-7 text-[10px]" : "h-8 w-8 text-[11px]",
        className,
      )}
    >
      {initials || "?"}
    </span>
  );
}
