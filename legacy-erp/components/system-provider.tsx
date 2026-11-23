"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { PostgrestError } from "@supabase/supabase-js";
import { Toaster, toast } from "sonner";
import { supabase } from "@/lib/supabase";
import {
  TODAY,
  accountsSeed,
  companies as companiesSeed,
  inventorySeed,
  invoicesSeed,
  projectsSeed,
  staffSeed,
  transactionsSeed,
  type Account,
  type AccountRole,
  type AccountStatus,
  type Company,
  type CompanyStatus,
  type InventoryItem,
  type Invoice,
  type InvoiceStatus,
  type Project,
  type ProjectStatus,
  type StaffMember,
  type Transaction,
  type TransactionType,
} from "@/lib/data";
import {
  activitiesSeed,
  contactsSeed,
  dealsSeed,
  nextStage,
  stageProbability,
  type ActivityType,
  type Contact,
  type ContactType,
  type CrmActivity,
  type Deal,
  type DealStage,
} from "@/lib/crm-data";

interface NewCompanyInput {
  name: string;
  shortName: string;
  sector: string;
  md: string;
  location: string;
  description?: string;
  color?: string;
  status?: CompanyStatus;
  founded?: number;
}

interface NewStaffInput {
  name: string;
  role: string;
  department: string;
  companyId: string;
  email: string;
  phone: string;
}

interface NewTransactionInput {
  date: string;
  description: string;
  companyId: string;
  type: TransactionType;
  category: string;
  amount: number;
}

interface NewProjectInput {
  name: string;
  companyId: string;
  client: string;
  budget: number;
  spent: number;
  progress: number;
  status: ProjectStatus;
  due: string;
}

interface NewInvoiceInput {
  number: string;
  client: string;
  companyId: string;
  contactId?: string;
  amount: number;
  issued: string;
  due: string;
  status: InvoiceStatus;
}

interface NewContactInput {
  name: string;
  organization: string;
  role: string;
  email: string;
  phone: string;
  companyId: string;
  type: ContactType;
  owner: string;
  value: number;
}

interface NewDealInput {
  title: string;
  contactId: string;
  companyId: string;
  stage: DealStage;
  value: number;
  owner: string;
  expectedClose: string;
}

interface NewActivityInput {
  contactId: string;
  companyId: string;
  type: ActivityType;
  title: string;
  notes?: string;
}

interface NewAccountInput {
  name: string;
  email: string;
  role: AccountRole;
  companyId: string;
}

interface NewInventoryInput {
  sku: string;
  name: string;
  category: string;
  companyId: string;
  quantity: number;
  reorderLevel: number;
  unitCost: number;
  supplier: string;
}

interface SystemContextValue {
  companies: Company[];
  staff: StaffMember[];
  transactions: Transaction[];
  projects: Project[];
  invoices: Invoice[];
  contacts: Contact[];
  deals: Deal[];
  activities: CrmActivity[];
  accounts: Account[];
  inventory: InventoryItem[];
  updateCompany: (id: string, patch: Partial<Omit<Company, "id">>) => void;
  addCompany: (input: NewCompanyInput) => Company;
  addStaff: (input: NewStaffInput) => void;
  updateStaff: (id: string, patch: Partial<Omit<StaffMember, "id">>) => void;
  removeStaff: (id: string) => void;
  addTransaction: (input: NewTransactionInput) => void;
  updateTransaction: (id: string, patch: Partial<Omit<Transaction, "id">>) => void;
  removeTransaction: (id: string) => void;
  addProject: (input: NewProjectInput) => void;
  updateProject: (id: string, patch: Partial<Omit<Project, "id">>) => void;
  removeProject: (id: string) => void;
  addInvoice: (input: NewInvoiceInput) => void;
  setInvoiceStatus: (id: string, status: InvoiceStatus) => void;
  removeInvoice: (id: string) => void;
  addContact: (input: NewContactInput) => void;
  updateContact: (id: string, patch: Partial<Omit<Contact, "id">>) => void;
  removeContact: (id: string) => void;
  addDeal: (input: NewDealInput) => void;
  updateDeal: (id: string, patch: Partial<Omit<Deal, "id">>) => void;
  removeDeal: (id: string) => void;
  advanceDeal: (dealId: string) => DealStage | null;
  logActivity: (input: NewActivityInput) => void;
  addAccount: (input: NewAccountInput) => void;
  setAccountStatus: (id: string, status: AccountStatus) => void;
  removeAccount: (id: string) => void;
  addInventoryItem: (input: NewInventoryInput) => void;
  updateInventoryItem: (id: string, patch: Partial<Omit<InventoryItem, "id">>) => void;
  removeInventoryItem: (id: string) => void;
}

