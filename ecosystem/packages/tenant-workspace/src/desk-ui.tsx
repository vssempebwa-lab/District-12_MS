"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  BarChart3,
  BellRing,
  CheckCircle2,
  Clock3,
  FileText,
  Eye,
  Palette,
  Send,
  ShieldCheck,
  UserRound,
  UsersRound,
} from "lucide-react";
import {
  REPORTING_CHAIN,
  REPORT_AUDIENCE_LABELS,
  REPORT_KIND_LABELS,
  REPORT_KIND_METRICS,
  REPORT_SECTION_META,
  REPORT_SECTIONS,
  reportMetricMeta,
  type ReportAudience,
  type ReportKind,
  type TenantReport,
} from "@d12/contracts";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  PageHeader,
  Panel,
  Select,
  StatCard,
  TableShell,
  Td,
  Textarea,
  Th,
  rowClass,
} from "@d12/ui";
import { formatUgx, relativeTime, shortDate } from "./format";
import { ReportDetailModal } from "./report-detail";
import { ACCENTS, type TeamMember, type TenantShift, type WorkspaceProfile } from "./desk-types";

function metricLabel(key: string): string {
  return reportMetricMeta(key).label;
}

function metricValue(key: string, value: number): string {
  return reportMetricMeta(key).money ? formatUgx(value) : String(value);
}

function clock(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Kampala",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(iso));
}

