"use client";

import { useState } from "react";
import { ArrowRight, ChevronDown, Eye, EyeOff, Loader2, ShieldCheck } from "lucide-react";
import { Alert } from "@d12/ui";
import { TwoFactorStep } from "@/components/two-factor-step";

const labelClass = "block text-[13px] font-medium text-ink-soft";
const inputClass =
  "mt-1.5 h-11 w-full rounded-lg border border-transparent bg-[#F3F5F8] px-3.5 text-sm text-ink outline-none transition-colors placeholder:text-ink-mute focus:border-brand/30 focus:bg-white focus:ring-4 focus:ring-brand/10";

export interface DemoDirectory {
  password: string;
  accounts: Array<{ id: string; email: string; title: string }>;
}

export function LoginForm({ next, demo }: { next: string; demo?: DemoDirectory | null }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState(demo?.password ?? "");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [challenge, setChallenge] = useState<{ email: string; resendAfter: number } | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password, next }),
      });
      const body = (await response.json().catch(() => null)) as
        | {
            ok?: boolean;
            redirect?: string;
            twoFactor?: boolean;
            email?: string;
            resendAfter?: number;
            error?: { message?: string };
          }
        | null;
      if (response.ok && body?.twoFactor) {
        setChallenge({ email: body.email ?? email, resendAfter: body.resendAfter ?? 30 });
        return;
      }
      if (!response.ok || !body?.redirect) {
        setError(body?.error?.message ?? "Could not sign in. Try again.");
        return;
      }
      window.location.assign(body.redirect);
    } catch {
      setError("Network error — check your connection and try again.");
    } finally {
      setPending(false);
    }
  }

  if (challenge) {
    return (
      <TwoFactorStep
        email={challenge.email}
        resendAfter={challenge.resendAfter}
        onRestart={(message) => {
          setChallenge(null);
          setPassword(demo?.password ?? "");
          setError(message ?? null);
        }}
      />
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <label className="block">
        <span className={labelClass}>Work email</span>
        <input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="jdoe@district12.co.ug"
          autoComplete="username"
          autoFocus
          required
          className={inputClass}
        />
      </label>

      <label className="block">
        <span className={labelClass}>Password</span>
        <div className="relative">
          <input
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            required
            className={`${inputClass} pr-11`}
          />
          <button
            type="button"
            onClick={() => setShowPassword((value) => !value)}
            aria-label={showPassword ? "Hide password" : "Show password"}
            aria-pressed={showPassword}
            className="absolute inset-y-0 right-2 z-10 flex items-center justify-center rounded-md px-2 text-ink-soft transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30"
          >
            {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
          </button>
        </div>
      </label>

      {error ? <Alert tone="danger">{error}</Alert> : null}

      <button
        type="submit"
        disabled={pending}
        className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-brand text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-600 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand/20 disabled:cursor-progress disabled:opacity-90"
      >
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        {pending ? "Verifying credentials" : "Sign in"}
        {!pending ? <ArrowRight className="h-4 w-4" /> : null}
      </button>

      {pending ? (
        <div>
          <div className="h-1 overflow-hidden rounded-full bg-line">
            <div className="login-verify h-full w-full rounded-full" />
          </div>
          <p className="mt-2 text-center text-[11px] text-ink-soft">
            Verifying credentials and loading environment…
          </p>
        </div>
      ) : null}

      {demo ? (
        <details className="group rounded-lg border border-line bg-canvas/70 px-3 py-2">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-[10px] font-semibold uppercase tracking-wide text-ink-soft [&::-webkit-details-marker]:hidden">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="h-3 w-3 text-emerald-600" />
              Demo directory
            </span>
            <ChevronDown className="h-3.5 w-3.5 transition-transform group-open:rotate-180" />
          </summary>
          <div className="mt-2 max-h-44 space-y-1 overflow-y-auto pr-1">
            {demo.accounts.map((account) => (
              <button
                key={account.id}
                type="button"
                onClick={() => {
                  setEmail(account.email);
                  setPassword(demo.password);
                  setError(null);
                }}
                className="flex w-full items-center justify-between gap-3 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-white"
              >
                <span className="min-w-0">
                  <span className="block truncate text-xs font-medium text-ink">{account.email}</span>
                  <span className="block truncate text-[11px] text-ink-mute">{account.title}</span>
                </span>
                <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-ink-mute">
                  Use
                </span>
              </button>
            ))}
          </div>
        </details>
      ) : null}
    </form>
  );
}
