/**
 * Mappings for RVO Codelists and Indicators.
 * Values derived from Berichtenboek EDI-Crop BS and Berichtenboek Regelingspercelen Mest.
 */

export const CODELISTS: Record<string, Record<string, string>> = {
  /** Use Title Codes (CL412) */
  UseTitleCode: {
    "01": "Eigendom",
    "02": "Reguliere pacht",
    "03": "In gebruik van een terreinbeherende organisatie",
    "04": "Tijdelijk gebruik Land-, Reconstructie- of Herinrichtingswet",
    "07": "Overige exploitatievormen",
    "09": "Erfpacht",
    "10": "Pacht van geringe oppervlakten",
    "11": "Natuurpacht (reservaats- of beheerspacht)",
    "12": "Geliberaliseerde pacht, langer dan 6 jaar",
    "13": "Geliberaliseerde pacht, 6 jaar of korter",
    "61": "Reguliere pacht kortlopend",
    "62": "Eenmalige pacht",
    "63": "Teeltpacht",
  },
  /** Ground Soil Types (CL405) */
  Grondsoort: {
    "1": "Grondsoort > 50% Klei",
    "2": "Grondsoort > 50% Veen",
    "3": "Grondsoort > 50% Zand",
    "4": "Grondsoort > 50% Löss",
    "5": "Grondsoort > 50% Zand of Löss",
    "6": "Grondsoort > 50% Klei of Veen",
  },
  /** Ground Types */
  TypeGrond: {
    "1": "Natuurgrond",
    "2": "Primaire Waterkering",
    "3": "Beide",
  },
  /** Sampling Protocol */
  BemonsteringProtocol: {
    "1": "Ja, laten bemonsteren volgens het Bemonsteringsprotocol",
    "2": "Nee, niet laten bemonsteren volgens het Bemonsteringsprotocol",
  },
  /** Catch Crop (Nateelt) Manure Indicator */
  IndNateeltMest: {
    "1": "Ik teel een nateelt",
    "2": "Mijn hoofdteelt is een winterteelt",
    "3": "Ik zet mijn perceel onder water tegen onkruid en ziektes (inundatie)",
  },
  /** Sowing Date (Inzaaidatum) codes for Catch Crops */
  InzaaidatumCode: {
    "1": "Uiterlijk 1 oktober",
    "2": "Vanaf 2 oktober, maar uiterlijk 15 oktober",
    "3": "Vanaf 16 oktober, maar uiterlijk 31 oktober",
    "4": "Vanaf 1 november",
    "5": "Na 1 oktober",
  },
  /** Severity Codes (CL415) */
  SeverityCode: {
    FATAAL: "Fataal",
    FOUT: "Fout",
    WAARSCHUWING: "Waarschuwing",
    INFO: "Informatie",
  },
  /** Quality Indicator Codes (CL413) */
  IndicatorCode: {
    KI001: "De gebruikstitel is gedurende (een deel van) de looptijd van dit perceel ongeldig.",
    KI002: "De gewascode is gedurende (een deel van) de looptijd van dit perceel ongeldig.",
    KI003: "Dit perceel valt gedurende (een deel van) de looptijd geheel of gedeeltelijk buiten de topografische perceelsgrenzen.",
    KI004: "Dit perceel heeft gedurende (een deel van) de looptijd geheel of gedeeltelijk overlap met een perceel van een andere gebruiker.",
    KI005: "Dit perceel heeft gedurende (een deel van) de looptijd geheel of gedeeltelijk overlap met een van uw andere percelen.",
    KI2210: "Validatie op bedrijfsperceel voor Regelingspercelen.",
    KI12030: "Valideer gewascodes op bedrijfspercelen die buiten RRP moeten liggen",
    KI12051: "Overlap/overschrijding BPL met RRP fysiek voorkomen",
    KI21020: "Ongeldige grondsoort ingevuld",
    KI111001: "Validatie op grondsoort",
  },
  /** Change Type Codes */
  ChangeTypeCode: {
    "10": "Ongewijzigd",
    "20": "Gewijzigd",
    "30": "Nieuw",
    "60": "Geannuleerd",
  },
  /** Mutation Causes */
  Cause: {
    A: "Actief (Nieuw)",
    D: "Verwijderd",
    AR: "Andere reden",
  },
}

/**
 * Gets a descriptive label for a code from a specific list.
 */
export function getLabel(listName: string, code: string | number): string | undefined {
  const list = CODELISTS[listName]
  if (!list) return undefined
  return list[String(code)]
}

/**
 * Maps a "J" / "N" (Ja/Nee) string to a boolean.
 */
export function mapIndicator(value: any): boolean | null {
  if (value === "J") return true
  if (value === "N") return false
  return null
}
