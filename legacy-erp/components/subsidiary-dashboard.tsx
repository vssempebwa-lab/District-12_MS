"use client";

import Link from "next/link";
import { useMemo, type ReactNode } from "react";
import {
  ArrowRight,
  CalendarDays,
  FolderKanban,
  Handshake,
  Phone,
  Target,
  TrendingUp,
  UserPlus,
  Users,
  type LucideIcon,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { ProjectStatusBadge } from "@/components/entities";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useSystem } from "@/components/system-provider";
import { stageMeta } from "@/lib/crm-data";
import type { Company } from "@/lib/data";
import { formatDate, formatUGX, initials } from "@/lib/format";

function Panel({
  title,
  description,
  href,
  icon: Icon,
  count,
  empty,
  children,
}: {
  title: string;
  description: string;
  href: string;
  icon: LucideIcon;
  count: number;
  empty: string;
  children: ReactNode;
}) {
  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-start gap-2.5">
          <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-md bg-accent text-accent-foreground">
            <Icon className="h-3.5 w-3.5" />
          </span>
          <div className="min-w-0">
            <CardTitle className="flex items-center gap-2">
              {title}
              <Badge variant="neutral">{count}</Badge>
            </CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
        </div>
        <Link
          href={href}
          className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-primary hover:underline"
        >
          View all
          <ArrowRight className="h-3 w-3" />
        </Link>
      </CardHeader>
      <CardContent className="flex-1 px-0 pb-0 pt-0">
        {count === 0 ? (
          <p className="border-t border-border px-5 py-8 text-center text-xs text-muted-foreground">
            {empty}
          </p>
        ) : (
          <div className="divide-y divide-border border-t border-border">{children}</div>
        )}
      </CardContent>
    </Card>
  );
}

function RecordRow({
  href,
  primary,
  secondary,
  meta,
  avatar,
}: {
  href: string;
  primary: string;
  secondary: ReactNode;
  meta?: ReactNode;
  avatar?: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-secondary"
    >
      {avatar ? (
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-secondary text-[10px] font-bold text-foreground">
          {avatar}
        </span>
      ) : null}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-xs font-semibold text-foreground">
          {primary}
        </span>
        <span className="block truncate text-[11px] text-muted-foreground sm:hidden">
          {secondary}
        </span>
      </span>
      <span className="hidden min-w-0 max-w-[42%] truncate text-[11px] text-muted-foreground sm:block">
        {secondary}
      </span>
      {meta ? <span className="shrink-0">{meta}</span> : null}
    </Link>
  );
}

