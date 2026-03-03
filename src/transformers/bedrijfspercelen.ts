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
 * @param options Transformation options (e.g. enrichResponse).
 */
export function transformBedrijfspercelenToGeoJSON(
  response: any,
  options: { enrichResponse?: boolean } = {},
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

/**
 * Extracts and simplifies properties from a CropField object.
 * Removes geometry keys and flattens xml2js text nodes.
 *
 * @param cropField The parsed XML object for a single CropField.
 * @param options Transformation options.
 * @returns A flattened record of property keys and values.
 */
function extractProperties(
  cropField: any,
  options: { enrichResponse?: boolean },
): Record<string, any> {
  const properties: Record<string, any> = {}
  const descriptiveValues: Record<string, any> = {}

  for (const key of Object.keys(cropField)) {
    // Skip geometry related keys at the root level
    if (key === "Border" || key === "Geometry") continue

    const value = cropField[key]

    if (key === "QualityIndicatorType") {
      // Handle recursive conversion for QualityIndicatorType
      properties[key] = processQualityIndicators(value)

      // If enrich is enabled, map indicators in the array
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

          if (qi.QualityIndicatorCause) {
            const label = getLabel("Cause", qi.QualityIndicatorCause)
            if (label) values.QualityIndicatorCause = label
          }

          return { ...qi, descriptiveValues: values }
        })
      }
    } else if (value && typeof value === "object" && "_" in value) {
      // Simplify value if it's an object with "_" (text content) and attributes
      properties[key] = value._
    } else {
      properties[key] = value
    }

    // Apply enrichment if requested
    if (options.enrichResponse) {
      // Convert indicators to boolean
      const boolValue = mapIndicator(properties[key])
      if (boolValue !== null) {
        descriptiveValues[key] = boolValue
      }

      // Code lookups
      if (key === "UseTitleCode") {
        const label = getLabel("UseTitleCode", properties[key])
        if (label) descriptiveValues[key] = label
      } else if (key === "CropFieldCause") {
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
