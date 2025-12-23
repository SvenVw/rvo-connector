import { v4 as uuidv4 } from "uuid"
import { convertGeoJSONToGML } from "../utils/geometry"
import type { MuterenRequestOptions } from "../types"

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
 * Common envelope builder to reduce duplication.
 */
function buildSoapEnvelope(
  bodyContent: string,
  abaCredentials?: { username: string; password?: string },
): string {
  let headerXml = ""
  if (abaCredentials) {
    headerXml = `
  <soapenv:Header>
    <Security xmlns="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd">
     <UsernameToken>
         <Username>${abaCredentials.username}</Username>
         <Password>${abaCredentials.password || ""}</Password>
     </UsernameToken>
    </Security>
 </soapenv:Header>`
  }

  // RVO Namespaces from example CRPRQMB
  return `<?xml version="1.0" encoding="utf-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" 
  xmlns:mut="http://www.minez.nl/ws/edicrop/1.0/MuterenBedrijfspercelen"
  xmlns:exc="http://www.minez.nl/ws/edicrop/1.0/ExchangedDocument" 
  xmlns:spec="http://www.minez.nl/ws/edicrop/1.0/SpecifiedDataset"
  xmlns:far="http://www.minez.nl/ws/edicrop/1.0/FarmNoQIs"
  xmlns:fiel="http://www.minez.nl/ws/edicrop/1.0/FieldNoQIs"
  xmlns:crop="http://www.minez.nl/ws/edicrop/1.0/CropFieldNoQIs"
  xmlns:gml="http://www.minez.nl/ws/edicrop/1.0/GMLTypes"
  xmlns:opv="http://www.minez.nl/ws/edicrop/1.0/OpvragenBedrijfspercelen" 
  xmlns:prv="http://www.minez.nl/ws/edicrop/1.0/OpvragenProcesvoortgang"
  xmlns:val="http://www.minez.nl/ws/edicrop/1.0/OpvragenValidatieresultaat"
  xmlns:tan="http://www.minez.nl/ws/edicrop/1.0/OpvragenTanVolgnummer"
  xmlns:frm="http://www.minez.nl/ws/edicrop/1.0/FormaliserenOpgave"
  xmlns:ann="http://www.minez.nl/ws/edicrop/1.0/AnnulerenOpgave">
${headerXml}
  <soapenv:Body>
${bodyContent}
  </soapenv:Body>
</soapenv:Envelope>`
}

function buildExchangedDocument(
  prefix: string,
  type: string,
  issuerId: string,
  senderId: string,
  extraContent: string = "",
): string {
  const messageId = uuidv4()
  const issueDate = new Date().toISOString() // RVO often uses full ISO with TZ

  return `<${prefix}:ExchangedDocument>
            <exc:ID>${messageId}</exc:ID>
            <exc:Type>${type}</exc:Type>
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
            ${extraContent}
         </${prefix}:ExchangedDocument>`
}

/**
 * Constructs the SOAP XML string for the OpvragenBedrijfspercelen request.
 */
export function buildBedrijfspercelenRequest(
  params: SoapRequestParams,
): string {
  if (!params.issuerId || !params.senderId)
    throw new Error("Client Name required")

  const currentYear = new Date().getFullYear()
  const periodBeginDate = params.periodBeginDate || `${currentYear}-01-01`
  const periodEndDate = params.periodEndDate || `${currentYear + 2}-01-01`

  const specifiedDataset = `
            <exc:SpecifiedDataset>
               <spec:PeriodBeginDate>${periodBeginDate}</spec:PeriodBeginDate>
               <spec:PeriodEndDate>${periodEndDate}</spec:PeriodEndDate>
            </exc:SpecifiedDataset>`

  // Opvragen uses 'opv' prefix for ExchangedDocument usually in its schema?
  // Actually XSD 32 says root is OpvragenBedrijfspercelenRequest.
  const exchangedDoc = buildExchangedDocument(
    "opv",
    "CRPRQBP",
    params.issuerId,
    params.senderId,
    specifiedDataset,
  )

  const thirdPartyFarmIdXml = params.farmId
    ? `<opv:ThirdPartyFarmID schemeAgencyName="KVK">${params.farmId}</opv:ThirdPartyFarmID>`
    : ""

  const body = `    <opv:OpvragenBedrijfspercelenRequest>
         ${exchangedDoc}
         ${thirdPartyFarmIdXml}
      </opv:OpvragenBedrijfspercelenRequest>`

  return buildSoapEnvelope(body, params.abaCredentials)
}

