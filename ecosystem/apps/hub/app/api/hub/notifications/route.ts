import { NextResponse } from "next/server";
import { listHubNotifications } from "@/lib/records";
import { jsonOk } from "@/lib/http";
import { currentWorkflowActor, workflowFailure } from "@/lib/workflow-http";

export const dynamic = "force-dynamic";
export async function GET(request: Request): Promise<NextResponse> {
  try {
    const actor = await currentWorkflowActor(request, "notifications.read");
    if (actor instanceof NextResponse) return actor;
    return jsonOk(await listHubNotifications(actor.sub), { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return workflowFailure(error); }
}
