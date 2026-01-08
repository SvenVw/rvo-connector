# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [UNRELEASED]

### Added

- Mutation Support (MuterenBedrijfspercelen): Added full support for the crop field mutation lifecycle.
  - Submit insertions, updates, and deletions (`muterenBedrijfspercelen`).
  - Track status (`opvragenProcesvoortgang`).
  - Retrieve validation results (`opvragenValidatieresultaat`).
  - Handle TAN requests (`ophalenTanVolgnummer`) and formalization (`formaliserenOpgave`).
  - Cancel requests (`annulerenOpgave`).
- GeoJSON Support: Automatic transformation of GeoJSON (WGS84) to RVO-compliant GML (RD New/EPSG:28992) for mutation requests.
- Request Chaining: Added `precedingTicketId` support to link related mutation requests.
- Robust Validation: Implemented strict validation for mutation actions (e.g., ensuring `EndDate` is provided for deletions).
- New Example: Added `examples/mutate-bedrijfspercelen-tvs.ts` demonstrating the complete mutation flow.
- CI Workflow: Added GitHub Actions for automated unit testing and type checking on every push and pull request.

### Fixed

- Authentication: Refactored `TvsAuth` to remove redundant error handling and improved variable naming for better code clarity.
- Reliability: Ensured all example scripts correctly handle asynchronous execution by awaiting the main entry point.
- Code Quality: Cleaned up various linting warnings and unused imports across the codebase.

## [1.0.1] - 2026-01-05

### Security

- Patch for CVE-2025-15284

## [1.0.0] - 2025-12-16

### Added

- First stable release
- Security policy
- Contribution guidelines
- Code of Conduct

### Security

- Patch for CVE-2025-65945

## [0.1.0] - 2025-12-01

### Added

- Initial release of `@nmi-agro/rvo-connector`.
- Basic client for RVO EDI-Crop webservices with ABA and TVS (eHerkenning) authentication.
- Support for `OpvragenBedrijfspercelen` service.
- Conversion of `OpvragenBedrijfspercelen` response to GeoJSON (WGS84) with GML parsing and coordinate transformation.
- Validation for PKIO Private Key format.
- Example scripts for ABA and TVS authentication.
- Detailed TSDoc documentation for public API.
- GitHub Actions workflow for npm package publishing on release.
- Comprehensive unit tests for GML to GeoJSON transformation and core client functionality.
