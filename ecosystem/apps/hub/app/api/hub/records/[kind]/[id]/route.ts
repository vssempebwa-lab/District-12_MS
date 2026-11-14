import { NextResponse } from "next/server";
import { z } from "zod";
import { hubKindSchema, hubPermission } from "@d12/contracts";
import { deleteHubRecord, updateHubRecord } from "@/lib/records";
import { jsonError, jsonOk } from "@/lib/http";
import { currentWorkflowActor, workflowBody, workflowFailure } from "@/lib/workflow-http";

export const dynamic = "force-dynamic";
const version = z.number().int().positive();
const updateSchema = z.object({ version, data: z.unknown() }).strict();
const deleteSchema = z.object({ version }).strict();
type Context = { params: { kind: string; id: string } };

export async function PATCH(request: Request, { params }: Context): Promise<NextResponse> {
  try {
    const kind = hubKindSchema.safeParse(params.kind);
    if (!kind.success) return jsonError("NOT_FOUND", "Module not found", 404);
    const actor = await currentWorkflowActor(request, hubPermission(kind.data));
    if (actor instanceof NextResponse) return actor;
    const body = updateSchema.safeParse(await workflowBody(request));
    if (!body.success) return jsonError("VALIDATION_FAILED", "Provide record data and its version", 400);
    const record = await updateHubRecord(kind.data, params.id, body.data.version, body.data.data, actor);
    return jsonOk({ record }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return workflowFailure(error); }
}

export async function DELETE(request: Request, { params }: Context): Promise<NextResponse> {
  try {
    const kind = hubKindSchema.safeParse(params.kind);
    if (!kind.success) return jsonError("NOT_FOUND", "Module not found", 404);
    const actor = await currentWorkflowActor(request, hubPermission(kind.data));
    if (actor instanceof NextResponse) return actor;
    const body = deleteSchema.safeParse(await workflowBody(request));
    if (!body.success) return jsonError("VALIDATION_FAILED", "Provide the record version", 400);
    await deleteHubRecord(kind.data, params.id, body.data.version, actor);
    return jsonOk({ deleted: true });
  } catch (error) { return workflowFailure(error); }
}
