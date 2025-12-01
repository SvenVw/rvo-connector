import type { FeatureCollection, Geometry } from "geojson"

/**
 * Configuration for TVS (OAuth 2.0 / eHerkenning) authentication.
 */
export interface RvoAuthTvsConfig {
  /** Client ID (e.g., from RVO portal). Typically your OIN or similar identifier. */
  clientId: string;
  /** Redirect URI registered with RVO for the OAuth 2.0 callback. */
  redirectUri: string;
  /**
   * Private key from the PKIoverheid certificate.
   * This can be the raw key content (PEM string) or a file path to the .pem file.
   * Used to sign the client assertion JWT.
   */
  pkioPrivateKey: string;
  /** Optional override for the OAuth2 Authorize Endpoint. */
  authorizeEndpoint?: string;
  /** Optional override for the OAuth2 Token Endpoint. */
  tokenEndpoint?: string;
}

/**
 * Configuration for ABA (username/password) authentication.
 * Used primarily for legacy or specific service connections.
 */
export interface RvoAuthAbaConfig {
  /** The username for ABA authentication. */
  username: string
  /** The password for ABA authentication. */
  password?: string
}

/**
 * Main configuration options for the `RvoClient`.
 */
export interface RvoClientConfig {
  /**
   * Preferred authentication method.
   * - `'TVS'`: Uses OAuth 2.0 with eHerkenning (recommended for most modern services).
   * - `'ABA'`: Uses legacy Username/Password WS-Security.
   * @default 'TVS'
   */
  authMode?: "ABA" | "TVS"
  /**
   * Environment to connect to.
   * - `'acceptance'`: RVO Acceptance/Pre-production environment.
   * - `'production'`: RVO Production environment.
   * @default 'acceptance'
   */
  environment?: "production" | "acceptance"

  /**
   * ID of the Client (e.g., your organization's OIN or KVK number).
   * This is typically the OIN used for eHerkenning.
   */
  clientId: string

  /**
   * Name of the Client (e.g., your organization's name).
   * This name is used to identify both the Issuer and Sender in the SOAP request envelope.
   */
  clientName: string

  /** Configuration specific to TVS authentication. Required if `authMode` is 'TVS'. */
  tvs?: RvoAuthTvsConfig
  /** Configuration specific to ABA authentication. Required if `authMode` is 'ABA'. */
  aba?: RvoAuthAbaConfig

  /** Optional override for the EdiCrop webservice URL (TVS mode). */
  ediCropUrl?: string
  /** Optional override for the EdiCrop webservice URL (ABA mode). */
  ediCropAbaUrl?: string
}

/**
 * Options for the `opvragenBedrijfspercelen` (GetCropFields) service.
 */
export interface BedrijfspercelenOptions {
  /**
   * Farm ID to query (e.g., KvK, Vestigingsnummer, or BSN).
   * If provided, this is sent as the `ThirdPartyFarmID` in the request.
   */
  farmId?: string
  /**
   * Start date of the period to retrieve data for (YYYY-MM-DD).
   * @default 'Current Year-01-01'
   */
  periodBeginDate?: string
  /**
   * End date of the period to retrieve data for (YYYY-MM-DD).
   * @default 'Current Year+2-01-01'
   */
  periodEndDate?: string
  /**
   * Output format for the response.
   * - `'xml'`: Returns the raw JavaScript object parsed from the SOAP XML.
   * - `'geojson'`: Converts the response to a GeoJSON FeatureCollection (always projected to WGS84 / EPSG:4326).
   * @default 'xml'
   */
  outputFormat?: "xml" | "geojson"
}

/**
 * Properties of a Quality Indicator (KI).
 * Derived from `QualityIndicatorType` in RVO documentation.
 */
export interface QualityIndicator {
  /** Code of the indicator (e.g., KI004). Codelist: CL413. */
  IndicatorCode: "KI001" | "KI002" | "KI003" | "KI004" | "KI005" | "KI2210" | "KI2030" | "KI2051" | "KI21020" | "KI111001"
  /** Severity of the indicator (i.e., FATAAL, FOUT, WAARSCHUWING, FOUT). Codelist: CL415. */
  SeverityCode: "FATAAL" | "FOUT" | "WAARSCHUWING" | "INFO"
  /** Description of the indicator. */
  Description: string
  /** GeoJSON geometry associated with the indicator (if any). Transformed from GML. */
  geometry?: Geometry
  /** Cause of the update/mutation (e.g., 'A' for Active/New, 'D' for Delete). Only present in mutation contexts. */
  QualityIndicatorCause?: string
}

/**
 * Properties of a Crop Field (Bedrijfsperceel).
 * These properties are extracted from the XML response and simplified.
 * Derived from `CropField` in RVO documentation.
 */
export interface CropFieldProperties {
  /** Unique identification of the parcel (e.g., RVO27378529CFD...). */
  CropFieldID: string
  /** Unique identification of the parcel known by a third party (optional). */
  ThirdPartyCropFieldID?: string
  /** Version number of the CropField (changes when properties change). */
  CropFieldVersion: string
  /** User-assigned name/designator for the field. */
  CropFieldDesignator: string
  /** Start date of the field's validity (YYYY-MM-DDTHH:MM:SS). */
  BeginDate: string
  /** End date of the field's validity (YYYY-MM-DDTHH:MM:SS). */
  EndDate?: string
  /** Country code (ISO 2 letter), usually 'NL'. */
  Country: string
  /** Crop Type Code (e.g., 247). Codelist: CL263 or CL411. */
  CropTypeCode: string | number
  /** Variety Code (optional). Codelist: CL232. */
  VarietyCode?: string | number
  /** Production Purpose Code (optional). Codelist: CL251. */
  CropProductionPurposeCode?: string | number
  /** Field Use Code (optional). Codelist: CL888. */
  FieldUseCode?: string | number
  /** Regulatory Soil Type Code (optional). Codelist: CL405. */
  RegulatorySoiltypeCode?: string | number
  /** Use Title Code (e.g., '01' for Eigen gebruik). Codelist: CL412. */
  UseTitleCode: "01" | "02" | "03" | "04" | "07" | "09" | "10" | "11" | "12" | "13" | "14" | "61" | "62" | "63"
  /** Cause of the update/mutation (e.g., 'A', 'D'). Only present in mutation contexts. */
  CropFieldCause?: string
  /** List of quality indicators/warnings associated with this field. */
  QualityIndicatorType?: QualityIndicator[] | QualityIndicator
}

/**
 * Generic interface for the parsed XML response from Bedrijfspercelen service.
 * The structure depends on the SOAP response.
 */
export interface BedrijfspercelenXmlResponse {
  [key: string]: any
}

/**
 * GeoJSON output for Bedrijfspercelen.
 * A FeatureCollection where each feature represents a CropField.
 */
export type BedrijfspercelenGeoJSONResponse = FeatureCollection<
  Geometry,
  CropFieldProperties
>

/**
 * Union type for the response of `opvragenBedrijfspercelen`.
 */
export type BedrijfspercelenResponse =
  | BedrijfspercelenXmlResponse
  | BedrijfspercelenGeoJSONResponse

/**
 * Response from the RVO OAuth 2.0 Token Endpoint.
 */
export interface RvoTokenResponse {
  /** The OAuth 2.0 access token. */
  access_token: string;
  /** The token type (usually "Bearer"). */
  token_type: string;
  /** Token expiration time in seconds. */
  expires_in: number;
  /** The refresh token (if provided). */
  refresh_token?: string;
  /** Scopes granted by the token. */
  scope?: string;
  /** Additional properties from the token response. */
  [key: string]: any;
}