interface CompanyRow {
  id: string;
  name: string;
  short_name: string;
  sector: string;
  mark: string;
  color: string;
  md: string;
  staff_count: number | null;
  founded: number | null;
  status: Company["status"];
  revenue: number | string | null;
  expenses: number | string | null;
  profit: number | string | null;
  growth: number | string | null;
  location: string | null;
  description: string | null;
}

interface StaffRow {
  id: string;
  name: string;
  role: string;
  department: string;
  company_id: string;
  email: string | null;
  phone: string | null;
  status: StaffMember["status"];
  joined: string | null;
}

interface TransactionRow {
  id: string;
  date: string;
  description: string;
  company_id: string;
  type: Transaction["type"];
  category: string;
  amount: number | string | null;
  status: Transaction["status"];
}

interface ProjectRow {
  id: string;
  name: string;
  company_id: string;
  client: string | null;
  budget: number | string | null;
  spent: number | string | null;
  progress: number | null;
  status: Project["status"];
  due: string | null;
}

interface InvoiceRow {
  id: string;
  number: string;
  client: string;
  company_id: string;
  contact_id: string | null;
  amount: number | string | null;
  issued: string;
  due: string;
  status: InvoiceStatus;
}

interface ContactRow {
  id: string;
  name: string;
  organization: string;
  role: string | null;
  email: string | null;
  phone: string | null;
  company_id: string;
  type: Contact["type"];
  status: Contact["status"];
  owner: string | null;
  last_contact: string | null;
  value: number | string | null;
}

interface DealRow {
  id: string;
  title: string;
  contact_id: string | null;
  company_id: string;
  stage: Deal["stage"];
  value: number | string | null;
  probability: number | null;
  owner: string | null;
  expected_close: string | null;
  updated: string | null;
}

interface ActivityRow {
  id: string;
  contact_id: string | null;
  company_id: string;
  type: CrmActivity["type"];
  title: string;
  notes: string | null;
  date: string;
  created_by: string;
}

interface AccountRow {
  id: string;
  name: string;
  email: string;
  role: AccountRole;
  company_id: string | null;
  status: AccountStatus;
  created_at: string | null;
  last_active: string | null;
}

interface InventoryRow {
  id: string;
  sku: string;
  name: string;
  category: string;
  company_id: string;
  quantity: number | string | null;
  reorder_level: number | string | null;
  unit_cost: number | string | null;
  supplier: string | null;
  updated: string | null;
}

const num = (value: number | string | null | undefined) => Number(value ?? 0);

function mapCompany(row: CompanyRow): Company {
  return {
    id: row.id,
    name: row.name,
    shortName: row.short_name,
    sector: row.sector,
    mark: row.mark,
    color: row.color,
    md: row.md,
    staff: row.staff_count ?? 0,
    founded: row.founded ?? 0,
    status: row.status,
    revenue: num(row.revenue),
    expenses: num(row.expenses),
    profit: num(row.profit),
    growth: num(row.growth),
    location: row.location ?? "",
    description: row.description ?? "",
  };
}

function mapStaff(row: StaffRow): StaffMember {
  return {
    id: row.id,
    name: row.name,
    role: row.role,
    department: row.department,
    companyId: row.company_id,
    email: row.email ?? "",
    phone: row.phone ?? "",
    status: row.status,
    joined: row.joined ?? "",
  };
}

function mapTransaction(row: TransactionRow): Transaction {
  return {
    id: row.id,
    date: row.date,
    description: row.description,
    companyId: row.company_id,
    type: row.type,
    category: row.category,
    amount: num(row.amount),
    status: row.status,
  };
}

