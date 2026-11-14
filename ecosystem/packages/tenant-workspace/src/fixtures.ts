import {
  TENANTS,
  type CustomerRecord,
  type InventoryRecord,
  type InvoiceRecord,
  type LeadRecord,
  type OpsEntity,
  type ProjectRecord,
  type SaleRecord,
  type StaffRecord,
  type TaskRecord,
  type TenantId,
  type TransactionRecord,
} from "@d12/contracts";

interface TenantFixture {
  clients: string[];
  offers: string[];
  team: string[];
  roster: string[];
  supplies: string[];
  leadValue: number;
  saleSize: number;
}

const FIXTURES: Record<TenantId, TenantFixture> = {
  passito: {
    clients: [
      "Kampala Coffee Co.",
      "Nile Breweries",
      "Pearl Bank",
      "Safari Telecom",
      "Mukwano Foods",
      "Jumia Uganda",
    ],
    offers: [
      "Brand refresh retainer",
      "Q4 campaign production",
      "Social media management",
      "Launch event creative",
      "Media buying — radio",
      "Product photography day",
    ],
    team: ["Sarah Nakato", "Brian Ssemakula", "Diana Akello"],
    roster: ["Sarah Nakato", "Brian Ssemakula", "Diana Akello", "Grace Nassimba", "Peter Wasswa", "Alice Kabuye"],
    supplies: [
      "Brand guideline print packs",
      "Camera memory cards",
      "Studio backdrop paper",
      "Client welcome kits",
    ],
    leadValue: 1_800_000,
    saleSize: 850_000,
  },
  mariz: {
    clients: [
      "Stanbic operations desk",
      "MTN customer care",
      "Roofings Group",
      "Quality Chemicals",
      "Nakumatt logistics",
      "Centenary staff canteen",
    ],
    offers: [
      "Managed payroll desk",
      "Facilities crew — 12 staff",
      "Contact centre staffing",
      "Temporary warehouse team",
      "Cleaning contract renewal",
      "Driver outsourcing",
    ],
    team: ["Joseph Okello", "Ritah Nabirye", "Peter Mubiru"],
    roster: ["Joseph Okello", "Ritah Nabirye", "Peter Mubiru", "Janet Achieng", "Samuel Tumusiime", "Zainab Waiswa"],
    supplies: ["Uniform sets", "Timesheet pads", "Cleaning supplies", "Safety gloves"],
    leadValue: 4_200_000,
    saleSize: 2_400_000,
  },
  "rub-shoots": {
    clients: [
      "Pearl Wedding Co.",
      "Nile Gold Hotel",
      "Kampala Fashion Week",
      "Sanyu FM",
      "Endiro Coffee",
      "Acacia Mall events",
    ],
    offers: [
      "Wedding full-day coverage",
      "Corporate portrait day",
      "Product catalogue shoot",
      "Event highlight film",
      "Studio mini-sessions",
      "Drone coverage add-on",
    ],
    team: ["Patricia Namusoke", "Joel Kigongo", "Martha Auma"],
    roster: ["Patricia Namusose", "Joel Kigongo", "Martha Auma", "Emma Lutwama", "Rebecca Sanyu", "Collins Odongo"],
    supplies: ["NP-F batteries", "SD cards 128GB", "Lens cleaning kits", "Backdrop stands"],
    leadValue: 1_500_000,
    saleSize: 950_000,
  },
  "shop-for-me": {
    clients: ["Aisha Nabirye", "Brian Kato", "Grace Atim", "Samuel Otim", "Lydia Nakintu", "Trevor Mugisha"],
    offers: [
      "Weekly grocery run",
      "School supplies bundle",
      "Home appliances order",
      "Festive hamper delivery",
      "Pharmacy pickup",
      "Furniture assembly run",
    ],
    team: ["Andrew Ochieng", "Sharon Nakiwala", "Ivan Ssebunya"],
    roster: ["Andrew Ochieng", "Sharon Nakiwala", "Ivan Ssebunya", "Miriam Adero", "Fred Lubega", "Tina Nakato"],
    supplies: ["Delivery bags", "Receipt rolls", "Packing tape", "Gift wrap"],
    leadValue: 320_000,
    saleSize: 180_000,
  },
  "expresso-point": {
    clients: [
      "Nakasero Corporate Park",
      "Acacia Mall kiosk",
      "Ministry of Works",
      "Silver Springs Hotel",
      "Daily walk-in regulars",
      "Kampala Serena offices",
    ],
    offers: [
      "Morning coffee subscription",
      "Boardroom catering",
      "Barista training session",
      "Weekend brunch service",
      "Event coffee cart",
      "Wholesale bean order",
    ],
    team: ["Hadijah Nakimuli", "Farouk Ssemwanga", "Brenda Atuhaire"],
    roster: ["Hadijah Nakimuli", "Farouk Ssemwanga", "Brenda Atuhaire", "Julius Kayiwa", "Prossy Nabbanja", "Ronald Kasujja"],
    supplies: ["Coffee beans 1kg", "Paper cups 12oz", "Oat milk 1L", "Napkins"],
    leadValue: 260_000,
    saleSize: 140_000,
  },
};

