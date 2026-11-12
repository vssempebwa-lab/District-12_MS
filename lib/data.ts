export const TODAY = "2026-11-11";

export type CompanyStatus = "active" | "review";

export interface Company {
  id: string;
  name: string;
  shortName: string;
  sector: string;
  mark: string;
  color: string;
  md: string;
  staff: number;
  founded: number;
  status: CompanyStatus;
  revenue: number;
  expenses: number;
  profit: number;
  growth: number;
  location: string;
  description: string;
}

export const companies: Company[] = [
  {
    id: "passito",
    name: "Passito Marketing",
    shortName: "Passito",
    sector: "Marketing & advertising",
    mark: "PM",
    color: "#DB2777",
    md: "Sarah Nakato",
    staff: 14,
    founded: 2021,
    status: "active",
    revenue: 620_000_000,
    expenses: 470_000_000,
    profit: 150_000_000,
    growth: 18.2,
    location: "Ntinda, Kampala",
    description:
      "Brand strategy, digital campaigns and field marketing for group and external clients.",
  },
  {
    id: "mariz",
    name: "Mariz Outsourcing (U) SMC Ltd",
    shortName: "Mariz",
    sector: "Outsourcing & staffing",
    mark: "MZ",
    color: "#0F766E",
    md: "Joseph Okello",
    staff: 22,
    founded: 2020,
    status: "active",
    revenue: 350_000_000,
    expenses: 260_000_000,
    profit: 90_000_000,
    growth: 11.4,
    location: "Bugolobi, Kampala",
    description:
      "Recruitment, managed staffing and business process outsourcing for corporate clients.",
  },
  {
    id: "rub-shoots",
    name: "Rub Shoots Photography",
    shortName: "Rub Shoots",
    sector: "Photography & media",
    mark: "RS",
    color: "#BE185D",
    md: "Patricia Namusoke",
    staff: 8,
    founded: 2019,
    status: "active",
    revenue: 180_000_000,
    expenses: 130_000_000,
    profit: 50_000_000,
    growth: 9.6,
    location: "Kampala",
    description:
      "Studio and on-location photography, video coverage and content production.",
  },
  {
    id: "shop-for-me",
    name: "Shop For Me",
    shortName: "Shop For Me",
    sector: "Retail & e-commerce",
    mark: "SF",
    color: "#EA580C",
    md: "Andrew Ochieng",
    staff: 11,
    founded: 2022,
    status: "active",
    revenue: 540_000_000,
    expenses: 410_000_000,
    profit: 130_000_000,
    growth: 24.5,
    location: "Kampala",
    description:
      "Online shopping, personal-shopping concierge and last-mile delivery.",
  },
  {
    id: "expresso-point",
    name: "Expresso Point",
    shortName: "Expresso",
    sector: "Coffee & hospitality",
    mark: "EP",
    color: "#92400E",
    md: "Hadijah Nakimuli",
    staff: 6,
    founded: 2023,
    status: "active",
    revenue: 240_000_000,
    expenses: 190_000_000,
    profit: 50_000_000,
    growth: 7.3,
    location: "Kampala",
    description:
      "Coffee bar, quick-service counter and event coffee catering.",
  },
];

export interface MonthPoint {
  month: string;
  revenue: number;
  expenses: number;
}

export const groupSeries: MonthPoint[] = [
  { month: "Jan", revenue: 2.71e9, expenses: 2.25e9 },
  { month: "Feb", revenue: 2.86e9, expenses: 2.32e9 },
  { month: "Mar", revenue: 3.02e9, expenses: 2.4e9 },
  { month: "Apr", revenue: 2.94e9, expenses: 2.42e9 },
  { month: "May", revenue: 3.12e9, expenses: 2.48e9 },
  { month: "Jun", revenue: 3.18e9, expenses: 2.53e9 },
  { month: "Jul", revenue: 3.3e9, expenses: 2.58e9 },
  { month: "Aug", revenue: 3.42e9, expenses: 2.64e9 },
  { month: "Sep", revenue: 3.56e9, expenses: 2.58e9 },
  { month: "Oct", revenue: 3.89e9, expenses: 2.6e9 },
];

export const groupTotals = {
  revenue: companies.reduce((sum, c) => sum + c.revenue, 0),
  expenses: companies.reduce((sum, c) => sum + c.expenses, 0),
  profit: companies.reduce((sum, c) => sum + c.profit, 0),
  staff: companies.reduce((sum, c) => sum + c.staff, 0),
};

