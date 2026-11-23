import Link from "next/link";
import { Folder, Users, Plus, Settings } from "lucide-react";
import { PageHeader, Card, StatCard, Button } from "@d12/ui";
import { getWorkspaceOverview } from "@d12/tenant-workspace/server";
import { personalWorkName, requireTenantPage } from "@d12/tenant-workspace/server";
import { TENANT, TENANT_ID } from "@/lib/tenant";

export const dynamic = "force-dynamic";

export default async function OverviewPage() {
  const session = await requireTenantPage(TENANT_ID);
  const overview = await getWorkspaceOverview(TENANT_ID);
  const personal = personalWorkName(session) !== null;

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow={TENANT.sector}
        title={`${TENANT.shortName} workspace`}
        description={personal ? `Welcome back, ${session.name.split(/\s+/)[0]}.` : `Welcome back, ${session.name.split(/\s+/)[0]}.`}
      />

      <div className="grid gap-3 sm:grid-cols-2">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-ink">Cohorts</p>
              <p className="text-xs text-ink-soft">{overview.counts.projects} cohorts</p>
            </div>
            <Link href="/projects">
              <Button size="sm">
                <Plus className="h-4 w-4" />
                Create cohort
              </Button>
            </Link>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-ink">Participants</p>
              <p className="text-xs text-ink-soft">{overview.customersActive} registered participants</p>
            </div>
            <Link href="/customers">
              <Button size="sm" variant="secondary">
                <Users className="h-4 w-4" />
                View participants
              </Button>
            </Link>
          </div>
        </Card>
      </div>

      <div className="flex gap-2">
        <Link href="/desk/settings">
          <Button variant="secondary" size="sm">
            <Settings className="h-4 w-4" />
            Settings
          </Button>
        </Link>
      </div>
    </div>
  );
}