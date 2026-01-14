import { describe, it, expect } from "vitest"
import {
  transformMuterenResponse,
  transformProcesVoortgangResponse,
  transformValidatieResultaatResponse,
  transformTanResponse,
  transformTransactionResponse,
} from "../../src/transformers/mutation"

describe("Mutation Transformers", () => {
  describe("transformMuterenResponse", () => {
    it("should extract TicketId from MuterenBedrijfspercelenResponse", () => {
      const input = {
        Envelope: {
          Body: {
            MuterenBedrijfspercelenResponse: {
              TicketId: "TICKET-123",
            },
          },
        },
      }
      const result = transformMuterenResponse(input)
      expect(result).toEqual({ ticketId: "TICKET-123" })
    })

    it("should throw error if TicketId is missing", () => {
      const input = { Envelope: { Body: {} } }
      expect(() => transformMuterenResponse(input)).toThrow(
        "TicketId not found",
      )
    })
  })

  describe("transformProcesVoortgangResponse", () => {
    it("should extract status and percentage", () => {
      const input = {
        Envelope: {
          Body: {
            OpvragenProcesvoortgangResponse: {
              ProcesStatus: {
                Code: "100",
                Name: "Done",
                PercentageProgress: "100",
              },
            },
          },
        },
      }
      const result = transformProcesVoortgangResponse(input)
      expect(result).toEqual({
        status: "100",
        message: "Done",
        percentage: 100,
      })
    })

    it("should throw if OpvragenProcesvoortgangResponse is missing", () => {
      const input = { Envelope: { Body: {} } }
      expect(() => transformProcesVoortgangResponse(input)).toThrow(
        "OpvragenProcesvoortgangResponse not found",
      )
    })
  })

  describe("transformValidatieResultaatResponse", () => {
    it("should extract TicketId and FieldValidation", () => {
      const input = {
        Envelope: {
          Body: {
            OpvragenValidatieresultaatResponse: {
              TicketId: "TICKET-ABC",
              FieldValidation: [{ some: "data" }],
            },
          },
        },
      }
      const result = transformValidatieResultaatResponse(input)
      expect(result.ticketId).toBe("TICKET-ABC")
      expect(result.proposedFields).toHaveLength(1)
    })

    it("should throw if OpvragenValidatieresultaatResponse is missing", () => {
      const input = { Envelope: { Body: {} } }
      expect(() => transformValidatieResultaatResponse(input)).toThrow(
        "OpvragenValidatieresultaatResponse not found",
      )
    })
  })

  describe("transformTanResponse", () => {
    it("should extract SequenceNumber", () => {
      const input = {
        Envelope: {
          Body: {
            OphalenTanVolgnummerResponse: {
              SequenceNumber: "5",
            },
          },
        },
      }
      const result = transformTanResponse(input)
      expect(result.sequenceNumber).toBe(5)
    })

    it("should throw if SequenceNumber is missing", () => {
      const input = {
        Envelope: {
          Body: {
            OphalenTanVolgnummerResponse: {},
          },
        },
      }
      expect(() => transformTanResponse(input)).toThrow(
        "SequenceNumber not found",
      )
    })
  })

  describe("transformTransactionResponse", () => {
    it("should extract TicketId and ResultCode from Formaliseren", () => {
      const input = {
        Envelope: {
          Body: {
            FormaliserenOpgaveResponse: {
              TicketId: "T-1",
              ResultCode: "0",
            },
          },
        },
      }
      const result = transformTransactionResponse(input)
      expect(result).toEqual({
        ticketId: "T-1",
        resultCode: "0",
        message: undefined,
      })
    })

    it("should extract TicketId from Annuleren", () => {
      const input = {
        Envelope: {
          Body: {
            AnnulerenOpgaveResponse: {
              TicketId: "T-2",
            },
          },
        },
      }
      const result = transformTransactionResponse(input)
      expect(result.ticketId).toBe("T-2")
    })

    it("should throw if transaction response is missing", () => {
      const input = { Envelope: { Body: {} } }
      expect(() => transformTransactionResponse(input)).toThrow(
        "Transaction response not found",
      )
    })
  })
})