export function seriesForCompany(company: Company): MonthPoint[] {
  const revenueWeights = groupSeries.map((_, index) => 0.9 + index * 0.022);
  const expenseWeights = groupSeries.map((_, index) => 0.95 + index * 0.012);
  const revenueSum = revenueWeights.reduce((a, b) => a + b, 0);
  const expenseSum = expenseWeights.reduce((a, b) => a + b, 0);

  return groupSeries.map((point, index) => ({
    month: point.month,
    revenue: Math.round((company.revenue * revenueWeights[index]) / revenueSum),
    expenses: Math.round(
      (company.expenses * expenseWeights[index]) / expenseSum
    ),
  }));
}

export interface StaffMember {
  id: string;
  name: string;
  role: string;
  department: string;
  companyId: string;
  email: string;
  phone: string;
  status: "active" | "on-leave" | "contract";
  joined: string;
}

export const staffSeed: StaffMember[] = [
  {
    id: "s-02",
    name: "Sarah Nakato",
    role: "Managing Director",
    department: "Executive",
    companyId: "passito",
    email: "s.nakato@district12.co.ug",
    phone: "+256 772 118 902",
    status: "active",
    joined: "2021-03-08",
  },
  {
    id: "s-03",
    name: "Joseph Okello",
    role: "Managing Director",
    department: "Executive",
    companyId: "mariz",
    email: "j.okello@district12.co.ug",
    phone: "+256 701 244 118",
    status: "active",
    joined: "2020-05-11",
  },
  {
    id: "s-07",
    name: "Daniel Ssentongo",
    role: "Group Finance Manager",
    department: "Finance",
    companyId: "mariz",
    email: "d.ssentongo@district12.co.ug",
    phone: "+256 772 500 114",
    status: "active",
    joined: "2013-01-14",
  },
  {
    id: "s-08",
    name: "Esther Kirabo",
    role: "Senior Accountant",
    department: "Finance",
    companyId: "mariz",
    email: "e.kirabo@district12.co.ug",
    phone: "+256 701 889 023",
    status: "active",
    joined: "2017-08-21",
  },
  {
    id: "s-09",
    name: "Moses Tumusiime",
    role: "Project Manager",
    department: "Projects",
    companyId: "mariz",
    email: "m.tumusiime@district12.co.ug",
    phone: "+256 772 340 998",
    status: "active",
    joined: "2015-05-09",
  },
  {
    id: "s-11",
    name: "Brian Ssemakula",
    role: "Fleet Supervisor",
    department: "Operations",
    companyId: "shop-for-me",
    email: "b.ssemakula@district12.co.ug",
    phone: "+256 772 776 431",
    status: "active",
    joined: "2016-10-12",
  },
  {
    id: "s-12",
    name: "Ritah Nansubuga",
    role: "Warehouse Coordinator",
    department: "Operations",
    companyId: "shop-for-me",
    email: "r.nansubuga@district12.co.ug",
    phone: "+256 703 551 287",
    status: "active",
    joined: "2020-02-18",
  },
  {
    id: "s-17",
    name: "Ivan Mugisha",
    role: "Sales Lead",
    department: "Sales",
    companyId: "shop-for-me",
    email: "i.mugisha@district12.co.ug",
    phone: "+256 772 660 345",
    status: "active",
    joined: "2019-09-02",
  },
  {
    id: "s-18",
    name: "Patience Atim",
    role: "Procurement Officer",
    department: "Procurement",
    companyId: "expresso-point",
    email: "p.atim@district12.co.ug",
    phone: "+256 700 338 210",
    status: "contract",
    joined: "2024-05-13",
  },
  {
    id: "s-19",
    name: "Michael Kaggwa",
    role: "Operations Manager",
    department: "Operations",
    companyId: "shop-for-me",
    email: "m.kaggwa@district12.co.ug",
    phone: "+256 752 118 706",
    status: "active",
    joined: "2020-08-24",
  },
  {
    id: "s-20",
    name: "Joan Nabukenya",
    role: "Guest Experience Lead",
    department: "Front Office",
    companyId: "expresso-point",
    email: "j.nabukenya@district12.co.ug",
    phone: "+256 703 447 512",
    status: "active",
    joined: "2022-02-07",
  },
  {
    id: "s-21",
    name: "Charles Odeke",
    role: "Procurement Manager",
    department: "Procurement",
    companyId: "mariz",
    email: "c.odeke@district12.co.ug",
    phone: "+256 772 800 245",
    status: "active",
    joined: "2014-11-11",
  },
  {
    id: "s-22",
    name: "Sandra Kembabazi",
    role: "HR Officer",
    department: "People",
    companyId: "mariz",
    email: "s.kembabazi@district12.co.ug",
    phone: "+256 784 110 392",
    status: "active",
    joined: "2023-06-05",
  },
  {
    id: "s-23",
    name: "Patricia Namusoke",
    role: "Managing Director",
    department: "Executive",
    companyId: "rub-shoots",
    email: "p.namusoke@district12.co.ug",
    phone: "+256 772 551 803",
    status: "active",
    joined: "2019-06-03",
  },
  {
    id: "s-24",
    name: "Andrew Ochieng",
    role: "Managing Director",
    department: "Executive",
    companyId: "shop-for-me",
    email: "a.ochieng@district12.co.ug",
    phone: "+256 703 219 664",
    status: "active",
    joined: "2022-01-17",
  },
  {
    id: "s-25",
    name: "Hadijah Nakimuli",
    role: "Managing Director",
    department: "Executive",
    companyId: "expresso-point",
    email: "h.nakimuli@district12.co.ug",
    phone: "+256 788 640 217",
    status: "active",
    joined: "2023-05-22",
  },
];

