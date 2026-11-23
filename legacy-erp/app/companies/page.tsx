"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { ArrowUpRight, Plus, Search } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { CompanyMark, CompanyStatusBadge } from "@/components/entities";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useSystem } from "@/components/system-provider";
import { formatUGX } from "@/lib/format";
import type { CompanyStatus } from "@/lib/data";

const COLOR_CHOICES = ["#DB2777", "#0F766E", "#BE185D", "#1D4ED8", "#B45309", "#334155"];

const emptyCompany = {
  name: "",
  shortName: "",
  sector: "",
  md: "",
  location: "",
  description: "",
  color: COLOR_CHOICES[5],
  status: "active" as CompanyStatus,
};

export default function CompaniesPage() {
  const { companies, addCompany } = useSystem();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyCompany);

  const filtered = useMemo(
    () =>
      companies.filter((company) => {
        const matchesQuery = `${company.name} ${company.sector} ${company.md} ${company.location}`
          .toLowerCase()
          .includes(query.toLowerCase());
        const matchesStatus = status === "all" || company.status === status;
        return matchesQuery && matchesStatus;
      }),
    [companies, query, status]
  );

  function openDialog(next: boolean) {
    setOpen(next);
    if (next) setForm(emptyCompany);
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form.name.trim()) return;
    const company = addCompany({
      ...form,
      founded: new Date().getFullYear(),
    });
    setOpen(false);
    setForm(emptyCompany);
    router.push(`/companies/${company.id}`);
  }

  return (
    <div>
      <PageHeader
        title="Companies"
        description="The District 12 portfolio — performance, leadership and headcount."
      >
        <Dialog open={open} onOpenChange={openDialog}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-3.5 w-3.5" />
              New subsidiary
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create a subsidiary</DialogTitle>
              <DialogDescription>
                Registers a new company under District 12 with its own isolated workspace.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <Label htmlFor="company-name">Company name</Label>
                <Input
                  id="company-name"
                  value={form.name}
                  onChange={(event) => setForm({ ...form, name: event.target.value })}
                  placeholder="e.g. District 12 Logistics"
                  autoFocus
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label htmlFor="company-short">Short name</Label>
                  <Input
                    id="company-short"
                    value={form.shortName}
                    onChange={(event) =>
                      setForm({ ...form, shortName: event.target.value })
                    }
                    placeholder="e.g. D12 Logistics"
                  />
                </div>
                <div>
                  <Label htmlFor="company-sector">Sector</Label>
                  <Input
                    id="company-sector"
                    value={form.sector}
                    onChange={(event) => setForm({ ...form, sector: event.target.value })}
                    placeholder="e.g. Logistics"
                  />
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label htmlFor="company-md">Managing director</Label>
                  <Input
                    id="company-md"
                    value={form.md}
                    onChange={(event) => setForm({ ...form, md: event.target.value })}
                    placeholder="e.g. Alex Mugisha"
                  />
                </div>
                <div>
                  <Label htmlFor="company-location">Location</Label>
                  <Input
                    id="company-location"
                    value={form.location}
                    onChange={(event) =>
                      setForm({ ...form, location: event.target.value })
                    }
                    placeholder="e.g. Namanve, Kampala"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="company-description">Description</Label>
                <Input
                  id="company-description"
                  value={form.description}
                  onChange={(event) =>
                    setForm({ ...form, description: event.target.value })
                  }
                  placeholder="What the subsidiary does"
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label htmlFor="company-status">Status</Label>
                  <Select
                    id="company-status"
                    value={form.status}
                    onChange={(event) =>
                      setForm({ ...form, status: event.target.value as CompanyStatus })
                    }
                  >
                    <option value="active">Active</option>
                    <option value="review">Under review</option>
                  </Select>
                </div>
                <div>
                  <Label>Brand colour</Label>
                  <div className="mt-1.5 flex items-center gap-1.5">
                    {COLOR_CHOICES.map((color) => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => setForm({ ...form, color })}
                        aria-label={`Use colour ${color}`}
                        aria-pressed={form.color === color}
                        className={`h-7 w-7 rounded-md border-2 transition ${
                          form.color === color
                            ? "border-foreground"
                            : "border-transparent"
                        }`}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={!form.name.trim()}>
                  Create subsidiary
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
        <div className="relative w-full sm:w-64">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search companies"
            className="pl-8"
            aria-label="Search companies"
          />
        </div>
        <Select
          value={status}
          onChange={(event) => setStatus(event.target.value)}
          className="w-40"
          aria-label="Filter by status"
        >
          <option value="all">All statuses</option>
          <option value="active">Active</option>
          <option value="review">Under review</option>
        </Select>
      </PageHeader>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {filtered.map((company) => (
          <Link
            key={company.id}
            href={`/companies/${company.id}`}
            className="group flex flex-col rounded-lg border border-border bg-card p-4 shadow-sm transition-all hover:border-primary/40 hover:shadow-md"
          >
            <div className="flex items-start justify-between gap-3">
              <CompanyMark company={company} size="lg" />
              <CompanyStatusBadge status={company.status} />
            </div>

            <h3 className="mt-3 text-sm font-bold leading-snug text-foreground group-hover:text-primary">
              {company.name}
            </h3>
            <p className="mt-0.5 text-xs text-muted-foreground">{company.sector}</p>
            <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
              {company.description || "No description yet."}
            </p>

            <div className="mt-3 grid grid-cols-2 gap-2 border-t border-border pt-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  YTD revenue
                </p>
                <p className="mt-0.5 text-sm font-bold text-foreground">
                  {formatUGX(company.revenue)}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Net profit
                </p>
                <p className="mt-0.5 text-sm font-bold text-foreground">
                  {formatUGX(company.profit)}
                </p>
              </div>
            </div>

            <div className="mt-3 flex items-center justify-between border-t border-border pt-3 text-[11px]">
              <span className="text-muted-foreground">
                {company.staff} staff · {company.md}
              </span>
              <span className="inline-flex items-center gap-1 font-semibold text-primary">
                Profile
                <ArrowUpRight className="h-3 w-3" />
              </span>
            </div>
          </Link>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-card p-10 text-center">
          <p className="text-sm font-semibold text-foreground">No companies found</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Try a different search term or status filter.
          </p>
        </div>
      ) : null}
    </div>
  );
}
