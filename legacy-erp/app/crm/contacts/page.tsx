"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { Building2, Plus, Search, Users, Wallet } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { CrmTabs } from "@/components/crm-tabs";
import { StatCard } from "@/components/stat-card";
import { CompanyMark } from "@/components/entities";
import {
  ContactStatusBadge,
  ContactTypeBadge,
} from "@/components/crm-entities";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { useEntity } from "@/components/entity-provider";
import type { ContactType } from "@/lib/crm-data";
import { formatDate, formatUGX, initials } from "@/lib/format";

const emptyForm = {
  name: "",
  organization: "",
  role: "",
  email: "",
  phone: "",
  companyId: "passito",
  type: "prospect" as ContactType,
  owner: "Robert Mwesigwa",
  value: "",
};

export default function CrmContactsPage() {
  const { companies, contacts, addContact } = useSystem();
  const { entity } = useEntity();
  const [query, setQuery] = useState("");
  const [companyFilter, setCompanyFilter] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState("all");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const activeCompany = companyFilter ?? entity?.id ?? "all";

  useEffect(() => {
    setCompanyFilter(null);
  }, [entity?.id]);

  const scopedContacts = useMemo(
    () =>
      contacts.filter(
        (contact) =>
          activeCompany === "all" || contact.companyId === activeCompany
      ),
    [contacts, activeCompany]
  );

  const filtered = useMemo(
    () =>
      scopedContacts
        .filter((contact) => {
          const company = companies.find((item) => item.id === contact.companyId);
          const haystack = `${contact.name} ${contact.organization} ${contact.email} ${contact.role} ${company?.name ?? ""}`;
          return (
            haystack.toLowerCase().includes(query.toLowerCase()) &&
            (typeFilter === "all" || contact.type === typeFilter)
          );
        })
        .sort((a, b) => a.organization.localeCompare(b.organization)),
    [scopedContacts, companies, query, typeFilter]
  );

  const customers = scopedContacts.filter(
    (contact) => contact.type === "customer"
  ).length;
  const prospects = scopedContacts.filter(
    (contact) => contact.type === "prospect"
  ).length;
  const accountValue = scopedContacts.reduce(
    (sum, contact) => sum + contact.value,
    0
  );
  const filterLabel =
    activeCompany === "all"
      ? "the group"
      : companies.find((company) => company.id === activeCompany)?.shortName;

  function openDialog(nextOpen: boolean) {
    setOpen(nextOpen);
    if (nextOpen) {
      setForm({
        ...emptyForm,
        companyId: entity?.id ?? emptyForm.companyId,
        owner: entity?.md ?? emptyForm.owner,
      });
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = Number(form.value);
    if (!form.name.trim() || !form.organization.trim() || !form.email.trim()) {
      toast.error("Name, organisation and email are required");
      return;
    }
    addContact({
      name: form.name.trim(),
      organization: form.organization.trim(),
      role: form.role.trim(),
      email: form.email.trim(),
      phone: form.phone.trim(),
      companyId: form.companyId,
      type: form.type,
      owner: form.owner,
      value: Number.isFinite(value) && value > 0 ? value : 0,
    });
    toast.success(`${form.name} added to CRM contacts`);
    setOpen(false);
  }

  return (
    <div>
      <PageHeader
        title={entity ? `${entity.shortName} contacts` : "CRM contacts"}
        description={
          entity
            ? `Customers, prospects and partners for ${entity.name}.`
            : "Customers, prospects and partners managed by each subsidiary."
        }
      >
        <Dialog open={open} onOpenChange={openDialog}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-3.5 w-3.5" />
              Add contact
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add contact</DialogTitle>
              <DialogDescription>
                Create a customer, prospect or partner record.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label htmlFor="contact-name">Full name</Label>
                  <Input
                    id="contact-name"
                    value={form.name}
                    onChange={(event) => setForm({ ...form, name: event.target.value })}
                    placeholder="e.g. Aisha Nakimuli"
                    autoFocus
                  />
                </div>
                <div>
                  <Label htmlFor="contact-org">Organisation</Label>
                  <Input
                    id="contact-org"
                    value={form.organization}
                    onChange={(event) =>
                      setForm({ ...form, organization: event.target.value })
                    }
                    placeholder="e.g. Roofings Group"
                  />
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label htmlFor="contact-role">Role</Label>
                  <Input
                    id="contact-role"
                    value={form.role}
                    onChange={(event) => setForm({ ...form, role: event.target.value })}
                    placeholder="e.g. Procurement Manager"
                  />
                </div>
                <div>
                  <Label htmlFor="contact-phone">Phone</Label>
                  <Input
                    id="contact-phone"
                    value={form.phone}
                    onChange={(event) => setForm({ ...form, phone: event.target.value })}
                    placeholder="+256 7xx xxx xxx"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="contact-email">Email</Label>
                <Input
                  id="contact-email"
                  type="email"
                  value={form.email}
                  onChange={(event) => setForm({ ...form, email: event.target.value })}
                  placeholder="name@company.co.ug"
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label htmlFor="contact-company">Company</Label>
                  <Select
                    id="contact-company"
                    value={form.companyId}
                    onChange={(event) => {
                      const companyId = event.target.value;
                      const company = companies.find((item) => item.id === companyId);
                      setForm({ ...form, companyId, owner: company?.md ?? form.owner });
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
                  <Label htmlFor="contact-type">Contact type</Label>
                  <Select
                    id="contact-type"
                    value={form.type}
                    onChange={(event) =>
                      setForm({ ...form, type: event.target.value as ContactType })
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
                  <Label htmlFor="contact-owner">Account owner</Label>
                  <Select
                    id="contact-owner"
                    value={form.owner}
                    onChange={(event) => setForm({ ...form, owner: event.target.value })}
                  >
                    {companies.map((company) => (
                      <option key={company.id} value={company.md}>
                        {company.md}
                      </option>
                    ))}
                  </Select>
                </div>
                <div>
                  <Label htmlFor="contact-value">Account value (UGX)</Label>
                  <Input
                    id="contact-value"
                    type="number"
                    min={0}
                    value={form.value}
                    onChange={(event) => setForm({ ...form, value: event.target.value })}
                    placeholder="Optional"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">Save contact</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </PageHeader>

      <CrmTabs />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total contacts" value={String(scopedContacts.length)} icon={Users} hint={`for ${filterLabel}`} tone="blue" />
        <StatCard label="Customers" value={String(customers)} icon={Building2} hint="active accounts" tone="green" />
        <StatCard label="Prospects" value={String(prospects)} icon={Users} hint="in the pipeline" tone="violet" />
        <StatCard label="Account value" value={formatUGX(accountValue)} icon={Wallet} hint="recorded book" tone="amber" />
      </div>

      <Card className="mt-4">
        <CardContent className="p-0">
          <div className="flex flex-col gap-2 border-b border-border p-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search name, organisation or email"
                className="pl-8"
                aria-label="Search contacts"
              />
            </div>
            <Select
              value={activeCompany}
              onChange={(event) => setCompanyFilter(event.target.value)}
              className="sm:w-44"
              aria-label="Filter by company"
            >
              <option value="all">All companies</option>
              {companies.map((company) => (
                <option key={company.id} value={company.id}>
                  {company.shortName}
                </option>
              ))}
            </Select>
            <Select
              value={typeFilter}
              onChange={(event) => setTypeFilter(event.target.value)}
              className="sm:w-40"
              aria-label="Filter by type"
            >
              <option value="all">All types</option>
              <option value="customer">Customers</option>
              <option value="prospect">Prospects</option>
              <option value="partner">Partners</option>
            </Select>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Contact</TableHead>
                <TableHead className="hidden md:table-cell">Company</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="hidden lg:table-cell">Owner</TableHead>
                <TableHead className="hidden xl:table-cell">Last contact</TableHead>
                <TableHead className="text-right">Account value</TableHead>
                <TableHead className="hidden text-right sm:table-cell">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((contact) => {
                const company = companies.find((item) => item.id === contact.companyId);
                return (
                  <TableRow key={contact.id}>
                    <TableCell>
                      <Link
                        href={`/crm/contacts/${contact.id}`}
                        className="flex items-center gap-2.5 hover:text-primary"
                      >
                        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#131313] text-[10px] font-bold text-white">
                          {initials(contact.name)}
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-xs font-semibold text-foreground">
                            {contact.name}
                          </span>
                          <span className="block truncate text-[11px] text-muted-foreground">
                            {contact.organization} · {contact.role}
                          </span>
                        </span>
                      </Link>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {company ? (
                        <span className="flex items-center gap-2">
                          <CompanyMark company={company} size="sm" />
                          <span className="text-xs text-muted-foreground">
                            {company.shortName}
                          </span>
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <ContactTypeBadge type={contact.type} />
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      <span className="text-xs text-muted-foreground">{contact.owner}</span>
                    </TableCell>
                    <TableCell className="hidden xl:table-cell">
                      <span className="text-xs text-muted-foreground">
                        {formatDate(contact.lastContact)}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="text-xs font-semibold text-foreground">
                        {formatUGX(contact.value)}
                      </span>
                    </TableCell>
                    <TableCell className="hidden text-right sm:table-cell">
                      <ContactStatusBadge status={contact.status} />
                    </TableCell>
                  </TableRow>
                );
              })}
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-10 text-center">
                    <p className="text-sm font-semibold text-foreground">No contacts found</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Adjust the filters or add a contact.
                    </p>
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <p className="mt-3 text-[11px] text-muted-foreground">
        Showing {filtered.length} of {contacts.length} contacts.
      </p>
    </div>
  );
}