export type TransactionType = "income" | "expense";

export interface Transaction {
  id: string;
  date: string;
  description: string;
  companyId: string;
  type: TransactionType;
  category: string;
  amount: number;
  status: "cleared" | "pending";
}

export const transactionsSeed: Transaction[] = [
  {
    id: "t-01",
    date: "2026-11-09",
    description: "Nakawa warehouse — milestone 3 payment",
    companyId: "mariz",
    type: "income",
    category: "Contracts",
    amount: 1_450_000_000,
    status: "cleared",
  },
  {
    id: "t-02",
    date: "2026-11-08",
    description: "Cement and steel — Namanve site",
    companyId: "mariz",
    type: "expense",
    category: "Materials",
    amount: 240_000_000,
    status: "cleared",
  },
  {
    id: "t-03",
    date: "2026-11-07",
    description: "Kampala Water fleet contract — November",
    companyId: "shop-for-me",
    type: "income",
    category: "Contracts",
    amount: 320_000_000,
    status: "cleared",
  },
  {
    id: "t-04",
    date: "2026-11-06",
    description: "Fuel and fleet maintenance",
    companyId: "shop-for-me",
    type: "expense",
    category: "Fuel",
    amount: 68_000_000,
    status: "cleared",
  },
  {
    id: "t-05",
    date: "2026-11-05",
    description: "Maize supply — Ugachick",
    companyId: "mariz",
    type: "income",
    category: "Sales",
    amount: 96_000_000,
    status: "cleared",
  },
  {
    id: "t-06",
    date: "2026-11-05",
    description: "Seed and fertiliser — Matugga",
    companyId: "mariz",
    type: "expense",
    category: "Materials",
    amount: 52_000_000,
    status: "pending",
  },
  {
    id: "t-07",
    date: "2026-11-04",
    description: "Rent collection — Kololo apartments",
    companyId: "mariz",
    type: "income",
    category: "Rent",
    amount: 84_000_000,
    status: "cleared",
  },
  {
    id: "t-08",
    date: "2026-11-04",
    description: "Property maintenance — Bukoto block",
    companyId: "mariz",
    type: "expense",
    category: "Maintenance",
    amount: 31_000_000,
    status: "cleared",
  },
  {
    id: "t-09",
    date: "2026-11-03",
    description: "Consumer goods distribution — Mukwano",
    companyId: "shop-for-me",
    type: "income",
    category: "Sales",
    amount: 62_000_000,
    status: "cleared",
  },
  {
    id: "t-10",
    date: "2026-11-03",
    description: "Q4 retail marketing campaign",
    companyId: "shop-for-me",
    type: "expense",
    category: "Marketing",
    amount: 18_000_000,
    status: "pending",
  },
  {
    id: "t-11",
    date: "2026-11-02",
    description: "Conference booking — Speke Resort",
    companyId: "shop-for-me",
    type: "income",
    category: "Services",
    amount: 18_000_000,
    status: "cleared",
  },
  {
    id: "t-12",
    date: "2026-11-01",
    description: "October group payroll",
    companyId: "mariz",
    type: "expense",
    category: "Payroll",
    amount: 410_000_000,
    status: "cleared",
  },
  {
    id: "t-13",
    date: "2026-10-30",
    description: "Bukasa hotel restaurant revenue",
    companyId: "shop-for-me",
    type: "income",
    category: "Services",
    amount: 46_000_000,
    status: "cleared",
  },
  {
    id: "t-14",
    date: "2026-10-29",
    description: "Utilities — group head office",
    companyId: "mariz",
    type: "expense",
    category: "Utilities",
    amount: 12_000_000,
    status: "cleared",
  },
  {
    id: "t-15",
    date: "2026-10-28",
    description: "Construction equipment hire",
    companyId: "mariz",
    type: "expense",
    category: "Equipment",
    amount: 74_000_000,
    status: "cleared",
  },
  {
    id: "t-16",
    date: "2026-10-27",
    description: "Coffee export pre-payment",
    companyId: "mariz",
    type: "income",
    category: "Sales",
    amount: 210_000_000,
    status: "cleared",
  },
  {
    id: "t-17",
    date: "2026-10-25",
    description: "Insurance premiums — fleet",
    companyId: "shop-for-me",
    type: "expense",
    category: "Insurance",
    amount: 24_000_000,
    status: "cleared",
  },
  {
    id: "t-18",
    date: "2026-10-24",
    description: "Retail depot restock",
    companyId: "shop-for-me",
    type: "expense",
    category: "Materials",
    amount: 88_000_000,
    status: "cleared",
  },
  {
    id: "t-19",
    date: "2026-10-23",
    description: "Last-mile delivery contract — Jumia",
    companyId: "shop-for-me",
    type: "income",
    category: "Contracts",
    amount: 145_000_000,
    status: "cleared",
  },
  {
    id: "t-20",
    date: "2026-10-21",
    description: "Logistics permits and licensing",
    companyId: "shop-for-me",
    type: "expense",
    category: "Permits",
    amount: 7_500_000,
    status: "cleared",
  },
  {
    id: "t-21",
    date: "2026-10-20",
    description: "Apartment refit — contractor payment",
    companyId: "mariz",
    type: "expense",
    category: "Maintenance",
    amount: 120_000_000,
    status: "pending",
  },
  {
    id: "t-22",
    date: "2026-10-18",
    description: "Event catering — corporate gala",
    companyId: "shop-for-me",
    type: "income",
    category: "Services",
    amount: 34_000_000,
    status: "cleared",
  },
];

