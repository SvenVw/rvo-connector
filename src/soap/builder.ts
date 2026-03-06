import { v4 as uuidv4 } from "uuid"

/**
 * Escapes special characters in a string for use in XML.
 * Prevents XML injection by encoding <, >, &, ', and ".
 *
 * @param unsafe The raw string to escape.
 * @returns An XML-safe encoded string.
 */
function escapeXml(unsafe: string): string {
  return unsafe
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("'", "&apos;")
    .replaceAll('"', "&quot;")
}

/**
 * Normalizes a date-time string to standard ISO format (YYYY-MM-DDTHH:MM:SS).
 *
 * - If only a date (YYYY-MM-DD) is provided, appends T00:00:00.
 * - If a space or colon is used as a date/time separator, replaces it with T.
 *
 * @param dateTime The raw date or date-time string.
 * @returns The normalized ISO 8601 date-time string, or undefined if input is empty.
 */
function normalizeDateTime(dateTime?: string): string | undefined {
  if (!dateTime) return undefined

  // Handle space or colon separator (e.g. YYYY-MM-DD HH:MM:SS or YYYY-MM-DD:HH:MM:SS)
  // Use regex to find the separator between date and time
  const match = /^(\d{4}-\d{2}-\d{2})[ :T](\d{2}:\d{2}:\d{2})$/.exec(dateTime)
  if (match) {
    return `${match[1]}T${match[2]}`
  }

  // If it's just the date (YYYY-MM-DD), append time with T separator
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateTime)) {
    return `${dateTime}T00:00:00`
  }

  return dateTime
}

/**
 * Parameters required to build the SOAP request for OpvragenBedrijfspercelen.
 */
export interface SoapRequestParams {
  /**
   * Farm ID to query (optional).
   * Typically a KvK, BSN, or OIN.
   */
  farmId?: string
  /**
   * Start date of the query period (YYYY-MM-DD).
   * If omitted, defaults to the start of the current year.
   */
  periodBeginDate?: string
  /**
   * End date of the query period (YYYY-MM-DD).
   * If omitted, defaults to two years from the current year.
   */
  periodEndDate?: string
  /**
   * ABA credentials if using ABA authentication.
   * If provided, a WS-Security header will be included in the SOAP request.
   */
  abaCredentials?: {
    /** The ABA username. */
    username: string
    /** The ABA password. */
    password?: string
  }
  /**
   * ID of the Issuer (client).
   * Usually your OIN or organization name.
   */
  issuerId?: string
  /**
   * ID of the Sender (client).
   * Usually matches the issuerId.
   */
  senderId?: string
}

/**
 * Parameters required to build the SOAP request for OpvragenRegelingspercelenMest.
 */
export interface RegelingspercelenMestRequestParams extends SoapRequestParams {
  /**
   * Mutation start date (YYYY-MM-DD or YYYY-MM-DD HH:MM:SS).
   * If provided, only fields mutated after this date are retrieved.
   */
  mutationStartDate?: string
  /**
   * KVK number (8 digits) of the mandated representative.
   */
  mandatedRepresentative?: string
}

/**
 * Parameters required to build the SOAP request for OpvragenRegelingspercelenGLB.
 */
export type RegelingspercelenGLBRequestParams = RegelingspercelenMestRequestParams

/**
 * Shared helper to build the SOAP envelope and standard ExchangedDocument.
 */
function buildSoapEnvelope(
  params: SoapRequestParams,
  options: {
    serviceNamespace: string
    requestName: string
    messageType: string
    /** Extra XML to append AFTER ExchangedDocument at the top level of the Request element */
    extraRequestXml?: string
  },
): string {
  const now = new Date()
  const currentYear = now.getFullYear()

  const messageId = uuidv4()
  const issueDate = now.toISOString().slice(0, 19) // Standard YYYY-MM-DDTHH:MM:SS

  const periodBeginDate = escapeXml(params.periodBeginDate || `${currentYear}-01-01`)
  const periodEndDate = escapeXml(params.periodEndDate || `${currentYear + 2}-01-01`)

  if (!params.issuerId || !params.senderId) {
    throw new Error(
      'Client Name is required for the SOAP request. Please configure "clientName" in the client options.',
    )
  }

  const issuerId = escapeXml(params.issuerId)
  const senderId = escapeXml(params.senderId)

  let headerXml = ""
  if (params.abaCredentials) {
    headerXml = `
 <soapenv:Header>
   <Security xmlns="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd">
    <UsernameToken>
        <Username>${escapeXml(params.abaCredentials.username)}</Username>
        <Password>${escapeXml(params.abaCredentials.password || "")}</Password>
    </UsernameToken>
   </Security>
</soapenv:Header>`
  }

  return `<?xml version="1.0" encoding="utf-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:opv="${options.serviceNamespace}" xmlns:exc="http://www.minez.nl/ws/edicrop/1.0/ExchangedDocument" xmlns:spec="http://www.minez.nl/ws/edicrop/1.0/SpecifiedDataset">
${headerXml}
  <soapenv:Body>
    <opv:${options.requestName}>
         <opv:ExchangedDocument>
            <exc:ID>${messageId}</exc:ID>
            <exc:Type>${options.messageType}</exc:Type>
            <exc:EdiCropVersion>CRP4.0</exc:EdiCropVersion>
            <exc:MessageTypeVersion>4.0</exc:MessageTypeVersion>
            <exc:IssueDate>${issueDate}</exc:IssueDate>
            <exc:Issuer>
               <exc:ID>${issuerId}</exc:ID>
            </exc:Issuer>
            <exc:Sender>
               <exc:ID>${senderId}</exc:ID>
            </exc:Sender>
            <exc:Receiver>
               <exc:ID>RVO</exc:ID>
            </exc:Receiver>
            <!--Optional:-->
            <exc:SpecifiedDataset>
               <spec:PeriodBeginDate>${periodBeginDate}</spec:PeriodBeginDate>
               <spec:PeriodEndDate>${periodEndDate}</spec:PeriodEndDate>
            </exc:SpecifiedDataset>
         </opv:ExchangedDocument>${options.extraRequestXml || ""}
      </opv:${options.requestName}>
  </soapenv:Body>
</soapenv:Envelope>`
}

