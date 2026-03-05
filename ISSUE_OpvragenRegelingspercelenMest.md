# Feature Request: Implement `OpvragenRegelingspercelenMest` Service

## Description

This issue tracks the implementation of the **OpvragenRegelingspercelenMest** service as defined in the RVO documentation (_Berichtenboek EDI-Crop RVO Regelingspercelen Mest v1.0.pdf_). This service allows users to retrieve "Regelingspercelen Mest" (Regulation fields for manure) for a specific relation and period.

The implementation should follow the existing patterns used for `opvragenBedrijfspercelen`.

## Tasks

- [ ] **Define Types:**
  - Create TypeScript interfaces for the SOAP Request (`(EDI)CRPopRequestRegelingspercelenMest`) and Response (`(EDI)CRPopResponseRegelingspercelenMest`) in `src/types.ts`.
  - Ensure all fields from the PDF (e.g., `MestField`, `QualityIndicator`, `Geometry`) are covered.

- [ ] **Update Client Configuration:**
  - Update `RvoService` type in `src/client.ts` to include `'opvragenRegelingspercelenMest'`.
  - Add the corresponding scope `RVO-WS.GEO.rp.lezen` to `SERVICE_SCOPES`.

- [ ] **Implement SOAP Builder:**
  - Create `src/soap/builders/regelingspercelen-mest.ts` (or add to `src/soap/builder.ts` if small enough) to construct the XML request body.
  - Support parameters: `PeriodBeginDate`, `PeriodEndDate`, `MutationStartDate`, `MandatedRepresentative`, and `ThirdPartyFarmID`.

- [ ] **Implement Transformer:**
  - Create `src/transformers/regelingspercelen-mest.ts` to transform the XML response into a usable TypeScript object and/or GeoJSON.
  - **Note:** The response contains complex geometries (`MultiPolygon`), similar to `Bedrijfspercelen`.

- [ ] **Update `RvoClient`:**
  - Add the `opvragenRegelingspercelenMest` method to the `RvoClient` class in `src/client.ts`.
  - Ensure it handles authentication (TVS/ABA) and request execution correctly.

- [ ] **Tests:**
  - Add unit tests for the SOAP builder (validating XML output).
  - Add unit tests for the transformer (validating XML -> Object/GeoJSON conversion).
  - Add a mocked client test in `tests/client.test.ts` (or similar) to verify the flow.

- [ ] **Documentation:**
  - Update `README.md` with usage examples for the new method.

## Technical Details

- **Service Name:** `OpvragenRegelingspercelenMest`
- **Request Message:** `(EDI)CRPopRequestRegelingspercelenMest`
- **Response Message:** `(EDI)CRPopResponseRegelingspercelenMest`
- **TVS Scope:** `RVO-WS.GEO.rp.lezen`
  - _Note:_ This scope is shared across all "Regelingspercelen" services (Mest, nGLB).
- **PDF Reference:** _Berichtenboek EDI-Crop RVO Regelingspercelen Mest v1.0.pdf_