export type ProjectStatus = "active" | "on-hold" | "completed";

export interface Project {
  id: string;
  name: string;
  companyId: string;
  client: string;
  budget: number;
  spent: number;
  progress: number;
  status: ProjectStatus;
  due: string;
}

export const projectsSeed: Project[] = [
  {
    id: "p-01",
    name: "Kunju",
    companyId: "passito",
    client: "Group venture",
    budget: 0,
    spent: 0,
    progress: 0,
    status: "active",
    due: "2027-01-31",
  },
  {
    id: "p-02",
    name: "Mariz Outsourcing (U) SMC Ltd",
    companyId: "mariz",
    client: "Group venture",
    budget: 0,
    spent: 0,
    progress: 0,
    status: "active",
    due: "2027-02-28",
  },
  {
    id: "p-03",
    name: "Shop4Me",
    companyId: "shop-for-me",
    client: "Group venture",
    budget: 0,
    spent: 0,
    progress: 0,
    status: "active",
    due: "2027-03-31",
  },
  {
    id: "p-04",
    name: "AI Filming",
    companyId: "rub-shoots",
    client: "Group venture",
    budget: 0,
    spent: 0,
    progress: 0,
    status: "active",
    due: "2027-04-30",
  },
  {
    id: "p-05",
    name: "SAAS System",
    companyId: "shop-for-me",
    client: "Group venture",
    budget: 0,
    spent: 0,
    progress: 0,
    status: "active",
    due: "2027-05-31",
  },
  {
    id: "p-06",
    name: "AI Filming Content",
    companyId: "rub-shoots",
    client: "Group venture",
    budget: 0,
    spent: 0,
    progress: 0,
    status: "active",
    due: "2027-06-30",
  },
  {
    id: "p-07",
    name: "Offline Shop (POS)",
    companyId: "shop-for-me",
    client: "Group venture",
    budget: 0,
    spent: 0,
    progress: 0,
    status: "active",
    due: "2027-07-31",
  },
  {
    id: "p-08",
    name: "Forex Trading & Sure Bets",
    companyId: "mariz",
    client: "Group venture",
    budget: 0,
    spent: 0,
    progress: 0,
    status: "active",
    due: "2027-08-31",
  },
  {
    id: "p-09",
    name: "Rubshoots Photography",
    companyId: "rub-shoots",
    client: "Group venture",
    budget: 0,
    spent: 0,
    progress: 0,
    status: "active",
    due: "2027-09-30",
  },
];

