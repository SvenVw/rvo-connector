import { describe, it, expect } from "vitest"
import {
  buildRaadplegenDierenRequest,
  buildRaadplegenDierDetailsRequest,
} from "../../src/soap/builder"

describe("buildRaadplegenDierenRequest", () => {
  it("should build a basic request with mandatory fields", () => {
    const xml = buildRaadplegenDierenRequest({
      selRelatienummerHouder: "123456",
      selMeldingeenheid: "789012",
    })

    expect(xml).toContain("<dier:raadplegenDieren>")
    expect(xml).toContain("<dier:requestID>")
    expect(xml).toContain("<dier:selRelatienummerHouder>123456</dier:selRelatienummerHouder>")
    expect(xml).toContain("<dier:selMeldingeenheid>789012</dier:selMeldingeenheid>")
  })

  it("should include optional fields", () => {
    const xml = buildRaadplegenDierenRequest({
      selRelatienummerHouder: "123456",
      selMeldingeenheid: "789012",
      selDierSoort: "1",
      selDierLandcode: "NL",
      selDierLevensnummer: "444440455",
      aantal: 50,
    })

    expect(xml).toContain("<dier:selDierSoort>1</dier:selDierSoort>")
    expect(xml).toContain("<dier:selDierLandcode>NL</dier:selDierLandcode>")
    expect(xml).toContain("<dier:selDierLevensnummer>444440455</dier:selDierLevensnummer>")
    expect(xml).toContain("<dier:aantal>50</dier:aantal>")
  })

  it("should escape special characters in XML fields", () => {
    const xml = buildRaadplegenDierenRequest({
      selRelatienummerHouder: "123&456",
      selMeldingeenheid: "789<012",
      selDierLandcode: "N'L",
    })

    expect(xml).toContain("123&amp;456")
    expect(xml).toContain("789&lt;012")
    expect(xml).toContain("N&apos;L")
  })

  it("should include ABA Security Header when credentials are provided", () => {
    const xml = buildRaadplegenDierenRequest({
      selRelatienummerHouder: "123",
      selMeldingeenheid: "456",
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
})

describe("buildRaadplegenDierDetailsRequest", () => {
  it("should build a basic request", () => {
    const xml = buildRaadplegenDierDetailsRequest({
      selRelatienummerHouder: "123456",
      selMeldingeenheid: "789012",
      indVerblijfplaatsen: "J",
      indVlaggen: "J",
    })

    expect(xml).toContain("<dier:raadplegenDierDetails>")
    expect(xml).toContain("<dier:requestID>")
    expect(xml).toContain("<dier:selRelatienummerHouder>123456</dier:selRelatienummerHouder>")
    expect(xml).toContain("<dier:selMeldingeenheid>789012</dier:selMeldingeenheid>")
    expect(xml).toContain("<dier:indVerblijfplaatsen>J</dier:indVerblijfplaatsen>")
    expect(xml).toContain("<dier:indVlaggen>J</dier:indVlaggen>")
  })
})
