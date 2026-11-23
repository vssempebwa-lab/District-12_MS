"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  AlertTriangle,
  Boxes,
  Package,
  Pencil,
  Plus,
  Search,
  Trash2,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { CompanyMark } from "@/components/entities";
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
import { formatDate, formatNumber, formatUGX } from "@/lib/format";
import type { InventoryItem } from "@/lib/data";

const emptyForm = {
  sku: "",
  name: "",
  category: "",
  companyId: "passito",
  quantity: "0",
  reorderLevel: "0",
  unitCost: "0",
  supplier: "",
};

function stockState(item: InventoryItem) {
  if (item.quantity === 0) return "out" as const;
  if (item.quantity <= item.reorderLevel) return "low" as const;
  return "in" as const;
}

function StockBadge({ item }: { item: InventoryItem }) {
  const state = stockState(item);
  if (state === "out") return <Badge variant="danger">Out of stock</Badge>;
  if (state === "low") return <Badge variant="warning">Low stock</Badge>;
  return <Badge variant="success">In stock</Badge>;
}

export default function InventoryPage() {
  const { companies, inventory, addInventoryItem, updateInventoryItem, removeInventoryItem } =
    useSystem();
  const { entity } = useEntity();
  const [query, setQuery] = useState("");
  const [companyFilter, setCompanyFilter] = useState<string | null>(null);
  const [stockFilter, setStockFilter] = useState("all");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<InventoryItem | null>(null);
  const [form, setForm] = useState(emptyForm);

  const activeCompany = companyFilter ?? entity?.id ?? "all";

  useEffect(() => {
    setCompanyFilter(null);
  }, [entity?.id]);

  const filtered = useMemo(
    () =>
      inventory
        .filter((item) => {
          const company = companies.find((entry) => entry.id === item.companyId);
          const haystack = `${item.name} ${item.sku} ${item.category} ${item.supplier} ${company?.name ?? ""}`;
          const state = stockState(item);
          return (
            haystack.toLowerCase().includes(query.toLowerCase()) &&
            (activeCompany === "all" || item.companyId === activeCompany) &&
            (stockFilter === "all" || state === stockFilter)
          );
        })
        .sort((a, b) => a.name.localeCompare(b.name)),
    [inventory, companies, query, activeCompany, stockFilter]
  );

  const scoped = useMemo(
    () =>
      activeCompany === "all"
        ? inventory
        : inventory.filter((item) => item.companyId === activeCompany),
    [inventory, activeCompany]
  );

  const totals = useMemo(
    () => ({
      items: scoped.length,
      units: scoped.reduce((sum, item) => sum + item.quantity, 0),
      value: scoped.reduce((sum, item) => sum + item.quantity * item.unitCost, 0),
      low: scoped.filter((item) => stockState(item) !== "in").length,
    }),
    [scoped]
  );

  function openAdd() {
    setEditing(null);
    setForm({
      ...emptyForm,
      companyId: activeCompany === "all" ? companies[0]?.id ?? "passito" : activeCompany,
    });
    setOpen(true);
  }

  function openEdit(item: InventoryItem) {
    setEditing(item);
    setForm({
      sku: item.sku,
      name: item.name,
      category: item.category,
      companyId: item.companyId,
      quantity: String(item.quantity),
      reorderLevel: String(item.reorderLevel),
      unitCost: String(item.unitCost),
      supplier: item.supplier,
    });
    setOpen(true);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const quantity = Number(form.quantity);
    const reorderLevel = Number(form.reorderLevel);
    const unitCost = Number(form.unitCost);
    if (!form.name.trim() || !form.sku.trim() || !form.category.trim()) {
      toast.error("Name, SKU and category are required");
      return;
    }
    if (
      !Number.isFinite(quantity) ||
      !Number.isFinite(reorderLevel) ||
      !Number.isFinite(unitCost) ||
      quantity < 0 ||
      reorderLevel < 0 ||
      unitCost < 0
    ) {
      toast.error("Stock quantities and cost must be zero or greater");
      return;
    }
    const input = {
      sku: form.sku.trim(),
      name: form.name.trim(),
      category: form.category.trim(),
      companyId: form.companyId,
      quantity,
      reorderLevel,
      unitCost,
      supplier: form.supplier.trim(),
    };
    if (editing) {
      updateInventoryItem(editing.id, input);
      toast.success(`${input.name} updated`);
    } else {
      addInventoryItem(input);
      toast.success(`${input.name} added to ${companies.find((c) => c.id === input.companyId)?.shortName ?? "inventory"}`);
    }
    setOpen(false);
    setEditing(null);
    setForm(emptyForm);
  }

  function handleDelete(item: InventoryItem) {
    if (!window.confirm(`Delete “${item.name}” from inventory? This cannot be undone.`)) {
      return;
    }
    removeInventoryItem(item.id);
    toast.success(`${item.name} removed`);
  }

  return (
    <div>
      <PageHeader
        title="Inventory & supply"
        description={
          entity
            ? `Stock held by ${entity.name}.`
            : "Stock levels and supply across all District 12 subsidiaries."
        }
      >
        <Dialog
          open={open}
          onOpenChange={(next) => {
            setOpen(next);
            if (!next) setEditing(null);
          }}
        >
          <DialogTrigger asChild>
            <Button onClick={openAdd}>
              <Plus className="h-3.5 w-3.5" />
              Add item
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editing ? "Edit inventory item" : "Add inventory item"}</DialogTitle>
              <DialogDescription>
                {editing
                  ? "Update stock levels, reorder point or supplier."
                  : "Register a stock item for one of the group subsidiaries."}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label htmlFor="item-name">Item name</Label>
                  <Input
                    id="item-name"
                    value={form.name}
                    onChange={(event) => setForm({ ...form, name: event.target.value })}
                    placeholder="e.g. Cement 50kg"
                    autoFocus
                  />
                </div>
                <div>
                  <Label htmlFor="item-sku">SKU</Label>
                  <Input
                    id="item-sku"
                    value={form.sku}
                    onChange={(event) => setForm({ ...form, sku: event.target.value })}
                    placeholder="e.g. CEM-50"
                  />
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label htmlFor="item-category">Category</Label>
                  <Input
                    id="item-category"
                    value={form.category}
                    onChange={(event) => setForm({ ...form, category: event.target.value })}
                    placeholder="e.g. Construction materials"
                  />
                </div>
                <div>
                  <Label htmlFor="item-company">Subsidiary</Label>
                  <Select
                    id="item-company"
                    value={form.companyId}
                    onChange={(event) => setForm({ ...form, companyId: event.target.value })}
                  >
                    {companies.map((company) => (
                      <option key={company.id} value={company.id}>
                        {company.name}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <Label htmlFor="item-quantity">Quantity</Label>
                  <Input
                    id="item-quantity"
                    type="number"
                    min={0}
                    value={form.quantity}
                    onChange={(event) => setForm({ ...form, quantity: event.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="item-reorder">Reorder level</Label>
                  <Input
                    id="item-reorder"
                    type="number"
                    min={0}
                    value={form.reorderLevel}
                    onChange={(event) =>
                      setForm({ ...form, reorderLevel: event.target.value })
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="item-cost">Unit cost (UGX)</Label>
                  <Input
                    id="item-cost"
                    type="number"
                    min={0}
                    value={form.unitCost}
                    onChange={(event) => setForm({ ...form, unitCost: event.target.value })}
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="item-supplier">Supplier</Label>
                <Input
                  id="item-supplier"
                  value={form.supplier}
                  onChange={(event) => setForm({ ...form, supplier: event.target.value })}
                  placeholder="e.g. Hima Cement"
                />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">{editing ? "Save changes" : "Add item"}</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </PageHeader>

      <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: "Stock value",
            value: formatUGX(totals.value),
            icon: Wallet,
            chip: "bg-emerald-50 text-emerald-700",
          },
          {
            label: "Units on hand",
            value: formatNumber(totals.units),
            icon: Boxes,
            chip: "bg-blue-50 text-blue-700",
          },
          {
            label: "Items tracked",
            value: formatNumber(totals.items),
            icon: Package,
            chip: "bg-violet-50 text-violet-700",
          },
          {
            label: "Low or out of stock",
            value: formatNumber(totals.low),
            icon: AlertTriangle,
            chip: "bg-amber-50 text-amber-700",
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

      <Card>
        <CardContent className="p-0">
          <div className="flex flex-col gap-2 border-b border-border p-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search item, SKU or supplier"
                className="pl-8"
                aria-label="Search inventory"
              />
            </div>
            <Select
              value={activeCompany}
              onChange={(event) => setCompanyFilter(event.target.value)}
              className="sm:w-48"
              aria-label="Filter by subsidiary"
            >
              <option value="all">All subsidiaries</option>
              {companies.map((company) => (
                <option key={company.id} value={company.id}>
                  {company.shortName}
                </option>
              ))}
            </Select>
            <Select
              value={stockFilter}
              onChange={(event) => setStockFilter(event.target.value)}
              className="sm:w-40"
              aria-label="Filter by stock level"
            >
              <option value="all">All stock levels</option>
              <option value="in">In stock</option>
              <option value="low">Low stock</option>
              <option value="out">Out of stock</option>
            </Select>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead className="hidden md:table-cell">Subsidiary</TableHead>
                <TableHead className="text-right">On hand</TableHead>
                <TableHead className="hidden text-right lg:table-cell">Unit cost</TableHead>
                <TableHead className="hidden text-right md:table-cell">Stock value</TableHead>
                <TableHead className="hidden xl:table-cell">Updated</TableHead>
                <TableHead className="text-right">Status</TableHead>
                <TableHead className="w-20" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((item) => {
                const company = companies.find((entry) => entry.id === item.companyId);
                return (
                  <TableRow key={item.id}>
                    <TableCell>
                      <p className="max-w-[220px] truncate text-xs font-semibold text-foreground">
                        {item.name}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {item.sku} · {item.category}
                      </p>
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
                        <Badge variant="outline">Unassigned</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <p className="text-xs font-semibold text-foreground">
                        {formatNumber(item.quantity)}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        reorder at {formatNumber(item.reorderLevel)}
                      </p>
                    </TableCell>
                    <TableCell className="hidden text-right text-xs text-muted-foreground lg:table-cell">
                      {formatUGX(item.unitCost, { compact: false })}
                    </TableCell>
                    <TableCell className="hidden text-right text-xs font-semibold text-foreground md:table-cell">
                      {formatUGX(item.quantity * item.unitCost)}
                    </TableCell>
                    <TableCell className="hidden text-xs text-muted-foreground xl:table-cell">
                      {formatDate(item.updated)}
                    </TableCell>
                    <TableCell className="text-right">
                      <StockBadge item={item} />
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="flex items-center justify-end gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => openEdit(item)}
                          title="Edit item"
                          aria-label={`Edit ${item.name}`}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleDelete(item)}
                          title="Delete item"
                          aria-label={`Delete ${item.name}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </span>
                    </TableCell>
                  </TableRow>
                );
              })}
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="py-10 text-center">
                    <p className="text-sm font-semibold text-foreground">No stock items found</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Adjust the filters or add a new item.
                    </p>
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <p className="mt-3 text-[11px] text-muted-foreground">
        Showing {filtered.length} of {scoped.length} items
        {activeCompany === "all"
          ? " across the group."
          : ` for ${companies.find((c) => c.id === activeCompany)?.name ?? "this subsidiary"}.`}
      </p>
    </div>
  );
}
