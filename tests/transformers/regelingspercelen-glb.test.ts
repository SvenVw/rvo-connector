import { describe, it, expect } from "vitest"
import { transformRegelingspercelenGLBToGeoJSON } from "../../src/transformers/regelingspercelen-glb"

// Mock data helpers
const createEnvelope = (content: any) => ({
  Envelope: {
    Body: {
      OpvragenRegelingspercelenGLBResponse: content,
    },
  },
})

describe("transformRegelingspercelenGLBToGeoJSON", () => {
  it("should handle an empty response", () => {
    const input = {}
    const result = transformRegelingspercelenGLBToGeoJSON(input)
    expect(result).toEqual({ type: "FeatureCollection", features: [] })
  })

  it("should transform a single GLB field with nested structures", () => {
    const input = createEnvelope({
      Farm: {
        Field: {
          GLBFieldid: "GLB1",
          BeginDate: "2023-01-01T00:00:00",
          Grondbedekking: "265",
          Border: {
            exterior: {
              LinearRing: {
                posList: "155000 463000 155100 463000 155100 463100 155000 463000",
              },
            },
          },
          QualityIndicator: {
            IndicatorCode: "KI001",
            GLBFieldQICause: "A",
          },
          Voorteelt: {
            Grondbedekking: "233",
            Oppervlakte: "1.0",
            GewasbeschermingVoorteelt: "1",
          },
          Nateelt: [
            {
              Grondbedekking: "236",
              Oppervlakte: "0.5",
              Inzaaidatum: "1",
            },
          ],
          Task: {
            Taskid: "TASK1",
            Operation: {
              OperationId: "OP1",
              TreatmentZone: {
                TreatmentZoneId: "TZ1",
                ActivityCode: "ACT1",
                QualityIndicator: {
                  IndicatorCode: "KI001",
                  ActivityCause: "A",
                },
                Border: {
                  exterior: {
                    LinearRing: {
                      posList: "155010 463010 155020 463010 155020 463020 155010 463010",
                    },
                  },
                },
              },
            },
          },
        },
      },
    })

    const result = transformRegelingspercelenGLBToGeoJSON(input)

    expect(result.type).toBe("FeatureCollection")
    expect(result.features).toHaveLength(1)

    const feature = result.features[0]
    expect(feature.properties.GLBFieldid).toBe("GLB1")
    expect(feature.geometry.type).toBe("Polygon")

    // Check Voorteelt / Nateelt
    expect(feature.properties.Voorteelt).toBeDefined()
    expect(feature.properties.Voorteelt.Grondbedekking).toBe("233")
    expect(feature.properties.Nateelt).toHaveLength(1)
    expect(feature.properties.Nateelt[0].Grondbedekking).toBe("236")

    // Check QualityIndicator
    expect(feature.properties.QualityIndicator).toBeDefined()
    expect(feature.properties.QualityIndicator.IndicatorCode).toBe("KI001")

    // Check Task/Operation/TreatmentZone nesting
    expect(feature.properties.Task).toBeDefined()
    const task = Array.isArray(feature.properties.Task)
      ? feature.properties.Task[0]
      : feature.properties.Task

    const op = Array.isArray(task.Operation) ? task.Operation[0] : task.Operation

    const tz = Array.isArray(op.TreatmentZone) ? op.TreatmentZone[0] : op.TreatmentZone
    expect(tz.TreatmentZoneId).toBe("TZ1")
    expect(tz.QualityIndicator).toBeDefined()
    expect(tz.QualityIndicator.IndicatorCode).toBe("KI001")
    expect(tz.geometry).toBeDefined()
    expect(tz.geometry.type).toBe("Polygon")
  })

  it("should enrich properties when enrichResponse is true", () => {
    const input = createEnvelope({
      Farm: {
        Field: {
          GLBFieldid: "GLB_ENRICH",
          Grondbedekking: "265",
          IndBiss: "J",
          BiologischeProductiewijze: "1",
          Border: {
            exterior: {
              LinearRing: { posList: "155000 463000 155100 463000 155000 463000" },
            },
          },
          Voorteelt: {
            Grondbedekking: "233",
            Oppervlakte: "1.0",
            GewasbeschermingVoorteelt: "1",
          },
          Nateelt: {
            Grondbedekking: "265",
            Inzaaidatum: "1",
            Oppervlakte: "1.5",
          },
          Task: {
            Operation: {
              TreatmentZone: {
                ActivityCode: "H05",
                DeviationReason: "1",
                Border: {
                  exterior: {
                    LinearRing: { posList: "155010 463010 155020 463010 155010 463010" },
                  },
                },
              },
            },
          },
        },
      },
    })

    const result = transformRegelingspercelenGLBToGeoJSON(input, { enrichResponse: true })
    const props = result.features[0].properties

    expect(props.descriptiveValues).toBeDefined()
    expect(props.descriptiveValues.Grondbedekking).toContain("grasland, blijvend")
    expect(props.descriptiveValues.IndBiss).toBe(true)
    expect(props.descriptiveValues.BiologischeProductiewijze).toBe("Biologisch")

    // Check enrichment in nested structures (Voorteelt)
    expect(props.Voorteelt.descriptiveValues).toBeDefined()
    expect(props.Voorteelt.descriptiveValues.Grondbedekking).toContain("tarwe, winter-")
    expect(props.Voorteelt.descriptiveValues.GewasbeschermingVoorteelt).toBe("Ja, op hele perceel")

    // Check enrichment in nested structures (Nateelt)
    const nateelt = Array.isArray(props.Nateelt) ? props.Nateelt[0] : props.Nateelt
    expect(nateelt.descriptiveValues).toBeDefined()
    expect(nateelt.descriptiveValues.Inzaaidatum).toBe("Uiterlijk 1 oktober")

    // Check enrichment in nested structures (TreatmentZone)
    const task = Array.isArray(props.Task) ? props.Task[0] : props.Task
    const op = Array.isArray(task.Operation) ? task.Operation[0] : task.Operation
    const tz = Array.isArray(op.TreatmentZone) ? op.TreatmentZone[0] : op.TreatmentZone
    expect(tz.descriptiveValues).toBeDefined()
    expect(tz.descriptiveValues.ActivityCode).toBe("Grasland met kruiden")
    // Check DeviationReason is enriched
    expect(tz.descriptiveValues.DeviationReason).toBe("Overige reden")
  })

  it("should handle arrays of Fields, Tasks, Operations, and TreatmentZones", () => {
    const input = createEnvelope({
      Farm: {
        Field: [
          {
            GLBFieldid: "F1",
            Border: {
              exterior: {
                LinearRing: { posList: "155000 463000 155100 463000 155000 463000" },
              },
            },
            Task: [
              {
                Taskid: "T1",
                Operation: [
                  {
                    OperationId: "O1",
                    TreatmentZone: [
                      {
                        TreatmentZoneId: "TZ1",
                        Border: { exterior: { LinearRing: { posList: "0 0 1 0 0 0" } } },
                      },
                      {
                        TreatmentZoneId: "TZ2",
                        Border: { exterior: { LinearRing: { posList: "0 0 1 0 0 0" } } },
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
    })

    const result = transformRegelingspercelenGLBToGeoJSON(input)
    expect(result.features).toHaveLength(1)
    const field = result.features[0].properties
    expect(field.Task).toHaveLength(1)
    expect(field.Task[0].Operation).toHaveLength(1)
    expect(field.Task[0].Operation[0].TreatmentZone).toHaveLength(2)
  })

  it("should handle null/edge cases in nested structures", () => {
    const input = createEnvelope({
      Farm: {
        Field: {
          GLBFieldid: "EDGE",
          Border: { exterior: { LinearRing: { posList: "0 0 1 0 0 0" } } },
          Task: [
            null, // Coverage for !task
            {
              Operation: [
                null, // Coverage for !op
                {
                  TreatmentZone: [
                    null, // Coverage for !tz
                    {
                      TreatmentZoneId: "TZ_OK",
                      Border: { exterior: { LinearRing: { posList: "0 0 1 0 0 0" } } },
                    },
                  ],
                },
              ],
            },
          ],
        },
      },
    })
    const result = transformRegelingspercelenGLBToGeoJSON(input)
    expect(result.features).toHaveLength(1)
    const task = result.features[0].properties.Task[1]
    expect(task.Operation[1].TreatmentZone[1].TreatmentZoneId).toBe("TZ_OK")
  })
})
