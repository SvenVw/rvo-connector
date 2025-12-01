import type { Feature, FeatureCollection, Polygon, MultiPolygon } from 'geojson';
import { parsePosList, transformCoordinates } from '../utils/geometry';

/**
 * Transforms the raw RVO XML response object into a GeoJSON FeatureCollection.
 * 
 * @param response The parsed XML response object from the SOAP body.
 */
export function transformBedrijfspercelenToGeoJSON(
  response: any,
): FeatureCollection {
  const features: Feature[] = [];

  // Navigate the deep object structure to find CropFields
  // Note: xml2js might return arrays or single objects depending on parsing options.
  // Typically: Envelope -> Body -> OpvragenBedrijfspercelenResponse -> Farm -> Field -> CropField
  
  let root = response;
  
  // Traverse down: Envelope -> Body -> OpvragenBedrijfspercelenResponse
  if (root['Envelope']) root = root['Envelope'];
  if (root['Body']) root = root['Body'];
  if (root['OpvragenBedrijfspercelenResponse']) root = root['OpvragenBedrijfspercelenResponse'];

  // Handle ExchangedDocument if wrapper exists (sometimes it's directly Farm)
  // But usually it's Farm sibling to ExchangedDocument
  
  const farm = root['Farm'];
  if (!farm) {
    // Return empty collection if no Farm data found
    return { type: 'FeatureCollection', features: [] };
  }

  const fieldsRaw = farm['Field'];
  
  if (!fieldsRaw) {
    return { type: 'FeatureCollection', features: [] };
  }

  // Ensure fields is an array
  const fields = Array.isArray(fieldsRaw) ? fieldsRaw : [fieldsRaw];

  for (const fieldContainer of fields) {
    // Inside Field container, find CropField
    const cropField = fieldContainer['CropField'];
    if (!cropField) continue;
    
    // Extract Geometry
    const geometry = extractGeometry(cropField);
    
    // Extract Properties (everything except Border/Geometry)
    const properties = extractProperties(cropField);

    if (geometry) {
      features.push({
        type: 'Feature',
        geometry,
        properties
      });
    }
  }

  return {
    type: 'FeatureCollection',
    features
  };
}

function extractGeometry(cropField: any): Polygon | MultiPolygon | null {
  // Find 'Border'
  const border = cropField['Border'];
  if (!border) return null;
  
  // Handle exterior
  const exterior = border['exterior'];
  let exteriorRing: number[][] = [];
  
  if (exterior) {
    exteriorRing = getLinearRingCoordinates(exterior);
  }

  if (exteriorRing.length === 0) return null;

  // Handle interior (holes)
  const interiorRaw = border['interior'];
  const interiorRings: number[][][] = [];

  if (interiorRaw) {
    const interiors = Array.isArray(interiorRaw) ? interiorRaw : [interiorRaw];
    
    for (const interior of interiors) {
      const ring = getLinearRingCoordinates(interior);
      if (ring.length > 0) {
        interiorRings.push(ring);
      }
    }
  }

  // Construct Polygon: [exterior, ...holes]
  return {
    type: 'Polygon',
    coordinates: [exteriorRing, ...interiorRings]
  };
}

function getLinearRingCoordinates(container: any): number[][] {
  // container is usually exterior or interior
  // Should contain LinearRing -> posList
  const ring = container['LinearRing'];
  if (!ring) return [];

  const posListObj = ring['posList'];
  
  if (!posListObj) return [];

  // content is usually in "_" property if parsed with xml2js and attributes exist, or direct value if no attributes
  const posListStr = typeof posListObj === 'object' ? posListObj._ : posListObj;

  if (!posListStr) return [];

  const coords = parsePosList(posListStr);
  return transformCoordinates(coords);
}

function extractProperties(cropField: any): Record<string, any> {
  const properties: Record<string, any> = {};

  for (const key of Object.keys(cropField)) {
    // Skip geometry related keys
    if (key === 'Border' || key === 'Geometry') continue;

    const value = cropField[key];

    // Simplify value if it's an object with "_" (text content) and attributes
    if (value && typeof value === 'object' && '_' in value) {
        properties[key] = value._;
    } else {
        properties[key] = value;
    }
  }

  return properties;
}
