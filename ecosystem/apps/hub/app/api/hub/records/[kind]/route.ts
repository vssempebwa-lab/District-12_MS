import { NextResponse } from "next/server";
import { z } from "zod";
import { hubKindSchema, hubPermission } from "@d12/contracts";
import { createHubRecord, listHubRecords } from "@/lib/records";
import { jsonError, jsonOk } from "@/lib/http";
import { currentWorkflowActor, workflowBody, workflowFailure } from "@/lib/workflow-http";

export const dynamic = "force-dynamic";
const createSchema = z.object({ data: z.unknown() }).strict();

export async function GET(request: Request, { params }: { params: { kind: string } }): Promise<NextResponse> {
  try {
    const parsed = hubKindSchema.safeParse(params.kind);
    if (!parsed.success) return jsonError("NOT_FOUND", "Module not found", 404);
    const actor = await currentWorkflowActor(request, hubPermission(parsed.data));
    if (actor instanceof NextResponse) return actor;
    return jsonOk(await listHubRecords([parsed.data]), { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return workflowFailure(error); }
}

export async function POST(request: Request, { params }: { params: { kind: string } }): Promise<NextResponse> {
  try {
    const parsed = hubKindSchema.safeParse(params.kind);
    if (!parsed.success) return jsonError("NOT_FOUND", "Module not found", 404);
    const actor = await currentWorkflowActor(request, hubPermission(parsed.data));
    if (actor instanceof NextResponse) return actor;
    const body = createSchema.safeParse(await workflowBody(request));
    if (!body.success) return jsonError("VALIDATION_FAILED", "Provide the record data", 400);
    const record = await createHubRecord(parsed.data, body.data.data, actor);
    return jsonOk({ record }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) { return workflowFailure(error); }
}
