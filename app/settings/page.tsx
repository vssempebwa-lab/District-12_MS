"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { Building2, Save, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useSystem } from "@/components/system-provider";

const SETTINGS_KEY = "d12-settings";

const defaultProfile = {
  name: "The District 12 Group of Companies",
  registration: "80010004521",
  headquarters: "Plot 12, Yusuf Lule Road, Kampala",
  email: "finance@district12.co.ug",
  phone: "+256 772 100 120",
  fiscalYear: "31 December",
  currency: "UGX — Ugandan Shilling",
};

const defaultAlerts = {
  weeklySummary: true,
  transactionApprovals: true,
  projectDeadlines: true,
  monthlyStatements: false,
};

type Settings = {
  profile: typeof defaultProfile;
  alerts: typeof defaultAlerts;
};

export default function SettingsPage() {
  const { companies } = useSystem();
  const [profile, setProfile] = useState(defaultProfile);
  const [alerts, setAlerts] = useState(defaultAlerts);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(SETTINGS_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw) as Partial<Settings>;
      if (saved.profile) setProfile({ ...defaultProfile, ...saved.profile });
      if (saved.alerts) setAlerts({ ...defaultAlerts, ...saved.alerts });
    } catch {
      // Ignore malformed saved settings and keep defaults.
    }
  }, []);

  function save() {
    try {
      window.localStorage.setItem(
        SETTINGS_KEY,
        JSON.stringify({ profile, alerts } satisfies Settings)
      );
      toast.success("Group settings saved");
    } catch {
      toast.error("Could not save settings in this browser");
    }
  }

  return (
    <div>
      <PageHeader
        title="Settings"
        description="Group profile, reporting defaults and notification preferences."
      >
        <Button onClick={save}>
          <Save className="h-3.5 w-3.5" />
          Save changes
        </Button>
      </PageHeader>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader>
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-primary" />
                  Group profile
                </CardTitle>
                <CardDescription>Legal and contact details used across reports</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label htmlFor="group-name">Registered group name</Label>
                <Input
                  id="group-name"
                  value={profile.name}
                  onChange={(event) => setProfile({ ...profile, name: event.target.value })}
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label htmlFor="group-registration">Registration number</Label>
                  <Input
                    id="group-registration"
                    value={profile.registration}
                    onChange={(event) =>
                      setProfile({ ...profile, registration: event.target.value })
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="group-phone">Phone</Label>
                  <Input
                    id="group-phone"
                    value={profile.phone}
                    onChange={(event) =>
                      setProfile({ ...profile, phone: event.target.value })
                    }
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="group-hq">Head office</Label>
                <Input
                  id="group-hq"
                  value={profile.headquarters}
                  onChange={(event) =>
                    setProfile({ ...profile, headquarters: event.target.value })
                  }
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label htmlFor="group-email">Finance email</Label>
                  <Input
                    id="group-email"
                    type="email"
                    value={profile.email}
                    onChange={(event) =>
                      setProfile({ ...profile, email: event.target.value })
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="group-fiscal">Financial year end</Label>
                  <Select
                    id="group-fiscal"
                    value={profile.fiscalYear}
                    onChange={(event) =>
                      setProfile({ ...profile, fiscalYear: event.target.value })
                    }
                  >
                    <option>31 December</option>
                    <option>30 June</option>
                    <option>31 March</option>
                    <option>30 September</option>
                  </Select>
                </div>
              </div>
              <div>
                <Label htmlFor="group-currency">Reporting currency</Label>
                <Select
                  id="group-currency"
                  value={profile.currency}
                  onChange={(event) =>
                    setProfile({ ...profile, currency: event.target.value })
                  }
                >
                  <option>UGX — Ugandan Shilling</option>
                  <option>USD — US Dollar</option>
                  <option>KES — Kenyan Shilling</option>
                </Select>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div>
                <CardTitle>Notifications</CardTitle>
                <CardDescription>Choose which group updates you receive</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="divide-y divide-border py-0">
              <Switch
                label="Weekly performance summary"
                description="Consolidated revenue, expenses and cash position every Monday."
                checked={alerts.weeklySummary}
                onCheckedChange={(checked) =>
                  setAlerts({ ...alerts, weeklySummary: checked })
                }
              />
              <Switch
                label="Transaction approvals"
                description="Alert when a group entry is pending approval."
                checked={alerts.transactionApprovals}
                onCheckedChange={(checked) =>
                  setAlerts({ ...alerts, transactionApprovals: checked })
                }
              />
              <Switch
                label="Project deadlines"
                description="Reminders for projects due within 14 days."
                checked={alerts.projectDeadlines}
                onCheckedChange={(checked) =>
                  setAlerts({ ...alerts, projectDeadlines: checked })
                }
              />
              <Switch
                label="Monthly financial statements"
                description="Email the consolidated pack on the first working day."
                checked={alerts.monthlyStatements}
                onCheckedChange={(checked) =>
                  setAlerts({ ...alerts, monthlyStatements: checked })
                }
              />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <div>
                <CardTitle>Group identity</CardTitle>
                <CardDescription>Used on exports and statements</CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border border-border bg-white p-4">
                <Image
                  src="/district-12-logo.png"
                  alt="The District 12 Group of Companies"
                  width={1267}
                  height={499}
                  className="h-auto w-full"
                />
              </div>
              <p className="mt-2 text-[11px] text-muted-foreground">
                Official group logo · PNG, 1267 × 499
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div>
                <CardTitle className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-primary" />
                  Access
                </CardTitle>
                <CardDescription>Administration of this workspace</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 text-xs">
              <div className="flex items-center justify-between border-b border-border pb-2">
                <span className="text-muted-foreground">Workspace owner</span>
                <span className="font-semibold text-foreground">Marvin Ssempebwa</span>
              </div>
              <div className="flex items-center justify-between border-b border-border pb-2">
                <span className="text-muted-foreground">Role</span>
                <span className="font-semibold text-foreground">Group administrator</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Subsidiaries managed</span>
                <span className="font-semibold text-foreground">{companies.length}</span>
              </div>
              <p className="pt-1 text-[11px] leading-relaxed text-muted-foreground">
                Access is limited to group administrators. Subsidiary managers are
                granted read-only dashboards.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