export const expenseBreakdown = [
  { name: "Payroll", value: 38, color: "#C81E1E" },
  { name: "Materials", value: 24, color: "#EA580C" },
  { name: "Fuel & logistics", value: 14, color: "#CA8A04" },
  { name: "Utilities", value: 9, color: "#0891B2" },
  { name: "Maintenance", value: 8, color: "#6D28D9" },
  { name: "Other", value: 7, color: "#4B5563" },
];

export function companyById(id: string) {
  return companies.find((company) => company.id === id);
}

export type InvoiceStatus = "paid" | "pending" | "overdue";

export interface Invoice {
  id: string;
  number: string;
  client: string;
  companyId: string;
  contactId?: string;
  amount: number;
  issued: string;
  due: string;
  status: InvoiceStatus;
}

export const invoicesSeed: Invoice[] = [
  {
    id: "inv-01",
    number: "D12-2026-041",
    client: "Kampala Water",
    companyId: "shop-for-me",
    contactId: "c-01",
    amount: 320_000_000,
    issued: "2026-10-01",
    due: "2026-10-31",
    status: "paid",
  },
  {
    id: "inv-02",
    number: "D12-2026-042",
    client: "Namanve Industrial Park",
    companyId: "mariz",
    contactId: "c-04",
    amount: 640_000_000,
    issued: "2026-10-15",
    due: "2026-11-14",
    status: "pending",
  },
  {
    id: "inv-03",
    number: "D12-2026-043",
    client: "Ugachick",
    companyId: "mariz",
    contactId: "c-03",
    amount: 96_000_000,
    issued: "2026-11-05",
    due: "2026-12-05",
    status: "pending",
  },
  {
    id: "inv-04",
    number: "D12-2026-044",
    client: "Mukwano Industries",
    companyId: "shop-for-me",
    contactId: "c-02",
    amount: 62_000_000,
    issued: "2026-09-20",
    due: "2026-10-20",
    status: "overdue",
  },
  {
    id: "inv-05",
    number: "D12-2026-045",
    client: "Kololo Business Park",
    companyId: "mariz",
    contactId: "c-08",
    amount: 84_000_000,
    issued: "2026-11-04",
    due: "2026-12-04",
    status: "pending",
  },
  {
    id: "inv-06",
    number: "D12-2026-046",
    client: "Kampala Serena",
    companyId: "expresso-point",
    contactId: "c-09",
    amount: 18_000_000,
    issued: "2026-10-20",
    due: "2026-11-19",
    status: "pending",
  },
  {
    id: "inv-07",
    number: "D12-2026-047",
    client: "National Housing",
    companyId: "mariz",
    contactId: "c-07",
    amount: 2_400_000_000,
    issued: "2026-10-26",
    due: "2026-11-25",
    status: "pending",
  },
  {
    id: "inv-08",
    number: "D12-2026-048",
    client: "Jumia Uganda",
    companyId: "shop-for-me",
    contactId: "c-05",
    amount: 145_000_000,
    issued: "2026-10-23",
    due: "2026-11-06",
    status: "overdue",
  },
  {
    id: "inv-09",
    number: "D12-2026-049",
    client: "Stanbic Properties",
    companyId: "mariz",
    contactId: "c-13",
    amount: 860_000_000,
    issued: "2026-09-30",
    due: "2026-10-30",
    status: "overdue",
  },
  {
    id: "inv-10",
    number: "D12-2026-050",
    client: "Bukasa Events Co",
    companyId: "expresso-point",
    contactId: "c-10",
    amount: 34_000_000,
    issued: "2026-09-15",
    due: "2026-10-15",
    status: "paid",
  },
];

