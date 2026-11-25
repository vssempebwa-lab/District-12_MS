import { redirect } from "next/navigation";
import {
  DEMO_ACCOUNTS,
  DEMO_PASSWORD,
  claimsToUser,
  createSessionToken,
  isDemoMode,
  landingFor,
  tenantCallbackUrl,
} from "@d12/auth";
import { LoginForm } from "@/components/login-form";
import { LoginStatus } from "@/components/login-status";
import { getHubSession } from "@/lib/session-server";

export const metadata = { title: "Sign in — District 12" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const session = await getHubSession();
  if (session?.mustChangePassword) redirect("/account/password");
  if (session) {
    const landing = landingFor(session);
    if (landing.kind === "hub") redirect(landing.path);
    const token = await createSessionToken(claimsToUser(session));
    redirect(tenantCallbackUrl(token, landing.tenant, landing.path));
  }

  const nextParam = searchParams.next;
  const next = typeof nextParam === "string" && nextParam.startsWith("/") ? nextParam : "";

  const demo = isDemoMode()
    ? {
        password: DEMO_PASSWORD,
        accounts: DEMO_ACCOUNTS.map(({ id, email, title }) => ({ id, email, title })),
      }
    : null;

  return (
    <main className="relative flex min-h-screen flex-col overflow-hidden bg-canvas">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="absolute -left-64 -top-48 h-[680px] w-[760px] rotate-[18deg] bg-gradient-to-br from-white via-[#F0F3F8] to-[#E5EAF2]"
          style={{ clipPath: "polygon(0 0, 100% 0, 82% 100%, 0 78%)" }}
        />
        <div
          className="absolute -bottom-56 left-[6%] h-[560px] w-[600px] -rotate-6 bg-gradient-to-tr from-[#ECF0F6] to-white"
          style={{ clipPath: "polygon(14% 0, 100% 22%, 78% 100%, 0 86%)" }}
        />
        <div
          className="absolute right-[40%] top-[14%] h-72 w-80 rotate-12 bg-gradient-to-br from-white to-[#EDF1F7]"
          style={{ clipPath: "polygon(50% 0, 100% 38%, 72% 100%, 0 62%)" }}
        />
        <div className="absolute inset-y-0 right-0 hidden w-[54%] overflow-hidden border-l border-white/60 lg:block xl:w-[48%]">
          <img
            src="/login/office-lobby.jpg"
            alt=""
            className="h-full w-full object-cover object-center"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-canvas via-canvas/70 to-white/10" />
          <div className="absolute inset-0 bg-white/25" />
        </div>
        <img
          src="/brand/district12-lockup.png"
          alt=""
          className="absolute right-[7%] top-1/2 hidden w-60 -translate-y-1/2 opacity-[0.22] lg:block"
        />
      </div>

      <header className="relative z-10 flex h-14 shrink-0 items-center justify-between gap-4 border-b border-line/70 px-4 sm:px-8">
        <div className="flex items-center gap-2.5">
          <img
            src="/brand/district12-mark.png"
            alt=""
            className="h-7 w-7 shrink-0 rounded-md object-cover"
          />
          <span className="hidden text-[10px] font-semibold uppercase tracking-[0.2em] text-ink-soft sm:block">
            District 12 Group
          </span>
        </div>
        <LoginStatus />
      </header>

      <div className="relative z-10 flex flex-1 items-center justify-center px-4 py-10 sm:px-8">
        <div className="relative w-full max-w-[400px]">
          <div className="relative rounded-2xl border border-line bg-white p-7 shadow-[0_28px_70px_-20px_rgba(11,26,60,0.25)] sm:p-8">
            <img
              src="/brand/district12-lockup.png"
              alt="The District 12 Group of Companies"
              className="mx-auto h-12 w-auto sm:h-14"
            />
            <h1 className="mt-6 text-center text-[22px] font-semibold tracking-tight text-navy">
              D12 Enterprise Login
            </h1>
            <p className="mt-1.5 text-center text-xs text-ink-soft">
              Sign in with your group account.
            </p>

            <div className="mt-6">
              <LoginForm next={next} demo={demo} />
            </div>

            <p className="mt-6 border-t border-line pt-4 text-center text-[11px] leading-relaxed text-ink-soft">
              Need access? Contact{" "}
              <a
                href="mailto:hr@district12.co.ug"
                className="font-semibold text-royal hover:underline"
              >
                District 12 HR Admin
              </a>
              .
            </p>
          </div>
        </div>
      </div>

      <footer className="relative z-10 shrink-0 border-t border-line/70 px-4 py-4 text-center text-[11px] text-ink-mute">
        District 12 CRM v1.0
        <span className="mx-2 text-line">|</span>© {new Date().getFullYear()} District 12. All
        Rights Reserved.
      </footer>
    </main>
  );
}
