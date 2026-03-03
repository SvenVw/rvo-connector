import type { Feature, FeatureCollection } from "geojson"
import {
  convertGmlToGeoJson,
  processQualityIndicators,
  findSoapBodyContent,
} from "../utils/geometry"
import { getLabel, mapIndicator } from "../utils/codelists"

/**
 * Transforms the raw RVO XML response object into a GeoJSON FeatureCollection.
 *
 * @param response The parsed XML response object from the SOAP body.
 * @param options Transformation options.
 */
export function transformRegelingspercelenMestToGeoJSON(
  response: any,
  options: { enrichResponse?: boolean } = {},
): FeatureCollection {
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
      const properties = extractProperties(mestField, options)

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
function extractProperties(
  mestField: any,
  options: { enrichResponse?: boolean },
): Record<string, any> {
  const properties: Record<string, any> = {}
  const descriptiveValues: Record<string, any> = {}

  for (const key of Object.keys(mestField)) {
    // Skip geometry related keys at the root level
    if (key === "Border" || key === "Geometry") continue

    const value = mestField[key]

    if (key === "QualityIndicatorType") {
      properties[key] = processQualityIndicators(value)

      if (options.enrichResponse && Array.isArray(properties[key])) {
        properties[key] = properties[key].map((qi: any) => {
          const values: Record<string, any> = {}

          if (qi.IndicatorCode) {
            const label = getLabel("IndicatorCode", qi.IndicatorCode)
            if (label) values.IndicatorCode = label
          }

          if (qi.SeverityCode) {
            const label = getLabel("SeverityCode", qi.SeverityCode)
            if (label) values.SeverityCode = label
          }

          if (qi.MESTFieldQICause) {
            const label = getLabel("Cause", qi.MESTFieldQICause)
            if (label) values.MESTFieldQICause = label
          }

          return { ...qi, descriptiveValues: values }
        })
      }
    } else if (key === "Voorteelt" || key === "Nateelt") {
      // Handle array of nested objects
      properties[key] = Array.isArray(value)
        ? value.map((v) => simplifyObject(v, options))
        : simplifyObject(value, options)
    } else if (value && typeof value === "object" && "_" in value) {
      properties[key] = value._
    } else {
      properties[key] = value
    }

    // Apply enrichment if requested
    if (options.enrichResponse) {
      // Boolean mapping for J/N indicators
      const boolValue = mapIndicator(properties[key])
      if (boolValue !== null) {
        descriptiveValues[key] = boolValue
      }

      // Code lookups
      if (key === "Grondsoort") {
        const label = getLabel("Grondsoort", properties[key])
        if (label) descriptiveValues[key] = label
      } else if (key === "TypeGrond") {
        const label = getLabel("TypeGrond", properties[key])
        if (label) descriptiveValues[key] = label
      } else if (key === "BemonsteringProtocol") {
        const label = getLabel("BemonsteringProtocol", properties[key])
        if (label) descriptiveValues[key] = label
      } else if (key === "IndNateeltMest") {
        const label = getLabel("IndNateeltMest", properties[key])
        if (label) descriptiveValues[key] = label
      } else if (key === "GebruiksTitel") {
        const label = getLabel("UseTitleCode", properties[key])
        if (label) descriptiveValues[key] = label
      } else if (key === "MESTFieldCause") {
        const label = getLabel("Cause", properties[key])
        if (label) descriptiveValues[key] = label
      }
    }
  }

  if (options.enrichResponse && Object.keys(descriptiveValues).length > 0) {
    properties.descriptiveValues = descriptiveValues
  }

  return properties
}

function simplifyObject(obj: any, options: { enrichResponse?: boolean } = {}): any {
  if (!obj) return obj
  if (typeof obj !== "object") return obj

  const newObj: Record<string, any> = {}
  const descriptiveValues: Record<string, any> = {}

  for (const key of Object.keys(obj)) {
    const val = obj[key]
    if (val && typeof val === "object" && "_" in val) {
      newObj[key] = val._
    } else {
      newObj[key] = val
    }

    if (options.enrichResponse) {
      if (
        key === "Inzaaidatum" &&
        (newObj[key] === "1" ||
          newObj[key] === "2" ||
          newObj[key] === "3" ||
          newObj[key] === "4" ||
          newObj[key] === "5")
      ) {
        const label = getLabel("InzaaidatumCode", newObj[key])
        if (label) descriptiveValues[key] = label
      }
    }
  }

  if (options.enrichResponse && Object.keys(descriptiveValues).length > 0) {
    newObj.descriptiveValues = descriptiveValues
  }

  return newObj
}
