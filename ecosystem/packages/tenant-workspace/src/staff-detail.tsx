import {
  Avatar,
  Badge,
  Card,
  EmptyState,
  Panel,
  StatCard,
  TableShell,
  Td,
  Th,
  rowClass,
} from "@d12/ui";
import { ArrowLeft, CheckSquare, Folder, Users } from "lucide-react";
import Link from "next/link";
import type {
  LeadRecord,
  ProjectRecord,
  StaffRecord,
  TaskRecord,
} from "@d12/contracts";
import { formatUgx, shortDate, titleCase } from "./format";

export interface StaffDetailInput {
  staff: StaffRecord;
  tasks: TaskRecord[];
  leads: LeadRecord[];
  projects: ProjectRecord[];
}

function statusTone(status: string): "success" | "info" | "warning" {
  if (status === "active") return "success";
  if (status === "contract") return "info";
  return "warning";
}

export function StaffDetail({ staff, tasks, leads, projects }: StaffDetailInput) {
  const openTasks = tasks.filter((task) => task.status !== "done");
  const doneTasks = tasks.filter((task) => task.status === "done");
  const pipelineValue = leads
    .filter((lead) => lead.stage !== "won" && lead.stage !== "lost")
    .reduce((sum, lead) => sum + Number(lead.value ?? 0), 0);

  return (
    <div className="space-y-4">
      <div>
        <Link
          href="/staff"
          className="inline-flex items-center gap-1 text-xs font-medium text-ink-soft transition-colors hover:text-ink"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to staff
        </Link>
      </div>

      <Card>
        <div className="flex flex-wrap items-start gap-4 p-4 sm:p-5">
          <Avatar name={staff.name} className="h-12 w-12 text-sm" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-lg font-semibold tracking-tight text-ink">{staff.name}</h1>
              <Badge tone={statusTone(staff.status)}>{titleCase(staff.status)}</Badge>
            </div>
            <p className="mt-0.5 text-sm text-ink-soft">
              {staff.role || "Staff"} · {staff.department || "Operations"}
            </p>
            <dl className="mt-3 grid gap-x-8 gap-y-1.5 text-sm sm:grid-cols-2 lg:grid-cols-3">
              <div className="flex gap-2">
                <dt className="text-ink-mute">Email</dt>
                <dd className="truncate font-medium text-ink">{staff.email || "—"}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="text-ink-mute">Phone</dt>
                <dd className="font-medium text-ink">{staff.phone || "—"}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="text-ink-mute">Joined</dt>
                <dd className="font-medium text-ink">
                  {staff.joinedOn ? shortDate(staff.joinedOn) : "—"}
                </dd>
              </div>
            </dl>
            {staff.notes ? <p className="mt-3 text-sm text-ink-soft">{staff.notes}</p> : null}
          </div>
        </div>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Open tasks"
          value={String(openTasks.length)}
          hint={`${doneTasks.length} completed`}
          icon={<CheckSquare className="h-4 w-4" />}
          accent="navy"
        />
        <StatCard
          label="Leads owned"
          value={String(leads.length)}
          hint={leads.length ? `${formatUgx(pipelineValue)} open pipeline` : "No direct leads"}
          icon={<Users className="h-4 w-4" />}
          accent="blue"
        />
        <StatCard
          label="Projects owned"
          value={String(projects.length)}
          hint={
            projects.length
              ? `${projects.filter((project) => project.status === "active").length} active`
              : "Not leading any project"
          }
          icon={<Folder className="h-4 w-4" />}
          accent="violet"
        />
        <StatCard
          label="On the roster"
          value={titleCase(staff.status)}
          hint={staff.department || "Operations"}
          icon={<Users className="h-4 w-4" />}
          accent={staff.status === "active" ? "green" : "amber"}
        />
      </div>

      <Panel title="Assigned tasks" subtitle="Delivery work currently on their plate.">
        {tasks.length ? (
          <TableShell>
            <thead>
              <tr>
                <Th>Task</Th>
                <Th>Status</Th>
                <Th>Priority</Th>
                <Th className="text-right">Due</Th>
              </tr>
            </thead>
            <tbody>
              {tasks.slice(0, 8).map((task) => (
                <tr key={task.id} className={rowClass}>
                  <Td className="max-w-[280px] truncate font-medium">{task.title}</Td>
                  <Td>
                    <Badge tone={task.status === "done" ? "success" : task.status === "in_progress" ? "info" : "neutral"}>
                      {titleCase(task.status)}
                    </Badge>
                  </Td>
                  <Td>
                    <Badge tone={task.priority === "high" ? "danger" : task.priority === "medium" ? "warning" : "neutral"}>
                      {titleCase(task.priority)}
                    </Badge>
                  </Td>
                  <Td className="text-right text-xs text-ink-soft">
                    {task.dueOn ? shortDate(task.dueOn) : "—"}
                  </Td>
                </tr>
              ))}
            </tbody>
          </TableShell>
        ) : (
          <EmptyState
            title="No assigned tasks"
            description="Nothing on their plate right now. Assign a task to see it here."
          />
        )}
      </Panel>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Leads owned" subtitle="Pipeline conversations they manage.">
          {leads.length ? (
            <TableShell>
              <thead>
                <tr>
                  <Th>Lead</Th>
                  <Th>Stage</Th>
                  <Th className="text-right">Value</Th>
                </tr>
              </thead>
              <tbody>
                {leads.slice(0, 6).map((lead) => (
                  <tr key={lead.id} className={rowClass}>
                    <Td className="max-w-[180px] truncate font-medium">{lead.name}</Td>
                    <Td>
                      <Badge
                        tone={
                          lead.stage === "won"
                            ? "success"
                            : lead.stage === "lost"
                              ? "danger"
                              : lead.stage === "qualified"
                                ? "info"
                                : "neutral"
                        }
                      >
                        {titleCase(lead.stage)}
                      </Badge>
                    </Td>
                    <Td className="text-right tabular-nums">{formatUgx(lead.value)}</Td>
                  </tr>
                ))}
              </tbody>
            </TableShell>
          ) : (
            <EmptyState
              title="No direct leads"
              description="Leads they own will appear here automatically."
            />
          )}
        </Panel>

        <Panel title="Projects owned" subtitle="Delivery work they lead.">
          {projects.length ? (
            <TableShell>
              <thead>
                <tr>
                  <Th>Project</Th>
                  <Th>Status</Th>
                  <Th className="text-right">Progress</Th>
                </tr>
              </thead>
              <tbody>
                {projects.slice(0, 6).map((project) => (
                  <tr key={project.id} className={rowClass}>
                    <Td className="max-w-[180px] truncate font-medium">{project.name}</Td>
                    <Td>
                      <Badge
                        tone={
                          project.status === "completed"
                            ? "success"
                            : project.status === "on_hold"
                              ? "warning"
                              : project.status === "cancelled"
                                ? "danger"
                                : "info"
                        }
                      >
                        {titleCase(project.status)}
                      </Badge>
                    </Td>
                    <Td className="text-right tabular-nums text-xs text-ink-soft">
                      {project.progress}%
                    </Td>
                  </tr>
                ))}
              </tbody>
            </TableShell>
          ) : (
            <EmptyState
              title="Not leading projects"
              description="Projects they own will appear here automatically."
            />
          )}
        </Panel>
      </div>
    </div>
  );
}
