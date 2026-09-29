/** Operations that can fail with an {@link RvoRequestError}. */
export type RvoOperation =
  | "token_exchange"
  | "opvragenBedrijfspercelen"
  | "opvragenRegelingspercelenMest"
  | "opvragenRegelingspercelenGLB"

/**
 * Category of the failure.
 * - `http`: non-2xx response without a SOAP Fault.
 * - `soap_fault`: a SOAP Fault was returned (on any HTTP status).
 * - `timeout`: the request timed out.
 * - `network`: transport failure.
 * - `invalid_response`: the response could not be parsed, validated or transformed.
 */
export type RvoErrorKind = "http" | "soap_fault" | "timeout" | "network" | "invalid_response"

/** Standard OAuth 2.0 token error codes (RFC 6749 section 5.2) that may be exposed. */
export const OAUTH_ERROR_CODES = [
  "invalid_request",
  "invalid_client",
  "invalid_grant",
  "unauthorized_client",
  "unsupported_grant_type",
  "invalid_scope",
] as const

export type OAuthErrorCode = (typeof OAUTH_ERROR_CODES)[number]

export interface RvoRequestErrorInit {
  operation: RvoOperation
  kind: RvoErrorKind
  httpStatus?: number
  oauthError?: OAuthErrorCode
  timeoutMs?: number
}

export function isOAuthErrorCode(value: unknown): value is OAuthErrorCode {
  return typeof value === "string" && (OAUTH_ERROR_CODES as readonly string[]).includes(value)
}

/**
 * Structured error for failed OAuth token and SOAP requests.
 *
 * Message and fields never contain response bodies, fault details, URLs,
 * credentials or underlying exceptions, so they are safe to log or serialize.
 */
export class RvoRequestError extends Error {
  readonly operation: RvoOperation
  readonly kind: RvoErrorKind
  readonly httpStatus?: number
  readonly oauthError?: OAuthErrorCode
  readonly timeoutMs?: number

  constructor(init: RvoRequestErrorInit) {
    const httpStatus = Number.isInteger(init.httpStatus) ? init.httpStatus : undefined
    const oauthError = isOAuthErrorCode(init.oauthError) ? init.oauthError : undefined
    const timeoutMs = Number.isFinite(init.timeoutMs) ? init.timeoutMs : undefined

    super(
      RvoRequestError.buildMessage(init.operation, init.kind, httpStatus, oauthError, timeoutMs),
    )
    this.name = "RvoRequestError"
    this.operation = init.operation
    this.kind = init.kind
    if (httpStatus !== undefined) this.httpStatus = httpStatus
    if (oauthError !== undefined) this.oauthError = oauthError
    if (timeoutMs !== undefined) this.timeoutMs = timeoutMs
    Object.setPrototypeOf(this, RvoRequestError.prototype)
  }

  private static buildMessage(
    operation: RvoOperation,
    kind: RvoErrorKind,
    httpStatus?: number,
    oauthError?: OAuthErrorCode,
    timeoutMs?: number,
  ): string {
    const target = operation === "token_exchange" ? "token endpoint" : "RVO service"
    const status = httpStatus !== undefined ? ` (HTTP ${httpStatus})` : ""
    const after = timeoutMs !== undefined ? ` after ${timeoutMs}ms` : ""
    const code = oauthError ? `: ${oauthError}` : ""
    switch (kind) {
      case "timeout":
        return `Request to ${target} timed out${after} (${operation})`
      case "network":
        return `Network error while calling ${target} (${operation})`
      case "invalid_response":
        return `Invalid response from ${target} (${operation})${status}`
      case "soap_fault":
        return `SOAP fault returned by ${target} (${operation})${status}`
      default:
        return `Request to ${target} failed (${operation})${status}${code}`
    }
  }

  toJSON(): RvoRequestErrorInit & { name: string; message: string } {
    return {
      name: this.name,
      message: this.message,
      operation: this.operation,
      kind: this.kind,
      ...(this.httpStatus !== undefined && { httpStatus: this.httpStatus }),
      ...(this.oauthError !== undefined && { oauthError: this.oauthError }),
      ...(this.timeoutMs !== undefined && { timeoutMs: this.timeoutMs }),
    }
  }
}
