import { describe, it, expect } from "vitest"
import { transformBedrijfspercelenToGeoJSON } from "../../src/transformers/bedrijfspercelen"

// Mock data helpers
const createEnvelope = (content: any) => ({
  Envelope: {
    Body: {
      OpvragenBedrijfspercelenResponse: content,
    },
  },
})

describe("transformBedrijfspercelenToGeoJSON", () => {
  it("should handle an empty response", () => {
    const input = {}
    const result = transformBedrijfspercelenToGeoJSON(input)
    expect(result).toEqual({ type: "FeatureCollection", features: [] })
  })

  it("should handle response with no Farm", () => {
    const input = createEnvelope({})
    const result = transformBedrijfspercelenToGeoJSON(input)
    expect(result).toEqual({ type: "FeatureCollection", features: [] })
  })

  it("should handle response with Farm but no Fields", () => {
    const input = createEnvelope({ Farm: {} })
    const result = transformBedrijfspercelenToGeoJSON(input)
    expect(result).toEqual({ type: "FeatureCollection", features: [] })
  })

  it("should transform a single crop field with a polygon", () => {
    const input = createEnvelope({
      Farm: {
        Field: {
          CropField: {
            CropFieldID: "ID1",
            CropTypeCode: { _: "101", $: { listID: "CL" } }, // Attribute structure
            Border: {
              exterior: {
                LinearRing: {
                  posList: "155000 463000 155100 463000 155100 463100 155000 463000",
                },
              },
            },
          },
        },
      },
    })

    const result = transformBedrijfspercelenToGeoJSON(input)

    expect(result.type).toBe("FeatureCollection")
    expect(result.features).toHaveLength(1)

    const feature = result.features[0]
    expect(feature.type).toBe("Feature")
    expect(feature.geometry.type).toBe("Polygon")

    // Check properties extraction
    expect(feature.properties).toHaveProperty("CropFieldID", "ID1")
    expect(feature.properties).toHaveProperty("CropTypeCode", "101")
    expect(feature.properties).not.toHaveProperty("Border") // Should be removed from properties

    // Check geometry coordinate structure (should be nested array for Polygon)
    const coords = (feature.geometry as any).coordinates
    expect(coords).toHaveLength(1) // 1 exterior ring
    expect(coords[0]).toHaveLength(4) // 4 points
    // Coordinates should be transformed to WGS84, so not 155000
    expect(coords[0][0][0]).not.toBe(155000)
  })

  it("should transform multiple crop fields (array)", () => {
    const input = createEnvelope({
      Farm: {
        Field: [
          {
            CropField: {
              CropFieldID: "ID1",
              Border: {
                exterior: {
                  LinearRing: {
                    posList: "155000 463000 155100 463000 155000 463000",
                  },
                },
              },
            },
          },
          {
            CropField: {
              CropFieldID: "ID2",
              Border: {
                exterior: {
                  LinearRing: {
                    posList: "160000 470000 160100 470000 160000 470000",
                  },
                },
              },
            },
          },
        ],
      },
    })

    const result = transformBedrijfspercelenToGeoJSON(input)
    expect(result.features).toHaveLength(2)
    expect(result.features[0].properties?.CropFieldID).toBe("ID1")
    expect(result.features[1].properties?.CropFieldID).toBe("ID2")
  })

  it("should handle Polygon with holes (interior rings)", () => {
    const input = createEnvelope({
      Farm: {
        Field: {
          CropField: {
            CropFieldID: "ID_HOLE",
            Border: {
              exterior: {
                LinearRing: { posList: "0 0 100 0 100 100 0 100 0 0" },
              },
              interior: [
                {
                  LinearRing: { posList: "20 20 80 20 80 80 20 80 20 20" },
                },
              ],
            },
          },
        },
      },
    })

    const result = transformBedrijfspercelenToGeoJSON(input)
    const feature = result.features[0]
    const coords = (feature.geometry as any).coordinates

    expect(coords).toHaveLength(2) // Exterior + 1 Interior
  })

  it("should skip fields without geometry", () => {
    const input = createEnvelope({
      Farm: {
        Field: [
          {
            CropField: {
              CropFieldID: "ID_NO_GEO",
              // No Border
            },
          },
          {
            CropField: {
              CropFieldID: "ID_WITH_GEO",
              Border: {
                exterior: {
                  LinearRing: {
                    posList: "155000 463000 155100 463000 155000 463000",
                  },
                },
              },
            },
          },
        ],
      },
    })

    const result = transformBedrijfspercelenToGeoJSON(input)
    expect(result.features).toHaveLength(1)
    expect(result.features[0].properties?.CropFieldID).toBe("ID_WITH_GEO")
  })

  it('should handle xml2js "_" text content object structure', () => {
    const input = createEnvelope({
      Farm: {
        Field: {
          CropField: {
            SimpleProp: "Value",
            ComplexProp: {
              _: "TextValue",
              $: { attr: "something" },
            },
            Border: {
              exterior: {
                LinearRing: {
                  posList: {
                    _: "155000 463000 155100 463000 155000 463000",
                    $: { srsName: "EPSG:28992" },
                  },
                },
              },
            },
          },
        },
      },
    })

    const result = transformBedrijfspercelenToGeoJSON(input)
    const props = result.features[0].properties

    expect(props?.SimpleProp).toBe("Value")
    expect(props?.ComplexProp).toBe("TextValue")
  })

  it("should be robust against messy or missing coordinate strings", () => {
    const input = createEnvelope({
      Farm: {
        Field: {
          CropField: {
            Border: {
              exterior: {
                LinearRing: {
                  // Empty string
                  posList: "",
                },
              },
            },
          },
        },
      },
    })
    const result = transformBedrijfspercelenToGeoJSON(input)
    expect(result.features).toHaveLength(0) // Should be skipped
  })

  it("should transform geometry inside QualityIndicatorType", () => {
    const input = createEnvelope({
      Farm: {
        Field: {
          CropField: {
            CropFieldID: "ID_QI",
            Border: {
              exterior: {
                LinearRing: {
                  posList: "155000 463000 155100 463000 155000 463000",
                },
              },
            },
            QualityIndicatorType: {
              IndicatorCode: "KI001",
              Geometry: {
                Polygon: {
                  exterior: {
                    LinearRing: {
                      posList: "155050 463050 155060 463050 155050 463050",
                    },
                  },
                },
              },
            },
          },
        },
      },
    })

    const result = transformBedrijfspercelenToGeoJSON(input)
    const feature = result.features[0]
    const qi = feature.properties?.QualityIndicatorType

    expect(qi).toBeDefined()
    expect(qi.IndicatorCode).toBe("KI001")
    expect(qi.geometry).toBeDefined()
    expect(qi.geometry.type).toBe("Polygon")
    // Coordinate check (transformed)
    expect(qi.geometry.coordinates[0][0][0]).not.toBe(155050)
    // Original GML geometry should be removed
    expect(qi.Geometry).toBeUndefined()
  })

  it("should transform geometry inside array of QualityIndicatorTypes", () => {
    const input = createEnvelope({
      Farm: {
        Field: {
          CropField: {
            CropFieldID: "ID_QI_ARRAY",
            Border: {
              exterior: {
                LinearRing: {
                  posList: "155000 463000 155100 463000 155000 463000",
                },
              },
            },
            QualityIndicatorType: [
              {
                IndicatorCode: "KI001",
                Geometry: {
                  Polygon: {
                    exterior: {
                      LinearRing: {
                        posList: "155050 463050 155060 463050 155050 463050",
                      },
                    },
                  },
                },
              },
              {
                IndicatorCode: "KI002",
                // No geometry
              },
            ],
          },
        },
      },
    })

    const result = transformBedrijfspercelenToGeoJSON(input)
    const qiArray = result.features[0].properties?.QualityIndicatorType

    expect(qiArray).toHaveLength(2)
    expect(qiArray[0].geometry).toBeDefined()
    expect(qiArray[0].Geometry).toBeUndefined()
    expect(qiArray[1].IndicatorCode).toBe("KI002")
    expect(qiArray[1].geometry).toBeUndefined()
  })
})
