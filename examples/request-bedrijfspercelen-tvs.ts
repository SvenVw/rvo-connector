import { RvoClient } from "../src/client"
import * as readline from "readline"
import "dotenv/config"

async function main() {
  // Configuration from environment variables
  const clientId = process.env.CLIENT_ID
  const clientName = process.env.CLIENT_NAME
  const redirectUri = process.env.REDIRECT_URI
  const pkioPrivateKey = process.env.PKIO_PRIVATE_KEY
  const env = (process.env.NODE_ENV === "production" ? "production" : "acceptance") as
    | "acceptance"
    | "production"

  if (!clientId || !clientName || !redirectUri || !pkioPrivateKey) {
    console.error(
      "Error: Missing required environment variables (CLIENT_ID, CLIENT_NAME, REDIRECT_URI, PKIO_PRIVATE_KEY).",
    )
    console.error("Please check your .env file.")
    process.exit(1)
  }

  console.log("--- RVO TVS Connection Example (Bedrijfspercelen) ---")
  console.log(`Environment: ${env}`)

  const client = new RvoClient({
    environment: env,
    authMode: "TVS",
    clientId: clientId,
    clientName: clientName,
    tvs: {
      clientId: clientId,
      redirectUri: redirectUri,
      pkioPrivateKey: pkioPrivateKey,
    },
  })

  // Step 1: Get Authorization URL
  const authUrl = client.getAuthorizationUrl({
    service: "opvragenBedrijfspercelen",
  })

  console.log("\n1. Please open the following URL in your browser to authorize:")
  console.log(authUrl)
  console.log(
    '\nAfter authorization, RVO will redirect to your REDIRECT_URI with a "code" parameter.',
  )

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  })

  rl.question(
    "Please paste the authorization code from the redirect URL here: ",
    async (authorizationCode) => {
      if (!authorizationCode) {
        console.error("\nERROR: No authorization code provided.")
        rl.close()
        return
      }

      console.log("\n2. Exchanging authorization code for access token...")
      try {
        const tokenData = await client.exchangeAuthCode(authorizationCode.trim())
        console.log("Expires In (seconds):", tokenData.expires_in)

        rl.question(
          "\nPlease enter the Farm ID (KvK-nummer) to query crop fields (optional, press Enter for test farm): ",
          async (farmId) => {
            rl.question(
              "\nChoose output format (xml/geojson) [default: geojson]: ",
              async (formatRaw) => {
                const format = (formatRaw.trim().toLowerCase() || "geojson") as "xml" | "geojson"

                console.log("\n3. Fetching Bedrijfspercelen...")
                try {
                  const result = await client.opvragenBedrijfspercelen({
                    farmId: farmId.trim() || undefined,
                    outputFormat: format,
                  })
                  console.log("\nSuccessfully fetched Bedrijfspercelen:")
                  console.log(JSON.stringify(result, null, 2))
                } catch (error) {
                  console.error("\nFailed to fetch Bedrijfspercelen:", error)
                } finally {
                  rl.close()
                }
              },
            )
          },
        )
      } catch (error) {
        console.error("\nFailed to obtain access token:", error)
        rl.close()
      }
    },
  )
}

void main()
