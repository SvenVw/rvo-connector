import axios from 'axios';
import xml2js from 'xml2js';
import type { RvoClientConfig, BedrijfspercelenOptions, BedrijfspercelenResponse, RvoAuthTvsConfig, RvoTokenResponse } from './types';
import { TvsAuth } from './auth/tvs';
import { buildBedrijfspercelenRequest } from './soap/builder';

// Default Endpoints for different environments
const ENDPOINTS = {
  acceptance: {
    tvsAuthorize: 'https://pp2.toegang.overheid.nl/kvo/authorize',
    tvsToken: 'https://pp2.toegang.overheid.nl/kvo/token',
    ediCropTvs: 'https://edicrop-acc.agro.nl/edicrop/EdiCrop-WebService/v2',
    ediCropAba: 'https://edicrop-acc.agro.nl/edicrop/EdiCropService',
  },
  production: {
    tvsAuthorize: 'https://toegang.overheid.nl/kvo/authorize',
    tvsToken: 'https://toegang.overheid.nl/kvo/token',
    ediCropTvs: 'https://edicrop.agro.nl/edicrop/EdiCrop-WebService/v2',
    ediCropAba: 'https://edicrop.agro.nl/edicrop/EdiCropService',
  },
};

// Scopes for eHerkenning (URNs) based on environment
const EHERKENNING_SCOPES = {
  acceptance: 'urn:nl-eid-gdi:1.0:ServiceUUID:44345953-4138-4f53-3454-593459414d45',
  production: 'urn:nl-eid-gdi:1.0:ServiceUUID:37534755-4536-4152-5747-595850325434',
};

export type RvoService = 'opvragenBedrijfspercelen' | 'muterenBedrijfspercelen';

const SERVICE_SCOPES: Record<RvoService, string> = {
  opvragenBedrijfspercelen: 'RVO-WS.GEO.bp.lezen',
  muterenBedrijfspercelen: 'RVO-WS.GEO.bp.muteren',
};

export interface AuthUrlOptions {
  service?: RvoService;
  state?: string;
}

export class RvoClient {
  private config: RvoClientConfig;
  private tvsAuth?: TvsAuth;
  private accessToken?: string;

  constructor(config: RvoClientConfig) {
    this.config = {
      authMode: 'TVS', // Default authentication mode
      environment: 'acceptance', // Default environment
      ...config
    };

    const env = this.config.environment!;
    const envEndpoints = ENDPOINTS[env];

    // Override with explicit endpoints if provided in config
    const ediCropTvsUrl = this.config.ediCropUrl || envEndpoints.ediCropTvs;
    const ediCropAbaUrl = this.config.ediCropAbaUrl || envEndpoints.ediCropAba;

    // Configure TVS Auth
    if (this.config.authMode === 'TVS') {
      if (!this.config.tvs) {
        throw new Error('TVS authentication mode selected but TVS configuration is missing.');
      }
      const tvsAuthConf: RvoAuthTvsConfig = {
        authorizeEndpoint: this.config.tvs.authorizeEndpoint || envEndpoints.tvsAuthorize,
        tokenEndpoint: this.config.tvs.tokenEndpoint || envEndpoints.tvsToken,
        ...this.config.tvs, // Spread existing TVS config to allow overrides
      };
      this.tvsAuth = new TvsAuth(tvsAuthConf);
    }

    // Update config with resolved URLs for internal use
    this.config.ediCropUrl = ediCropTvsUrl;
    this.config.ediCropAbaUrl = ediCropAbaUrl;
  }

  // --- Auth Methods (TVS) ---

  /**
   * Generates the authorization URL for the specified RVO service.
   * Combines the service-specific scope with the eHerkenning scope for the current environment.
   * @param options Options for generating the URL (service, state).
   */
  public getAuthorizationUrl(options: AuthUrlOptions = {}): string {
    if (this.config.authMode !== 'TVS' || !this.tvsAuth) {
      throw new Error('Authentication mode is not TVS or TVS configuration is missing.');
    }

    const service = options.service || 'opvragenBedrijfspercelen';
    const env = this.config.environment || 'acceptance';
    const eherkenningScope = EHERKENNING_SCOPES[env];
    const serviceScope = SERVICE_SCOPES[service];

    // Combine scopes separated by space
    const fullScope = `${serviceScope} ${eherkenningScope}`;

    return this.tvsAuth.getAuthorizationUrl(fullScope, options.state);
  }

  public async exchangeAuthCode(code: string): Promise<RvoTokenResponse> {
    if (this.config.authMode !== 'TVS' || !this.tvsAuth) {
      throw new Error('Authentication mode is not TVS or TVS configuration is missing.');
    }
    const tokenData = await this.tvsAuth.getAccessToken(code);
    this.accessToken = tokenData.access_token;
    return tokenData;
  }

  public setAccessToken(token: string) {
    this.accessToken = token
  }

  // --- Service Methods ---

  public async opvragenBedrijfspercelen(
    options: BedrijfspercelenOptions = {},
  ): Promise<BedrijfspercelenResponse> {
    const isTvs = this.config.authMode === "TVS"

    if (isTvs && !this.accessToken) {
      throw new Error(
        "Access token is missing. Authenticate via TVS first or set the access token.",
      )
    }
    if (!isTvs && (!this.config.aba || !this.config.aba.username)) {
      throw new Error(
        "ABA authentication mode selected but ABA username is missing.",
      )
    }

    const soapXml = buildBedrijfspercelenRequest({
      farmId: options.farmId,
      periodBeginDate: options.periodBeginDate,
      periodEndDate: options.periodEndDate,
      abaCredentials: isTvs ? undefined : this.config.aba,
      issuerId: this.config.issuerId,
      senderId: this.config.senderId,
    })

    const url = isTvs ? this.config.ediCropUrl! : this.config.ediCropAbaUrl!

    const headers: Record<string, string> = {
      "Content-Type": "text/xml; charset=utf-8",
    }

    if (isTvs && this.accessToken) {
      headers["Authorization"] = `Bearer ${this.accessToken}`
    }

    try {
      const response = await axios.post(url, soapXml, { headers })

      const parser = new xml2js.Parser({ explicitArray: false })
      const result = await parser.parseStringPromise(response.data)

      return result
    } catch (error: any) {
      if (axios.isAxiosError(error)) {
        const msg = error.response?.data || error.message
        throw new Error(`Request failed: ${error.response?.status} - ${msg}`)
      }
      throw error
    }
  }
}
