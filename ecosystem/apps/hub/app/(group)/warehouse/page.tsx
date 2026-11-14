import { Activity, ArrowUpRight, Database, FileSignature, Layers } from "lucide-react";
import { TENANTS } from "@d12/contracts";
import {
  Alert,
  Badge,
  BrandMark,
  EmptyState,
  PageHeader,
  Panel,
  StatCard,
  TableShell,
  Td,
  Th,
  MiniBars,
  rowClass,
} from "@d12/ui";
import { RowLink } from "@/components/row-link";
import { getWarehouseOverview } from "@/lib/warehouse";
import { requirePermissionPage } from "@/lib/session-server";
import { formatNumber, formatUgx, relativeTime, relativeTimeLower, shortDay } from "@/lib/format";

export const metadata = { title: "Data warehouse — District 12" };
export const dynamic = "force-dynamic";

const HUB_INGEST_URL = "POST /api/ingest/v1/events";

export default async function WarehousePage() {
  await requirePermissionPage("warehouse.read");
  const overview = await getWarehouseOverview();
  const reporting = overview.tenants.filter((tenant) => (tenant.events ?? 0) > 0).length;
  const totalBatches = overview.batches.length;
  const revenue = overview.daily.map((point) => point.revenue);
  const leads = overview.daily.map((point) => point.leads);

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Central data warehouse"
        title="Normalized group reporting"
        description="Every subsidiary streams signed, idempotent batches into one master schema."
        actions={
          <Badge tone={overview.mode === "supabase" ? "success" : "warning"}>
            {overview.mode === "supabase" ? "Supabase live" : "Demo store"}
          </Badge>
        }
      />

      {overview.mode === "demo" ? (
        <Alert tone="info">
          Running on the in-memory demo store. Apply{" "}
          <span className="font-mono">packages/db/sql/001–006</span> and set the service-role key to
          persist batches, facts and the directory in Supabase.
        </Alert>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Stored events"
          value={formatNumber(overview.totalEvents)}
          hint="Deduplicated by event id"
          icon={<Database className="h-4 w-4" />}
        />
        <StatCard
          label="Batches received"
          value={formatNumber(totalBatches)}
          hint={`Last batch ${relativeTimeLower(overview.lastReceivedAt)}`}
          icon={<Layers className="h-4 w-4" />}
          accent="blue"
        />
        <StatCard
          label="Reporting subsidiaries"
          value={`${reporting} / ${overview.tenants.length}`}
          hint="Streaming at least one event"
          icon={<Activity className="h-4 w-4" />}
          accent="green"
        />
        <StatCard
          label="Revenue · 30 days"
          value={formatUgx(overview.tenants.reduce((sum, tenant) => sum + tenant.revenue30d, 0))}
          hint="Recomputed from latest event state"
          icon={<FileSignature className="h-4 w-4" />}
          accent="violet"
        />
      </div>

      <Panel
        title="Normalized facts"
        subtitle="Recomputed per tenant and Kampala business day."
        bodyClassName="p-0"
      >
        <TableShell className="rounded-none border-0">
          <thead>
            <tr>
              <Th>Subsidiary</Th>
              <Th className="text-right">Paid sales 30d</Th>
              <Th className="text-right">Revenue 30d</Th>
              <Th className="text-right">Leads 30d</Th>
              <Th className="text-right">Tasks done 30d</Th>
              <Th className="text-right">Events</Th>
              <Th>Last event</Th>
              <Th>
                <span className="sr-only">Open</span>
              </Th>
            </tr>
          </thead>
          <tbody>
            {overview.tenants.map((tenant) => {
              const meta = TENANTS[tenant.tenantId];
              return (
                <RowLink
                  key={tenant.tenantId}
                  href={`/api/auth/handoff?tenant=${tenant.tenantId}`}
                  className={rowClass}
                >
                  <Td>
                    <div className="flex items-center gap-2.5">
                      <BrandMark
                        mark={meta.mark}
                        color={meta.color}
                        logo={meta.logo}
                        alt={`${meta.shortName} logo`}
                        size="sm"
                      />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-ink">{meta.shortName}</p>
                        <p className="truncate text-[11px] text-ink-mute">{meta.domain}</p>
                      </div>
                    </div>
                  </Td>
                  <Td className="text-right tabular-nums">{formatNumber(tenant.transactions30d)}</Td>
                  <Td className="text-right tabular-nums">{formatUgx(tenant.revenue30d)}</Td>
                  <Td className="text-right tabular-nums">{formatNumber(tenant.leads30d)}</Td>
                  <Td className="text-right tabular-nums">{formatNumber(tenant.tasks30d)}</Td>
                  <Td className="text-right tabular-nums text-ink-soft">
                    {tenant.events === null ? "—" : formatNumber(tenant.events)}
                  </Td>
                  <Td className="whitespace-nowrap text-xs text-ink-soft">
                    {relativeTime(tenant.lastEventAt)}
                  </Td>
                  <Td className="text-right">
                    <a
                      href={`/api/auth/handoff?tenant=${tenant.tenantId}`}
                      aria-label={`Open ${meta.shortName} workspace`}
                      className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-navy hover:bg-canvas"
                    >
                      Open
                      <ArrowUpRight className="h-3.5 w-3.5" />
                    </a>
                  </Td>
                </RowLink>
              );
            })}
          </tbody>
        </TableShell>
      </Panel>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Panel title="14-day ingestion trend" subtitle="Revenue and leads across all tenants.">
          <div className="space-y-4">
            <div>
              <div className="mb-1.5 flex items-center justify-between text-[11px] text-ink-soft">
                <span>Revenue</span>
                <span className="tabular-nums">{formatUgx(revenue.reduce((sum, v) => sum + v, 0))}</span>
              </div>
              <MiniBars values={revenue} color="#16233B" height={48} />
            </div>
            <div>
              <div className="mb-1.5 flex items-center justify-between text-[11px] text-ink-soft">
                <span>Leads created</span>
                <span className="tabular-nums">{formatNumber(leads.reduce((sum, v) => sum + v, 0))}</span>
              </div>
              <MiniBars values={leads} color="#0F766E" height={48} />
            </div>
            <div className="flex justify-between border-t border-line pt-2 text-[10px] text-ink-mute">
              <span>{overview.daily[0] ? shortDay(overview.daily[0].day) : ""}</span>
              <span>
                {overview.daily.length ? shortDay(overview.daily[overview.daily.length - 1].day) : ""}
              </span>
            </div>
          </div>
        </Panel>

        <Panel title="Ingestion contract" subtitle="Shared by every subsidiary outbox.">
          <dl className="space-y-3 text-xs">
            <div>
              <dt className="text-[10px] font-semibold uppercase tracking-wide text-ink-mute">Endpoint</dt>
              <dd className="mt-0.5 rounded-md bg-canvas px-2 py-1.5 font-mono text-[11px] text-ink">
                {HUB_INGEST_URL}
              </dd>
            </div>
            <div>
              <dt className="text-[10px] font-semibold uppercase tracking-wide text-ink-mute">Headers</dt>
              <dd className="mt-1 flex flex-wrap gap-1">
                <Badge tone="neutral">x-d12-tenant</Badge>
                <Badge tone="neutral">x-d12-timestamp</Badge>
                <Badge tone="neutral">x-d12-signature</Badge>
              </dd>
            </div>
            <div>
              <dt className="text-[10px] font-semibold uppercase tracking-wide text-ink-mute">Signature</dt>
              <dd className="mt-0.5 rounded-md bg-canvas px-2 py-1.5 font-mono text-[11px] leading-relaxed text-ink">
                v1=hex(HMAC-SHA256(secret,
                <br />
                `${"{timestamp}"}.${"{tenant}"}.${"{rawBody}"}`))
              </dd>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <dt className="text-[10px] font-semibold uppercase tracking-wide text-ink-mute">Max batch</dt>
                <dd className="mt-0.5 font-mono text-[11px] text-ink">500 events</dd>
              </div>
              <div>
                <dt className="text-[10px] font-semibold uppercase tracking-wide text-ink-mute">Clock skew</dt>
                <dd className="mt-0.5 font-mono text-[11px] text-ink">300 seconds</dd>
              </div>
            </div>
            <p className="border-t border-line pt-2 text-[11px] leading-relaxed text-ink-soft">
              Batches are validated with the shared zod contract, deduplicated on event id and
              normalized into ops records and daily facts. Retries are safe.
            </p>
          </dl>
        </Panel>
      </div>

      <Panel title="Batch history" subtitle="Most recent signed flushes." bodyClassName="p-0">
        {overview.batches.length ? (
          <TableShell className="rounded-none border-0">
            <thead>
              <tr>
                <Th>Batch</Th>
                <Th>Subsidiary</Th>
                <Th className="text-right">Events</Th>
                <Th className="text-right">Accepted</Th>
                <Th className="text-right">Duplicates</Th>
                <Th>Signature</Th>
                <Th>Received</Th>
                <Th>
                  <span className="sr-only">Open</span>
                </Th>
              </tr>
            </thead>
            <tbody>
              {overview.batches.map((batch) => {
                const meta = TENANTS[batch.tenantId];
                return (
                  <RowLink
                    key={batch.id}
                    href={`/api/auth/handoff?tenant=${batch.tenantId}`}
                    className={rowClass}
                  >
                    <Td className="font-mono text-[11px] text-ink-soft">{batch.id}</Td>
                    <Td>
                      <div className="flex items-center gap-2">
                        <BrandMark
                          mark={meta?.mark ?? "?"}
                          color={meta?.color ?? "#94A3B8"}
                          logo={meta?.logo}
                          alt={meta ? `${meta.shortName} logo` : "Subsidiary"}
                          size="sm"
                        />
                        <span className="text-sm">{meta?.shortName ?? batch.tenantId}</span>
                      </div>
                    </Td>
                    <Td className="text-right tabular-nums">{batch.eventCount}</Td>
                    <Td className="text-right tabular-nums">{batch.accepted}</Td>
                    <Td className="text-right tabular-nums text-ink-soft">{batch.duplicates}</Td>
                    <Td>
                      <Badge tone={batch.signatureVerified ? "success" : "danger"}>
                        {batch.signatureVerified ? "verified" : "unverified"}
                      </Badge>
                    </Td>
                    <Td className="whitespace-nowrap text-xs text-ink-soft">
                      {relativeTime(batch.receivedAt)}
                    </Td>
                    <Td className="text-right">
                      <a
                        href={`/api/auth/handoff?tenant=${batch.tenantId}`}
                        aria-label={`Open ${meta?.shortName ?? batch.tenantId} workspace`}
                        className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-navy hover:bg-canvas"
                      >
                        Open
                        <ArrowUpRight className="h-3.5 w-3.5" />
                      </a>
                    </Td>
                  </RowLink>
                );
              })}
            </tbody>
          </TableShell>
        ) : (
          <EmptyState
            title="No batches yet"
            description="Record activity in a subsidiary workspace, then flush the telemetry outbox to see batches land here."
          />
        )}
      </Panel>
    </div>
  );
}
