import { Card } from "@d12/ui";
import { NotificationInbox } from "@/components/notification-inbox";
import { HubRecordError, listHubNotifications } from "@/lib/records";
import { requirePermissionPage } from "@/lib/session-server";

export const dynamic = "force-dynamic";
export const metadata = { title: "Notifications — District 12" };
export default async function NotificationsPage() {
  const session = await requirePermissionPage("notifications.read");
  try {
    const { notifications, mode } = await listHubNotifications(session.sub);
    return <NotificationInbox initialNotifications={notifications} now={Date.now()} mode={mode} />;
  } catch (error) {
    return <Card className="space-y-2 p-5"><h1 className="text-xl font-semibold text-navy">Notifications unavailable</h1><p className="text-sm text-ink-soft">{error instanceof HubRecordError ? error.message : "Check the workflow migration and database connection."}</p></Card>;
  }
}
