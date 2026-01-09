import { describe, it, expect } from "vitest"
import { buildBedrijfspercelenRequest } from "../../src/soap/builder"

describe("buildBedrijfspercelenRequest", () => {
  it("should build a basic request with default dates", () => {
    const xml = buildBedrijfspercelenRequest({
      issuerId: "TestClient",
      senderId: "TestClient",
    })

    expect(xml).toContain(
      "<exc:Issuer>\n               <exc:ID>TestClient</exc:ID>\n            </exc:Issuer>",
    )
    expect(xml).toContain("<exc:Type>CRPRQBP</exc:Type>")
    // Default dates check (current year)
    const year = new Date().getFullYear()
    expect(xml).toContain(`<spec:PeriodBeginDate>${year}-01-01</spec:PeriodBeginDate>`)
  })

  it("should escape special characters in XML fields", () => {
    const xml = buildBedrijfspercelenRequest({
      issuerId: "Test & Client",
      senderId: "Test <Sender>",
      farmId: "123'456",
    })

    expect(xml).toContain("Test &amp; Client")
    expect(xml).toContain("Test &lt;Sender&gt;")
    expect(xml).toContain("123&apos;456")
  })

  it("should include ABA Security Header when credentials are provided", () => {
    const xml = buildBedrijfspercelenRequest({
      issuerId: "TestClient",
      senderId: "TestClient",
      abaCredentials: {
        username: "user<name>",
        password: "pass&word",
      },
    })

    expect(xml).toContain("<soapenv:Header>")
    expect(xml).toContain("<UsernameToken>")
    expect(xml).toContain("<Username>user&lt;name&gt;</Username>")
    expect(xml).toContain("<Password>pass&amp;word</Password>")
  })

  it("should throw error if issuerId or senderId is missing", () => {
    expect(() => buildBedrijfspercelenRequest({ senderId: "S" })).toThrow("Client Name is required")
    expect(() => buildBedrijfspercelenRequest({ issuerId: "I" })).toThrow("Client Name is required")
  })
})
