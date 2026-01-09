import { v4 as uuidv4 } from "uuid"

/**
 * Escapes special characters in a string for use in XML.
 */
function escapeXml(unsafe: string): string {
  return unsafe.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case "<":
        return "&lt;"
      case ">":
        return "&gt;"
      case "&":
        return "&amp;"
      case "'":
        return "&apos;"
      case '"':
        return "&quot;"
      default:
        return c
    }
  })
}

/**
 * Parameters required to build the SOAP request for OpvragenBedrijfspercelen.
 */
export interface SoapRequestParams {
  /** Farm ID to query (optional). */
  farmId?: string
  /** Start date of the query period. */
  periodBeginDate?: string
  /** End date of the query period. */
  periodEndDate?: string
  /** ABA credentials if using ABA authentication. */
  abaCredentials?: {
    username: string
    password?: string
  }
  /** ID of the Issuer (client). */
  issuerId?: string
  /** ID of the Sender (client). */
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

  const periodBeginDate = params.periodBeginDate || `${currentYear}-01-01`
  const periodEndDate = params.periodEndDate || `${currentYear + 2}-01-01`

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
