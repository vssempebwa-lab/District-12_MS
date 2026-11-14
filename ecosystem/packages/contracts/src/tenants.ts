export const TENANT_IDS = [
  "passito",
  "mariz",
  "rub-shoots",
  "shop-for-me",
  "expresso-point",
] as const;

export type TenantId = (typeof TENANT_IDS)[number];

export interface TenantMeta {
  id: TenantId;
  name: string;
  shortName: string;
  sector: string;
  mark: string;
  color: string;
  accent?: string;
  logo?: string;
  tagline: string;
  managingDirector: string;
  domain: string;
  port: number;
}

export const TENANTS: Record<TenantId, TenantMeta> = {
  passito: {
    id: "passito",
    name: "Passito Marketing",
    shortName: "Passito",
    sector: "Marketing & advertising",
    mark: "PTO",
    color: "#333F4B",
    accent: "#25B1E6",
    logo: "/brand/passito-mark.png",
    tagline: "Brand campaigns that move markets",
    managingDirector: "Sarah Nakato",
    domain: "passito.district12.co.ug",
    port: 3001,
  },
  mariz: {
    id: "mariz",
    name: "Mariz Outsourcing (U) SMC Ltd",
    shortName: "Mariz",
    sector: "Outsourcing & staffing",
    mark: "M",
    color: "#10112C",
    accent: "#1C7EC2",
    logo: "/brand/mariz-mark.png",
    tagline: "People operations, outsourced with care",
    managingDirector: "Joseph Okello",
    domain: "mariz.district12.co.ug",
    port: 3002,
  },
  "rub-shoots": {
    id: "rub-shoots",
    name: "Rub Shoots Photography",
    shortName: "Rub Shoots",
    sector: "Photography & media",
    mark: "RS",
    color: "#BE185D",
    tagline: "Stories framed for the long run",
    managingDirector: "Patricia Namusoke",
    domain: "rubshoots.district12.co.ug",
    port: 3003,
  },
  "shop-for-me": {
    id: "shop-for-me",
    name: "Shop For Me",
    shortName: "Shop For Me",
    sector: "Retail & e-commerce",
    mark: "SF",
    color: "#2A2927",
    accent: "#02A6DB",
    logo: "/brand/shop-for-me-mark.png",
    tagline: "Personal shopping, delivered",
    managingDirector: "Andrew Ochieng",
    domain: "shopforme.district12.co.ug",
    port: 3004,
  },
  "expresso-point": {
    id: "expresso-point",
    name: "Expresso Point",
    shortName: "Expresso",
    sector: "Coffee & hospitality",
    mark: "EP",
    color: "#92400E",
    tagline: "The daily cup, done properly",
    managingDirector: "Hadijah Nakimuli",
    domain: "expresso.district12.co.ug",
    port: 3005,
  },
};

// Literal env lookups so Next.js can inline these in client bundles.
const APP_URLS: Record<TenantId, string | undefined> = {
  passito: process.env.NEXT_PUBLIC_D12_PASSITO_URL,
  mariz: process.env.NEXT_PUBLIC_D12_MARIZ_URL,
  "rub-shoots": process.env.NEXT_PUBLIC_D12_RUB_SHOOTS_URL,
  "shop-for-me": process.env.NEXT_PUBLIC_D12_SHOP_FOR_ME_URL,
  "expresso-point": process.env.NEXT_PUBLIC_D12_EXPRESSO_POINT_URL,
};

export function isTenantId(value: string): value is TenantId {
  return (TENANT_IDS as readonly string[]).includes(value);
}

export function tenantMeta(id: string): TenantMeta | undefined {
  return isTenantId(id) ? TENANTS[id] : undefined;
}

export function tenantAppUrl(id: TenantId): string {
  return APP_URLS[id] ?? `http://localhost:${TENANTS[id].port}`;
}

export function hubAppUrl(): string {
  return process.env.NEXT_PUBLIC_D12_HUB_URL ?? "http://localhost:3100";
}

export function tenantSecretEnvKey(id: TenantId): string {
  return `D12_TENANT_${id.toUpperCase().replaceAll("-", "_")}_SECRET`;
}
