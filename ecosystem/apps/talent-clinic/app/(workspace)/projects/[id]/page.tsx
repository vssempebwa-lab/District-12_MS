import { notFound } from "next/navigation";
import { hasPermission } from "@d12/auth";
import type { CustomerRecord, ProjectRecord } from "@d12/contracts";
import { PageHeader, Card, TableShell, Th, Td, Badge, Button } from "@d12/ui";
import { listEntity, requireTenantPage } from "@d12/tenant-workspace/server";
import { TENANT, TENANT_ID } from "@/lib/tenant";
import Link from "next/link";
import { formatUgx, shortDate } from "@d12/tenant-workspace";

export const dynamic = "force-dynamic";

export default async function CohortDetailPage({ params }: { params: { id: string } }) {
  const session = await requireTenantPage(TENANT_ID, `/projects/${params.id}`);
  if (!hasPermission(session, "projects.read", TENANT_ID)) notFound();

  const [projectRows, customerRows] = await Promise.all([
    listEntity(TENANT_ID, "projects"),
    listEntity(TENANT_ID, "customers"),
  ]);

  const cohort = (projectRows as ProjectRecord[]).find((row) => row.id === params.id);
  if (!cohort) notFound();

  const participants = (customerRows as CustomerRecord[]).filter(
    (row) => (row.cohort ?? "") === cohort.name,
  );

  const agreedTotal = participants.reduce((sum, p) => sum + Number(p.lifetimeValue ?? 0), 0);
  const paidTotal = participants.reduce((sum, p) => sum + Number(p.paidTotal ?? 0), 0);

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Cohort"
        title={cohort.name}
        description={`${cohort.programSession || "—"} · ${cohort.durationWeeks ?? 6} weeks · starts ${shortDate(cohort.startDate ?? cohort.dueOn)}`}
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="p-3">
          <p className="text-[11px] uppercase tracking-wide text-ink-mute">Participants</p>
          <p className="text-lg font-semibold text-ink">{participants.length}</p>
        </Card>
        <Card className="p-3">
          <p className="text-[11px] uppercase tracking-wide text-ink-mute">Fees agreed</p>
          <p className="text-lg font-semibold text-ink">{formatUgx(agreedTotal)}</p>
        </Card>
        <Card className="p-3">
          <p className="text-[11px] uppercase tracking-wide text-ink-mute">Collected</p>
          <p className="text-lg font-semibold text-emerald-700">{formatUgx(paidTotal)}</p>
        </Card>
      </div>

      <Card className="p-3">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-sm font-semibold text-ink">Registered participants</p>
          <Link href={`/customers?cohort=${encodeURIComponent(cohort.name)}`}>
            <Button size="sm">Register participant</Button>
          </Link>
        </div>
        {participants.length === 0 ? (
          <p className="text-xs text-ink-soft">No participants registered yet.</p>
        ) : (
          <TableShell>
            <thead>
              <tr>
                <Th>Reg. no.</Th>
                <Th>Name</Th>
                <Th>Clinic</Th>
                <Th>Contact</Th>
                <Th>Payment</Th>
                <Th className="text-right">Paid / fee</Th>
              </tr>
            </thead>
            <tbody>
              {participants.map((p) => (
                <tr key={p.id}>
                  <Td>{p.registrationNumber || "—"}</Td>
                  <Td>{p.name}</Td>
                  <Td>
                    <Badge tone="info">{p.clinic || "—"}</Badge>
                  </Td>
                  <Td className="text-xs text-ink-soft">{p.phone || p.email || "—"}</Td>
                  <Td>
                    <Badge tone={p.status === "paid" ? "success" : "warning"}>{p.status}</Badge>
                  </Td>
                  <Td className="text-right">
                    {formatUgx(Number(p.paidTotal ?? 0))} / {formatUgx(Number(p.lifetimeValue ?? 0))}
                  </Td>
                </tr>
              ))}
            </tbody>
          </TableShell>
        )}
      </Card>
    </div>
  );
}