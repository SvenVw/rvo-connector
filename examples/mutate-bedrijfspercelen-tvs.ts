import { RvoClient } from "../src/client"
import * as readline from "readline"
import * as fs from "fs"
import * as path from "path"
import { fileURLToPath } from "url"
import "dotenv/config"
import type { CropFieldMutation } from "../src/types"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

async function main() {
  // Configuration from environment variables
  const clientId = process.env.CLIENT_ID
  const clientName = process.env.CLIENT_NAME
  const redirectUri = process.env.REDIRECT_URI
  const pkioPrivateKey = process.env.PKIO_PRIVATE_KEY
  const env = (
    process.env.NODE_ENV === "production" ? "production" : "acceptance"
  ) as "acceptance" | "production"

  if (!clientId || !clientName || !redirectUri || !pkioPrivateKey) {
    console.error(
      "Error: Missing required environment variables (CLIENT_ID, CLIENT_NAME, REDIRECT_URI, PKIO_PRIVATE_KEY).",
    )
    console.error("Please check your .env file.")
    process.exit(1)
  }

  console.log("--- RVO TVS Connection Example (MuterenBedrijfspercelen) ---")
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

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  })

  // Helper for async question
  const ask = (q: string) =>
    new Promise<string>((resolve) => rl.question(q, resolve))

  try {
    // Step 1: Authorization
    const authUrl = client.getAuthorizationUrl({
      service: "muterenBedrijfspercelen",
    })

    console.log(
      "\n1. Please open the following URL in your browser to authorize:",
    )
    console.log(authUrl)
    console.log(
      '\nAfter authorization, RVO will redirect to your REDIRECT_URI with a "code" parameter.',
    )

    const code = await ask(
      "Please paste the authorization code from the redirect URL here: ",
    )
    if (!code) throw new Error("No code provided")

    console.log("\n2. Exchanging code for token...")
    await client.exchangeAuthCode(code.trim())
    console.log("Authentication successful.")

    // Step 2: Prepare Mutation
    const farmId = await ask("\nEnter Farm ID (KvK) to mutate: ")
    if (!farmId) throw new Error("Farm ID required")

    // List available GeoJSON files
    const fieldsDir = path.join(__dirname, "fields")
    let geoFiles: string[] = []
    try {
      geoFiles = fs.readdirSync(fieldsDir).filter((f) => f.endsWith(".geojson"))
    } catch {
      console.warn("Could not list example fields from", fieldsDir)
    }

    const mutations: CropFieldMutation[] = []

    if (geoFiles.length > 0) {
      console.log("\nAvailable example fields:")
      geoFiles.forEach((f, i) => console.log(`${i + 1}. ${f}`))
      const choice = await ask(
        "Select a file number (or press Enter for default hardcoded polygon): ",
      )
      const idx = parseInt(choice) - 1

      if (!isNaN(idx) && geoFiles[idx]) {
        const filePath = path.join(fieldsDir, geoFiles[idx])
        console.log(`Reading geometry from ${filePath}...`)
        const fileContent = fs.readFileSync(filePath, "utf-8")
        const geoJson = JSON.parse(fileContent)

        // If it's a FeatureCollection or Feature, extract geometry and properties
        if (geoJson.type === "FeatureCollection") {
          for (const feature of geoJson.features) {
            mutations.push({
              action: "I",
              geometry: feature.geometry,
              properties: {
                CropFieldDesignator:
                  feature.properties?.CropFieldDesignator || "Demo Veld CLI",
                CropTypeCode: feature.properties?.CropTypeCode || 247,
                BeginDate:
                  feature.properties?.BeginDate || new Date().toISOString(),
              },
            })
          }
        } else if (geoJson.type === "Feature") {
          mutations.push({
            action: "I",
            geometry: geoJson.geometry,
            properties: {
              CropFieldDesignator:
                geoJson.properties?.CropFieldDesignator || "Demo Veld CLI",
              CropTypeCode: geoJson.properties?.CropTypeCode || 247,
              BeginDate:
                geoJson.properties?.BeginDate || new Date().toISOString(),
            },
          })
        } else {
          // Direct geometry
          mutations.push({
            action: "I",
            geometry: geoJson,
            properties: {
              CropFieldDesignator: "Demo Veld CLI",
              CropTypeCode: 247,
              BeginDate: new Date().toISOString(),
            },
          })
        }
      }
    }

    // Default hardcoded mutation if no file selected
    if (mutations.length === 0) {
      console.log("Using default hardcoded polygon.")
      const defaultGeometry = {
        type: "Polygon",
        coordinates: [
          [
            [5.0, 52.0],
            [5.1, 52.0],
            [5.1, 52.1],
            [5.0, 52.1],
            [5.0, 52.0],
          ],
        ],
      }
      mutations.push({
        action: "I",
        geometry: defaultGeometry,
        properties: {
          CropFieldDesignator: "Demo Veld CLI",
          CropTypeCode: 247, // Mais fallback
          BeginDate: new Date().toISOString(),
        },
      })
    }

    console.log(
      `\nSubmitting demo mutation (Insert ${mutations.length} field(s))...`,
    )
    const { ticketId } = await client.muterenBedrijfspercelen({
      farmId: farmId.trim(),
      mutations,
    })
    console.log(`Mutation submitted. Ticket ID: ${ticketId}`)

    // Step 3: Poll
    console.log("\n3. Polling for status...")
    let status = ""
    const terminalStates = [
      "GEVALIDEERD",
      "VALIDATIEFOUT",
      "TECHNISCHEFOUT",
      "GEANNULEERD",
    ]

    while (!terminalStates.includes(status)) {
      const progress = await client.opvragenProcesvoortgang(ticketId)
      status = progress.status
      console.log(
        `   Status: ${status} (${progress.percentage}%) - ${progress.message}`,
      )

      if (!terminalStates.includes(status)) {
        await new Promise((r) => setTimeout(r, 2000))
      }
    }

    if (status !== "GEVALIDEERD") {
      console.error(`Process ended with non-success status: ${status}`)
      rl.close()
      return
    }

    // Step 4: Validation
    console.log("\n4. Checking validation results...")
    const validation = await client.opvragenValidatieresultaat(ticketId)

    if (validation.messages && validation.messages.length > 0) {
      console.log(
        "Validation messages:",
        JSON.stringify(validation.messages, null, 2),
      )
      const hasFatal = validation.messages.some(
        (m: any) => m.severity === "FATAAL",
      )
      if (hasFatal) {
        console.error("Fatal errors found. Cannot proceed.")
        const doCancel = await ask("Cancel request? (y/n): ")
        if (doCancel.toLowerCase() === "y") {
          await client.annulerenOpgave(ticketId)
          console.log("Request cancelled.")
        }
        rl.close()
        return
      }
    } else {
      console.log("No validation messages found.")
    }

    // Step 5: Commit?
    const action = await ask(
      "\nDo you want to (F)ormalize or (C)ancel or (Q)uit? [F/C/Q]: ",
    )

    if (action.toUpperCase() === "F") {
      console.log("\n5. Fetching TAN Sequence Number...")
      const { sequenceNumber } = await client.ophalenTanVolgnummer(
        farmId.trim(),
      )
      console.log(`Required Sequence Number: ${sequenceNumber}`)

      const tanCode = await ask(
        `Enter TAN Code for sequence ${sequenceNumber}: `,
      )
      if (tanCode) {
        console.log("Formalizing...")
        const res = await client.formaliserenOpgave(
          ticketId,
          sequenceNumber,
          tanCode.trim(),
        )
        console.log("Result:", res)
      }
    } else if (action.toUpperCase() === "C") {
      console.log("Cancelling...")
      const res = await client.annulerenOpgave(ticketId)
      console.log("Result:", res)
    } else {
      console.log("Exiting.")
    }
  } catch (error) {
    console.error("\nError:", error)
  } finally {
    rl.close()
  }
}
main().catch(console.error)
