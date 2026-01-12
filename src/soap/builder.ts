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
 * Constructs the SOAP XML string for the OpvragenBedrijfspercelen request.
 *
 * @param params The parameters for the request.
 * @returns The complete SOAP XML string.
 * @internal
 */
export function buildBedrijfspercelenRequest(params: SoapRequestParams): string {
  const now = new Date()
  const currentYear = now.getFullYear()

  const messageId = uuidv4()
  const issueDate = now.toISOString().slice(0, 19) // YYYY-MM-DDTHH:MM:SS

  const periodBeginDate = escapeXml(params.periodBeginDate || `${currentYear}-01-01`)
  const periodEndDate = escapeXml(params.periodEndDate || `${currentYear + 2}-01-01`)

  if (!params.issuerId) {
    throw new Error(
      'Client Name is required for the SOAP request. Please configure "clientName" in the client options.',
    )
  }
  if (!params.senderId) {
    throw new Error(
      'Client Name is required for the SOAP request. Please configure "clientName" in the client options.',
    )
  }

  const issuerId = escapeXml(params.issuerId)
  const senderId = escapeXml(params.senderId)

  const thirdPartyFarmIdXml = params.farmId
    ? `<opv:ThirdPartyFarmID schemeAgencyName="KVK">${escapeXml(params.farmId)}</opv:ThirdPartyFarmID>`
    : ""

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
  } else {
    // For TVS, we might need an empty header or no header.
    // Experiment has <soapenv:Body> directly if no header?
    // Actually experiment shows:
    // TVS: <soapenv:Envelope ...><soapenv:Body>...
    // ABA: <soapenv:Envelope ...><soapenv:Header>...</soapenv:Header><soapenv:Body>...
    // So header is optional.
  }

  return `<?xml version="1.0" encoding="utf-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:opv="http://www.minez.nl/ws/edicrop/1.0/OpvragenBedrijfspercelen" xmlns:exc="http://www.minez.nl/ws/edicrop/1.0/ExchangedDocument" xmlns:spec="http://www.minez.nl/ws/edicrop/1.0/SpecifiedDataset">
${headerXml}
  <soapenv:Body>
    <opv:OpvragenBedrijfspercelenRequest>
         <opv:ExchangedDocument>
            <exc:ID>${messageId}</exc:ID>
            <exc:Type>CRPRQBP</exc:Type>
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
         </opv:ExchangedDocument>
         ${thirdPartyFarmIdXml}
      </opv:OpvragenBedrijfspercelenRequest>
  </soapenv:Body>
</soapenv:Envelope>`
}