function mapProject(row: ProjectRow): Project {
  return {
    id: row.id,
    name: row.name,
    companyId: row.company_id,
    client: row.client ?? "",
    budget: num(row.budget),
    spent: num(row.spent),
    progress: row.progress ?? 0,
    status: row.status,
    due: row.due ?? "",
  };
}

function mapInvoice(row: InvoiceRow): Invoice {
  return {
    id: row.id,
    number: row.number,
    client: row.client,
    companyId: row.company_id,
    contactId: row.contact_id ?? undefined,
    amount: num(row.amount),
    issued: row.issued,
    due: row.due,
    status: row.status,
  };
}

function mapContact(row: ContactRow): Contact {
  return {
    id: row.id,
    name: row.name,
    organization: row.organization,
    role: row.role ?? "",
    email: row.email ?? "",
    phone: row.phone ?? "",
    companyId: row.company_id,
    type: row.type,
    status: row.status,
    owner: row.owner ?? "",
    lastContact: row.last_contact ?? "",
    value: num(row.value),
  };
}

function mapDeal(row: DealRow): Deal {
  return {
    id: row.id,
    title: row.title,
    contactId: row.contact_id ?? "",
    companyId: row.company_id,
    stage: row.stage,
    value: num(row.value),
    probability: row.probability ?? 0,
    owner: row.owner ?? "",
    expectedClose: row.expected_close ?? "",
    updated: row.updated ?? "",
  };
}

function mapActivity(row: ActivityRow): CrmActivity {
  return {
    id: row.id,
    contactId: row.contact_id ?? "",
    companyId: row.company_id,
    type: row.type,
    title: row.title,
    notes: row.notes ?? undefined,
    date: row.date,
    by: row.created_by,
  };
}

function mapAccount(row: AccountRow): Account {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    companyId: row.company_id ?? "",
    status: row.status,
    createdAt: row.created_at ?? "",
    lastActive: row.last_active ?? "",
  };
}

function mapInventory(row: InventoryRow): InventoryItem {
  return {
    id: row.id,
    sku: row.sku,
    name: row.name,
    category: row.category,
    companyId: row.company_id,
    quantity: num(row.quantity),
    reorderLevel: num(row.reorder_level),
    unitCost: num(row.unit_cost),
    supplier: row.supplier ?? "",
    updated: row.updated ?? "",
  };
}

function companyRow(company: Company) {
  return {
    id: company.id,
    name: company.name,
    short_name: company.shortName,
    sector: company.sector,
    mark: company.mark,
    color: company.color,
    md: company.md,
    staff_count: company.staff,
    founded: company.founded,
    status: company.status,
    revenue: company.revenue,
    expenses: company.expenses,
    profit: company.profit,
    growth: company.growth,
    location: company.location,
    description: company.description,
  };
}

function staffRow(member: StaffMember) {
  return {
    id: member.id,
    name: member.name,
    role: member.role,
    department: member.department,
    company_id: member.companyId,
    email: member.email,
    phone: member.phone,
    status: member.status,
    joined: member.joined,
  };
}

function transactionRow(transaction: Transaction) {
  return {
    id: transaction.id,
    date: transaction.date,
    description: transaction.description,
    company_id: transaction.companyId,
    type: transaction.type,
    category: transaction.category,
    amount: transaction.amount,
    status: transaction.status,
  };
}

function projectRow(project: Project) {
  return {
    id: project.id,
    name: project.name,
    company_id: project.companyId,
    client: project.client,
    budget: project.budget,
    spent: project.spent,
    progress: project.progress,
    status: project.status,
    due: project.due,
  };
}

function invoiceRow(invoice: Invoice) {
  return {
    id: invoice.id,
    number: invoice.number,
    client: invoice.client,
    company_id: invoice.companyId,
    contact_id: invoice.contactId ?? null,
    amount: invoice.amount,
    issued: invoice.issued,
    due: invoice.due,
    status: invoice.status,
  };
}

function contactRow(contact: Contact) {
  return {
    id: contact.id,
    name: contact.name,
    organization: contact.organization,
    role: contact.role,
    email: contact.email,
    phone: contact.phone,
    company_id: contact.companyId,
    type: contact.type,
    status: contact.status,
    owner: contact.owner,
    last_contact: contact.lastContact,
    value: contact.value,
  };
}

