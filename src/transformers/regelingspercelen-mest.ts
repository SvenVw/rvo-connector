import type { Feature, FeatureCollection } from "geojson"
import { convertGmlToGeoJson, processQualityIndicators, findSoapBodyContent } from "../utils/geometry"

/**
 * Transforms the raw RVO XML response object into a GeoJSON FeatureCollection.
 *
 * @param response The parsed XML response object from the SOAP body.
 */
export function transformRegelingspercelenMestToGeoJSON(response: any): FeatureCollection {
  const features: Feature[] = []

  // Navigate the deep object structure: Envelope -> Body -> OpvragenRegelingspercelenMESTResponse
  const root = findSoapBodyContent(response, "OpvragenRegelingspercelenMESTResponse")

  const farmsRaw = root["Farm"]
  if (!farmsRaw) {
    return { type: "FeatureCollection", features: [] }
  }

  // Ensure farms is an array
  const farms = Array.isArray(farmsRaw) ? farmsRaw : [farmsRaw]

  for (const farm of farms) {
    if (!farm) continue

    // In FarmMEST, fields are in the 'Field' element
    const fieldsRaw = farm["Field"]
    if (!fieldsRaw) continue

    const fields = Array.isArray(fieldsRaw) ? fieldsRaw : [fieldsRaw]

    for (const mestField of fields) {
      if (!mestField) continue

      // Extract Geometry
      const geometry = convertGmlToGeoJson(mestField["Border"])

      // Extract Properties (everything except Border/Geometry)
      const properties = extractProperties(mestField)

      if (geometry) {
        features.push({
          type: "Feature",
          geometry,
          properties,
        })
      }
    }
  }

  return {
    type: "FeatureCollection",
    features,
  }
}

/**
 * Extracts and simplifies properties from a MESTField object.
 */
function extractProperties(mestField: any): Record<string, any> {
  const properties: Record<string, any> = {}

  for (const key of Object.keys(mestField)) {
    // Skip geometry related keys at the root level
    if (key === "Border" || key === "Geometry") continue

    const value = mestField[key]

    if (key === "QualityIndicatorType") {
      // Handle recursive conversion for QualityIndicatorType
      properties[key] = processQualityIndicators(value)
    } else if (key === "Voorteelt" || key === "Nateelt") {
      // Handle array of nested objects
      properties[key] = Array.isArray(value) ? value.map(simplifyObject) : simplifyObject(value)
    } else if (value && typeof value === "object" && "_" in value) {
      // Simplify value if it's an object with "_" (text content) and attributes
      properties[key] = value._
    } else {
      properties[key] = value
    }
  }

  return properties
}

function simplifyObject(obj: any): any {
  if (!obj) return obj
  if (typeof obj !== "object") return obj

  const newObj: Record<string, any> = {}
  for (const key of Object.keys(obj)) {
    const val = obj[key]
    if (val && typeof val === "object" && "_" in val) {
      newObj[key] = val._
    } else {
      newObj[key] = val
    }
  }
  return newObj
}
