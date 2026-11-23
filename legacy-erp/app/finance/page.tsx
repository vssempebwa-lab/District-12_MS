"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Check,
  Download,
  Plus,
  Receipt,
  Search,
  Trash2,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import {
  InvoiceStatusBadge,
  TransactionStatusBadge,
} from "@/components/entities";
import { Badge } from "@/components/ui/badge";
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useEntity } from "@/components/entity-provider";
import { useSystem } from "@/components/system-provider";
import { TODAY, type InvoiceStatus } from "@/lib/data";
import { formatDate, formatUGX } from "@/lib/format";

const categories = {
  income: ["Contracts", "Sales", "Rent", "Services", "Other income"],
  expense: [
    "Payroll",
    "Materials",
    "Fuel",
    "Utilities",
    "Marketing",
    "Maintenance",
    "Insurance",
    "Permits",
    "Equipment",
    "Other expense",
  ],
};

const csvCell = (value: string | number) =>
  `"${String(value).replace(/"/g, '""')}"`;

export default function FinancePage() {
  const {
    companies,
    contacts,
    transactions,
    invoices,
    addTransaction,
    updateTransaction,
    removeTransaction,
    addInvoice,
    setInvoiceStatus,
    removeInvoice,
  } = useSystem();
  const { entity } = useEntity();
  const [tab, setTab] = useState("all");
  const [query, setQuery] = useState("");
  const [companyFilter, setCompanyFilter] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const [form, setForm] = useState({
    type: "expense" as "income" | "expense",
    description: "",
    companyId: "passito",
    category: "Materials",
    amount: "",
    date: TODAY,
  });
  const [invoiceForm, setInvoiceForm] = useState({
    number: "",
    client: "",
    companyId: "passito",
    contactId: "",
    amount: "",
    issued: TODAY,
    due: TODAY,
    status: "pending" as InvoiceStatus,
  });

  const activeCompany = companyFilter ?? entity?.id ?? "all";

  useEffect(() => {
    setCompanyFilter(null);
  }, [entity?.id]);

  const scopedTransactions =
    activeCompany === "all"
      ? transactions
      : transactions.filter((transaction) => transaction.companyId === activeCompany);
  const scopedInvoices =
    activeCompany === "all"
      ? invoices
      : invoices.filter((invoice) => invoice.companyId === activeCompany);

  const income = scopedTransactions
    .filter((transaction) => transaction.type === "income")
    .reduce((sum, transaction) => sum + transaction.amount, 0);
  const expenses = scopedTransactions
    .filter((transaction) => transaction.type === "expense")
    .reduce((sum, transaction) => sum + transaction.amount, 0);
  const pending = scopedTransactions.filter((transaction) => transaction.status === "pending");

  const receivable = scopedInvoices
    .filter((invoice) => invoice.status !== "paid")
    .reduce((sum, invoice) => sum + invoice.amount, 0);
  const overdue = scopedInvoices.filter((invoice) => invoice.status === "overdue");

  const nextInvoiceNumber = useMemo(() => {
    const max = invoices.reduce((highest, invoice) => {
      const match = invoice.number.match(/(\d+)$/);
      return match ? Math.max(highest, Number(match[1])) : highest;
    }, 50);
    return `D12-2026-${String(max + 1).padStart(3, "0")}`;
  }, [invoices]);

  const filtered = useMemo(
    () =>
      [...transactions]
        .filter((transaction) => {
          const company = companies.find((item) => item.id === transaction.companyId);
          const matchesQuery = `${transaction.description} ${transaction.category} ${company?.name ?? ""}`
            .toLowerCase()
            .includes(query.toLowerCase());
          const matchesType = tab === "all" || transaction.type === tab;
          const matchesCompany =
            activeCompany === "all" || transaction.companyId === activeCompany;
          return matchesQuery && matchesType && matchesCompany;
        })
        .sort((a, b) => b.date.localeCompare(a.date)),
    [transactions, companies, query, tab, activeCompany]
  );

  const invoiceFiltered = useMemo(
    () =>
      invoices
        .filter((invoice) => {
          const company = companies.find((item) => item.id === invoice.companyId);
          const matchesQuery = `${invoice.number} ${invoice.client} ${company?.name ?? ""}`
            .toLowerCase()
            .includes(query.toLowerCase());
          const matchesCompany =
            activeCompany === "all" || invoice.companyId === activeCompany;
          return matchesQuery && matchesCompany;
        })
        .sort((a, b) => b.issued.localeCompare(a.issued)),
    [invoices, companies, query, activeCompany]
  );

  const showingInvoices = tab === "invoices";

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const amount = Number(form.amount);
    if (!form.description.trim() || !Number.isFinite(amount) || amount <= 0) {
      toast.error("Enter a description and a valid amount");
      return;
    }
    addTransaction({
      date: form.date,
      description: form.description.trim(),
      companyId: form.companyId,
      type: form.type,
      category: form.category,
      amount,
    });
    toast.success(`Entry recorded — ${formatUGX(amount)}`);
    setForm({
      type: "expense",
      description: "",
      companyId: "passito",
      category: "Materials",
      amount: "",
      date: TODAY,
    });
    setOpen(false);
  }

  function handleInvoiceSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const amount = Number(invoiceForm.amount);
    if (
      !invoiceForm.number.trim() ||
      !invoiceForm.client.trim() ||
      !Number.isFinite(amount) ||
      amount <= 0
    ) {
      toast.error("Invoice number, client and a valid amount are required");
      return;
    }
    addInvoice({
      number: invoiceForm.number.trim(),
      client: invoiceForm.client.trim(),
      companyId: invoiceForm.companyId,
      contactId: invoiceForm.contactId || undefined,
      amount,
      issued: invoiceForm.issued,
      due: invoiceForm.due,
      status: invoiceForm.status,
    });
    toast.success(`Invoice ${invoiceForm.number.trim()} created`);
    setInvoiceForm({
      number: "",
      client: "",
      companyId: "passito",
      contactId: "",
      amount: "",
      issued: TODAY,
      due: TODAY,
      status: "pending",
    });
    setInvoiceOpen(false);
  }

  function approveEntry(id: string) {
    updateTransaction(id, { status: "cleared" });
    toast.success("Entry approved");
  }

  function deleteEntry(id: string) {
    if (!window.confirm("Delete this ledger entry? This cannot be undone.")) return;
    removeTransaction(id);
    toast.success("Entry deleted");
  }

  function markPaid(id: string) {
    setInvoiceStatus(id, "paid");
    toast.success("Invoice marked as paid");
  }

  function deleteInvoice(id: string) {
    if (!window.confirm("Delete this invoice? This cannot be undone.")) return;
    removeInvoice(id);
    toast.success("Invoice deleted");
  }

  function exportCsv() {
    const lines: string[] = [];
    if (showingInvoices) {
      lines.push(
        ["Invoice", "Client", "Company", "Issued", "Due", "Status", "Amount"]
          .map(csvCell)
          .join(",")
      );
      invoiceFiltered.forEach((invoice) => {
        const company = companies.find((item) => item.id === invoice.companyId);
        lines.push(
          [
            invoice.number,
            invoice.client,
            company?.name ?? "",
            invoice.issued,
            invoice.due,
            invoice.status,
            invoice.amount,
          ]
            .map(csvCell)
            .join(",")
        );
      });
    } else {
      lines.push(
        ["Date", "Description", "Company", "Category", "Type", "Amount", "Status"]
          .map(csvCell)
          .join(",")
      );
      filtered.forEach((transaction) => {
        const company = companies.find((item) => item.id === transaction.companyId);
        lines.push(
          [
            transaction.date,
            transaction.description,
            company?.name ?? "",
            transaction.category,
            transaction.type,
            transaction.amount,
            transaction.status,
          ]
            .map(csvCell)
            .join(",")
        );
      });
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = showingInvoices ? "d12-invoices.csv" : "d12-ledger.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <PageHeader
        title={entity ? `${entity.shortName} finance` : "Finance"}
        description={
          entity
            ? `Income, expenditure and invoices for ${entity.name}.`
            : "Income, expenditure, invoices and transaction control across the group."
        }
      >
        <Dialog
          open={invoiceOpen}
          onOpenChange={(next) => {
            setInvoiceOpen(next);
            if (next) {
              setInvoiceForm((current) => ({
                ...current,
                number: current.number || nextInvoiceNumber,
              }));
            }
          }}
        >
          <DialogTrigger asChild>
            <Button variant="outline">
              <Receipt className="h-3.5 w-3.5" />
              New invoice
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create invoice</DialogTitle>
              <DialogDescription>
                Raise a client invoice against a subsidiary.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleInvoiceSubmit} className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label htmlFor="invoice-number">Invoice number</Label>
                  <Input
                    id="invoice-number"
                    value={invoiceForm.number}
                    onChange={(event) =>
                      setInvoiceForm({ ...invoiceForm, number: event.target.value })
                    }
                    placeholder="D12-2026-051"
                    autoFocus
                  />
                </div>
                <div>
                  <Label htmlFor="invoice-company">Company</Label>
                  <Select
                    id="invoice-company"
                    value={invoiceForm.companyId}
                    onChange={(event) =>
                      setInvoiceForm({ ...invoiceForm, companyId: event.target.value })
                    }
                  >
                    {companies.map((company) => (
                      <option key={company.id} value={company.id}>
                        {company.shortName}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>

              <div>
                <Label htmlFor="invoice-client">Client</Label>
                <Input
                  id="invoice-client"
                  value={invoiceForm.client}
                  onChange={(event) =>
                    setInvoiceForm({ ...invoiceForm, client: event.target.value })
                  }
                  placeholder="e.g. Kampala Water"
                />
              </div>

              <div>
                <Label htmlFor="invoice-contact">CRM contact (optional)</Label>
                <Select
                  id="invoice-contact"
                  value={invoiceForm.contactId}
                  onChange={(event) => {
                    const contact = contacts.find(
                      (item) => item.id === event.target.value
                    );
                    setInvoiceForm({
                      ...invoiceForm,
                      contactId: event.target.value,
                      client: contact ? contact.organization : invoiceForm.client,
                      companyId: contact ? contact.companyId : invoiceForm.companyId,
                    });
                  }}
                >
                  <option value="">No linked contact</option>
                  {contacts.map((contact) => (
                    <option key={contact.id} value={contact.id}>
                      {contact.name} — {contact.organization}
                    </option>
                  ))}
                </Select>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <Label htmlFor="invoice-amount">Amount (UGX)</Label>
                  <Input
                    id="invoice-amount"
                    type="number"
                    min={1}
                    value={invoiceForm.amount}
                    onChange={(event) =>
                      setInvoiceForm({ ...invoiceForm, amount: event.target.value })
                    }
                    placeholder="e.g. 120000000"
                  />
                </div>
                <div>
                  <Label htmlFor="invoice-issued">Issued</Label>
                  <Input
                    id="invoice-issued"
                    type="date"
                    value={invoiceForm.issued}
                    onChange={(event) =>
                      setInvoiceForm({ ...invoiceForm, issued: event.target.value })
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="invoice-due">Due</Label>
                  <Input
                    id="invoice-due"
                    type="date"
                    value={invoiceForm.due}
                    onChange={(event) =>
                      setInvoiceForm({ ...invoiceForm, due: event.target.value })
                    }
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="invoice-status">Status</Label>
                <Select
                  id="invoice-status"
                  value={invoiceForm.status}
                  onChange={(event) =>
                    setInvoiceForm({
                      ...invoiceForm,
                      status: event.target.value as InvoiceStatus,
                    })
                  }
                >
                  <option value="pending">Pending</option>
                  <option value="overdue">Overdue</option>
                  <option value="paid">Paid</option>
                </Select>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setInvoiceOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">Create invoice</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-3.5 w-3.5" />
              Record entry
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Record transaction</DialogTitle>
              <DialogDescription>
                Add an income or expense entry to the group ledger.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                {(["income", "expense"] as const).map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() =>
                      setForm({
                        ...form,
                        type,
                        category:
                          type === "income" ? categories.income[0] : categories.expense[0],
                      })
                    }
                    className={
                      form.type === type
                        ? "rounded-md border border-primary bg-accent px-3 py-2 text-xs font-semibold text-accent-foreground"
                        : "rounded-md border border-border bg-card px-3 py-2 text-xs font-semibold text-muted-foreground hover:bg-secondary"
                    }
                  >
                    {type === "income" ? "Income" : "Expense"}
                  </button>
                ))}
              </div>

              <div>
                <Label htmlFor="tx-description">Description</Label>
                <Input
                  id="tx-description"
                  value={form.description}
                  onChange={(event) =>
                    setForm({ ...form, description: event.target.value })
                  }
                  placeholder="e.g. Client payment — Nakawa warehouse"
                  autoFocus
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label htmlFor="tx-company">Company</Label>
                  <Select
                    id="tx-company"
                    value={form.companyId}
                    onChange={(event) =>
                      setForm({ ...form, companyId: event.target.value })
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
                  <Label htmlFor="tx-category">Category</Label>
                  <Select
                    id="tx-category"
                    value={form.category}
                    onChange={(event) =>
                      setForm({ ...form, category: event.target.value })
                    }
                  >
                    {categories[form.type].map((category) => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label htmlFor="tx-amount">Amount (UGX)</Label>
                  <Input
                    id="tx-amount"
                    type="number"
                    min={1}
                    value={form.amount}
                    onChange={(event) => setForm({ ...form, amount: event.target.value })}
                    placeholder="e.g. 45000000"
                  />
                </div>
                <div>
                  <Label htmlFor="tx-date">Date</Label>
                  <Input
                    id="tx-date"
                    type="date"
                    value={form.date}
                    onChange={(event) => setForm({ ...form, date: event.target.value })}
                  />
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">Save entry</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </PageHeader>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total income" value={formatUGX(income)} icon={ArrowDownLeft} hint="recorded entries" tone="green" />
        <StatCard label="Total expenses" value={formatUGX(expenses)} icon={ArrowUpRight} hint="recorded entries" tone="brand" />
        <StatCard
          label="Net position"
          value={formatUGX(income - expenses, { signed: true })}
          icon={Wallet}
          hint="income less expenses"
          tone="blue"
        />
        <StatCard
          label="Receivables"
          value={formatUGX(receivable)}
          icon={Receipt}
          hint={`${overdue.length} overdue · ${pending.length} entries pending`}
          tone="amber"
        />
      </div>

      <Card className="mt-4">
        <CardContent className="p-0">
          <div className="flex flex-col gap-2 border-b border-border p-3 lg:flex-row lg:items-center lg:justify-between">
            <Tabs value={tab} onValueChange={setTab}>
              <TabsList>
                <TabsTrigger value="all">All entries</TabsTrigger>
                <TabsTrigger value="income">Income</TabsTrigger>
                <TabsTrigger value="expense">Expenses</TabsTrigger>
                <TabsTrigger value="invoices">Invoices</TabsTrigger>
              </TabsList>
            </Tabs>
            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="relative flex-1 sm:w-56">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={showingInvoices ? "Search invoices" : "Search transactions"}
                  className="pl-8"
                  aria-label={showingInvoices ? "Search invoices" : "Search transactions"}
                />
              </div>
              <Select
                value={activeCompany}
                onChange={(event) => setCompanyFilter(event.target.value)}
                className="sm:w-40"
                aria-label="Filter by company"
              >
                <option value="all">All companies</option>
                {companies.map((company) => (
                  <option key={company.id} value={company.id}>
                    {company.shortName}
                  </option>
                ))}
              </Select>
              <Button variant="outline" onClick={exportCsv}>
                <Download className="h-3.5 w-3.5" />
                Export
              </Button>
            </div>
          </div>

          {showingInvoices ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice</TableHead>
                  <TableHead className="hidden md:table-cell">Company</TableHead>
                  <TableHead className="hidden sm:table-cell">Issued</TableHead>
                  <TableHead>Due</TableHead>
                  <TableHead className="text-right">Status</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoiceFiltered.map((invoice) => {
                  const company = companies.find(
                    (item) => item.id === invoice.companyId
                  );
                  return (
                    <TableRow key={invoice.id}>
                      <TableCell>
                        <p className="text-xs font-semibold text-foreground">
                          {invoice.number}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {invoice.client}
                        </p>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <span className="text-xs text-muted-foreground">
                          {company?.shortName}
                        </span>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <span className="text-xs text-muted-foreground">
                          {formatDate(invoice.issued)}
                        </span>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        <span className="text-xs text-muted-foreground">
                          {formatDate(invoice.due)}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <InvoiceStatusBadge status={invoice.status} />
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="whitespace-nowrap text-xs font-semibold text-foreground">
                          {formatUGX(invoice.amount)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          {invoice.status !== "paid" ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => markPaid(invoice.id)}
                              title="Mark as paid"
                            >
                              <Check className="h-3.5 w-3.5" />
                              Paid
                            </Button>
                          ) : null}
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => deleteInvoice(invoice.id)}
                            title="Delete invoice"
                            aria-label={`Delete invoice ${invoice.number}`}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {invoiceFiltered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-10 text-center">
                      <p className="text-sm font-semibold text-foreground">
                        No invoices found
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Try clearing the filters or create a new invoice.
                      </p>
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="hidden md:table-cell">Company</TableHead>
                <TableHead className="hidden sm:table-cell">Category</TableHead>
                <TableHead className="text-right">Type</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="hidden text-right lg:table-cell">Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((transaction) => {
                const company = companies.find(
                  (item) => item.id === transaction.companyId
                );
                return (
                  <TableRow key={transaction.id}>
                    <TableCell className="whitespace-nowrap">
                      <span className="text-xs text-muted-foreground">
                        {formatDate(transaction.date)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <p className="max-w-[260px] truncate text-xs font-medium text-foreground">
                        {transaction.description}
                      </p>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <span className="text-xs text-muted-foreground">
                        {company?.shortName}
                      </span>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <Badge variant="outline">{transaction.category}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <span
                        className={
                          transaction.type === "income"
                            ? "text-[11px] font-semibold text-emerald-700"
                            : "text-[11px] font-semibold text-red-700"
                        }
                      >
                        {transaction.type === "income" ? "Income" : "Expense"}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <span
                        className={
                          transaction.type === "income"
                            ? "whitespace-nowrap text-xs font-semibold text-emerald-700"
                            : "whitespace-nowrap text-xs font-semibold text-red-700"
                        }
                      >
                        {transaction.type === "income" ? "+" : "−"}
                        {formatUGX(transaction.amount).replace("UGX ", "")}
                      </span>
                    </TableCell>
                    <TableCell className="hidden text-right lg:table-cell">
                      <TransactionStatusBadge status={transaction.status} />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        {transaction.status === "pending" ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => approveEntry(transaction.id)}
                            title="Approve entry"
                          >
                            <Check className="h-3.5 w-3.5" />
                            Approve
                          </Button>
                        ) : null}
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => deleteEntry(transaction.id)}
                          title="Delete entry"
                          aria-label={`Delete ${transaction.description}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="py-10 text-center">
                    <p className="text-sm font-semibold text-foreground">
                      No transactions found
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Try clearing the filters or record a new entry.
                    </p>
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
          )}
        </CardContent>
      </Card>

      <p className="mt-3 text-[11px] text-muted-foreground">
        {showingInvoices
          ? `Showing ${invoiceFiltered.length} of ${invoices.length} invoices.`
          : `Showing ${filtered.length} of ${transactions.length} entries.`}
      </p>
    </div>
  );
}
