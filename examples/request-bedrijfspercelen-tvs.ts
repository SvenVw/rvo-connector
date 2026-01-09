import { RvoClient } from "../src/client"
import * as readline from "readline"
import * as fs from "node:fs"
import "dotenv/config"

async function main() {
  // Configuration from environment variables
  const clientId = process.env.CLIENT_ID
  const clientName = process.env.CLIENT_NAME
  const redirectUri = process.env.REDIRECT_URI
  let pkioPrivateKey = process.env.PKIO_PRIVATE_KEY
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

  // If the private key looks like a file path, read the file content
  if (
    !pkioPrivateKey.includes("PRIVATE KEY") &&
    (pkioPrivateKey.endsWith(".pem") ||
      pkioPrivateKey.endsWith(".key") ||
      fs.existsSync(pkioPrivateKey))
  ) {
    try {
      pkioPrivateKey = fs.readFileSync(pkioPrivateKey, "utf8")
    } catch (error) {
      console.error(`Error reading private key file at ${pkioPrivateKey}:`, error)
      process.exit(1)
    }
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

  const ask = (query: string) => new Promise<string>((resolve) => rl.question(query, resolve))

  try {
    const authorizationCode = await ask(
      "Please paste the authorization code from the redirect URL here: ",
    )

    if (!authorizationCode) {
      console.error("\nERROR: No authorization code provided.")
      return
    }

    console.log("\n2. Exchanging authorization code for access token...")
    const tokenData = await client.exchangeAuthCode(authorizationCode.trim())
    console.log("Expires In (seconds):", tokenData.expires_in)

    const farmId = await ask(
      "\nPlease enter the Farm ID (KvK-nummer) to query crop fields (optional, press Enter for test farm): ",
    )
    const formatRaw = await ask("\nChoose output format (xml/geojson) [default: geojson]: ")
    const formatInput = formatRaw.trim().toLowerCase() || "geojson"
    const format: "xml" | "geojson" = formatInput === "xml" ? "xml" : "geojson"

    console.log("\n3. Fetching Bedrijfspercelen...")
    const result = await client.opvragenBedrijfspercelen({
      farmId: farmId.trim() || undefined,
      outputFormat: format,
    })
    console.log("\nSuccessfully fetched Bedrijfspercelen:")
    console.log(JSON.stringify(result, null, 2))
  } finally {
    rl.close()
  }
}

main().catch((error) => {
  console.error("\nAn error occurred:", error)
  process.exit(1)
})
