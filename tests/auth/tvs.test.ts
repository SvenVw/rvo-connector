import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { inspect } from "node:util"
import { TvsAuth } from "../../src/auth/tvs"
import { RvoRequestError } from "../../src/index"
import { MAX_BODY_BYTES } from "../../src/utils/safe-response"
import { DEFAULT_REQUEST_TIMEOUT_MS } from "../../src/utils/constants"
import type { RvoAuthTvsConfig } from "../../src/types"

// Mock fetch globally
global.fetch = vi.fn()

// Mock uuid and jsonwebtoken
vi.mock("uuid", () => ({ v4: () => "mock-uuid" }))
vi.mock("jsonwebtoken", () => ({
  default: {
    sign: vi.fn(() => "mock-jwt-assertion"),
  },
}))

describe("TvsAuth", () => {
  const mockConfig: RvoAuthTvsConfig = {
    clientId: "mock-client-id",
    redirectUri: "http://localhost/callback",
    pkioPrivateKey: "-----BEGIN PRIVATE KEY-----\nMOCK\n-----END PRIVATE KEY-----",
    tokenEndpoint: "https://mock-token-endpoint",
  }

  beforeEach(() => {
    vi.clearAllMocks()
    // Use real timers to avoid issues with Promise/setTimeout interactions in this specific test setup
    vi.useRealTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("should successfully get access token", async () => {
    const tvsAuth = new TvsAuth(mockConfig)
    const mockResponse = {
      access_token: "mock-access-token",
      token_type: "Bearer",
      expires_in: 3600,
    }

    const mockFetch = global.fetch as any
    mockFetch.mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify(mockResponse),
    })

    const result = await tvsAuth.getAccessToken("mock-auth-code")
    expect(result).toEqual(mockResponse)
    expect(mockFetch).toHaveBeenCalledWith(
      "https://mock-token-endpoint",
      expect.objectContaining({
        signal: expect.any(AbortSignal),
      }),
    )
  })

  it("should timeout when tokenRequestTimeoutMs is set and request takes too long", async () => {
    // Use a short timeout for the test
    const tvsAuth = new TvsAuth(mockConfig, 50)

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
        // Never resolve to simulate hang
      })
    })

    await expect(tvsAuth.getAccessToken("mock-auth-code")).rejects.toThrow(
      "Request to token endpoint timed out after 50ms",
    )
  })

  it("should not timeout if request completes within time", async () => {
    const tvsAuth = new TvsAuth(mockConfig, 1000)

    const mockResponse = {
      access_token: "mock-access-token",
      token_type: "Bearer",
      expires_in: 3600,
    }

    const mockFetch = global.fetch as any
    mockFetch.mockImplementation(async () => {
      return {
        ok: true,
        text: async () => JSON.stringify(mockResponse),
      }
    })

    const result = await tvsAuth.getAccessToken("mock-auth-code")
    expect(result).toEqual(mockResponse)
  })

  it(`should use default timeout of ${DEFAULT_REQUEST_TIMEOUT_MS}ms if not configured`, async () => {
    vi.useFakeTimers()
    // Mock AbortSignal.timeout to use Vitest's fake timers
    const timeoutSpy = vi.spyOn(AbortSignal, "timeout").mockImplementation((ms) => {
      const controller = new AbortController()
      setTimeout(() => controller.abort(), ms)
      return controller.signal
    })

    try {
      const tvsAuth = new TvsAuth(mockConfig) // No timeout configured

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

      const promise = tvsAuth.getAccessToken("mock-auth-code")

      vi.advanceTimersByTime(DEFAULT_REQUEST_TIMEOUT_MS)

      await expect(promise).rejects.toThrow(
        `Request to token endpoint timed out after ${DEFAULT_REQUEST_TIMEOUT_MS}ms`,
      )
      expect(timeoutSpy).toHaveBeenCalledWith(DEFAULT_REQUEST_TIMEOUT_MS)
    } finally {
      timeoutSpy.mockRestore()
      vi.useRealTimers()
    }
  })

  it("should throw error if clientId is missing in constructor", () => {
    const config = { ...mockConfig, clientId: undefined }
    expect(() => new TvsAuth(config as any)).toThrow("TVS clientId is required.")
  })

  it("should throw error if authorizeEndpoint is missing in getAuthorizationUrl", () => {
    const config = { ...mockConfig, authorizeEndpoint: undefined }
    const tvsAuth = new TvsAuth(config as any)
    expect(() => tvsAuth.getAuthorizationUrl("scope")).toThrow(
      "TVS Authorize Endpoint not configured.",
    )
  })

  it("should throw error if tokenEndpoint is missing in getAccessToken", async () => {
    const config = { ...mockConfig, tokenEndpoint: undefined }
    const tvsAuth = new TvsAuth(config as any)
    await expect(tvsAuth.getAccessToken("code")).rejects.toThrow(
      "TVS Token Endpoint not configured.",
    )
  })

  it("should throw error if token endpoint returns non-ok status", async () => {
    const tvsAuth = new TvsAuth(mockConfig)
    const mockFetch = global.fetch as any
    mockFetch.mockResolvedValue({
      ok: false,
      status: 400,
      text: async () => "Bad Request",
    })

    await expect(tvsAuth.getAccessToken("code")).rejects.toMatchObject({
      kind: "http",
      httpStatus: 400,
      operation: "token_exchange",
    })
  })

  it("should validate private key format", async () => {
    // Test Public Key
    const configPublic = { ...mockConfig, pkioPrivateKey: "-----BEGIN PUBLIC KEY-----" }
    const tvsAuthPublic = new TvsAuth(configPublic)
    await expect(tvsAuthPublic.getAccessToken("code")).rejects.toThrow(
      "Invalid PKIO Private Key: It appears you provided a PUBLIC key.",
    )

    // Test Certificate
    const configCert = { ...mockConfig, pkioPrivateKey: "-----BEGIN CERTIFICATE-----" }
    const tvsAuthCert = new TvsAuth(configCert)
    await expect(tvsAuthCert.getAccessToken("code")).rejects.toThrow(
      "Invalid PKIO Private Key: It appears you provided a CERTIFICATE.",
    )

    // Test Garbage
    const configBad = { ...mockConfig, pkioPrivateKey: "GARBAGE" }
    const tvsAuthBad = new TvsAuth(configBad)
    await expect(tvsAuthBad.getAccessToken("code")).rejects.toThrow(
      "Invalid PKIO Private Key format.",
    )
  })
})

