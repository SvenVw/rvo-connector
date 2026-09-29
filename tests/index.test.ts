import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest"
import { inspect } from "node:util"
import { RvoClient, RvoRequestError } from "../src/index"
import { MAX_BODY_BYTES, hasSoapFault, readBoundedText } from "../src/utils/safe-response"
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

    it("getAuthorizationUrl should return acceptance URL with correct default scopes", () => {
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

    it("getAuthorizationUrl should support requesting multiple services uniquely", () => {
      const client = new RvoClient({
        authMode: "TVS",
        environment: "acceptance",
        clientId: TVS_CLIENT_ID!,
        clientName: TVS_CLIENT_NAME!,
        tvs: tvsConfig,
      })
      const authUrl = client.getAuthorizationUrl({
        services: [
          "opvragenBedrijfspercelen",
          "opvragenRegelingspercelenMest",
          "opvragenRegelingspercelenGLB",
        ],
      })

      const urlParams = new URLSearchParams(authUrl.split("?")[1])
      const actualScope = urlParams.get("scope")

      const expectedEherkenningScope =
        "urn:nl-eid-gdi:1.0:ServiceUUID:44345953-4138-4f53-3454-593459414d45"
      // Notice that rp.lezen is deduplicated (both mest and glb share the same scope)
      const expectedServiceScopes = "RVO-WS.GEO.bp.lezen RVO-WS.GEO.rp.lezen"
      const expectedFullScope = `${expectedServiceScopes} ${expectedEherkenningScope}`

      expect(actualScope).toBe(expectedFullScope)
    })

    it("getAuthorizationUrl should fallback to default service if services array is empty", () => {
      const client = new RvoClient({
        authMode: "TVS",
        environment: "acceptance",
        clientId: TVS_CLIENT_ID!,
        clientName: TVS_CLIENT_NAME!,
        tvs: tvsConfig,
      })
      const authUrl = client.getAuthorizationUrl({
        services: [],
      })

      const urlParams = new URLSearchParams(authUrl.split("?")[1])
      const actualScope = urlParams.get("scope")

      const expectedEherkenningScope =
        "urn:nl-eid-gdi:1.0:ServiceUUID:44345953-4138-4f53-3454-593459414d45"
      const expectedServiceScope = "RVO-WS.GEO.bp.lezen"
      const expectedFullScope = `${expectedServiceScope} ${expectedEherkenningScope}`

      expect(actualScope).toBe(expectedFullScope)
    })

    it("getAuthorizationUrl should support the deprecated 'service' property (backward compatibility)", () => {
      const client = new RvoClient({
        authMode: "TVS",
        environment: "acceptance",
        clientId: TVS_CLIENT_ID!,
        clientName: TVS_CLIENT_NAME!,
        tvs: tvsConfig,
      })
      const authUrl = client.getAuthorizationUrl({
        service: "opvragenRegelingspercelenMest",
      })

      const urlParams = new URLSearchParams(authUrl.split("?")[1])
      const actualScope = urlParams.get("scope")

      const expectedEherkenningScope =
        "urn:nl-eid-gdi:1.0:ServiceUUID:44345953-4138-4f53-3454-593459414d45"
      const expectedServiceScope = "RVO-WS.GEO.rp.lezen"
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
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {})
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
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("Deprecation Warning"))
      const authUrl = client.getAuthorizationUrl()
      expect(authUrl).toContain("client_id=fallback-id")
      warnSpy.mockRestore()
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
        expect.objectContaining({
          kind: "http",
          httpStatus: 500,
          operation: "opvragenBedrijfspercelen",
        }),
      )
    })

    it("should map non-abort fetch errors to a safe network error", async () => {
      const client = new RvoClient({
        authMode: "ABA",
        clientId: "id",
        clientName: "name",
        aba: { username: "u", password: "p" },
      })

      const mockFetch = global.fetch as any
      const networkError = new Error("Network failure")
      mockFetch.mockRejectedValue(networkError)

      await expect(client.opvragenBedrijfspercelen()).rejects.toMatchObject({
        kind: "network",
        operation: "opvragenBedrijfspercelen",
      })
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
        text: async () =>
          JSON.stringify({
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

    it("should return raw XML string when outputFormat is xml", async () => {
      const client = new RvoClient({
        authMode: "ABA",
        clientName: "Test",
        aba: { username: "u", password: "p" },
      })

      const xmlResponse = "<Envelope>Raw XML</Envelope>"
      const mockFetch = global.fetch as any
      mockFetch.mockResolvedValue({
        ok: true,
        text: async () => xmlResponse,
      })

      const result = await client.opvragenBedrijfspercelen({ outputFormat: "xml" })

      expect(result).toBe(xmlResponse)
      expect(typeof result).toBe("string")
    })

    it("should throw if geojson output requested but no transformer provided (internal safety)", async () => {
      const client = new RvoClient({
        authMode: "ABA",
        clientName: "Test",
        aba: { username: "u", password: "p" },
      })

      const mockFetch = global.fetch as any
      mockFetch.mockResolvedValue({
        ok: true,
        text: async () => "<xml></xml>",
      })

      // We bypass the public method to hit the private executeSoapRequest branch
      // using a manual call to the private method via 'any'
      await expect(
        (client as any).executeSoapRequest(
          "opvragenBedrijfspercelen",
          "<xml></xml>",
          "geojson",
          undefined,
        ),
      ).rejects.toThrow("GeoJSON output requested but no transformer was provided.")
    })
  })

  describe("opvragenRegelingspercelenGLB", () => {
    it("should call the GLB SOAP endpoint", async () => {
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
        text: async () =>
          `<?xml version="1.0"?><Envelope><Body><OpvragenRegelingspercelenGLBResponse></OpvragenRegelingspercelenGLBResponse></Body></Envelope>`,
      })

      const result = await client.opvragenRegelingspercelenGLB({
        farmId: "12345678",
        outputFormat: "geojson",
      })

      expect(mockFetch).toHaveBeenCalledTimes(1)
      expect(result.type).toBe("FeatureCollection")
    })
  })
})

