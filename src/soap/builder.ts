import { randomUUID } from "node:crypto"

/**
 * Escapes special characters in a string for use in XML.
 * Prevents XML injection by encoding <, >, &, ', and ".
 *
 * @param unsafe The raw string to escape.
 * @returns An XML-safe encoded string.
 */
export function escapeXml(unsafe: string): string {
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
export function normalizeDateTime(dateTime?: string): string | undefined {
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
export function buildSoapEnvelope(
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

  const messageId = randomUUID()
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
 * Shared helper to build the request body for Regelingspercelen (Mest or GLB).
 */
function buildRegelingspercelenRequest(
  params: RegelingspercelenGLBRequestParams,
  options: {
    serviceNamespace: string
    requestName: string
    messageType: string
  },
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
    ...options,
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
  return buildRegelingspercelenRequest(params, {
    serviceNamespace: "http://www.minez.nl/ws/edicrop/1.0/OpvragenRegelingspercelenMEST",
    requestName: "OpvragenRegelingspercelenMESTRequest",
    messageType: "CRPRQRM",
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
  return buildRegelingspercelenRequest(params, {
    serviceNamespace: "http://www.minez.nl/ws/edicrop/1.0/OpvragenRegelingspercelenGLB",
    requestName: "OpvragenRegelingspercelenGLBRequest",
    messageType: "CRPRQRG",
  })
}

/**
 * Parameters required to build the SOAP request for BMS (I&R) webservices.
 */
export interface BmsSoapRequestParams {
  abaCredentials?: {
    username: string
    password?: string
  }
}

/**
 * Helper to construct the SOAP envelope for BMS webservices.
 */
function buildBmsEnvelope(params: BmsSoapRequestParams, bodyXml: string): string {
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
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:dier="http://www.ienr.org/schemas/types/dieren_v3_0">
${headerXml}
  <soapenv:Body>
${bodyXml}
  </soapenv:Body>
</soapenv:Envelope>`
}

/**
 * Parameters required to build the SOAP request for RaadplegenDieren.
 */
export interface RaadplegenDierenRequestParams extends BmsSoapRequestParams {
  selDierSoort?: string
  selDierLandcode?: string
  selDierLevensnummer?: string
  selRelatienummerHouder: string
  selMeldingeenheid: string
  selDierOorspronkelijkeID?: string
  selPeilDatum?: string
  selPeilDatumHoog?: string
  selDierWerknummer?: string
  selDierWerknummerHoog?: string
  selMoederLandcode?: string
  selMoederLevensnummer?: string
  selGeboorteDatumLaag?: string
  selGeboorteDatumHoog?: string
  selDierGeslacht?: string
  selVlagsoortCodeReden?: string
  indDierMetVlagOverslaan?: string
  indExportwaardigheid?: string
  selCodeExportwaardigheid?: string
  aantal?: number
}

/**
 * Constructs the SOAP XML string for the RaadplegenDieren request.
 */
export function buildRaadplegenDierenRequest(params: RaadplegenDierenRequestParams): string {
  const messageId = randomUUID().substring(0, 20) // requestID is CHAR 20

  let bodyXml = `    <dier:raadplegenDieren>
      <dier:requestID>${escapeXml(messageId)}</dier:requestID>`

  if (params.selDierSoort) {
    bodyXml += `\n      <dier:selDierSoort>${escapeXml(params.selDierSoort)}</dier:selDierSoort>`
  }
  if (params.selDierLandcode) {
    bodyXml += `\n      <dier:selDierLandcode>${escapeXml(params.selDierLandcode)}</dier:selDierLandcode>`
  }
  if (params.selDierLevensnummer) {
    bodyXml += `\n      <dier:selDierLevensnummer>${escapeXml(params.selDierLevensnummer)}</dier:selDierLevensnummer>`
  }

  bodyXml += `\n      <dier:selRelatienummerHouder>${escapeXml(params.selRelatienummerHouder)}</dier:selRelatienummerHouder>`
  bodyXml += `\n      <dier:selMeldingeenheid>${escapeXml(params.selMeldingeenheid)}</dier:selMeldingeenheid>`

  if (params.selDierOorspronkelijkeID) {
    bodyXml += `\n      <dier:selDierOorspronkelijkeID>${escapeXml(params.selDierOorspronkelijkeID)}</dier:selDierOorspronkelijkeID>`
  }
  if (params.selPeilDatum) {
    bodyXml += `\n      <dier:selPeilDatum>${escapeXml(params.selPeilDatum)}</dier:selPeilDatum>`
  }
  if (params.selPeilDatumHoog) {
    bodyXml += `\n      <dier:selPeilDatumHoog>${escapeXml(params.selPeilDatumHoog)}</dier:selPeilDatumHoog>`
  }
  if (params.selDierWerknummer) {
    bodyXml += `\n      <dier:selDierWerknummer>${escapeXml(params.selDierWerknummer)}</dier:selDierWerknummer>`
  }
  if (params.selDierWerknummerHoog) {
    bodyXml += `\n      <dier:selDierWerknummerHoog>${escapeXml(params.selDierWerknummerHoog)}</dier:selDierWerknummerHoog>`
  }
  if (params.selMoederLandcode) {
    bodyXml += `\n      <dier:selMoederLandcode>${escapeXml(params.selMoederLandcode)}</dier:selMoederLandcode>`
  }
  if (params.selMoederLevensnummer) {
    bodyXml += `\n      <dier:selMoederLevensnummer>${escapeXml(params.selMoederLevensnummer)}</dier:selMoederLevensnummer>`
  }
  if (params.selGeboorteDatumLaag) {
    bodyXml += `\n      <dier:selGeboorteDatumLaag>${escapeXml(params.selGeboorteDatumLaag)}</dier:selGeboorteDatumLaag>`
  }
  if (params.selGeboorteDatumHoog) {
    bodyXml += `\n      <dier:selGeboorteDatumHoog>${escapeXml(params.selGeboorteDatumHoog)}</dier:selGeboorteDatumHoog>`
  }
  if (params.selDierGeslacht) {
    bodyXml += `\n      <dier:selDierGeslacht>${escapeXml(params.selDierGeslacht)}</dier:selDierGeslacht>`
  }
  if (params.selVlagsoortCodeReden) {
    bodyXml += `\n      <dier:selVlagsoortCodeReden>${escapeXml(params.selVlagsoortCodeReden)}</dier:selVlagsoortCodeReden>`
  }
  if (params.indDierMetVlagOverslaan) {
    bodyXml += `\n      <dier:indDierMetVlagOverslaan>${escapeXml(params.indDierMetVlagOverslaan)}</dier:indDierMetVlagOverslaan>`
  }
  if (params.indExportwaardigheid) {
    bodyXml += `\n      <dier:indExportwaardigheid>${escapeXml(params.indExportwaardigheid)}</dier:indExportwaardigheid>`
  }
  if (params.selCodeExportwaardigheid) {
    bodyXml += `\n      <dier:selCodeExportwaardigheid>${escapeXml(params.selCodeExportwaardigheid)}</dier:selCodeExportwaardigheid>`
  }
  if (params.aantal !== undefined) {
    bodyXml += `\n      <dier:aantal>${params.aantal}</dier:aantal>`
  }

  bodyXml += `\n    </dier:raadplegenDieren>`

  return buildBmsEnvelope(params, bodyXml)
}

/**
 * Parameters required to build the SOAP request for RaadplegenDierDetails.
 */
export interface RaadplegenDierDetailsRequestParams extends BmsSoapRequestParams {
  selRelatienummerHouder?: string
  selMeldingeenheid?: string
  selDierLandcode?: string
  selDierLevensnummer?: string
  selDierWerknummer?: string
  selDierSoort?: string
  selNummerGezondheidscertificaat?: string
  indVerblijfplaatsen?: string
  indBuitenlandseVerblijven?: string
  indVlaggen?: string
  indNakomelingen?: string
  indPaspoorten?: string
  indMerken?: string
  indRegistratiesEnInstanties?: string
  indAndereDatabases?: string
  indExportwaardigheid?: string
  selCodeExportwaardigheid?: string
  aantal?: number
}

/**
 * Constructs the SOAP XML string for the RaadplegenDierDetails request.
 */
export function buildRaadplegenDierDetailsRequest(
  params: RaadplegenDierDetailsRequestParams,
): string {
  const messageId = randomUUID().substring(0, 20)

  let bodyXml = `    <dier:raadplegenDierDetails>
      <dier:requestID>${escapeXml(messageId)}</dier:requestID>`

  if (params.selRelatienummerHouder) {
    bodyXml += `\n      <dier:selRelatienummerHouder>${escapeXml(params.selRelatienummerHouder)}</dier:selRelatienummerHouder>`
  }
  if (params.selMeldingeenheid) {
    bodyXml += `\n      <dier:selMeldingeenheid>${escapeXml(params.selMeldingeenheid)}</dier:selMeldingeenheid>`
  }
  if (params.selDierLandcode) {
    bodyXml += `\n      <dier:selDierLandcode>${escapeXml(params.selDierLandcode)}</dier:selDierLandcode>`
  }
  if (params.selDierLevensnummer) {
    bodyXml += `\n      <dier:selDierLevensnummer>${escapeXml(params.selDierLevensnummer)}</dier:selDierLevensnummer>`
  }
  if (params.selDierWerknummer) {
    bodyXml += `\n      <dier:selDierWerknummer>${escapeXml(params.selDierWerknummer)}</dier:selDierWerknummer>`
  }
  if (params.selDierSoort) {
    bodyXml += `\n      <dier:selDierSoort>${escapeXml(params.selDierSoort)}</dier:selDierSoort>`
  }
  if (params.selNummerGezondheidscertificaat) {
    bodyXml += `\n      <dier:selNummerGezondheidscertificaat>${escapeXml(params.selNummerGezondheidscertificaat)}</dier:selNummerGezondheidscertificaat>`
  }
  if (params.indVerblijfplaatsen) {
    bodyXml += `\n      <dier:indVerblijfplaatsen>${escapeXml(params.indVerblijfplaatsen)}</dier:indVerblijfplaatsen>`
  }
  if (params.indBuitenlandseVerblijven) {
    bodyXml += `\n      <dier:indBuitenlandseVerblijven>${escapeXml(params.indBuitenlandseVerblijven)}</dier:indBuitenlandseVerblijven>`
  }
  if (params.indVlaggen) {
    bodyXml += `\n      <dier:indVlaggen>${escapeXml(params.indVlaggen)}</dier:indVlaggen>`
  }
  if (params.indNakomelingen) {
    bodyXml += `\n      <dier:indNakomelingen>${escapeXml(params.indNakomelingen)}</dier:indNakomelingen>`
  }
  if (params.indPaspoorten) {
    bodyXml += `\n      <dier:indPaspoorten>${escapeXml(params.indPaspoorten)}</dier:indPaspoorten>`
  }
  if (params.indMerken) {
    bodyXml += `\n      <dier:indMerken>${escapeXml(params.indMerken)}</dier:indMerken>`
  }
  if (params.indRegistratiesEnInstanties) {
    bodyXml += `\n      <dier:indRegistratiesEnInstanties>${escapeXml(params.indRegistratiesEnInstanties)}</dier:indRegistratiesEnInstanties>`
  }
  if (params.indAndereDatabases) {
    bodyXml += `\n      <dier:indAndereDatabases>${escapeXml(params.indAndereDatabases)}</dier:indAndereDatabases>`
  }
  if (params.indExportwaardigheid) {
    bodyXml += `\n      <dier:indExportwaardigheid>${escapeXml(params.indExportwaardigheid)}</dier:indExportwaardigheid>`
  }
  if (params.selCodeExportwaardigheid) {
    bodyXml += `\n      <dier:selCodeExportwaardigheid>${escapeXml(params.selCodeExportwaardigheid)}</dier:selCodeExportwaardigheid>`
  }
  if (params.aantal !== undefined) {
    bodyXml += `\n      <dier:aantal>${params.aantal}</dier:aantal>`
  }

  bodyXml += `\n    </dier:raadplegenDierDetails>`

  return buildBmsEnvelope(params, bodyXml)
}