function dealRow(deal: Deal) {
  return {
    id: deal.id,
    title: deal.title,
    contact_id: deal.contactId,
    company_id: deal.companyId,
    stage: deal.stage,
    value: deal.value,
    probability: deal.probability,
    owner: deal.owner,
    expected_close: deal.expectedClose,
    updated: deal.updated,
  };
}

function activityRow(activity: CrmActivity) {
  return {
    id: activity.id,
    contact_id: activity.contactId,
    company_id: activity.companyId,
    type: activity.type,
    title: activity.title,
    notes: activity.notes ?? null,
    date: activity.date,
    created_by: activity.by,
  };
}

function accountRow(account: Account) {
  return {
    id: account.id,
    name: account.name,
    email: account.email,
    role: account.role,
    company_id: account.companyId || null,
    status: account.status,
    created_at: account.createdAt,
    last_active: account.lastActive,
  };
}

function inventoryRow(item: InventoryItem) {
  return {
    id: item.id,
    sku: item.sku,
    name: item.name,
    category: item.category,
    company_id: item.companyId,
    quantity: item.quantity,
    reorder_level: item.reorderLevel,
    unit_cost: item.unitCost,
    supplier: item.supplier,
    updated: item.updated,
  };
}

async function seedDatabase(): Promise<PostgrestError | null> {
  const steps: Array<() => PromiseLike<{ error: PostgrestError | null }>> = [
    () => supabase.from("d12_companies").upsert(companiesSeed.map(companyRow)),
    () => supabase.from("d12_staff").upsert(staffSeed.map(staffRow)),
    () => supabase.from("d12_transactions").upsert(transactionsSeed.map(transactionRow)),
    () => supabase.from("d12_projects").upsert(projectsSeed.map(projectRow)),
    () => supabase.from("d12_contacts").upsert(contactsSeed.map(contactRow)),
    () => supabase.from("d12_deals").upsert(dealsSeed.map(dealRow)),
    () => supabase.from("d12_activities").upsert(activitiesSeed.map(activityRow)),
    () => supabase.from("d12_invoices").upsert(invoicesSeed.map(invoiceRow)),
    () => supabase.from("d12_accounts").upsert(accountsSeed.map(accountRow)),
    () => supabase.from("d12_inventory").upsert(inventorySeed.map(inventoryRow)),
  ];

  for (const step of steps) {
    const { error } = await step();
    if (error) return error;
  }
  return null;
}

async function save(
  request: PromiseLike<{ error: PostgrestError | null }>
): Promise<void> {
  const { error } = await request;
  if (error) {
    toast.error("Could not save to Supabase", { description: error.message });
  }
}

const SystemContext = createContext<SystemContextValue | null>(null);

