"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Building2,
  CalendarDays,
  Mail,
  Pencil,
  Phone,
  Trash2,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { CompanyMark, StaffStatusBadge } from "@/components/entities";
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
import { useSystem } from "@/components/system-provider";
import { formatDate, initials } from "@/lib/format";
import type { StaffMember } from "@/lib/data";

export default function StaffDetailPage({ params }: { params: { id: string } }) {
  const { companies, staff, updateStaff, removeStaff } = useSystem();
  const router = useRouter();
  const member = staff.find((item) => item.id === params.id);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<StaffMember | null>(null);

  if (!member) {
    return (
      <div className="rounded-lg border border-border bg-card p-10 text-center">
        <p className="text-sm font-semibold text-foreground">Staff member not found</p>
        <p className="mt-1 text-xs text-muted-foreground">
          This record is no longer in the staff directory.
        </p>
        <Link href="/staff" className="mt-4 inline-block">
          <Button variant="outline">Back to staff</Button>
        </Link>
      </div>
    );
  }

  const company = companies.find((item) => item.id === member.companyId);

  function openEditor(next: boolean) {
    setOpen(next);
    if (next) setForm(member ?? null);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form) return;
    if (!form.name.trim() || !form.role.trim() || !form.email.trim()) {
      toast.error("Name, role and email are required");
      return;
    }
    updateStaff(member!.id, {
      name: form.name.trim(),
      role: form.role.trim(),
      department: form.department.trim(),
      companyId: form.companyId,
      email: form.email.trim(),
      phone: form.phone.trim(),
      status: form.status,
      joined: form.joined,
    });
    toast.success("Staff record updated");
    setOpen(false);
  }

  function handleDelete() {
    if (
      !window.confirm(
        `Remove ${member!.name} from the staff directory? This cannot be undone.`
      )
    ) {
      return;
    }
    removeStaff(member!.id);
    toast.success("Staff member removed");
    router.push("/staff");
  }

  const facts: Array<[string, string]> = [
    ["Role", member.role],
    ["Department", member.department],
    ["Company", company?.name ?? "Unassigned"],
    ["Managing director", company?.md ?? "—"],
    ["Joined", formatDate(member.joined)],
    ["Status", member.status === "on-leave" ? "On leave" : member.status === "contract" ? "Contract" : "Active"],
  ];

  return (
    <div>
      <Link
        href="/staff"
        className="mb-4 inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        All staff
      </Link>

      <PageHeader title={member.name} description={`${member.role} · ${member.department}`}>
        <StaffStatusBadge status={member.status} />
        <Dialog open={open} onOpenChange={openEditor}>
          <DialogTrigger asChild>
            <Button variant="outline">
              <Pencil className="h-3.5 w-3.5" />
              Edit
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit staff member</DialogTitle>
              <DialogDescription>
                Update the directory record for {member.name}.
              </DialogDescription>
            </DialogHeader>
            {form ? (
              <form onSubmit={handleSubmit} className="space-y-3">
                <div>
                  <Label htmlFor="edit-name">Full name</Label>
                  <Input
                    id="edit-name"
                    value={form.name}
                    onChange={(event) => setForm({ ...form, name: event.target.value })}
                    autoFocus
                  />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="edit-role">Role</Label>
                    <Input
                      id="edit-role"
                      value={form.role}
                      onChange={(event) => setForm({ ...form, role: event.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit-department">Department</Label>
                    <Input
                      id="edit-department"
                      value={form.department}
                      onChange={(event) =>
                        setForm({ ...form, department: event.target.value })
                      }
                    />
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="edit-company">Company</Label>
                    <Select
                      id="edit-company"
                      value={form.companyId}
                      onChange={(event) =>
                        setForm({ ...form, companyId: event.target.value })
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
                    <Label htmlFor="edit-status">Status</Label>
                    <Select
                      id="edit-status"
                      value={form.status}
                      onChange={(event) =>
                        setForm({
                          ...form,
                          status: event.target.value as StaffMember["status"],
                        })
                      }
                    >
                      <option value="active">Active</option>
                      <option value="on-leave">On leave</option>
                      <option value="contract">Contract</option>
                    </Select>
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="edit-email">Email</Label>
                    <Input
                      id="edit-email"
                      type="email"
                      value={form.email}
                      onChange={(event) => setForm({ ...form, email: event.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit-phone">Phone</Label>
                    <Input
                      id="edit-phone"
                      value={form.phone}
                      onChange={(event) => setForm({ ...form, phone: event.target.value })}
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="edit-joined">Joined</Label>
                  <Input
                    id="edit-joined"
                    type="date"
                    value={form.joined}
                    onChange={(event) => setForm({ ...form, joined: event.target.value })}
                  />
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit">Save changes</Button>
                </DialogFooter>
              </form>
            ) : null}
          </DialogContent>
        </Dialog>
        <Button variant="destructive" onClick={handleDelete}>
          <Trash2 className="h-3.5 w-3.5" />
          Remove
        </Button>
      </PageHeader>

      <div className="mb-4 flex flex-wrap items-center gap-x-5 gap-y-2 rounded-lg border border-border bg-card px-4 py-3 text-xs text-muted-foreground">
        {company ? (
          <span className="flex items-center gap-1.5">
            <CompanyMark company={company} size="sm" />
            <span className="font-semibold text-foreground">{company.shortName}</span>
          </span>
        ) : null}
        <span className="flex items-center gap-1.5">
          <Mail className="h-3.5 w-3.5" /> {member.email || "No email"}
        </span>
        <span className="flex items-center gap-1.5">
          <Phone className="h-3.5 w-3.5" /> {member.phone || "No phone"}
        </span>
        <span className="flex items-center gap-1.5">
          <CalendarDays className="h-3.5 w-3.5" /> Joined {formatDate(member.joined)}
        </span>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <div>
              <CardTitle>Employment record</CardTitle>
              <CardDescription>Directory details for this staff member</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            {facts.map(([label, value]) => (
              <div
                key={label}
                className="rounded-md border border-border px-3 py-2.5"
              >
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {label}
                </p>
                <p className="mt-0.5 text-xs font-semibold text-foreground">{value}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardTitle>Profile</CardTitle>
              <CardDescription>Group identity</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              <span className="grid h-12 w-12 place-items-center rounded-full bg-[#131313] text-sm font-bold text-white">
                {initials(member.name)}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-foreground">{member.name}</p>
                <p className="truncate text-xs text-muted-foreground">{member.role}</p>
              </div>
            </div>
            <div className="mt-4 space-y-3 text-xs">
              <div className="flex items-start justify-between gap-4 border-b border-border pb-2">
                <span className="text-muted-foreground">Email</span>
                <span className="text-right font-semibold text-foreground">
                  {member.email || "—"}
                </span>
              </div>
              <div className="flex items-start justify-between gap-4 border-b border-border pb-2">
                <span className="text-muted-foreground">Phone</span>
                <span className="text-right font-semibold text-foreground">
                  {member.phone || "—"}
                </span>
              </div>
              <div className="flex items-start justify-between gap-4 border-b border-border pb-2">
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <Building2 className="h-3.5 w-3.5" /> Company
                </span>
                <span className="text-right font-semibold text-foreground">
                  {company?.shortName ?? "—"}
                </span>
              </div>
              <div className="flex items-start justify-between gap-4">
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <UserRound className="h-3.5 w-3.5" /> Department
                </span>
                <span className="text-right font-semibold text-foreground">
                  {member.department}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
