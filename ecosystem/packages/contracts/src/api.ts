export const API_ERROR_CODES = [
  "VALIDATION_FAILED",
  "UNAUTHORIZED",
  "FORBIDDEN",
  "NOT_FOUND",
  "CONFLICT",
  "SCHEMA_UNSUPPORTED",
  "SIGNATURE_INVALID",
  "STALE_TIMESTAMP",
  "UNKNOWN_TENANT",
  "PAYLOAD_TOO_LARGE",
  "UPSTREAM_FAILED",
  "INTERNAL",
] as const;

export type ApiErrorCode = (typeof API_ERROR_CODES)[number];

export interface ApiErrorBody {
  error: {
    code: ApiErrorCode;
    message: string;
    details?: Record<string, unknown>;
  };
}

export interface SessionView {
  user: { id: string; email: string; name: string };
  scope: "group" | "tenant";
  roles: string[];
  permissions: string[];
  tenants: string[];
  homeTenant: string | null;
  expiresAt: string;
}

export function apiError(
  code: ApiErrorCode,
  message: string,
  details?: Record<string, unknown>,
): ApiErrorBody {
  return { error: { code, message, ...(details ? { details } : {}) } };
}

// Compares hosts rather than full URLs because serverless runtimes report the
// public host with an internal port (or an internal host) in request.url.
export function isCrossOriginRequest(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;

  let originHost: string;
  try {
    originHost = new URL(origin).hostname;
  } catch {
    return true;
  }

  const forwardedHost = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const requestHost = forwardedHost
    ? forwardedHost.split(",")[0].trim().replace(/:\d+$/, "")
    : new URL(request.url).hostname;

  return originHost.toLowerCase() !== requestHost.toLowerCase();
}
