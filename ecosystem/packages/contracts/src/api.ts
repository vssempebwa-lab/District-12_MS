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
