import { randomUUID } from "node:crypto"
import jwt from "jsonwebtoken"
import type { RvoAuthTvsConfig, RvoTokenResponse } from "../types"
import { DEFAULT_REQUEST_TIMEOUT_MS } from "../utils/constants"
import { RvoRequestError, isOAuthErrorCode, type OAuthErrorCode } from "../errors"
import { readBoundedText } from "../utils/safe-response"

function extractOAuthError(text: string): OAuthErrorCode | undefined {
  try {
    const parsed: unknown = JSON.parse(text)
    if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
      const code = (parsed as Record<string, unknown>).error
      return isOAuthErrorCode(code) ? code : undefined
    }
  } catch {
    // Not JSON: only the HTTP status is reported.
  }
  return undefined
}

function parseTokenResponse(text: string): RvoTokenResponse | undefined {
  try {
    const parsed: unknown = JSON.parse(text)
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return undefined
    const token = parsed as Record<string, unknown>
    if (typeof token.access_token !== "string" || token.access_token === "") return undefined
    if (typeof token.token_type !== "string") return undefined
    if (token.expires_in !== undefined && typeof token.expires_in !== "number") return undefined
    return token as unknown as RvoTokenResponse
  } catch {
    return undefined
  }
}

/**
 * Handles TVS (Routeringsdienst TVS4) / OAuth 2.0 authentication with eHerkenning.
 * Manages authorization URL generation and token exchange using JWT client assertions.
 */
export class TvsAuth {
  private readonly config: RvoAuthTvsConfig
  private readonly timeoutMs: number

  constructor(config: RvoAuthTvsConfig, timeoutMs: number = DEFAULT_REQUEST_TIMEOUT_MS) {
    const clientId = config.clientId?.trim()
    if (!clientId) {
      throw new Error("TVS clientId is required.")
    }
    config.clientId = clientId
    this.config = config
    this.timeoutMs = timeoutMs
  }

  /**
   * Generates the OAuth 2.0 Authorization URL for eHerkenning login.
   *
   * @param scope The requested OAuth scopes (service + eHerkenning URN).
   * @param state Optional CSRF state string.
   * @returns The fully qualified authorization URL.
   */
  public getAuthorizationUrl(scope: string, state?: string): string {
    const finalState = state || randomUUID()
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      response_type: "code",
      redirect_uri: this.config.redirectUri,
      scope: scope,
      state: finalState,
    })

    const authEndpoint = this.config.authorizeEndpoint
    if (!authEndpoint) {
      throw new Error("TVS Authorize Endpoint not configured.")
    }
    return `${authEndpoint}?${params.toString()}`
  }

  /**
   * Exchanges an authorization code for an access token using a signed JWT client assertion.
   *
   * @param authorizationCode The code received after successful user login.
   * @returns A promise resolving to the token response.
   */
  public async getAccessToken(authorizationCode: string): Promise<RvoTokenResponse> {
    const tokenEndpoint = this.config.tokenEndpoint
    if (!tokenEndpoint) {
      throw new Error("TVS Token Endpoint not configured.")
    }
    const now = Math.floor(Date.now() / 1000)

    const privateKey = this.config.pkioPrivateKey

    this.validatePrivateKey(privateKey)

    const jwtPayload = {
      iss: this.config.clientId,
      sub: this.config.clientId,
      aud: tokenEndpoint,
      jti: randomUUID(),
      exp: now + 5 * 60,
      iat: now,
    }

    const clientAssertion = jwt.sign(jwtPayload, privateKey, {
      algorithm: "RS256",
    })

    const requestBody = new URLSearchParams({
      grant_type: "authorization_code",
      code: authorizationCode,
      redirect_uri: this.config.redirectUri,
      client_id: this.config.clientId,
      client_assertion_type: "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
      client_assertion: clientAssertion,
    })

    const signal = this.timeoutMs > 0 ? AbortSignal.timeout(this.timeoutMs) : undefined

    const operation = "token_exchange" as const
    try {
      const response = await fetch(tokenEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: requestBody.toString(),
        signal,
      })

      let text: string
      let oversized: boolean
      try {
        ;({ text, oversized } = await readBoundedText(response))
      } catch (readError: unknown) {
        const readName = readError instanceof Error ? readError.name : undefined
        if (readName === "TimeoutError" || readName === "AbortError") {
          throw new RvoRequestError({
            operation,
            kind: "timeout",
            httpStatus: response.status,
            timeoutMs: this.timeoutMs,
          })
        }
        throw new RvoRequestError({
          operation,
          kind: response.ok ? "network" : "http",
          httpStatus: response.status,
        })
      }

      if (!response.ok) {
        throw new RvoRequestError({
          operation,
          kind: "http",
          httpStatus: response.status,
          oauthError: oversized ? undefined : extractOAuthError(text),
        })
      }

      const token = oversized ? undefined : parseTokenResponse(text)
      if (!token) {
        throw new RvoRequestError({
          operation,
          kind: "invalid_response",
          httpStatus: response.status,
        })
      }
      return token
    } catch (error: unknown) {
      if (error instanceof RvoRequestError) throw error
      const name = error instanceof Error ? error.name : undefined
      if (name === "TimeoutError" || name === "AbortError") {
        throw new RvoRequestError({ operation, kind: "timeout", timeoutMs: this.timeoutMs })
      }
      throw new RvoRequestError({ operation, kind: "network" })
    }
  }

  private validatePrivateKey(key: string) {
    if (!key.includes("PRIVATE KEY")) {
      if (key.includes("PUBLIC KEY")) {
        throw new Error(
          "Invalid PKIO Private Key: It appears you provided a PUBLIC key. Please provide the PRIVATE key.",
        )
      }
      if (key.includes("CERTIFICATE")) {
        throw new Error(
          "Invalid PKIO Private Key: It appears you provided a CERTIFICATE. Please provide the PRIVATE key.",
        )
      }
      throw new Error(
        "Invalid PKIO Private Key format. Expected a PEM-formatted private key (containing '-----BEGIN ... PRIVATE KEY-----').",
      )
    }
  }
}
