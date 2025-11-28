import { v4 as uuidv4 } from "uuid"
import qs from "qs"
import axios from "axios"
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

    let privateKey = this.config.privateKey
    // Check if privateKey is a file path
    if (fs.existsSync(privateKey)) {
      try {
        privateKey = fs.readFileSync(privateKey, "utf8")
      } catch (e) {
        // Ignore error, assume it's a key string if read fails or not a file
      }
    }

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
      client_assertion_type:
        "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
      client_assertion: clientAssertion,
    })

    try {
      const response = await axios.post(tokenEndpoint, requestBody, {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      })
      return response.data
    } catch (error: any) {
      if (axios.isAxiosError(error)) {
        throw new Error(
          `Failed to obtain access token: ${error.response?.status} ${JSON.stringify(error.response?.data)}`,
        )
      }
      throw error
    }
  }
}
