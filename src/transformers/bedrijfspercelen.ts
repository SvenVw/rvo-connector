import type { Feature, FeatureCollection, Polygon, MultiPolygon } from "geojson"
import { parsePosList, transformCoordinates } from "../utils/geometry"

/**
 * Transforms the raw RVO XML response object into a GeoJSON FeatureCollection.
 *
 * @param response The parsed XML response object from the SOAP body.
 */
export function transformBedrijfspercelenToGeoJSON(
  response: any,
): FeatureCollection {
  const features: Feature[] = []

  // Navigate the deep object structure to find CropFields
  // Note: xml2js might return arrays or single objects depending on parsing options.
  // Typically: Envelope -> Body -> OpvragenBedrijfspercelenResponse -> Farm -> Field -> CropField

  let root = response

  // Traverse down: Envelope -> Body -> OpvragenBedrijfspercelenResponse
  if (root["Envelope"]) root = root["Envelope"]
  if (root["Body"]) root = root["Body"]
  if (root["OpvragenBedrijfspercelenResponse"])
    root = root["OpvragenBedrijfspercelenResponse"]

  // Handle ExchangedDocument if wrapper exists (sometimes it's directly Farm)
  // But usually it's Farm sibling to ExchangedDocument

  const farm = root["Farm"]
  if (!farm) {
    // Return empty collection if no Farm data found
    return { type: "FeatureCollection", features: [] }
  }

  const fieldsRaw = farm["Field"]

  if (!fieldsRaw) {
    return { type: "FeatureCollection", features: [] }
  }

  // Ensure fields is an array
  const fields = Array.isArray(fieldsRaw) ? fieldsRaw : [fieldsRaw]

  for (const fieldContainer of fields) {
    // Inside Field container, find CropField
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
 * Converts a GML Polygon structure (containing exterior/interior rings) to a GeoJSON Polygon.
 *
 * Accepts an object that has 'exterior' and optional 'interior' properties.
 * e.g. CropField.Border or QualityIndicatorType.Geometry.Polygon
 */
function convertGmlToGeoJson(gmlPolygon: any): Polygon | MultiPolygon | null {
  if (!gmlPolygon) return null

  // Handle exterior
  const exterior = gmlPolygon["exterior"]
  let exteriorRing: number[][] = []

  if (exterior) {
    exteriorRing = getLinearRingCoordinates(exterior)
  }

  if (exteriorRing.length === 0) return null

  // Handle interior (holes)
  const interiorRaw = gmlPolygon["interior"]
  const interiorRings: number[][][] = []

  if (interiorRaw) {
    const interiors = Array.isArray(interiorRaw) ? interiorRaw : [interiorRaw]

    for (const interior of interiors) {
      const ring = getLinearRingCoordinates(interior)
      if (ring.length > 0) {
        interiorRings.push(ring)
      }
    }
  }

  // Construct Polygon: [exterior, ...holes]
  return {
    type: "Polygon",
    coordinates: [exteriorRing, ...interiorRings],
  }
}

function getLinearRingCoordinates(container: any): number[][] {
  // container is usually exterior or interior
  // Should contain LinearRing -> posList
  const ring = container["LinearRing"]
  if (!ring) return []

  const posListObj = ring["posList"]

  if (!posListObj) return []

  // content is usually in "_" property if parsed with xml2js and attributes exist, or direct value if no attributes
  const posListStr = typeof posListObj === "object" ? posListObj._ : posListObj

  if (!posListStr) return []

  const coords = parsePosList(posListStr)
  return transformCoordinates(coords)
}

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

function processQualityIndicators(indicators: any): any {
  if (!indicators) return indicators

  const processSingle = (indicator: any) => {
    const newIndicator = { ...indicator } // Shallow copy to modify

    // Simplify generic text nodes in the indicator itself
    for (const key of Object.keys(newIndicator)) {
      const val = newIndicator[key]
      if (val && typeof val === "object" && "_" in val && key !== "Geometry") {
        newIndicator[key] = val._
      }
    }

    // Handle Geometry transformation
    if (newIndicator["Geometry"] && newIndicator["Geometry"]["Polygon"]) {
      const geoJson = convertGmlToGeoJson(newIndicator["Geometry"]["Polygon"])
      if (geoJson) {
        newIndicator["geometry"] = geoJson // Add standard GeoJSON geometry property
        delete newIndicator["Geometry"] // Remove the GML
      }
    }
    return newIndicator
  }

  if (Array.isArray(indicators)) {
    return indicators.map(processSingle)
  }
  return processSingle(indicators)
}
