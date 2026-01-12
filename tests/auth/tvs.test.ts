import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { TvsAuth } from "../../src/auth/tvs"
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
    // vi.useRealTimers() // Not strictly necessary if we never set fake, but good practice if we change back
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
      json: async () => mockResponse,
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
        json: async () => mockResponse,
      }
    })

    const result = await tvsAuth.getAccessToken("mock-auth-code")
    expect(result).toEqual(mockResponse)
  })

  it("should use default timeout of 30000ms if not configured", async () => {
    vi.useFakeTimers()
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

    // Advance time by 30000ms
    vi.advanceTimersByTime(30000)

    await expect(promise).rejects.toThrow("Request to token endpoint timed out after 30000ms")
    vi.useRealTimers()
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

    await expect(tvsAuth.getAccessToken("code")).rejects.toThrow(
      "Failed to obtain access token: 400 Bad Request",
    )
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
