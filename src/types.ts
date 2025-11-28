export interface RvoAuthTvsConfig {
  /** Client ID (e.g., from RVO portal) */
  clientId: string;
  /** Redirect URI registered with RVO */
  redirectUri: string;
  /** Private key content or path to the key file */
  privateKey: string;
  /** OAuth2 Authorize Endpoint */
  authorizeEndpoint?: string;
  /** OAuth2 Token Endpoint */
  tokenEndpoint?: string;
}

export interface RvoAuthAbaConfig {
  username: string
  password?: string // Password might not be needed if using certificate? No, example uses password.
}

export interface RvoClientConfig {
  /** Preferred authentication method. Defaults to 'TVS'. */
  authMode?: "ABA" | "TVS"
  /** Environment to use for RVO services. Defaults to 'acceptance'. */
  environment?: "production" | "acceptance"

  /** ID of the Issuer (e.g., your organization's code). */
  issuerId?: string
  /** ID of the Sender (e.g., your organization's code). */
  senderId?: string

  tvs?: RvoAuthTvsConfig
  aba?: RvoAuthAbaConfig

  /** Base URL for the EdiCrop webservice (TVS) */
  ediCropUrl?: string
  /** Base URL for the EdiCrop webservice (ABA) */
  ediCropAbaUrl?: string
}

export interface BedrijfspercelenOptions {
  /** Farm ID (KvK, Vestigingsnummer, or BSN). If not provided, might default to the authenticated user's data? Example says "Optional" but sends ThirdPartyFarmID if present. */
  farmId?: string
  /** Start date (YYYY-MM-DD). Defaults to Jan 1st of current year. */
  periodBeginDate?: string
  /** End date (YYYY-MM-DD). Defaults to Jan 1st of current year + 2. */
  periodEndDate?: string
}

// Placeholder for the parsed XML response
export interface BedrijfspercelenResponse {
  [key: string]: any
}

export interface RvoTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  scope?: string;
  [key: string]: any;
}
