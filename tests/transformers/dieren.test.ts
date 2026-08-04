import { describe, it, expect } from "vitest"
import {
  transformRaadplegenDieren,
  transformRaadplegenDierDetails,
} from "../../src/transformers/dieren"

describe("transformRaadplegenDieren", () => {
  it("should handle empty response gracefully", () => {
    const response = {}
    const result = transformRaadplegenDieren(response)
    expect(result).toEqual({})
  })

  it("should clean xml2js artifacts and ensure dieren array", () => {
    const rawXml2js = {
      Envelope: {
        Body: {
          raadplegenDierenResponse: {
            requestID: { _: "12345" },
            relatienummerHouder: { _: "123456" },
            dieren: {
              dierLandcode: { _: "NL" },
              dierLevensnummer: { _: "444440455" },
              moederLandcode: { _: "NL" },
            },
          },
        },
      },
    }

    const result = transformRaadplegenDieren(rawXml2js)
    expect(result.requestID).toBe("12345")
    expect(result.relatienummerHouder).toBe("123456")
    expect(Array.isArray(result.dieren)).toBe(true)
    expect(result.dieren.length).toBe(1)
    expect(result.dieren[0].dierLandcode).toBe("NL")
    expect(result.dieren[0].dierLevensnummer).toBe("444440455")
    expect(result.dieren[0].moederLandcode).toBe("NL")
  })

  it("should preserve multiple items in array if present", () => {
    const rawXml2js = {
      Envelope: {
        Body: {
          raadplegenDierenResponse: {
            dieren: [{ dierLevensnummer: { _: "1" } }, { dierLevensnummer: { _: "2" } }],
          },
        },
      },
    }

    const result = transformRaadplegenDieren(rawXml2js)
    expect(result.dieren.length).toBe(2)
    expect(result.dieren[0].dierLevensnummer).toBe("1")
    expect(result.dieren[1].dierLevensnummer).toBe("2")
  })

  it("should enrich the response with descriptiveValues when enrichResponse is true", () => {
    const rawXml2js = {
      Envelope: {
        Body: {
          raadplegenDierenResponse: {
            dieren: {
              dierSoort: { _: "1" },
              dierGeslacht: { _: "V" },
              indOntbrekendeGeboortemelding: { _: "J" },
            },
          },
        },
      },
    }

    const result = transformRaadplegenDieren(rawXml2js, { enrichResponse: true })
    expect(result.dieren[0].dierSoort).toBe("1")
    expect(result.dieren[0].dierGeslacht).toBe("V")
    expect(result.dieren[0].indOntbrekendeGeboortemelding).toBe("J")

    // Check descriptive values
    expect(result.dieren[0].descriptiveValues).toBeDefined()
    expect(result.dieren[0].descriptiveValues.dierSoort).toBe("Rund")
    expect(result.dieren[0].descriptiveValues.dierGeslacht).toBe("Vrouwelijk")
    expect(result.dieren[0].descriptiveValues.indOntbrekendeGeboortemelding).toBe(true)
  })
})

describe("transformRaadplegenDierDetails", () => {
  it("should clean xml2js artifacts and ensure sub-arrays", () => {
    const rawXml2js = {
      Envelope: {
        Body: {
          raadplegenDierDetailsResponse: {
            dierDetails: {
              dierLevensnummer: { _: "444440455" },
            },
            dierDetailsVerblijfplaatsen: {
              meldingeenheid: { _: "123" },
            },
            // other arrays are missing, should be populated with []
          },
        },
      },
    }

    const result = transformRaadplegenDierDetails(rawXml2js)
    expect(result.dierDetails.dierLevensnummer).toBe("444440455")
    expect(Array.isArray(result.dierDetailsVerblijfplaatsen)).toBe(true)
    expect(result.dierDetailsVerblijfplaatsen[0].meldingeenheid).toBe("123")
    expect(result.dierBuitenlandseVerblijven).toEqual([])
    expect(result.dierVlaggen).toEqual([])
    expect(result.dierNakomelingen).toEqual([])
    expect(result.overigeDieren).toEqual([])
  })

  it("should enrich details response with descriptiveValues recursively when enrichResponse is true", () => {
    const rawXml2js = {
      Envelope: {
        Body: {
          raadplegenDierDetailsResponse: {
            dierDetails: {
              dierSoort: { _: "11" },
              dierGeslacht: { _: "M" },
            },
            merkGegevens: {
              merkInGebruik: { _: "N" },
            },
          },
        },
      },
    }

    const result = transformRaadplegenDierDetails(rawXml2js, { enrichResponse: true })
    expect(result.dierDetails.descriptiveValues).toBeDefined()
    expect(result.dierDetails.descriptiveValues.dierSoort).toBe("Hond")
    expect(result.dierDetails.descriptiveValues.dierGeslacht).toBe("Mannelijk")

    expect(result.merkGegevens[0].descriptiveValues).toBeDefined()
    expect(result.merkGegevens[0].descriptiveValues.merkInGebruik).toBe(false)
  })
})