const SENTINEL = "SECRET-SENTINEL-123"
const mockFetch = () => global.fetch as any

function expectSafe(error: unknown) {
  expect(error).toBeInstanceOf(RvoRequestError)
  const e = error as RvoRequestError
  const dump = [
    e.message,
    JSON.stringify(e),
    inspect(e, { depth: 5 }).split("\n    at ")[0],
    JSON.stringify(Object.getOwnPropertyNames(e).map((k) => (e as any)[k] as unknown)),
  ].join("\n")
  expect(dump).not.toContain(SENTINEL)
  expect((e as any).cause).toBeUndefined()
  return e
}

async function capture(promise: Promise<unknown>): Promise<any> {
  try {
    await promise
  } catch (error) {
    return error
  }
  throw new Error("expected rejection")
}

const fault11 = `<?xml version="1.0"?><soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body><soap:Fault><faultcode>x</faultcode><faultstring>${SENTINEL}</faultstring><detail><description>${SENTINEL}</description></detail></soap:Fault></soap:Body></soap:Envelope>`
const fault12 = `<env:Envelope xmlns:env="http://www.w3.org/2003/05/soap-envelope"><env:Body><env:Fault><env:Reason><env:Text>${SENTINEL}</env:Text></env:Reason></env:Fault></env:Body></env:Envelope>`
const okXml = `<Envelope><Body><Response><a>1</a></Response></Body></Envelope>`

describe("RvoRequestError", () => {
  it("is exported, safe and serializable", () => {
    const e = new RvoRequestError({
      operation: "token_exchange",
      kind: "http",
      httpStatus: 400,
      oauthError: "invalid_grant",
    })
    expect(e).toBeInstanceOf(Error)
    expect(e.name).toBe("RvoRequestError")
    expect(JSON.parse(JSON.stringify(e))).toMatchObject({
      operation: "token_exchange",
      kind: "http",
      httpStatus: 400,
      oauthError: "invalid_grant",
    })
  })

  it("drops non-allowlisted oauth values", () => {
    const e = new RvoRequestError({
      operation: "token_exchange",
      kind: "http",
      oauthError: SENTINEL as any,
    })
    expect(e.oauthError).toBeUndefined()
    expect(e.message).not.toContain(SENTINEL)
  })
})

describe("readBoundedText", () => {
  it("reads a streamed body", async () => {
    const result = await readBoundedText(new Response("héllo"))
    expect(result).toEqual({ text: "héllo", oversized: false })
  })

  it("flags an oversized streamed body without returning content", async () => {
    const result = await readBoundedText(new Response("x".repeat(MAX_BODY_BYTES + 1)))
    expect(result).toEqual({ text: "", oversized: true })
  })

  it("accepts a body of exactly the limit", async () => {
    const result = await readBoundedText(new Response("x".repeat(MAX_BODY_BYTES)))
    expect(result.oversized).toBe(false)
  })

  it("measures the fallback size in UTF-8 bytes", async () => {
    const multibyte = "é".repeat(MAX_BODY_BYTES / 2 + 1)
    expect(multibyte.length).toBeLessThan(MAX_BODY_BYTES)
    const result = await readBoundedText({ text: async () => multibyte } as unknown as Response)
    expect(result).toEqual({ text: "", oversized: true })
  })

  it("falls back to text() when there is no stream", async () => {
    const small = await readBoundedText({ text: async () => "abc" } as unknown as Response)
    expect(small).toEqual({ text: "abc", oversized: false })

    const big = await readBoundedText({
      text: async () => "x".repeat(MAX_BODY_BYTES + 1),
    } as unknown as Response)
    expect(big).toEqual({ text: "", oversized: true })
  })
})

