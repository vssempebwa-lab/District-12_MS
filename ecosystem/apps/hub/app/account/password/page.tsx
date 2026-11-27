import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, claimsToUser, createSessionToken, landingFor, readSessionToken, tenantCallbackUrl } from "@d12/auth";
import { configuredTenantAppUrl } from "@d12/contracts";
import { PasswordChangeForm } from "@/components/password-change-form";

export const metadata = { title: "Choose a password — District 12" };

export default async function PasswordChangePage() {
  const token = cookies().get(SESSION_COOKIE)?.value;
  const session = token ? await readSessionToken(token) : null;
  if (!session) redirect("/login?next=/account/password");
  if (!session.mustChangePassword) {
    const landing = landingFor(session);
    if (landing.kind === "hub") redirect(landing.path);
    if (configuredTenantAppUrl(landing.tenant)) {
      redirect(tenantCallbackUrl(await createSessionToken(claimsToUser(session)), landing.tenant, landing.path));
    }
    redirect("/dashboard");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-canvas px-4 py-10">
      <div className="w-full max-w-[400px] rounded-2xl border border-line bg-white p-7 shadow-[0_28px_70px_-20px_rgba(11,26,60,0.25)] sm:p-8">
        <img src="/brand/district12-lockup.png" alt="The District 12 Group of Companies" className="mx-auto h-12 w-auto" />
        <h1 className="mt-6 text-center text-[22px] font-semibold tracking-tight text-navy">Choose a new password</h1>
        <p className="mt-1.5 text-center text-xs text-ink-soft">
          The temporary password from your email works once. Choose a password only you know before District 12 opens.
        </p>
        <div className="mt-6">
          <PasswordChangeForm />
        </div>
      </div>
    </main>
  );
}
