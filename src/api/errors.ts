/** Normalised API failure. `code` mirrors the product error body (`{statusCode, code, message}`), NETWORK = no connectivity / unreachable. */
export class ApiError extends Error {
  status: number;
  code: string;
  details?: Record<string, unknown>;
  constructor(status: number, code: string, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
  get isNetwork() { return this.status === 0; }
  get isUnauthorized() { return this.status === 401; }
  get isDeviceRevoked() { return this.code === "DEVICE_REVOKED"; }
  get isFeatureDisabled() { return this.status === 403 && this.code === "FEATURE_DISABLED"; }
  get featureKey() { return this.details?.key as string | undefined; }
  get isConflict() { return this.status === 409; }
  /** Server-side validation / state errors are not retryable from the offline queue. */
  get retryable() { return this.status === 0 || this.status >= 500 || this.status === 429; }
}

export function parseErrorBody(status: number, body: unknown, fallback: string): ApiError {
  const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  const rawMsg = b.message;
  const message = Array.isArray(rawMsg) ? rawMsg.join(", ") : typeof rawMsg === "string" ? rawMsg : fallback;
  const code = typeof b.code === "string" ? b.code : typeof b.error === "string" ? String(b.error).toUpperCase().replace(/\s+/g, "_") : `HTTP_${status}`;
  return new ApiError(status, code, message, b);
}
