import proj4 from "proj4"

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
 * Transforms an array of coordinates from WGS84 (EPSG:4326) to RD New (EPSG:28992).
 */
export function transformCoordinatesToRD(coordinates: number[][]): number[][] {
  return coordinates.map((point) => {
    return proj4("EPSG:4326", "EPSG:28992", point)
  })
}

/**
 * Converts a GeoJSON Geometry (Polygon or MultiPolygon) to a GML string.
 * Coordinates are automatically transformed from WGS84 to RD New.
 *
 * Note: RVO typically expects RD coordinates.
 */
export function convertGeoJSONToGML(geometry: any): string {
  if (!geometry) return ""

  // Helper to format a ring (array of points) into GML posList
  const ringToPosList = (ring: number[][]) => {
    const rdRing = transformCoordinatesToRD(ring)
    // GML posList format: "X1 Y1 X2 Y2 ..."
    // RVO requires 0.1mm precision (4 decimals)
    return rdRing
      .map((pt) => `${pt[0].toFixed(4)} ${pt[1].toFixed(4)}`)
      .join(" ")
  }

  const buildPolygonGML = (rings: number[][][]) => {
    // Example shows no srsName on Polygon itself, but on posList
    let gml = "<gml:Polygon>"

    // Exterior ring
    if (rings.length > 0) {
      gml += '<gml:exterior><gml:LinearRing><gml:posList srsName="EPSG:28992">'
      gml += ringToPosList(rings[0])
      gml += "</gml:posList></gml:LinearRing></gml:exterior>"
    }

    // Interior rings (holes)
    for (let i = 1; i < rings.length; i++) {
      gml += '<gml:interior><gml:LinearRing><gml:posList srsName="EPSG:28992">'
      gml += ringToPosList(rings[i])
      gml += "</gml:posList></gml:LinearRing></gml:interior>"
    }

    gml += "</gml:Polygon>"
    return gml
  }

  if (geometry.type === "Polygon") {
    return buildPolygonGML(geometry.coordinates)
  } else if (geometry.type === "MultiPolygon") {
    // RVO example showed single Polygons inside Field.
    // MultiPolygon might need MultiSurface or multiple Field entries.
    // For now, let's keep buildPolygonGML and wrap if MultiPolygon.
    let gml = "<gml:MultiSurface>"
    for (const polyCoords of geometry.coordinates) {
      gml += "<gml:surfaceMember>"
      gml += buildPolygonGML(polyCoords)
      gml += "</gml:surfaceMember>"
    }
    gml += "</gml:MultiSurface>"
    return gml
  }

  throw new Error(
    `Unsupported geometry type for GML conversion: ${geometry.type}`,
  )
}
