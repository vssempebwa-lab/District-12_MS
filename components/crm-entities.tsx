import { cn } from "@/lib/utils";
import { stageMeta, type Contact, type DealStage } from "@/lib/crm-data";

const typeStyles: Record<Contact["type"], string> = {
  customer: "bg-emerald-50 text-emerald-700 border-emerald-200",
  prospect: "bg-blue-50 text-blue-700 border-blue-200",
  partner: "bg-violet-50 text-violet-700 border-violet-200",
};

export function ContactTypeBadge({ type }: { type: Contact["type"] }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold capitalize",
        typeStyles[type]
      )}
    >
      {type}
    </span>
  );
}

export function ContactStatusBadge({ status }: { status: Contact["status"] }) {
  return status === "active" ? (
    <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
      Active
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full border border-neutral-300 bg-neutral-100 px-2 py-0.5 text-[11px] font-semibold text-neutral-600">
      <span className="h-1.5 w-1.5 rounded-full bg-neutral-500" />
      Dormant
    </span>
  );
}

export function DealStageBadge({ stage }: { stage: DealStage }) {
  const meta = stageMeta(stage);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold",
        meta.soft,
        meta.text
      )}
    >
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{ backgroundColor: meta.color }}
      />
      {meta.label}
    </span>
  );
}
