"use client";

import { useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  CalendarDays,
  Mail,
  MessageSquarePlus,
  Pencil,
  Phone,
  StickyNote,
  Target,
  Trash2,
  Trophy,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { CompanyMark } from "@/components/entities";
import {
  ContactStatusBadge,
  ContactTypeBadge,
  DealStageBadge,
} from "@/components/crm-entities";
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
import { Select } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useSystem } from "@/components/system-provider";
import type { ActivityType, Contact, ContactType } from "@/lib/crm-data";
import { formatDate, formatUGX } from "@/lib/format";

const activityIcons: Record<ActivityType, typeof Phone> = {
  call: Phone,
  email: Mail,
  meeting: CalendarDays,
  note: StickyNote,
};

const activityLabels: Record<ActivityType, string> = {
  call: "Call",
  email: "Email",
  meeting: "Meeting",
  note: "Note",
};

export default function ContactDetailPage({ params }: { params: { id: string } }) {
  const {
    companies,
    contacts,
    deals,
    activities,
    logActivity,
    updateContact,
    removeContact,
  } = useSystem();
  const router = useRouter();
  const contact = contacts.find((item) => item.id === params.id);
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [draft, setDraft] = useState<Contact | null>(null);
  const [form, setForm] = useState({
    type: "call" as ActivityType,
    title: "",
    notes: "",
  });

  const contactDeals = useMemo(
    () => deals.filter((deal) => deal.contactId === params.id),
    [deals, params.id]
  );
  const contactActivities = useMemo(
    () =>
      activities
        .filter((activity) => activity.contactId === params.id)
        .sort((a, b) => b.date.localeCompare(a.date)),
    [activities, params.id]
  );

  if (!contact) {
    return (
      <div className="rounded-lg border border-border bg-card p-10 text-center">
        <p className="text-sm font-semibold text-foreground">Contact not found</p>
        <p className="mt-1 text-xs text-muted-foreground">
          This contact is not in the CRM register.
        </p>
        <Link href="/crm/contacts" className="mt-4 inline-block">
          <Button variant="outline">Back to contacts</Button>
        </Link>
      </div>
    );
  }

  const company = companies.find((item) => item.id === contact.companyId);
  const openDeals = contactDeals.filter(
    (deal) => deal.stage !== "won" && deal.stage !== "lost"
  );
  const wonDeals = contactDeals.filter((deal) => deal.stage === "won");

  function saveContact(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft || !contact) return;
    if (!draft.name.trim() || !draft.organization.trim()) {
      toast.error("Name and organisation are required");
      return;
    }
    updateContact(contact.id, {
      name: draft.name.trim(),
      organization: draft.organization.trim(),
      role: draft.role.trim(),
      email: draft.email.trim(),
      phone: draft.phone.trim(),
      companyId: draft.companyId,
      type: draft.type,
      status: draft.status,
      owner: draft.owner.trim(),
      value: Number(draft.value) || 0,
    });
    toast.success("Contact updated");
    setEditOpen(false);
  }

  function deleteContact() {
    if (!contact) return;
    if (
      !window.confirm(
        `Delete ${contact.name}? Their deals and activities stay recorded but will be unlinked.`
      )
    ) {
      return;
    }
    removeContact(contact.id);
    toast.success("Contact deleted");
    router.push("/crm/contacts");
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form.title.trim() || !contact) {
      toast.error("Add a short summary for the activity");
      return;
    }
    logActivity({
      contactId: contact.id,
      companyId: contact.companyId,
      type: form.type,
      title: form.title.trim(),
      notes: form.notes.trim() || undefined,
    });
    toast.success("Activity logged");
    setForm({ type: "call", title: "", notes: "" });
    setOpen(false);
  }

  return (
    <div>
      <Link
        href="/crm/contacts"
        className="mb-4 inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        All contacts
      </Link>

      <PageHeader title={contact.name} description={`${contact.role} · ${contact.organization}`}>
        <ContactTypeBadge type={contact.type} />
        <Dialog
          open={editOpen}
          onOpenChange={(next) => {
            setEditOpen(next);
            if (next) setDraft(contact);
          }}
        >
          <DialogTrigger asChild>
            <Button variant="outline">
              <Pencil className="h-3.5 w-3.5" />
              Edit
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit contact</DialogTitle>
              <DialogDescription>
                Update this CRM record. Linked deals stay attached.
              </DialogDescription>
            </DialogHeader>
            {draft ? (
              <form onSubmit={saveContact} className="space-y-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="contact-edit-name">Full name</Label>
                    <Input
                      id="contact-edit-name"
                      value={draft.name}
                      onChange={(event) =>
                        setDraft({ ...draft, name: event.target.value })
                      }
                      autoFocus
                    />
                  </div>
                  <div>
                    <Label htmlFor="contact-edit-org">Organisation</Label>
                    <Input
                      id="contact-edit-org"
                      value={draft.organization}
                      onChange={(event) =>
                        setDraft({ ...draft, organization: event.target.value })
                      }
                    />
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="contact-edit-role">Role</Label>
                    <Input
                      id="contact-edit-role"
                      value={draft.role}
                      onChange={(event) =>
                        setDraft({ ...draft, role: event.target.value })
                      }
                    />
                  </div>
                  <div>
                    <Label htmlFor="contact-edit-owner">Account owner</Label>
                    <Input
                      id="contact-edit-owner"
                      value={draft.owner}
                      onChange={(event) =>
                        setDraft({ ...draft, owner: event.target.value })
                      }
                    />
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="contact-edit-email">Email</Label>
                    <Input
                      id="contact-edit-email"
                      type="email"
                      value={draft.email}
                      onChange={(event) =>
                        setDraft({ ...draft, email: event.target.value })
                      }
                    />
                  </div>
                  <div>
                    <Label htmlFor="contact-edit-phone">Phone</Label>
                    <Input
                      id="contact-edit-phone"
                      value={draft.phone}
                      onChange={(event) =>
                        setDraft({ ...draft, phone: event.target.value })
                      }
                    />
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="contact-edit-company">Company</Label>
                    <Select
                      id="contact-edit-company"
                      value={draft.companyId}
                      onChange={(event) =>
                        setDraft({ ...draft, companyId: event.target.value })
                      }
                    >
                      {companies.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.shortName}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="contact-edit-type">Contact type</Label>
                    <Select
                      id="contact-edit-type"
                      value={draft.type}
                      onChange={(event) =>
                        setDraft({
                          ...draft,
                          type: event.target.value as ContactType,
                        })
                      }
                    >
                      <option value="customer">Customer</option>
                      <option value="prospect">Prospect</option>
                      <option value="partner">Partner</option>
                    </Select>
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="contact-edit-status">Status</Label>
                    <Select
                      id="contact-edit-status"
                      value={draft.status}
                      onChange={(event) =>
                        setDraft({
                          ...draft,
                          status: event.target.value as Contact["status"],
                        })
                      }
                    >
                      <option value="active">Active</option>
                      <option value="dormant">Dormant</option>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="contact-edit-value">Account value (UGX)</Label>
                    <Input
                      id="contact-edit-value"
                      type="number"
                      min={0}
                      value={draft.value}
                      onChange={(event) =>
                        setDraft({ ...draft, value: Number(event.target.value) || 0 })
                      }
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setEditOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit">Save changes</Button>
                </DialogFooter>
              </form>
            ) : null}
          </DialogContent>
        </Dialog>
        <Button variant="destructive" onClick={deleteContact}>
          <Trash2 className="h-3.5 w-3.5" />
          Delete
        </Button>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <MessageSquarePlus className="h-3.5 w-3.5" />
              Log activity
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Log activity</DialogTitle>
              <DialogDescription>
                Record a call, email, meeting or note for {contact.name}.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <Label htmlFor="activity-type">Activity type</Label>
                <Select
                  id="activity-type"
                  value={form.type}
                  onChange={(event) =>
                    setForm({ ...form, type: event.target.value as ActivityType })
                  }
                >
                  <option value="call">Call</option>
                  <option value="email">Email</option>
                  <option value="meeting">Meeting</option>
                  <option value="note">Note</option>
                </Select>
              </div>
              <div>
                <Label htmlFor="activity-title">Summary</Label>
                <Input
                  id="activity-title"
                  value={form.title}
                  onChange={(event) => setForm({ ...form, title: event.target.value })}
                  placeholder="e.g. Follow-up on contract pricing"
                  autoFocus
                />
              </div>
              <div>
                <Label htmlFor="activity-notes">Notes (optional)</Label>
                <textarea
                  id="activity-notes"
                  value={form.notes}
                  onChange={(event) => setForm({ ...form, notes: event.target.value })}
                  rows={3}
                  className="w-full rounded-md border border-input bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
                  placeholder="Outcome and next steps"
                />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">Save activity</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </PageHeader>

      <div className="mb-4 flex flex-wrap items-center gap-x-5 gap-y-2 rounded-lg border border-border bg-card px-4 py-3 text-xs text-muted-foreground">
        {company ? (
          <span className="flex items-center gap-1.5">
            <CompanyMark company={company} size="sm" />
            <span className="font-semibold text-foreground">{company.name}</span>
          </span>
        ) : null}
        <span className="flex items-center gap-1.5">
          <Mail className="h-3.5 w-3.5" /> {contact.email}
        </span>
        <span className="flex items-center gap-1.5">
          <Phone className="h-3.5 w-3.5" /> {contact.phone}
        </span>
        <span className="flex items-center gap-1.5">
          <Users className="h-3.5 w-3.5" /> Owner: {contact.owner}
        </span>
        <ContactStatusBadge status={contact.status} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Account value" value={formatUGX(contact.value)} hint="recorded book" icon={Trophy} tone="green" />
        <StatCard
          label="Open pipeline"
          value={formatUGX(openDeals.reduce((sum, deal) => sum + deal.value, 0))}
          hint={`${openDeals.length} open deals`}
          icon={Target}
          tone="blue"
        />
        <StatCard
          label="Won business"
          value={formatUGX(wonDeals.reduce((sum, deal) => sum + deal.value, 0))}
          hint={`${wonDeals.length} won deals`}
          icon={Trophy}
          tone="violet"
        />
        <StatCard
          label="Activities"
          value={String(contactActivities.length)}
          hint={`last contact ${formatDate(contact.lastContact)}`}
          icon={CalendarDays}
          tone="amber"
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <div>
              <CardTitle>Deals</CardTitle>
              <CardDescription>Opportunities linked to this contact</CardDescription>
            </div>
            <Link
              href="/crm"
              className="text-xs font-semibold text-primary hover:underline"
            >
              Open pipeline
            </Link>
          </CardHeader>
          <CardContent className="px-0 pb-0 pt-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Deal</TableHead>
                  <TableHead>Stage</TableHead>
                  <TableHead className="hidden sm:table-cell">Owner</TableHead>
                  <TableHead className="hidden md:table-cell">Expected close</TableHead>
                  <TableHead className="text-right">Value</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {contactDeals.map((deal) => (
                  <TableRow key={deal.id}>
                    <TableCell>
                      <p className="text-xs font-semibold text-foreground">{deal.title}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {deal.probability}% probability
                      </p>
                    </TableCell>
                    <TableCell>
                      <DealStageBadge stage={deal.stage} />
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <span className="text-xs text-muted-foreground">{deal.owner}</span>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <span className="text-xs text-muted-foreground">
                        {formatDate(deal.expectedClose)}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="text-xs font-semibold text-foreground">
                        {formatUGX(deal.value)}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
                {contactDeals.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-8 text-center text-xs text-muted-foreground">
                      No deals recorded for this contact yet.
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardTitle>Account details</CardTitle>
              <CardDescription>CRM record</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 text-xs">
            {[
              ["Organisation", contact.organization],
              ["Role", contact.role],
              ["Contact type", contact.type],
              ["Subsidiary", company?.shortName ?? "—"],
              ["Account owner", contact.owner],
              ["Last contact", formatDate(contact.lastContact)],
              ["Account value", formatUGX(contact.value)],
            ].map(([label, value]) => (
              <div
                key={label}
                className="flex items-start justify-between gap-4 border-b border-border pb-2 capitalize last:border-0 last:pb-0"
              >
                <span className="text-muted-foreground">{label}</span>
                <span className="text-right font-semibold text-foreground">{value}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader>
          <div>
            <CardTitle>Activity timeline</CardTitle>
            <CardDescription>Every recorded touchpoint with this contact</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {contactActivities.map((activity) => {
              const Icon = activityIcons[activity.type];
              return (
                <div key={activity.id} className="flex items-start gap-3">
                  <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-md bg-blue-50 text-blue-700">
                    <Icon className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1 border-b border-border pb-3 last:border-0 last:pb-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-xs font-semibold text-foreground">
                        {activity.title}
                      </p>
                      <span className="rounded bg-secondary px-1.5 py-0.5 text-[10px] font-semibold text-secondary-foreground">
                        {activityLabels[activity.type]}
                      </span>
                    </div>
                    {activity.notes ? (
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                        {activity.notes}
                      </p>
                    ) : null}
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {formatDate(activity.date)} · {activity.by}
                    </p>
                  </div>
                </div>
              );
            })}
            {contactActivities.length === 0 ? (
              <p className="py-6 text-center text-xs text-muted-foreground">
                No activity recorded yet. Use “Log activity” to add the first one.
              </p>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
