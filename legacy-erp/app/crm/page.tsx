"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import {
  ArrowRight,
  CalendarDays,
  ChevronRight,
  Handshake,
  Mail,
  Pencil,
  Phone,
  Plus,
  StickyNote,
  Target,
  Trash2,
  Trophy,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { CrmTabs } from "@/components/crm-tabs";
import { StatCard } from "@/components/stat-card";
import { CompanyMark } from "@/components/entities";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select } from "@/components/ui/select";
import { useEntity } from "@/components/entity-provider";
import { useSystem } from "@/components/system-provider";
import {
  dealStages,
  nextStage,
  stageMeta,
  stageProbability,
  type ActivityType,
  type Deal,
  type DealStage,
} from "@/lib/crm-data";
import { formatDate, formatUGX, initials } from "@/lib/format";

const activityIcons: Record<ActivityType, typeof Phone> = {
  call: Phone,
  email: Mail,
  meeting: CalendarDays,
  note: StickyNote,
};

export default function CrmPage() {
  const {
    companies,
    contacts,
    deals,
    activities,
    addDeal,
    updateDeal,
    removeDeal,
    advanceDeal,
  } = useSystem();
  const { entity } = useEntity();
  const [companyFilter, setCompanyFilter] = useState<string | null>(null);
  const activeCompany = companyFilter ?? entity?.id ?? "all";

  useEffect(() => {
    setCompanyFilter(null);
  }, [entity?.id]);
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editDealId, setEditDealId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    title: "",
    companyId: "passito",
    contactId: "",
    value: "",
    stage: "lead" as DealStage,
    expectedClose: "",
  });
  const [form, setForm] = useState({
    title: "",
    companyId: "passito",
    contactId: "c-04",
    value: "",
    stage: "qualified" as DealStage,
    expectedClose: "2027-01-31",
  });

  const companyContacts = contacts.filter(
    (contact) => contact.companyId === form.companyId
  );
  const editContacts = contacts.filter(
    (contact) => contact.companyId === editForm.companyId
  );

  const filteredDeals = useMemo(
    () =>
      deals.filter(
        (deal) => activeCompany === "all" || deal.companyId === activeCompany
      ),
    [deals, activeCompany]
  );

  const openDeals = filteredDeals.filter(
    (deal) => deal.stage !== "won" && deal.stage !== "lost"
  );
  const wonDeals = filteredDeals.filter((deal) => deal.stage === "won");
  const lostDeals = filteredDeals.filter((deal) => deal.stage === "lost");
  const openPipeline = openDeals.reduce((sum, deal) => sum + deal.value, 0);
  const wonValue = wonDeals.reduce((sum, deal) => sum + deal.value, 0);
  const winRate =
    wonDeals.length + lostDeals.length > 0
      ? (wonDeals.length / (wonDeals.length + lostDeals.length)) * 100
      : 0;
  const filteredContacts = contacts.filter(
    (contact) =>
      (activeCompany === "all" || contact.companyId === activeCompany) &&
      contact.status === "active"
  );

  const recentActivities = useMemo(
    () =>
      [...activities]
        .filter(
          (activity) =>
            activeCompany === "all" || activity.companyId === activeCompany
        )
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, 6),
    [activities, activeCompany]
  );

  const filterLabel =
    activeCompany === "all"
      ? "Group wide"
      : companies.find((company) => company.id === activeCompany)?.shortName;

  function openDialog(nextOpen: boolean) {
    setOpen(nextOpen);
    if (nextOpen) {
      setForm({
        title: "",
        companyId: "passito",
        contactId: "c-04",
        value: "",
        stage: "qualified",
        expectedClose: "2027-01-31",
      });
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = Number(form.value);
    const company = companies.find((item) => item.id === form.companyId);
    if (!form.title.trim() || !Number.isFinite(value) || value <= 0 || !form.contactId) {
      toast.error("Enter a deal name, contact and valid value");
      return;
    }
    addDeal({
      title: form.title.trim(),
      contactId: form.contactId,
      companyId: form.companyId,
      stage: form.stage,
      value,
      owner: company?.md ?? "Group sales",
      expectedClose: form.expectedClose,
    });
    toast.success("Deal added to the pipeline", {
      description: `${formatUGX(value)} · ${stageMeta(form.stage).label}`,
    });
    setOpen(false);
  }

  function openDealEditor(deal: Deal) {
    setEditDealId(deal.id);
    setEditForm({
      title: deal.title,
      companyId: deal.companyId,
      contactId: deal.contactId,
      value: String(deal.value),
      stage: deal.stage,
      expectedClose: deal.expectedClose,
    });
    setEditOpen(true);
  }

  function handleDealUpdate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editDealId) return;
    const value = Number(editForm.value);
    if (!editForm.title.trim() || !Number.isFinite(value) || value <= 0) {
      toast.error("Enter a deal name and a valid value");
      return;
    }
    updateDeal(editDealId, {
      title: editForm.title.trim(),
      companyId: editForm.companyId,
      contactId: editForm.contactId,
      value,
      stage: editForm.stage,
      expectedClose: editForm.expectedClose,
    });
    toast.success("Deal updated");
    setEditOpen(false);
  }

  function handleDeleteDeal(deal: Deal) {
    if (!window.confirm(`Delete “${deal.title}”? This cannot be undone.`)) return;
    removeDeal(deal.id);
    toast.success("Deal deleted");
  }

  function handleAdvance(dealId: string) {
    const next = advanceDeal(dealId);
    if (next) {
      toast.success(
        next === "won" ? "Deal won" : `Moved to ${stageMeta(next).label}`
      );
    }
  }

  return (
    <div>
      <PageHeader
        title={entity ? `${entity.shortName} pipeline` : "CRM pipeline"}
        description={
          entity
            ? `Deals, contacts and activities for ${entity.name}.`
            : "One customer workspace for every District 12 subsidiary."
        }
      >
        <Select
          value={activeCompany}
          onChange={(event) => setCompanyFilter(event.target.value)}
          className="w-44"
          aria-label="Filter by company"
        >
          <option value="all">All companies</option>
          {companies.map((company) => (
            <option key={company.id} value={company.id}>
              {company.shortName}
            </option>
          ))}
        </Select>
        <Dialog open={open} onOpenChange={openDialog}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-3.5 w-3.5" />
              Add deal
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add deal</DialogTitle>
              <DialogDescription>
                Track a new opportunity against a company and contact.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <Label htmlFor="deal-title">Deal name</Label>
                <Input
                  id="deal-title"
                  value={form.title}
                  onChange={(event) => setForm({ ...form, title: event.target.value })}
                  placeholder="e.g. Fleet renewal — FY27"
                  autoFocus
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label htmlFor="deal-company">Company</Label>
                  <Select
                    id="deal-company"
                    value={form.companyId}
                    onChange={(event) => {
                      const companyId = event.target.value;
                      const firstContact = contacts.find(
                        (contact) => contact.companyId === companyId
                      );
                      setForm({
                        ...form,
                        companyId,
                        contactId: firstContact?.id ?? "",
                      });
                    }}
                  >
                    {companies.map((company) => (
                      <option key={company.id} value={company.id}>
                        {company.shortName}
                      </option>
                    ))}
                  </Select>
                </div>
                <div>
                  <Label htmlFor="deal-contact">Contact</Label>
                  <Select
                    id="deal-contact"
                    value={form.contactId}
                    onChange={(event) =>
                      setForm({ ...form, contactId: event.target.value })
                    }
                  >
                    {companyContacts.map((contact) => (
                      <option key={contact.id} value={contact.id}>
                        {contact.name} — {contact.organization}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label htmlFor="deal-value">Value (UGX)</Label>
                  <Input
                    id="deal-value"
                    type="number"
                    min={1}
                    value={form.value}
                    onChange={(event) => setForm({ ...form, value: event.target.value })}
                    placeholder="e.g. 450000000"
                  />
                </div>
                <div>
                  <Label htmlFor="deal-stage">Stage</Label>
                  <Select
                    id="deal-stage"
                    value={form.stage}
                    onChange={(event) =>
                      setForm({ ...form, stage: event.target.value as DealStage })
                    }
                  >
                    {dealStages
                      .filter((stage) => stage.id !== "lost")
                      .map((stage) => (
                        <option key={stage.id} value={stage.id}>
                          {stage.label}
                        </option>
                      ))}
                  </Select>
                </div>
              </div>
              <div>
                <Label htmlFor="deal-close">Expected close</Label>
                <Input
                  id="deal-close"
                  type="date"
                  value={form.expectedClose}
                  onChange={(event) =>
                    setForm({ ...form, expectedClose: event.target.value })
                  }
                />
              </div>
              <p className="text-[11px] text-muted-foreground">
                Win probability is set automatically from the stage (
                {stageProbability(form.stage)}%).
              </p>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">Save deal</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        <Dialog open={editOpen} onOpenChange={setEditOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit deal</DialogTitle>
              <DialogDescription>
                Update the opportunity, move stage or close it as won or lost.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleDealUpdate} className="space-y-3">
              <div>
                <Label htmlFor="deal-edit-title">Deal name</Label>
                <Input
                  id="deal-edit-title"
                  value={editForm.title}
                  onChange={(event) =>
                    setEditForm({ ...editForm, title: event.target.value })
                  }
                  autoFocus
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label htmlFor="deal-edit-company">Company</Label>
                  <Select
                    id="deal-edit-company"
                    value={editForm.companyId}
                    onChange={(event) => {
                      const companyId = event.target.value;
                      const firstContact = contacts.find(
                        (contact) => contact.companyId === companyId
                      );
                      setEditForm({
                        ...editForm,
                        companyId,
                        contactId: firstContact?.id ?? "",
                      });
                    }}
                  >
                    {companies.map((company) => (
                      <option key={company.id} value={company.id}>
                        {company.shortName}
                      </option>
                    ))}
                  </Select>
                </div>
                <div>
                  <Label htmlFor="deal-edit-contact">Contact</Label>
                  <Select
                    id="deal-edit-contact"
                    value={editForm.contactId}
                    onChange={(event) =>
                      setEditForm({ ...editForm, contactId: event.target.value })
                    }
                  >
                    <option value="">No linked contact</option>
                    {editContacts.map((contact) => (
                      <option key={contact.id} value={contact.id}>
                        {contact.name} — {contact.organization}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label htmlFor="deal-edit-value">Value (UGX)</Label>
                  <Input
                    id="deal-edit-value"
                    type="number"
                    min={1}
                    value={editForm.value}
                    onChange={(event) =>
                      setEditForm({ ...editForm, value: event.target.value })
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="deal-edit-stage">Stage</Label>
                  <Select
                    id="deal-edit-stage"
                    value={editForm.stage}
                    onChange={(event) =>
                      setEditForm({
                        ...editForm,
                        stage: event.target.value as DealStage,
                      })
                    }
                  >
                    {dealStages.map((stage) => (
                      <option key={stage.id} value={stage.id}>
                        {stage.label}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>
              <div>
                <Label htmlFor="deal-edit-close">Expected close</Label>
                <Input
                  id="deal-edit-close"
                  type="date"
                  value={editForm.expectedClose}
                  onChange={(event) =>
                    setEditForm({ ...editForm, expectedClose: event.target.value })
                  }
                />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setEditOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">Save changes</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </PageHeader>

      <CrmTabs />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Open pipeline"
          value={formatUGX(openPipeline)}
          hint={`${openDeals.length} open deals · ${filterLabel}`}
          icon={Target}
          tone="blue"
        />
        <StatCard
          label="Won"
          value={formatUGX(wonValue)}
          hint={`${wonDeals.length} closed deals`}
          icon={Trophy}
          tone="green"
        />
        <StatCard
          label="Win rate"
          value={`${winRate.toFixed(0)}%`}
          hint={`${wonDeals.length} won · ${lostDeals.length} lost`}
          icon={Handshake}
          tone="violet"
        />
        <StatCard
          label="Active contacts"
          value={String(filteredContacts.length)}
          hint={`${formatUGX(filteredContacts.reduce((sum, contact) => sum + contact.value, 0))} account value`}
          icon={Users}
          tone="amber"
        />
      </div>

      <div className="mt-4 flex gap-3 overflow-x-auto pb-2">
        {dealStages.map((stage) => {
          const stageDeals = filteredDeals.filter((deal) => deal.stage === stage.id);
          const stageValue = stageDeals.reduce((sum, deal) => sum + deal.value, 0);
          return (
            <div
              key={stage.id}
              className="flex w-[264px] shrink-0 flex-col rounded-lg border border-border bg-secondary"
            >
              <div
                className="flex items-center justify-between gap-2 border-b border-border px-3 py-2.5"
                style={{ borderTop: `3px solid ${stage.color}` }}
              >
                <span className="flex items-center gap-1.5">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: stage.color }}
                  />
                  <span className="text-xs font-bold text-foreground">{stage.label}</span>
                  <span className="rounded bg-card px-1.5 text-[10px] font-semibold text-muted-foreground">
                    {stageDeals.length}
                  </span>
                </span>
                <span className="text-[10px] font-semibold text-muted-foreground">
                  {formatUGX(stageValue)}
                </span>
              </div>

              <div className="flex-1 space-y-2 p-2">
                {stageDeals.map((deal) => {
                  const company = companies.find((item) => item.id === deal.companyId);
                  const contact = contacts.find((item) => item.id === deal.contactId);
                  const next = nextStage(deal.stage);
                  return (
                    <div
                      key={deal.id}
                      className="rounded-md border border-border border-l-4 bg-card p-3 shadow-sm"
                      style={{ borderLeftColor: stage.color }}
                    >
                      <div className="flex items-center gap-1.5">
                        {company ? <CompanyMark company={company} size="sm" /> : null}
                        <span className="truncate text-[10px] font-semibold text-muted-foreground">
                          {company?.shortName}
                        </span>
                        <span className="ml-auto text-[10px] font-bold" style={{ color: stage.color }}>
                          {deal.probability}%
                        </span>
                      </div>
                      <p className="mt-2 text-xs font-bold leading-snug text-foreground">
                        {deal.title}
                      </p>
                      {contact ? (
                        <Link
                          href={`/crm/contacts/${contact.id}`}
                          className="mt-1 block truncate text-[11px] text-muted-foreground hover:text-primary"
                        >
                          {contact.name} · {contact.organization}
                        </Link>
                      ) : null}
                      <div className="mt-2">
                        <p className="text-sm font-bold text-foreground">
                          {formatUGX(deal.value)}
                        </p>
                        <Progress
                          value={deal.probability}
                          className="mt-1.5 h-1"
                          barColor={stage.color}
                        />
                      </div>
                      <div className="mt-2 flex items-center justify-between gap-2 border-t border-border pt-2">
                        <span className="flex min-w-0 items-center gap-1 text-[10px] text-muted-foreground">
                          <CalendarDays className="h-3 w-3 shrink-0" />
                          <span className="truncate">{formatDate(deal.expectedClose)}</span>
                        </span>
                        <span className="flex items-center gap-1">
                          {stage.id === "won" || stage.id === "lost" ? (
                            <span className="flex items-center gap-1 text-[10px] font-semibold">
                              <span className="grid h-4 w-4 place-items-center rounded-full bg-secondary text-[8px] font-bold text-foreground">
                                {initials(deal.owner).slice(0, 2)}
                              </span>
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleAdvance(deal.id)}
                              className="inline-flex items-center gap-0.5 rounded border border-border bg-card px-1.5 py-0.5 text-[10px] font-semibold text-foreground transition-colors hover:border-primary hover:text-primary"
                              title={next ? `Move to ${stageMeta(next).label}` : "Advance deal"}
                            >
                              Advance
                              <ChevronRight className="h-3 w-3" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => openDealEditor(deal)}
                            className="grid h-5 w-5 place-items-center rounded text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                            title="Edit deal"
                            aria-label={`Edit ${deal.title}`}
                          >
                            <Pencil className="h-3 w-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteDeal(deal)}
                            className="grid h-5 w-5 place-items-center rounded text-muted-foreground transition-colors hover:bg-red-50 hover:text-red-700"
                            title="Delete deal"
                            aria-label={`Delete ${deal.title}`}
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </span>
                      </div>
                    </div>
                  );
                })}
                {stageDeals.length === 0 ? (
                  <p className="rounded-md border border-dashed border-border bg-card px-3 py-6 text-center text-[11px] text-muted-foreground">
                    No deals in this stage
                  </p>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <div>
              <CardTitle>Recent activity</CardTitle>
              <CardDescription>Latest customer touchpoints across {filterLabel}</CardDescription>
            </div>
            <Link
              href="/crm/contacts"
              className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
            >
              Contacts
              <ArrowRight className="h-3 w-3" />
            </Link>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentActivities.map((activity) => {
              const Icon = activityIcons[activity.type];
              const contact = contacts.find((item) => item.id === activity.contactId);
              const company = companies.find((item) => item.id === activity.companyId);
              return (
                <div key={activity.id} className="flex items-start gap-3">
                  <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-md bg-blue-50 text-blue-700">
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                  <div className="min-w-0 flex-1 border-b border-border pb-2.5 last:border-0">
                    <p className="truncate text-xs font-semibold text-foreground">
                      {activity.title}
                    </p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      {contact?.organization} · {formatDate(activity.date)} · {activity.by}
                    </p>
                  </div>
                  <Badge variant="outline" className="shrink-0">
                    {company?.shortName}
                  </Badge>
                </div>
              );
            })}
            {recentActivities.length === 0 ? (
              <p className="py-6 text-center text-xs text-muted-foreground">
                No activity recorded for this company.
              </p>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardTitle>Top accounts</CardTitle>
              <CardDescription>By recorded account value</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {[...filteredContacts]
              .sort((a, b) => b.value - a.value)
              .slice(0, 5)
              .map((contact) => {
                const company = companies.find((item) => item.id === contact.companyId);
                return (
                  <Link
                    key={contact.id}
                    href={`/crm/contacts/${contact.id}`}
                    className="block rounded-md border border-border p-2.5 transition-colors hover:border-primary/50"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-xs font-semibold text-foreground">
                        {contact.organization}
                      </span>
                      <span className="shrink-0 text-xs font-bold text-foreground">
                        {formatUGX(contact.value)}
                      </span>
                    </div>
                    <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                      {company ? (
                        <span
                          className="h-1.5 w-1.5 rounded-full"
                          style={{ backgroundColor: company.color }}
                        />
                      ) : null}
                      {contact.name} · {contact.type}
                    </p>
                  </Link>
                );
              })}
            {filteredContacts.length === 0 ? (
              <p className="py-6 text-center text-xs text-muted-foreground">
                No active contacts for this company.
              </p>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
