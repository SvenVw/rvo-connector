# @nmi-agro/rvo-connector

[![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/SvenVw/rvo-connector)

A TypeScript client library for connecting to RVO (Rijksdienst voor Ondernemend Nederland) webservices to exchange agricultural data. This package simplifies the process of making API calls for services like `OpvragenBedrijfspercelen` using either ABA (username/password) or TVS (OAuth2/eHerkenning) authentication.

## Disclaimer

This package is **not officially supported by RVO**. It is developed and maintained by the [**Nutriënten Management Instituut (NMI)**](https://www.nmi-agro.nl) to facilitate easier integration with RVO webservices for the agricultural sector.

## Prerequisites

Before using this package, ensure you have completed the following steps with RVO:

1. **Account & Connection**: Contact RVO to register your organization and request access to the webservices (e.g., EDI-Crop).
2. **PKIoverheid Certificate**: You must possess a valid PKIoverheid (PKIO) certificate for authentication, especially when using the TVS (eHerkenning) flow or signing requests.
3. **Official Documentation**: For detailed specifications, business rules, and connection procedures, refer to the official RVO documentation:
   - [RVO Webservices Documentation](https://www.rvo.nl/onderwerpen/webservices)
4. **IP Whitelisting**: Connections to RVO webservices are typically restricted to whitelisted IP addresses. Ensure your public IP address (or the IP address of your server/hosting environment) is registered and whitelisted with RVO. This means that testing and production environments must use whitelisted IPs to establish a connection.

## Features

- **Authentication Support**:
  - **ABA**: Direct username/password authentication.
  - **TVS (OAuth2)**: Full support for eHerkenning flows, including generating authorization URLs and exchanging codes for tokens.
- **Environment Handling**: Built-in support for `acceptance` and `production` environments with automatic endpoint selection.
- **Type Safety**: Written in TypeScript with full type definitions.
- **SOAP Integration**: Automates XML request building and response parsing for RVO's SOAP services.
- **GeoJSON Output**: Optionally convert `opvragenBedrijfspercelen` responses to standardized GeoJSON format (WGS84) for easy mapping and spatial analysis.

## Authentication Methods: ABA vs. TVS

This library supports two authentication methods for connecting to RVO webservices: `ABA` and `TVS`. Each method serves a different primary use case, and understanding these differences is key to choosing the right one for your application.

### ABA

- **What it is**: A legacy authentication method using a simple **username and password**.
- **Primary Use Case**: ABA is best suited for **automated, non-interactive (server-to-server)** data exchange. This is ideal for background processes where your application needs to retrieve data on behalf of a farmer who has pre-authorized your service.
- **Authorization**: To use ABA, the farmer must first grant your organization a specific authorization (_machtiging_) for the required services directly within the **Mijn RVO portal**. Without this manual, one-time setup by the farmer, your application cannot access their data.

### TVS

- **What it is**: The modern, secure authentication standard based on **eHerkenning** and the **OAuth2.0** protocol, secured with PKIoverheid certificates.
- **Primary Use Case**: TVS is more suitable for **interactive applications** where the farmer is present and logs in to initiate a data exchange.
- **Authorization**: The key advantage of TVS is that it simplifies authorization. By logging in with their eHerkenning credentials, the farmer provides **on-the-spot consent** for your application to access their data for that session. This removes the need for them to pre-arrange a _machtiging_ in a separate portal, making the user experience smoother.

## Installation

```bash
npm install @nmi-agro/rvo-connector
# or
pnpm add @nmi-agro/rvo-connector
# or
yarn add @nmi-agro/rvo-connector
```

## Usage

### 1. Initialization

First, instantiate the `RvoClient`. You must provide the `clientId` (typically your organization's reference/OIN) and the target `environment`. This `clientId` will be used for both the Issuer and Sender in SOAP requests.

```typescript
import { RvoClient } from "@nmi-agro/rvo-connector"

const client = new RvoClient({
  // 'acceptance' or 'production'
  environment: "acceptance",

  // Your organization's identifiers
  clientId: "YOUR_CLIENT_ID", // e.g. OIN or KVK
  clientName: "YOUR_CLIENT_NAME", // Name of your organization

  // Configure Authentication Modes
  authMode: "TVS", // 'TVS' (default) or 'ABA'

  // TVS Configuration (if using TVS)
  tvs: {
    clientId: "YOUR_CLIENT_ID",
    redirectUri: "https://your-app.com/callback",
    pkioPrivateKey: "YOUR_PKIO_PRIVATE_KEY_CONTENT",
  },

  // ABA Configuration (if using ABA)
  aba: {
    username: "YOUR_ABA_USERNAME",
    password: "YOUR_ABA_PASSWORD",
  },
})
```

### 2. Authentication (TVS Only)

For TVS (eHerkenning), you need to handle the OAuth2 flow.

#### Step A: Get the Authorization URL

Redirect the user to the URL generated by `getAuthorizationUrl`. This method automatically constructs the correct scope based on the environment and the requested service.

```typescript
// Optional: Pass a 'state' for CSRF protection
const authUrl = client.getAuthorizationUrl({
  state: "unique-state-string",
  service: "opvragenBedrijfspercelen", // Default
})

console.log("Redirect user to:", authUrl)
```

#### Step B: Exchange Code for Token

After the user logs in with eHerkenning, they are redirected back to your application with a `code`. Exchange this for an access token.

```typescript
const code = "code-from-redirect-query-param"

try {
  const tokenResponse = await client.exchangeAuthCode(code)
  console.log("Access Token:", tokenResponse.access_token)

  // The client automatically sets the access token internally,
  // but you can also manage it manually:
  // client.setAccessToken(tokenResponse.access_token);
} catch (error) {
  console.error("Authentication failed:", error)
}
```

### 3. Fetching Data

Fetch data from RVO services. The client handles the SOAP envelope, security headers, and XML parsing.

```typescript
try {
  // Example 1: Get raw XML response (default)
  const result = await client.opvragenBedrijfspercelen({
    farmId: "KVK_NUMBER",
    periodBeginDate: "2024-01-01",
    periodEndDate: "2025-01-01",
  })
  console.log("Raw XML Data:", result)

  // Example 2: Get as GeoJSON (reprojected to WGS84)
  const geoJsonResult = await client.opvragenBedrijfspercelen({
    farmId: "KVK_NUMBER",
    outputFormat: "geojson",
  })
  console.log("GeoJSON Data:", geoJsonResult)
} catch (error) {
  console.error("Error fetching data:", error)
}
```

### ABA Authentication

If using ABA, simply configure the `aba` options and set `authMode: 'ABA'`. The client will automatically include the `UsernameToken` in the SOAP header. No manual token exchange is required.

```typescript
const abaClient = new RvoClient({
  authMode: 'ABA',
  environment: 'production',
  clientId: 'YOUR_CLIENT_ID',
  clientName: 'YOUR_CLIENT_NAME',
  aba: {
    username: 'user',
    password: 'password'
  }
});

// Ready to call immediately
await abaClient.opvragenBedrijfspercelen({ ... });
```

## Examples

This project includes example scripts to demonstrate how to connect to RVO services using both ABA and TVS authentication.

### Running Examples

1. Ensure you have configured your `.env` file as described in the "Development & Testing" section.
2. Run the example scripts using `tsx`:

   **ABA Authentication (Username/Password):**

   ```bash
   npx tsx examples/request-bedrijfspercelen-aba.ts
   ```

   **TVS Authentication (eHerkenning/OAuth2):**

   ```bash
   npx tsx examples/request-bedrijfspercelen-tvs.ts
   ```

## Configuration Options

| Option       | Type               | Description                                                                 |
| ------------ | ------------------ | --------------------------------------------------------------------------- |
| `authMode`   | `'TVS' \| 'ABA'`   | Authentication method. Defaults to `'TVS'`.                                 |
| `clientId`   | `string`           | **Required**. Your organization's Client ID (e.g., OIN).                    |
| `clientName` | `string`           | **Required**. Your organization's name, used for Issuer and Sender in SOAP. |
| `tvs`        | `RvoAuthTvsConfig` | Required if `authMode` is `'TVS'`.                                          |
| `aba`        | `RvoAuthAbaConfig` | Required if `authMode` is `'ABA'`.                                          |

### Method Options: `opvragenBedrijfspercelen`

| Option            | Type                 | Description                                                                                      |
| ----------------- | -------------------- | ------------------------------------------------------------------------------------------------ |
| `farmId`          | `string`             | Optional. KvK/BSN to query.                                                                      |
| `periodBeginDate` | `string`             | Start date (YYYY-MM-DD).                                                                         |
| `periodEndDate`   | `string`             | End date (YYYY-MM-DD).                                                                           |
| `outputFormat`    | `'xml' \| 'geojson'` | Defaults to `'xml'`. Set to `'geojson'` for FeatureCollection output (always WGS84 / EPSG:4326). |

## Development & Testing

To run the tests locally, you need to configure your environment variables.

1. Copy the example environment file:

   ```bash
   cp .env.example .env
   ```

2. Fill in the `.env` file with your credentials:

   ```dotenv
   # Authentication Settings (Required for running tests)
   ABA_USERNAME=your_aba_username
   ABA_PASSWORD=your_aba_password
   CLIENT_ID=your_client_id
   CLIENT_NAME=your_client_name
   REDIRECT_URI=https://your-app.com/callback
   PKIO_PRIVATE_KEY=your_pkio_private_key_content
   ```

   - `ABA_USERNAME`: Username for ABA authentication.
   - `ABA_PASSWORD`: Password for ABA authentication.
   - `CLIENT_ID`: Your Client ID / OIN.
   - `CLIENT_NAME`: Your Client Name (for SOAP Issuer/Sender).
   - `REDIRECT_URI`: The redirect URI registered for your eHerkenning service.
   - `PKIO_PRIVATE_KEY`: The private key from your **PKIoverheid certificate** (PKIo-certificaat). Must be the raw key string (PEM format).

3. Run the tests:

   ```bash
   pnpm test
   ```

## License

MIT
