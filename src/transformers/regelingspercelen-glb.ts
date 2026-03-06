import type { Feature, Geometry } from "geojson"
import { convertGmlToGeoJson, findSoapBodyContent } from "../utils/geometry"
import { getLabel } from "../utils/codelists"
import {
  buildFieldProperties,
  flattenXml2jsValue,
  getDescriptiveValue,
  processQualityIndicatorType,
  type CodeLookupTable,
  type EnrichOptions,
} from "./shared"
import type { RegelingspercelenGLBGeoJSONResponse } from "../types"

/**
 * Transforms the raw RVO XML response object into a GeoJSON FeatureCollection.
 *
 * @param response The parsed XML response object from the SOAP body.
 * @param options Transformation options.
 */
export function transformRegelingspercelenGLBToGeoJSON(
  response: any,
  options: EnrichOptions = {},
): RegelingspercelenGLBGeoJSONResponse {
  const root = findSoapBodyContent(response, "OpvragenRegelingspercelenGLBResponse")

  const farmsRaw = root["Farm"]
  if (!farmsRaw) {
    return { type: "FeatureCollection", features: [] }
  }

  const farms = Array.isArray(farmsRaw) ? farmsRaw : [farmsRaw]
  const features: Feature<Geometry, any>[] = []

  for (const farm of farms) {
    if (!farm) continue
    
    // Support both the documented "GLBField" and the actually returned "Field" tag
    const fieldsRaw = farm["Field"] || farm["GLBField"]
    if (fieldsRaw) {
      features.push(...processFarmFields(fieldsRaw, options))
    }
  }

  return { type: "FeatureCollection", features }
}

function processFarmFields(fieldsRaw: any, options: EnrichOptions): Feature<Geometry, any>[] {
  const fields = Array.isArray(fieldsRaw) ? fieldsRaw : [fieldsRaw]
  const features: Feature<Geometry, any>[] = []

  for (const fieldRaw of fields) {
    if (!fieldRaw) continue
    
    // Support both direct field properties and nested "GLBField" containers
    const glbField = fieldRaw["GLBField"] || fieldRaw
    
    const geometry = convertGmlToGeoJson(glbField["Border"])
    const properties = extractProperties(glbField, options)
    
    if (geometry) {
      features.push({ type: "Feature", geometry, properties })
    }
  }

  return features
}

const GLB_CODE_LOOKUPS: CodeLookupTable = {
  Grondsoort: ["Grondsoort"],
  GebruiksTitel: ["UseTitleCode"],
  BiologischeProductiewijze: ["BiologischeProductiewijze"],
  AgroforestryTeelmethode: ["AgroforestryTeelmethode"],
  IndNPGOptie: ["IndNPGOptie"],
  VerzekeraarBwv: ["VerzekeraarBwv"],
  IndNateeltMest: ["IndNateeltMest"],
  GewasbeschermingHoofdteelt: ["Gewasbescherming"],
  Grondbedekking: ["CropTypeCode", "onbekend gewas"],
}

/**
 * Extracts and simplifies properties from a GLBField object.
 */
function extractProperties(glbField: any, options: EnrichOptions): Record<string, any> {
  return buildFieldProperties(
    glbField,
    options,
    (key, value) => {
      if (key === "QualityIndicator") {
        return processQualityIndicatorType(value, options, "GLBFieldQICause")
      }
      if (key === "Voorteelt" || key === "Nateelt") {
        return Array.isArray(value)
          ? value.map((v) => simplifyObject(v, options))
          : simplifyObject(value, options)
      }
      if (key === "Task") {
        return Array.isArray(value)
          ? value.map((v) => processTask(v, options))
          : processTask(value, options)
      }
      return flattenXml2jsValue(value)
    },
    (key, value) => getDescriptiveValue(key, value, GLB_CODE_LOOKUPS),
  )
}

function processTask(task: any, options: EnrichOptions): any {
  if (!task) return task
  const simplified = { ...task }
  if (simplified.Operation) {
    simplified.Operation = Array.isArray(simplified.Operation)
      ? simplified.Operation.map((op: any) => processOperation(op, options))
      : processOperation(simplified.Operation, options)
  }
  return simplifyObject(simplified, options)
}

function processOperation(op: any, options: EnrichOptions): any {
  if (!op) return op
  const simplified = { ...op }
  if (simplified.Treatmentzone) {
    simplified.Treatmentzone = Array.isArray(simplified.Treatmentzone)
      ? simplified.Treatmentzone.map((tz: any) => processTreatmentzone(tz, options))
      : processTreatmentzone(simplified.Treatmentzone, options)
  }
  return simplifyObject(simplified, options)
}

function processTreatmentzone(tz: any, options: EnrichOptions): any {
  if (!tz) return tz
  const simplified = { ...tz }

  // Extract geometry if present
  if (simplified.Border) {
    simplified.geometry = convertGmlToGeoJson(simplified.Border)
    delete simplified.Border
  }

  if (simplified.QualityIndicator) {
    simplified.QualityIndicator = processQualityIndicatorType(
      simplified.QualityIndicator,
      options,
      "ActivityCause",
    )
  }

  return simplifyObject(simplified, options)
}

function getSimplifiedObjectDescriptiveValue(key: string, value: any): string | null {
  if (key === "Inzaaidatum") {
    return getLabel("InzaaidatumCode", value) ?? null
  }
  if (key === "Grondbedekking") {
    return getLabel("CropTypeCode", value, "onbekend gewas") ?? null
  }
  if (key === "GewasbeschermingVoorteelt") {
    return getLabel("Gewasbescherming", value) ?? null
  }
  if (key === "ActivityCode") {
    return getLabel("ActivityCode", value) ?? null
  }
  if (key === "DeviationReason") {
    return getLabel("DeviationReason", value) ?? null
  }
  return null
}

function simplifyObject(obj: any, options: EnrichOptions = {}): any {
  if (!obj || typeof obj !== "object") return obj

  const newObj: Record<string, any> = {}
  const descriptiveValues: Record<string, any> = {}

  for (const key of Object.keys(obj)) {
    if (key === "descriptiveValues") continue
    newObj[key] = flattenXml2jsValue(obj[key])

    if (options.enrichResponse) {
      const dv = getSimplifiedObjectDescriptiveValue(key, newObj[key])
      if (dv !== null) descriptiveValues[key] = dv
    }
  }

  if (options.enrichResponse && Object.keys(descriptiveValues).length > 0) {
    newObj.descriptiveValues = descriptiveValues
  }

  return newObj
}
