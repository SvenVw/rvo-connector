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
   * This ID is used to identify both the Issuer and Sender in the SOAP request envelope.
   */
  clientId: string

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
}

/**
 * Generic interface for the parsed XML response from Bedrijfspercelen service.
 * The structure depends on the SOAP response.
 */
export interface BedrijfspercelenResponse {
  [key: string]: any
}

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
