"use client";

import { useMemo, useState, type FormEvent } from "react";
import {
  CalendarDays,
  FolderKanban,
  Pencil,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { CompanyMark, ProjectStatusBadge } from "@/components/entities";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useEntity } from "@/components/entity-provider";
import { useSystem } from "@/components/system-provider";
import { TODAY, type Project, type ProjectStatus } from "@/lib/data";
import { formatDate, formatUGX } from "@/lib/format";

interface ProjectDraft {
  name: string;
  companyId: string;
  client: string;
  budget: string;
  spent: string;
  progress: string;
  status: ProjectStatus;
  due: string;
}

const emptyDraft: ProjectDraft = {
  name: "",
  companyId: "passito",
  client: "",
  budget: "",
  spent: "",
  progress: "0",
  status: "active",
  due: TODAY,
};

export default function ProjectsPage() {
  const { companies, projects, addProject, updateProject, removeProject } =
    useSystem();
  const { entity } = useEntity();
  const [tab, setTab] = useState("all");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<ProjectDraft>(emptyDraft);

  const scopedProjects = entity
    ? projects.filter((project) => project.companyId === entity.id)
    : projects;

  const filtered = useMemo(
    () =>
      scopedProjects
        .filter((project) => {
          const company = companies.find((item) => item.id === project.companyId);
          const matchesQuery = `${project.name} ${project.client} ${company?.name ?? ""}`
            .toLowerCase()
            .includes(query.toLowerCase());
          return matchesQuery && (tab === "all" || project.status === tab);
        })
        .sort((a, b) => {
          if (a.status === "completed" && b.status !== "completed") return 1;
          if (b.status === "completed" && a.status !== "completed") return -1;
          return a.due.localeCompare(b.due);
        }),
    [scopedProjects, companies, tab, query]
  );

  function openCreate() {
    setEditingId(null);
    setDraft({
      ...emptyDraft,
      companyId: entity?.id ?? companies[0]?.id ?? "passito",
    });
    setOpen(true);
  }

  function openEdit(project: Project) {
    setEditingId(project.id);
    setDraft({
      name: project.name,
      companyId: project.companyId,
      client: project.client,
      budget: String(project.budget),
      spent: String(project.spent),
      progress: String(project.progress),
      status: project.status,
      due: project.due,
    });
    setOpen(true);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const budget = Number(draft.budget) || 0;
    const spent = Number(draft.spent) || 0;
    const progress = Math.min(100, Math.max(0, Number(draft.progress) || 0));
    if (!draft.name.trim() || budget < 0 || spent < 0) {
      toast.error("Enter a project name and valid amounts");
      return;
    }
    const input = {
      name: draft.name.trim(),
      companyId: draft.companyId,
      client: draft.client.trim(),
      budget,
      spent,
      progress,
      status: draft.status,
      due: draft.due,
    };
    if (editingId) {
      updateProject(editingId, input);
      toast.success("Project updated");
    } else {
      addProject(input);
      toast.success("Project created");
    }
    setOpen(false);
  }

  function handleDelete(project: Project) {
    if (!window.confirm(`Delete “${project.name}”? This cannot be undone.`)) return;
    removeProject(project.id);
    toast.success("Project deleted");
  }

  const activeCount = scopedProjects.filter((project) => project.status === "active").length;
  const onHoldCount = scopedProjects.filter((project) => project.status === "on-hold").length;
  const totalBudget = scopedProjects
    .filter((project) => project.status !== "completed")
    .reduce((sum, project) => sum + project.budget, 0);

  return (
    <div>
      <PageHeader
        title={entity ? `${entity.shortName} projects` : "Projects"}
        description={
          entity
            ? `Ventures and projects run by ${entity.name}.`
            : "Ventures and projects across the group — status, budget and progress."
        }
      >
        <Button onClick={openCreate}>
          <Plus className="h-3.5 w-3.5" />
          Add project
        </Button>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingId ? "Edit project" : "Add project"}</DialogTitle>
              <DialogDescription>
                Track a venture or project against a subsidiary.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <Label htmlFor="project-name">Project name</Label>
                <Input
                  id="project-name"
                  value={draft.name}
                  onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                  placeholder="e.g. Shop4Me"
                  autoFocus
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label htmlFor="project-company">Company</Label>
                  <Select
                    id="project-company"
                    value={draft.companyId}
                    onChange={(event) =>
                      setDraft({ ...draft, companyId: event.target.value })
                    }
                  >
                    {companies.map((company) => (
                      <option key={company.id} value={company.id}>
                        {company.shortName}
                      </option>
                    ))}
                  </Select>
                </div>
                <div>
                  <Label htmlFor="project-client">Client</Label>
                  <Input
                    id="project-client"
                    value={draft.client}
                    onChange={(event) =>
                      setDraft({ ...draft, client: event.target.value })
                    }
                    placeholder="e.g. Group venture"
                  />
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label htmlFor="project-budget">Budget (UGX)</Label>
                  <Input
                    id="project-budget"
                    type="number"
                    min={0}
                    value={draft.budget}
                    onChange={(event) =>
                      setDraft({ ...draft, budget: event.target.value })
                    }
                    placeholder="Optional — e.g. 50000000"
                  />
                </div>
                <div>
                  <Label htmlFor="project-spent">Spent so far (UGX)</Label>
                  <Input
                    id="project-spent"
                    type="number"
                    min={0}
                    value={draft.spent}
                    onChange={(event) =>
                      setDraft({ ...draft, spent: event.target.value })
                    }
                    placeholder="e.g. 400000000"
                  />
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label htmlFor="project-progress">Progress (%)</Label>
                  <Input
                    id="project-progress"
                    type="number"
                    min={0}
                    max={100}
                    value={draft.progress}
                    onChange={(event) =>
                      setDraft({ ...draft, progress: event.target.value })
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="project-status">Status</Label>
                  <Select
                    id="project-status"
                    value={draft.status}
                    onChange={(event) =>
                      setDraft({
                        ...draft,
                        status: event.target.value as ProjectStatus,
                      })
                    }
                  >
                    <option value="active">Active</option>
                    <option value="on-hold">On hold</option>
                    <option value="completed">Completed</option>
                  </Select>
                </div>
              </div>
              <div>
                <Label htmlFor="project-due">Due date</Label>
                <Input
                  id="project-due"
                  type="date"
                  value={draft.due}
                  onChange={(event) => setDraft({ ...draft, due: event.target.value })}
                />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">
                  {editingId ? "Save changes" : "Create project"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </PageHeader>

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        {[
          { label: "Active projects", value: String(activeCount), icon: FolderKanban, chip: "bg-blue-50 text-blue-700" },
          { label: "On hold", value: String(onHoldCount), icon: CalendarDays, chip: "bg-amber-50 text-amber-700" },
          {
            label: "Open project budget",
            value: totalBudget > 0 ? formatUGX(totalBudget) : "Not set",
            icon: FolderKanban,
            chip: "bg-violet-50 text-violet-700",
          },
        ].map((stat) => (
          <Card key={stat.label}>
            <CardContent className="flex items-center justify-between p-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {stat.label}
                </p>
                <p className="mt-1 text-lg font-bold text-foreground">{stat.value}</p>
              </div>
              <span className={`grid h-8 w-8 place-items-center rounded-md ${stat.chip}`}>
                <stat.icon className="h-4 w-4" />
              </span>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="active">Active</TabsTrigger>
            <TabsTrigger value="on-hold">On hold</TabsTrigger>
            <TabsTrigger value="completed">Completed</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="relative sm:w-64">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search projects"
            className="pl-8"
            aria-label="Search projects"
          />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {filtered.map((project) => {
          const company = companies.find((item) => item.id === project.companyId);
          const hasBudget = project.budget > 0;
          const spentShare = hasBudget ? (project.spent / project.budget) * 100 : 0;
          const overBudget = project.spent > project.budget;
          return (
            <Card key={project.id} className="flex flex-col">
              <CardContent className="flex flex-1 flex-col p-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="flex min-w-0 items-center gap-2">
                    {company ? <CompanyMark company={company} size="sm" /> : null}
                    <span className="truncate text-[11px] font-semibold text-muted-foreground">
                      {company?.shortName}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-1">
                    <ProjectStatusBadge status={project.status} />
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => openEdit(project)}
                      title="Edit project"
                      aria-label={`Edit ${project.name}`}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => handleDelete(project)}
                      title="Delete project"
                      aria-label={`Delete ${project.name}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </span>
                </div>

                <h3 className="mt-3 text-sm font-bold leading-snug text-foreground">
                  {project.name}
                </h3>
                {project.client ? (
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    Client: {project.client}
                  </p>
                ) : null}

                <div className="mt-3 flex items-center gap-2">
                  <Progress value={project.progress} />
                  <span className="w-8 shrink-0 text-right text-[11px] font-bold text-foreground">
                    {project.progress}%
                  </span>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2 border-t border-border pt-3">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Budget
                    </p>
                    <p className="mt-0.5 text-xs font-semibold text-foreground">
                      {hasBudget ? formatUGX(project.budget, { compact: true }) : "Not set"}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Spent
                    </p>
                    {hasBudget ? (
                      <p
                        className={
                          overBudget
                            ? "mt-0.5 text-xs font-semibold text-red-700"
                            : "mt-0.5 text-xs font-semibold text-foreground"
                        }
                      >
                        {formatUGX(project.spent, { compact: true })}
                        <span className="ml-1 text-[10px] font-medium text-muted-foreground">
                          ({Math.round(spentShare)}%)
                        </span>
                      </p>
                    ) : (
                      <p className="mt-0.5 text-xs font-semibold text-muted-foreground">—</p>
                    )}
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-between border-t border-border pt-3 text-[11px]">
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <CalendarDays className="h-3.5 w-3.5" />
                    Due {formatDate(project.due)}
                  </span>
                  <span
                    className={
                      project.status === "completed"
                        ? "font-semibold text-emerald-700"
                        : "font-semibold text-muted-foreground"
                    }
                  >
                    {project.status === "completed"
                      ? "Closed"
                      : hasBudget
                        ? `${formatUGX(project.budget - project.spent)} left`
                        : "Budget not set"}
                  </span>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-card p-10 text-center">
          <p className="text-sm font-semibold text-foreground">No projects match</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Change the status tab or clear your search.
          </p>
        </div>
      ) : null}
    </div>
  );
}