export function SubsidiaryDashboard({ company }: { company: Company }) {
  const { contacts, deals, activities, projects, accounts } = useSystem();

  const scopedContacts = useMemo(
    () => contacts.filter((contact) => contact.companyId === company.id),
    [contacts, company.id]
  );
  const scopedDeals = useMemo(
    () => deals.filter((deal) => deal.companyId === company.id),
    [deals, company.id]
  );
  const scopedActivities = useMemo(
    () => activities.filter((activity) => activity.companyId === company.id),
    [activities, company.id]
  );
  const scopedProjects = useMemo(
    () => projects.filter((project) => project.companyId === company.id),
    [projects, company.id]
  );

  const customerRecords = useMemo(
    () =>
      [...scopedContacts]
        .sort((a, b) => b.lastContact.localeCompare(a.lastContact))
        .slice(0, 5),
    [scopedContacts]
  );
  const leads = useMemo(
    () =>
      scopedContacts
        .filter((contact) => contact.type === "prospect")
        .sort((a, b) => b.lastContact.localeCompare(a.lastContact))
        .slice(0, 5),
    [scopedContacts]
  );
  const calls = useMemo(
    () =>
      scopedActivities
        .filter((activity) => activity.type === "call")
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, 5),
    [scopedActivities]
  );
  const meetings = useMemo(
    () =>
      scopedActivities
        .filter((activity) => activity.type === "meeting")
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, 5),
    [scopedActivities]
  );
  const openDeals = useMemo(
    () =>
      scopedDeals
        .filter((deal) => deal.stage !== "won" && deal.stage !== "lost")
        .sort((a, b) => a.expectedClose.localeCompare(b.expectedClose))
        .slice(0, 5),
    [scopedDeals]
  );
  const activeProjects = useMemo(
    () =>
      scopedProjects
        .filter((project) => project.status !== "completed")
        .sort((a, b) => a.due.localeCompare(b.due))
        .slice(0, 5),
    [scopedProjects]
  );

  const pipeline = scopedDeals
    .filter((deal) => deal.stage !== "won" && deal.stage !== "lost")
    .reduce((sum, deal) => sum + deal.value, 0);
  const wonValue = scopedDeals
    .filter((deal) => deal.stage === "won")
    .reduce((sum, deal) => sum + deal.value, 0);
  const activeContacts = scopedContacts.filter(
    (contact) => contact.status === "active"
  ).length;
  const leadCount = scopedContacts.filter(
    (contact) => contact.type === "prospect"
  ).length;
  const callCount = scopedActivities.filter(
    (activity) => activity.type === "call"
  ).length;
  const meetingCount = scopedActivities.filter(
    (activity) => activity.type === "meeting"
  ).length;
  const openDealCount = scopedDeals.filter(
    (deal) => deal.stage !== "won" && deal.stage !== "lost"
  ).length;
  const openProjectCount = scopedProjects.filter(
    (project) => project.status !== "completed"
  ).length;
  const dashboardAccounts = accounts.filter(
    (account) => account.companyId === company.id
  ).length;

  const contactHref = (contactId: string) =>
    contactId ? `/crm/contacts/${contactId}` : "/crm/contacts";

  return (
    <div>
      <PageHeader
        title={`Welcome ${company.name}`}
        description={`Independent ${company.sector.toLowerCase()} workspace — managed by ${company.md}, ${company.location}.`}
      >
        <Link href="/crm">
          <Button variant="outline" size="md">
            Open CRM
            <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </Link>
        <Link href="/reports">
          <Button size="md">Subsidiary report</Button>
        </Link>
      </PageHeader>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Revenue"
          value={formatUGX(company.revenue)}
          delta={company.growth}
          hint="year to date"
          icon={TrendingUp}
          tone="green"
        />
        <StatCard
          label="Open pipeline"
          value={formatUGX(pipeline)}
          hint={`${openDealCount} open deals · ${formatUGX(wonValue, { compact: true })} won`}
          icon={Target}
          tone="blue"
        />
        <StatCard
          label="Customers"
          value={String(activeContacts)}
          hint={`${leadCount} leads · ${formatUGX(
            scopedContacts.reduce((sum, contact) => sum + contact.value, 0),
            { compact: true }
          )} account value`}
          icon={Handshake}
          tone="violet"
        />
        <StatCard
          label="Team"
          value={String(company.staff)}
          hint={`${dashboardAccounts} dashboard ${
            dashboardAccounts === 1 ? "account" : "accounts"
          }`}
          icon={Users}
          tone="amber"
        />
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Panel
          title="Customer Data base"
          description="Contact name · account name"
          href="/crm/contacts"
          icon={Users}
          count={scopedContacts.length}
          empty="No customer contacts yet. Add the first one from CRM."
        >
          {customerRecords.map((contact) => (
            <RecordRow
              key={contact.id}
              href={`/crm/contacts/${contact.id}`}
              avatar={initials(contact.name)}
              primary={contact.name}
              secondary={contact.organization}
              meta={
                <span className="text-[11px] font-semibold text-muted-foreground">
                  {formatUGX(contact.value)}
                </span>
              }
            />
          ))}
        </Panel>

        <Panel
          title="All Leads"
          description="Lead name · company"
          href="/crm/contacts"
          icon={UserPlus}
          count={leadCount}
          empty="No open leads. Prospects added in CRM appear here."
        >
          {leads.map((lead) => (
            <RecordRow
              key={lead.id}
              href={`/crm/contacts/${lead.id}`}
              avatar={initials(lead.name)}
              primary={lead.name}
              secondary={lead.organization}
              meta={
                <Badge variant="outline" className="capitalize">
                  {lead.type}
                </Badge>
              }
            />
          ))}
        </Panel>

        <Panel
          title="All Calls"
          description="Subject · account"
          href="/crm"
          icon={Phone}
          count={callCount}
          empty="No calls logged for this subsidiary yet."
        >
          {calls.map((call) => {
            const contact = scopedContacts.find((item) => item.id === call.contactId);
            return (
              <RecordRow
                key={call.id}
                href={contactHref(call.contactId)}
                primary={call.title}
                secondary={contact?.organization ?? "Unlinked"}
                meta={
                  <span className="hidden text-[10px] font-medium text-muted-foreground sm:inline">
                    {formatDate(call.date)}
                  </span>
                }
              />
            );
          })}
        </Panel>

        <Panel
          title="All Meetings"
          description="Subject · account"
          href="/crm"
          icon={CalendarDays}
          count={meetingCount}
          empty="No meetings logged for this subsidiary yet."
        >
          {meetings.map((meeting) => {
            const contact = scopedContacts.find(
              (item) => item.id === meeting.contactId
            );
            return (
              <RecordRow
                key={meeting.id}
                href={contactHref(meeting.contactId)}
                primary={meeting.title}
                secondary={contact?.organization ?? "Unlinked"}
                meta={
                  <span className="hidden text-[10px] font-medium text-muted-foreground sm:inline">
                    {formatDate(meeting.date)}
                  </span>
                }
              />
            );
          })}
        </Panel>

        <Panel
          title="Open deals"
          description="Deal name · stage"
          href="/crm"
          icon={Target}
          count={openDealCount}
          empty="No open deals. Create one in the pipeline."
        >
          {openDeals.map((deal) => {
            const stage = stageMeta(deal.stage);
            return (
              <RecordRow
                key={deal.id}
                href="/crm"
                primary={deal.title}
                secondary={
                  <span style={{ color: stage.color }} className="font-semibold">
                    {stage.label}
                  </span>
                }
                meta={
                  <span className="text-[11px] font-semibold text-foreground">
                    {formatUGX(deal.value)}
                  </span>
                }
              />
            );
          })}
        </Panel>

        <Panel
          title="Active projects"
          description="Project · status"
          href="/projects"
          icon={FolderKanban}
          count={openProjectCount}
          empty="No active projects for this subsidiary."
        >
          {activeProjects.map((project) => (
            <RecordRow
              key={project.id}
              href="/projects"
              primary={project.name}
              secondary={project.client}
              meta={<ProjectStatusBadge status={project.status} />}
            />
          ))}
        </Panel>
      </div>
    </div>
  );
}
