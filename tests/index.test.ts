import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest"
import { RvoClient } from "../src/index"
import "dotenv/config"

global.fetch = vi.fn()

vi.mock("jsonwebtoken", () => ({
  default: {
    sign: vi.fn(() => "mocked-jwt"),
  },
}))

// Load credentials from env
const ABA_USERNAME = process.env.ABA_USERNAME
const ABA_PASSWORD = process.env.ABA_PASSWORD
const TVS_CLIENT_ID = process.env.CLIENT_ID
const TVS_CLIENT_NAME = process.env.CLIENT_NAME
const TVS_REDIRECT_URI = process.env.REDIRECT_URI
const PKIO_PRIVATE_KEY = process.env.PKIO_PRIVATE_KEY

describe("RvoClient (Acceptance Environment)", () => {
  beforeAll(() => {
    const missingEnvVars: string[] = []
    if (!ABA_USERNAME) missingEnvVars.push("ABA_USERNAME")
    if (!ABA_PASSWORD) missingEnvVars.push("ABA_PASSWORD")
    if (!TVS_CLIENT_ID) missingEnvVars.push("CLIENT_ID")
    if (!TVS_CLIENT_NAME) missingEnvVars.push("CLIENT_NAME")
    if (!TVS_REDIRECT_URI) missingEnvVars.push("REDIRECT_URI")
    if (!PKIO_PRIVATE_KEY) missingEnvVars.push("PKIO_PRIVATE_KEY")

    if (missingEnvVars.length > 0) {
      throw new Error(
        `Required environment variables are not set for tests: ${missingEnvVars.join(", ")}. ` +
          "Please provide them (e.g., in a .env file or as shell variables) " +
          "to run these acceptance tests. Refer to the project documentation for details.",
      )
    }
  })

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe("ABA Authentication", () => {
    it("should send a SOAP request with UsernameToken header to acceptance endpoint", async () => {
      const client = new RvoClient({
        authMode: "ABA",
        environment: "acceptance",
        clientId: TVS_CLIENT_ID!,
        clientName: TVS_CLIENT_NAME!,
        aba: {
          username: ABA_USERNAME!,
          password: ABA_PASSWORD!,
        },
      })

      const mockFetch = global.fetch as any
      mockFetch.mockResolvedValue({
        ok: true,
        text: async () => "<xml>response</xml>",
      })

      await client.opvragenBedrijfspercelen({ farmId: "12345678" })

      expect(mockFetch).toHaveBeenCalledTimes(1)
      const [url, config] = mockFetch.mock.calls[0]

      expect(url).toBe("https://edicrop-acc.agro.nl/edicrop/EdiCropService")
      expect(config.body).toContain(`<Username>${ABA_USERNAME}</Username>`)
      expect(config.body).toContain(`<exc:ID>${TVS_CLIENT_NAME}</exc:ID>`)
    })
  })

  describe("TVS Authentication", () => {
    const tvsConfig = {
      clientId: TVS_CLIENT_ID!,
      redirectUri: TVS_REDIRECT_URI!,
      pkioPrivateKey: PKIO_PRIVATE_KEY!,
    }

    it("should send a SOAP request with Bearer token to acceptance endpoint", async () => {
      const client = new RvoClient({
        authMode: "TVS",
        environment: "acceptance",
        clientId: TVS_CLIENT_ID!,
        clientName: TVS_CLIENT_NAME!,
        tvs: tvsConfig,
      })
      client.setAccessToken("fake-access-token")

      const mockFetch = global.fetch as any
      mockFetch.mockResolvedValue({
        ok: true,
        text: async () => "<xml>response</xml>",
      })

      await client.opvragenBedrijfspercelen({ farmId: "87654321" })

      expect(mockFetch).toHaveBeenCalledTimes(1)
      const [url, config] = mockFetch.mock.calls[0]

      expect(url).toBe("https://edicrop-acc.agro.nl/edicrop/EdiCrop-WebService/v2")
      expect(config.headers["Authorization"]).toBe("Bearer fake-access-token")
      expect(config.body).not.toContain("<UsernameToken>")
    })

    it("getAuthorizationUrl should return acceptance URL with correct scopes", () => {
      const client = new RvoClient({
        authMode: "TVS",
        environment: "acceptance",
        clientId: TVS_CLIENT_ID!,
        clientName: TVS_CLIENT_NAME!,
        tvs: tvsConfig,
      })
      const authUrl = client.getAuthorizationUrl() // Defaults to 'opvragenBedrijfspercelen'

      expect(authUrl).toContain("https://pp2.toegang.overheid.nl/kvo/authorize")

      const urlParams = new URLSearchParams(authUrl.split("?")[1])
      const actualScope = urlParams.get("scope")

      const expectedEherkenningScope =
        "urn:nl-eid-gdi:1.0:ServiceUUID:44345953-4138-4f53-3454-593459414d45"
      const expectedServiceScope = "RVO-WS.GEO.bp.lezen"
      const expectedFullScope = `${expectedServiceScope} ${expectedEherkenningScope}`

      expect(actualScope).toBe(expectedFullScope)
    })

    it("should work with tvs.clientId and no root clientId", async () => {
      const client = new RvoClient({
        authMode: "TVS",
        environment: "acceptance",
        clientName: TVS_CLIENT_NAME!,
        tvs: tvsConfig,
      })
      const authUrl = client.getAuthorizationUrl()
      expect(authUrl).toContain(`client_id=${TVS_CLIENT_ID}`)
    })

    it("should fallback to root clientId if tvs.clientId is missing (backward compatibility)", () => {
      const client = new RvoClient({
        authMode: "TVS",
        environment: "acceptance",
        clientId: "fallback-id",
        clientName: TVS_CLIENT_NAME!,
        tvs: {
          redirectUri: TVS_REDIRECT_URI!,
          pkioPrivateKey: PKIO_PRIVATE_KEY!,
        },
      })
      const authUrl = client.getAuthorizationUrl()
      expect(authUrl).toContain("client_id=fallback-id")
    })
  })

  describe("Timeout Behavior", () => {
    it("should timeout when requestTimeoutMs is exceeded", async () => {
      const client = new RvoClient({
        authMode: "ABA",
        environment: "acceptance",
        clientId: TVS_CLIENT_ID!,
        clientName: TVS_CLIENT_NAME!,
        aba: {
          username: ABA_USERNAME!,
          password: ABA_PASSWORD!,
        },
        requestTimeoutMs: 50, // Short timeout for testing
      })

      const mockFetch = global.fetch as any
      mockFetch.mockImplementation((url: string, options: any) => {
        return new Promise((resolve, reject) => {
          if (options.signal) {
            if (options.signal.aborted) {
              const error = new Error("The operation was aborted")
              error.name = "AbortError"
              reject(error)
              return
            }
            options.signal.addEventListener("abort", () => {
              const error = new Error("The operation was aborted")
              error.name = "AbortError"
              reject(error)
            })
          }
        })
      })

      await expect(client.opvragenBedrijfspercelen({ farmId: "123" })).rejects.toThrow(
        "Request to RVO service timed out after 50ms",
      )
    })
  })

  describe("Error Handling", () => {
    it("should throw if requestTimeoutMs is negative", () => {
      expect(
        () =>
          new RvoClient({
            clientId: "id",
            clientName: "name",
            requestTimeoutMs: -1,
          }),
      ).toThrow("requestTimeoutMs must be a non-negative number.")
    })

    it("should throw if authMode is TVS but config is missing", () => {
      expect(
        () =>
          new RvoClient({
            authMode: "TVS",
            clientId: "id",
            clientName: "name",
            tvs: undefined,
          }),
      ).toThrow("TVS authentication mode selected but TVS configuration is missing.")
    })

    it("should throw if authMode is not TVS when calling getAuthorizationUrl", () => {
      const client = new RvoClient({
        authMode: "ABA",
        clientId: "id",
        clientName: "name",
        aba: { username: "u", password: "p" },
      })
      expect(() => client.getAuthorizationUrl()).toThrow("Authentication mode is not TVS")
    })

    it("should throw if authMode is not TVS when calling exchangeAuthCode", async () => {
      const client = new RvoClient({
        authMode: "ABA",
        clientId: "id",
        clientName: "name",
        aba: { username: "u", password: "p" },
      })
      await expect(client.exchangeAuthCode("code")).rejects.toThrow(
        "Authentication mode is not TVS",
      )
    })

    it("should throw if calling opvragenBedrijfspercelen with TVS but no token", async () => {
      const client = new RvoClient({
        authMode: "TVS",
        environment: "acceptance",
        clientId: TVS_CLIENT_ID!,
        clientName: TVS_CLIENT_NAME!,
        tvs: {
          clientId: TVS_CLIENT_ID!,
          redirectUri: TVS_REDIRECT_URI!,
          pkioPrivateKey: PKIO_PRIVATE_KEY!,
        },
      })
      await expect(client.opvragenBedrijfspercelen()).rejects.toThrow("Access token is missing.")
    })

    it("should throw if calling opvragenBedrijfspercelen with ABA but no username", async () => {
      const client = new RvoClient({
        authMode: "ABA",
        environment: "acceptance",
        clientId: TVS_CLIENT_ID!,
        clientName: TVS_CLIENT_NAME!,
        aba: {} as any, // Missing username
      })
      await expect(client.opvragenBedrijfspercelen()).rejects.toThrow(
        "ABA authentication mode selected but ABA username or password is missing.",
      )
    })

    it("should throw if SOAP request fails (non-200)", async () => {
      const client = new RvoClient({
        authMode: "ABA",
        clientId: "id",
        clientName: "name",
        aba: { username: "u", password: "p" },
      })

      const mockFetch = global.fetch as any
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => "SOAP Fault",
      })

      await expect(client.opvragenBedrijfspercelen()).rejects.toThrow(
        "Request failed: 500 - SOAP Fault",
      )
    })

    it("should re-throw non-AbortError fetch errors", async () => {
      const client = new RvoClient({
        authMode: "ABA",
        clientId: "id",
        clientName: "name",
        aba: { username: "u", password: "p" },
      })

      const mockFetch = global.fetch as any
      const networkError = new Error("Network failure")
      mockFetch.mockRejectedValue(networkError)

      await expect(client.opvragenBedrijfspercelen()).rejects.toThrow("Network failure")
    })
  })

  describe("opvragenRegelingspercelenMest", () => {
    it("should call the regelingspercelen SOAP endpoint with ABA credentials", async () => {
      const client = new RvoClient({
        authMode: "ABA",
        environment: "acceptance",
        clientId: TVS_CLIENT_ID!,
        clientName: TVS_CLIENT_NAME!,
        aba: {
          username: ABA_USERNAME!,
          password: ABA_PASSWORD!,
        },
      })

      const mockFetch = global.fetch as any
      mockFetch.mockResolvedValue({
        ok: true,
        text: async () => "<xml>response</xml>",
      })

      await client.opvragenRegelingspercelenMest({ farmId: "12345678" })

      expect(mockFetch).toHaveBeenCalledTimes(1)
      const [url, config] = mockFetch.mock.calls[0]

      expect(url).toBe("https://edicrop-acc.agro.nl/edicrop/EdiCropService")
      expect(config.body).toContain("OpvragenRegelingspercelenMESTRequest")
    })

    it("should return GeoJSON when outputFormat is geojson", async () => {
      const client = new RvoClient({
        authMode: "ABA",
        environment: "acceptance",
        clientId: TVS_CLIENT_ID!,
        clientName: TVS_CLIENT_NAME!,
        aba: {
          username: ABA_USERNAME!,
          password: ABA_PASSWORD!,
        },
      })

      const mockFetch = global.fetch as any
      // Return a minimal valid SOAP XML response (no farms → empty FeatureCollection)
      mockFetch.mockResolvedValue({
        ok: true,
        text: async () =>
          `<?xml version="1.0"?><Envelope><Body><OpvragenRegelingspercelenMESTResponse></OpvragenRegelingspercelenMESTResponse></Body></Envelope>`,
      })

      const result = await client.opvragenRegelingspercelenMest({
        farmId: "12345678",
        outputFormat: "geojson",
      })

      expect(result.type).toBe("FeatureCollection")
      expect(result.features).toHaveLength(0)
    })
  })

  describe("exchangeAuthCode", () => {
    it("should exchange auth code and store access token", async () => {
      const client = new RvoClient({
        authMode: "TVS",
        environment: "acceptance",
        clientId: TVS_CLIENT_ID!,
        clientName: TVS_CLIENT_NAME!,
        tvs: {
          clientId: TVS_CLIENT_ID!,
          redirectUri: TVS_REDIRECT_URI!,
          // Use a fake PEM key that passes format validation (jwt.sign is mocked)
          pkioPrivateKey: "-----BEGIN PRIVATE KEY-----\nMOCK\n-----END PRIVATE KEY-----",
        },
      })

      const mockFetch = global.fetch as any
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          access_token: "new-access-token",
          token_type: "Bearer",
          expires_in: 3600,
        }),
      })

      const tokenData = await client.exchangeAuthCode("auth-code-123")

      expect(tokenData.access_token).toBe("new-access-token")
      // Token should now be stored; we can call an API method without explicit setAccessToken
      mockFetch.mockResolvedValue({
        ok: true,
        text: async () => "<xml>response</xml>",
      })
      await expect(client.opvragenBedrijfspercelen()).resolves.toBeDefined()
    })
  })

  describe("opvragenBedrijfspercelen GeoJSON output", () => {
    it("should return GeoJSON FeatureCollection when outputFormat is geojson", async () => {
      const client = new RvoClient({
        authMode: "ABA",
        environment: "acceptance",
        clientId: TVS_CLIENT_ID!,
        clientName: TVS_CLIENT_NAME!,
        aba: {
          username: ABA_USERNAME!,
          password: ABA_PASSWORD!,
        },
      })

      const mockFetch = global.fetch as any
      // Return minimal valid SOAP XML (no fields → empty FeatureCollection)
      mockFetch.mockResolvedValue({
        ok: true,
        text: async () =>
          `<?xml version="1.0"?><Envelope><Body><OpvragenBedrijfspercelenResponse></OpvragenBedrijfspercelenResponse></Body></Envelope>`,
      })

      const result = await client.opvragenBedrijfspercelen({ outputFormat: "geojson" })

      expect(result.type).toBe("FeatureCollection")
      expect(result.features).toHaveLength(0)
    })
  })
})
