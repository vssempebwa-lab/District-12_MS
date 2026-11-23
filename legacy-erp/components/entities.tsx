import { cn } from "@/lib/utils";
import type {
  Company,
  InvoiceStatus,
  ProjectStatus,
  StaffMember,
  Transaction,
} from "@/lib/data";
import { Badge } from "@/components/ui/badge";

export function CompanyMark({
  company,
  size = "md",
}: {
  company: Company;
  size?: "sm" | "md" | "lg";
}) {
  return (
    <span
      className={cn(
        "grid shrink-0 place-items-center rounded-md font-black text-white",
        size === "sm" && "h-7 w-7 text-[11px]",
        size === "md" && "h-9 w-9 text-sm",
        size === "lg" && "h-12 w-12 text-lg"
      )}
      style={{ backgroundColor: company.color }}
      aria-hidden
    >
      {company.mark}
    </span>
  );
}

export function CompanyStatusBadge({ status }: { status: Company["status"] }) {
  return status === "active" ? (
    <Badge variant="success">Active</Badge>
  ) : (
    <Badge variant="warning">Under review</Badge>
  );
}

export function StaffStatusBadge({ status }: { status: StaffMember["status"] }) {
  if (status === "active") return <Badge variant="success">Active</Badge>;
  if (status === "on-leave") return <Badge variant="warning">On leave</Badge>;
  return <Badge variant="outline">Contract</Badge>;
}

export function ProjectStatusBadge({ status }: { status: ProjectStatus }) {
  if (status === "active") return <Badge variant="brand">Active</Badge>;
  if (status === "on-hold") return <Badge variant="warning">On hold</Badge>;
  return <Badge variant="success">Completed</Badge>;
}

export function TransactionStatusBadge({ status }: { status: Transaction["status"] }) {
  return status === "cleared" ? (
    <Badge variant="outline">Cleared</Badge>
  ) : (
    <Badge variant="warning">Pending</Badge>
  );
}

export function InvoiceStatusBadge({ status }: { status: InvoiceStatus }) {
  if (status === "paid") return <Badge variant="success">Paid</Badge>;
  if (status === "overdue") return <Badge variant="danger">Overdue</Badge>;
  return <Badge variant="warning">Pending</Badge>;
}