const tvsConfig = {
  clientId: "cid",
  redirectUri: "http://localhost/cb",
  pkioPrivateKey: "-----BEGIN PRIVATE KEY-----\nX\n-----END PRIVATE KEY-----",
  tokenEndpoint: "https://token.example",
}

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

describe("token exchange errors", () => {
  beforeEach(() => vi.clearAllMocks())

  const run = () => new TvsAuth({ ...tvsConfig }).getAccessToken("code")

  it.each([
    "invalid_request",
    "invalid_client",
    "invalid_grant",
    "unauthorized_client",
    "unsupported_grant_type",
    "invalid_scope",
  ])("exposes allowlisted code %s", async (code) => {
    mockFetch().mockResolvedValue({
      ok: false,
      status: 400,
      text: async () => JSON.stringify({ error: code, error_description: SENTINEL }),
    })
    const e = expectSafe(await capture(run()))
    expect(e).toMatchObject({ kind: "http", httpStatus: 400, oauthError: code })
  })

  it.each([
    ["unknown code", JSON.stringify({ error: SENTINEL, error_description: SENTINEL })],
    ["html", `<html>${SENTINEL}</html>`],
    ["malformed json", `{"error": "${SENTINEL}"`],
    ["oversized", "x".repeat(300 * 1024) + SENTINEL],
  ])("exposes only status for %s", async (_name, body) => {
    mockFetch().mockResolvedValue({ ok: false, status: 502, text: async () => body })
    const e = expectSafe(await capture(run()))
    expect(e).toMatchObject({ kind: "http", httpStatus: 502 })
    expect(e.oauthError).toBeUndefined()
  })

  it("reports timeout and network failures", async () => {
    const abort = new Error(SENTINEL)
    abort.name = "TimeoutError"
    mockFetch().mockRejectedValue(abort)
    expect(expectSafe(await capture(run())).kind).toBe("timeout")

    mockFetch().mockRejectedValue(new Error(SENTINEL))
    expect(expectSafe(await capture(run())).kind).toBe("network")
  })

  it.each([
    ["not json", SENTINEL],
    ["no access_token", JSON.stringify({ token_type: SENTINEL })],
  ])("reports invalid_response for %s", async (_n, body) => {
    mockFetch().mockResolvedValue({ ok: true, status: 200, text: async () => body })
    const e = expectSafe(await capture(run()))
    expect(e).toMatchObject({ kind: "invalid_response", httpStatus: 200 })
  })
})

