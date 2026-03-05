import proj4 from "proj4"
import type { Polygon, MultiPolygon } from "geojson"

// Define RD New (EPSG:28992) projection
proj4.defs(
  "EPSG:28992",
  "+proj=sterea +lat_0=52.15616055555555 +lon_0=5.38763888888889 +k=0.9999079 +x_0=155000 +y_0=463000 +ellps=bessel +towgs84=565.2369,50.0087,465.658,-0.406857,0.350733,-1.87035,4.0812 +units=m +no_defs",
)

// Define WGS84 (EPSG:4326) explicitly if needed, though typically built-in.
proj4.defs("EPSG:4326", "+proj=longlat +datum=WGS84 +no_defs")

/**
 * Parses a space-separated GML posList string into an array of coordinates.
 * e.g. "172000.57 442374.81 172046.80 442283.55" -> [[172000.57, 442374.81], [172046.80, 442283.55]]
 */
export function parsePosList(posList: string): number[][] {
  if (!posList || typeof posList !== "string") return []

  const coords = posList.trim().split(/\s+/).map(Number)
  const points: number[][] = []

  for (let i = 0; i < coords.length; i += 2) {
    if (i + 1 < coords.length) {
      points.push([coords[i], coords[i + 1]])
    }
  }

  return points
}

/**
 * Transforms an array of coordinates from RD New (EPSG:28992) to WGS84 (EPSG:4326).
 */
export function transformCoordinates(coordinates: number[][]): number[][] {
  return coordinates.map((point) => {
    return proj4("EPSG:28992", "EPSG:4326", point)
  })
}

/**
 * Extracts coordinates from a GML LinearRing container.
 * Handles both direct string values and xml2js object structures with text content in "_".
 *
 * @param container The XML object containing the LinearRing.
 * @returns An array of number pairs representing RD New coordinates.
 */
export function getLinearRingCoordinates(container: any): number[][] {
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

/**
 * Converts a GML Polygon structure (containing exterior/interior rings) to a GeoJSON Polygon.
 *
 * Accepts an object that has 'exterior' and optional 'interior' properties.
 */
export function convertGmlToGeoJson(gmlPolygon: any): Polygon | MultiPolygon | null {
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

/**
 * Navigates the common SOAP Envelope/Body structure to find the specific response content.
 *
 * @param result The parsed XML object.
 * @param responseName The name of the expected response tag (e.g., 'OpvragenBedrijfspercelenResponse').
 * @returns The inner response object or the original result if not found.
 */
export function findSoapBodyContent(result: any, responseName: string): any {
  let root = result
  if (root["Envelope"]) root = root["Envelope"]
  if (root["Body"]) root = root["Body"]
  if (root[responseName]) root = root[responseName]
  return root
}

/**
 * Processes QualityIndicator types by transforming their internal GML geometries to GeoJSON.
 * Also simplifies text nodes.
 *
 * @param indicators A single indicator object or an array of indicators.
 * @returns The processed indicator(s) with standard 'geometry' property.
 */
export function processQualityIndicators(indicators: any): any {
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
    if (newIndicator["Geometry"]?.["Polygon"]) {
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
