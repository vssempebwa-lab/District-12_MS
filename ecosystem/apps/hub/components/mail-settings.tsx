"use client";

import { useEffect, useState } from "react";
import { Alert, Button, Field, Input, Panel } from "@d12/ui";

interface MailSettingsView {
  host: string;
  port: number;
  username: string;
  from: string;
  passwordSet: boolean;
}

const empty: MailSettingsView = { host: "", port: 587, username: "", from: "", passwordSet: false };

export function MailSettings() {
  const [settings, setSettings] = useState(empty);
  const [password, setPassword] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/settings/mail", { cache: "no-store" })
      .then(async (response) => {
        const body = (await response.json().catch(() => null)) as { settings?: MailSettingsView; error?: { message?: string } } | null;
        if (!response.ok) throw new Error(body?.error?.message ?? "Mail settings could not be loaded");
        if (!cancelled && body?.settings) setSettings(body.settings);
      })
      .catch((loadError: Error) => {
        if (!cancelled) setError(loadError.message);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function save(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setBusy(true);
    setNotice(null);
    setError(null);
    try {
      const response = await fetch("/api/settings/mail", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...settings, password }),
      });
      const body = (await response.json().catch(() => null)) as { settings?: MailSettingsView; error?: { message?: string } } | null;
      if (!response.ok || !body?.settings) {
        setError(body?.error?.message ?? "Mail settings could not be saved");
        return;
      }
      setSettings(body.settings);
      setPassword("");
      setNotice(body.settings.passwordSet ? "Mail settings saved." : "Mail settings saved. Add the SMTP password before sending credentials.");
    } finally {
      setBusy(false);
    }
  }

  async function sendTest(): Promise<void> {
    setBusy(true);
    setNotice(null);
    setError(null);
    try {
      const response = await fetch("/api/settings/mail", { method: "POST" });
      const body = (await response.json().catch(() => null)) as { mail?: { sent?: boolean; detail?: string }; error?: { message?: string } } | null;
      const detail = body?.mail?.detail ?? body?.error?.message ?? "The test email could not be sent.";
      if (body?.mail?.sent) setNotice(detail);
      else setError(detail);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Panel title="Sign-in email" subtitle="SMTP used when HR creates a sign-in. The password stays hidden after it is saved.">
      <form onSubmit={save} className="grid gap-3 sm:grid-cols-2">
        <Field label="SMTP host">
          <Input value={settings.host} onChange={(event) => setSettings({ ...settings, host: event.target.value })} placeholder="mail.example.com" />
        </Field>
        <Field label="Port">
          <Input type="number" min={1} max={65535} value={settings.port} onChange={(event) => setSettings({ ...settings, port: Number(event.target.value) })} />
        </Field>
        <Field label="Username">
          <Input value={settings.username} onChange={(event) => setSettings({ ...settings, username: event.target.value })} autoComplete="off" />
        </Field>
        <Field label="From address">
          <Input type="email" value={settings.from} onChange={(event) => setSettings({ ...settings, from: event.target.value })} placeholder="hr@district12.co.ug" />
        </Field>
        <Field label="Password" className="sm:col-span-2">
          <Input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="new-password"
            placeholder={settings.passwordSet ? "Saved. Leave blank to keep it." : "SMTP password"}
          />
        </Field>
        {notice ? <Alert tone="success" className="sm:col-span-2">{notice}</Alert> : null}
        {error ? <Alert tone="danger" className="sm:col-span-2">{error}</Alert> : null}
        <div className="flex flex-wrap gap-2 sm:col-span-2">
          <Button type="submit" disabled={busy} className="bg-royal hover:bg-royal-600">{busy ? "Saving…" : "Save mail settings"}</Button>
          <Button type="button" variant="secondary" disabled={busy} onClick={sendTest}>Send test email to vssempebwa@gmail.com</Button>
        </div>
      </form>
    </Panel>
  );
}
