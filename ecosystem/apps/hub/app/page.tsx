import { redirect } from "next/navigation";
import { claimsToUser, createSessionToken, landingFor, tenantCallbackUrl } from "@d12/auth";
import { configuredTenantAppUrl } from "@d12/contracts";
import { getHubSession } from "@/lib/session-server";

export default async function HomePage() {
  const session = await getHubSession();
  if (!session) redirect("/login");

  const landing = landingFor(session);
  if (landing.kind === "hub") redirect(landing.path);

  if (!configuredTenantAppUrl(landing.tenant)) redirect("/dashboard");

  const token = await createSessionToken(claimsToUser(session));
  redirect(tenantCallbackUrl(token, landing.tenant, landing.path));
}
