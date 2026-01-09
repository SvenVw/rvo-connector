import { RvoClient } from "../src/client"
import * as readline from "readline"
import "dotenv/config"

async function main() {
  // Configuration from environment variables
  const clientId = process.env.CLIENT_ID
  const clientName = process.env.CLIENT_NAME
  const username = process.env.ABA_USERNAME
  const password = process.env.ABA_PASSWORD
  const env = (process.env.NODE_ENV === "production" ? "production" : "acceptance") as
    | "acceptance"
    | "production"

  if (!clientId || !clientName || !username || !password) {
    console.error(
      "Error: Missing required environment variables (CLIENT_ID, CLIENT_NAME, ABA_USERNAME, ABA_PASSWORD).",
    )
    console.error("Please check your .env file.")
    process.exit(1)
  }

  console.log("--- RVO ABA Connection Example (Bedrijfspercelen) ---")
  console.log(`Environment: ${env}`)

  const client = new RvoClient({
    environment: env,
    authMode: "ABA",
    clientId: clientId,
    clientName: clientName,
    requestTimeoutMs: 30000,
    aba: {
      username: username,
      password: password,
    },
  })

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  })

  const ask = (query: string) => new Promise<string>((resolve) => rl.question(query, resolve))

  try {
    const farmId = await ask(
      "\nPlease enter the Farm ID (KvK-nummer) to query crop fields (optional, press Enter for test farm): ",
    )
    const formatRaw = await ask("\nChoose output format (xml/geojson) [default: geojson]: ")
    const formatInput = formatRaw.trim().toLowerCase() || "geojson"
    const format: "xml" | "geojson" = formatInput === "xml" ? "xml" : "geojson"

    console.log("\nFetching Bedrijfspercelen...")
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