describe("token response edge cases", () => {
  beforeEach(() => vi.clearAllMocks())

  const run = () =>
    new TvsAuth({
      clientId: "cid",
      redirectUri: "http://localhost/cb",
      pkioPrivateKey: "-----BEGIN PRIVATE KEY-----\nX\n-----END PRIVATE KEY-----",
      tokenEndpoint: "https://token.example",
    }).getAccessToken("code")

  it.each([
    ["array error body", false, "[1]"],
    ["null error body", false, "null"],
    ["array success body", true, "[1]"],
    ["null success body", true, "null"],
    ["empty access_token", true, JSON.stringify({ access_token: "" })],
    ["bad token_type", true, JSON.stringify({ access_token: "a", token_type: 1 })],
    [
      "bad expires_in",
      true,
      JSON.stringify({ access_token: "a", token_type: "Bearer", expires_in: "3600" }),
    ],
  ])("handles %s", async (_name, ok, body) => {
    mockFetch().mockResolvedValue({ ok, status: ok ? 200 : 400, text: async () => body })
    const e = await capture(run())
    expect(e).toBeInstanceOf(RvoRequestError)
    expect(e.kind).toBe(ok ? "invalid_response" : "http")
    expect(e.oauthError).toBeUndefined()
  })

  it("reports invalid_response for an oversized success body", async () => {
    mockFetch().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => "x".repeat(MAX_BODY_BYTES + 1),
    })
    expect((await capture(run())).kind).toBe("invalid_response")
  })

  it("accepts a valid token with optional fields", async () => {
    mockFetch().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ access_token: "a", token_type: "Bearer" }),
    })
    await expect(run()).resolves.toEqual({ access_token: "a", token_type: "Bearer" })
  })

  it("rejects a token response without token_type", async () => {
    mockFetch().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ access_token: "a" }),
    })
    expect((await capture(run())).kind).toBe("invalid_response")
  })

  it.each([
    [true, "network", 200],
    [false, "http", 502],
  ])("keeps the status when reading the body fails (ok=%s)", async (ok, kind, status) => {
    mockFetch().mockResolvedValue({
      ok,
      status,
      text: async () => {
        throw new Error("boom")
      },
    })
    expect(await capture(run())).toMatchObject({ kind, httpStatus: status })
  })

  it("keeps the status when reading the body times out", async () => {
    const err = new Error("t")
    err.name = "TimeoutError"
    mockFetch().mockResolvedValue({
      ok: false,
      status: 504,
      text: async () => {
        throw err
      },
    })
    expect(await capture(run())).toMatchObject({ kind: "timeout", httpStatus: 504 })
  })
})

describe("TvsAuth non-Error rejection", () => {
  it("maps a non-Error rejection to network", async () => {
    mockFetch().mockRejectedValue("boom")
    const e = await capture(new TvsAuth({ ...tvsConfig }).getAccessToken("c"))
    expect(e.kind).toBe("network")
  })
})
