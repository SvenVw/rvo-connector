import type { Feature, FeatureCollection } from "geojson"
import { convertGmlToGeoJson, findSoapBodyContent } from "../utils/geometry"
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
 * @param options Transformation options (e.g. enrichResponse).
 */
export function transformBedrijfspercelenToGeoJSON(
  response: any,
  options: EnrichOptions = {},
): FeatureCollection {
  const features: Feature[] = []

  // Navigate the deep object structure to find CropFields
  const root = findSoapBodyContent(response, "OpvragenBedrijfspercelenResponse")

  const farm = root["Farm"]
  if (!farm) {
    return { type: "FeatureCollection", features: [] }
  }

  const fieldsRaw = farm["Field"]
  if (!fieldsRaw) {
    return { type: "FeatureCollection", features: [] }
  }

  const fields = Array.isArray(fieldsRaw) ? fieldsRaw : [fieldsRaw]

  for (const fieldContainer of fields) {
    const cropField = fieldContainer["CropField"]
    if (!cropField) continue

    // Extract Geometry
    const geometry = convertGmlToGeoJson(cropField["Border"])

    // Extract Properties (everything except Border/Geometry)
    const properties = extractProperties(cropField, options)

    if (geometry) {
      features.push({
        type: "Feature",
        geometry,
        properties,
      })
    }
  }

  return {
    type: "FeatureCollection",
    features,
  }
}

const BEDRIJFS_CODE_LOOKUPS: CodeLookupTable = {
  UseTitleCode: ["UseTitleCode"],
  CropFieldCause: ["Cause"],
  CropTypeCode: ["CropTypeCode", "onbekend gewas"],
}

/**
 * Extracts and simplifies properties from a CropField object.
 * Removes geometry keys and flattens xml2js text nodes.
 *
 * @param cropField The parsed XML object for a single CropField.
 * @param options Transformation options.
 * @returns A flattened record of property keys and values.
 */
function extractProperties(cropField: any, options: EnrichOptions): Record<string, any> {
  return buildFieldProperties(
    cropField,
    options,
    (key, value) => {
      if (key === "QualityIndicatorType") {
        return processQualityIndicatorType(value, options, "QualityIndicatorCause")
      }
      return flattenXml2jsValue(value)
    },
    (key, value) => getDescriptiveValue(key, value, BEDRIJFS_CODE_LOOKUPS),
  )
}
