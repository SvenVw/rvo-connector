import { describe, it, expect } from "vitest"
import { transformRegelingspercelenMestToGeoJSON } from "../../src/transformers/regelingspercelen-mest"

describe("transformRegelingspercelenMestToGeoJSON", () => {
  it("should transform a valid MEST XML response to GeoJSON", () => {
    const mockResponse = {
      Envelope: {
        Body: {
          OpvragenRegelingspercelenMESTResponse: {
            Farm: [
              {
                Field: [
                  {
                    MESTFieldid: "123",
                    BeginDate: "2023-01-01",
                    Grondsoort: "1",
                    Border: {
                      exterior: {
                        LinearRing: {
                          posList: {
                            _: "155000 463000 155000 463100 155100 463100 155100 463000 155000 463000",
                          },
                        },
                      },
                    },
                    Voorteelt: {
                      Grondbedekking: { _: "123" },
                      Oppervlakte: "1.5",
                    },
                  },
                ],
              },
            ],
          },
        },
      },
    }

    const geojson = transformRegelingspercelenMestToGeoJSON(mockResponse)

    expect(geojson.type).toBe("FeatureCollection")
    expect(geojson.features).toHaveLength(1)

    const feature = geojson.features[0]
    expect(feature.type).toBe("Feature")
    expect(feature.properties?.MESTFieldid).toBe("123")
    expect(feature.properties?.BeginDate).toBe("2023-01-01")
    expect(feature.properties?.Grondsoort).toBe("1")

    // Check flattened Voorteelt
    expect(feature.properties?.Voorteelt.Grondbedekking).toBe("123")
    expect(feature.properties?.Voorteelt.Oppervlakte).toBe("1.5")

    // Geometry basic check
    expect(feature.geometry.type).toBe("Polygon")
    expect((feature.geometry as any).coordinates[0]).toHaveLength(5) // 5 points to close the ring
  })

  it("should handle empty responses gracefully", () => {
    const geojson1 = transformRegelingspercelenMestToGeoJSON({})
    expect(geojson1.features).toHaveLength(0)

    const geojson2 = transformRegelingspercelenMestToGeoJSON({
      Envelope: { Body: { OpvragenRegelingspercelenMESTResponse: { Farm: {} } } },
    })
    expect(geojson2.features).toHaveLength(0)
  })

  it("should process QualityIndicators correctly", () => {
    const mockResponse = {
      Farm: {
        Field: {
          MESTFieldid: "456",
          Border: {
            exterior: {
              LinearRing: {
                posList: {
                  _: "155000 463000 155000 463100 155100 463100 155100 463000 155000 463000",
                },
              },
            },
          },
          QualityIndicatorType: {
            IndicatorCode: { _: "KI001" },
            SeverityCode: { _: "WAARSCHUWING" },
            Geometry: {
              Polygon: {
                exterior: {
                  LinearRing: {
                    posList: "155000 463000 155000 463100 155100 463100 155000 463000",
                  },
                },
              },
            },
          },
        },
      },
    }

    const geojson = transformRegelingspercelenMestToGeoJSON(mockResponse)
    expect(geojson.features).toHaveLength(1)

    const props = geojson.features[0].properties
    expect(props?.QualityIndicatorType).toBeDefined()
    expect(props?.QualityIndicatorType.IndicatorCode).toBe("KI001")
    expect(props?.QualityIndicatorType.SeverityCode).toBe("WAARSCHUWING")
    expect(props?.QualityIndicatorType.geometry.type).toBe("Polygon")
    expect(props?.QualityIndicatorType.Geometry).toBeUndefined() // Original GML should be removed
  })

  it("should enrich QualityIndicatorType with descriptive labels when enrichResponse is true", () => {
    const mockResponse = {
      Farm: {
        Field: {
          MESTFieldid: "789",
          Border: {
            exterior: {
              LinearRing: {
                posList: "155000 463000 155000 463100 155100 463100 155000 463000",
              },
            },
          },
          QualityIndicatorType: [
            {
              IndicatorCode: "KI001",
              SeverityCode: "FATAAL",
              MESTFieldQICause: "A",
            },
            {
              IndicatorCode: "KI_UNKNOWN",
              SeverityCode: "UNKNOWN_SEVERITY",
            },
          ],
        },
      },
    }

    const geojson = transformRegelingspercelenMestToGeoJSON(mockResponse, { enrichResponse: true })
    const qi = geojson.features[0].properties?.QualityIndicatorType

    expect(qi).toHaveLength(2)
    expect(qi[0].descriptiveValues.IndicatorCode).toContain("gebruikstitel")
    expect(qi[0].descriptiveValues.SeverityCode).toBe("Fataal")
    expect(qi[0].descriptiveValues.MESTFieldQICause).toBe("Actief (Nieuw)")
    expect(qi[1].descriptiveValues).toEqual({})
  })

  it("should enrich properties with code lookups and J/N mapping when enrichResponse is true", () => {
    const mockResponse = {
      Farm: {
        Field: {
          MESTFieldid: "111",
          Grondsoort: "1",
          TypeGrond: "1",
          BemonsteringProtocol: "1",
          IndNateeltMest: "1",
          GebruiksTitel: "01",
          MESTFieldCause: "A",
          SomeFlag: "J",
          AnotherFlag: "N",
          Border: {
            exterior: {
              LinearRing: {
                posList: "155000 463000 155000 463100 155100 463100 155000 463000",
              },
            },
          },
        },
      },
    }

    const geojson = transformRegelingspercelenMestToGeoJSON(mockResponse, { enrichResponse: true })
    const props = geojson.features[0].properties

    expect(props?.descriptiveValues).toBeDefined()
    expect(props?.descriptiveValues.Grondsoort).toContain("Klei")
    expect(props?.descriptiveValues.TypeGrond).toBe("Natuurgrond")
    expect(props?.descriptiveValues.BemonsteringProtocol).toContain("Ja")
    expect(props?.descriptiveValues.IndNateeltMest).toContain("nateelt")
    expect(props?.descriptiveValues.GebruiksTitel).toBe("Eigendom")
    expect(props?.descriptiveValues.MESTFieldCause).toBe("Actief (Nieuw)")
    expect(props?.descriptiveValues.SomeFlag).toBe(true)
    expect(props?.descriptiveValues.AnotherFlag).toBe(false)
  })

  it("should handle Voorteelt as an array", () => {
    const mockResponse = {
      Farm: {
        Field: {
          MESTFieldid: "222",
          Border: {
            exterior: {
              LinearRing: {
                posList: "155000 463000 155000 463100 155100 463100 155000 463000",
              },
            },
          },
          Voorteelt: [
            { Grondbedekking: { _: "100" }, Oppervlakte: "1.0" },
            { Grondbedekking: { _: "200" }, Oppervlakte: "2.0" },
          ],
        },
      },
    }

    const geojson = transformRegelingspercelenMestToGeoJSON(mockResponse)
    const props = geojson.features[0].properties

    expect(Array.isArray(props?.Voorteelt)).toBe(true)
    expect(props?.Voorteelt).toHaveLength(2)
    expect(props?.Voorteelt[0].Grondbedekking).toBe("100")
    expect(props?.Voorteelt[1].Grondbedekking).toBe("200")
  })

  it("should enrich Inzaaidatum in Voorteelt/Nateelt when enrichResponse is true", () => {
    const mockResponse = {
      Farm: {
        Field: {
          MESTFieldid: "333",
          Border: {
            exterior: {
              LinearRing: {
                posList: "155000 463000 155000 463100 155100 463100 155000 463000",
              },
            },
          },
          Nateelt: {
            Inzaaidatum: "1",
            Oppervlakte: "3.5",
          },
        },
      },
    }

    const geojson = transformRegelingspercelenMestToGeoJSON(mockResponse, { enrichResponse: true })
    const nateelt = geojson.features[0].properties?.Nateelt

    expect(nateelt).toBeDefined()
    expect(nateelt.Inzaaidatum).toBe("1")
    expect(nateelt.descriptiveValues.Inzaaidatum).toContain("oktober")
  })
})
