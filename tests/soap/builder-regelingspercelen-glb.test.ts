import { describe, it, expect } from "vitest"
import { buildRegelingspercelenGLBRequest } from "../../src/soap/builder"

describe("buildRegelingspercelenGLBRequest", () => {
  it("should build a basic request with default dates", () => {
    const xml = buildRegelingspercelenGLBRequest({
      issuerId: "TestClient",
      senderId: "TestClient",
    })

    expect(xml).toContain(
      `<exc:Issuer>\n               <exc:ID>TestClient</exc:ID>\n            </exc:Issuer>`,
    )
    expect(xml).toContain("<exc:Type>CRPRQRG</exc:Type>")
    expect(xml).toContain("OpvragenRegelingspercelenGLBRequest")
    expect(xml).toContain("OpvragenRegelingspercelenGLB")
    // Default dates check (current year)
    const year = new Date().getFullYear()
    expect(xml).toContain(`<spec:PeriodBeginDate>${year}-01-01</spec:PeriodBeginDate>`)
  })

  it("should include MutationStartDate when provided", () => {
    const xml = buildRegelingspercelenGLBRequest({
      issuerId: "TestClient",
      senderId: "TestClient",
      mutationStartDate: "2024-01-01 12:00:00",
    })

    expect(xml).toContain("<opv:MutationStartDate>2024-01-01T12:00:00</opv:MutationStartDate>")
  })

  it("should include MandatedRepresentative when provided", () => {
    const xml = buildRegelingspercelenGLBRequest({
      issuerId: "TestClient",
      senderId: "TestClient",
      mandatedRepresentative: "12345678",
    })

    expect(xml).toContain(
      '<opv:MandatedRepresentative schemeAgencyName="KVK">12345678</opv:MandatedRepresentative>',
    )
  })

  it("should throw error if issuerId or senderId is missing", () => {
    expect(() => buildRegelingspercelenGLBRequest({ senderId: "S" }) as any).toThrow(
      "Client Name is required",
    )
  })
})