export type AccountRole = "admin" | "manager" | "staff";
export type AccountStatus = "active" | "suspended";

export interface Account {
  id: string;
  name: string;
  email: string;
  role: AccountRole;
  companyId: string;
  status: AccountStatus;
  createdAt: string;
  lastActive: string;
}

export const accountsSeed: Account[] = [
  {
    id: "ac-01",
    name: "Marvin Ssempebwa",
    email: "marvin@district12.co.ug",
    role: "admin",
    companyId: "",
    status: "active",
    createdAt: "2026-01-05",
    lastActive: "2026-11-11",
  },
  {
    id: "ac-06",
    name: "Sarah Nakato",
    email: "s.nakato@district12.co.ug",
    role: "manager",
    companyId: "passito",
    status: "active",
    createdAt: "2026-02-02",
    lastActive: "2026-11-07",
  },
  {
    id: "ac-07",
    name: "Joseph Okello",
    email: "j.okello@district12.co.ug",
    role: "manager",
    companyId: "mariz",
    status: "active",
    createdAt: "2026-02-02",
    lastActive: "2026-11-05",
  },
  {
    id: "ac-08",
    name: "Patricia Namusoke",
    email: "p.namusoke@district12.co.ug",
    role: "manager",
    companyId: "rub-shoots",
    status: "active",
    createdAt: "2026-02-02",
    lastActive: "2026-11-04",
  },
  {
    id: "ac-09",
    name: "Andrew Ochieng",
    email: "a.ochieng@district12.co.ug",
    role: "manager",
    companyId: "shop-for-me",
    status: "active",
    createdAt: "2026-02-02",
    lastActive: "2026-11-09",
  },
  {
    id: "ac-10",
    name: "Hadijah Nakimuli",
    email: "h.nakimuli@district12.co.ug",
    role: "manager",
    companyId: "expresso-point",
    status: "suspended",
    createdAt: "2026-02-02",
    lastActive: "2026-10-21",
  },
  {
    id: "ac-11",
    name: "Sandra Kembabazi",
    email: "s.kembabazi@district12.co.ug",
    role: "staff",
    companyId: "mariz",
    status: "active",
    createdAt: "2026-03-16",
    lastActive: "2026-11-10",
  },
  {
    id: "ac-12",
    name: "Ivan Mugisha",
    email: "i.mugisha@district12.co.ug",
    role: "staff",
    companyId: "shop-for-me",
    status: "active",
    createdAt: "2026-03-16",
    lastActive: "2026-11-09",
  },
  {
    id: "ac-13",
    name: "Michael Kaggwa",
    email: "m.kaggwa@district12.co.ug",
    role: "staff",
    companyId: "shop-for-me",
    status: "active",
    createdAt: "2026-04-06",
    lastActive: "2026-11-08",
  },
  {
    id: "ac-14",
    name: "Joan Nabukenya",
    email: "j.nabukenya@district12.co.ug",
    role: "staff",
    companyId: "expresso-point",
    status: "active",
    createdAt: "2026-04-06",
    lastActive: "2026-11-07",
  },
];

export interface InventoryItem {
  id: string;
  sku: string;
  name: string;
  category: string;
  companyId: string;
  quantity: number;
  reorderLevel: number;
  unitCost: number;
  supplier: string;
  updated: string;
}

