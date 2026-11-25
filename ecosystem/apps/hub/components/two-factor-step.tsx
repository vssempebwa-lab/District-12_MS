"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Loader2, MailCheck } from "lucide-react";
import { Alert } from "@d12/ui";

const inputClass =
  "mt-1.5 h-12 w-full rounded-lg border border-transparent bg-[#F3F5F8] px-3.5 text-center font-mono text-2xl font-semibold tracking-[0.5em] text-ink outline-none transition-colors placeholder:text-ink-mute/60 focus:border-brand/30 focus:bg-white focus:ring-4 focus:ring-brand/10";

interface ErrorBody {
  ok?: boolean;
  redirect?: string;
  email?: string;
  resendAfter?: number;
  error?: { message?: string; details?: { restart?: boolean } };
}

export function TwoFactorStep({
  email,
  resendAfter,
  onRestart,
}: {
  email: string;
  resendAfter: number;
  onRestart: (message?: string) => void;
}) {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [resending, setResending] = useState(false);
  const [wait, setWait] = useState(resendAfter);
  const [sentTo, setSentTo] = useState(email);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (wait <= 0) return;
    const timer = window.setTimeout(() => setWait((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [wait]);

  function handleFailure(body: ErrorBody | null, fallback: string): void {
    const message = body?.error?.message ?? fallback;
    if (body?.error?.details?.restart) {
      onRestart(message);
      return;
    }
    setError(message);
    setCode("");
    inputRef.current?.focus();
  }

  async function verify(value: string): Promise<void> {
    if (pending) return;
    setPending(true);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch("/api/auth/two-factor", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code: value }),
      });
      const body = (await response.json().catch(() => null)) as ErrorBody | null;
      if (!response.ok || !body?.redirect) {
        handleFailure(body, "Could not check the code. Try again.");
        return;
      }
      window.location.assign(body.redirect);
    } catch {
      setError("Network error — check your connection and try again.");
    } finally {
      setPending(false);
    }
  }

  async function resend(): Promise<void> {
    setResending(true);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch("/api/auth/two-factor/resend", { method: "POST" });
      const body = (await response.json().catch(() => null)) as ErrorBody | null;
      if (!response.ok) {
        handleFailure(body, "A new code could not be sent. Try again.");
        return;
      }
      setSentTo(body?.email ?? sentTo);
      setWait(body?.resendAfter ?? 30);
      setCode("");
      setNotice("A new code is on its way. Earlier codes no longer work.");
      inputRef.current?.focus();
    } catch {
      setError("Network error — check your connection and try again.");
    } finally {
      setResending(false);
    }
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void verify(code);
      }}
      className="space-y-4"
    >
      <div className="flex items-start gap-3 rounded-lg border border-line bg-canvas/70 p-3">
        <MailCheck className="mt-0.5 h-5 w-5 shrink-0 text-brand" aria-hidden="true" />
        <p className="text-[13px] leading-relaxed text-ink-soft">
          We emailed a 6-digit code to <span className="font-semibold text-ink">{sentTo}</span>. It expires in
          10 minutes.
        </p>
      </div>

      <label className="block">
        <span className="block text-[13px] font-medium text-ink-soft">Sign-in code</span>
        <input
          ref={inputRef}
          value={code}
          onChange={(event) => {
            const next = event.target.value.replace(/\D/g, "").slice(0, 6);
            setCode(next);
            if (next.length === 6) void verify(next);
          }}
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="\d{6}"
          maxLength={6}
          placeholder="000000"
          aria-describedby="two-factor-help"
          autoFocus
          required
          className={inputClass}
        />
      </label>

      {error ? <Alert tone="danger">{error}</Alert> : null}
      {notice && !error ? <Alert tone="success">{notice}</Alert> : null}

      <button
        type="submit"
        disabled={pending || code.length !== 6}
        className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-brand text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-600 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand/20 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        {pending ? "Checking code" : "Verify and sign in"}
        {!pending ? <ArrowRight className="h-4 w-4" /> : null}
      </button>

      <div id="two-factor-help" className="flex items-center justify-between gap-3 text-[12px]">
        <button
          type="button"
          onClick={() => onRestart()}
          className="flex items-center gap-1 font-medium text-ink-soft transition-colors hover:text-ink"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Use a different account
        </button>
        <button
          type="button"
          onClick={() => void resend()}
          disabled={wait > 0 || resending}
          className="font-semibold text-royal transition-colors hover:underline disabled:cursor-not-allowed disabled:font-medium disabled:text-ink-mute disabled:no-underline"
        >
          {resending ? "Sending…" : wait > 0 ? `Resend code in ${wait}s` : "Resend code"}
        </button>
      </div>
    </form>
  );
}
