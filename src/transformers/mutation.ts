import type {
  MuterenResponse,
  ProcesVoortgangResponse,
  ValidatieResultaatResponse,
  TanResponse,
  TransactionResponse,
  ValidationMessage,
} from "../types"

/**
 * Helper to ensure an object is always an array.
 */
function ensureArray<T>(input: T | T[] | undefined | null): T[] {
  if (!input) return []
  if (Array.isArray(input)) return input
  return [input]
}

/**
 * Transforms the raw XML response from `MuterenBedrijfspercelen` into a `MuterenResponse`.
 *
 * @param rawResponse The parsed XML object.
 * @returns The simplified response containing the TicketID.
 */
export function transformMuterenResponse(rawResponse: any): MuterenResponse {
  const body = rawResponse?.Envelope?.Body
  const response = body?.MuterenBedrijfspercelenResponse || body?.Response // Fallback

  if (!response?.TicketId) {
    throw new Error(
      "Invalid response: TicketId not found in MuterenBedrijfspercelenResponse",
    )
  }

  return { ticketId: response.TicketId }
}

/**
 * Transforms the raw XML response from `OpvragenProcesvoortgang` into a `ProcesVoortgangResponse`.
 *
 * @param rawResponse The parsed XML object.
 * @returns The status and percentage of the process.
 */
export function transformProcesVoortgangResponse(
  rawResponse: any,
): ProcesVoortgangResponse {
  const response = rawResponse?.Envelope?.Body?.OpvragenProcesvoortgangResponse

  if (!response) {
    throw new Error(
      "Invalid response: OpvragenProcesvoortgangResponse not found",
    )
  }

  return {
    status: response.ProcesStatus?.Code || "UNKNOWN",
    message:
      response.ProcesStatus?.Name || response.ProcesStatus?.Description || "",
    percentage: parseInt(response.ProcesStatus?.PercentageProgress || "0", 10),
  }
}

/**
 * Transforms the raw XML response from `OpvragenValidatieresultaat` into a `ValidatieResultaatResponse`.
 *
 * @param rawResponse The parsed XML object.
 * @returns The validation messages and proposed fields.
 */
export function transformValidatieResultaatResponse(
  rawResponse: any,
): ValidatieResultaatResponse {
  const response =
    rawResponse?.Envelope?.Body?.OpvragenValidatieresultaatResponse

  if (!response) {
    throw new Error(
      "Invalid response: OpvragenValidatieresultaatResponse not found",
    )
  }

  const messages: ValidationMessage[] = []
  const fieldValidations = ensureArray(response.FieldValidation)

  for (const fv of fieldValidations) {
    const results = ensureArray(fv.Result)
    for (const res of results) {
      messages.push({
        code: res.MessageCode,
        message: res.MessageDescription,
        severity: res.SeverityCode,
        fieldId: fv.FieldId, // Context from parent
      })
    }
  }

  return {
    ticketId: response.TicketId,
    messages: messages,
    proposedFields: fieldValidations, // Return the raw fields as well
  }
}

/**
 * Transforms the raw XML response from `OphalenTanVolgnummer` into a `TanResponse`.
 *
 * @param rawResponse The parsed XML object.
 * @returns The sequence number.
 */
export function transformTanResponse(rawResponse: any): TanResponse {
  const response = rawResponse?.Envelope?.Body?.OphalenTanVolgnummerResponse

  if (!response?.SequenceNumber) {
    throw new Error("Invalid response: SequenceNumber not found")
  }

  return {
    sequenceNumber: parseInt(response.SequenceNumber, 10),
  }
}

/**
 * Transforms the raw XML response from `FormaliserenOpgave` or `AnnulerenOpgave`.
 *
 * @param rawResponse The parsed XML object.
 * @returns The result code and message.
 */
export function transformTransactionResponse(
  rawResponse: any,
): TransactionResponse {
  const body = rawResponse?.Envelope?.Body
  const response =
    body?.FormaliserenOpgaveResponse || body?.AnnulerenOpgaveResponse

  if (!response) {
    throw new Error("Invalid response: Transaction response not found")
  }

  return {
    ticketId: response.TicketId,
    resultCode: response.ResultCode,
    message: response.ResultMessage,
  }
}
