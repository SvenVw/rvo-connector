import xml2js from "xml2js"

/**
 * Details of a SOAP fault returned by an RVO webservice.
 */
export interface RvoSoapFault {
  /** The SOAP `faultcode` (e.g. `Server`, prefix stripped). */
  faultCode?: string
  /** The SOAP `faultstring`, a human-readable description of the fault. */
  faultString?: string
  /** The EDI-Crop error code from `EdiCropExceptionFault` (e.g. `EDI009`). */
  ediCode?: string
  /** The EDI-Crop error description from `EdiCropExceptionFault`. */
  ediDescription?: string
}

/**
 * Context of the request that resulted in a SOAP fault.
 * Used to give a more specific explanation of the fault.
 */
export interface RvoSoapFaultContext {
  /** Whether a `ThirdPartyFarmID` (the `farmId` option) was sent with the request. */
  farmIdSent?: boolean
}

/**
 * Error thrown when an RVO webservice responds with a SOAP fault.
 *
 * Inspect `ediCode` to handle specific RVO errors, e.g. `EDI009` (access denied).
 *
 * @example
 * ```ts
 * try {
 *   await client.opvragenBedrijfspercelen()
 * } catch (error) {
 *   if (error instanceof RvoSoapFaultError && error.ediCode === "EDI009") {
 *     // Handle missing authorisation
 *   }
 * }
 * ```
 */
export class RvoSoapFaultError extends Error {
  /** HTTP status code of the response. */
  readonly httpStatus: number
  /** The SOAP `faultcode` (prefix stripped). */
  readonly faultCode?: string
  /** The SOAP `faultstring`. */
  readonly faultString?: string
  /** The EDI-Crop error code (e.g. `EDI009`). */
  readonly ediCode?: string
  /** The EDI-Crop error description. */
  readonly ediDescription?: string
  /**
   * The raw SOAP response body.
   * Note: may contain personal or farm data; do not log it without consideration.
   */
  readonly rawResponse: string

  /**
   * Creates a new RvoSoapFaultError.
   *
   * @param fault The parsed SOAP fault.
   * @param httpStatus HTTP status code of the response.
   * @param rawResponse The raw SOAP response body.
   * @param context Context of the request, used to explain the fault.
   */
  constructor(
    fault: RvoSoapFault,
    httpStatus: number,
    rawResponse: string,
    context: RvoSoapFaultContext = {},
  ) {
    super(buildFaultMessage(fault, context))
    this.name = "RvoSoapFaultError"
    this.httpStatus = httpStatus
    this.faultCode = fault.faultCode
    this.faultString = fault.faultString
    this.ediCode = fault.ediCode
    this.ediDescription = fault.ediDescription
    this.rawResponse = rawResponse
  }
}

/** Returns the text content of an xml2js node, or undefined if absent. */
function textOf(node: unknown): string | undefined {
  if (typeof node === "string") return node.trim() || undefined
  if (node && typeof node === "object" && "_" in node) {
    return textOf((node as { _: unknown })._)
  }
  return undefined
}

/** Safely reads a property from an unknown xml2js node. */
function child(node: unknown, key: string): unknown {
  return node && typeof node === "object" ? (node as Record<string, unknown>)[key] : undefined
}

/**
 * Extracts the SOAP fault from an RVO response, if present.
 *
 * @param responseText The raw SOAP response body.
 * @returns The parsed fault, or `undefined` if the response contains no (parseable) SOAP fault.
 * @internal
 */
export async function parseSoapFault(responseText: string): Promise<RvoSoapFault | undefined> {
  if (!responseText.includes("Fault")) return undefined

  let parsed: unknown
  try {
    const parser = new xml2js.Parser({
      explicitArray: false,
      tagNameProcessors: [xml2js.processors.stripPrefix],
    })
    parsed = await parser.parseStringPromise(responseText)
  } catch {
    return undefined
  }

  const fault = child(child(child(parsed, "Envelope"), "Body"), "Fault")
  if (!fault) return undefined

  const ediFault = child(child(fault, "detail"), "EdiCropExceptionFault")

  return {
    faultCode: textOf(child(fault, "faultcode"))?.replace(/^[\w-]+:/, ""),
    faultString: textOf(child(fault, "faultstring")),
    ediCode: textOf(child(ediFault, "code")),
    ediDescription: textOf(child(ediFault, "description")),
  }
}

/** Builds a readable error message for a SOAP fault, with hints for known EDI codes. */
function buildFaultMessage(fault: RvoSoapFault, context: RvoSoapFaultContext): string {
  const description = fault.ediDescription ?? fault.faultString ?? "Unknown SOAP fault"

  if (fault.ediCode === "EDI009") {
    const causes = context.farmIdSent
      ? [
          "`farmId` was provided while the authenticated account requests its own farm. " +
            "Farmers should omit `farmId`; it is only used for requesting data of another farm.",
          "`farmId` was provided for another farm, but the authenticated account has no " +
            "(valid) machtiging at RVO for this farm and service.",
        ]
      : [
          "The authenticated account is not authorised at RVO for this service " +
            "(e.g. no valid machtiging, or the service scope was not requested via `getAuthorizationUrl`).",
        ]

    return [
      `RVO denied access (EDI009): "${description}"`,
      "Possible causes:",
      ...causes.map((cause) => `  - ${cause}`),
    ].join("\n")
  }

  return fault.ediCode
    ? `RVO returned a SOAP fault (${fault.ediCode}): "${description}"`
    : `RVO returned a SOAP fault: "${description}"`
}
