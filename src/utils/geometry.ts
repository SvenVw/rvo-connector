import proj4 from 'proj4';

// Define RD New (EPSG:28992) projection
proj4.defs(
  'EPSG:28992',
  '+proj=sterea +lat_0=52.15616055555555 +lon_0=5.38763888888889 +k=0.9999079 +x_0=155000 +y_0=463000 +ellps=bessel +towgs84=565.2369,50.0087,465.658,-0.406857,0.350733,-1.87035,4.0812 +units=m +no_defs'
);

// Define WGS84 (EPSG:4326) explicitly if needed, though typically built-in.
proj4.defs('EPSG:4326', '+proj=longlat +datum=WGS84 +no_defs');

/**
 * Parses a space-separated GML posList string into an array of coordinates.
 * e.g. "172000.57 442374.81 172046.80 442283.55" -> [[172000.57, 442374.81], [172046.80, 442283.55]]
 */
export function parsePosList(posList: string): number[][] {
  if (!posList || typeof posList !== 'string') return [];

  const coords = posList.trim().split(/\s+/).map(Number);
  const points: number[][] = [];

  for (let i = 0; i < coords.length; i += 2) {
    if (i + 1 < coords.length) {
      points.push([coords[i], coords[i + 1]]);
    }
  }

  return points;
}

/**
 * Transforms an array of coordinates from RD New (EPSG:28992) to WGS84 (EPSG:4326).
 */
export function transformCoordinates(
  coordinates: number[][],
): number[][] {
  return coordinates.map((point) => {
    return proj4('EPSG:28992', 'EPSG:4326', point);
  });
}
