import { NextResponse } from "next/server";
import { ZodError } from "zod";
import {
  apiError,
  isOpsEntity,
  parseOpsInput,
  parseOpsUpdate,
  type ApiErrorCode,
  type OpsEntity,
  type TenantId,
} from "@d12/contracts";
import { guardPermission, guardTenant, type GuardResult } from "@d12/auth";
import { createEntity, deleteEntity, listEntity, updateEntity } from "./data";
import { flushTelemetry } from "./telemetry-flush";

export function jsonOk<T extends object>(data: T, status = 200): NextResponse {
  return NextResponse.json({ ok: true, ...data }, { status });
}

export function jsonError(
  code: ApiErrorCode,
  message: string,
  status: number,
  details?: Record<string, unknown>,
): NextResponse {
  return NextResponse.json(apiError(code, message, details), { status });
}

function guardFailure(result: Extract<GuardResult, { ok: false }>): NextResponse {
  return jsonError(result.status === 401 ? "UNAUTHORIZED" : "FORBIDDEN", result.message, result.status);
}

function validationFailure(error: ZodError): NextResponse {
  return jsonError("VALIDATION_FAILED", "Check the details and try again", 400, {
    issues: error.issues.map((issue) => ({
      path: issue.path.join("."),
      message: issue.message,
    })),
  });
}

const MARIZ_ONLY_ENTITIES: ReadonlySet<string> = new Set(["meetings", "calls"]);

function isKnownEntity(rawEntity: string, tenantId: TenantId): rawEntity is OpsEntity {
  if (!isOpsEntity(rawEntity)) return false;
  return tenantId === "mariz" || !MARIZ_ONLY_ENTITIES.has(rawEntity);
}

export async function handleList(
  request: Request,
  tenantId: TenantId,
  rawEntity: string,
): Promise<NextResponse> {
  if (!isKnownEntity(rawEntity, tenantId)) return jsonError("NOT_FOUND", "Unknown record type", 404);
  const guard = await guardPermission(request, `${rawEntity}.read`, tenantId);
  if (!guard.ok) return guardFailure(guard);

  const records = await listEntity(tenantId, rawEntity);
  return jsonOk({ entity: rawEntity, records });
}

export async function handleCreate(
  request: Request,
  tenantId: TenantId,
  rawEntity: string,
): Promise<NextResponse> {
  if (!isKnownEntity(rawEntity, tenantId)) return jsonError("NOT_FOUND", "Unknown record type", 404);
  const guard = await guardPermission(request, `${rawEntity}.write`, tenantId);
  if (!guard.ok) return guardFailure(guard);

  const body = await request.json().catch(() => null);
  try {
    const draft = parseOpsInput(rawEntity, body);
    const record = await createEntity(tenantId, rawEntity, draft);
    return jsonOk({ record }, 201);
  } catch (error) {
    if (error instanceof ZodError) return validationFailure(error);
    throw error;
  }
}

export async function handleUpdate(
  request: Request,
  tenantId: TenantId,
  rawEntity: string,
  id: string,
): Promise<NextResponse> {
  if (!isKnownEntity(rawEntity, tenantId)) return jsonError("NOT_FOUND", "Unknown record type", 404);
  const guard = await guardPermission(request, `${rawEntity}.write`, tenantId);
  if (!guard.ok) return guardFailure(guard);

  const body = await request.json().catch(() => null);
  try {
    const patch = parseOpsUpdate(rawEntity, body);
    const record = await updateEntity(tenantId, rawEntity, id, patch);
    if (!record) return jsonError("NOT_FOUND", "That record no longer exists", 404);
    return jsonOk({ record });
  } catch (error) {
    if (error instanceof ZodError) return validationFailure(error);
    throw error;
  }
}

export async function handleDelete(
  request: Request,
  tenantId: TenantId,
  rawEntity: string,
  id: string,
): Promise<NextResponse> {
  if (!isKnownEntity(rawEntity, tenantId)) return jsonError("NOT_FOUND", "Unknown record type", 404);
  const guard = await guardPermission(request, `${rawEntity}.write`, tenantId);
  if (!guard.ok) return guardFailure(guard);

  const deleted = await deleteEntity(tenantId, rawEntity, id);
  if (!deleted) return jsonError("NOT_FOUND", "That record no longer exists", 404);
  return jsonOk({ deleted: id });
}

function matchesWorkerToken(header: string | null): boolean {
  const expected = process.env.D12_TELEMETRY_WORKER_TOKEN?.trim();
  if (!expected || !header?.startsWith("Bearer ")) return false;
  const provided = header.slice(7).trim();
  if (provided.length !== expected.length) return false;
  let difference = 0;
  for (let index = 0; index < provided.length; index += 1) {
    difference |= provided.charCodeAt(index) ^ expected.charCodeAt(index);
  }
  return difference === 0;
}

export async function handleFlush(
  request: Request,
  tenantId: TenantId,
): Promise<NextResponse> {
  if (!matchesWorkerToken(request.headers.get("authorization"))) {
    const guard = await guardTenant(request, tenantId);
    if (!guard.ok) return guardFailure(guard);
  }

  const result = await flushTelemetry(tenantId);
  return jsonOk(result, result.ok ? 200 : 502);
}
