"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";

const labelClass = "block text-[13px] font-medium text-ink-soft";
const inputClass =
  "mt-1.5 h-11 w-full rounded-lg border border-transparent bg-[#F3F5F8] px-3.5 text-sm text-ink outline-none transition-colors placeholder:text-ink-mute focus:border-brand/30 focus:bg-white focus:ring-4 focus:ring-brand/10";

export function PasswordChangeForm() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (newPassword.length < 8) {
      setError("Use at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("The new passwords do not match.");
      return;
    }
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/auth/password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const body = (await response.json().catch(() => null)) as
        | { ok?: boolean; redirect?: string; error?: { message?: string } }
        | null;
      if (!response.ok || !body?.redirect) {
        setError(body?.error?.message ?? "The password could not be changed.");
        return;
      }
      window.location.assign(body.redirect);
    } catch {
      setError("Network error — check your connection and try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <label className="block">
        <span className={labelClass}>Temporary password</span>
        <input
          type="password"
          value={currentPassword}
          onChange={(event) => setCurrentPassword(event.target.value)}
          autoComplete="current-password"
          required
          className={inputClass}
        />
      </label>
      <label className="block">
        <span className={labelClass}>New password</span>
        <input
          type="password"
          value={newPassword}
          onChange={(event) => setNewPassword(event.target.value)}
          autoComplete="new-password"
          required
          minLength={8}
          className={inputClass}
        />
      </label>
      <label className="block">
        <span className={labelClass}>Confirm new password</span>
        <input
          type="password"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          autoComplete="new-password"
          required
          className={inputClass}
        />
      </label>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <button
        type="submit"
        disabled={pending}
        className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-navy text-sm font-semibold text-white disabled:opacity-60"
      >
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        Save password
      </button>
    </form>
  );
}
