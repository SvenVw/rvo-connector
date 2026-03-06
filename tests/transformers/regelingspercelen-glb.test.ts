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
        GLBField: {
          GLBFieldid: "GLB1",
          BeginDate: "2023-01-01:00:00:00",
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
          Task: {
            Taskid: "TASK1",
            Operation: {
              OperationId: "OP1",
              Treatmentzone: {
                TreatmentzoneId: "TZ1",
                ActivityCode: "ACT1",
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

    // Check QualityIndicator
    expect(feature.properties.QualityIndicator).toBeDefined()
    expect(feature.properties.QualityIndicator.IndicatorCode).toBe("KI001")

    // Check Task/Operation/Treatmentzone nesting
    expect(feature.properties.Task).toBeDefined()
    const task = Array.isArray(feature.properties.Task)
      ? feature.properties.Task[0]
      : feature.properties.Task
    expect(task.Taskid).toBe("TASK1")

    const op = Array.isArray(task.Operation) ? task.Operation[0] : task.Operation
    expect(op.OperationId).toBe("OP1")

    const tz = Array.isArray(op.Treatmentzone) ? op.Treatmentzone[0] : op.Treatmentzone
    expect(tz.TreatmentzoneId).toBe("TZ1")
    expect(tz.geometry).toBeDefined()
    expect(tz.geometry.type).toBe("Polygon")
    expect(tz.Border).toBeUndefined() // Should be moved to geometry
  })

  it("should enrich properties when enrichResponse is true", () => {
    const input = createEnvelope({
      Farm: {
        GLBField: {
          GLBFieldid: "GLB_ENRICH",
          Grondbedekking: "265",
          IndBiss: "J",
          BiologischeProductiewijze: "1",
          Border: {
            exterior: {
              LinearRing: { posList: "155000 463000 155100 463000 155000 463000" },
            },
          },
          Nateelt: {
            Grondbedekking: "265",
            Inzaaidatum: "1",
            Oppervlakte: "1.5",
          },
          Task: {
            Operation: {
              Treatmentzone: {
                ActivityCode: "ACT1",
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

    // Check enrichment in nested structures (Nateelt)
    const nateelt = Array.isArray(props.Nateelt) ? props.Nateelt[0] : props.Nateelt
    expect(nateelt.descriptiveValues).toBeDefined()
    expect(nateelt.descriptiveValues.Inzaaidatum).toBe("Uiterlijk 1 oktober")
  })

  it("should handle arrays of Fields, Tasks, Operations, and Treatmentzones", () => {
    const input = createEnvelope({
      Farm: {
        GLBField: [
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
                    Treatmentzone: [
                      {
                        TreatmentzoneId: "TZ1",
                        Border: { exterior: { LinearRing: { posList: "0 0 1 0 0 0" } } },
                      },
                      {
                        TreatmentzoneId: "TZ2",
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
    expect(field.Task[0].Operation[0].Treatmentzone).toHaveLength(2)
  })
})