export const inventorySeed: InventoryItem[] = [
  {
    id: "i-01",
    sku: "CEM-50",
    name: "Cement 50kg",
    category: "Construction materials",
    companyId: "mariz",
    quantity: 480,
    reorderLevel: 100,
    unitCost: 38_000,
    supplier: "Hima Cement",
    updated: "2026-11-08",
  },
  {
    id: "i-02",
    sku: "STL-12",
    name: "Steel bars 12mm",
    category: "Construction materials",
    companyId: "mariz",
    quantity: 54,
    reorderLevel: 60,
    unitCost: 64_000,
    supplier: "Roofings Group",
    updated: "2026-11-07",
  },
  {
    id: "i-03",
    sku: "MAZ-100",
    name: "Maize grain (100kg)",
    category: "Agriculture",
    companyId: "mariz",
    quantity: 85,
    reorderLevel: 40,
    unitCost: 185_000,
    supplier: "Matugga out-growers",
    updated: "2026-11-05",
  },
  {
    id: "i-04",
    sku: "PNT-20",
    name: "Emulsion paint 20L",
    category: "Maintenance",
    companyId: "mariz",
    quantity: 32,
    reorderLevel: 10,
    unitCost: 210_000,
    supplier: "Sadolin",
    updated: "2026-11-03",
  },
  {
    id: "i-05",
    sku: "PVC-32",
    name: "PVC pipes 32mm",
    category: "Maintenance",
    companyId: "mariz",
    quantity: 42,
    reorderLevel: 50,
    unitCost: 24_000,
    supplier: "Plastics Uganda",
    updated: "2026-10-29",
  },
  {
    id: "i-06",
    sku: "LPT-14",
    name: "Laptop 14 inch",
    category: "Office equipment",
    companyId: "shop-for-me",
    quantity: 18,
    reorderLevel: 5,
    unitCost: 2_850_000,
    supplier: "Tech Hub Uganda",
    updated: "2026-11-02",
  },
  {
    id: "i-07",
    sku: "PRN-01",
    name: "Multifunction printer",
    category: "Office equipment",
    companyId: "shop-for-me",
    quantity: 2,
    reorderLevel: 2,
    unitCost: 1_450_000,
    supplier: "Tech Hub Uganda",
    updated: "2026-10-18",
  },
  {
    id: "i-08",
    sku: "DRK-500",
    name: "Energy drink 500ml",
    category: "Beverages",
    companyId: "shop-for-me",
    quantity: 960,
    reorderLevel: 300,
    unitCost: 2_500,
    supplier: "Don Boost plant",
    updated: "2026-11-10",
  },
  {
    id: "i-09",
    sku: "BTL-500",
    name: "PET bottles 500ml",
    category: "Packaging",
    companyId: "shop-for-me",
    quantity: 4_200,
    reorderLevel: 1_000,
    unitCost: 350,
    supplier: "Plastics Uganda",
    updated: "2026-11-09",
  },
  {
    id: "i-10",
    sku: "SGR-50",
    name: "Sugar 50kg",
    category: "Raw materials",
    companyId: "shop-for-me",
    quantity: 18,
    reorderLevel: 25,
    unitCost: 165_000,
    supplier: "Kakira Sugar",
    updated: "2026-11-06",
  },
  {
    id: "i-11",
    sku: "BNR-3",
    name: "Banner roll 3m",
    category: "Marketing materials",
    companyId: "passito",
    quantity: 26,
    reorderLevel: 10,
    unitCost: 95_000,
    supplier: "PrintWorks",
    updated: "2026-11-04",
  },
  {
    id: "i-12",
    sku: "FLY-A5",
    name: "Flyers A5 (1,000)",
    category: "Marketing materials",
    companyId: "passito",
    quantity: 12,
    reorderLevel: 15,
    unitCost: 120_000,
    supplier: "PrintWorks",
    updated: "2026-11-01",
  },
  {
    id: "i-13",
    sku: "BOX-M",
    name: "Packaging boxes (medium)",
    category: "Packaging",
    companyId: "shop-for-me",
    quantity: 560,
    reorderLevel: 150,
    unitCost: 1_800,
    supplier: "Kampala Packaging",
    updated: "2026-11-09",
  },
  {
    id: "i-14",
    sku: "SDC-128",
    name: "SD card 128GB",
    category: "Media equipment",
    companyId: "rub-shoots",
    quantity: 5,
    reorderLevel: 6,
    unitCost: 95_000,
    supplier: "Foto Supplies",
    updated: "2026-11-02",
  },
  {
    id: "i-15",
    sku: "COF-1",
    name: "Coffee beans 1kg",
    category: "Beverages",
    companyId: "expresso-point",
    quantity: 46,
    reorderLevel: 20,
    unitCost: 42_000,
    supplier: "Uganda Coffee",
    updated: "2026-11-10",
  },
  {
    id: "i-16",
    sku: "CUP-8",
    name: "Paper cups 8oz (50)",
    category: "Packaging",
    companyId: "expresso-point",
    quantity: 60,
    reorderLevel: 80,
    unitCost: 6_500,
    supplier: "Kampala Packaging",
    updated: "2026-11-08",
  },
];
