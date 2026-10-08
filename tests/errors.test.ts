import { describe, it, expect } from "vitest"
import { RvoSoapFaultError, parseSoapFault } from "../src/errors"

const EDI009_FAULT = `<?xml version='1.0' encoding='UTF-8'?><S:Envelope xmlns:S="http://schemas.xmlsoap.org/soap/envelope/"><S:Body><ns0:Fault xmlns:ns0="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ns1="http://www.w3.org/2003/05/soap-envelope"><faultcode>ns0:Server</faultcode><faultstring>Toegang geweigerd. U bent niet gemachtigd om deze actie uit te voeren.</faultstring><detail><ns1:EdiCropExceptionFault xmlns:ns1="http://www.minez.nl/ws/edicrop/1.0/EdiCropException"><code>EDI009</code><description>Toegang geweigerd. U bent niet gemachtigd om deze actie uit te voeren.</description></ns1:EdiCropExceptionFault></detail></ns0:Fault></S:Body></S:Envelope>`

const GENERIC_FAULT = `<?xml version='1.0' encoding='UTF-8'?><S:Envelope xmlns:S="http://schemas.xmlsoap.org/soap/envelope/"><S:Body><S:Fault><faultcode>S:Client</faultcode><faultstring>Invalid request</faultstring></S:Fault></S:Body></S:Envelope>`

describe("parseSoapFault", () => {
  it("should parse an EdiCropExceptionFault", async () => {
    expect(await parseSoapFault(EDI009_FAULT)).toEqual({
      faultCode: "Server",
      faultString: "Toegang geweigerd. U bent niet gemachtigd om deze actie uit te voeren.",
      ediCode: "EDI009",
      ediDescription: "Toegang geweigerd. U bent niet gemachtigd om deze actie uit te voeren.",
    })
  })

  it("should parse a fault without EDI details", async () => {
    expect(await parseSoapFault(GENERIC_FAULT)).toEqual({
      faultCode: "Client",
      faultString: "Invalid request",
      ediCode: undefined,
      ediDescription: undefined,
    })
  })

  it("should return undefined for non-fault or invalid XML", async () => {
    expect(await parseSoapFault("<xml>response</xml>")).toBeUndefined()
    expect(await parseSoapFault("not xml with Fault")).toBeUndefined()
    expect(await parseSoapFault("")).toBeUndefined()
  })
})

describe("RvoSoapFaultError", () => {
  it("should explain the farmId cause for EDI009 when farmId was sent", async () => {
    const fault = (await parseSoapFault(EDI009_FAULT))!
    const error = new RvoSoapFaultError(fault, 500, EDI009_FAULT, { farmIdSent: true })

    expect(error.name).toBe("RvoSoapFaultError")
    expect(error.ediCode).toBe("EDI009")
    expect(error.httpStatus).toBe(500)
    expect(error.rawResponse).toBe(EDI009_FAULT)
    expect(error.message).toContain("RVO denied access (EDI009)")
    expect(error.message).toContain("Farmers should omit `farmId`")
    expect(error.message).toContain("machtiging")
  })

  it("should not mention omitting farmId for EDI009 when farmId was not sent", async () => {
    const fault = (await parseSoapFault(EDI009_FAULT))!
    const error = new RvoSoapFaultError(fault, 500, EDI009_FAULT)

    expect(error.message).toContain("RVO denied access (EDI009)")
    expect(error.message).not.toContain("farmId")
    expect(error.message).toContain("not authorised")
  })

  it("should build a generic message for other faults", () => {
    const withCode = new RvoSoapFaultError({ ediCode: "EDI001", ediDescription: "Oops" }, 500, "")
    expect(withCode.message).toBe('RVO returned a SOAP fault (EDI001): "Oops"')

    const withoutCode = new RvoSoapFaultError({ faultString: "Invalid request" }, 500, "")
    expect(withoutCode.message).toBe('RVO returned a SOAP fault: "Invalid request"')
  })
})
