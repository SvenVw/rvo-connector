import { v4 as uuidv4 } from "uuid"
import qs from "qs"
import jwt from "jsonwebtoken"
import fs from "fs"
import type { RvoAuthTvsConfig, RvoTokenResponse } from "../types"

export class TvsAuth {
  private config: RvoAuthTvsConfig

  constructor(config: RvoAuthTvsConfig) {
    this.config = config
  }

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

  public async getAccessToken(authorizationCode: string): Promise<RvoTokenResponse> {
    const tokenEndpoint = this.config.tokenEndpoint
    if (!tokenEndpoint) {
      throw new Error("TVS Token Endpoint not configured.")
    }
    const now = Math.floor(Date.now() / 1000)

    let privateKey = this.config.pkioPrivateKey
    // Check if privateKey is a file path
    if (fs.existsSync(privateKey)) {
      try {
        privateKey = fs.readFileSync(privateKey, "utf8")
      } catch {
        // Ignore error, assume it's a key string if read fails or not a file
      }
    }

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

    const response = await fetch(tokenEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: requestBody,
    })

    if (!response.ok) {
      const errorBody = await response.text()
      throw new Error(`Failed to obtain access token: ${response.status} ${errorBody}`)
    }

    return (await response.json()) as RvoTokenResponse
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