function duration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours}h ${rest}m` : `${hours}h`;
}

function Notice({ notice }: { notice: { tone: "ok" | "error"; text: string } | null }) {
  if (!notice) return null;
  return (
    <p
      role="status"
      className={notice.tone === "ok" ? "text-xs font-medium text-emerald-700" : "text-xs font-medium text-red-600"}
    >
      {notice.text}
    </p>
  );
}

export interface ReportDeskViewer {
  id: string;
  name: string;
  roleLabel: string;
  audience: ReportAudience;
  receivable: ReportAudience[];
  canSubmit: boolean;
  canAcknowledge: boolean;
}

export function ReportDesk({
  tenantName,
  viewer,
  reports,
  kinds,
  defaults,
}: {
  tenantName: string;
  viewer: ReportDeskViewer;
  reports: TenantReport[];
  kinds: ReportKind[];
  defaults: { periodStart: string; periodEnd: string };
}) {
  const router = useRouter();
  const [kind, setKind] = useState<ReportKind>(kinds[0] ?? "general");
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [periodStart, setPeriodStart] = useState(defaults.periodStart);
  const [periodEnd, setPeriodEnd] = useState(defaults.periodEnd);
  const [highlights, setHighlights] = useState("");
  const [risks, setRisks] = useState("");
  const [nextSteps, setNextSteps] = useState("");
  const [pending, setPending] = useState(false);
  const [ackId, setAckId] = useState<string | null>(null);
  const [openReport, setOpenReport] = useState<TenantReport | null>(null);
  const [notice, setNotice] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  const sent = reports.filter((report) => report.authorId === viewer.id);
  const received = reports.filter(
    (report) => report.authorId !== viewer.id && viewer.receivable.includes(report.audience),
  );
  const acknowledged = sent.filter((report) => report.status === "acknowledged").length;

  async function submit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setPending(true);
    setNotice(null);
    try {
      const response = await fetch("/api/desk/reports", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ kind, title, summary, periodStart, periodEnd, highlights, risks, nextSteps }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(body?.error?.message ?? "Could not submit the report.");
      setTitle("");
      setSummary("");
      setHighlights("");
      setRisks("");
      setNextSteps("");
      setNotice({ tone: "ok", text: `Report sent to the ${REPORT_AUDIENCE_LABELS[viewer.audience].toLowerCase()}.` });
      router.refresh();
    } catch (error) {
      setNotice({ tone: "error", text: error instanceof Error ? error.message : "Could not submit the report." });
    } finally {
      setPending(false);
    }
  }

  async function acknowledge(id: string): Promise<void> {
    setAckId(id);
    setNotice(null);
    try {
      const response = await fetch("/api/desk/reports-ack", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(body?.error?.message ?? "Could not acknowledge the report.");
      setNotice({ tone: "ok", text: "Report acknowledged." });
      setOpenReport(null);
      router.refresh();
    } catch (error) {
      setNotice({ tone: "error", text: error instanceof Error ? error.message : "Could not acknowledge." });
    } finally {
      setAckId(null);
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Reporting line"
        title="Reports"
        description={viewer.canSubmit
          ? `Send work reports from ${tenantName} up the chain. Your desk reports to the ${REPORT_AUDIENCE_LABELS[viewer.audience].toLowerCase()}.`
          : `Reports raised by the ${tenantName} team, routed up the reporting chain.`}
        actions={<Badge tone="info">{viewer.roleLabel}</Badge>}
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Sent" value={sent.length} hint="Reports you submitted" icon={<Send className="h-4 w-4" />} />
        <StatCard
          label="Acknowledged"
          value={acknowledged}
          hint="Received and confirmed above you"
          icon={<CheckCircle2 className="h-4 w-4" />}
          accent="green"
        />
        <StatCard
          label="Addressed to you"
          value={received.filter((report) => report.status === "submitted").length}
          hint="Awaiting your acknowledgement"
          icon={<FileText className="h-4 w-4" />}
          accent="amber"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
        {viewer.canSubmit ? (
          <Panel title="New report" subtitle="Numbers are captured from this subsidiary's records at submission.">
            <form className="space-y-3" onSubmit={submit}>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Report type">
                  <Select value={kind} onChange={(event) => setKind(event.target.value as ReportKind)}>
                    {kinds.map((entry) => (
                      <option key={entry} value={entry}>
                        {REPORT_KIND_LABELS[entry]}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Title" hint="What is this report about?">
                  <Input
                    required
                    minLength={3}
                    maxLength={160}
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    placeholder="e.g. October sales and collections"
                  />
                </Field>
                <Field label="Period start">
                  <Input type="date" required value={periodStart} onChange={(event) => setPeriodStart(event.target.value)} />
                </Field>
                <Field label="Period end">
                  <Input type="date" required value={periodEnd} onChange={(event) => setPeriodEnd(event.target.value)} />
                </Field>
              </div>
              <Field label="Summary" hint="One short paragraph setting the scene for the recipient.">
                <Textarea
                  maxLength={2000}
                  value={summary}
                  onChange={(event) => setSummary(event.target.value)}
                  placeholder="What happened in this period, in two or three sentences."
                />
              </Field>

              <div className="space-y-3 rounded-xl border border-line bg-canvas/40 p-3">
                <div>
                  <p className="text-xs font-semibold text-ink">Report sections</p>
                  <p className="text-[11px] text-ink-mute">
                    Write one point per line. Each line is shown to the recipient as a separate bullet.
                  </p>
                </div>
                <Field label={REPORT_SECTION_META.highlights.label} hint={REPORT_SECTION_META.highlights.hint}>
                  <Textarea
                    maxLength={1200}
                    value={highlights}
                    onChange={(event) => setHighlights(event.target.value)}
                    placeholder={"Closed the Kira order\nCollected UGX 12M in arrears"}
                  />
                </Field>
                <Field label={REPORT_SECTION_META.risks.label} hint={REPORT_SECTION_META.risks.hint}>
                  <Textarea
                    maxLength={1200}
                    value={risks}
                    onChange={(event) => setRisks(event.target.value)}
                    placeholder={"Two invoices slipped past 60 days\nStock for the Ntinda run arrives late"}
                  />
                </Field>
                <Field label={REPORT_SECTION_META.nextSteps.label} hint={REPORT_SECTION_META.nextSteps.hint}>
                  <Textarea
                    maxLength={1200}
                    value={nextSteps}
                    onChange={(event) => setNextSteps(event.target.value)}
                    placeholder={"Finance to follow up on the two overdue invoices by Friday\nManager to confirm the November delivery schedule"}
                  />
                </Field>
              </div>

              <div className="rounded-xl border border-dashed border-line px-3 py-2">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-mute">
                  Figures attached automatically
                </p>
                <ul className="mt-1 space-y-1">
                  {REPORT_KIND_METRICS[kind].map((key) => {
                    const meta = reportMetricMeta(key);
                    return (
                      <li key={key} className="text-[11px] leading-snug text-ink-soft">
                        <span className="font-medium text-ink">{meta.label}</span>
                        {meta.hint ? ` — ${meta.hint}` : ""}
                      </li>
                    );
                  })}
                </ul>
                <p className="mt-1 text-[11px] text-ink-mute">
                  Values are read from {tenantName} records when you send, and fixed at that moment.
                </p>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2">
                <Notice notice={notice} />
                <Button type="submit" disabled={pending}>
                  <Send className="h-4 w-4" />
                  {pending ? "Sending" : `Send to ${REPORT_AUDIENCE_LABELS[viewer.audience]}`}
                </Button>
              </div>
            </form>
          </Panel>
        ) : (
          <Panel title="Reporting line" subtitle="Your role receives reports rather than submitting them.">
            <EmptyState title="No reports to file" description="This desk reviews reports raised by the team." />
          </Panel>
        )}

        <div className="space-y-4">
          <Panel title="The chain" subtitle="Every subsidiary desk reports upward to the group.">
            <ol className="space-y-2.5">
              {REPORTING_CHAIN.map((step, index) => {
                const active = step.audience === viewer.audience;
                return (
                  <li key={step.audience} className="flex gap-3">
                    <span
                      className={
                        active
                          ? "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-navy text-[11px] font-bold text-white"
                          : "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-line text-[11px] font-semibold text-ink-soft"
                      }
                    >
                      {index + 1}
                    </span>
                    <div className="min-w-0">
                      <p className={active ? "text-sm font-semibold text-ink" : "text-sm font-medium text-ink-soft"}>
                        {REPORT_AUDIENCE_LABELS[step.audience]}
                        {active ? <span className="ml-2 text-[10px] font-semibold uppercase tracking-wide text-royal">You report here</span> : null}
                      </p>
                      <p className="text-[11px] text-ink-mute">{step.detail}</p>
                    </div>
                  </li>
                );
              })}
            </ol>
          </Panel>

          <Panel
            title="Addressed to you"
            subtitle={viewer.receivable.length ? "Reports waiting for your review." : "Nothing is routed to your desk."}
            bodyClassName="p-0"
          >
            {received.length ? (
              <ul className="divide-y divide-line">
                {received.slice(0, 6).map((report) => (
                  <li key={report.id} className="px-4 py-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-ink">{report.title}</p>
                        <p className="text-[11px] text-ink-mute">
                          {report.authorName} · {REPORT_KIND_LABELS[report.kind]} · {shortDate(report.periodStart)} — {shortDate(report.periodEnd)}
                        </p>
                      </div>
                      <Badge tone={report.status === "acknowledged" ? "success" : "warning"}>
                        {report.status === "acknowledged" ? "Acknowledged" : "New"}
                      </Badge>
                    </div>
                    {Object.entries(report.metrics).length ? (
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {Object.entries(report.metrics).map(([key, value]) => (
                          <span key={key} className="rounded-md bg-canvas px-2 py-0.5 text-[10px] font-medium text-ink-soft">
                            {metricLabel(key)}: {metricValue(key, value)}
                          </span>
                        ))}
                      </div>
                    ) : null}
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Button type="button" size="sm" variant="ghost" onClick={() => setOpenReport(report)}>
                        <Eye className="h-3.5 w-3.5" />
                        View report
                      </Button>
                      {viewer.canAcknowledge && report.status === "submitted" ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          disabled={ackId === report.id}
                          onClick={() => acknowledge(report.id)}
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          {ackId === report.id ? "Confirming" : "Acknowledge"}
                        </Button>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState title="Nothing received" description="Reports addressed to your desk will appear here." />
            )}
          </Panel>
        </div>
      </div>

      <Panel title="Sent reports" subtitle="Your submissions and how far they have moved up." bodyClassName="p-0">
        {sent.length ? (
          <TableShell className="rounded-none border-0">
            <thead>
              <tr>
                <Th>Report</Th>
                <Th>Type</Th>
                <Th>Recipient</Th>
                <Th>Period</Th>
                <Th>Status</Th>
                <Th className="text-right">Submitted</Th>
                <Th className="text-right">Report</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {sent.map((report) => (
                <tr key={report.id} className={rowClass}>
                  <Td>
                    <p className="text-sm font-medium text-ink">{report.title}</p>
                    {report.summary ? <p className="mt-0.5 line-clamp-1 max-w-[280px] text-[11px] text-ink-mute">{report.summary}</p> : null}
                  </Td>
                  <Td className="text-xs text-ink-soft">{REPORT_KIND_LABELS[report.kind]}</Td>
                  <Td className="text-xs text-ink-soft">{REPORT_AUDIENCE_LABELS[report.audience]}</Td>
                  <Td className="whitespace-nowrap text-xs text-ink-soft">
                    {shortDate(report.periodStart)} — {shortDate(report.periodEnd)}
                  </Td>
                  <Td>
                    <Badge tone={report.status === "acknowledged" ? "success" : "info"}>
                      {report.status === "acknowledged" ? "Acknowledged" : "Submitted"}
                    </Badge>
                  </Td>
                  <Td className="whitespace-nowrap text-right text-xs text-ink-mute">{relativeTime(report.createdAt)}</Td>
                  <Td className="text-right">
                    <Button type="button" size="sm" variant="ghost" onClick={() => setOpenReport(report)}>
                      <Eye className="h-3.5 w-3.5" />
                      View
                    </Button>
                  </Td>
                </tr>
              ))}
            </tbody>
          </TableShell>
        ) : (
          <EmptyState title="No reports yet" description={viewer.canSubmit ? "Submit your first report with the form above." : "Reports you file will appear here."} />
        )}
      </Panel>

      <ReportDetailModal
        report={openReport}
        tenantName={tenantName}
        onClose={() => setOpenReport(null)}
        footer={
          openReport && viewer.canAcknowledge && openReport.status === "submitted" && received.some((report) => report.id === openReport.id) ? (
            <Button type="button" variant="secondary" disabled={ackId === openReport.id} onClick={() => acknowledge(openReport.id)}>
              <CheckCircle2 className="h-3.5 w-3.5" />
              {ackId === openReport.id ? "Confirming" : "Acknowledge report"}
            </Button>
          ) : (
            <Button type="button" variant="ghost" onClick={() => setOpenReport(null)}>
              Close
            </Button>
          )
        }
      />
    </div>
  );
}

export function TeamBoard({ members }: { members: TeamMember[] }) {
  const active = members.filter((member) => member.status === "active").length;
  const departments = new Set(members.map((member) => member.department).filter(Boolean));
  const roles = new Set(members.map((member) => member.roleLabel));

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Team management"
        title="Your team"
        description="Everyone with a sign-in to this subsidiary, matched to the staff directory."
      />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Team" value={members.length} hint="People with access" icon={<UsersRound className="h-4 w-4" />} />
        <StatCard label="Active" value={active} hint="Active accounts" icon={<UserRound className="h-4 w-4" />} accent="green" />
        <StatCard label="Roles" value={roles.size} hint="Distinct responsibilities" icon={<ShieldCheck className="h-4 w-4" />} accent="violet" />
        <StatCard label="Departments" value={departments.size} hint="From the staff directory" icon={<BarChart3 className="h-4 w-4" />} accent="blue" />
      </div>
      <Panel title="Members" subtitle="Account changes are governed by group HR provisioning." bodyClassName="p-0">
        {members.length ? (
          <TableShell className="rounded-none border-0">
            <thead>
              <tr>
                <Th>Person</Th>
                <Th>Role</Th>
                <Th>Department</Th>
                <Th>Status</Th>
                <Th className="text-right">Joined</Th>
                <Th className="text-right">Last active</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {members.map((member) => (
                <tr key={member.id} className={rowClass}>
                  <Td>
                    <p className="text-sm font-medium text-ink">{member.name}</p>
                    <p className="text-[11px] text-ink-mute">{member.email}</p>
                  </Td>
                  <Td>
                    <Badge tone="info">{member.roleLabel}</Badge>
                    {member.title ? <p className="mt-0.5 text-[11px] text-ink-mute">{member.title}</p> : null}
                  </Td>
                  <Td className="text-xs text-ink-soft">{member.department || "—"}</Td>
                  <Td>
                    <Badge tone={member.status === "active" ? "success" : "neutral"}>{member.status}</Badge>
                  </Td>
                  <Td className="whitespace-nowrap text-right text-xs text-ink-soft">{shortDate(member.joinedOn)}</Td>
                  <Td className="whitespace-nowrap text-right text-xs text-ink-mute">
                    {member.lastActive ? shortDate(member.lastActive) : "—"}
                  </Td>
                </tr>
              ))}
            </tbody>
          </TableShell>
        ) : (
          <EmptyState title="No team members found" description="Accounts appear once group HR provisions them for this subsidiary." />
        )}
      </Panel>
    </div>
  );
}

export function ShiftBoard({ shifts }: { shifts: TenantShift[] }) {
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Kampala",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const isToday = (iso: string) =>
    new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Kampala", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso)) === today;
  const todayRows = shifts.filter((shift) => isToday(shift.endedAt));
  const minutes = todayRows.reduce((sum, shift) => sum + shift.minutes, 0);
  const people = new Set(todayRows.map((shift) => shift.email)).size;

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Shift sign-outs"
        title="Team shifts"
        description="Every shift your team ended or signed out of, earliest closed first closed at the top."
      />
      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Closed today" value={todayRows.length} hint="Shifts ended or signed out" icon={<Clock3 className="h-4 w-4" />} />
        <StatCard label="Time today" value={duration(minutes)} hint="Recorded across the team" icon={<Clock3 className="h-4 w-4" />} accent="green" />
        <StatCard label="People" value={people} hint="Distinct staff today" icon={<UsersRound className="h-4 w-4" />} accent="violet" />
      </div>
      <Panel title="Shift log" subtitle="Times shown in Africa/Kampala" bodyClassName="p-0">
        {shifts.length ? (
          <TableShell className="rounded-none border-0">
            <thead>
              <tr>
                <Th>Person</Th>
                <Th>Started</Th>
                <Th>Ended</Th>
                <Th className="text-right">Duration</Th>
                <Th>Closed by</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {shifts.map((shift) => (
                <tr key={shift.id} className={rowClass}>
                  <Td>
                    <p className="text-sm font-medium text-ink">{shift.name}</p>
                    <p className="text-[11px] text-ink-mute">{shift.roleLabel}</p>
                  </Td>
                  <Td className="whitespace-nowrap text-xs tabular-nums text-ink-soft">{clock(shift.startedAt)}</Td>
                  <Td className="whitespace-nowrap text-xs tabular-nums text-ink-soft">
                    {shortDate(shift.endedAt)} · {clock(shift.endedAt)}
                  </Td>
                  <Td className="whitespace-nowrap text-right text-xs font-semibold tabular-nums text-ink">{duration(shift.minutes)}</Td>
                  <Td>
                    <Badge tone={shift.endedVia === "signout" ? "neutral" : "info"}>
                      {shift.endedVia === "signout" ? "Signed out" : "Ended shift"}
                    </Badge>
                  </Td>
                </tr>
              ))}
            </tbody>
          </TableShell>
        ) : (
          <EmptyState title="No shifts recorded" description="Shifts appear when staff end a shift or sign out from the workspace." />
        )}
      </Panel>
    </div>
  );
}

export interface NoticeItem {
  id: string;
  title: string;
  body: string;
  at: string;
  tone: "report" | "shift";
}

export function NotificationCenter({ items }: { items: NoticeItem[] }) {
  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Notifications"
        title="What needs your attention"
        description="Report hand-offs and shift activity from your subsidiary."
      />
      <Panel title="Recent activity" subtitle={`${items.length} updates`} bodyClassName="p-0">
        {items.length ? (
          <ul className="divide-y divide-line">
            {items.map((item) => (
              <li key={item.id} className="flex gap-3 px-4 py-3">
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-canvas text-ink-soft">
                  {item.tone === "report" ? <FileText className="h-4 w-4" /> : <Clock3 className="h-4 w-4" />}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-ink">{item.title}</p>
                  <p className="text-xs text-ink-soft">{item.body}</p>
                  <p className="mt-0.5 text-[11px] text-ink-mute">{relativeTime(item.at)}</p>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState title="All clear" description="Nothing new from reports or shifts right now." />
        )}
      </Panel>
    </div>
  );
}

export function ProfileEditor({
  profile,
  email,
  roleLabel,
  tenantName,
}: {
  profile: WorkspaceProfile;
  email: string;
  roleLabel: string;
  tenantName: string;
}) {
  const router = useRouter();
  const [form, setForm] = useState({
    displayName: profile.displayName,
    title: profile.title,
    phone: profile.phone,
    bio: profile.bio,
  });
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  async function save(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setPending(true);
    setNotice(null);
    try {
      const response = await fetch("/api/desk/profile", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(form),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(body?.error?.message ?? "Could not save your profile.");
      setNotice({ tone: "ok", text: "Profile saved." });
      router.refresh();
    } catch (error) {
      setNotice({ tone: "error", text: error instanceof Error ? error.message : "Could not save your profile." });
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader eyebrow="Profile" title="Your profile" description="How you appear across this workspace." />
      <div className="grid gap-4 lg:grid-cols-[0.8fr_1.2fr]">
        <Card className="p-5">
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-royal-50 text-base font-semibold text-royal">
              {(profile.displayName || email).slice(0, 1).toUpperCase()}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-ink">{profile.displayName || email.split("@")[0]}</p>
              <p className="truncate text-xs text-ink-soft">{profile.title || roleLabel}</p>
            </div>
          </div>
          <dl className="mt-4 space-y-2 text-xs">
            <div className="flex justify-between gap-2">
              <dt className="text-ink-mute">Email</dt>
              <dd className="truncate font-medium text-ink">{email}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-ink-mute">Role</dt>
              <dd className="font-medium text-ink">{roleLabel}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-ink-mute">Subsidiary</dt>
              <dd className="font-medium text-ink">{tenantName}</dd>
            </div>
          </dl>
          <p className="mt-4 border-t border-line pt-3 text-[11px] text-ink-mute">
            Sign-in details are managed by group HR provisioning.
          </p>
        </Card>

        <Panel title="Edit profile" subtitle="Your display name replaces your sign-in name across the workspace.">
          <form className="space-y-3" onSubmit={save}>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Display name">
                <Input maxLength={80} value={form.displayName} onChange={(event) => setForm({ ...form, displayName: event.target.value })} placeholder="e.g. Grace N." />
              </Field>
              <Field label="Job title">
                <Input maxLength={80} value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="e.g. Sales associate" />
              </Field>
            </div>
            <Field label="Phone">
              <Input maxLength={40} value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} placeholder="+256 …" />
            </Field>
            <Field label="About" hint="A short note for your team.">
              <Textarea maxLength={400} value={form.bio} onChange={(event) => setForm({ ...form, bio: event.target.value })} />
            </Field>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Notice notice={notice} />
              <Button type="submit" disabled={pending}>{pending ? "Saving" : "Save profile"}</Button>
            </div>
          </form>
        </Panel>
      </div>
    </div>
  );
}

export function SettingsPanel({
  profile,
  tenantName,
  roleLabel,
}: {
  profile: WorkspaceProfile;
  tenantName: string;
  roleLabel: string;
}) {
  const router = useRouter();
  const [form, setForm] = useState({
    accent: profile.accent,
    density: profile.density,
    notifyReports: profile.notifyReports,
    notifyShifts: profile.notifyShifts,
    notifyWeekly: profile.notifyWeekly,
  });
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  async function save(): Promise<void> {
    setPending(true);
    setNotice(null);
    try {
      const response = await fetch("/api/desk/settings", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(form),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(body?.error?.message ?? "Could not save your settings.");
      setNotice({ tone: "ok", text: "Workstation updated." });
      router.refresh();
    } catch (error) {
      setNotice({ tone: "error", text: error instanceof Error ? error.message : "Could not save your settings." });
    } finally {
      setPending(false);
    }
  }

  const toggles: { key: "notifyReports" | "notifyShifts" | "notifyWeekly"; label: string; hint: string }[] = [
    { key: "notifyReports", label: "Report hand-offs", hint: "When a report reaches your desk or moves up." },
    { key: "notifyShifts", label: "Shift activity", hint: "When your team ends a shift or signs out." },
    { key: "notifyWeekly", label: "Weekly summary", hint: "A weekly roll-up of your desk." },
  ];

  return (
    <div className="space-y-4">
      <PageHeader eyebrow="Settings" title="Customise your workstation" description={`${roleLabel} · ${tenantName}`} />

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Appearance" subtitle="Applies to your sidebar and workspace chrome.">
          <div className="space-y-4">
            <div>
              <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-soft">
                <Palette className="h-3.5 w-3.5" /> Accent
              </p>
              <div className="flex flex-wrap gap-2">
                {ACCENTS.map((accent) => (
                  <button
                    key={accent.id}
                    type="button"
                    onClick={() => setForm({ ...form, accent: accent.value })}
                    aria-pressed={form.accent === accent.value}
                    className={
                      form.accent === accent.value
                        ? "flex items-center gap-2 rounded-lg border-2 border-navy bg-canvas px-2.5 py-1.5 text-xs font-medium text-ink"
                        : "flex items-center gap-2 rounded-lg border border-line px-2.5 py-1.5 text-xs font-medium text-ink-soft hover:bg-canvas"
                    }
                  >
                    <span
                      className="h-4 w-4 rounded-full border border-black/10"
                      style={{ backgroundColor: accent.value || "#e2e8f0" }}
                    />
                    {accent.label}
                  </button>
                ))}
              </div>
            </div>
            <Field label="Density">
              <Select
                value={form.density}
                onChange={(event) => setForm({ ...form, density: event.target.value as "compact" | "comfortable" })}
              >
                <option value="comfortable">Comfortable</option>
                <option value="compact">Compact</option>
              </Select>
            </Field>
          </div>
        </Panel>

        <Panel title="Notifications" subtitle="What this workspace tells you about.">
          <div className="space-y-3">
            {toggles.map((toggle) => (
              <label key={toggle.key} className="flex cursor-pointer items-start justify-between gap-3 rounded-lg border border-line px-3 py-2">
                <span>
                  <span className="block text-sm font-medium text-ink">{toggle.label}</span>
                  <span className="block text-[11px] text-ink-mute">{toggle.hint}</span>
                </span>
                <input
                  type="checkbox"
                  checked={form[toggle.key]}
                  onChange={(event) => setForm({ ...form, [toggle.key]: event.target.checked })}
                  className="mt-1 h-4 w-4 accent-navy"
                />
              </label>
            ))}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <Notice notice={notice} />
              <Button type="button" onClick={save} disabled={pending}>
                <BellRing className="h-4 w-4" />
                {pending ? "Saving" : "Save settings"}
              </Button>
            </div>
          </div>
        </Panel>
      </div>
    </div>
  );
}
