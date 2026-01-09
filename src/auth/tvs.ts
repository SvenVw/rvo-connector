import { v4 as uuidv4 } from "uuid"
import qs from "qs"
import jwt from "jsonwebtoken"
import type { RvoAuthTvsConfig, RvoTokenResponse } from "../types"

/**
 * Handles TVS (Routeringsdienst TVS4) / OAuth 2.0 authentication with eHerkenning.
 * Manages authorization URL generation and token exchange using JWT client assertions.
 */
export class TvsAuth {
  private config: RvoAuthTvsConfig
  private timeoutMs: number

  constructor(config: RvoAuthTvsConfig, timeoutMs: number = 30000) {
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
    const finalState = state || uuidv4()
    const params = {
      client_id: this.config.clientId,
      response_type: "code",
      redirect_uri: this.config.redirectUri,
      scope: scope,
      state: finalState,
    }

    const authEndpoint = this.config.authorizeEndpoint
    if (!authEndpoint) {
      throw new Error("TVS Authorize Endpoint not configured.")
    }
    return `${authEndpoint}?${qs.stringify(params)}`
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

    let privateKey = this.config.pkioPrivateKey

    this.validatePrivateKey(privateKey)

    const jwtPayload = {
      iss: this.config.clientId,
      sub: this.config.clientId,
      aud: tokenEndpoint,
      jti: uuidv4(),
      exp: now + 5 * 60,
      iat: now,
    }

    const clientAssertion = jwt.sign(jwtPayload, privateKey, {
      algorithm: "RS256",
    })

    const requestBody = qs.stringify({
      grant_type: "authorization_code",
      code: authorizationCode,
      redirect_uri: this.config.redirectUri,
      client_id: this.config.clientId,
      client_assertion_type: "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
      client_assertion: clientAssertion,
    })

    const controller = new AbortController()
    const timeout = this.timeoutMs
    let timeoutId: NodeJS.Timeout | undefined

    if (timeout > 0) {
      timeoutId = setTimeout(() => controller.abort(), timeout)
    }

    try {
      const response = await fetch(tokenEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: requestBody,
        signal: controller.signal,
      })

      if (!response.ok) {
        const errorBody = await response.text()
        throw new Error(`Failed to obtain access token: ${response.status} ${errorBody}`)
      }

      return (await response.json()) as RvoTokenResponse
    } catch (error: any) {
      if (error.name === "AbortError") {
        throw new Error(`Request to token endpoint timed out after ${timeout}ms`)
      }
      throw error
    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId)
      }
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
