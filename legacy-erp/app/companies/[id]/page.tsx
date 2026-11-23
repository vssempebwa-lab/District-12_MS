"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Building2,
  MapPin,
  Pencil,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { GroupTrendChart } from "@/components/charts";
import {
  CompanyMark,
  CompanyStatusBadge,
  StaffStatusBadge,
  TransactionStatusBadge,
} from "@/components/entities";
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
import { seriesForCompany, type Company } from "@/lib/data";
import { formatDate, formatPercent, formatUGX } from "@/lib/format";

export default function CompanyDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const { companies, staff, transactions, updateCompany } = useSystem();
  const company = companies.find((item) => item.id === params.id);
  const [editOpen, setEditOpen] = useState(false);
  const [draft, setDraft] = useState<Company | null>(null);

  if (!company) {
    return (
      <div className="rounded-lg border border-border bg-card p-10 text-center">
        <p className="text-sm font-semibold text-foreground">Company not found</p>
        <p className="mt-1 text-xs text-muted-foreground">
          This subsidiary does not exist in the group register.
        </p>
        <Link href="/companies" className="mt-4 inline-block">
          <Button variant="outline">Back to companies</Button>
        </Link>
      </div>
    );
  }

  const companyStaff = staff.filter((member) => member.companyId === company.id);
  const companyTransactions = [...transactions]
    .filter((transaction) => transaction.companyId === company.id)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 6);
  const series = seriesForCompany(company);
  const margin = company.revenue ? (company.profit / company.revenue) * 100 : 0;

  function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft || !company) return;
    const revenue = Number(draft.revenue);
    const expenses = Number(draft.expenses);
    if (!draft.name.trim() || !draft.shortName.trim() || !draft.sector.trim()) {
      toast.error("Name, short label and sector are required");
      return;
    }
    if (
      !Number.isFinite(revenue) ||
      revenue < 0 ||
      !Number.isFinite(expenses) ||
      expenses < 0
    ) {
      toast.error("Revenue and expenses must be valid amounts");
      return;
    }
    updateCompany(company.id, {
      ...draft,
      revenue,
      expenses,
      profit: revenue - expenses,
    });
    toast.success("Company profile updated");
    setEditOpen(false);
  }

  return (
    <div>
      <Link
        href="/companies"
        className="mb-4 inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        All companies
      </Link>

      <PageHeader
        title={company.name}
        description={company.description}
      >
        <CompanyStatusBadge status={company.status} />
        <Dialog
          open={editOpen}
          onOpenChange={(next) => {
            setEditOpen(next);
            if (next) setDraft(company);
          }}
        >
          <DialogTrigger asChild>
            <Button variant="outline">
              <Pencil className="h-3.5 w-3.5" />
              Edit company
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit company</DialogTitle>
              <DialogDescription>
                Update registry details and reported financials.
              </DialogDescription>
            </DialogHeader>
            {draft ? (
              <form onSubmit={handleSave} className="space-y-3">
                <div>
                  <Label htmlFor="company-name">Legal name</Label>
                  <Input
                    id="company-name"
                    value={draft.name}
                    onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                    autoFocus
                  />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="company-short">Short label</Label>
                    <Input
                      id="company-short"
                      value={draft.shortName}
                      onChange={(event) =>
                        setDraft({ ...draft, shortName: event.target.value })
                      }
                    />
                  </div>
                  <div>
                    <Label htmlFor="company-sector">Sector</Label>
                    <Input
                      id="company-sector"
                      value={draft.sector}
                      onChange={(event) =>
                        setDraft({ ...draft, sector: event.target.value })
                      }
                    />
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="company-md">Managing director</Label>
                    <Input
                      id="company-md"
                      value={draft.md}
                      onChange={(event) => setDraft({ ...draft, md: event.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="company-location">Head office</Label>
                    <Input
                      id="company-location"
                      value={draft.location}
                      onChange={(event) =>
                        setDraft({ ...draft, location: event.target.value })
                      }
                    />
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div>
                    <Label htmlFor="company-founded">Founded</Label>
                    <Input
                      id="company-founded"
                      type="number"
                      value={draft.founded}
                      onChange={(event) =>
                        setDraft({ ...draft, founded: Number(event.target.value) || 0 })
                      }
                    />
                  </div>
                  <div>
                    <Label htmlFor="company-staff">Employees</Label>
                    <Input
                      id="company-staff"
                      type="number"
                      min={0}
                      value={draft.staff}
                      onChange={(event) =>
                        setDraft({ ...draft, staff: Number(event.target.value) || 0 })
                      }
                    />
                  </div>
                  <div>
                    <Label htmlFor="company-status">Status</Label>
                    <Select
                      id="company-status"
                      value={draft.status}
                      onChange={(event) =>
                        setDraft({
                          ...draft,
                          status: event.target.value as Company["status"],
                        })
                      }
                    >
                      <option value="active">Active</option>
                      <option value="review">Under review</option>
                    </Select>
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="company-revenue">YTD revenue (UGX)</Label>
                    <Input
                      id="company-revenue"
                      type="number"
                      min={0}
                      value={draft.revenue}
                      onChange={(event) =>
                        setDraft({ ...draft, revenue: Number(event.target.value) || 0 })
                      }
                    />
                  </div>
                  <div>
                    <Label htmlFor="company-expenses">Operating expenses (UGX)</Label>
                    <Input
                      id="company-expenses"
                      type="number"
                      min={0}
                      value={draft.expenses}
                      onChange={(event) =>
                        setDraft({ ...draft, expenses: Number(event.target.value) || 0 })
                      }
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="company-growth">Revenue growth (%)</Label>
                  <Input
                    id="company-growth"
                    type="number"
                    step="0.1"
                    value={draft.growth}
                    onChange={(event) =>
                      setDraft({ ...draft, growth: Number(event.target.value) || 0 })
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="company-description">Description</Label>
                  <textarea
                    id="company-description"
                    value={draft.description}
                    onChange={(event) =>
                      setDraft({ ...draft, description: event.target.value })
                    }
                    rows={3}
                    className="w-full rounded-md border border-input bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
                  />
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
      </PageHeader>

      <div className="mb-4 flex flex-wrap items-center gap-x-5 gap-y-2 rounded-lg border border-border bg-card px-4 py-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <CompanyMark company={company} size="sm" />
          <span className="font-semibold text-foreground">{company.sector}</span>
        </span>
        <span className="flex items-center gap-1.5">
          <Users className="h-3.5 w-3.5" /> {company.md} · Managing Director
        </span>
        <span className="flex items-center gap-1.5">
          <MapPin className="h-3.5 w-3.5" /> {company.location}
        </span>
        <span className="flex items-center gap-1.5">
          <Building2 className="h-3.5 w-3.5" /> Founded {company.founded}
        </span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="YTD revenue"
          value={formatUGX(company.revenue)}
          delta={company.growth}
          hint="year on year"
          icon={TrendingUp}
          tone="green"
        />
        <StatCard
          label="Operating expenses"
          value={formatUGX(company.expenses)}
          hint={`${formatPercent(company.revenue ? (company.expenses / company.revenue) * 100 : 0)} of revenue`}
          icon={Wallet}
          tone="brand"
        />
        <StatCard
          label="Net profit"
          value={formatUGX(company.profit)}
          hint={`${formatPercent(margin)} margin`}
          icon={TrendingUp}
          tone="blue"
        />
        <StatCard
          label="Headcount"
          value={String(company.staff)}
          hint={`${companyStaff.length} in directory`}
          icon={Users}
          tone="violet"
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <div>
              <CardTitle>Monthly performance</CardTitle>
              <CardDescription>Revenue and expenses, UGX</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <GroupTrendChart data={series} height={240} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardTitle>Company facts</CardTitle>
              <CardDescription>Registry details</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 text-xs">
            {[
              ["Legal name", company.name],
              ["Sector", company.sector],
              ["Managing director", company.md],
              ["Head office", company.location],
              ["Founded", String(company.founded)],
              ["Employees", String(company.staff)],
              ["Revenue growth", `${company.growth >= 0 ? "+" : ""}${company.growth.toFixed(1)}%`],
              ["Profit margin", formatPercent(margin)],
            ].map(([label, value]) => (
              <div key={label} className="flex items-start justify-between gap-4 border-b border-border pb-2 last:border-0 last:pb-0">
                <span className="text-muted-foreground">{label}</span>
                <span className="text-right font-semibold text-foreground">{value}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Team directory</CardTitle>
              <CardDescription>Staff recorded against this company</CardDescription>
            </div>
            <Link
              href="/staff"
              className="text-xs font-semibold text-primary hover:underline"
            >
              Manage staff
            </Link>
          </CardHeader>
          <CardContent className="px-0 pb-0 pt-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead className="hidden sm:table-cell">Role</TableHead>
                  <TableHead className="text-right">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {companyStaff.map((member) => (
                  <TableRow key={member.id}>
                    <TableCell>
                      <p className="text-xs font-semibold text-foreground">{member.name}</p>
                      <p className="text-[11px] text-muted-foreground">{member.department}</p>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <span className="text-xs text-muted-foreground">{member.role}</span>
                    </TableCell>
                    <TableCell className="text-right">
                      <StaffStatusBadge status={member.status} />
                    </TableCell>
                  </TableRow>
                ))}
                {companyStaff.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="py-8 text-center text-xs text-muted-foreground">
                      No staff records yet.
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
              <CardTitle>Recent transactions</CardTitle>
              <CardDescription>Latest entries for {company.shortName}</CardDescription>
            </div>
            <Link
              href="/finance"
              className="text-xs font-semibold text-primary hover:underline"
            >
              Open finance
            </Link>
          </CardHeader>
          <CardContent className="px-0 pb-0 pt-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Description</TableHead>
                  <TableHead className="hidden sm:table-cell">Date</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="hidden text-right md:table-cell">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {companyTransactions.map((transaction) => (
                  <TableRow key={transaction.id}>
                    <TableCell>
                      <p className="max-w-[180px] truncate text-xs font-medium text-foreground">
                        {transaction.description}
                      </p>
                      <p className="text-[11px] text-muted-foreground">{transaction.category}</p>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <span className="text-xs text-muted-foreground">
                        {formatDate(transaction.date)}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <span
                        className={
                          transaction.type === "income"
                            ? "text-xs font-semibold text-emerald-700"
                            : "text-xs font-semibold text-red-700"
                        }
                      >
                        {transaction.type === "income" ? "+" : "−"}
                        {formatUGX(transaction.amount).replace("UGX ", "")}
                      </span>
                    </TableCell>
                    <TableCell className="hidden text-right md:table-cell">
                      <TransactionStatusBadge status={transaction.status} />
                    </TableCell>
                  </TableRow>
                ))}
                {companyTransactions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="py-8 text-center text-xs text-muted-foreground">
                      No transactions recorded.
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
