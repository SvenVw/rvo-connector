import { describe, it, expect } from "vitest"
import { getLabel, mapIndicator } from "../../src/utils/codelists"

describe("getLabel", () => {
  it("should return the label for a valid list name and string code", () => {
    expect(getLabel("UseTitleCode", "01")).toBe("Eigendom")
    expect(getLabel("Grondsoort", "1")).toBe("Grondsoort > 50% Klei")
    expect(getLabel("SeverityCode", "FATAAL")).toBe("Fataal")
  })

  it("should return the label for a numeric code", () => {
    expect(getLabel("Grondsoort", 1)).toBe("Grondsoort > 50% Klei")
    expect(getLabel("Grondsoort", 2)).toBe("Grondsoort > 50% Veen")
  })

  it("should return undefined for an unknown list name", () => {
    expect(getLabel("UnknownList", "01")).toBeUndefined()
  })

  it("should return undefined for an unknown code in a known list", () => {
    expect(getLabel("UseTitleCode", "99")).toBeUndefined()
    expect(getLabel("Grondsoort", "9")).toBeUndefined()
  })

  it("should return the fallback when the list does not exist", () => {
    expect(getLabel("UnknownList", "01", "default")).toBe("default")
  })

  it("should return the fallback when the code does not exist in the list", () => {
    expect(getLabel("UseTitleCode", "99", "onbekend")).toBe("onbekend")
  })

  it("should return the label (not the fallback) when the code is found", () => {
    expect(getLabel("UseTitleCode", "01", "fallback")).toBe("Eigendom")
  })

  it("should return labels for all existing codelists", () => {
    expect(getLabel("TypeGrond", "1")).toBe("Natuurgrond")
    expect(getLabel("BemonsteringProtocol", "1")).toContain("Ja")
    expect(getLabel("IndNateeltMest", "1")).toContain("nateelt")
    expect(getLabel("InzaaidatumCode", "1")).toContain("oktober")
    expect(getLabel("IndicatorCode", "KI001")).toContain("gebruikstitel")
    expect(getLabel("ChangeTypeCode", "10")).toBe("Ongewijzigd")
    expect(getLabel("Cause", "A")).toBe("Actief (Nieuw)")
  })

  describe("CropTypeCode (BRP)", () => {
    it("should return the crop name for known BRP crop type codes", () => {
      expect(getLabel("CropTypeCode", "233")).toBe("tarwe, winter-")
      expect(getLabel("CropTypeCode", "259")).toBe("mais, snij-")
      expect(getLabel("CropTypeCode", "265")).toBe("grasland, blijvend")
      expect(getLabel("CropTypeCode", "256")).toBe("bieten, suiker-")
    })

    it("should support numeric BRP crop type codes", () => {
      expect(getLabel("CropTypeCode", 233)).toBe("tarwe, winter-")
      expect(getLabel("CropTypeCode", 265)).toBe("grasland, blijvend")
    })

    it("should return undefined for an unknown BRP crop code", () => {
      expect(getLabel("CropTypeCode", "9999")).toBeUndefined()
    })

    it("should return the fallback for an unknown BRP crop code", () => {
      expect(getLabel("CropTypeCode", "9999", "onbekend gewas")).toBe("onbekend gewas")
    })

    it("should resolve multi-digit and four-digit BRP codes", () => {
      expect(getLabel("CropTypeCode", "1922")).toBe("koolzaad, winter (incl. boterzaad)")
      expect(getLabel("CropTypeCode", "2014")).toBe("aardappelen, consumptie")
      expect(getLabel("CropTypeCode", "7138")).toBe("palmkool")
    })
  })
})

describe("mapIndicator", () => {
  it('should return true for "J"', () => {
    expect(mapIndicator("J")).toBe(true)
  })

  it('should return false for "N"', () => {
    expect(mapIndicator("N")).toBe(false)
  })

  it("should return null for any other value", () => {
    expect(mapIndicator("Y")).toBeNull()
    expect(mapIndicator("")).toBeNull()
    expect(mapIndicator(null)).toBeNull()
    expect(mapIndicator(undefined)).toBeNull()
    expect(mapIndicator(1)).toBeNull()
  })
})
