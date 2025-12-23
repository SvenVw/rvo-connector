import { describe, it, expect } from "vitest"
import {
  buildMuterenRequest,
  buildFormaliserenRequest,
  buildTanRequest,
} from "../../src/soap/builder"
import type { Geometry } from "geojson"

describe("SOAP Builders", () => {
  const clientName = "TestClient"
  const farmId = "12345678"

  it("buildMuterenRequest should generate correct XML for Insert", () => {
    const geometry: Geometry = {
      type: "Polygon",
      coordinates: [
        [
          [5.0, 52.0],
          [5.1, 52.0],
          [5.1, 52.1],
          [5.0, 52.1],
          [5.0, 52.0],
        ],
      ],
    }

    const xml = buildMuterenRequest({
      farmId,
      issuerId: clientName,
      senderId: clientName,
      mutations: [
        {
          action: "I",
          geometry,
          properties: {
            CropFieldDesignator: "Veld 1",
            CropTypeCode: 247,
            BeginDate: "2024-01-01",
          },
        },
      ],
    })

    expect(xml).toContain("CRPRQMB")
    expect(xml).toContain("<far:Field>")
    expect(xml).toContain("<crop:Border>")
    // We strip the outer <gml:Polygon> so crop:Border acts as the polygon
    expect(xml).not.toContain("<gml:Polygon")
    expect(xml).toContain("<gml:exterior>")
    expect(xml).toContain('srsName="EPSG:28992"')
    expect(xml).toContain("<mut:Farm>")
    expect(xml).toContain("<far:ThirdPartyFarmID")
  })

  it("buildMuterenRequest should throw error for Delete action if EndDate is missing", () => {
    expect(() =>
      buildMuterenRequest({
        farmId,
        issuerId: clientName,
        senderId: clientName,
        mutations: [
          {
            action: "D",
            properties: {
              CropFieldID: "DELETE-ME",
              CropFieldDesignator: "Veld X",
            },
          },
        ],
      }),
    ).toThrow(/requires an 'EndDate'/)
  })

  it("buildMuterenRequest should include EndDate for Delete action if provided", () => {
    const xml = buildMuterenRequest({
      farmId,
      issuerId: clientName,
      senderId: clientName,
      mutations: [
        {
          action: "D",
          properties: {
            CropFieldID: "DELETE-ME",
            CropFieldDesignator: "Veld X",
            EndDate: "2024-12-31",
          },
        },
      ],
    })

    expect(xml).toContain("<crop:EndDate>2024-12-31</crop:EndDate>")
  })

  it("buildMuterenRequest should include PrecedingTicketId", () => {
    const xml = buildMuterenRequest({
      farmId,
      issuerId: clientName,
      senderId: clientName,
      precedingTicketId: "PREV-TICKET-999",
      mutations: [],
    })

    expect(xml).toContain("<mut:PrecedingTicketId>PREV-TICKET-999</mut:PrecedingTicketId>")
  })

  it("buildMuterenRequest should use provided raw GML inside crop:Border", () => {
    const rawGml = "<gml:Polygon>...</gml:Polygon>"
    const xml = buildMuterenRequest({
      farmId,
      issuerId: clientName,
      senderId: clientName,
      mutations: [
        {
          action: "I",
          gml: rawGml,
          properties: {
            CropFieldDesignator: "Veld GML",
            CropTypeCode: 247,
            BeginDate: "2024-01-01",
          },
        },
      ],
    })

    expect(xml).toContain("<crop:Border><gml:Polygon>...</gml:Polygon></crop:Border>")
  })

  it("buildMuterenRequest should generate correct XML for Update", () => {
    const xml = buildMuterenRequest({
      farmId,
      issuerId: clientName,
      senderId: clientName,
      mutations: [
        {
          action: "U",
          properties: {
            CropFieldID: "EXISTING-ID",
            CropFieldDesignator: "Veld 1 Updated",
          },
        },
      ],
    })

    expect(xml).toContain("<fiel:FieldID>EXISTING-ID</fiel:FieldID>")
    expect(xml).toContain("<crop:CropFieldID>EXISTING-ID</crop:CropFieldID>")
  })

  it("buildFormaliserenRequest should include TAN structure", () => {
    const ticketId = "TICKET-123"
    const sequenceNumber = 5
    const tanCode = "9999"

    const xml = buildFormaliserenRequest(ticketId, sequenceNumber, tanCode, clientName)

    expect(xml).toContain("CRPRQFB")
    expect(xml).toContain("<frm:FormaliserenOpgaveRequest>")
    expect(xml).not.toContain("<frm:TransactionAutorisation>")
    expect(xml).toContain("<frm:TicketId>TICKET-123</frm:TicketId>")
    expect(xml).toContain("<frm:SequenceNumber>5</frm:SequenceNumber>")
    expect(xml).toContain("<frm:AuthorisationNumber>9999</frm:AuthorisationNumber>")
  })

  it("buildTanRequest should generate correct XML", () => {
    const xml = buildTanRequest(clientName, undefined)
    expect(xml).toContain("CRPRQOT")
    expect(xml).toContain("<tan:OpvragenTanVolgnummerRequest>")
  })
})
