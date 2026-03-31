import { processQualityIndicators } from "../utils/geometry"
import { getLabel, mapIndicator } from "../utils/codelists"

export type EnrichOptions = { enrichResponse?: boolean }
export type CodeLookupTable = Record<string, [string, string?]>

/**
 * Detects if a value is an xml2js text node: `{ _: "value", $: {...} }`.
 * An xml2js text node typically only has the "_" property (content)
 * and optionally the "$" property (attributes).
 */
export function isXml2jsValue(value: any): boolean {
  if (!value || typeof value !== "object" || !("_" in value)) {
    return false
  }

  const keys = Object.keys(value)
  // xml2js text nodes only have "_" (text) and optionally "$" (attributes)
  const isOnlyXmlKeys = keys.every((k) => k === "_" || k === "$")

  // The "_" property should be a primitive (string, number, boolean) or null/undefined
  const textValue = value._
  const isPrimitive = textValue === null || typeof textValue !== "object"

  return isOnlyXmlKeys && isPrimitive
}

/**
 * Flattens xml2js text nodes: `{ _: "value", $: {...} }` → `"value"`.
 * Returns the value unchanged if it is not a simple xml2js text node.
 */
export function flattenXml2jsValue(value: any): any {
  return isXml2jsValue(value) ? value._ : value
}

/**
 * Enriches a single QualityIndicator item with descriptive labels.
 *
 * @param qi The raw QualityIndicator object.
 * @param causeKey The field-specific XML element name for the cause
 *   (e.g. `"QualityIndicatorCause"` or `"MESTFieldQICause"`).
 */
export function enrichQualityIndicatorItem(qi: any, causeKey: string): any {
  const values: Record<string, any> = {}
  if (qi.IndicatorCode) {
    const label = getLabel("IndicatorCode", qi.IndicatorCode)
    if (label) values.IndicatorCode = label
  }
  if (qi.SeverityCode) {
    const label = getLabel("SeverityCode", qi.SeverityCode)
    if (label) values.SeverityCode = label
  }
  if (qi[causeKey]) {
    const label = getLabel("Cause", qi[causeKey])
    if (label) values[causeKey] = label
  }

  return {
    ...qi,
    descriptiveValues: Object.keys(values).length > 0 ? values : null,
  }
}

/**
 * Processes a QualityIndicatorType value, optionally enriching each item with descriptive labels.
 *
 * @param value The raw QualityIndicator data (array or single object).
 * @param options Transformation options.
 * @param causeKey The field-specific XML element name for the cause.
 */
export function processQualityIndicatorType(
  value: any,
  options: EnrichOptions,
  causeKey: string,
): any {
  const processed = processQualityIndicators(value)
  if (options.enrichResponse) {
    if (Array.isArray(processed)) {
      return processed.map((qi) => enrichQualityIndicatorItem(qi, causeKey))
    }
    if (processed && typeof processed === "object") {
      return enrichQualityIndicatorItem(processed, causeKey)
    }
  }
  return processed
}

/**
 * Returns a descriptive value for a field property using a code lookup table,
 * falling back to boolean indicator mapping.
 *
 * @param key The property key.
 * @param value The property value.
 * @param table The lookup table for code-to-label mapping.
 */
export function getDescriptiveValue(
  key: string,
  value: any,
  table: CodeLookupTable,
): string | boolean | null {
  const lookup = table[key]
  if (lookup) return getLabel(lookup[0], value, lookup[1]) ?? mapIndicator(value)
  return mapIndicator(value)
}

/**
 * Core loop to extract and simplify field properties, skipping geometry keys (Border, Geometry).
 * Optionally collects descriptive values using the provided helper.
 *
 * @param field The raw parsed XML field object.
 * @param options Transformation options.
 * @param resolveValue Returns the simplified value for a given key/value pair.
 * @param getDescValue Returns a descriptive value for enrichment, or null to skip.
 */
export function buildFieldProperties(
  field: any,
  options: EnrichOptions,
  resolveValue: (key: string, value: any) => any,
  getDescValue: (key: string, value: any) => string | boolean | null,
): Record<string, any> {
  const properties: Record<string, any> = {}
  const descriptiveValues: Record<string, any> = {}

  for (const key of Object.keys(field)) {
    if (key === "Border" || key === "Geometry") continue

    properties[key] = resolveValue(key, field[key])

    if (options.enrichResponse) {
      const dv = getDescValue(key, properties[key])
      if (dv !== null) descriptiveValues[key] = dv
    }
  }

  if (options.enrichResponse) {
    properties.descriptiveValues =
      Object.keys(descriptiveValues).length > 0 ? descriptiveValues : null
  }

  return properties
}
