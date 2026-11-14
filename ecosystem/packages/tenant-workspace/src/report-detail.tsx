"use client";

import type { ReactNode } from "react";
import {
  REPORT_AUDIENCE_LABELS,
  REPORT_KIND_LABELS,
  REPORT_SECTION_META,
  REPORT_SECTIONS,
  reportMetricMeta,
  sectionLines,
  type TenantReport,
} from "@d12/contracts";
import { Badge, Modal } from "@d12/ui";
import { formatNumber, formatUgx, relativeTime } from "./format";

function fullDate(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value.length <= 10 ? `${value}T12:00:00` : value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function metricValue(key: string, value: number): string {
  return reportMetricMeta(key).money ? formatUgx(value) : formatNumber(value);
}

export function ReportFigures({ report }: { report: TenantReport }) {
  const figures = Object.entries(report.metrics);
  if (!figures.length) {
    return (
      <p className="text-xs text-ink-mute">
        No figures were attached to this report. It carries the written update only.
      </p>
    );
  }
  return (
    <dl className="grid gap-2 sm:grid-cols-2">
      {figures.map(([key, value]) => {
        const meta = reportMetricMeta(key);
        return (
          <div key={key} className="rounded-lg border border-line bg-canvas/60 px-3 py-2">
            <dt className="text-[11px] font-semibold uppercase tracking-wide text-ink-mute">{meta.label}</dt>
            <dd className="mt-0.5 text-sm font-semibold text-ink">{metricValue(key, value)}</dd>
            {meta.hint ? <p className="mt-0.5 text-[11px] leading-snug text-ink-mute">{meta.hint}</p> : null}
          </div>
        );
      })}
    </dl>
  );
}

export function ReportBody({
  report,
  tenantName,
  showAudience = true,
}: {
  report: TenantReport;
  tenantName?: string;
  showAudience?: boolean;
}) {
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge tone="info">{REPORT_KIND_LABELS[report.kind]}</Badge>
        {showAudience ? <Badge tone="neutral">{REPORT_AUDIENCE_LABELS[report.audience]}</Badge> : null}
        <Badge tone={report.status === "acknowledged" ? "success" : "warning"}>
          {report.status === "acknowledged" ? "Acknowledged" : "Awaiting review"}
        </Badge>
      </div>

      <div className="grid gap-x-4 gap-y-1 text-xs sm:grid-cols-2">
        <p className="text-ink-soft">
          <span className="font-medium text-ink">From</span> {report.authorName}
          {report.authorRole ? ` · ${report.authorRole.replace(/_/g, " ")}` : ""}
        </p>
        {tenantName ? (
          <p className="text-ink-soft">
            <span className="font-medium text-ink">Subsidiary</span> {tenantName}
          </p>
        ) : null}
        <p className="text-ink-soft sm:col-span-2">
          <span className="font-medium text-ink">Period</span> {fullDate(report.periodStart)} — {fullDate(report.periodEnd)}
        </p>
      </div>

      <section>
        <h3 className="text-sm font-semibold text-ink">Summary</h3>
        <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-ink-soft">
          {report.summary.trim() || "No summary was written for this report."}
        </p>
      </section>

      {REPORT_SECTIONS.map((section) => {
        const meta = REPORT_SECTION_META[section];
        const lines = sectionLines(report[section]);
        return (
          <section key={section}>
            <h3 className="text-sm font-semibold text-ink">{meta.label}</h3>
            <p className="text-[11px] text-ink-mute">{meta.hint}</p>
            {lines.length ? (
              <ul className="mt-1.5 space-y-1">
                {lines.map((line, index) => (
                  <li key={index} className="flex gap-2 text-sm leading-relaxed text-ink-soft">
                    <span aria-hidden className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-royal" />
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-1 text-xs text-ink-mute">Not captured in this report.</p>
            )}
          </section>
        );
      })}

      <section>
        <h3 className="text-sm font-semibold text-ink">Figures attached</h3>
        <p className="mb-1.5 text-[11px] text-ink-mute">
          Captured from records at the moment this report was filed, so the numbers stay as sent.
        </p>
        <ReportFigures report={report} />
      </section>

      <section className="rounded-lg border border-line bg-canvas/50 px-3 py-2 text-xs text-ink-soft">
        <p>
          <span className="font-medium text-ink">Submitted</span> {relativeTime(report.createdAt)} by {report.authorName}
        </p>
        <p className="mt-0.5">
          {report.status === "acknowledged" && report.acknowledgedAt ? (
            <>
              <span className="font-medium text-ink">Acknowledged</span> {relativeTime(report.acknowledgedAt)}
              {report.acknowledgedBy ? ` by ${report.acknowledgedBy}` : ""}
            </>
          ) : (
            "This report has not been acknowledged yet."
          )}
        </p>
      </section>
    </div>
  );
}

export function ReportDetailModal({
  report,
  tenantName,
  onClose,
  footer,
  showAudience,
}: {
  report: TenantReport | null;
  tenantName?: string;
  onClose: () => void;
  footer?: ReactNode;
  showAudience?: boolean;
}) {
  if (!report) return null;
  return (
    <Modal
      open
      size="lg"
      title={report.title}
      description={`${REPORT_KIND_LABELS[report.kind]} · ${fullDate(report.periodStart)} — ${fullDate(report.periodEnd)}`}
      onClose={onClose}
      footer={footer}
    >
      <ReportBody report={report} tenantName={tenantName} showAudience={showAudience} />
    </Modal>
  );
}
