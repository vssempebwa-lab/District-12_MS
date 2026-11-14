import { NextResponse } from "next/server";
import { z } from "zod";
import { updateHubNotification } from "@/lib/records";
import { jsonError, jsonOk } from "@/lib/http";
import { currentWorkflowActor, workflowBody, workflowFailure } from "@/lib/workflow-http";

export const dynamic = "force-dynamic";
const schema = z.object({ action: z.enum(["read", "unread", "archive"]) }).strict();
export async function PATCH(request: Request, { params }: { params: { id: string } }): Promise<NextResponse> {
  try {
    const actor = await currentWorkflowActor(request, "notifications.read");
    if (actor instanceof NextResponse) return actor;
    const body = schema.safeParse(await workflowBody(request));
    if (!body.success) return jsonError("VALIDATION_FAILED", "Choose read, unread or archive", 400);
    return jsonOk({ notification: await updateHubNotification(params.id, actor.sub, body.data.action) });
  } catch (error) { return workflowFailure(error); }
}
