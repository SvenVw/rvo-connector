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
    (pkioPrivateKey.endsWith(".pem") || pkioPrivateKey.endsWith(".key"))
  ) {
    try {
      pkioPrivateKey = fs.readFileSync(pkioPrivateKey, "utf8")
    } catch (error) {
      console.error(`Error reading private key file at ${pkioPrivateKey}:`, error)
      process.exit(1)
    }
  }

  console.log("--- RVO TVS Connection Example (DierenWS - Animal Registrations) ---")
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
    services: ["raadplegenDieren", "raadplegenDierDetails"],
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

    const ubn = await ask("\nPlease enter the Meldingeenheid (UBN) to query animals [required]: ")
    const relatieHouder = await ask("\nPlease enter the Relatienummer Houder [required]: ")

    if (!ubn.trim() || !relatieHouder.trim()) {
      console.error("\nERROR: Both UBN and Relatienummer Houder are required for raadplegenDieren.")
      throw new Error("Required search parameters missing.")
    }

    const formatRaw = await ask("\nChoose output format (xml/json) [default: json]: ")
    const formatInput = formatRaw.trim().toLowerCase() || "json"
    const format: "xml" | "json" = formatInput === "xml" ? "xml" : "json"

    console.log("\n3. Fetching animal list using raadplegenDieren...")
    const listResult = await client.raadplegenDieren({
      selRelatienummerHouder: relatieHouder.trim(),
      selMeldingeenheid: ubn.trim(),
      outputFormat: format,
    })

    const tempDir = path.join(process.cwd(), "temp")
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir)
    }

    const listFilename = `output-dieren-lijst.${format === "xml" ? "xml" : "json"}`
    const listFilePath = path.join(tempDir, listFilename)
    const listOutput =
      format === "xml" ? (listResult as string) : JSON.stringify(listResult, null, 2)
    fs.writeFileSync(listFilePath, listOutput, "utf8")
    console.log(`Successfully fetched animal list. Output written to: ${listFilePath}`)

    // If json format was chosen, try to pick the first animal's life number and query details
    if (format === "json" && listResult.dieren && listResult.dieren.length > 0) {
      const firstAnimal = listResult.dieren[0]
      const dierLevensnummer = firstAnimal.dierLevensnummer
      const dierLandcode = firstAnimal.dierLandcode

      if (dierLevensnummer) {
        console.log(
          `\n4. Automatically fetching details for first animal (${dierLandcode || "NL"} ${dierLevensnummer})...`,
        )
        const detailsResult = await client.raadplegenDierDetails({
          selRelatienummerHouder: relatieHouder.trim(),
          selMeldingeenheid: ubn.trim(),
          selDierLevensnummer: dierLevensnummer,
          selDierLandcode: dierLandcode,
          indVerblijfplaatsen: "J",
          indVlaggen: "J",
          indNakomelingen: "J",
          indMerken: "J",
          outputFormat: "json",
        })

        const detailsFilename = "output-dier-details.json"
        const detailsFilePath = path.join(tempDir, detailsFilename)
        fs.writeFileSync(detailsFilePath, JSON.stringify(detailsResult, null, 2), "utf8")
        console.log(`Successfully fetched animal details. Output written to: ${detailsFilePath}`)
      }
    } else if (format === "json") {
      console.log("\nNo animals found in the returned list to query details for.")
    }
  } finally {
    rl.close()
  }
} catch (error) {
  console.error("\nAn error occurred:", error)
  process.exitCode = 1
}