export interface TenantRecords {
  leads: LeadRecord[];
  customers: CustomerRecord[];
  sales: SaleRecord[];
  tasks: TaskRecord[];
  projects: ProjectRecord[];
  inventory: InventoryRecord[];
  transactions: TransactionRecord[];
  invoices: InvoiceRecord[];
  staff: StaffRecord[];
}

function dateOffset(daysAgo: number): string {
  const date = new Date(Date.now() - daysAgo * 86_400_000);
  return date.toISOString().slice(0, 10);
}

function isoOffset(daysAgo: number, hour = 10): string {
  const date = new Date(Date.now() - daysAgo * 86_400_000);
  date.setHours(hour, 15, 0, 0);
  return date.toISOString();
}

const LEAD_PLAN: Array<[string, string, number, string, string]> = [
  ["Aisha Kamya", "new", 1.0, "Referral", "Send the capabilities deck"],
  ["Daniel Mugisha", "contacted", 0.8, "Instagram", "Book a discovery call"],
  ["Sandra Nansubuga", "qualified", 1.4, "Walk-in", "Share the proposal"],
  ["Tom Kirabo", "won", 1.2, "Repeat client", "Kick-off scheduled"],
  ["Racheal Atuhaire", "lost", 0.6, "Cold call", "Paused until next quarter"],
  ["Isaac Owori", "contacted", 0.9, "Website", "Follow up on budget"],
];

const SALE_PLAN: Array<[number, number, string, number]> = [
  [0, 0, "paid", 1],
  [1, 1, "paid", 2],
  [2, 2, "paid", 3],
  [0, 3, "pending", 4],
  [3, 4, "paid", 6],
  [4, 5, "paid", 7],
  [1, 3, "refunded", 8],
  [5, 2, "paid", 9],
  [2, 5, "paid", 11],
  [0, 1, "paid", 13],
];

const TASK_PLAN: Array<[string, string, string, string, number]> = [
  ["Prepare monthly performance report", "in_progress", "high", "reports", 2],
  ["Call the qualified pipeline leads", "open", "high", "pipeline", 1],
  ["Refresh the pricing sheet", "open", "medium", "finance", 4],
  ["Collect testimonial from anchor client", "open", "low", "marketing", 7],
  ["Reconcile last week's receipts", "done", "medium", "finance", 3],
  ["Plan the team stand-up agenda", "open", "low", "operations", 5],
  ["Archive completed campaign files", "done", "low", "operations", 9],
];

const TRANSACTION_PLAN: Array<[TransactionRecord["kind"], string, string, number, number]> = [
  ["income", "Client retainer received", "Client payment", 1.2, 2],
  ["income", "Project milestone payment", "Client payment", 0.9, 8],
  ["income", "Counter sales batch", "Sales", 0.35, 14],
  ["expense", "Office rent", "Rent", 0.45, 25],
  ["expense", "Team payroll", "Payroll", 1.1, 28],
  ["expense", "Fuel and transport", "Transport", 0.08, 6],
  ["expense", "Utilities and internet", "Utilities", 0.05, 11],
  ["expense", "Marketing spend", "Marketing", 0.18, 17],
  ["expense", "Consumables restock", "Supplies", 0.06, 21],
  ["expense", "Equipment repair", "Maintenance", 0.04, 3],
];

