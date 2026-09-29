/** Maximum number of bytes inspected/parsed from a response body. */
export const MAX_BODY_BYTES = 256 * 1024

export interface BoundedBody {
  text: string
  /** True when the body exceeded the limit; `text` is then empty. */
  oversized: boolean
}

/** Reads a response body up to MAX_BODY_BYTES, streaming when possible. */
export async function readBoundedText(response: Response): Promise<BoundedBody> {
  const body = response.body as ReadableStream<Uint8Array> | null | undefined
  if (body && typeof body.getReader === "function") {
    const reader = body.getReader()
    const decoder = new TextDecoder()
    let total = 0
    let text = ""
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      total += value.byteLength
      if (total > MAX_BODY_BYTES) {
        await reader.cancel().catch(() => undefined)
        return { text: "", oversized: true }
      }
      text += decoder.decode(value, { stream: true })
    }
    return { text: text + decoder.decode(), oversized: false }
  }

  const text = await response.text()
  if (text.length > MAX_BODY_BYTES) return { text: "", oversized: true }
  return { text, oversized: false }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

/**
 * Detects a SOAP 1.1/1.2 Fault in a parsed XML document (prefixes already stripped).
 * Returns only a boolean; fault content is never read.
 */
export function hasSoapFault(parsed: unknown): boolean {
  if (!isRecord(parsed)) return false
  const envelope = parsed["Envelope"]
  if (!isRecord(envelope)) return false
  const body = envelope["Body"]
  return isRecord(body) && "Fault" in body
}
