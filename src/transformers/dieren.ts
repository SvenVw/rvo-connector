import { findSoapBodyContent } from "../utils/geometry"
import { getLabel, mapIndicator } from "../utils/codelists"
import type { EnrichOptions } from "./shared"

const ANIMAL_CODE_LOOKUPS: Record<string, string> = {
  dierSoort: "Diersoort",
  selDierSoort: "Diersoort",
  dierGeslacht: "DierGeslacht",
  moederGeslacht: "DierGeslacht",
  selDierGeslacht: "DierGeslacht",
}

function enrichAnimal(obj: any): any {
  if (obj === undefined || obj === null) return obj
  if (typeof obj !== "object") return obj

  if (Array.isArray(obj)) {
    return obj.map(enrichAnimal)
  }

  const enriched: any = {}
  const descriptiveValues: Record<string, any> = {}

  for (const [key, value] of Object.entries(obj)) {
    const enrichedValue = enrichAnimal(value)
    enriched[key] = enrichedValue

    const lookupList = ANIMAL_CODE_LOOKUPS[key]
    if (lookupList) {
      const label = getLabel(lookupList, enrichedValue)
      if (label) {
        descriptiveValues[key] = label
      }
    }

    if (typeof enrichedValue === "string" && (enrichedValue === "J" || enrichedValue === "N")) {
      descriptiveValues[key] = mapIndicator(enrichedValue)
    }
  }

  if (Object.keys(descriptiveValues).length > 0) {
    enriched.descriptiveValues = descriptiveValues
  }

  return enriched
}

function cleanObject(obj: any): any {
  if (obj === undefined || obj === null) return obj
  if (typeof obj !== "object") return obj

  if (Array.isArray(obj)) {
    return obj.map(cleanObject)
  }

  // Handle xml2js text node flattening (e.g. { _: "value" })
  if (obj._ !== undefined && Object.keys(obj).every((k) => k === "_" || k === "$")) {
    return cleanObject(obj._)
  }

  const cleaned: any = {}
  for (const [key, value] of Object.entries(obj)) {
    cleaned[key] = cleanObject(value)
  }
  return cleaned
}

export function ensureArray<T>(value: any): T[] {
  if (value === undefined || value === null) return []
  if (Array.isArray(value)) return value
  return [value]
}

export function transformRaadplegenDieren(response: any, options: EnrichOptions = {}): any {
  if (!response || Object.keys(response).length === 0) return {}
  const root = findSoapBodyContent(response, "raadplegenDierenResponse")
  if (!root || Object.keys(root).length === 0) return {}

  let cleanedRoot = cleanObject(root)

  // Ensure that "dieren" is an array
  if (cleanedRoot.dieren) {
    cleanedRoot.dieren = ensureArray(cleanedRoot.dieren)
  } else {
    cleanedRoot.dieren = []
  }

  if (options.enrichResponse) {
    cleanedRoot = enrichAnimal(cleanedRoot)
  }

  return cleanedRoot
}

export function transformRaadplegenDierDetails(response: any, options: EnrichOptions = {}): any {
  if (!response || Object.keys(response).length === 0) return {}
  const root = findSoapBodyContent(response, "raadplegenDierDetailsResponse")
  if (!root || Object.keys(root).length === 0) return {}

  let cleanedRoot = cleanObject(root)

  // Ensure arrays for various optional sub-lists
  const arrayFields = [
    "dierDetailsVerblijfplaatsen",
    "dierBuitenlandseVerblijven",
    "dierVlaggen",
    "dierNakomelingen",
    "opmerkingenExportwaardigheid",
    "paspoortGegevens",
    "merkGegevens",
    "registratiesEnInstanties",
    "overigeDieren",
  ]

  for (const field of arrayFields) {
    if (cleanedRoot[field]) {
      cleanedRoot[field] = ensureArray(cleanedRoot[field])
    } else {
      cleanedRoot[field] = []
    }
  }

  // Also clean up nested arrays inside "overigeDieren" if present
  if (cleanedRoot.overigeDieren) {
    for (const od of cleanedRoot.overigeDieren) {
      for (const field of arrayFields) {
        if (od[field]) {
          od[field] = ensureArray(od[field])
        } else {
          od[field] = []
        }
      }
    }
  }

  if (options.enrichResponse) {
    cleanedRoot = enrichAnimal(cleanedRoot)
  }

  return cleanedRoot
}
