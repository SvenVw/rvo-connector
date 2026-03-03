/**
 * Mappings for RVO Codelists and Indicators.
 * Values derived from Berichtenboek EDI-Crop BS, Berichtenboek Regelingspercelen Mest, and BRP.
 */

import codelistsData from "./codelists.json"

export const CODELISTS: Record<string, Record<string, string>> = codelistsData

/**
 * Gets a descriptive label for a code from a specific list.
 *
 * @param listName The name of the codelist.
 * @param code The code to look up.
 * @param fallback Optional fallback value if code is not found.
 */
export function getLabel(
  listName: string,
  code: string | number,
  fallback?: string,
): string | undefined {
  const list = CODELISTS[listName]
  if (!list) return fallback
  const label = list[String(code)]
  return label || fallback
}

/**
 * Maps a "J" / "N" (Ja/Nee) string to a boolean.
 */
export function mapIndicator(value: any): boolean | null {
  if (value === "J") return true
  if (value === "N") return false
  return null
}
