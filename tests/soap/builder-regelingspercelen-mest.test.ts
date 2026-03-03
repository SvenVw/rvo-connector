import { describe, it, expect } from "vitest"
import { buildRegelingspercelenMestRequest } from "../../src/soap/builder"

describe("buildRegelingspercelenMestRequest", () => {
  it("should build a basic request with default dates", () => {
    const xml = buildRegelingspercelenMestRequest({
      issuerId: "TestClient",
      senderId: "TestClient",
    })

    expect(xml).toContain(
      `<exc:Issuer>\n               <exc:ID>TestClient</exc:ID>\n            </exc:Issuer>`,
    )
    expect(xml).toContain("<exc:Type>CRPRQRM</exc:Type>")
    expect(xml).toContain("OpvragenRegelingspercelenMESTRequest")
    expect(xml).toContain("OpvragenRegelingspercelenMEST")
    // Default dates check (current year)
    const year = new Date().getFullYear()
    expect(xml).toContain(`<spec:PeriodBeginDate>${year}-01-01</spec:PeriodBeginDate>`)
  })

  it("should include MutationStartDate when provided", () => {
    const xml = buildRegelingspercelenMestRequest({
      issuerId: "TestClient",
      senderId: "TestClient",
      mutationStartDate: "2024-01-01 12:00:00",
    })

    expect(xml).toContain("<opv:MutationStartDate>2024-01-01T12:00:00</opv:MutationStartDate>")
  })

  it("should include MandatedRepresentative when provided", () => {
    const xml = buildRegelingspercelenMestRequest({
      issuerId: "TestClient",
      senderId: "TestClient",
      mandatedRepresentative: "12345678",
    })

    expect(xml).toContain('<opv:MandatedRepresentative schemeAgencyName="KVK">12345678</opv:MandatedRepresentative>')
  })

  it("should escape special characters in XML fields", () => {
    const xml = buildRegelingspercelenMestRequest({
      issuerId: "Test & Client",
      senderId: "Test <Sender>",
      farmId: "123'456",
    })

    expect(xml).toContain("Test &amp; Client")
    expect(xml).toContain("Test &lt;Sender&gt;")
    expect(xml).toContain("123&apos;456")
  })

  it("should throw error if issuerId or senderId is missing", () => {
    expect(() => buildRegelingspercelenMestRequest({ senderId: "S" }) as any).toThrow("Client Name is required")
    expect(() => buildRegelingspercelenMestRequest({ issuerId: "I" }) as any).toThrow("Client Name is required")
  })
})