describe("hasSoapFault", () => {
  it.each([
    [undefined],
    ["text"],
    [{}],
    [{ Envelope: "x" }],
    [{ Envelope: {} }],
    [{ Envelope: { Body: "x" } }],
    [{ Envelope: { Body: { Response: {} } } }],
  ])("returns false for %j", (value) => {
    expect(hasSoapFault(value)).toBe(false)
  })

  it("returns true for a Fault", () => {
    expect(hasSoapFault({ Envelope: { Body: { Fault: "" } } })).toBe(true)
  })
})

describe("RvoRequestError edge cases", () => {
  it("omits invalid numeric input and unknown kinds fall back to a safe message", () => {
    const e = new RvoRequestError({
      operation: "opvragenBedrijfspercelen",
      kind: "timeout",
      httpStatus: 1.5,
      timeoutMs: Number.NaN,
    })
    expect(e.httpStatus).toBeUndefined()
    expect(e.timeoutMs).toBeUndefined()
    expect(e.message).toBe("Request to RVO service timed out (opvragenBedrijfspercelen)")
    expect(JSON.parse(JSON.stringify(e)).timeoutMs).toBeUndefined()
  })

  it("includes the timeout when known", () => {
    const e = new RvoRequestError({ operation: "token_exchange", kind: "timeout", timeoutMs: 50 })
    expect(e.message).toContain("after 50ms")
    expect(e.toJSON().timeoutMs).toBe(50)
  })
})

describe("SOAP errors", () => {
  beforeEach(() => vi.clearAllMocks())

  const client = () =>
    new RvoClient({
      authMode: "ABA",
      clientName: "n",
      aba: { username: "u", password: SENTINEL },
    })

  const operations = [
    "opvragenBedrijfspercelen",
    "opvragenRegelingspercelenMest",
    "opvragenRegelingspercelenGLB",
  ] as const

  describe.each(operations)("%s", (operation) => {
    const call = (options: object = {}) => (client() as any)[operation](options)

    it("classifies non-2xx with a Fault as soap_fault", async () => {
      mockFetch().mockResolvedValue({ ok: false, status: 500, text: async () => fault11 })
      expect(expectSafe(await capture(call()))).toMatchObject({
        operation,
        kind: "soap_fault",
        httpStatus: 500,
      })
    })

    it("classifies non-2xx without a Fault as http", async () => {
      mockFetch().mockResolvedValue({ ok: false, status: 401, text: async () => SENTINEL })
      expect(expectSafe(await capture(call()))).toMatchObject({
        operation,
        kind: "http",
        httpStatus: 401,
      })
    })

    it.each([
      ["1.1", fault11],
      ["1.2", fault12],
    ])("detects a 2xx SOAP %s Fault for every output format", async (_v, body) => {
      for (const outputFormat of [undefined, "xml", "geojson"]) {
        mockFetch().mockResolvedValue({ ok: true, status: 200, text: async () => body })
        expect(expectSafe(await capture(call({ outputFormat })))).toMatchObject({
          operation,
          kind: "soap_fault",
          httpStatus: 200,
        })
      }
    })

    it("distinguishes timeout, network, invalid xml and transform failures", async () => {
      const timeout = new Error("t")
      timeout.name = "AbortError"
      mockFetch().mockRejectedValue(timeout)
      expect(expectSafe(await capture(call())).kind).toBe("timeout")

      mockFetch().mockRejectedValue(new Error(SENTINEL))
      expect(expectSafe(await capture(call())).kind).toBe("network")

      mockFetch().mockResolvedValue({ ok: true, status: 200, text: async () => `<a>${SENTINEL}` })
      expect(expectSafe(await capture(call())).kind).toBe("invalid_response")

      mockFetch().mockResolvedValue({ ok: true, status: 200, text: async () => okXml })
      const throwing = () => {
        throw new Error(SENTINEL)
      }
      const e = expectSafe(
        await capture((client() as any).executeSoapRequest(operation, "<x/>", "geojson", throwing)),
      )
      expect(e).toMatchObject({ operation, kind: "invalid_response", httpStatus: 200 })
    })
  })

  it("supports consumer migration from message parsing to typed status checks", async () => {
    mockFetch().mockResolvedValue({ ok: false, status: 401, text: async () => SENTINEL })
    const error = await capture(client().opvragenBedrijfspercelen())
    const isUpstreamDenial =
      error instanceof RvoRequestError && (error.httpStatus === 401 || error.httpStatus === 403)
    expect(isUpstreamDenial).toBe(true)
  })

  it("does not write application logs", async () => {
    const spies = (["log", "warn", "error", "info", "debug"] as const).map((m) =>
      vi.spyOn(console, m).mockImplementation(() => undefined),
    )
    mockFetch().mockResolvedValue({ ok: false, status: 500, text: async () => fault11 })
    await capture(client().opvragenBedrijfspercelen())
    spies.forEach((s) => {
      expect(s).not.toHaveBeenCalled()
      s.mockRestore()
    })
  })
})

