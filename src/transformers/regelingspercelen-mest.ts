import type { Feature, FeatureCollection } from "geojson"
import { convertGmlToGeoJson, findSoapBodyContent } from "../utils/geometry"
import { getLabel } from "../utils/codelists"
import {
  buildFieldProperties,
  flattenXml2jsValue,
  getDescriptiveValue,
  processQualityIndicatorType,
  type CodeLookupTable,
  type EnrichOptions,
} from "./shared"

/**
 * Transforms the raw RVO XML response object into a GeoJSON FeatureCollection.
 *
 * @param response The parsed XML response object from the SOAP body.
 * @param options Transformation options.
 */
export function transformRegelingspercelenMestToGeoJSON(
  response: any,
  options: EnrichOptions = {},
): FeatureCollection {
  const root = findSoapBodyContent(response, "OpvragenRegelingspercelenMESTResponse")

  const farmsRaw = root["Farm"]
  if (!farmsRaw) {
    return { type: "FeatureCollection", features: [] }
  }

  const farms = Array.isArray(farmsRaw) ? farmsRaw : [farmsRaw]
  const features: Feature[] = []

  for (const farm of farms) {
    if (!farm) continue
    const fieldsRaw = farm["Field"]
    if (!fieldsRaw) continue
    features.push(...processFarmFields(fieldsRaw, options))
  }

  return { type: "FeatureCollection", features }
}

function processFarmFields(fieldsRaw: any, options: EnrichOptions): Feature[] {
  const fields = Array.isArray(fieldsRaw) ? fieldsRaw : [fieldsRaw]
  const features: Feature[] = []

  for (const mestField of fields) {
    if (!mestField) continue
    const geometry = convertGmlToGeoJson(mestField["Border"])
    const properties = extractProperties(mestField, options)
    if (geometry) {
      features.push({ type: "Feature", geometry, properties })
    }
  }

  return features
}

const MEST_CODE_LOOKUPS: CodeLookupTable = {
  Grondsoort: ["Grondsoort"],
  TypeGrond: ["TypeGrond"],
  BemonsteringProtocol: ["BemonsteringProtocol"],
  IndNateeltMest: ["IndNateeltMest"],
  GebruiksTitel: ["UseTitleCode"],
  MESTFieldCause: ["Cause"],
  Grondbedekking: ["CropTypeCode", "onbekend gewas"],
}

/**
 * Extracts and simplifies properties from a MESTField object.
 */
function extractProperties(mestField: any, options: EnrichOptions): Record<string, any> {
  return buildFieldProperties(
    mestField,
    options,
    (key, value) => {
      if (key === "QualityIndicatorType") {
        return processQualityIndicatorType(value, options, "MESTFieldQICause")
      }
      if (key === "Voorteelt" || key === "Nateelt") {
        return Array.isArray(value)
          ? value.map((v) => simplifyObject(v, options))
          : simplifyObject(value, options)
      }
      return flattenXml2jsValue(value)
    },
    (key, value) => getDescriptiveValue(key, value, MEST_CODE_LOOKUPS),
  )
}

const VALID_INZAAIDATUM_CODES = new Set(["1", "2", "3", "4", "5"])

function getSimplifiedObjectDescriptiveValue(key: string, value: any): string | null {
  if (key === "Inzaaidatum" && VALID_INZAAIDATUM_CODES.has(value)) {
    return getLabel("InzaaidatumCode", value) ?? null
  }
  if (key === "Grondbedekking") {
    return getLabel("CropTypeCode", value, "onbekend gewas") ?? null
  }
  return null
}

function simplifyObject(obj: any, options: EnrichOptions = {}): any {
  if (!obj || typeof obj !== "object") return obj

  const newObj: Record<string, any> = {}
  const descriptiveValues: Record<string, any> = {}

  for (const key of Object.keys(obj)) {
    newObj[key] = flattenXml2jsValue(obj[key])

    if (options.enrichResponse) {
      const dv = getSimplifiedObjectDescriptiveValue(key, newObj[key])
      if (dv !== null) descriptiveValues[key] = dv
    }
  }

  if (options.enrichResponse && Object.keys(descriptiveValues).length > 0) {
    newObj.descriptiveValues = descriptiveValues
  }

  return newObj
}
