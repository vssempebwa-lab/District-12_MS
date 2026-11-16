import { Badge, PageHeader } from "@d12/ui";
import { HrProvisioning } from "@/components/hr-provisioning";
import { listAccounts, listAudit } from "@/lib/accounts";
import { requirePermissionPage } from "@/lib/session-server";

export const metadata = { title: "Employees — District 12 HR" };
export const dynamic = "force-dynamic";

export default async function EmployeesPage({
  searchParams,
}: {
  searchParams: { new?: string; q?: string };
}) {
  const session = await requirePermissionPage("hr.provision");
  const [directory, audit] = await Promise.all([listAccounts(), listAudit(12)]);

  return (
    <div className="space-y-6">
      <PageHeader
        className="[&_h1]:text-navy [&_h1]:font-bold [&_p:first-child]:text-royal"
        eyebrow="Human resources"
        title="Employees"
        description="One directory for the group: create accounts, scope roles and move people between subsidiaries. Each new account also opens an employment profile in Team management."
        actions={
          <Badge tone={directory.mode === "supabase" ? "success" : "warning"}>
            {directory.mode === "supabase" ? "Directory live" : "Directory demo"}
          </Badge>
        }
      />
      <HrProvisioning
        key={`${searchParams.q ?? ""}:${searchParams.new ?? ""}`}
        initialAccounts={directory.accounts}
        initialAudit={audit}
        currentUserId={session.sub}
        initialTimestamp={Date.now()}
        mode={directory.mode}
        openCreate={searchParams.new === "1"}
        initialSearch={searchParams.q ?? ""}
      />
    </div>
  );
}