describe("SOAP body handling edge cases", () => {
  beforeEach(() => vi.clearAllMocks())

  const client = () =>
    new RvoClient({ authMode: "ABA", clientName: "n", aba: { username: "u", password: "p" } })

  it("maps a timeout while reading the body", async () => {
    const error = new Error("x")
    error.name = "TimeoutError"
    mockFetch().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => {
        throw error
      },
    })
    const e = await capture(client().opvragenBedrijfspercelen())
    expect(e).toMatchObject({
      kind: "timeout",
      operation: "opvragenBedrijfspercelen",
      httpStatus: 200,
    })
  })

  it("maps other failures while reading the body to network", async () => {
    mockFetch().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => {
        throw new Error("boom")
      },
    })
    const e = await capture(client().opvragenBedrijfspercelen())
    expect(e).toMatchObject({ kind: "network", httpStatus: 200 })
  })

  it("classifies a body read failure on a non-OK response as http", async () => {
    mockFetch().mockResolvedValue({
      ok: false,
      status: 502,
      text: async () => {
        throw new Error("boom")
      },
    })
    const e = await capture(client().opvragenBedrijfspercelen())
    expect(e).toMatchObject({ kind: "http", httpStatus: 502 })
  })

  it("maps a non-Error rejection to network", async () => {
    mockFetch().mockRejectedValue("boom")
    const e = await capture(client().opvragenBedrijfspercelen())
    expect(e).toMatchObject({ kind: "network" })
  })

  it.each([
    [true, "invalid_response"],
    [false, "http"],
  ])("handles an oversized body (ok=%s)", async (ok, kind) => {
    mockFetch().mockResolvedValue({
      ok,
      status: ok ? 200 : 503,
      text: async () => "x".repeat(MAX_BODY_BYTES + 1),
    })
    const e = await capture(client().opvragenBedrijfspercelen())
    expect(e).toMatchObject({ kind, httpStatus: ok ? 200 : 503 })
  })

  it("returns parsed XML for a successful default request", async () => {
    mockFetch().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => "<Envelope><Body><R>1</R></Body></Envelope>",
    })
    await expect(client().opvragenBedrijfspercelen()).resolves.toEqual({
      Envelope: { Body: { R: "1" } },
    })
  })

  it("returns GeoJSON from a successful transform", async () => {
    mockFetch().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => "<Envelope><Body><R>1</R></Body></Envelope>",
    })
    const out = await (client() as any).executeSoapRequest(
      "opvragenBedrijfspercelen",
      "<x/>",
      "geojson",
      () => "transformed",
    )
    expect(out).toBe("transformed")
  })
})

describe("SOAP non-Error body rejection", () => {
  it("maps a non-Error rejection while reading the body to network", async () => {
    const client = new RvoClient({
      authMode: "ABA",
      clientName: "n",
      aba: { username: "u", password: "p" },
    })
    mockFetch().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => {
        throw "boom"
      },
    })
    expect((await capture(client.opvragenBedrijfspercelen())).kind).toBe("network")
  })
})

describe("stream edge cases", () => {
  it("ignores a failing cancel on an oversized stream", async () => {
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        controller.enqueue(new Uint8Array(MAX_BODY_BYTES + 1))
      },
      cancel() {
        throw new Error("cancel failed")
      },
    })
    const result = await readBoundedText(new Response(stream))
    expect(result).toEqual({ text: "", oversized: true })
  })
})
