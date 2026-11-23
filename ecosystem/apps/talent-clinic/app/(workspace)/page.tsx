import { redirect } from "next/navigation";
import { requireTenantPage } from "@d12/tenant-workspace/server";
import { TENANT_ID } from "@/lib/tenant";

export const dynamic = "force-dynamic";

export default async function OverviewPage() {
  await requireTenantPage(TENANT_ID);
  redirect("/dashboard/");
}