/**
 * Constructs the SOAP XML string for MuterenBedrijfspercelen.
 */
export function buildMuterenRequest(
  params: MuterenRequestOptions & {
    issuerId?: string
    senderId?: string
    abaCredentials?: any
  },
): string {
  if (!params.issuerId || !params.senderId)
    throw new Error("Client Name required")

  const currentYear = new Date().getFullYear()
  const periodBegin = `${currentYear}-01-01`
  const periodEnd = `${currentYear + 1}-01-01`

  const specifiedDataset = `
            <exc:SpecifiedDataset>
               <spec:PeriodBeginDate>${periodBegin}</spec:PeriodBeginDate>
               <spec:PeriodEndDate>${periodEnd}</spec:PeriodEndDate>
            </exc:SpecifiedDataset>`

  const exchangedDoc = buildExchangedDocument(
    "mut",
    "CRPRQMB",
    params.issuerId,
    params.senderId,
    specifiedDataset,
  )

  const precedingTicketIdXml = params.precedingTicketId
    ? `<mut:PrecedingTicketId>${params.precedingTicketId}</mut:PrecedingTicketId>`
    : ""

  let fieldsXml = ""

  params.mutations.forEach((mut, idx) => {
    // Note: CropFieldCause removed as it's not in example XML or XSD.

    // Geometry handling: Prefer explicit GML, otherwise convert GeoJSON
    // XSD expects crop:Border to be the PolygonType, so we strip the outer <gml:Polygon>
    // tags from the helper output to inject the inner <gml:exterior> directly.
    let geometryXml = ""
    if (mut.gml) {
      geometryXml = `<crop:Border>${mut.gml}</crop:Border>`
    } else if (mut.geometry) {
      const fullGml = convertGeoJSONToGML(mut.geometry)
      const innerGml = fullGml.replace(/^<gml:Polygon>|<\/gml:Polygon>$/g, "")
      geometryXml = `<crop:Border>${innerGml}</crop:Border>`
    }

    const props = mut.properties

    // For Delete actions, EndDate is required
    if (mut.action === "D" && !props.EndDate) {
      throw new Error(
        `Mutation action 'D' (Delete) requires an 'EndDate' property for field: ${props.CropFieldID || idx}`,
      )
    }

    let endDateXml = props.EndDate
      ? `<crop:EndDate>${props.EndDate}</crop:EndDate>`
      : ""

    // Using far:, fiel: and crop: prefixes as per RVO example
    fieldsXml += `
            <far:Field>
               <fiel:FieldID>${props.CropFieldID || `FLD-${idx}`}</fiel:FieldID>
               <fiel:CropField>
                  <crop:CropFieldID>${props.CropFieldID || `NEW-${uuidv4()}`}</crop:CropFieldID>
                  <crop:CropFieldVersion>${props.CropFieldVersion || "1"}</crop:CropFieldVersion>
                  <crop:CropFieldDesignator>${props.CropFieldDesignator || ""}</crop:CropFieldDesignator>
                  ${props.ThirdPartyCropFieldID ? `<crop:ThirdPartyCropFieldID>${props.ThirdPartyCropFieldID}</crop:ThirdPartyCropFieldID>` : ""}
                  <crop:BeginDate>${props.BeginDate || new Date().toISOString()}</crop:BeginDate>
                  ${endDateXml}
                  <crop:Country>${props.Country || "NL"}</crop:Country>
                  ${props.RegulatorySoiltypeCode ? `<crop:RegulatorySoiltypeCode listID="CL405">${props.RegulatorySoiltypeCode}</crop:RegulatorySoiltypeCode>` : ""}
                  <crop:CropTypeCode listID="CL263">${props.CropTypeCode || ""}</crop:CropTypeCode>
                  ${props.CropProductionPurposeCode ? `<crop:CropProductionPurposeCode listID="CL251">${props.CropProductionPurposeCode}</crop:CropProductionPurposeCode>` : ""}
                  ${props.FieldUseCode ? `<crop:FieldUseCode listID="CL888">${props.FieldUseCode}</crop:FieldUseCode>` : ""}
                  ${props.VarietyCode ? `<crop:VarietyCode listID="CL232">${props.VarietyCode}</crop:VarietyCode>` : ""}
                  <crop:UseTitleCode listID="CL412">${props.UseTitleCode || "01"}</crop:UseTitleCode>
                  ${geometryXml}
               </fiel:CropField>
            </far:Field>`
  })

  const body = `    <mut:MuterenBedrijfspercelenRequest>
         ${precedingTicketIdXml}
         ${exchangedDoc}
         <mut:Farm>
            <far:ThirdPartyFarmID schemeAgencyName="KVK">${params.farmId}</far:ThirdPartyFarmID>
            ${fieldsXml}
         </mut:Farm>
      </mut:MuterenBedrijfspercelenRequest>`

  return buildSoapEnvelope(body, params.abaCredentials)
}