const INVOICE_PLAN: Array<[InvoiceRecord["status"], number, number, number]> = [
  ["paid", 24, 14, 1.1],
  ["paid", 16, 14, 0.8],
  ["pending", 10, 14, 1.3],
  ["pending", 26, 14, 0.9],
  ["draft", 1, 30, 0.6],
  ["void", 40, 14, 0.4],
];

const STAFF_PLAN: Array<[string, string, StaffRecord["status"]]> = [
  ["Managing Director", "Executive", "active"],
  ["Operations Manager", "Operations", "active"],
  ["Team Lead", "Operations", "active"],
  ["Account Manager", "Commercial", "active"],
  ["Senior Specialist", "Delivery", "contract"],
  ["Associate", "Delivery", "on_leave"],
];

export function seedRecords(tenantId: TenantId): TenantRecords {
  const fixture = FIXTURES[tenantId];
  const meta = TENANTS[tenantId];
  const owner = fixture.team[0] ?? meta.managingDirector;

  const leads: LeadRecord[] = LEAD_PLAN.map(([name, stage, scale, source, nextStep], index) => ({
    id: `lead_${tenantId}_${index + 1}`,
    tenantId,
    createdAt: dateOffset(18 - index * 2),
    updatedAt: dateOffset(12 - index),
    name,
    company: fixture.clients[index % fixture.clients.length],
    email: `${name.split(" ")[0].toLowerCase()}@example.co.ug`,
    phone: "+256 7" + (70000000 + index * 111111),
    source,
    stage: stage as LeadRecord["stage"],
    value: Math.round(fixture.leadValue * scale),
    owner: fixture.team[index % fixture.team.length],
    nextStep,
  }));

  const customers: CustomerRecord[] = fixture.clients.map((client, index) => ({
    id: `cust_${tenantId}_${index + 1}`,
    tenantId,
    createdAt: dateOffset(120 - index * 9),
    updatedAt: dateOffset(10 - index),
    name: client,
    company: client,
    email: `accounts${index + 1}@example.co.ug`,
    phone: "+256 4" + (14000000 + index * 222222),
    tier: (["key", "growth", "standard", "growth", "standard"] as const)[index % 5],
    status: index === 4 ? "dormant" : "active",
    owner: fixture.team[index % fixture.team.length],
    lifetimeValue: Math.round(fixture.saleSize * (6 + index * 1.5)),
    lastOrder: dateOffset(4 + index * 3),
  }));

  const sales: SaleRecord[] = SALE_PLAN.map(([offerIndex, customerIndex, status, daysAgo], index) => ({
    id: `sale_${tenantId}_${index + 1}`,
    tenantId,
    createdAt: isoOffset(daysAgo, 12),
    updatedAt: isoOffset(daysAgo, 12),
    occurredOn: dateOffset(daysAgo),
    description: fixture.offers[offerIndex],
    customerId: `cust_${tenantId}_${customerIndex + 1}`,
    customerName: fixture.clients[customerIndex],
    amount: Math.round(fixture.saleSize * (1 + offerIndex * 0.35)),
    status: status as SaleRecord["status"],
    channel: (["Direct", "Bank transfer", "Mobile money", "Direct"] as const)[index % 4],
    owner: fixture.team[customerIndex % fixture.team.length],
  }));

  const tasks: TaskRecord[] = TASK_PLAN.map(([title, status, priority, related, dueOffset], index) => ({
    id: `task_${tenantId}_${index + 1}`,
    tenantId,
    createdAt: dateOffset(10 - index),
    updatedAt: isoOffset(Math.max(0, 4 - index), 15),
    title,
    assignee: fixture.team[index % fixture.team.length],
    dueOn: dateOffset(-dueOffset),
    priority: priority as TaskRecord["priority"],
    status: status as TaskRecord["status"],
    related,
  }));

  const projectStatuses: ProjectRecord["status"][] = [
    "active",
    "active",
    "on_hold",
    "completed",
    "planned",
  ];
  const projects: ProjectRecord[] = fixture.offers.slice(0, 5).map((offer, index) => {
    const status = projectStatuses[index] ?? "active";
    const budget = Math.round(fixture.saleSize * (2 + index * 0.8));
    const spent = Math.round(budget * (0.15 + index * 0.12));
    return {
      id: `proj_${tenantId}_${index + 1}`,
      tenantId,
      createdAt: dateOffset(90 - index * 10),
      updatedAt: isoOffset(Math.max(0, 6 - index), 14),
      name: offer,
      client: fixture.clients[index % fixture.clients.length],
      status,
      budget,
      spent,
      progress: status === "completed" ? 100 : Math.min(95, Math.round((spent / budget) * 100)),
      dueOn: dateOffset(-(7 + index * 9)),
      owner: fixture.team[index % fixture.team.length],
      description: `${fixture.clients[index % fixture.clients.length]} · ${offer}`,
    };
  });

  const inventoryCategories = ["Stock", "Supplies", "Equipment", "Consumables"];
  const quantities = [24, 6, 0, 18];
  const reorderLevels = [20, 10, 5, 15];
  const inventory: InventoryRecord[] = fixture.supplies.map((name, index) => ({
    id: `item_${tenantId}_${index + 1}`,
    tenantId,
    createdAt: dateOffset(70 - index * 6),
    updatedAt: isoOffset(Math.max(0, 5 - index), 11),
    sku: `${meta.mark}-${String(index + 1).padStart(3, "0")}`,
    name,
    category: inventoryCategories[index % inventoryCategories.length],
    quantity: quantities[index % quantities.length] + index * 3,
    reorderLevel: reorderLevels[index % reorderLevels.length],
    unitCost: Math.max(1_500, Math.round(fixture.saleSize * (0.004 + index * 0.002))),
    supplier: fixture.clients[(index + 2) % fixture.clients.length],
    location: index % 2 === 0 ? "Main store" : "Kampala HQ",
  }));

  const transactions: TransactionRecord[] = TRANSACTION_PLAN.map(
    ([kind, description, category, factor, daysAgo], index) => ({
      id: `txn_${tenantId}_${index + 1}`,
      tenantId,
      createdAt: isoOffset(daysAgo, 9),
      updatedAt: isoOffset(daysAgo, 9),
      occurredOn: dateOffset(daysAgo),
      kind,
      description,
      category,
      amount: Math.round((fixture.saleSize * factor) / 1000) * 1000,
      reference: `TXN-${1040 + index}`,
      counterparty:
        kind === "income"
          ? fixture.clients[index % fixture.clients.length]
          : fixture.clients[(index + 2) % fixture.clients.length],
    }),
  );

  const invoices: InvoiceRecord[] = INVOICE_PLAN.map(
    ([status, issuedAgo, windowDays, factor], index) => ({
      id: `inv_${tenantId}_${index + 1}`,
      tenantId,
      createdAt: isoOffset(issuedAgo, 11),
      updatedAt: isoOffset(Math.max(0, issuedAgo - 5), 11),
      number: `${meta.mark}-INV-${1040 + index}`,
      customerName: fixture.clients[index % fixture.clients.length],
      customerId: `cust_${tenantId}_${(index % fixture.clients.length) + 1}`,
      issueOn: dateOffset(issuedAgo),
      dueOn: dateOffset(issuedAgo - windowDays),
      amount: Math.round((fixture.saleSize * factor) / 500) * 500,
      status,
      notes: "",
      owner: fixture.team[(index % fixture.clients.length) % fixture.team.length],
    }),
  );

  const staff: StaffRecord[] = STAFF_PLAN.map(([role, department, status], index) => {
    const name = fixture.roster[index] ?? `Team member ${index + 1}`;
    const joinedDaysAgo = 400 - index * 73;
    return {
      id: `staff_${tenantId}_${index + 1}`,
      tenantId,
      createdAt: dateOffset(joinedDaysAgo),
      updatedAt: isoOffset(Math.max(0, 20 - index * 3), 10),
      name,
      role,
      department,
      email: `${name.split(" ")[0].toLowerCase()}@${meta.domain}`,
      phone: "+256 7" + (71000000 + index * 123456),
      status,
      joinedOn: dateOffset(joinedDaysAgo),
      notes: "",
    };
  });

  return { leads, customers, sales, tasks, projects, inventory, transactions, invoices, staff };
}

export function entityRecords(records: TenantRecords, entity: OpsEntity): TenantRecords[OpsEntity] {
  return records[entity];
}
