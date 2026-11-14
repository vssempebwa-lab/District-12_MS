"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Eye, FileText } from "lucide-react";
import {
  REPORT_AUDIENCE_LABELS,
  REPORT_KIND_LABELS,
  TENANTS,
  reportMetricMeta,
  type TenantReport,
} from "@d12/contracts";
import {
  Badge,
  BrandMark,
  Button,
  EmptyState,
  Panel,
  TableShell,
  Td,
  Th,
  rowClass,
} from "@d12/ui";
import { ReportDetailModal } from "@d12/tenant-workspace";
import { relativeTime } from "@/lib/format";

function money(value: number): string {
  return new Intl.NumberFormat("en-UG", { style: "currency", currency: "UGX", maximumFractionDigits: 0 }).format(value);
}

function metricText(key: string, value: number): string {
  const meta = reportMetricMeta(key);
  return `${meta.label}: ${meta.money ? money(value) : value}`;
}

export function ReportInbox({ reports }: { reports: TenantReport[] }) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [openReport, setOpenReport] = useState<TenantReport | null>(null);
  const [error, setError] = useState("");

  async function acknowledge(id: string): Promise<void> {
    setPendingId(id);
    setError("");
    try {
      const response = await fetch(`/api/hub/reports/${id}`, { method: "POST" });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error?.message ?? "Could not acknowledge the report.");
      }
      setOpenReport(null);
      router.refresh();
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : "Could not acknowledge the report.");
    } finally {
      setPendingId(null);
    }
  }

  return (
    <>
    <Panel
      title="Report ledger"
      subtitle="Every report routed to your desk, newest first."
      bodyClassName="p-0"
      action={error ? <span className="text-xs font-medium text-red-600">{error}</span> : null}
    >
      {reports.length ? (
        <TableShell className="rounded-none border-0">
          <thead>
            <tr>
              <Th>Report</Th>
              <Th>Subsidiary</Th>
              <Th>Desk</Th>
              <Th>Period</Th>
              <Th>Status</Th>
              <Th className="text-right">Submitted</Th>
              <Th>Action</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {reports.map((report) => {
              const tenant = TENANTS[report.tenantId];
              const metrics = Object.entries(report.metrics).slice(0, 3);
              return (
                <tr key={report.id} className={rowClass}>
                  <Td>
                    <p className="text-sm font-medium text-ink">{report.title}</p>
                    <p className="text-[11px] text-ink-mute">
                      {report.authorName} · {REPORT_KIND_LABELS[report.kind]}
                    </p>
                    {metrics.length ? (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {metrics.map(([key, value]) => (
                          <span key={key} className="rounded bg-canvas px-1.5 py-0.5 text-[10px] text-ink-soft">
                            {metricText(key, value)}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </Td>
                  <Td>
                    <div className="flex items-center gap-2">
                      <BrandMark
                        mark={tenant.mark}
                        color={tenant.color}
                        logo={tenant.logo}
                        alt={`${tenant.shortName} logo`}
                        size="sm"
                      />
                      <span className="text-xs text-ink-soft">{tenant.shortName}</span>
                    </div>
                  </Td>
                  <Td className="text-xs text-ink-soft">{REPORT_AUDIENCE_LABELS[report.audience]}</Td>
                  <Td className="whitespace-nowrap text-xs text-ink-soft">
                    {report.periodStart} — {report.periodEnd}
                  </Td>
                  <Td>
                    <Badge tone={report.status === "acknowledged" ? "success" : "warning"}>
                      {report.status === "acknowledged" ? "Acknowledged" : "Awaiting review"}
                    </Badge>
                    {report.acknowledgedBy ? (
                      <p className="mt-0.5 text-[10px] text-ink-mute">by {report.acknowledgedBy}</p>
                    ) : null}
                  </Td>
                  <Td className="whitespace-nowrap text-right text-xs text-ink-mute">{relativeTime(report.createdAt)}</Td>
                  <Td>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Button type="button" size="sm" variant="ghost" onClick={() => setOpenReport(report)}>
                        <Eye className="h-3.5 w-3.5" />
                        View
                      </Button>
                      {report.status === "submitted" ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          disabled={pendingId === report.id}
                          onClick={() => acknowledge(report.id)}
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          {pendingId === report.id ? "Saving" : "Acknowledge"}
                        </Button>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700">
                          <FileText className="h-3.5 w-3.5" /> Filed
                        </span>
                      )}
                    </div>
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </TableShell>
      ) : (
        <EmptyState
          title="No reports yet"
          description="Subsidiary desks will appear here as soon as they file their first report."
        />
      )}
    </Panel>

    <ReportDetailModal
      report={openReport}
      tenantName={openReport ? TENANTS[openReport.tenantId].shortName : undefined}
      onClose={() => setOpenReport(null)}
      footer={
        openReport && openReport.status === "submitted" ? (
          <Button
            type="button"
            variant="secondary"
            disabled={pendingId === openReport.id}
            onClick={() => acknowledge(openReport.id)}
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            {pendingId === openReport.id ? "Saving" : "Acknowledge report"}
          </Button>
        ) : (
          <Button type="button" variant="ghost" onClick={() => setOpenReport(null)}>
            Close
          </Button>
        )
      }
    />
    </>
  );
}
