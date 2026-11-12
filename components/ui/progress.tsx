import { cn } from "@/lib/utils";

export function Progress({
  value,
  className,
  barClassName,
  barColor,
}: {
  value: number;
  className?: string;
  barClassName?: string;
  barColor?: string;
}) {
  return (
    <div
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={100}
      className={cn("h-1.5 w-full overflow-hidden rounded-full bg-secondary", className)}
    >
      <div
        className={cn("h-full rounded-full bg-primary transition-all", barClassName)}
        style={{
          width: `${Math.min(100, Math.max(0, value))}%`,
          ...(barColor ? { backgroundColor: barColor } : {}),
        }}
      />
    </div>
  );
}
