import type { Feature, FeatureCollection } from "geojson"
import { convertGmlToGeoJson, processQualityIndicators, findSoapBodyContent } from "../utils/geometry"

/**
 * Transforms the raw RVO XML response object into a GeoJSON FeatureCollection.
 *
 * @param response The parsed XML response object from the SOAP body.
 */
export function transformBedrijfspercelenToGeoJSON(response: any): FeatureCollection {
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
    const properties = extractProperties(cropField)

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

/**
 * Extracts and simplifies properties from a CropField object.
 * Removes geometry keys and flattens xml2js text nodes.
 *
 * @param cropField The parsed XML object for a single CropField.
 * @returns A flattened record of property keys and values.
 */
function extractProperties(cropField: any): Record<string, any> {
  const properties: Record<string, any> = {}

  for (const key of Object.keys(cropField)) {
    // Skip geometry related keys at the root level
    if (key === "Border" || key === "Geometry") continue

    const value = cropField[key]

    if (key === "QualityIndicatorType") {
      // Handle recursive conversion for QualityIndicatorType
      properties[key] = processQualityIndicators(value)
    } else if (value && typeof value === "object" && "_" in value) {
      // Simplify value if it's an object with "_" (text content) and attributes
      properties[key] = value._
    } else {
      properties[key] = value
    }
  }

  return properties
}