export function buildProcesVoortgangRequest(
  ticketId: string,
  clientName: string,
  abaCredentials?: any,
  farmId?: string,
): string {
  const exchangedDoc = buildExchangedDocument(
    "prv",
    "CRPRQPV",
    clientName,
    clientName,
  )
  const farmXml = farmId
    ? `<prv:ThirdPartyFarmID schemeAgencyName="KVK">${farmId}</prv:ThirdPartyFarmID>`
    : ""
  const body = `    <prv:OpvragenProcesvoortgangRequest>
        ${exchangedDoc}
        ${farmXml}
        <prv:TicketId>${ticketId}</prv:TicketId>
    </prv:OpvragenProcesvoortgangRequest>`
  return buildSoapEnvelope(body, abaCredentials)
}

export function buildValidatieResultaatRequest(
  ticketId: string,
  clientName: string,
  abaCredentials?: any,
  farmId?: string,
): string {
  const exchangedDoc = buildExchangedDocument(
    "val",
    "CRPRQVB",
    clientName,
    clientName,
  )
  const farmXml = farmId
    ? `<val:ThirdPartyFarmID schemeAgencyName="KVK">${farmId}</val:ThirdPartyFarmID>`
    : ""
  const body = `    <val:OpvragenValidatieresultaatRequest>
        ${exchangedDoc}
        ${farmXml}
        <val:TicketId>${ticketId}</val:TicketId>
    </val:OpvragenValidatieresultaatRequest>`
  return buildSoapEnvelope(body, abaCredentials)
}

export function buildTanRequest(
  clientName: string,
  abaCredentials?: any,
): string {
  const exchangedDoc = buildExchangedDocument(
    "tan",
    "CRPRQOT",
    clientName,
    clientName,
  )
  const body = `    <tan:OpvragenTanVolgnummerRequest>
        ${exchangedDoc}
    </tan:OpvragenTanVolgnummerRequest>`
  return buildSoapEnvelope(body, abaCredentials)
}

export function buildFormaliserenRequest(
  ticketId: string,
  sequenceNumber: number,
  tanCode: string,
  clientName: string,
  abaCredentials?: any,
): string {
  const exchangedDoc = buildExchangedDocument(
    "frm",
    "CRPRQFB",
    clientName,
    clientName,
  )
  const body = `    <frm:FormaliserenOpgaveRequest>
        ${exchangedDoc}
        <frm:TicketId>${ticketId}</frm:TicketId>
        <frm:SequenceNumber>${sequenceNumber}</frm:SequenceNumber>
        <frm:AuthorisationNumber>${tanCode}</frm:AuthorisationNumber>
    </frm:FormaliserenOpgaveRequest>`
  return buildSoapEnvelope(body, abaCredentials)
}

export function buildAnnulerenRequest(
  ticketId: string,
  clientName: string,
  abaCredentials?: any,
  farmId?: string,
): string {
  const exchangedDoc = buildExchangedDocument(
    "ann",
    "CRPRQAN",
    clientName,
    clientName,
  )
  const farmXml = farmId
    ? `<ann:ThirdPartyFarmID schemeAgencyName="KVK">${farmId}</ann:ThirdPartyFarmID>`
    : ""
  const body = `    <ann:AnnulerenOpgaveRequest>
        ${exchangedDoc}
        ${farmXml}
        <ann:TicketId>${ticketId}</ann:TicketId>
    </ann:AnnulerenOpgaveRequest>`
  return buildSoapEnvelope(body, abaCredentials)
}
