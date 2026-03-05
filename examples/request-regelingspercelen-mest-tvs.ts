import { RvoClient } from "../src/client"
import * as readline from "node:readline"
import * as fs from "node:fs"
import "dotenv/config"

try {
  // Configuration from environment variables
  const clientId = process.env.CLIENT_ID
  const clientName = process.env.CLIENT_NAME
  const redirectUri = process.env.REDIRECT_URI
  let pkioPrivateKey = process.env.PKIO_PRIVATE_KEY
  const env = process.env.NODE_ENV === "production" ? "production" : "acceptance"

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
    (pkioPrivateKey.endsWith(".pem") || pkioPrivateKey.endsWith(".key"))
  ) {
    try {
      pkioPrivateKey = fs.readFileSync(pkioPrivateKey, "utf8")
    } catch (error) {
      console.error(`Error reading private key file at ${pkioPrivateKey}:`, error)
      process.exit(1)
    }
  }

  console.log("--- RVO TVS Connection Example (Regelingspercelen Mest) ---")
  console.log(`Environment: ${env}`)

  const client = new RvoClient({
    environment: env,
    authMode: "TVS",
    clientName: clientName,
    requestTimeoutMs: 30000,
    tvs: {
      clientId: clientId,
      redirectUri: redirectUri,
      pkioPrivateKey: pkioPrivateKey,
    },
  })

  // Step 1: Get Authorization URL
  const authUrl = client.getAuthorizationUrl({
    service: "opvragenRegelingspercelenMest",
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
    const authorizationCodeRaw = await ask(
      "Please paste the authorization code from the redirect URL here: ",
    )
    const authorizationCode = authorizationCodeRaw.trim()

    if (!authorizationCode) {
      console.error("\nERROR: No authorization code provided.")
      throw new Error("No authorization code provided.")
    }

    console.log("\n2. Exchanging authorization code for access token...")
    const tokenData = await client.exchangeAuthCode(authorizationCode)
    console.log("Expires In (seconds):", tokenData.expires_in)

    const farmId = await ask("\nPlease enter the Farm ID (KvK-nummer) to query (optional): ")

    const beginDate = await ask(
      "\nPlease enter Period Begin Date (YYYY-MM-DD) [default: current year-01-01]: ",
    )

    const endDate = await ask(
      "\nPlease enter Period End Date (YYYY-MM-DD) [default: begin + 2 years]: ",
    )

    const mutationStartDate = await ask(
      "\nPlease enter Mutation Start Date (YYYY-MM-DD) [optional]: ",
    )

    const mandatedRepresentative = await ask("\nPlease enter Mandated Representative [optional]: ")

    const formatRaw = await ask("\nChoose output format (xml/geojson) [default: geojson]: ")
    const formatInput = formatRaw.trim().toLowerCase() || "geojson"
    const format: "xml" | "geojson" = formatInput === "xml" ? "xml" : "geojson"

    console.log("\n3. Fetching Regelingspercelen Mest...")
    const result = await client.opvragenRegelingspercelenMest({
      farmId: farmId.trim() || undefined,
      periodBeginDate: beginDate.trim() || undefined,
      periodEndDate: endDate.trim() || undefined,
      mutationStartDate: mutationStartDate.trim() || undefined,
      mandatedRepresentative: mandatedRepresentative.trim() || undefined,
      outputFormat: format,
      enrichResponse: format === "geojson",
    })

    console.log("\nSuccessfully fetched Regelingspercelen Mest:")
    console.log(JSON.stringify(result, null, 2))
  } finally {
    rl.close()
  }
} catch (error) {
  console.error("\nAn error occurred:", error)
  process.exitCode = 1
}
