import { RvoClient } from "../src/client"
import * as readline from "node:readline"
import * as fs from "node:fs"
import * as path from "node:path"
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

  console.log("--- RVO TVS Connection Example (Regelingspercelen GLB) ---")
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
    service: "opvragenRegelingspercelenGLB",
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

    const beginDateInput = await ask(
      "\nPlease enter Period Begin Date (YYYY-MM-DD) [default: current year-01-01]: ",
    )
    const beginDate = beginDateInput.trim() || `${new Date().getFullYear()}-01-01`

    const endDateInput = await ask(
      "\nPlease enter Period End Date (YYYY-MM-DD) [default: begin + 2 years]: ",
    )
    let endDate = endDateInput.trim()
    if (!endDate) {
      const d = new Date(beginDate)
      d.setFullYear(d.getFullYear() + 2)
      endDate = d.toISOString().split("T")[0]
    }

    const mutationStartDateInput = await ask(
      "\nPlease enter Mutation Start Date (YYYY-MM-DD [HH:mm:ss]) [optional, defaults to midnight]: ",
    )
    const mutationStartDate = mutationStartDateInput.trim() || undefined

    const mandatedRepresentative = await ask("\nPlease enter Mandated Representative [optional]: ")

    const formatRaw = await ask("\nChoose output format (xml/geojson) [default: geojson]: ")
    const formatInput = formatRaw.trim().toLowerCase() || "geojson"
    const format: "xml" | "geojson" = formatInput === "xml" ? "xml" : "geojson"

    console.log("\n3. Fetching Regelingspercelen GLB...")
    const result = await client.opvragenRegelingspercelenGLB({
      farmId: farmId.trim() || undefined,
      periodBeginDate: beginDate,
      periodEndDate: endDate,
      mutationStartDate,
      mandatedRepresentative: mandatedRepresentative.trim() || undefined,
      outputFormat: format,
      enrichResponse: format === "geojson",
    })

    const tempDir = path.join(process.cwd(), "temp")
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir)
    }

    const filename = `output-regelingspercelen-glb.${format === "xml" ? "xml" : "json"}`
    const filePath = path.join(tempDir, filename)

    fs.writeFileSync(filePath, JSON.stringify(result, null, 2))
    console.log(`\nSuccessfully fetched Regelingspercelen GLB. Output written to: ${filename}`)
  } finally {
    rl.close()
  }
} catch (error) {
  console.error("\nAn error occurred:", error)
  process.exitCode = 1
}