/**
 * Constructs the SOAP XML string for the OpvragenBedrijfspercelen request.
 *
 * @param params The parameters for the request.
 * @returns The complete SOAP XML string.
 * @internal
 */
export function buildBedrijfspercelenRequest(params: SoapRequestParams): string {
  let extraXml = ""
  if (params.farmId) {
    extraXml += `\n         <opv:ThirdPartyFarmID schemeAgencyName="KVK">${escapeXml(params.farmId)}</opv:ThirdPartyFarmID>`
  }

  return buildSoapEnvelope(params, {
    serviceNamespace: "http://www.minez.nl/ws/edicrop/1.0/OpvragenBedrijfspercelen",
    requestName: "OpvragenBedrijfspercelenRequest",
    messageType: "CRPRQBP",
    extraRequestXml: extraXml,
  })
}

/**
 * Constructs the SOAP XML string for the OpvragenRegelingspercelenMest request.
 *
 * @param params The parameters for the request.
 * @returns The complete SOAP XML string.
 * @internal
 */
export function buildRegelingspercelenMestRequest(
  params: RegelingspercelenMestRequestParams,
): string {
  let extraXml = ""

  if (params.mandatedRepresentative) {
    extraXml += `\n         <opv:MandatedRepresentative schemeAgencyName="KVK">${escapeXml(params.mandatedRepresentative)}</opv:MandatedRepresentative>`
  }

  if (params.farmId) {
    extraXml += `\n         <opv:ThirdPartyFarmID schemeAgencyName="KVK">${escapeXml(params.farmId)}</opv:ThirdPartyFarmID>`
  }

  const normalizedMutationDate = normalizeDateTime(params.mutationStartDate)
  if (normalizedMutationDate) {
    extraXml += `\n         <opv:MutationStartDate>${escapeXml(normalizedMutationDate)}</opv:MutationStartDate>`
  }

  return buildSoapEnvelope(params, {
    serviceNamespace: "http://www.minez.nl/ws/edicrop/1.0/OpvragenRegelingspercelenMEST",
    requestName: "OpvragenRegelingspercelenMESTRequest",
    messageType: "CRPRQRM",
    extraRequestXml: extraXml,
  })
}

/**
 * Constructs the SOAP XML string for the OpvragenRegelingspercelenGLB request.
 *
 * @param params The parameters for the request.
 * @returns The complete SOAP XML string.
 * @internal
 */
export function buildRegelingspercelenGLBRequest(
  params: RegelingspercelenGLBRequestParams,
): string {
  let extraXml = ""

  if (params.mandatedRepresentative) {
    extraXml += `\n         <opv:MandatedRepresentative schemeAgencyName="KVK">${escapeXml(params.mandatedRepresentative)}</opv:MandatedRepresentative>`
  }

  if (params.farmId) {
    extraXml += `\n         <opv:ThirdPartyFarmID schemeAgencyName="KVK">${escapeXml(params.farmId)}</opv:ThirdPartyFarmID>`
  }

  const normalizedMutationDate = normalizeDateTime(params.mutationStartDate)
  if (normalizedMutationDate) {
    extraXml += `\n         <opv:MutationStartDate>${escapeXml(normalizedMutationDate)}</opv:MutationStartDate>`
  }

  return buildSoapEnvelope(params, {
    serviceNamespace: "http://www.minez.nl/ws/edicrop/1.0/OpvragenRegelingspercelenGLB",
    requestName: "OpvragenRegelingspercelenGLBRequest",
    messageType: "CRPRQRG",
    extraRequestXml: extraXml,
  })
}
