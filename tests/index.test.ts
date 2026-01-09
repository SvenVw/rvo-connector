import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest"
import { RvoClient } from "../src/client"
import "dotenv/config"

global.fetch = vi.fn()

vi.mock("jsonwebtoken", () => ({
  default: {
    sign: vi.fn(() => "mocked-jwt"),
  },
}))
vi.mock("fs", () => ({
  existsSync: vi.fn(() => false),
  readFileSync: vi.fn(() => "mocked-private-key-content"),
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

  describe("Configuration Inheritance", () => {
    const tvsConfig = {
      clientId: TVS_CLIENT_ID!,
      redirectUri: TVS_REDIRECT_URI!,
      pkioPrivateKey: PKIO_PRIVATE_KEY!,
    }

    it("should pass global requestTimeoutMs to TvsAuth", () => {
      const globalTimeout = 45000
      const client = new RvoClient({
        authMode: "TVS",
        environment: "acceptance",
        clientId: TVS_CLIENT_ID!,
        clientName: TVS_CLIENT_NAME!,
        requestTimeoutMs: globalTimeout,
        tvs: tvsConfig,
      })

      const tvsAuthInstance = (client as any).tvsAuth
      const tvsAuthTimeout = (tvsAuthInstance as any).timeoutMs

      expect(tvsAuthTimeout).toBe(globalTimeout)
    })
  })
})