export function SystemProvider({ children }: { children: ReactNode }) {
  const [companies, setCompanies] = useState<Company[]>(companiesSeed);
  const [staff, setStaff] = useState<StaffMember[]>(staffSeed);
  const [transactions, setTransactions] = useState<Transaction[]>(transactionsSeed);
  const [projects, setProjects] = useState<Project[]>(projectsSeed);
  const [invoices, setInvoices] = useState<Invoice[]>(invoicesSeed);
  const [contacts, setContacts] = useState<Contact[]>(contactsSeed);
  const [deals, setDeals] = useState<Deal[]>(dealsSeed);
  const [activities, setActivities] = useState<CrmActivity[]>(activitiesSeed);
  const [accounts, setAccounts] = useState<Account[]>(accountsSeed);
  const [inventory, setInventory] = useState<InventoryItem[]>(inventorySeed);
  const hydrated = useRef(false);

  useEffect(() => {
    if (hydrated.current) return;
    hydrated.current = true;

    void (async () => {
      const [
        companiesRes,
        staffRes,
        transactionsRes,
        projectsRes,
        invoicesRes,
        contactsRes,
        dealsRes,
        activitiesRes,
        accountsRes,
        inventoryRes,
      ] = await Promise.all([
        supabase.from("d12_companies").select("*").order("name"),
        supabase.from("d12_staff").select("*").order("id"),
        supabase.from("d12_transactions").select("*").order("date", { ascending: false }).order("id"),
        supabase.from("d12_projects").select("*").order("id"),
        supabase.from("d12_invoices").select("*").order("issued", { ascending: false }).order("id"),
        supabase.from("d12_contacts").select("*").order("id"),
        supabase.from("d12_deals").select("*").order("updated", { ascending: false }).order("id"),
        supabase.from("d12_activities").select("*").order("date", { ascending: false }).order("id"),
        supabase.from("d12_accounts").select("*").order("id"),
        supabase.from("d12_inventory").select("*").order("id"),
      ]);

      if (companiesRes.error) {
        console.warn("Supabase not ready:", companiesRes.error.message);
        return;
      }

      if (!companiesRes.data?.length) {
        const seedError = await seedDatabase();
        if (seedError) {
          console.warn("Supabase seed failed:", seedError.message);
        }
        return;
      }

      setCompanies(companiesRes.data.map((row) => mapCompany(row as CompanyRow)));
      if (!staffRes.error && staffRes.data) {
        setStaff(staffRes.data.map((row) => mapStaff(row as StaffRow)));
      }
      if (!transactionsRes.error && transactionsRes.data) {
        setTransactions(transactionsRes.data.map((row) => mapTransaction(row as TransactionRow)));
      }
      if (!projectsRes.error && projectsRes.data) {
        setProjects(projectsRes.data.map((row) => mapProject(row as ProjectRow)));
      }
      if (!invoicesRes.error && invoicesRes.data?.length) {
        setInvoices(invoicesRes.data.map((row) => mapInvoice(row as InvoiceRow)));
      }
      if (!contactsRes.error && contactsRes.data) {
        setContacts(contactsRes.data.map((row) => mapContact(row as ContactRow)));
      }
      if (!dealsRes.error && dealsRes.data) {
        setDeals(dealsRes.data.map((row) => mapDeal(row as DealRow)));
      }
      if (!activitiesRes.error && activitiesRes.data) {
        setActivities(activitiesRes.data.map((row) => mapActivity(row as ActivityRow)));
      }
      if (!accountsRes.error && accountsRes.data?.length) {
        setAccounts(accountsRes.data.map((row) => mapAccount(row as AccountRow)));
      }
      if (!inventoryRes.error && inventoryRes.data?.length) {
        setInventory(inventoryRes.data.map((row) => mapInventory(row as InventoryRow)));
      }
    })();
  }, []);

  const value = useMemo<SystemContextValue>(
    () => ({
      companies,
      staff,
      transactions,
      projects,
      invoices,
      contacts,
      deals,
      activities,
      accounts,
      inventory,
      updateCompany(id, patch) {
        const current = companies.find((company) => company.id === id);
        if (!current) return;
        const updated = { ...current, ...patch };
        setCompanies((items) =>
          items.map((company) => (company.id === id ? updated : company))
        );
        void save(
          supabase.from("d12_companies").update(companyRow(updated)).eq("id", id)
        );
      },
      addCompany(input) {
        const name = input.name.trim();
        const shortName = input.shortName.trim() || name;
        const base =
          name
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-+|-+$/g, "") || `subsidiary-${Date.now()}`;
        let id = base;
        let suffix = 2;
        while (companies.some((company) => company.id === id)) {
          id = `${base}-${suffix}`;
          suffix += 1;
        }
        const mark =
          shortName
            .replace(/[^A-Za-z ]/g, "")
            .split(/\s+/)
            .map((word) => word[0])
            .join("")
            .slice(0, 2)
            .toUpperCase() || "D12";
        const company: Company = {
          id,
          name,
          shortName,
          sector: input.sector.trim() || "General",
          mark,
          color: input.color ?? "#334155",
          md: input.md.trim() || "Unassigned",
          staff: 0,
          founded: input.founded ?? new Date().getFullYear(),
          status: input.status ?? "active",
          revenue: 0,
          expenses: 0,
          profit: 0,
          growth: 0,
          location: input.location.trim(),
          description: input.description?.trim() ?? "",
        };
        setCompanies((current) => [...current, company]);
        void save(supabase.from("d12_companies").insert(companyRow(company)));
        return company;
      },
      addStaff(input) {
        const member: StaffMember = {
          ...input,
          id: `s-${Date.now()}`,
          joined: TODAY,
          status: "active",
        };
        setStaff((current) => [member, ...current]);
        void save(supabase.from("d12_staff").insert(staffRow(member)));
      },
      updateStaff(id, patch) {
        const current = staff.find((member) => member.id === id);
        if (!current) return;
        const updated = { ...current, ...patch };
        setStaff((items) => items.map((member) => (member.id === id ? updated : member)));
        void save(supabase.from("d12_staff").update(staffRow(updated)).eq("id", id));
      },
      removeStaff(id) {
        setStaff((items) => items.filter((member) => member.id !== id));
        void save(supabase.from("d12_staff").delete().eq("id", id));
      },
      addTransaction(input) {
        const transaction: Transaction = {
          ...input,
          id: `t-${Date.now()}`,
          status: "cleared",
        };
        setTransactions((current) => [transaction, ...current]);
        void save(supabase.from("d12_transactions").insert(transactionRow(transaction)));
      },
      updateTransaction(id, patch) {
        const current = transactions.find((transaction) => transaction.id === id);
        if (!current) return;
        const updated = { ...current, ...patch };
        setTransactions((items) =>
          items.map((transaction) => (transaction.id === id ? updated : transaction))
        );
        void save(
          supabase.from("d12_transactions").update(transactionRow(updated)).eq("id", id)
        );
      },
      removeTransaction(id) {
        setTransactions((items) => items.filter((transaction) => transaction.id !== id));
        void save(supabase.from("d12_transactions").delete().eq("id", id));
      },
      addProject(input) {
        const project: Project = {
          ...input,
          id: `p-${Date.now()}`,
        };
        setProjects((current) => [project, ...current]);
        void save(supabase.from("d12_projects").insert(projectRow(project)));
      },
      updateProject(id, patch) {
        const current = projects.find((project) => project.id === id);
        if (!current) return;
        const updated = { ...current, ...patch };
        setProjects((items) => items.map((project) => (project.id === id ? updated : project)));
        void save(supabase.from("d12_projects").update(projectRow(updated)).eq("id", id));
      },
      removeProject(id) {
        setProjects((items) => items.filter((project) => project.id !== id));
        void save(supabase.from("d12_projects").delete().eq("id", id));
      },
      addInvoice(input) {
        const invoice: Invoice = {
          ...input,
          id: `inv-${Date.now()}`,
        };
        setInvoices((current) => [invoice, ...current]);
        void save(supabase.from("d12_invoices").insert(invoiceRow(invoice)));
      },
      setInvoiceStatus(id, status) {
        const current = invoices.find((invoice) => invoice.id === id);
        if (!current) return;
        const updated = { ...current, status };
        setInvoices((items) => items.map((invoice) => (invoice.id === id ? updated : invoice)));
        void save(supabase.from("d12_invoices").update({ status }).eq("id", id));
      },
      removeInvoice(id) {
        setInvoices((items) => items.filter((invoice) => invoice.id !== id));
        void save(supabase.from("d12_invoices").delete().eq("id", id));
      },
      addContact(input) {
        const contact: Contact = {
          ...input,
          id: `c-${Date.now()}`,
          status: "active",
          lastContact: TODAY,
        };
        setContacts((current) => [contact, ...current]);
        void save(supabase.from("d12_contacts").insert(contactRow(contact)));
      },
      updateContact(id, patch) {
        const current = contacts.find((contact) => contact.id === id);
        if (!current) return;
        const updated = { ...current, ...patch };
        setContacts((items) => items.map((contact) => (contact.id === id ? updated : contact)));
        void save(supabase.from("d12_contacts").update(contactRow(updated)).eq("id", id));
      },
      removeContact(id) {
        setContacts((items) => items.filter((contact) => contact.id !== id));
        setDeals((items) =>
          items.map((deal) => (deal.contactId === id ? { ...deal, contactId: "" } : deal))
        );
        setActivities((items) =>
          items.map((activity) =>
            activity.contactId === id ? { ...activity, contactId: "" } : activity
          )
        );
        void save(supabase.from("d12_contacts").delete().eq("id", id));
      },
      addDeal(input) {
        const deal: Deal = {
          ...input,
          id: `d-${Date.now()}`,
          probability: stageProbability(input.stage),
          updated: TODAY,
        };
        setDeals((current) => [deal, ...current]);
        void save(supabase.from("d12_deals").insert(dealRow(deal)));
      },
      updateDeal(id, patch) {
        const current = deals.find((deal) => deal.id === id);
        if (!current) return;
        const updated: Deal = {
          ...current,
          ...patch,
          probability:
            patch.stage && patch.probability === undefined
              ? stageProbability(patch.stage)
              : patch.probability ?? current.probability,
          updated: TODAY,
        };
        setDeals((items) => items.map((deal) => (deal.id === id ? updated : deal)));
        void save(supabase.from("d12_deals").update(dealRow(updated)).eq("id", id));
      },
      removeDeal(id) {
        setDeals((items) => items.filter((deal) => deal.id !== id));
        void save(supabase.from("d12_deals").delete().eq("id", id));
      },
      advanceDeal(dealId) {
        const deal = deals.find((item) => item.id === dealId);
        if (!deal) return null;
        const next = nextStage(deal.stage);
        if (!next) return null;
        setDeals((current) =>
          current.map((item) =>
            item.id === dealId
              ? {
                  ...item,
                  stage: next,
                  probability: stageProbability(next),
                  updated: TODAY,
                }
              : item
          )
        );
        void save(
          supabase
            .from("d12_deals")
            .update({ stage: next, probability: stageProbability(next), updated: TODAY })
            .eq("id", dealId)
        );
        return next;
      },
      logActivity(input) {
        const activity: CrmActivity = {
          ...input,
          id: `a-${Date.now()}`,
          date: TODAY,
          by: "Marvin Ssempebwa",
        };
        setActivities((current) => [activity, ...current]);
        setContacts((current) =>
          current.map((contact) =>
            contact.id === input.contactId
              ? { ...contact, lastContact: TODAY }
              : contact
          )
        );
        void save(supabase.from("d12_activities").insert(activityRow(activity)));
        void save(
          supabase
            .from("d12_contacts")
            .update({ last_contact: TODAY })
            .eq("id", input.contactId)
        );
      },
      addAccount(input) {
        const account: Account = {
          ...input,
          id: `ac-${Date.now()}`,
          status: "active",
          createdAt: TODAY,
          lastActive: TODAY,
        };
        setAccounts((current) => [account, ...current]);
        void save(supabase.from("d12_accounts").insert(accountRow(account)));
      },
      setAccountStatus(id, status) {
        const current = accounts.find((account) => account.id === id);
        if (!current) return;
        const updated = { ...current, status };
        setAccounts((items) =>
          items.map((account) => (account.id === id ? updated : account))
        );
        void save(
          supabase.from("d12_accounts").update({ status }).eq("id", id)
        );
      },
      removeAccount(id) {
        setAccounts((items) => items.filter((account) => account.id !== id));
        void save(supabase.from("d12_accounts").delete().eq("id", id));
      },
      addInventoryItem(input) {
        const item: InventoryItem = {
          ...input,
          id: `i-${Date.now()}`,
          updated: TODAY,
        };
        setInventory((current) => [item, ...current]);
        void save(supabase.from("d12_inventory").insert(inventoryRow(item)));
      },
      updateInventoryItem(id, patch) {
        const current = inventory.find((item) => item.id === id);
        if (!current) return;
        const updated = { ...current, ...patch, updated: TODAY };
        setInventory((items) => items.map((item) => (item.id === id ? updated : item)));
        void save(
          supabase.from("d12_inventory").update(inventoryRow(updated)).eq("id", id)
        );
      },
      removeInventoryItem(id) {
        setInventory((items) => items.filter((item) => item.id !== id));
        void save(supabase.from("d12_inventory").delete().eq("id", id));
      },
    }),
    [
      companies,
      staff,
      transactions,
      projects,
      invoices,
      contacts,
      deals,
      activities,
      accounts,
      inventory,
    ]
  );

  return (
    <SystemContext.Provider value={value}>
      {children}
      <Toaster richColors position="top-right" />
    </SystemContext.Provider>
  );
}

export function useSystem() {
  const context = useContext(SystemContext);
  if (!context) {
    throw new Error("useSystem must be used inside SystemProvider");
  }
  return context;
}
