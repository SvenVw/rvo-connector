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
                          posList: { _: "155000 463000 155000 463100 155100 463100 155100 463000 155000 463000" },
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
                posList: { _: "155000 463000 155000 463100 155100 463100 155100 463000 155000 463000" },
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
})
